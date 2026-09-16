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

  async refreshBambuCredentials(credentials: {
    account: string;
    password: string;
    tfaCode: string;
  }) {
    const login = await this.bblRepository.startLogin(credentials.account, credentials.password);

    let token = login.accessToken;

    if (!token) {
      if (login.loginType !== 'tfa' || !login.tfaKey) {
        throw new Error(
          `This account requires "${login.loginType ?? 'unknown'}" verification, which is not supported here.`,
        );
      }

      token = await this.bblRepository.verifyTfaCode(login.tfaKey, credentials.tfaCode);
    }

    const profile = await this.bblRepository.getProfile(token);
    const current = await this.settingsRepository.getSetting('printRequest');

    await this.settingsRepository.setSetting('printRequest', {
      ...current,
      bblAuthorizationToken: token,
      bblUserId: profile.uidStr,
    });

    return { account: profile.account, name: profile.name, userId: profile.uidStr };
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
