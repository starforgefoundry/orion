import type { UpsertInventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { InventoryService } from './inventory.service';

describe(InventoryService.name, () => {
  let sut: InventoryService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(InventoryService));
  });

  describe('upsertItem', () => {
    it('should create a new inventory item', async () => {
      const dto: UpsertInventoryItemDto = {
        name: 'New Item',
        vendor: 'New Vendor',
        url: 'https://example.com/new',
        imageUrl: 'https://example.com/new-image.jpg',
        description: 'New Description',
      };
      const created = factory.inventoryItem(dto);
      mocks.inventoryRepository.upsert.mockResolvedValue(created);

      const result = await sut.upsertItem(dto);

      expect(mocks.inventoryRepository.upsert).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });

    it('should update an existing inventory item', async () => {
      const dto: UpsertInventoryItemDto = {
        id: 'existing-item-id',
        name: 'Updated Item',
        vendor: 'Updated Vendor',
        url: 'https://example.com/updated',
        imageUrl: 'https://example.com/updated-image.jpg',
        description: 'Updated Description',
      };
      const updated = factory.inventoryItem({ ...dto, id: 'existing-item-id' });
      mocks.inventoryRepository.upsert.mockResolvedValue(updated);

      const result = await sut.upsertItem(dto);

      expect(mocks.inventoryRepository.upsert).toHaveBeenCalledWith(dto);
      expect(result).toEqual(updated);
    });

    it('should handle item without image URL', async () => {
      const dto: UpsertInventoryItemDto = {
        name: 'Item Without Image',
        vendor: 'Vendor',
        url: 'https://example.com/item',
        imageUrl: '',
        description: 'Description',
      };
      const created = factory.inventoryItem({ ...dto, imageUrl: null });
      mocks.inventoryRepository.upsert.mockResolvedValue(created);

      const result = await sut.upsertItem(dto);

      expect(mocks.inventoryRepository.upsert).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });
  });

  describe('getPurchaseList', () => {
    it('should return all purchase list items with formatted dates', async () => {
      const first = factory.inventoryItem();
      const second = factory.inventoryItem({ imageUrl: null });
      const entries = [
        {
          ...factory.purchaseList({
            inventoryItemId: first.id,
            addedDate: DateTime.fromISO('2024-01-15T10:00:00.000Z'),
          }),
          inventoryItem: first,
        },
        {
          ...factory.purchaseList({
            inventoryItemId: second.id,
            addedDate: DateTime.fromISO('2024-01-16T12:30:00.000Z'),
          }),
          inventoryItem: second,
        },
      ];
      mocks.inventoryRepository.getAllPurchaseList.mockResolvedValue(entries);

      const result = await sut.getPurchaseList();

      expect(mocks.inventoryRepository.getAllPurchaseList).toHaveBeenCalled();
      expect(result).toEqual(
        entries.map((entry) => ({
          id: entry.id,
          inventoryItemId: entry.inventoryItemId,
          addedDate: entry.addedDate.toISO(),
          inventoryItem: entry.inventoryItem,
        })),
      );
    });

    it('should return empty array when purchase list is empty', async () => {
      mocks.inventoryRepository.getAllPurchaseList.mockResolvedValue([]);

      const result = await sut.getPurchaseList();

      expect(mocks.inventoryRepository.getAllPurchaseList).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('addToPurchaseList', () => {
    it('should add an item to the purchase list', async () => {
      const entry = factory.purchaseList();
      mocks.inventoryRepository.addToPurchaseList.mockResolvedValue(entry);

      const result = await sut.addToPurchaseList(entry.inventoryItemId);

      expect(mocks.inventoryRepository.addToPurchaseList).toHaveBeenCalledWith(
        entry.inventoryItemId,
      );
      expect(result).toEqual(entry);
    });

    it('should throw error when inventory item not found', async () => {
      mocks.inventoryRepository.addToPurchaseList.mockRejectedValue(
        new Error('Inventory item not found'),
      );

      await expect(sut.addToPurchaseList('non-existent')).rejects.toThrow(
        'Inventory item not found',
      );
    });
  });
});
