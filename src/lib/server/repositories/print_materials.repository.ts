import type {
  CreatePrintMaterialDto,
  UpdatePrintMaterialDto,
} from '$lib/api/dtos/print_materials.dto';
import { getDB } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

async function create(dto: CreatePrintMaterialDto) {
  const db = getDB();

  await db.insert(schema.printMaterial).values(dto);
}

async function get(available?: boolean) {
  const db = getDB();

  const filters = [eq(schema.printMaterial.archived, false)];
  if (available !== undefined) {
    filters.push(eq(schema.printMaterial.available, available));
  }

  const materials = await db
    .select()
    .from(schema.printMaterial)
    .where(and(...filters));

  return materials;
}

async function update(id: string, updates: Omit<UpdatePrintMaterialDto, 'id'>) {
  const db = getDB();

  const material = await db
    .update(schema.printMaterial)
    .set(updates)
    .where(eq(schema.printMaterial.id, id))
    .returning();

  return material[0];
}

export const printMaterialsRepository = {
  create,
  get,
  update,
};
