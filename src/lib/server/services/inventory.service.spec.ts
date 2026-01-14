import type { UpsertInventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let inventoryService: InventoryService;
  let mockInventoryRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInventoryRepo = {
      getAll: vi.fn(),
      getById: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      getAllPurchaseList: vi.fn(),
      addToPurchaseList: vi.fn(),
      removeFromPurchaseList: vi.fn(),
      uploadImage: vi.fn(),
      deleteImage: vi.fn(),
    };

    inventoryService = new InventoryService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockInventoryRepo,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getItems', () => {
    it('should return all inventory items', async () => {
      // Arrange
      const mockItems = [
        {
          id: 'item-1',
          name: 'Test Item 1',
          vendor: 'Vendor A',
          url: 'https://example.com/item1',
          imageUrl: 'https://example.com/image1.jpg',
          description: 'Description 1',
        },
        {
          id: 'item-2',
          name: 'Test Item 2',
          vendor: 'Vendor B',
          url: 'https://example.com/item2',
          imageUrl: null,
          description: 'Description 2',
        },
      ];

      vi.mocked(mockInventoryRepo.getAll).mockResolvedValue(mockItems);

      // Act
      const result = await inventoryService.getItems();

      // Assert
      expect(mockInventoryRepo.getAll).toHaveBeenCalled();
      expect(result).toEqual(mockItems);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no items exist', async () => {
      // Arrange
      vi.mocked(mockInventoryRepo.getAll).mockResolvedValue([]);

      // Act
      const result = await inventoryService.getItems();

      // Assert
      expect(mockInventoryRepo.getAll).toHaveBeenCalled();
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('getItemById', () => {
    it('should return an inventory item by id', async () => {
      // Arrange
      const mockItem = {
        id: 'item-1',
        name: 'Test Item',
        vendor: 'Test Vendor',
        url: 'https://example.com/item',
        imageUrl: 'https://example.com/image.jpg',
        description: 'Test Description',
      };

      vi.mocked(mockInventoryRepo.getById).mockResolvedValue(mockItem);

      // Act
      const result = await inventoryService.getItemById('item-1');

      // Assert
      expect(mockInventoryRepo.getById).toHaveBeenCalledWith('item-1');
      expect(result).toEqual(mockItem);
    });

    it('should throw error when item not found', async () => {
      // Arrange
      vi.mocked(mockInventoryRepo.getById).mockResolvedValue(null);

      // Act & Assert
      await expect(inventoryService.getItemById('non-existent')).rejects.toThrow(
        'Inventory item not found',
      );
      expect(mockInventoryRepo.getById).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('upsertItem', () => {
    it('should create a new inventory item', async () => {
      // Arrange
      const dto: UpsertInventoryItemDto = {
        name: 'New Item',
        vendor: 'New Vendor',
        url: 'https://example.com/new',
        imageUrl: 'https://example.com/new-image.jpg',
        description: 'New Description',
      };

      const mockCreatedItem = {
        id: 'new-item-id',
        ...dto,
      };

      vi.mocked(mockInventoryRepo.upsert).mockResolvedValue(mockCreatedItem);

      // Act
      const result = await inventoryService.upsertItem(dto);

      // Assert
      expect(mockInventoryRepo.upsert).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCreatedItem);
    });

    it('should update an existing inventory item', async () => {
      // Arrange
      const dto: UpsertInventoryItemDto = {
        id: 'existing-item-id',
        name: 'Updated Item',
        vendor: 'Updated Vendor',
        url: 'https://example.com/updated',
        imageUrl: 'https://example.com/updated-image.jpg',
        description: 'Updated Description',
      };

      const mockUpdatedItem = {
        ...dto,
      };

      vi.mocked(mockInventoryRepo.upsert).mockResolvedValue(mockUpdatedItem);

      // Act
      const result = await inventoryService.upsertItem(dto);

      // Assert
      expect(mockInventoryRepo.upsert).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockUpdatedItem);
    });

    it('should handle item without image URL', async () => {
      // Arrange
      const dto: UpsertInventoryItemDto = {
        name: 'Item Without Image',
        vendor: 'Vendor',
        url: 'https://example.com/item',
        imageUrl: '',
        description: 'Description',
      };

      const mockCreatedItem = {
        id: 'item-id',
        name: dto.name,
        vendor: dto.vendor,
        url: dto.url,
        imageUrl: null,
        description: dto.description,
      };

      vi.mocked(mockInventoryRepo.upsert).mockResolvedValue(mockCreatedItem);

      // Act
      const result = await inventoryService.upsertItem(dto);

      // Assert
      expect(mockInventoryRepo.upsert).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCreatedItem);
    });
  });

  describe('deleteItem', () => {
    it('should delete an inventory item', async () => {
      // Arrange
      vi.mocked(mockInventoryRepo.delete).mockResolvedValue(undefined);

      // Act
      await inventoryService.deleteItem('item-to-delete');

      // Assert
      expect(mockInventoryRepo.delete).toHaveBeenCalledWith('item-to-delete');
    });
  });

  describe('getPurchaseList', () => {
    it('should return all purchase list items with formatted dates', async () => {
      // Arrange
      const addedDate1 = DateTime.fromISO('2024-01-15T10:00:00.000Z');
      const addedDate2 = DateTime.fromISO('2024-01-16T12:30:00.000Z');

      const mockPurchaseItems = [
        {
          id: 'purchase-1',
          inventoryItemId: 'item-1',
          addedDate: addedDate1,
          inventoryItem: {
            id: 'item-1',
            name: 'Item 1',
            vendor: 'Vendor 1',
            url: 'https://example.com/item1',
            imageUrl: 'https://example.com/image1.jpg',
            description: 'Description 1',
          },
        },
        {
          id: 'purchase-2',
          inventoryItemId: 'item-2',
          addedDate: addedDate2,
          inventoryItem: {
            id: 'item-2',
            name: 'Item 2',
            vendor: 'Vendor 2',
            url: 'https://example.com/item2',
            imageUrl: null,
            description: 'Description 2',
          },
        },
      ];

      vi.mocked(mockInventoryRepo.getAllPurchaseList).mockResolvedValue(mockPurchaseItems);

      // Act
      const result = await inventoryService.getPurchaseList();

      // Assert
      expect(mockInventoryRepo.getAllPurchaseList).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'purchase-1',
        inventoryItemId: 'item-1',
        addedDate: addedDate1.toISO(),
        inventoryItem: mockPurchaseItems[0].inventoryItem,
      });
      expect(result[1]).toEqual({
        id: 'purchase-2',
        inventoryItemId: 'item-2',
        addedDate: addedDate2.toISO(),
        inventoryItem: mockPurchaseItems[1].inventoryItem,
      });
    });

    it('should return empty array when purchase list is empty', async () => {
      // Arrange
      vi.mocked(mockInventoryRepo.getAllPurchaseList).mockResolvedValue([]);

      // Act
      const result = await inventoryService.getPurchaseList();

      // Assert
      expect(mockInventoryRepo.getAllPurchaseList).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('addToPurchaseList', () => {
    it('should add an item to the purchase list', async () => {
      // Arrange
      const mockPurchaseItem = {
        id: 'purchase-new',
        inventoryItemId: 'item-1',
        addedDate: DateTime.now(),
      };

      vi.mocked(mockInventoryRepo.addToPurchaseList).mockResolvedValue(mockPurchaseItem);

      // Act
      const result = await inventoryService.addToPurchaseList('item-1');

      // Assert
      expect(mockInventoryRepo.addToPurchaseList).toHaveBeenCalledWith('item-1');
      expect(result).toEqual(mockPurchaseItem);
    });

    it('should throw error when inventory item not found', async () => {
      // Arrange
      vi.mocked(mockInventoryRepo.addToPurchaseList).mockRejectedValue(
        new Error('Inventory item not found'),
      );

      // Act & Assert
      await expect(inventoryService.addToPurchaseList('non-existent')).rejects.toThrow(
        'Inventory item not found',
      );
    });
  });

  describe('removeFromPurchaseList', () => {
    it('should remove an item from the purchase list', async () => {
      // Arrange
      vi.mocked(mockInventoryRepo.removeFromPurchaseList).mockResolvedValue(undefined);

      // Act
      await inventoryService.removeFromPurchaseList('item-1');

      // Assert
      expect(mockInventoryRepo.removeFromPurchaseList).toHaveBeenCalledWith('item-1');
    });
  });

  describe('uploadInventoryImage', () => {
    it('should upload an image and return the URL', async () => {
      // Arrange
      const mockImageUrl = 'https://s3.example.com/inventory/item-1/uuid-123.jpg';
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      vi.mocked(mockInventoryRepo.uploadImage).mockResolvedValue(mockImageUrl);

      // Act
      const result = await inventoryService.uploadInventoryImage('item-1', mockFile);

      // Assert
      expect(mockInventoryRepo.uploadImage).toHaveBeenCalledWith('item-1', mockFile);
      expect(result).toEqual({ imageUrl: mockImageUrl });
    });
  });

  describe('deleteInventoryImage', () => {
    it('should delete an inventory image', async () => {
      // Arrange
      vi.mocked(mockInventoryRepo.deleteImage).mockResolvedValue(undefined);

      // Act
      await inventoryService.deleteInventoryImage('item-1');

      // Assert
      expect(mockInventoryRepo.deleteImage).toHaveBeenCalledWith('item-1');
    });
  });
});
