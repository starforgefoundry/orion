import type { Organization, OrganizationMember } from '$lib/server/db/schema';
import type { MemberAccessContext } from '$lib/server/utils/member_access';
import { member, organizationMember } from './member';
import { organization as newOrganization } from './organization';

export function memberAccessContext(
  overrides: Partial<MemberAccessContext> = {},
): MemberAccessContext {
  return {
    member: member(),
    hasWaiver: true,
    subscriptions: [],
    organizations: [],
    dayPasses: [],
    ...overrides,
  };
}

export function organizationAccess(
  organization: Partial<Organization> = {},
  membership: Partial<OrganizationMember> = {},
): MemberAccessContext['organizations'][number] {
  const row = newOrganization(organization);
  return {
    organization: row,
    membership: organizationMember({ organizationId: row.id, ...membership }),
  };
}
