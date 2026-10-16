import type { PublicPrintRequestFormDto } from '$lib/remotes/dtos/settings.dto';
import type { SettingsMap } from '$lib/server/repositories/settings.repository';
import { BaseService } from '$lib/server/services/base.service';

export class SettingsService extends BaseService {
  async getPublicPrintRequestForm(): Promise<PublicPrintRequestFormDto> {
    const [settings, materials] = await Promise.all([
      this.settingsRepository.getSetting('printRequest'),
      this.printMaterialsRepository.get(true),
    ]);

    return {
      isOpen: settings.isOpen,
      announcement: settings.announcement,
      announcementUntil: settings.announcementUntil,
      maxUploadMB: settings.maxUploadMB,
      allowedFileTypes: settings.allowedFileTypes,
      materials: materials.map((material) => ({ id: material.id, name: material.name })),
    };
  }

  async getPrintRequestSettings(): Promise<SettingsMap['printRequest']> {
    return await this.settingsRepository.getSetting('printRequest');
  }

  async setPrintRequestSettings(value: SettingsMap['printRequest']) {
    const current = await this.settingsRepository.getSetting('printRequest');

    return await this.settingsRepository.setSetting('printRequest', { ...current, ...value });
  }

  async getBambuddySettings() {
    const { serverUrl, apiKey } = await this.settingsRepository.getSetting('bambuddy');

    return { serverUrl, hasApiKey: apiKey !== '' };
  }

  async setBambuddySettings(value: { serverUrl: string; apiKey: string }) {
    const current = await this.settingsRepository.getSetting('bambuddy');

    await this.settingsRepository.setSetting('bambuddy', {
      serverUrl: value.serverUrl,
      apiKey: value.apiKey === '' ? current.apiKey : value.apiKey,
    });

    return await this.getBambuddySettings();
  }

  async getBambuddyStatus() {
    const config = await this.settingsRepository.getSetting('bambuddy');

    if (!config.serverUrl || !config.apiKey) {
      return { connected: false as const, reason: 'No Bambuddy server is configured.' };
    }

    try {
      const [user, printers] = await Promise.all([
        this.bambuddyRepository.getCurrentUser(config),
        this.bambuddyRepository.listPrinters(config),
      ]);

      return { connected: true as const, username: user.username, printerCount: printers.length };
    } catch (cause) {
      return {
        connected: false as const,
        reason: cause instanceof Error ? cause.message : 'Bambuddy rejected the request.',
      };
    }
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

  async getCarBayRates() {
    return await this.settingsRepository.getSetting('carBayRates');
  }

  async setCarBayRates(value: SettingsMap['carBayRates']) {
    return await this.settingsRepository.setSetting('carBayRates', value);
  }

  async getCarBayPolicy() {
    return await this.settingsRepository.getSetting('carBayPolicy');
  }

  async setCarBayPolicy(value: SettingsMap['carBayPolicy']) {
    return await this.settingsRepository.setSetting('carBayPolicy', value);
  }

  async getMemberSquareSettings() {
    return await this.settingsRepository.getSetting('memberSquare');
  }

  async setMemberSquareSettings(value: SettingsMap['memberSquare']) {
    return await this.settingsRepository.setSetting('memberSquare', value);
  }
}

export const settingsService = new SettingsService();
