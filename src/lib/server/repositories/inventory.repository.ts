import type { UpsertInventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { fileUrl, saveFile } from '$lib/server/utils/storage';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';

export class InventoryRepository extends BaseRepository {
  async getAll() {
    const items = await this.db.select().from(schema.inventoryItem);
    return items.map((item) => ({ ...item, imageUrl: fileUrl(item.imageUrl) }));
  }

  async getById(id: string) {
    const [item] = await this.db
      .select()
      .from(schema.inventoryItem)
      .where(eq(schema.inventoryItem.id, id));
    return item && { ...item, imageUrl: fileUrl(item.imageUrl) };
  }

  async upsert(dto: UpsertInventoryItemDto) {
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
      throw new Error('Inventory item not found');
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

  async isPurchaseListed(inventoryItemId: string) {
    const [item] = await this.db
      .select()
      .from(schema.purchaseList)
      .where(eq(schema.purchaseList.inventoryItemId, inventoryItemId));

    return !!item;
  }

  async uploadImage(id: string, image: File) {
    const uploadId = crypto.randomUUID();
    const key = await saveFile(image, `inventory/${id}/${uploadId}`);

    await this.db
      .update(schema.inventoryItem)
      .set({ imageUrl: key })
      .where(eq(schema.inventoryItem.id, id));

    return fileUrl(key);
  }

  async deleteImage(id: string) {
    await this.db
      .update(schema.inventoryItem)
      .set({ imageUrl: null })
      .where(eq(schema.inventoryItem.id, id));
  }
}
