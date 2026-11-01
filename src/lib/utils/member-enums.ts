export type EnumValue<T> = T[keyof T];

export function enumValues<T extends Record<string, string>>(values: T) {
  return Object.values(values) as [EnumValue<T>, ...EnumValue<T>[]];
}

export const WAIVER_SOURCE = { WEB: 'web', KIOSK: 'kiosk' } as const;

export const SUBSCRIPTION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELED: 'canceled',
  DEACTIVATED: 'deactivated',
} as const;
export type SubscriptionStatus = EnumValue<typeof SUBSCRIPTION_STATUS>;

export const VISIT_SOURCE = { KIOSK: 'kiosk', STAFF: 'staff' } as const;

export const ACCESS_BASIS = {
  SUBSCRIPTION: 'subscription',
  ORGANIZATION: 'organization',
  DAY_PASS: 'day_pass',
  NONE: 'none',
} as const;
export type AccessBasis = EnumValue<typeof ACCESS_BASIS>;

/** Bookings admit their holder for the booked day only, so they never count as member access. */
export const VISIT_BASIS = {
  ...ACCESS_BASIS,
  CLASS: 'class',
  CAR_BAY: 'car_bay',
} as const;
export type VisitBasis = EnumValue<typeof VISIT_BASIS>;

export const PASS_KIND = {
  MEMBERSHIP: 'membership',
  DAY_PASS: 'day_pass',
  CLASS: 'class',
  CAR_BAY: 'car_bay',
} as const;
export type PassKind = EnumValue<typeof PASS_KIND>;

export const VISIT_OUTCOME = {
  ADMITTED: 'admitted',
  DENIED_NO_WAIVER: 'denied_no_waiver',
  DENIED_NO_ACCESS: 'denied_no_access',
} as const;

export const MEMBER_EMAIL_TYPE = {
  ONBOARDING: 'onboarding',
  WAIVER_REQUEST: 'waiver_request',
  DAY_PASS: 'day_pass',
} as const;
export type MemberEmailType = EnumValue<typeof MEMBER_EMAIL_TYPE>;

export const MEMBER_EMAIL_TRIGGER = {
  SUBSCRIPTION: 'subscription',
  ORGANIZATION: 'organization',
  DAY_PASS: 'day_pass',
  MANUAL: 'manual',
  SELF_SERVICE: 'self_service',
} as const;
export type MemberEmailTrigger = EnumValue<typeof MEMBER_EMAIL_TRIGGER>;

export const WAIVER_FILTER = { SIGNED: 'signed', MISSING: 'missing' } as const;
export type WaiverFilter = EnumValue<typeof WAIVER_FILTER>;

export const ONBOARDING_FILTER = { SENT: 'sent', NOT_SENT: 'not_sent' } as const;
export type OnboardingFilter = EnumValue<typeof ONBOARDING_FILTER>;

export const MEMBER_SORT = {
  NAME: 'name',
  EMAIL: 'email',
  ONBOARDING_SENT: 'onboarding_sent',
} as const;
export type MemberSort = EnumValue<typeof MEMBER_SORT>;

export const SORT_DIRECTION = { ASC: 'asc', DESC: 'desc' } as const;
export type SortDirection = EnumValue<typeof SORT_DIRECTION>;
