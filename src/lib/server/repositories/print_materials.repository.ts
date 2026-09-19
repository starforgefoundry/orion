import type { CreatePrintMaterialDto } from '$lib/remotes/dtos/print_materials.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { and, eq } from 'drizzle-orm';

export class PrintMaterialsRepository extends BaseRepository {
  async create(dto: CreatePrintMaterialDto) {
    await this.db.insert(schema.printMaterial).values(dto).returning().get();
  }

  /** Archived materials are included so a retired spool's tag ID is never handed out twice. */
  async getAll() {
    return await this.db.select().from(schema.printMaterial);
  }

  async get(available?: boolean) {
    const filters = [eq(schema.printMaterial.archived, false)];
    if (available !== undefined) {
      filters.push(eq(schema.printMaterial.available, available));
    }

    const materials = await this.db
      .select()
      .from(schema.printMaterial)
      .where(and(...filters));

    return materials;
  }

  async update(id: string, updates: Partial<typeof schema.printMaterial.$inferInsert>) {
    const material = await this.db
      .update(schema.printMaterial)
      .set(updates)
      .where(eq(schema.printMaterial.id, id))
      .returning()
      .get();

    return material;
  }
}
