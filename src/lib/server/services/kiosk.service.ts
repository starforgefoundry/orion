import {
  ACCESS_BASIS,
  PASS_KIND,
  VISIT_BASIS,
  VISIT_OUTCOME,
  VISIT_SOURCE,
  WAIVER_SOURCE,
  type VisitBasis,
} from '$lib/member_enums';
import {
  KIOSK_CHECK_IN_STATUS,
  KIOSK_DENIAL_REASON,
  KIOSK_PAIR_PATH,
  KIOSK_PAIR_TOKEN_PARAM,
  type AdmittedBasis,
  type KioskCheckInResult,
  type KioskDenialReason,
  type KioskPairingDto,
  type KioskWaiverDto,
} from '$lib/remotes/dtos/kiosk.dto';
import type { DayPass, Member } from '$lib/server/db/schema';
import type { BookingPass, IssuedPass } from '$lib/server/repositories/pass.repository';
import { BaseService } from '$lib/server/services/base.service';
import {
  resolveAccess,
  spaceDate,
  type MemberAccessContext,
} from '$lib/server/utils/member_access';
import { passTokenFromScan } from '$lib/server/utils/member_links';
import { CAR_BAY_STATUS, CAR_BAY_TIER_NAMES } from '$lib/utils/car_bay';
import { CLASS_BOOKING_STATUS, CLASS_INSTANCE_STATUS } from '$lib/utils/classes';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DateTime } from 'luxon';

const DEVICE_TOKEN_BYTES = 32;

type PassVerdict =
  | { admitted: true; basis: AdmittedBasis; detail?: string; dayPassToUse?: DayPass }
  | { admitted: false; basis: VisitBasis; reason: KioskDenialReason };

function isBookingPass(pass: IssuedPass): pass is BookingPass {
  return pass.kind === PASS_KIND.CLASS || pass.kind === PASS_KIND.CAR_BAY;
}

function denied(basis: VisitBasis, reason: KioskDenialReason): PassVerdict {
  return { admitted: false, basis, reason };
}

function judgeMembership(context: MemberAccessContext, now: DateTime): PassVerdict {
  const access = resolveAccess(context, now);
  if (access.basis === ACCESS_BASIS.NONE) {
    return denied(access.basis, KIOSK_DENIAL_REASON.NO_ACCESS);
  }
  return { admitted: true, basis: access.basis, dayPassToUse: access.dayPassToUse };
}

