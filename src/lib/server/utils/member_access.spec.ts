import { ACCESS_BASIS, SUBSCRIPTION_STATUS } from '$lib/member_enums';
import type { DayPass } from '$lib/server/db/schema';
import { SPACE_ZONE, spaceDate } from '$lib/space';
import { factory } from '$test/factory';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { belongsToOrganization, hasMembership, resolveAccess } from './member_access';

const NOW = DateTime.fromISO('2026-10-16T23:30:00', { zone: SPACE_ZONE });
const TODAY = spaceDate(NOW);
const YESTERDAY = spaceDate(NOW.minus({ days: 1 }));

const context = factory.memberAccessContext;

function dayPass(purchasedDaysAgo: number, overrides: Partial<DayPass> = {}): DayPass {
  return factory.dayPass({ purchasedDate: NOW.minus({ days: purchasedDaysAgo }), ...overrides });
}

describe('hasMembership', () => {
  it('counts an active subscription', () => {
    expect(hasMembership(context({ subscriptions: [factory.memberSubscription()] }), NOW)).toBe(
      true,
    );
  });

  it('counts a current organization membership', () => {
    expect(hasMembership(context({ organizations: [factory.organizationAccess()] }), NOW)).toBe(
      true,
    );
  });

  it('does not count day passes', () => {
    const passes = [dayPass(1), dayPass(2, { usedDate: TODAY })];

    expect(hasMembership(context({ dayPasses: passes }), NOW)).toBe(false);
  });

  it('does not count a refunded subscription or an organization with access off', () => {
    const refunded = factory.memberSubscription({ accessEndedDate: NOW });
    const off = factory.organizationAccess({ grantsAccess: false });

    expect(hasMembership(context({ subscriptions: [refunded], organizations: [off] }), NOW)).toBe(
      false,
    );
  });
});

describe('belongsToOrganization', () => {
  it('counts an organization with access off', () => {
    const off = factory.organizationAccess({ grantsAccess: false });

    expect(belongsToOrganization(context({ organizations: [off] }))).toBe(true);
  });

  it('does not count a removed membership or an archived organization', () => {
    const removed = factory.organizationAccess({}, { removedDate: NOW });
    const archived = factory.organizationAccess({ archived: true });

    expect(belongsToOrganization(context({ organizations: [removed, archived] }))).toBe(false);
  });
});

describe('resolveAccess', () => {
  it('denies a member with nothing on file', () => {
    expect(resolveAccess(context(), NOW)).toEqual({ basis: ACCESS_BASIS.NONE });
  });

  it('admits an active subscriber', () => {
    const subscriptions = [factory.memberSubscription()];

    expect(resolveAccess(context({ subscriptions }), NOW).basis).toBe(ACCESS_BASIS.SUBSCRIPTION);
  });

  it('denies a subscriber whose access was ended by a refund', () => {
    const refunded = factory.memberSubscription({ accessEndedDate: NOW.minus({ hours: 1 }) });

    expect(resolveAccess(context({ subscriptions: [refunded] }), NOW).basis).toBe(
      ACCESS_BASIS.NONE,
    );
  });

  it.each([
    SUBSCRIPTION_STATUS.PENDING,
    SUBSCRIPTION_STATUS.PAUSED,
    SUBSCRIPTION_STATUS.CANCELED,
    SUBSCRIPTION_STATUS.DEACTIVATED,
  ])('denies a %s subscription', (status) => {
    const subscriptions = [factory.memberSubscription({ status })];

    expect(resolveAccess(context({ subscriptions }), NOW).basis).toBe(ACCESS_BASIS.NONE);
  });

  it('admits an organization member before the access end date', () => {
    const org = factory.organizationAccess({ accessEndDate: NOW.plus({ days: 1 }) });

    expect(resolveAccess(context({ organizations: [org] }), NOW).basis).toBe(
      ACCESS_BASIS.ORGANIZATION,
    );
  });

  it('denies an organization member after the access end date', () => {
    const org = factory.organizationAccess({ accessEndDate: NOW.minus({ minutes: 1 }) });

    expect(resolveAccess(context({ organizations: [org] }), NOW).basis).toBe(ACCESS_BASIS.NONE);
  });

  it('denies members of an organization whose access is switched off', () => {
    const org = factory.organizationAccess({
      grantsAccess: false,
      accessEndDate: NOW.plus({ days: 30 }),
    });

    expect(resolveAccess(context({ organizations: [org] }), NOW).basis).toBe(ACCESS_BASIS.NONE);
  });

  it('denies members removed from an organization or of an archived one', () => {
    const organizations = [
      factory.organizationAccess({}, { removedDate: NOW }),
      factory.organizationAccess({ archived: true }),
    ];

    expect(resolveAccess(context({ organizations }), NOW).basis).toBe(ACCESS_BASIS.NONE);
  });

  it('keeps a day pass unused when the member has a subscription', () => {
    const access = resolveAccess(
      context({ subscriptions: [factory.memberSubscription()], dayPasses: [dayPass(3)] }),
      NOW,
    );

    expect(access).toEqual({ basis: ACCESS_BASIS.SUBSCRIPTION });
  });

  it('uses the oldest unused day pass', () => {
    const older = dayPass(10);

    expect(resolveAccess(context({ dayPasses: [dayPass(1), older] }), NOW).dayPassToUse).toBe(
      older,
    );
  });

  it('readmits on a day pass already used today without using another', () => {
    const passes = [dayPass(5, { usedDate: TODAY }), dayPass(1)];

    expect(resolveAccess(context({ dayPasses: passes }), NOW)).toEqual({
      basis: ACCESS_BASIS.DAY_PASS,
    });
  });

  it('treats a pass used on a previous day as spent', () => {
    const passes = [dayPass(5, { usedDate: YESTERDAY })];

    expect(resolveAccess(context({ dayPasses: passes }), NOW).basis).toBe(ACCESS_BASIS.NONE);
  });
});
