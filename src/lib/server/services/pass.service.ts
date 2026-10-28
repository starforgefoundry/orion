import type { PassDto } from '$lib/remotes/dtos/onboarding.dto';
import { BaseService } from '$lib/server/services/base.service';
import { appleWalletConfig, buildApplePass } from '$lib/server/utils/apple_wallet';
import { googleWalletConfig, googleWalletSaveUrl } from '$lib/server/utils/google_wallet';
import { passUrl } from '$lib/server/utils/member_links';
import { passDetails } from '$lib/server/utils/pass_details';
import { availableWallets } from '$lib/server/utils/wallet_providers';
import qrcode from 'qrcode-generator';

const QR_TYPE_NUMBER_AUTO = 0;
const QR_ERROR_CORRECTION = 'M';
const QR_CELL_PIXELS = 8;
const QR_MARGIN_PIXELS = 16;

export class PassService extends BaseService {
  async getPass(token: string): Promise<PassDto | undefined> {
    const pass = await this.passRepository.getByToken(token);
    if (!pass) return undefined;

    const details = passDetails(pass);
    return {
      kind: details.kind,
      title: details.title,
      holderName: details.holderName,
      passUrl: passUrl(details),
      fields: details.fields.map(({ label, value }) => ({ label, value })),
      wallets: availableWallets(),
    };
  }

  async getApplePass(token: string): Promise<Buffer | undefined> {
    const config = appleWalletConfig();
    if (!config) return undefined;

    const pass = await this.passRepository.getByToken(token);
    if (!pass) return undefined;

    return buildApplePass(passDetails(pass), config);
  }

  async getGoogleWalletUrl(token: string): Promise<string | undefined> {
    const config = googleWalletConfig();
    if (!config) return undefined;

    const pass = await this.passRepository.getByToken(token);
    if (!pass) return undefined;

    return googleWalletSaveUrl(passDetails(pass), config);
  }

  /** Only real passes get an image, so the endpoint can't be used as a general QR generator. */
  async getQrImage(token: string): Promise<{ contentType: string; body: Buffer } | undefined> {
    const pass = await this.passRepository.getByToken(token);
    if (!pass) return undefined;

    const qr = qrcode(QR_TYPE_NUMBER_AUTO, QR_ERROR_CORRECTION);
    qr.addData(passUrl(pass));
    qr.make();

    const dataUrl = qr.createDataURL(QR_CELL_PIXELS, QR_MARGIN_PIXELS);
    const [header, base64] = dataUrl.split(',');
    return {
      contentType: header.slice('data:'.length, header.indexOf(';')),
      body: Buffer.from(base64, 'base64'),
    };
  }
}

export const passService = new PassService();
