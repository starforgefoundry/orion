import { ACCESS_BASIS, SUBSCRIPTION_STATUS, type AccessBasis } from '$lib/member_enums';
import type {
  DayPass,
  Member,
  MemberSubscription,
  Organization,
  OrganizationMember,
} from '$lib/server/db/schema';
import { SPACE_ZONE } from '$lib/space';
import { DateTime } from 'luxon';

export { SPACE_ZONE };
export type { AccessBasis };

export type MemberAccessContext = {
  member: Member;
  hasWaiver: boolean;
  subscriptions: MemberSubscription[];
  organizations: { membership: OrganizationMember; organization: Organization }[];
  dayPasses: DayPass[];
};

export type MemberAccess = {
  basis: AccessBasis;
  /** Set when admitting this member should use up an unused day pass. */
  dayPassToUse?: DayPass;
};

export function spaceDate(now: DateTime) {
  return now.setZone(SPACE_ZONE).toISODate()!;
}

function hasActiveSubscription(subscriptions: MemberSubscription[]) {
  return subscriptions.some(
    (subscription) =>
      subscription.status === SUBSCRIPTION_STATUS.ACTIVE && !subscription.accessEndedDate,
  );
}

function hasActiveOrganization(organizations: MemberAccessContext['organizations'], now: DateTime) {
  return organizations.some(
    ({ membership, organization }) =>
      !membership.removedDate &&
      !organization.archived &&
      organization.grantsAccess &&
      (!organization.accessEndDate || organization.accessEndDate > now),
  );
}

/** Ignores whether the organization currently grants access. */
export function belongsToOrganization(context: MemberAccessContext) {
  return context.organizations.some(
    ({ membership, organization }) => !membership.removedDate && !organization.archived,
  );
}

/** Membership perks (like print discounts) come from a subscription or an organization, never a day pass. */
export function hasMembership(context: MemberAccessContext, now: DateTime) {
  return (
    hasActiveSubscription(context.subscriptions) ||
    hasActiveOrganization(context.organizations, now)
  );
}

export function resolveAccess(context: MemberAccessContext, now: DateTime): MemberAccess {
  if (hasActiveSubscription(context.subscriptions)) return { basis: ACCESS_BASIS.SUBSCRIPTION };
  if (hasActiveOrganization(context.organizations, now)) {
    return { basis: ACCESS_BASIS.ORGANIZATION };
  }

  const today = spaceDate(now);
  if (context.dayPasses.some((pass) => pass.usedDate === today)) {
    return { basis: ACCESS_BASIS.DAY_PASS };
  }

  const unused = context.dayPasses
    .filter((pass) => !pass.usedDate)
    .toSorted((a, b) => a.purchasedDate.toMillis() - b.purchasedDate.toMillis());
  if (unused.length > 0) return { basis: ACCESS_BASIS.DAY_PASS, dayPassToUse: unused[0] };

  return { basis: ACCESS_BASIS.NONE };
}
