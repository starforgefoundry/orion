import { schema } from '$lib/server/db/schema';
import { NotFoundError } from '$lib/errors';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { fileUrl } from '$lib/server/utils/storage';
import { eq, type InferInsertModel } from 'drizzle-orm';
import { DateTime } from 'luxon';

/** An empty id creates a new item. */
export type InventoryItemInput = Omit<InferInsertModel<typeof schema.inventoryItem>, 'id'> & {
  id?: string;
};

export class InventoryRepository extends BaseRepository {
  async getAll() {
    const items = await this.db.select().from(schema.inventoryItem);
    return items.map((item) => ({ ...item, imageUrl: fileUrl(item.imageUrl) }));
  }

  async upsert(dto: InventoryItemInput) {
    const [item] = await this.db
      .insert(schema.inventoryItem)
      .values({
        ...dto,
        id: dto.id != '' ? dto.id : undefined,
      })
      .onConflictDoUpdate({
        target: schema.inventoryItem.id,
        set: {
          name: dto.name,
          vendor: dto.vendor,
          url: dto.url,
          imageUrl: dto.imageUrl,
          description: dto.description,
        },
      })
      .returning();
    return item;
  }

  async delete(id: string) {
    // First delete from purchase list
    await this.db.delete(schema.purchaseList).where(eq(schema.purchaseList.inventoryItemId, id));

    // Then delete the item
    await this.db.delete(schema.inventoryItem).where(eq(schema.inventoryItem.id, id));
  }

  // Purchase list methods
  async getAllPurchaseList() {
    const items = await this.db
      .select({
        id: schema.purchaseList.id,
        inventoryItemId: schema.purchaseList.inventoryItemId,
        addedDate: schema.purchaseList.addedDate,
        inventoryItem: schema.inventoryItem,
      })
      .from(schema.purchaseList)
      .leftJoin(
        schema.inventoryItem,
        eq(schema.purchaseList.inventoryItemId, schema.inventoryItem.id),
      );

    return items.map((item) => ({
      ...item,
      inventoryItem: item.inventoryItem && {
        ...item.inventoryItem,
        imageUrl: fileUrl(item.inventoryItem.imageUrl),
      },
    }));
  }

  async addToPurchaseList(inventoryItemId: string) {
    // check if item exists
    const [inventoryItem] = await this.db
      .select()
      .from(schema.inventoryItem)
      .where(eq(schema.inventoryItem.id, inventoryItemId));

    if (!inventoryItem) {
      throw new NotFoundError('Inventory item not found');
    }

    try {
      const [item] = await this.db
        .insert(schema.purchaseList)
        .values({
          inventoryItemId,
          addedDate: DateTime.now(),
        })
        .onConflictDoUpdate({
          target: schema.purchaseList.inventoryItemId,
          set: {
            addedDate: DateTime.now(),
          },
        })
        .returning();
      return item;
    } catch (e) {
      console.log(e);
      throw new Error('Failed to add item to purchase list');
    }
  }

  async removeFromPurchaseList(inventoryItemId: string) {
    await this.db
      .delete(schema.purchaseList)
      .where(eq(schema.purchaseList.inventoryItemId, inventoryItemId));
  }
}
