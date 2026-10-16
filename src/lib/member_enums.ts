type EnumValue<T> = T[keyof T];

export function enumValues<T extends Record<string, string>>(values: T) {
  return Object.values(values) as [EnumValue<T>, ...EnumValue<T>[]];
}

export const WAIVER_SOURCE = { WEB: 'web', KIOSK: 'kiosk' } as const;
export type WaiverSource = EnumValue<typeof WAIVER_SOURCE>;

export const SUBSCRIPTION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELED: 'canceled',
  DEACTIVATED: 'deactivated',
} as const;
export type SubscriptionStatus = EnumValue<typeof SUBSCRIPTION_STATUS>;

export const VISIT_SOURCE = { KIOSK: 'kiosk', STAFF: 'staff' } as const;
export type VisitSource = EnumValue<typeof VISIT_SOURCE>;

export const ACCESS_BASIS = {
  SUBSCRIPTION: 'subscription',
  ORGANIZATION: 'organization',
  DAY_PASS: 'day_pass',
  NONE: 'none',
} as const;
export type AccessBasis = EnumValue<typeof ACCESS_BASIS>;

export const VISIT_OUTCOME = {
  ADMITTED: 'admitted',
  DENIED_NO_WAIVER: 'denied_no_waiver',
  DENIED_NO_ACCESS: 'denied_no_access',
} as const;
export type VisitOutcome = EnumValue<typeof VISIT_OUTCOME>;

export const MEMBER_EMAIL_TYPE = {
  ONBOARDING: 'onboarding',
  WAIVER_REQUEST: 'waiver_request',
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
