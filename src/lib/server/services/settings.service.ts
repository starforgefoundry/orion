import {
  getPrintRequestSettings,
  getPrintRequestSquareSettings,
} from '$lib/remotes/endpoints/settings.remote';
import type { SettingsMap } from '$lib/server/repositories/settings.repository';
import { BaseService } from '$lib/server/services/base.service';

class SettingsService extends BaseService {
  async getPrintRequestSettings() {
    return await this.settingsRepository.getSetting('printRequest');
  }

  async setPrintRequestSettings(value: SettingsMap['printRequest']) {
    const setting = await this.settingsRepository.setSetting('printRequest', value);
    getPrintRequestSettings().refresh();

    return setting;
  }

  async getPrintRequestSquareSettings() {
    return await this.settingsRepository.getSetting('printRequestSquare');
  }

  async setPrintRequestSquareSettings(value: SettingsMap['printRequestSquare']) {
    const setting = await this.settingsRepository.setSetting('printRequestSquare', value);
    getPrintRequestSquareSettings().refresh();

    return setting;
  }
}

export const settingsService = new SettingsService();
