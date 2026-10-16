import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { MEMBER_STATUS, type MemberSearchFilter } from '$lib/remotes/dtos/member.dto';
import { SUBSCRIPTION_STATUS } from '$lib/member_enums';
import { type MemberAccessContext } from '$lib/server/utils/member_access';
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
  isNull,
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

  async getByEmail(email: string) {
    const [member] = await this.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.email, normalizeEmail(email)))
      .limit(1);
    return member;
  }

  async getByPassToken(passToken: string) {
    const [member] = await this.db
      .select()
      .from(schema.member)
      .where(eq(schema.member.passToken, passToken))
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

  /** SQL form of hasMembership; member.repository.spec.ts checks the two agree. */
  private hasMembershipCondition(now: DateTime) {
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
    return or(exists(activeSubscription), exists(activeOrganization))!;
  }

  async search(filter: MemberSearchFilter, now: DateTime) {
    const term = filter.query.trim();
    const conditions: (SQL | undefined)[] = [];
    if (term !== '') {
      conditions.push(
        or(ilike(schema.member.name, `%${term}%`), ilike(schema.member.email, `%${term}%`)),
      );
    }
    if (filter.status === MEMBER_STATUS.ACTIVE) conditions.push(this.hasMembershipCondition(now));
    if (filter.status === MEMBER_STATUS.INACTIVE) {
      conditions.push(not(this.hasMembershipCondition(now)));
    }
    const where = and(...conditions);

    const [[{ total }], data] = await Promise.all([
      this.db.select({ total: count() }).from(schema.member).where(where),
      this.db
        .select()
        .from(schema.member)
        .where(where)
        .orderBy(asc(schema.member.name), asc(schema.member.email))
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
