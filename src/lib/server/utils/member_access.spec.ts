import type {
  DayPass,
  MemberSubscription,
  Organization,
  OrganizationMember,
} from '$lib/server/db/schema';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  belongsToOrganization,
  hasMembership,
  resolveAccess,
  SPACE_ZONE,
  type MemberAccessContext,
} from './member_access';

const NOW = DateTime.fromISO('2026-10-16T23:30:00', { zone: SPACE_ZONE });

function context(overrides: Partial<MemberAccessContext> = {}): MemberAccessContext {
  return {
    member: {
      id: 'm1',
      email: 'sam@example.com',
      name: 'Sam',
      phone: null,
      squareCustomerId: null,
      passToken: 'token',
      onboardingToken: 'onboarding-token',
      createdDate: NOW,
    },
    hasWaiver: true,
    subscriptions: [],
    organizations: [],
    dayPasses: [],
    ...overrides,
  };
}

function subscription(overrides: Partial<MemberSubscription> = {}): MemberSubscription {
  return {
    id: 'sub1',
    memberId: 'm1',
    planVariationId: 'plan',
    planName: 'Monthly',
    status: 'active',
    startDate: '2026-01-01',
    chargedThroughDate: '2026-11-01',
    canceledDate: null,
    accessEndedDate: null,
    refundedPaymentId: null,
    updatedDate: NOW,
    ...overrides,
  };
}

function organization(overrides: Partial<Organization> = {}, removed = false) {
  const membership: OrganizationMember = {
    id: 'om1',
    organizationId: 'org1',
    memberId: 'm1',
    addedDate: NOW,
    removedDate: removed ? NOW : null,
  };
  return {
    membership,
    organization: {
      id: 'org1',
      name: 'Robotics Club',
      email: 'robotics@example.com',
      archived: false,
      grantsAccess: true,
      accessEndDate: null,
      ...overrides,
    },
  };
}

function dayPass(id: string, purchasedDaysAgo: number, usedDate: string | null = null): DayPass {
  return {
    id,
    memberId: 'm1',
    squareOrderId: `order-${id}`,
    purchasedDate: NOW.minus({ days: purchasedDaysAgo }),
    usedDate,
    passToken: `pass-${id}`,
  };
}

describe('hasMembership', () => {
  it('counts an active subscription', () => {
    expect(hasMembership(context({ subscriptions: [subscription()] }), NOW)).toBe(true);
  });

  it('counts a current organization membership', () => {
    expect(hasMembership(context({ organizations: [organization()] }), NOW)).toBe(true);
  });

  it('does not count day passes', () => {
    const passes = [dayPass('unused', 1), dayPass('today', 2, '2026-10-16')];

    expect(hasMembership(context({ dayPasses: passes }), NOW)).toBe(false);
  });

  it('does not count a refunded subscription or an organization with access off', () => {
    const refunded = subscription({ accessEndedDate: NOW });
    const off = organization({ grantsAccess: false });

    expect(hasMembership(context({ subscriptions: [refunded], organizations: [off] }), NOW)).toBe(
      false,
    );
  });
});

describe('belongsToOrganization', () => {
  it('counts an organization with access off', () => {
    expect(
      belongsToOrganization(context({ organizations: [organization({ grantsAccess: false })] })),
    ).toBe(true);
  });

  it('does not count a removed membership or an archived organization', () => {
    const removed = organization({}, true);
    const archived = organization({ archived: true });

    expect(belongsToOrganization(context({ organizations: [removed, archived] }))).toBe(false);
  });
});

describe('resolveAccess', () => {
  it('denies a member with nothing on file', () => {
    expect(resolveAccess(context(), NOW)).toEqual({ basis: 'none' });
  });

  it('admits an active subscriber', () => {
    expect(resolveAccess(context({ subscriptions: [subscription()] }), NOW).basis).toBe(
      'subscription',
    );
  });

  it('denies a subscriber whose access was ended by a refund', () => {
    const refunded = subscription({ accessEndedDate: NOW.minus({ hours: 1 }) });

    expect(resolveAccess(context({ subscriptions: [refunded] }), NOW).basis).toBe('none');
  });

  it.each(['pending', 'paused', 'canceled', 'deactivated'] as const)(
    'denies a %s subscription',
    (status) => {
      expect(resolveAccess(context({ subscriptions: [subscription({ status })] }), NOW).basis).toBe(
        'none',
      );
    },
  );

  it('admits an organization member before the access end date', () => {
    const org = organization({ accessEndDate: NOW.plus({ days: 1 }) });

    expect(resolveAccess(context({ organizations: [org] }), NOW).basis).toBe('organization');
  });

  it('denies an organization member after the access end date', () => {
    const org = organization({ accessEndDate: NOW.minus({ minutes: 1 }) });

    expect(resolveAccess(context({ organizations: [org] }), NOW).basis).toBe('none');
  });

  it('denies members of an organization whose access is switched off', () => {
    const org = organization({ grantsAccess: false, accessEndDate: NOW.plus({ days: 30 }) });

    expect(resolveAccess(context({ organizations: [org] }), NOW).basis).toBe('none');
  });

  it('denies members removed from an organization or of an archived one', () => {
    const organizations = [organization({}, true), organization({ archived: true })];

    expect(resolveAccess(context({ organizations }), NOW).basis).toBe('none');
  });

  it('keeps a day pass unused when the member has a subscription', () => {
    const access = resolveAccess(
      context({ subscriptions: [subscription()], dayPasses: [dayPass('d1', 3)] }),
      NOW,
    );

    expect(access).toEqual({ basis: 'subscription' });
  });

  it('uses the oldest unused day pass', () => {
    const passes = [dayPass('newer', 1), dayPass('older', 10)];

    expect(resolveAccess(context({ dayPasses: passes }), NOW).dayPassToUse?.id).toBe('older');
  });

  it('readmits on a day pass already used today without using another', () => {
    const passes = [dayPass('today', 5, '2026-10-16'), dayPass('spare', 1)];

    expect(resolveAccess(context({ dayPasses: passes }), NOW)).toEqual({ basis: 'day_pass' });
  });

  it('treats a pass used on a previous day as spent', () => {
    const passes = [dayPass('yesterday', 5, '2026-10-15')];

    expect(resolveAccess(context({ dayPasses: passes }), NOW).basis).toBe('none');
  });
});
