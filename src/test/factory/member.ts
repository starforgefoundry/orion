import {
  ACCESS_BASIS,
  MEMBER_EMAIL_TRIGGER,
  MEMBER_EMAIL_TYPE,
  SUBSCRIPTION_STATUS,
  VISIT_OUTCOME,
  VISIT_SOURCE,
  WAIVER_SOURCE,
} from '$lib/member_enums';
import type {
  DayPass,
  Member,
  MemberEmail,
  MemberSubscription,
  OrganizationMember,
  User,
  Visit,
  Waiver,
} from '$lib/server/db/schema';
import { DateTime } from 'luxon';
import { newId } from './id';

export function user(overrides: Partial<User> = {}): User {
  return {
    email: 'staff@example.com',
    name: 'Staff Member',
    picture: 'https://example.com/staff.png',
    googleCalendarId: null,
    ...overrides,
  };
}

export function member(overrides: Partial<Member> = {}): Member {
  return {
    id: newId(),
    email: 'member@example.com',
    name: 'Test Member',
    phone: null,
    squareCustomerId: null,
    passToken: newId(),
    onboardingToken: newId(),
    createdDate: DateTime.now(),
    ...overrides,
  };
}

export function waiver(overrides: Partial<Waiver> = {}): Waiver {
  return {
    id: newId(),
    memberId: newId(),
    name: 'Test Member',
    email: 'member@example.com',
    signatureUrl: 'waivers/signature.png',
    signedDate: DateTime.now(),
    source: WAIVER_SOURCE.WEB,
    isAdult: true,
    ...overrides,
  };
}

export function memberSubscription(
  overrides: Partial<MemberSubscription> = {},
): MemberSubscription {
  return {
    id: newId(),
    memberId: newId(),
    planVariationId: newId(),
    planName: 'Monthly',
    status: SUBSCRIPTION_STATUS.ACTIVE,
    startDate: DateTime.now().toISODate()!,
    chargedThroughDate: null,
    canceledDate: null,
    accessEndedDate: null,
    refundedPaymentId: null,
    updatedDate: DateTime.now(),
    ...overrides,
  };
}

export function dayPass(overrides: Partial<DayPass> = {}): DayPass {
  return {
    id: newId(),
    memberId: newId(),
    squareOrderId: newId(),
    purchasedDate: DateTime.now(),
    usedDate: null,
    passToken: newId(),
    ...overrides,
  };
}

export function organizationMember(
  overrides: Partial<OrganizationMember> = {},
): OrganizationMember {
  return {
    id: newId(),
    organizationId: newId(),
    memberId: newId(),
    addedDate: DateTime.now(),
    removedDate: null,
    ...overrides,
  };
}

export function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: newId(),
    memberId: newId(),
    scannedDate: DateTime.now(),
    source: VISIT_SOURCE.KIOSK,
    accessBasis: ACCESS_BASIS.SUBSCRIPTION,
    outcome: VISIT_OUTCOME.ADMITTED,
    ...overrides,
  };
}

export function memberEmail(overrides: Partial<MemberEmail> = {}): MemberEmail {
  return {
    id: newId(),
    memberId: newId(),
    type: MEMBER_EMAIL_TYPE.ONBOARDING,
    trigger: MEMBER_EMAIL_TRIGGER.SUBSCRIPTION,
    sentDate: DateTime.now(),
    ...overrides,
  };
}
