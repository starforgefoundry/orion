import type {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from '$lib/remotes/dtos/inventory.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { uploadToS3 } from '$lib/server/utils/s3';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';

export class InventoryRepository extends BaseRepository {
  async create(dto: CreateInventoryItemDto) {
    const item = await this.db.insert(schema.inventoryItem).values(dto).returning().get();
    return item;
  }

  async getAll() {
    const items = await this.db.select().from(schema.inventoryItem).all();
    return items;
  }

  async getById(id: string) {
    const item = await this.db
      .select()
      .from(schema.inventoryItem)
      .where(eq(schema.inventoryItem.id, id))
      .get();
    return item;
  }

  async update(id: string, updates: Omit<UpdateInventoryItemDto, 'id'>) {
    const item = await this.db
      .update(schema.inventoryItem)
      .set(updates)
      .where(eq(schema.inventoryItem.id, id))
      .returning()
      .get();
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
      )
      .all();

    return items;
  }

  async addToPurchaseList(inventoryItemId: string) {
    // Check if already in purchase list
    const existing = await this.db
      .select()
      .from(schema.purchaseList)
      .where(eq(schema.purchaseList.inventoryItemId, inventoryItemId))
      .get();

    if (existing) {
      return existing;
    }

    const item = await this.db
      .insert(schema.purchaseList)
      .values({
        inventoryItemId,
        addedDate: DateTime.now(),
      })
      .returning()
      .get();

    return item;
  }

  async removeFromPurchaseList(inventoryItemId: string) {
    await this.db
      .delete(schema.purchaseList)
      .where(eq(schema.purchaseList.inventoryItemId, inventoryItemId));
  }

  async isPurchaseListed(inventoryItemId: string) {
    const item = await this.db
      .select()
      .from(schema.purchaseList)
      .where(eq(schema.purchaseList.inventoryItemId, inventoryItemId))
      .get();

    return !!item;
  }

  async uploadImage(id: string, image: File) {
    const uploadId = crypto.randomUUID();
    const imageUrl = await uploadToS3(this.s3, image, `inventory/${id}/${uploadId}`);

    await this.db
      .update(schema.inventoryItem)
      .set({ imageUrl })
      .where(eq(schema.inventoryItem.id, id));

    return imageUrl;
  }

  async deleteImage(id: string) {
    await this.db
      .update(schema.inventoryItem)
      .set({ imageUrl: null })
      .where(eq(schema.inventoryItem.id, id));
  }
}
