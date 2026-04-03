import type { SettingsMap } from '$lib/server/repositories/settings.repository';
import { BaseService } from '$lib/server/services/base.service';

export class SettingsService extends BaseService {
  async getPrintRequestSettings() {
    return await this.settingsRepository.getSetting('printRequest');
  }

  async setPrintRequestSettings(value: SettingsMap['printRequest']) {
    const setting = await this.settingsRepository.setSetting('printRequest', value);

    return setting;
  }

  async getPrintRequestSquareSettings() {
    return await this.settingsRepository.getSetting('printRequestSquare');
  }

  async setPrintRequestSquareSettings(value: SettingsMap['printRequestSquare']) {
    const setting = await this.settingsRepository.setSetting('printRequestSquare', value);

    return setting;
  }

  async getClassSettings() {
    return await this.settingsRepository.getSetting('classSettings');
  }

  async setClassSettings(value: SettingsMap['classSettings']) {
    const setting = await this.settingsRepository.setSetting('classSettings', value);

    return setting;
  }
}

export const settingsService = new SettingsService();
