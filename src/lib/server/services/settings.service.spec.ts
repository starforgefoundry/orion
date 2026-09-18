import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings.service';

// Mock remote endpoints
vi.mock('$lib/remotes/endpoints/settings.remote', () => ({
  getPrintRequestSettings: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
  getPrintRequestSquareSettings: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('SettingsService', () => {
  let settingsService: SettingsService;
  let mockSettingsRepo: any;
  let mockPrintMaterialsRepo: any;
  let mockBambuddyRepo: any;
  let getPrintRequestSettings: any;
  let getPrintRequestSquareSettings: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockSettingsRepo = {
      getSetting: vi.fn(),
      setSetting: vi.fn(),
    };

    mockPrintMaterialsRepo = {
      get: vi.fn(),
    };

    mockBambuddyRepo = {
      getCurrentUser: vi.fn(),
      listPrinters: vi.fn(),
    };

    settingsService = new SettingsService(
      undefined,
      mockPrintMaterialsRepo,
      undefined,
      undefined,
      mockSettingsRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockBambuddyRepo,
    );

    const settingsRemote = await import('$lib/remotes/endpoints/settings.remote');
    getPrintRequestSettings = settingsRemote.getPrintRequestSettings;
    getPrintRequestSquareSettings = settingsRemote.getPrintRequestSquareSettings;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getPublicPrintRequestForm', () => {
    beforeEach(() => {
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        isOpen: true,
        announcement: 'Delays this week',
        announcementUntil: '2026-09-24T17:00:00.000Z',
        maxUploadMB: 1000,
        allowedFileTypes: '.stl',
        discordWebhookUrl: 'https://discord.com/api/webhooks/secret',
      });
      vi.mocked(mockPrintMaterialsRepo.get).mockResolvedValue([
        { id: 'material-1', name: 'PLA', available: true, archived: false, bblTagId: 'tag-1' },
      ]);
    });

    it('should only expose the fields the public form renders', async () => {
      // Act
      const result = await settingsService.getPublicPrintRequestForm();

      // Assert
      expect(result).toEqual({
        isOpen: true,
        announcement: 'Delays this week',
        announcementUntil: '2026-09-24T17:00:00.000Z',
        maxUploadMB: 1000,
        allowedFileTypes: '.stl',
        materials: [{ id: 'material-1', name: 'PLA' }],
      });
    });

    it('should only list materials marked available', async () => {
      // Act
      await settingsService.getPublicPrintRequestForm();

      // Assert
      expect(mockPrintMaterialsRepo.get).toHaveBeenCalledWith(true);
    });
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
  });

  describe('setPrintRequestSettings', () => {
    const newSettings = {
      isOpen: false,
      announcement: 'Prints are delayed one week.',
      announcementUntil: '2026-09-24T17:00:00.000Z',
      maxUploadMB: 50000,
      allowedFileTypes: '.stl',
      discordWebhookUrl: 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz',
    };

    it('should update print request settings', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({ isOpen: true });
      vi.mocked(mockSettingsRepo.setSetting).mockResolvedValue(newSettings);

      // Act
      const result = await settingsService.setPrintRequestSettings(newSettings);

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith('printRequest', newSettings);
      expect(result).toEqual(newSettings);
    });
  });

  describe('getBambuddySettings', () => {
    it('should report that a key is saved without handing it out', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        serverUrl: 'https://print.example.com',
        apiKey: 'bb_secret',
      });

      // Act
      const result = await settingsService.getBambuddySettings();

      // Assert
      expect(result).toEqual({ serverUrl: 'https://print.example.com', hasApiKey: true });
    });
  });

  describe('setBambuddySettings', () => {
    it('should keep the saved key when the form submits a blank one', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        serverUrl: 'https://old.example.com',
        apiKey: 'bb_saved',
      });

      // Act
      await settingsService.setBambuddySettings({
        serverUrl: 'https://print.example.com',
        apiKey: '',
      });

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith('bambuddy', {
        serverUrl: 'https://print.example.com',
        apiKey: 'bb_saved',
      });
    });

    it('should replace the saved key when the form submits a new one', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        serverUrl: 'https://print.example.com',
        apiKey: 'bb_saved',
      });

      // Act
      await settingsService.setBambuddySettings({
        serverUrl: 'https://print.example.com',
        apiKey: 'bb_new',
      });

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith('bambuddy', {
        serverUrl: 'https://print.example.com',
        apiKey: 'bb_new',
      });
    });
  });

  describe('getBambuddyStatus', () => {
    it('should report not connected when no server is configured', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({ serverUrl: '', apiKey: '' });

      // Act
      const result = await settingsService.getBambuddyStatus();

      // Assert
      expect(result.connected).toBe(false);
      expect(mockBambuddyRepo.getCurrentUser).not.toHaveBeenCalled();
    });

    it('should report the signed in user and printer count', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        serverUrl: 'https://print.example.com',
        apiKey: 'bb_secret',
      });
      vi.mocked(mockBambuddyRepo.getCurrentUser).mockResolvedValue({
        username: 'starforge',
        email: null,
      });
      vi.mocked(mockBambuddyRepo.listPrinters).mockResolvedValue([{ id: 3 }, { id: 4 }]);

      // Act
      const result = await settingsService.getBambuddyStatus();

      // Assert
      expect(result).toEqual({ connected: true, username: 'starforge', printerCount: 2 });
    });

    it('should surface why Bambuddy rejected the key', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        serverUrl: 'https://print.example.com',
        apiKey: 'bb_stale',
      });
      vi.mocked(mockBambuddyRepo.getCurrentUser).mockRejectedValue(new Error('Invalid API key'));
      vi.mocked(mockBambuddyRepo.listPrinters).mockRejectedValue(new Error('Invalid API key'));

      // Act
      const result = await settingsService.getBambuddyStatus();

      // Assert
      expect(result).toEqual({ connected: false, reason: 'Invalid API key' });
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
    it('should update square settings', async () => {
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
  });

  describe('setting isolation', () => {
    it('should not mix up printRequest and printRequestSquare settings', async () => {
      // Arrange
      const printRequestSettings = { enabled: true };
      const squareSettings = { locationId: 'loc-isolated' };

      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({});
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

  describe('error handling', () => {
    it('should handle repository errors in getPrintRequestSettings', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(settingsService.getPrintRequestSettings()).rejects.toThrow('Database error');
    });

    it('should handle repository errors in setPrintRequestSettings', async () => {
      // Arrange
      const newSettings = { enabled: true };
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({});
      vi.mocked(mockSettingsRepo.setSetting).mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(settingsService.setPrintRequestSettings(newSettings as any)).rejects.toThrow(
        'Update failed',
      );
    });

    it('should handle repository errors in getPrintRequestSquareSettings', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockRejectedValue(new Error('Connection error'));

      // Act & Assert
      await expect(settingsService.getPrintRequestSquareSettings()).rejects.toThrow(
        'Connection error',
      );
    });

    it('should handle repository errors in setPrintRequestSquareSettings', async () => {
      // Arrange
      const newSettings = { locationId: 'loc-test' };
      vi.mocked(mockSettingsRepo.setSetting).mockRejectedValue(new Error('Save failed'));

      // Act & Assert
      await expect(
        settingsService.setPrintRequestSquareSettings(newSettings as any),
      ).rejects.toThrow('Save failed');
    });
  });
});
