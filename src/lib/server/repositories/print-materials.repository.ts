import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { and, eq, type InferInsertModel } from 'drizzle-orm';

export type NewPrintMaterial = Pick<
  InferInsertModel<typeof schema.printMaterial>,
  'name' | 'available' | 'archived'
>;

export class PrintMaterialsRepository extends BaseRepository {
  async create(dto: NewPrintMaterial) {
    const [material] = await this.db.insert(schema.printMaterial).values(dto).returning();
    return material;
  }

  /** Archived materials are included so a retired spool's tag ID is never handed out twice. */
  async getAll() {
    return await this.db.select().from(schema.printMaterial);
  }

  /** Every material that is not archived. */
  async getActive() {
    return await this.db
      .select()
      .from(schema.printMaterial)
      .where(eq(schema.printMaterial.archived, false));
  }

  /** Materials customers can pick for a new print request. */
  async getAvailable() {
    return await this.db
      .select()
      .from(schema.printMaterial)
      .where(
        and(eq(schema.printMaterial.archived, false), eq(schema.printMaterial.available, true)),
      );
  }

  async update(id: string, updates: Partial<typeof schema.printMaterial.$inferInsert>) {
    const [material] = await this.db
      .update(schema.printMaterial)
      .set(updates)
      .where(eq(schema.printMaterial.id, id))
      .returning();

    return material;
  }
}
