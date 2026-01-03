import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings.service';
import { createServiceWithMocks, getRemoteMocks } from './test-utils';

describe('SettingsService', () => {
  let settingsService: SettingsService;
  let mockSettingsRepo: any;
  let getPrintRequestSettings: any;
  let getPrintRequestSquareSettings: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { service, mocks } = createServiceWithMocks(SettingsService);
    settingsService = service;
    mockSettingsRepo = mocks.settingsRepository;

    const remoteMocks = await getRemoteMocks();
    getPrintRequestSettings = remoteMocks.getPrintRequestSettings;
    getPrintRequestSquareSettings = remoteMocks.getPrintRequestSquareSettings;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPrintRequestSettings', () => {
    it('should return print request settings', async () => {
      // Arrange
      const mockSettings = {
        enabled: true,
        maxFileSize: 100000000,
        allowedFileTypes: ['.stl', '.obj', '.3mf'],
      };

      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSettings);

      // Act
      const result = await settingsService.getPrintRequestSettings();

      // Assert
      expect(mockSettingsRepo.getSetting).toHaveBeenCalledWith('printRequest');
      expect(result).toEqual(mockSettings);
    });

    it('should handle null settings', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(null);

      // Act
      const result = await settingsService.getPrintRequestSettings();

      // Assert
      expect(mockSettingsRepo.getSetting).toHaveBeenCalledWith('printRequest');
      expect(result).toBeNull();
    });
  });

  describe('setPrintRequestSettings', () => {
    it('should update print request settings and refresh', async () => {
      // Arrange
      const newSettings = {
        enabled: false,
        maxFileSize: 50000000,
        allowedFileTypes: ['.stl'],
      };

      const mockUpdatedSettings = {
        ...newSettings,
        id: 'setting-123',
      };

      const mockRefresh = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getPrintRequestSettings).mockReturnValue({ refresh: mockRefresh } as any);
      vi.mocked(mockSettingsRepo.setSetting).mockResolvedValue(mockUpdatedSettings);

      // Act
      const result = await settingsService.setPrintRequestSettings(newSettings);

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith('printRequest', newSettings);
      expect(mockRefresh).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedSettings);
    });

    it('should handle settings with all fields', async () => {
      // Arrange
      const newSettings = {
        enabled: true,
        maxFileSize: 200000000,
        allowedFileTypes: ['.stl', '.obj', '.3mf', '.step'],
        requireApproval: true,
      };

      const mockUpdatedSettings = {
        ...newSettings,
        id: 'setting-456',
      };

      vi.mocked(mockSettingsRepo.setSetting).mockResolvedValue(mockUpdatedSettings);

      // Act
      const result = await settingsService.setPrintRequestSettings(newSettings);

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith('printRequest', newSettings);
      expect(result).toEqual(mockUpdatedSettings);
    });

    it('should handle partial updates', async () => {
      // Arrange
      const partialSettings = {
        enabled: true,
      };

      const mockUpdatedSettings = {
        ...partialSettings,
        id: 'setting-789',
      };

      vi.mocked(mockSettingsRepo.setSetting).mockResolvedValue(mockUpdatedSettings);

      // Act
      const result = await settingsService.setPrintRequestSettings(partialSettings as any);

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith('printRequest', partialSettings);
      expect(result).toEqual(mockUpdatedSettings);
    });
  });

  describe('getPrintRequestSquareSettings', () => {
    it('should return print request square settings', async () => {
      // Arrange
      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-456',
        additionalBuildPlateItemId: 'item-789',
        memberPrintDiscountId: 'discount-999',
      };

      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);

      // Act
      const result = await settingsService.getPrintRequestSquareSettings();

      // Assert
      expect(mockSettingsRepo.getSetting).toHaveBeenCalledWith('printRequestSquare');
      expect(result).toEqual(mockSquareSettings);
    });

    it('should handle null square settings', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(null);

      // Act
      const result = await settingsService.getPrintRequestSquareSettings();

      // Assert
      expect(mockSettingsRepo.getSetting).toHaveBeenCalledWith('printRequestSquare');
      expect(result).toBeNull();
    });

    it('should return different settings than printRequest', async () => {
      // Arrange
      const mockPrintRequestSettings = { enabled: true };
      const mockSquareSettings = { locationId: 'loc-123' };

      vi.mocked(mockSettingsRepo.getSetting)
        .mockResolvedValueOnce(mockPrintRequestSettings)
        .mockResolvedValueOnce(mockSquareSettings);

      // Act
      const printRequestResult = await settingsService.getPrintRequestSettings();
      const squareResult = await settingsService.getPrintRequestSquareSettings();

      // Assert
      expect(mockSettingsRepo.getSetting).toHaveBeenNthCalledWith(1, 'printRequest');
      expect(mockSettingsRepo.getSetting).toHaveBeenNthCalledWith(2, 'printRequestSquare');
      expect(printRequestResult).toEqual(mockPrintRequestSettings);
      expect(squareResult).toEqual(mockSquareSettings);
    });
  });

  describe('setPrintRequestSquareSettings', () => {
    it('should update square settings and refresh', async () => {
      // Arrange
      const newSquareSettings = {
        locationId: 'loc-new',
        printRequestItemId: 'item-new',
        additionalBuildPlateItemId: 'item-plate-new',
        memberPrintDiscountId: 'discount-new',
      };

      const mockUpdatedSettings = {
        ...newSquareSettings,
        id: 'square-setting-123',
      };

      const mockRefresh = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getPrintRequestSquareSettings).mockReturnValue({ refresh: mockRefresh } as any);
      vi.mocked(mockSettingsRepo.setSetting).mockResolvedValue(mockUpdatedSettings);

      // Act
      const result = await settingsService.setPrintRequestSquareSettings(newSquareSettings);

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith(
        'printRequestSquare',
        newSquareSettings,
      );
      expect(mockRefresh).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedSettings);
    });

    it('should handle square settings with all required fields', async () => {
      // Arrange
      const newSquareSettings = {
        locationId: 'loc-999',
        printRequestItemId: 'item-999',
        additionalBuildPlateItemId: 'item-plate-999',
        memberPrintDiscountId: 'discount-999',
      };

      const mockUpdatedSettings = {
        ...newSquareSettings,
        id: 'square-setting-456',
      };

      vi.mocked(mockSettingsRepo.setSetting).mockResolvedValue(mockUpdatedSettings);

      // Act
      const result = await settingsService.setPrintRequestSquareSettings(newSquareSettings);

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith(
        'printRequestSquare',
        newSquareSettings,
      );
      expect(result).toEqual(mockUpdatedSettings);
    });

    it('should not call printRequest refresh when updating square settings', async () => {
      // Arrange
      const newSquareSettings = {
        locationId: 'loc-test',
        printRequestItemId: 'item-test',
        additionalBuildPlateItemId: 'item-plate-test',
        memberPrintDiscountId: 'discount-test',
      };

      const mockUpdatedSettings = {
        ...newSquareSettings,
        id: 'square-setting-789',
      };

      const mockSquareRefresh = vi.fn().mockResolvedValue(undefined);
      const mockPrintRequestRefresh = vi.fn().mockResolvedValue(undefined);

      vi.mocked(getPrintRequestSquareSettings).mockReturnValue({
        refresh: mockSquareRefresh,
      } as any);
      vi.mocked(getPrintRequestSettings).mockReturnValue({
        refresh: mockPrintRequestRefresh,
      } as any);
      vi.mocked(mockSettingsRepo.setSetting).mockResolvedValue(mockUpdatedSettings);

      // Act
      await settingsService.setPrintRequestSquareSettings(newSquareSettings);

      // Assert
      expect(mockSquareRefresh).toHaveBeenCalled();
      expect(mockPrintRequestRefresh).not.toHaveBeenCalled();
    });
  });

  describe('setting isolation', () => {
    it('should not mix up printRequest and printRequestSquare settings', async () => {
      // Arrange
      const printRequestSettings = { enabled: true };
      const squareSettings = { locationId: 'loc-isolated' };

      vi.mocked(mockSettingsRepo.setSetting)
        .mockResolvedValueOnce(printRequestSettings)
        .mockResolvedValueOnce(squareSettings);

      // Act
      await settingsService.setPrintRequestSettings(printRequestSettings as any);
      await settingsService.setPrintRequestSquareSettings(squareSettings as any);

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenNthCalledWith(
        1,
        'printRequest',
        printRequestSettings,
      );
      expect(mockSettingsRepo.setSetting).toHaveBeenNthCalledWith(
        2,
        'printRequestSquare',
        squareSettings,
      );
    });
  });
});
