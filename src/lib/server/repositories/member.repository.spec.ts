import {
  ACCESS_BASIS,
  MEMBER_EMAIL_TRIGGER,
  MEMBER_EMAIL_TYPE,
  MEMBER_SORT,
  ONBOARDING_FILTER,
  SORT_DIRECTION,
  SUBSCRIPTION_STATUS,
  enumValues,
} from '$lib/utils/member-enums';
import type { Organization, OrganizationMember } from '$lib/server/db/schema';
import { resolveAccess } from '$lib/server/utils/member-access';
import { spaceDate } from '$lib/utils/space';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { DateTime } from 'luxon';
import { beforeEach, expect, it } from 'vitest';
import { MemberRepository, type MemberSearchFilter } from './member.repository';

const PAGE_SIZE = 100;

describeWithDatabase('MemberRepository access filter', () => {
  const now = DateTime.now();
  const today = spaceDate(now);
  const yesterday = spaceDate(now.minus({ days: 1 }));

  const database = useTestDatabase('member');
  let repository: MemberRepository;

  async function addOrganization(
    memberId: string,
    organization: Partial<Organization> = {},
    membership: Partial<OrganizationMember> = {},
  ) {
    const { id: organizationId } = await database.insert.organization(organization);
    await database.insert.organizationMember({ organizationId, memberId, ...membership });
  }

  const scenarios: Record<string, (memberId: string) => Promise<unknown>> = {
    nothing: async () => {},
    activeSubscription: (memberId) => database.insert.memberSubscription({ memberId }),
    refundedSubscription: (memberId) =>
      database.insert.memberSubscription({ memberId, accessEndedDate: now }),
    canceledSubscription: (memberId) =>
      database.insert.memberSubscription({ memberId, status: SUBSCRIPTION_STATUS.CANCELED }),
    organization: (memberId) => addOrganization(memberId),
    removedFromOrganization: (memberId) => addOrganization(memberId, {}, { removedDate: now }),
    archivedOrganization: (memberId) => addOrganization(memberId, { archived: true }),
    organizationAccessOff: (memberId) => addOrganization(memberId, { grantsAccess: false }),
    expiredOrganization: (memberId) =>
      addOrganization(memberId, { accessEndDate: now.minus({ hours: 1 }) }),
    futureOrganization: (memberId) =>
      addOrganization(memberId, { accessEndDate: now.plus({ days: 1 }) }),
    unusedDayPass: (memberId) => database.insert.dayPass({ memberId }),
    dayPassUsedToday: (memberId) => database.insert.dayPass({ memberId, usedDate: today }),
    dayPassUsedYesterday: (memberId) => database.insert.dayPass({ memberId, usedDate: yesterday }),
  };

  beforeEach(async () => {
    repository = new MemberRepository(database.db);

    for (const [name, setup] of Object.entries(scenarios)) {
      const member = await database.insert.member({ name, email: `${name}@example.com` });
      await setup(member.id);
    }
  });

  async function search(filter: Partial<MemberSearchFilter> = {}) {
    const { data } = await repository.search(
      {
        query: '',
        access: [],
        waiver: [],
        onboarding: [],
        sort: MEMBER_SORT.NAME,
        direction: SORT_DIRECTION.ASC,
        page: 1,
        pageSize: PAGE_SIZE,
        ...filter,
      },
      now,
    );
    return data;
  }

  async function names(filter: Partial<MemberSearchFilter>) {
    return (await search(filter)).map(({ member }) => member.name).toSorted();
  }

  it('matches resolveAccess for every scenario', async () => {
    const members = (await search()).map(({ member }) => member);
    const contexts = await repository.getAccessContexts(members.map((member) => member.id));

    expect(members).toHaveLength(Object.keys(scenarios).length);
    for (const basis of enumValues(ACCESS_BASIS)) {
      const expected = members
        .filter((member) => resolveAccess(contexts.get(member.id)!, now).basis === basis)
        .map((member) => member.name)
        .toSorted();
      expect(await names({ access: [basis] }), basis).toEqual(expected);
    }
  });

  it('filters and sorts by onboarding email', async () => {
    const [{ member }] = await search({ query: 'nothing' });
    await database.insert.memberEmail({
      memberId: member.id,
      type: MEMBER_EMAIL_TYPE.ONBOARDING,
      trigger: MEMBER_EMAIL_TRIGGER.MANUAL,
    });

    expect(await names({ onboarding: [ONBOARDING_FILTER.SENT] })).toEqual(['nothing']);
    expect(await names({ onboarding: [ONBOARDING_FILTER.NOT_SENT] })).not.toContain('nothing');
    const [first] = await search({
      sort: MEMBER_SORT.ONBOARDING_SENT,
      direction: SORT_DIRECTION.DESC,
    });
    expect(first.member.name).toBe('nothing');
  });

  it('loads the same context in batch as one at a time', async () => {
    const members = (await search()).map(({ member }) => member);
    const contexts = await repository.getAccessContexts(members.map((member) => member.id));

    for (const member of members) {
      const single = await repository.getAccessContext(member.id);
      const batched = contexts.get(member.id)!;
      expect(batched.hasWaiver).toBe(single!.hasWaiver);
      expect(resolveAccess(batched, now)).toEqual(resolveAccess(single!, now));
    }
  });

  it.each([
    ['organization@example.com', true],
    ['nothing@example.com', false],
    ['nobody@example.com', false],
  ])('says whether %s has a membership', async (email, expected) => {
    expect(await repository.hasMembership(email, now)).toBe(expected);
  });

  it('links customer details to the existing member with that email', async () => {
    const existing = await repository.getByEmail('nothing@example.com');

    const columns = await repository.customerColumns({
      customerName: 'Someone Else',
      customerEmail: 'nothing@example.com',
      customerPhone: '555-0100',
    });

    expect(columns).toEqual({
      memberId: existing!.id,
      customerName: 'Someone Else',
      customerEmail: 'nothing@example.com',
      customerPhone: '555-0100',
    });
  });
});
