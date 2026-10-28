import type { PassDto } from '$lib/remotes/dtos/pass.dto';
import { BaseService } from '$lib/server/services/base.service';
import { appleWalletConfig, buildApplePass } from '$lib/server/utils/apple_wallet';
import { decodeDataUrl } from '$lib/server/utils/data_url';
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
  private async findDetails(token: string) {
    const pass = await this.passRepository.getByToken(token);
    return pass && passDetails(pass);
  }

  async getPass(token: string): Promise<PassDto | undefined> {
    const details = await this.findDetails(token);
    if (!details) return undefined;

    const { title, holderName, fields } = details;
    return { title, holderName, fields, passUrl: passUrl(details), wallets: availableWallets() };
  }

  async getApplePass(token: string): Promise<Buffer | undefined> {
    const config = appleWalletConfig();
    if (!config) return undefined;

    const details = await this.findDetails(token);
    return details && buildApplePass(details, config);
  }

  async getGoogleWalletUrl(token: string): Promise<string | undefined> {
    const config = googleWalletConfig();
    if (!config) return undefined;

    const details = await this.findDetails(token);
    return details && googleWalletSaveUrl(details, config);
  }

  /** Only real passes get an image, so the endpoint can't be used as a general QR generator. */
  async getQrImage(token: string): Promise<{ contentType: string; body: Buffer } | undefined> {
    const pass = await this.passRepository.getByToken(token);
    if (!pass) return undefined;

    const qr = qrcode(QR_TYPE_NUMBER_AUTO, QR_ERROR_CORRECTION);
    qr.addData(passUrl(pass));
    qr.make();

    return decodeDataUrl(qr.createDataURL(QR_CELL_PIXELS, QR_MARGIN_PIXELS));
  }
}

export const passService = new PassService();
