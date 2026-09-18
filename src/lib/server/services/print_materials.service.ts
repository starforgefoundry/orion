import type {
  CreatePrintMaterialDto,
  UpdatePrintMaterialDto,
} from '$lib/remotes/dtos/print_materials.dto';
import type { BambuddySlotFilament } from '$lib/server/repositories/bambuddy.repository';
import type { PrintMaterial } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';

function toSlotFilament(material: PrintMaterial): BambuddySlotFilament {
  const tag = JSON.parse(material.bblTagData ?? '{}');

  return {
    tray_info_idx: tag.tray_info_idx,
    tray_type: tag.tray_type,
    tray_sub_brands: tag.tray_sub_brands,
    tray_color: tag.tray_color,
    nozzle_temp_min: tag.nozzle_temp_min,
    nozzle_temp_max: tag.nozzle_temp_max,
  };
}

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
    const config = await this.settingsRepository.getSetting('bambuddy');

    if (!config.serverUrl || !config.apiKey) {
      throw new Error('Bambuddy server URL or API key not set in settings');
    }

    const printers = await this.bambuddyRepository.listPrinters(config);
    const printerPostfix = printerId.split('SF-')[1];
    const printer = printers.find((p) => p.name.replace(/ /g, '').includes(printerPostfix));

    if (!printer) {
      throw new Error(`Printer with ID ${printerId} not found on the Bambuddy server`);
    }

    const materials = await this.getMaterials();
    const scanned = updates.filaments.map((tagId) =>
      materials.find((material) => material.bblTagId === tagId),
    );

    if (scanned.includes(undefined)) {
      throw new Error('One or more filaments not found or missing BBL tag data');
    }

    const slots = await this.bambuddyRepository.listAmsSlots(config, printer.id);

    if (slots.length < scanned.length) {
      throw new Error(
        `${printer.name} has ${slots.length} AMS slots but ${scanned.length} filaments were scanned`,
      );
    }

    for (const [index, material] of (scanned as PrintMaterial[]).entries()) {
      await this.bambuddyRepository.configureAmsSlot(
        config,
        printer.id,
        slots[index],
        toSlotFilament(material),
      );
    }
  }
}

export const printMaterialsService = new PrintMaterialsService();
