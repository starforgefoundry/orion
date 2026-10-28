import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import {
  MEMBER_SORT,
  ONBOARDING_FILTER,
  SORT_DIRECTION,
  WAIVER_FILTER,
  type MemberSearchFilter,
  type OnboardingFilter,
  type WaiverFilter,
} from '$lib/remotes/dtos/member.dto';
import {
  ACCESS_BASIS,
  MEMBER_EMAIL_TYPE,
  SUBSCRIPTION_STATUS,
  type AccessBasis,
} from '$lib/member_enums';
import { spaceDate, type MemberAccessContext } from '$lib/server/utils/member_access';
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  max,
  not,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { DateTime } from 'luxon';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export class MemberRepository extends BaseRepository {
  async getById(id: string) {
    const [member] = await this.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.id, id))
      .limit(1);
    return member;
  }

  async getByIds(ids: string[]) {
    return await this.db.select().from(schema.member).where(inArray(schema.member.id, ids));
  }

  async getByEmail(email: string) {
    const [member] = await this.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.email, normalizeEmail(email)))
      .limit(1);
    return member;
  }

  async getByOnboardingToken(onboardingToken: string) {
    const [member] = await this.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.onboardingToken, onboardingToken))
      .limit(1);
    return member;
  }

  /** An existing member keeps their name; the update only exists so the row is returned. */
  async upsertByEmail(name: string, email: string) {
    const [member] = await this.db
      .insert(schema.member)
      .values({ name, email: normalizeEmail(email) })
      .onConflictDoUpdate({
        target: schema.member.email,
        set: { name: sql`${schema.member.name}` },
      })
      .returning();
    return member;
  }

  async setSquareCustomerId(id: string, squareCustomerId: string) {
    await this.db.update(schema.member).set({ squareCustomerId }).where(eq(schema.member.id, id));
  }

  async getAccessContextByEmail(email: string) {
    const member = await this.getByEmail(email);
    return member ? await this.getAccessContext(member.id) : undefined;
  }

  async getAccessContext(memberId: string): Promise<MemberAccessContext | undefined> {
    const member = await this.getById(memberId);
    if (!member) return undefined;

    const [[waivers], subscriptions, organizations, dayPasses] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(schema.waiver)
        .where(eq(schema.waiver.memberId, memberId)),
      this.db
        .select()
        .from(schema.memberSubscription)
        .where(eq(schema.memberSubscription.memberId, memberId)),
      this.db
        .select({ membership: schema.organizationMember, organization: schema.organization })
        .from(schema.organizationMember)
        .innerJoin(
          schema.organization,
          eq(schema.organization.id, schema.organizationMember.organizationId),
        )
        .where(eq(schema.organizationMember.memberId, memberId)),
      this.db.select().from(schema.dayPass).where(eq(schema.dayPass.memberId, memberId)),
    ]);

    return { member, hasWaiver: waivers.count > 0, subscriptions, organizations, dayPasses };
  }

  /** Same shape as getAccessContext, loaded for many members at once. */
  async getAccessContexts(memberIds: string[]): Promise<Map<string, MemberAccessContext>> {
    const contexts = new Map<string, MemberAccessContext>();
    if (memberIds.length === 0) return contexts;

    const [members, waivers, subscriptions, organizations, dayPasses] = await Promise.all([
      this.db.select().from(schema.member).where(inArray(schema.member.id, memberIds)),
      this.db
        .selectDistinct({ memberId: schema.waiver.memberId })
        .from(schema.waiver)
        .where(inArray(schema.waiver.memberId, memberIds)),
      this.db
        .select()
        .from(schema.memberSubscription)
        .where(inArray(schema.memberSubscription.memberId, memberIds)),
      this.db
        .select({ membership: schema.organizationMember, organization: schema.organization })
        .from(schema.organizationMember)
        .innerJoin(
          schema.organization,
          eq(schema.organization.id, schema.organizationMember.organizationId),
        )
        .where(inArray(schema.organizationMember.memberId, memberIds)),
      this.db.select().from(schema.dayPass).where(inArray(schema.dayPass.memberId, memberIds)),
    ]);

    const signed = new Set(waivers.map((waiver) => waiver.memberId));
    for (const member of members) {
      contexts.set(member.id, {
        member,
        hasWaiver: signed.has(member.id),
        subscriptions: [],
        organizations: [],
        dayPasses: [],
      });
    }
    for (const subscription of subscriptions) {
      contexts.get(subscription.memberId)?.subscriptions.push(subscription);
    }
    for (const row of organizations) {
      contexts.get(row.membership.memberId)?.organizations.push(row);
    }
    for (const pass of dayPasses) {
      contexts.get(pass.memberId)?.dayPasses.push(pass);
    }
    return contexts;
  }

  /** SQL form of resolveAccess; member.repository.spec.ts checks the two agree. */
  private accessBasisConditions(now: DateTime): Record<AccessBasis, SQL> {
    const activeSubscription = this.db
      .select({ id: schema.memberSubscription.id })
      .from(schema.memberSubscription)
      .where(
        and(
          eq(schema.memberSubscription.memberId, schema.member.id),
          eq(schema.memberSubscription.status, SUBSCRIPTION_STATUS.ACTIVE),
          isNull(schema.memberSubscription.accessEndedDate),
        ),
      );
    const activeOrganization = this.db
      .select({ id: schema.organizationMember.id })
      .from(schema.organizationMember)
      .innerJoin(
        schema.organization,
        eq(schema.organization.id, schema.organizationMember.organizationId),
      )
      .where(
        and(
          eq(schema.organizationMember.memberId, schema.member.id),
          isNull(schema.organizationMember.removedDate),
          eq(schema.organization.archived, false),
          eq(schema.organization.grantsAccess, true),
          or(isNull(schema.organization.accessEndDate), gt(schema.organization.accessEndDate, now)),
        ),
      );
    const dayPass = this.db
      .select({ id: schema.dayPass.id })
      .from(schema.dayPass)
      .where(
        and(
          eq(schema.dayPass.memberId, schema.member.id),
          or(isNull(schema.dayPass.usedDate), eq(schema.dayPass.usedDate, spaceDate(now))),
        ),
      );

    const subscription = exists(activeSubscription);
    const organization = exists(activeOrganization);
    const pass = exists(dayPass);
    return {
      [ACCESS_BASIS.SUBSCRIPTION]: subscription,
      [ACCESS_BASIS.ORGANIZATION]: and(not(subscription), organization)!,
      [ACCESS_BASIS.DAY_PASS]: and(not(subscription), not(organization), pass)!,
      [ACCESS_BASIS.NONE]: not(or(subscription, organization, pass)!),
    };
  }

  private waiverConditions(): Record<WaiverFilter, SQL> {
    const signed = exists(
      this.db
        .select({ id: schema.waiver.id })
        .from(schema.waiver)
        .where(eq(schema.waiver.memberId, schema.member.id)),
    );
    return { [WAIVER_FILTER.SIGNED]: signed, [WAIVER_FILTER.MISSING]: not(signed) };
  }

  async search(filter: MemberSearchFilter, now: DateTime) {
    const onboarding = this.db
      .select({
        memberId: schema.memberEmail.memberId,
        lastSentDate: max(schema.memberEmail.sentDate).as('last_sent_date'),
      })
      .from(schema.memberEmail)
      .where(eq(schema.memberEmail.type, MEMBER_EMAIL_TYPE.ONBOARDING))
      .groupBy(schema.memberEmail.memberId)
      .as('onboarding');

    const accessConditions = this.accessBasisConditions(now);
    const waiverConditions = this.waiverConditions();
    const onboardingConditions: Record<OnboardingFilter, SQL> = {
      [ONBOARDING_FILTER.SENT]: isNotNull(onboarding.lastSentDate),
      [ONBOARDING_FILTER.NOT_SENT]: isNull(onboarding.lastSentDate),
    };
    const sortColumns = {
      [MEMBER_SORT.NAME]: schema.member.name,
      [MEMBER_SORT.EMAIL]: schema.member.email,
      [MEMBER_SORT.ONBOARDING_SENT]: onboarding.lastSentDate,
    };

    const term = filter.query.trim();
    const where = and(
      term === ''
        ? undefined
        : or(ilike(schema.member.name, `%${term}%`), ilike(schema.member.email, `%${term}%`)),
      or(...filter.access.map((basis) => accessConditions[basis])),
      or(...filter.waiver.map((waiver) => waiverConditions[waiver])),
      or(...filter.onboarding.map((status) => onboardingConditions[status])),
    );
    const direction = filter.direction === SORT_DIRECTION.DESC ? desc : asc;

    const [[{ total }], data] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(schema.member)
        .leftJoin(onboarding, eq(onboarding.memberId, schema.member.id))
        .where(where),
      this.db
        .select({ member: schema.member, lastOnboardingSentDate: onboarding.lastSentDate })
        .from(schema.member)
        .leftJoin(onboarding, eq(onboarding.memberId, schema.member.id))
        .where(where)
        .orderBy(
          sql`${direction(sortColumns[filter.sort])} nulls last`,
          asc(schema.member.name),
          asc(schema.member.email),
        )
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
    ]);
    return {
      data,
      pagination: {
        total,
        page: filter.page,
        pageSize: filter.pageSize,
        totalPages: Math.ceil(total / filter.pageSize),
      },
    };
  }

  async getLatestWaiver(memberId: string) {
    const [waiver] = await this.db
      .select({ id: schema.waiver.id, signedDate: schema.waiver.signedDate })
      .from(schema.waiver)
      .where(eq(schema.waiver.memberId, memberId))
      .orderBy(desc(schema.waiver.signedDate))
      .limit(1);
    return waiver;
  }
}
