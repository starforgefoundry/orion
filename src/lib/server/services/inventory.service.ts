import type { UpsertInventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
import { BaseService } from '$lib/server/services/base.service';

export class InventoryService extends BaseService {
  async getItems() {
    const items = await this.inventoryRepository.getAll();
    return items;
  }

  async upsertItem(dto: UpsertInventoryItemDto) {
    const item = await this.inventoryRepository.upsert(dto);
    return item;
  }

  async deleteItem(id: string) {
    await this.inventoryRepository.delete(id);
  }

  async getPurchaseList() {
    const items = await this.inventoryRepository.getAllPurchaseList();
    return items.map((item) => ({
      id: item.id,
      inventoryItemId: item.inventoryItemId,
      addedDate: item.addedDate.toISO(),
      inventoryItem: item.inventoryItem,
    }));
  }

  async addToPurchaseList(inventoryItemId: string) {
    const item = await this.inventoryRepository.addToPurchaseList(inventoryItemId);
    return item;
  }

  async removeFromPurchaseList(inventoryItemId: string) {
    await this.inventoryRepository.removeFromPurchaseList(inventoryItemId);
  }
}

export const inventoryService = new InventoryService();
