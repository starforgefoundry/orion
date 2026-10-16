import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { DateTime } from 'luxon';

export class OrganizationMemberRepository extends BaseRepository {
  /** Returns undefined when the member already belongs to the organization. */
  async add(organizationId: string, memberId: string) {
    const [existing] = await this.db
      .select()
      .from(schema.organizationMember)
      .where(
        and(
          eq(schema.organizationMember.organizationId, organizationId),
          eq(schema.organizationMember.memberId, memberId),
          isNull(schema.organizationMember.removedDate),
        ),
      )
      .limit(1);
    if (existing) return undefined;

    const [membership] = await this.db
      .insert(schema.organizationMember)
      .values({ organizationId, memberId })
      .returning();
    return membership;
  }

  async removeMany(organizationId: string, ids: string[]) {
    await this.db
      .update(schema.organizationMember)
      .set({ removedDate: DateTime.now() })
      .where(
        and(
          eq(schema.organizationMember.organizationId, organizationId),
          inArray(schema.organizationMember.id, ids),
          isNull(schema.organizationMember.removedDate),
        ),
      );
  }

  async listByOrganization(organizationId: string) {
    return await this.db
      .select({ membership: schema.organizationMember, member: schema.member })
      .from(schema.organizationMember)
      .innerJoin(schema.member, eq(schema.member.id, schema.organizationMember.memberId))
      .where(
        and(
          eq(schema.organizationMember.organizationId, organizationId),
          isNull(schema.organizationMember.removedDate),
        ),
      )
      .orderBy(asc(schema.member.name));
  }
}
