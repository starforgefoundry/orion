import { ACCESS_BASIS, VISIT_OUTCOME, VISIT_SOURCE, WAIVER_SOURCE } from '$lib/member_enums';
import {
  KIOSK_CHECK_IN_STATUS,
  KIOSK_PAIR_PATH,
  KIOSK_PAIR_TOKEN_PARAM,
  type KioskCheckInResult,
  type KioskPairingDto,
  type KioskWaiverDto,
} from '$lib/remotes/dtos/kiosk.dto';
import { BaseService } from '$lib/server/services/base.service';
import { resolveAccess, spaceDate } from '$lib/server/utils/member_access';
import { passTokenFromScan } from '$lib/server/utils/member_links';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DateTime } from 'luxon';

const DEVICE_TOKEN_BYTES = 32;

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
    const member = await this.memberRepository.getByPassToken(passTokenFromScan(scanned));
    if (!member) return { status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS };
    return await this.admit(member.id, now);
  }

  async submitWaiver(dto: KioskWaiverDto, now = DateTime.now()): Promise<KioskCheckInResult> {
    const member = await this.memberRepository.getByPassToken(dto.passToken);
    if (!member) return { status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS };

    await this.waiverRepository.submit(
      { name: dto.name, email: member.email, signature: dto.signature, isAdult: dto.isAdult },
      member.id,
      WAIVER_SOURCE.KIOSK,
    );
    return await this.admit(member.id, now);
  }

  private async admit(memberId: string, now: DateTime): Promise<KioskCheckInResult> {
    const context = await this.memberRepository.getAccessContext(memberId);
    if (!context) return { status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS };

    const { member } = context;
    const access = resolveAccess(context, now);
    const visit = { memberId, source: VISIT_SOURCE.KIOSK, accessBasis: access.basis } as const;

    if (!context.hasWaiver) {
      await this.visitRepository.create({ ...visit, outcome: VISIT_OUTCOME.DENIED_NO_WAIVER });
      return {
        status: KIOSK_CHECK_IN_STATUS.NEEDS_WAIVER,
        passToken: member.passToken,
        name: member.name,
        email: member.email,
      };
    }

    if (access.basis === ACCESS_BASIS.NONE) {
      await this.visitRepository.create({ ...visit, outcome: VISIT_OUTCOME.DENIED_NO_ACCESS });
      return { status: KIOSK_CHECK_IN_STATUS.DENIED, name: member.name };
    }

    if (access.dayPassToUse) {
      await this.dayPassRepository.markUsed(access.dayPassToUse.id, spaceDate(now));
    }
    await this.visitRepository.create({ ...visit, outcome: VISIT_OUTCOME.ADMITTED });
    return { status: KIOSK_CHECK_IN_STATUS.ADMITTED, name: member.name, basis: access.basis };
  }
}

export const kioskService = new KioskService();
