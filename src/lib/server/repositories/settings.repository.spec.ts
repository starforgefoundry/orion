import { DEFAULT_CAR_BAY_POLICY } from '$lib/utils/car_bay';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsRepository, type SettingsMap } from './settings.repository';

const WEBHOOK_URL = 'https://discord.test/webhook';

describeWithDatabase(SettingsRepository.name, () => {
  const database = useTestDatabase('settings');
  let repository: SettingsRepository;

  beforeEach(() => {
    repository = new SettingsRepository(database.db);
  });

  describe('getSetting', () => {
    it('returns the defaults for a setting that was never saved', async () => {
      expect(await repository.getSetting('carBayPolicy')).toEqual(DEFAULT_CAR_BAY_POLICY);
    });

    it('fills fields added after the setting was saved from the defaults', async () => {
      const saved = { isOpen: false, discordWebhookUrl: WEBHOOK_URL };
      await repository.setSetting('printRequest', saved as SettingsMap['printRequest']);

      expect(await repository.getSetting('printRequest')).toMatchObject({
        ...saved,
        maxUploadMB: expect.any(Number),
        allowedFileTypes: expect.any(String),
      });
    });
  });

  describe('getStoredSetting', () => {
    it('returns undefined for a setting that was never saved', async () => {
      expect(await repository.getStoredSetting('printPricing')).toBeUndefined();
    });
  });

  describe('setSetting', () => {
    it('replaces the saved value', async () => {
      await repository.setSetting('classSettings', { discordWebhookUrl: 'old' });

      await repository.setSetting('classSettings', { discordWebhookUrl: WEBHOOK_URL });

      expect(await repository.getStoredSetting('classSettings')).toEqual({
        discordWebhookUrl: WEBHOOK_URL,
      });
    });
  });
});
