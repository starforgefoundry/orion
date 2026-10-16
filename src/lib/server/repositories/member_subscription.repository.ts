import { schema, type MemberSubscription } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { desc, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';

export type UpsertMemberSubscription = Omit<
  MemberSubscription,
  'accessEndedDate' | 'refundedPaymentId' | 'updatedDate'
>;

export class MemberSubscriptionRepository extends BaseRepository {
  async getById(id: string) {
    const [subscription] = await this.db
      .select()
      .from(schema.memberSubscription)
      .where(eq(schema.memberSubscription.id, id))
      .limit(1);
    return subscription;
  }

  async upsert(subscription: UpsertMemberSubscription) {
    const existing = await this.getById(subscription.id);
    const values = { ...subscription, updatedDate: DateTime.now() };

    await this.db
      .insert(schema.memberSubscription)
      .values(values)
      .onConflictDoUpdate({ target: schema.memberSubscription.id, set: values });

    return { created: !existing };
  }

  async listIds() {
    const rows = await this.db
      .select({ id: schema.memberSubscription.id })
      .from(schema.memberSubscription);
    return rows.map((row) => row.id);
  }

  async listByMember(memberId: string) {
    return await this.db
      .select()
      .from(schema.memberSubscription)
      .where(eq(schema.memberSubscription.memberId, memberId))
      .orderBy(desc(schema.memberSubscription.startDate));
  }

  async endAccess(id: string, refundedPaymentId: string) {
    await this.db
      .update(schema.memberSubscription)
      .set({ accessEndedDate: DateTime.now(), refundedPaymentId, updatedDate: DateTime.now() })
      .where(eq(schema.memberSubscription.id, id));
  }
}
