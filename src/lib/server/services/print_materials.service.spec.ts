import type {
  CreatePrintMaterialDto,
  UpdatePrintMaterialDto,
} from '$lib/remotes/dtos/print_materials.dto';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrintMaterialsService } from './print_materials.service';

describe(PrintMaterialsService.name, () => {
  let sut: PrintMaterialsService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PrintMaterialsService));
  });

  describe('getMaterials', () => {
    it('should return all materials when no filter is provided', async () => {
      const materials = [factory.printMaterial(), factory.printMaterial({ name: 'ABS' })];
      mocks.printMaterialsRepository.get.mockResolvedValue(materials);

      const result = await sut.getMaterials();

      expect(mocks.printMaterialsRepository.get).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(materials);
    });

    it('should return only available materials when filter is true', async () => {
      const materials = [factory.printMaterial({ available: true })];
      mocks.printMaterialsRepository.get.mockResolvedValue(materials);

      const result = await sut.getMaterials(true);

      expect(mocks.printMaterialsRepository.get).toHaveBeenCalledWith(true);
      expect(result).toEqual(materials);
    });

    it('should return unavailable materials when filter is false', async () => {
      const materials = [factory.printMaterial({ name: 'Nylon', available: false })];
      mocks.printMaterialsRepository.get.mockResolvedValue(materials);

      const result = await sut.getMaterials(false);

      expect(mocks.printMaterialsRepository.get).toHaveBeenCalledWith(false);
      expect(result).toEqual(materials);
    });

    it('should return empty array when no materials exist', async () => {
      mocks.printMaterialsRepository.get.mockResolvedValue([]);

      const result = await sut.getMaterials();

      expect(result).toEqual([]);
    });
  });

  describe('createMaterial', () => {
    it('should create a new material with correct parameters', async () => {
      const dto: CreatePrintMaterialDto = { name: 'PETG', available: true };
      mocks.printMaterialsRepository.create.mockResolvedValue(factory.printMaterial(dto));

      await sut.createMaterial(dto);

      expect(mocks.printMaterialsRepository.create).toHaveBeenCalledWith(dto);
    });

    it('should create unavailable material', async () => {
      const dto: CreatePrintMaterialDto = { name: 'TPU', available: false };
      mocks.printMaterialsRepository.create.mockResolvedValue(factory.printMaterial(dto));

      await sut.createMaterial(dto);

      expect(mocks.printMaterialsRepository.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateMaterial', () => {
    it('should update material and return the updated row', async () => {
      const updates: Omit<UpdatePrintMaterialDto, 'id'> = { name: 'Updated PLA' };
      const updated = factory.printMaterial({ id: 'mat-123', name: 'Updated PLA' });
      mocks.printMaterialsRepository.update.mockResolvedValue(updated);

      const result = await sut.updateMaterial('mat-123', updates);

      expect(mocks.printMaterialsRepository.update).toHaveBeenCalledWith('mat-123', updates);
      expect(result).toEqual(updated);
    });

    it('should update material availability', async () => {
      const updates: Omit<UpdatePrintMaterialDto, 'id'> = { available: false };
      mocks.printMaterialsRepository.update.mockResolvedValue(
        factory.printMaterial({ id: 'mat-456', available: false }),
      );

      const result = await sut.updateMaterial('mat-456', updates);

      expect(mocks.printMaterialsRepository.update).toHaveBeenCalledWith('mat-456', updates);
      expect(result.available).toBe(false);
    });

    it('should handle multiple field updates simultaneously', async () => {
      const updates: Omit<UpdatePrintMaterialDto, 'id'> = {
        name: 'PETG Premium',
        available: true,
      };
      mocks.printMaterialsRepository.update.mockResolvedValue(
        factory.printMaterial({ id: 'mat-789', ...updates }),
      );

      const result = await sut.updateMaterial('mat-789', updates);

      expect(mocks.printMaterialsRepository.update).toHaveBeenCalledWith('mat-789', updates);
      expect(result.name).toBe('PETG Premium');
      expect(result.available).toBe(true);
    });

    it('should throw error when material not found', async () => {
      mocks.printMaterialsRepository.update.mockRejectedValue(new Error('Material not found'));

      await expect(sut.updateMaterial('nonexistent-mat', { name: 'New Name' })).rejects.toThrow(
        'Material not found',
      );
    });
  });

  describe('updateAMS', () => {
    it('should reset slots scanned with the empty slot card', async () => {
      mocks.settingsRepository.getSetting.mockResolvedValue({
        serverUrl: 'http://bambuddy',
        apiKey: 'key',
      });
      mocks.bambuddyRepository.listPrinters.mockResolvedValue([
        { id: 7, name: 'SF 01', model: 'X1C', is_active: true },
      ]);
      mocks.bambuddyRepository.listAmsSlots.mockResolvedValue([
        { amsId: 0, trayId: 0 },
        { amsId: 0, trayId: 1 },
      ]);
      mocks.bambuddyRepository.configureAmsSlot.mockResolvedValue(undefined);
      mocks.bambuddyRepository.resetAmsSlot.mockResolvedValue(undefined);
      mocks.printMaterialsRepository.get.mockResolvedValue([
        factory.printMaterial({ name: 'PLA', tagId: 'A1B2C3D4', filamentId: 'GFA00' }),
      ]);

      await sut.updateAMS('SF-01', { filaments: ['EMPTY---', 'A1B2C3D4'] });

      expect(mocks.bambuddyRepository.resetAmsSlot).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        7,
        { amsId: 0, trayId: 0 },
      );
      expect(mocks.bambuddyRepository.configureAmsSlot).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        7,
        { amsId: 0, trayId: 1 },
        expect.objectContaining({ tray_info_idx: 'GFA00' }),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle repository errors in getMaterials', async () => {
      mocks.printMaterialsRepository.get.mockRejectedValue(new Error('Database error'));

      await expect(sut.getMaterials()).rejects.toThrow('Database error');
    });

    it('should handle repository errors in createMaterial', async () => {
      mocks.printMaterialsRepository.create.mockRejectedValue(
        new Error('Failed to create material'),
      );

      await expect(sut.createMaterial({ name: 'Error Material', available: true })).rejects.toThrow(
        'Failed to create material',
      );
    });
  });
});
