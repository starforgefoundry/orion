import type { PublicPrintRequestFormDto } from '$lib/remotes/dtos/settings.dto';
import type { SettingsMap } from '$lib/server/repositories/settings.repository';
import { BaseService } from '$lib/server/services/base.service';

type EditablePrintRequestSettings = Omit<
  SettingsMap['printRequest'],
  'bblAuthorizationToken' | 'bblUserId'
>;

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

  async getPrintRequestSettings(): Promise<EditablePrintRequestSettings> {
    const { bblAuthorizationToken, bblUserId, ...settings } =
      await this.settingsRepository.getSetting('printRequest');

    return settings;
  }

  async setPrintRequestSettings(value: EditablePrintRequestSettings) {
    const current = await this.settingsRepository.getSetting('printRequest');
    const { bblAuthorizationToken, bblUserId, ...saved } = await this.settingsRepository.setSetting(
      'printRequest',
      { ...current, ...value },
    );

    return saved;
  }

  async getBambuStatus() {
    const { bblAuthorizationToken, bblUserId } =
      await this.settingsRepository.getSetting('printRequest');

    if (!bblAuthorizationToken || !bblUserId) {
      return { connected: false as const, reason: 'No Bambu Lab account is signed in.' };
    }

    try {
      const profile = await this.bblRepository.getProfile(bblAuthorizationToken);

      return { connected: true as const, account: profile.account, name: profile.name };
    } catch {
      return {
        connected: false as const,
        reason: 'Bambu Lab rejected the saved token. Sign in again to refresh it.',
      };
    }
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
