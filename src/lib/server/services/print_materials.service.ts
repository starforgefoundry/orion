import type {
  CreatePrintMaterialDto,
  UpdatePrintMaterialDto,
} from '$lib/remotes/dtos/print_materials.dto';
import type { PrintMaterial } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';

export class PrintMaterialsService extends BaseService {
  async getMaterials(available?: boolean) {
    return await this.printMaterialsRepository.get(available);
  }

  async createMaterial(data: CreatePrintMaterialDto) {
    return await this.printMaterialsRepository.create(data);
  }

  async updateMaterial(id: string, updates: Omit<UpdatePrintMaterialDto, 'id'>) {
    const material = await this.printMaterialsRepository.update(id, updates);
    return material;
  }

  async updateAMS(printerId: string, updates: { filaments: string[] }) {
    const settings = await this.settingsRepository.getSetting('printRequest');

    const bblAuth = settings.bblAuthorizationToken;
    const bblUserId = settings.bblUserId;

    if (!bblAuth || !bblUserId) {
      throw new Error('BBL authorization token or user ID not set in settings');
    }

    const printers: Printer[] = await Promise.all([
      this.bblRepository.getCloudPrinters(bblAuth),
      this.bblRepository.getLocalPrinters(),
    ]).then((results) => results.flat());

    const printerPostfix = printerId.split('SF-')[1];
    let printer = printers.find((p) => {
      return p.name.replace(/ /g, '').includes(printerPostfix);
    });

    if (!printer) {
      throw new Error(`Printer with ID ${printerId} not found in BBL devices`);
    }

    const filaments = await this.getMaterials();
    const bblFilaments = updates.filaments.map((f) => filaments.find((mat) => mat.bblTagId === f));

    if (bblFilaments.includes(undefined)) {
      throw new Error('One or more filaments not found or missing BBL tag data');
    }

    if (printer.type === 'cloud') {
      await this.bblRepository.updateAMSCloud(
        printer as CloudPrinter,
        bblFilaments as PrintMaterial[],
        {
          userId: bblUserId,
          authKey: bblAuth,
        },
      );
    } else {
      await this.bblRepository.updateAMSLocal(
        printer as LocalPrinter,
        bblFilaments as PrintMaterial[],
      );
      // For local printers, we would need to implement a different method to update the AMS settings,
      // as they likely don't support the same cloud API. This is a placeholder for that logic.
      throw new Error('Updating AMS settings for local printers is not implemented');
    }
  }
}

export const printMaterialsService = new PrintMaterialsService();
