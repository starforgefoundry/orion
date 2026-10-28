import { submitWaiverDto } from '$lib/remotes/dtos/waiver.dto';
import { VISIT_BASIS, type EnumValue, type VisitBasis } from '$lib/member_enums';
import * as v from 'valibot';

export const KIOSK_PATH = '/kiosk';
export const KIOSK_PAIR_PATH = '/kiosk/pair';
export const KIOSK_PAIR_TOKEN_PARAM = 'token';
export const KIOSK_DEVICE_COOKIE = 'kiosk_device';

export const KIOSK_CHECK_IN_STATUS = {
  UNKNOWN_PASS: 'unknown_pass',
  NEEDS_WAIVER: 'needs_waiver',
  DENIED: 'denied',
  ADMITTED: 'admitted',
} as const;

export const KIOSK_DENIAL_REASON = {
  NO_ACCESS: 'no_access',
  NOT_TODAY: 'not_today',
  CANCELED: 'canceled',
  ALREADY_USED: 'already_used',
} as const;

export type KioskDenialReason = EnumValue<typeof KIOSK_DENIAL_REASON>;

export type AdmittedBasis = Exclude<VisitBasis, typeof VISIT_BASIS.NONE>;

export type KioskCheckInResult =
  | { status: typeof KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS }
  | {
      status: typeof KIOSK_CHECK_IN_STATUS.NEEDS_WAIVER;
      passToken: string;
      name: string;
      email: string;
    }
  | { status: typeof KIOSK_CHECK_IN_STATUS.DENIED; name: string; reason: KioskDenialReason }
  | {
      status: typeof KIOSK_CHECK_IN_STATUS.ADMITTED;
      name: string;
      basis: AdmittedBasis;
      /** What the booking is for, like the class name. */
      detail?: string;
    };

export type KioskPairingDto = {
  /** Null until staff generate the first device token. */
  pairingPath: string | null;
};

export const kioskCheckInDto = v.pipe(v.string(), v.trim(), v.minLength(1));

export const kioskWaiverDto = v.object({
  ...v.omit(submitWaiverDto, ['email']).entries,
  passToken: v.pipe(v.string(), v.minLength(1)),
});

export type KioskWaiverDto = v.InferOutput<typeof kioskWaiverDto>;
