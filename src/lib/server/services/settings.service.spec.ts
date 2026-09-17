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
  let mockBblRepo: any;
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

    mockBblRepo = {
      startLogin: vi.fn(),
      verifyTfaCode: vi.fn(),
      getProfile: vi.fn(),
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
      mockBblRepo,
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
        bblAuthorizationToken: 'secret-token',
        bblUserId: 'secret-user',
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

    it('should never hand out the Bambu credentials', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        isOpen: true,
        bblAuthorizationToken: 'secret-token',
        bblUserId: 'secret-user',
      });

      // Act
      const result = await settingsService.getPrintRequestSettings();

      // Assert
      expect(result).toEqual({ isOpen: true });
    });
  });

  describe('refreshBambuCredentials', () => {
    const credentials = {
      account: 'accounts@example.com',
      password: 'hunter2',
      tfaCode: '123456',
    };

    const existingSettings = {
      isOpen: true,
      maxUploadMB: 1000,
      allowedFileTypes: '.stl',
      discordWebhookUrl: 'https://discord.com/api/webhooks/old',
      bblAuthorizationToken: 'stale-token',
      bblUserId: 'stale-user',
    };

    it('should exchange the authenticator code for a token and save it', async () => {
      // Arrange
      vi.mocked(mockBblRepo.startLogin).mockResolvedValue({
        loginType: 'tfa',
        tfaKey: 'tfa-key-abc',
      });
      vi.mocked(mockBblRepo.verifyTfaCode).mockResolvedValue('fresh-token');
      vi.mocked(mockBblRepo.getProfile).mockResolvedValue({
        uidStr: '2030959428',
        account: 'accounts@example.com',
        name: 'Starforge',
      });
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(existingSettings);

      // Act
      const result = await settingsService.refreshBambuCredentials(credentials);

      // Assert
      expect(mockBblRepo.verifyTfaCode).toHaveBeenCalledWith('tfa-key-abc', '123456');
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith('printRequest', {
        ...existingSettings,
        bblAuthorizationToken: 'fresh-token',
        bblUserId: '2030959428',
      });
      expect(result).toEqual({
        account: 'accounts@example.com',
        name: 'Starforge',
        userId: '2030959428',
      });
    });

    it('should skip two-factor verification when login returns a token directly', async () => {
      // Arrange
      vi.mocked(mockBblRepo.startLogin).mockResolvedValue({ accessToken: 'direct-token' });
      vi.mocked(mockBblRepo.getProfile).mockResolvedValue({
        uidStr: '2030959428',
        account: 'accounts@example.com',
        name: 'Starforge',
      });
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(existingSettings);

      // Act
      await settingsService.refreshBambuCredentials(credentials);

      // Assert
      expect(mockBblRepo.verifyTfaCode).not.toHaveBeenCalled();
      expect(mockBblRepo.getProfile).toHaveBeenCalledWith('direct-token');
    });

    it('should reject accounts that require email verification', async () => {
      // Arrange
      vi.mocked(mockBblRepo.startLogin).mockResolvedValue({ loginType: 'verifyCode' });

      // Act & Assert
      await expect(settingsService.refreshBambuCredentials(credentials)).rejects.toThrow(
        'verifyCode',
      );
      expect(mockSettingsRepo.setSetting).not.toHaveBeenCalled();
    });

    it('should leave saved settings untouched when the code is wrong', async () => {
      // Arrange
      vi.mocked(mockBblRepo.startLogin).mockResolvedValue({
        loginType: 'tfa',
        tfaKey: 'tfa-key-abc',
      });
      vi.mocked(mockBblRepo.verifyTfaCode).mockRejectedValue(new Error('Incorrect code'));

      // Act & Assert
      await expect(settingsService.refreshBambuCredentials(credentials)).rejects.toThrow(
        'Incorrect code',
      );
      expect(mockSettingsRepo.setSetting).not.toHaveBeenCalled();
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
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        bblAuthorizationToken: '',
        bblUserId: '',
      });
      vi.mocked(mockSettingsRepo.setSetting).mockResolvedValue(newSettings);

      // Act
      const result = await settingsService.setPrintRequestSettings(newSettings);

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith('printRequest', {
        ...newSettings,
        bblAuthorizationToken: '',
        bblUserId: '',
      });
      expect(result).toEqual(newSettings);
    });

    it('should keep the stored Bambu credentials the form does not carry', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        bblAuthorizationToken: 'bbl-auth-token',
        bblUserId: 'bbl-user-id',
      });
      vi.mocked(mockSettingsRepo.setSetting).mockResolvedValue({
        ...newSettings,
        bblAuthorizationToken: 'bbl-auth-token',
        bblUserId: 'bbl-user-id',
      });

      // Act
      const result = await settingsService.setPrintRequestSettings(newSettings);

      // Assert
      expect(mockSettingsRepo.setSetting).toHaveBeenCalledWith('printRequest', {
        ...newSettings,
        bblAuthorizationToken: 'bbl-auth-token',
        bblUserId: 'bbl-user-id',
      });
      expect(result).toEqual(newSettings);
    });
  });

  describe('getBambuStatus', () => {
    it('should report not connected when no credentials are stored', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        bblAuthorizationToken: '',
        bblUserId: '',
      });

      // Act
      const result = await settingsService.getBambuStatus();

      // Assert
      expect(result.connected).toBe(false);
      expect(mockBblRepo.getProfile).not.toHaveBeenCalled();
    });

    it('should report the signed in account when the token works', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        bblAuthorizationToken: 'bbl-auth-token',
        bblUserId: 'bbl-user-id',
      });
      vi.mocked(mockBblRepo.getProfile).mockResolvedValue({
        uidStr: 'bbl-user-id',
        account: 'accounts@example.com',
        name: 'Starforge',
      });

      // Act
      const result = await settingsService.getBambuStatus();

      // Assert
      expect(result).toEqual({
        connected: true,
        account: 'accounts@example.com',
        name: 'Starforge',
      });
    });

    it('should report not connected when Bambu rejects the token', async () => {
      // Arrange
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        bblAuthorizationToken: 'stale-token',
        bblUserId: 'bbl-user-id',
      });
      vi.mocked(mockBblRepo.getProfile).mockRejectedValue(new Error('401'));

      // Act
      const result = await settingsService.getBambuStatus();

      // Assert
      expect(result.connected).toBe(false);
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
