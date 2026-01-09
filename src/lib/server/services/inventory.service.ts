import type {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from '$lib/remotes/dtos/inventory.dto';
import { BaseService } from '$lib/server/services/base.service';

export class InventoryService extends BaseService {
  async getInventoryItems() {
    const items = await this.inventoryRepository.getAll();
    return items;
  }

  async getInventoryItemById(id: string) {
    const item = await this.inventoryRepository.getById(id);
    if (!item) {
      throw new Error('Inventory item not found');
    }
    return item;
  }

  async createInventoryItem(data: CreateInventoryItemDto) {
    const item = await this.inventoryRepository.create(data);
    return item;
  }

  async updateInventoryItem(id: string, updates: Omit<UpdateInventoryItemDto, 'id'>) {
    return await this.inventoryRepository.update(id, updates);
  }

  async deleteInventoryItem(id: string) {
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

  async uploadInventoryImage(id: string, image: File) {
    const imageUrl = await this.inventoryRepository.uploadImage(id, image);
    return { imageUrl };
  }

  async deleteInventoryImage(id: string) {
    await this.inventoryRepository.deleteImage(id);
  }
}

export const inventoryService = new InventoryService();
