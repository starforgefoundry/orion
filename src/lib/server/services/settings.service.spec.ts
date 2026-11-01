import type { SettingsMap } from '$lib/server/repositories/settings.repository';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsService } from './settings.service';

type StoredSetting = Awaited<ReturnType<ServiceMocks['settingsRepository']['getSetting']>>;

function printRequestSettings(
  overrides: Partial<SettingsMap['printRequest']> = {},
): SettingsMap['printRequest'] {
  return {
    isOpen: true,
    announcement: '',
    announcementUntil: '',
    maxUploadMB: 1000,
    allowedFileTypes: '.stl, .3mf',
    discordWebhookUrl: '',
    ...overrides,
  };
}

function squareSettings(
  overrides: Partial<SettingsMap['printRequestSquare']> = {},
): SettingsMap['printRequestSquare'] {
  return {
    locationId: 'loc-123',
    ...overrides,
  };
}

describe(SettingsService.name, () => {
  let sut: SettingsService;
  let mocks: ServiceMocks;

  function stubSetting(value: SettingsMap[keyof SettingsMap]) {
    mocks.settingsRepository.getSetting.mockResolvedValue(value as StoredSetting);
  }

  beforeEach(() => {
    ({ sut, mocks } = newTestService(SettingsService));
  });

  describe('importLegacyPrintPricing', () => {
    const LEGACY = {
      locationId: 'loc-1',
      memberPrintDiscountId: 'discount-1',
      additionalBuildPlateItemId: 'plate-1',
    };

    function storedSettings(values: Partial<Record<keyof SettingsMap, Record<string, unknown>>>) {
      mocks.settingsRepository.getStoredSetting.mockImplementation(async (key) => values[key]);
    }

    it('copies the member discount and build plate price from Square', async () => {
      storedSettings({ printRequestSquare: LEGACY });
      mocks.squareRepository.getCatalogObjects.mockResolvedValue([
        { type: 'DISCOUNT', id: 'discount-1', discountData: { percentage: '15.0' } },
        {
          type: 'ITEM_VARIATION',
          id: 'plate-1',
          itemVariationData: { priceMoney: { amount: 250n } },
        },
      ]);
      mocks.settingsRepository.setSetting.mockImplementation(async (_key, value) => value);

      await sut.importLegacyPrintPricing();

      expect(mocks.squareRepository.getCatalogObjects).toHaveBeenCalledWith([
        'discount-1',
        'plate-1',
      ]);
      expect(mocks.settingsRepository.setSetting).toHaveBeenCalledWith('printPricing', {
        memberDiscountPercent: 15,
        additionalBuildPlatePrice: 250,
      });
    });

    it('does nothing once Orion has its own print pricing', async () => {
      storedSettings({ printPricing: { memberDiscountPercent: 5 }, printRequestSquare: LEGACY });

      await sut.importLegacyPrintPricing();

      expect(mocks.squareRepository.getCatalogObjects).not.toHaveBeenCalled();
      expect(mocks.settingsRepository.setSetting).not.toHaveBeenCalled();
    });

    it('does nothing when Square was never set up for prints', async () => {
      storedSettings({ printRequestSquare: { locationId: 'loc-1' } });

      await sut.importLegacyPrintPricing();

      expect(mocks.squareRepository.getCatalogObjects).not.toHaveBeenCalled();
      expect(mocks.settingsRepository.setSetting).not.toHaveBeenCalled();
    });
  });

  describe('getPublicPrintRequestForm', () => {
    beforeEach(() => {
      stubSetting(
        printRequestSettings({
          announcement: 'Delays this week',
          announcementUntil: '2026-09-24T17:00:00.000Z',
          allowedFileTypes: '.stl',
          discordWebhookUrl: 'https://discord.com/api/webhooks/secret',
        }),
      );
      mocks.printMaterialsRepository.getAvailable.mockResolvedValue([
        factory.printMaterial({ id: 'material-1', name: 'PLA', tagId: 'A1B2C3D4' }),
      ]);
    });

    it('should only expose the fields the public form renders', async () => {
      const result = await sut.getPublicPrintRequestForm();

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
      await sut.getPublicPrintRequestForm();

      expect(mocks.printMaterialsRepository.getAvailable).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('reads the setting stored under the key', async () => {
      const settings = squareSettings();
      stubSetting(settings);

      const result = await sut.get('printRequestSquare');

      expect(mocks.settingsRepository.getSetting).toHaveBeenCalledWith('printRequestSquare');
      expect(result).toEqual(settings);
    });
  });

  describe('set', () => {
    it('saves the setting under the key', async () => {
      const settings = squareSettings({ locationId: 'loc-new' });
      mocks.settingsRepository.setSetting.mockResolvedValue(settings);

      const result = await sut.set('printRequestSquare', settings);

      expect(mocks.settingsRepository.setSetting).toHaveBeenCalledWith(
        'printRequestSquare',
        settings,
      );
      expect(result).toEqual(settings);
    });
  });

  describe('setPrintRequestSettings', () => {
    const newSettings = printRequestSettings({
      isOpen: false,
      announcement: 'Prints are delayed one week.',
      announcementUntil: '2026-09-24T17:00:00.000Z',
      maxUploadMB: 50000,
      allowedFileTypes: '.stl',
      discordWebhookUrl: 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz',
    });

    it('should update print request settings', async () => {
      stubSetting(printRequestSettings());
      mocks.settingsRepository.setSetting.mockResolvedValue(newSettings);

      const result = await sut.setPrintRequestSettings(newSettings);

      expect(mocks.settingsRepository.setSetting).toHaveBeenCalledWith('printRequest', newSettings);
      expect(result).toEqual(newSettings);
    });
  });

  describe('getBambuddySettings', () => {
    it('should report that a key is saved without handing it out', async () => {
      stubSetting({ serverUrl: 'https://print.example.com', apiKey: 'bb_secret' });

      const result = await sut.getBambuddySettings();

      expect(result).toEqual({ serverUrl: 'https://print.example.com', hasApiKey: true });
    });
  });

  describe('setBambuddySettings', () => {
    beforeEach(() => {
      mocks.settingsRepository.setSetting.mockImplementation(async (_key, value) => value);
    });

    it('should keep the saved key when the form submits a blank one', async () => {
      stubSetting({ serverUrl: 'https://old.example.com', apiKey: 'bb_saved' });

      await sut.setBambuddySettings({ serverUrl: 'https://print.example.com', apiKey: '' });

      expect(mocks.settingsRepository.setSetting).toHaveBeenCalledWith('bambuddy', {
        serverUrl: 'https://print.example.com',
        apiKey: 'bb_saved',
      });
    });

    it('should replace the saved key when the form submits a new one', async () => {
      stubSetting({ serverUrl: 'https://print.example.com', apiKey: 'bb_saved' });

      await sut.setBambuddySettings({ serverUrl: 'https://print.example.com', apiKey: 'bb_new' });

      expect(mocks.settingsRepository.setSetting).toHaveBeenCalledWith('bambuddy', {
        serverUrl: 'https://print.example.com',
        apiKey: 'bb_new',
      });
    });
  });

  describe('getBambuddyStatus', () => {
    it('should report not connected when no server is configured', async () => {
      stubSetting({ serverUrl: '', apiKey: '' });

      const result = await sut.getBambuddyStatus();

      expect(result.connected).toBe(false);
      expect(mocks.bambuddyRepository.getCurrentUser).not.toHaveBeenCalled();
    });

    it('should report the signed in user and printer count', async () => {
      stubSetting({ serverUrl: 'https://print.example.com', apiKey: 'bb_secret' });
      mocks.bambuddyRepository.getCurrentUser.mockResolvedValue({
        username: 'starforge',
        email: null,
      });
      mocks.bambuddyRepository.listPrinters.mockResolvedValue([
        { id: 3, name: 'X1C', model: 'X1C', is_active: true },
        { id: 4, name: 'P1S', model: 'P1S', is_active: true },
      ]);

      const result = await sut.getBambuddyStatus();

      expect(result).toEqual({ connected: true, username: 'starforge', printerCount: 2 });
    });

    it('should surface why Bambuddy rejected the key', async () => {
      stubSetting({ serverUrl: 'https://print.example.com', apiKey: 'bb_stale' });
      mocks.bambuddyRepository.getCurrentUser.mockRejectedValue(new Error('Invalid API key'));
      mocks.bambuddyRepository.listPrinters.mockRejectedValue(new Error('Invalid API key'));

      const result = await sut.getBambuddyStatus();

      expect(result).toEqual({ connected: false, reason: 'Invalid API key' });
    });
  });

  describe('error handling', () => {
    it('should handle repository errors in setPrintRequestSettings', async () => {
      stubSetting(printRequestSettings());
      mocks.settingsRepository.setSetting.mockRejectedValue(new Error('Update failed'));

      await expect(sut.setPrintRequestSettings(printRequestSettings())).rejects.toThrow(
        'Update failed',
      );
    });
  });
});
