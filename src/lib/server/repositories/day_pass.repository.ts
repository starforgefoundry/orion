import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { desc, eq } from 'drizzle-orm';
import type { DateTime } from 'luxon';

export class DayPassRepository extends BaseRepository {
  async existsForOrder(squareOrderId: string) {
    const [pass] = await this.db
      .select({ id: schema.dayPass.id })
      .from(schema.dayPass)
      .where(eq(schema.dayPass.squareOrderId, squareOrderId))
      .limit(1);
    return pass !== undefined;
  }

  async createForOrder(
    memberId: string,
    squareOrderId: string,
    purchasedDate: DateTime,
    quantity: number,
  ) {
    // Ids derived from the order make a replayed or concurrent webhook a no-op.
    const rows = Array.from({ length: quantity }, (_, index) => ({
      id: `${squareOrderId}:${index}`,
      memberId,
      squareOrderId,
      purchasedDate,
    }));
    return await this.db.insert(schema.dayPass).values(rows).onConflictDoNothing().returning();
  }

  async markUsed(id: string, usedDate: string) {
    await this.db.update(schema.dayPass).set({ usedDate }).where(eq(schema.dayPass.id, id));
  }

  async listByMember(memberId: string) {
    return await this.db
      .select()
      .from(schema.dayPass)
      .where(eq(schema.dayPass.memberId, memberId))
      .orderBy(desc(schema.dayPass.purchasedDate));
  }
}