/** Booking and day pass tickets admit on their own day only, whatever membership the holder has. */
function judgePass(pass: IssuedPass, context: MemberAccessContext, now: DateTime): PassVerdict {
  const today = spaceDate(now);

  switch (pass.kind) {
    case PASS_KIND.MEMBERSHIP:
      return judgeMembership(context, now);

    case PASS_KIND.DAY_PASS: {
      const { usedDate } = pass.dayPass;
      if (usedDate && usedDate !== today) {
        return denied(VISIT_BASIS.DAY_PASS, KIOSK_DENIAL_REASON.ALREADY_USED);
      }
      return {
        admitted: true,
        basis: VISIT_BASIS.DAY_PASS,
        dayPassToUse: usedDate ? undefined : pass.dayPass,
      };
    }

    case PASS_KIND.CLASS:
      if (
        pass.booking.status !== CLASS_BOOKING_STATUS.CONFIRMED ||
        pass.instance.status !== CLASS_INSTANCE_STATUS.SCHEDULED
      ) {
        return denied(VISIT_BASIS.CLASS, KIOSK_DENIAL_REASON.CANCELED);
      }
      if (pass.instance.date !== today) {
        return denied(VISIT_BASIS.CLASS, KIOSK_DENIAL_REASON.NOT_TODAY);
      }
      return { admitted: true, basis: VISIT_BASIS.CLASS, detail: pass.catalog.name };

    case PASS_KIND.CAR_BAY:
      if (pass.booking.status !== CAR_BAY_STATUS.CONFIRMED) {
        return denied(VISIT_BASIS.CAR_BAY, KIOSK_DENIAL_REASON.CANCELED);
      }
      if (today < spaceDate(pass.booking.startAt) || today > spaceDate(pass.booking.endAt)) {
        return denied(VISIT_BASIS.CAR_BAY, KIOSK_DENIAL_REASON.NOT_TODAY);
      }
      return {
        admitted: true,
        basis: VISIT_BASIS.CAR_BAY,
        detail: CAR_BAY_TIER_NAMES[pass.booking.tier],
      };
  }
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

function pairingPath(deviceToken: string) {
  const params = new URLSearchParams({ [KIOSK_PAIR_TOKEN_PARAM]: deviceToken });
  return `${KIOSK_PAIR_PATH}?${params}`;
}

export class KioskService extends BaseService {
  async getPairing(): Promise<KioskPairingDto> {
    const { deviceToken } = await this.settingsRepository.getSetting('kiosk');
    return { pairingPath: deviceToken ? pairingPath(deviceToken) : null };
  }

  /** Issues a new device token, which signs out every previously paired kiosk. */
  async rotateDeviceToken(): Promise<KioskPairingDto> {
    const deviceToken = randomBytes(DEVICE_TOKEN_BYTES).toString('base64url');
    await this.settingsRepository.setSetting('kiosk', { deviceToken });
    return { pairingPath: pairingPath(deviceToken) };
  }

  async isPairedDevice(candidate: string | undefined) {
    if (!candidate) return false;
    const { deviceToken } = await this.settingsRepository.getSetting('kiosk');
    if (!deviceToken) return false;
    return timingSafeEqual(digest(candidate), digest(deviceToken));
  }

  async checkIn(scanned: string, now = DateTime.now()): Promise<KioskCheckInResult> {
    const pass = await this.passRepository.getByToken(passTokenFromScan(scanned));
    if (!pass) return { status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS };
    return await this.admit(pass, await this.holder(pass), now);
  }

  async submitWaiver(dto: KioskWaiverDto, now = DateTime.now()): Promise<KioskCheckInResult> {
    const pass = await this.passRepository.getByToken(dto.passToken);
    if (!pass) return { status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS };

    const member = await this.holder(pass);
    await this.waiverRepository.submit(
      { name: dto.name, email: member.email, signature: dto.signature, isAdult: dto.isAdult },
      member.id,
      WAIVER_SOURCE.KIOSK,
    );
    return await this.admit(pass, member, now);
  }

  /** Bookings from before passes existed get their member on first scan. */
  private async holder(pass: IssuedPass): Promise<Member> {
    if (!isBookingPass(pass)) return pass.member;
    if (pass.member) return pass.member;

    const member = await this.memberRepository.upsertByEmail(
      pass.booking.customerName,
      pass.booking.customerEmail,
    );
    await this.passRepository.linkMember(pass, member.id);
    return member;
  }

  private async admit(
    pass: IssuedPass,
    member: Member,
    now: DateTime,
  ): Promise<KioskCheckInResult> {
    const context = await this.memberRepository.getAccessContext(member.id);
    if (!context) return { status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS };

    const verdict = judgePass(pass, context, now);
    const visit = {
      memberId: member.id,
      source: VISIT_SOURCE.KIOSK,
      accessBasis: verdict.basis,
    } as const;

    if (!context.hasWaiver) {
      await this.visitRepository.create({ ...visit, outcome: VISIT_OUTCOME.DENIED_NO_WAIVER });
      return {
        status: KIOSK_CHECK_IN_STATUS.NEEDS_WAIVER,
        passToken: pass.passToken,
        name: member.name,
        email: member.email,
      };
    }

    if (!verdict.admitted) {
      await this.visitRepository.create({ ...visit, outcome: VISIT_OUTCOME.DENIED_NO_ACCESS });
      return { status: KIOSK_CHECK_IN_STATUS.DENIED, name: member.name, reason: verdict.reason };
    }

    if (verdict.dayPassToUse) {
      await this.dayPassRepository.markUsed(verdict.dayPassToUse.id, spaceDate(now));
    }
    await this.visitRepository.create({ ...visit, outcome: VISIT_OUTCOME.ADMITTED });
    return {
      status: KIOSK_CHECK_IN_STATUS.ADMITTED,
      name: member.name,
      basis: verdict.basis,
      ...(verdict.detail && { detail: verdict.detail }),
    };
  }
}

export const kioskService = new KioskService();
