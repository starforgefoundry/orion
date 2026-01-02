import type {
  CreatePrintMaterialDto,
  UpdatePrintMaterialDto,
} from '$lib/remotes/dtos/print_materials.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { and, eq } from 'drizzle-orm';

export class PrintMaterialsRepository extends BaseRepository {
  async create(dto: CreatePrintMaterialDto) {
    await this.db.insert(schema.printMaterial).values(dto);
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

  async update(id: string, updates: Omit<UpdatePrintMaterialDto, 'id'>) {
    const material = await this.db
      .update(schema.printMaterial)
      .set(updates)
      .where(eq(schema.printMaterial.id, id))
      .returning();

    return material[0];
  }
}
