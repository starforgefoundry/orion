import type {
  CreatePrintMaterialDto,
  FilamentVendorDto,
  SetMaterialSetupDto,
  UpdatePrintMaterialDto,
} from '$lib/remotes/dtos/print_materials.dto';
import type { PrintMaterial } from '$lib/server/db/schema';
import type {
  BambuddyColor,
  BambuddyConfig,
  BambuddySlotFilament,
} from '$lib/server/repositories/bambuddy.repository';
import { BaseService } from '$lib/server/services/base.service';
import {
  baseMaterial,
  genericFilamentId,
  nozzleTemps,
  toTrayColor,
} from '$lib/utils/bambu_filament';
import { byChromaticOrder } from '$lib/utils/color_order';

// Bambuddy's colour inventory says "Bambu Lab" where its filament table says "Bambu".
const VENDOR_ALIASES: Record<string, string> = { 'Bambu Lab': 'Bambu' };

function filamentName(vendor: string, material: string) {
  return `${VENDOR_ALIASES[vendor] ?? vendor} ${material}`;
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

  /**
   * Saves the label ID and the linked filament together, because the material edit screen presents
   * them as one form. Either half may be left empty while staff are still setting a spool up.
   */
  async setSetup({ id, tagId, filament }: SetMaterialSetupDto) {
    if (tagId) {
      const clash = (await this.printMaterialsRepository.getAll()).find(
        (material) => material.tagId === tagId && material.id !== id,
      );

      if (clash) throw new Error(`${clash.name} already uses tag ID ${tagId}`);
    }

    return await this.printMaterialsRepository.update(id, {
      tagId,
      ...(await this.resolveFilament(filament)),
    });
  }

  private async resolveFilament(filament: SetMaterialSetupDto['filament']) {
    if (!filament) {
      return {
        filamentId: null,
        vendor: null,
        materialType: null,
        colorName: null,
        colorHex: null,
      };
    }

    const { vendor, materialType, colorName, colorHex } = filament;
    const catalog = await this.getFilamentCatalog();
    const filamentId = catalog
      .find((entry) => entry.vendor === vendor)
      ?.materials.find((entry) => entry.material === materialType)?.filamentId;

    if (!filamentId) throw new Error(`Bambuddy has no ${vendor} ${materialType}`);

    return { filamentId, vendor, materialType, colorName, colorHex };
  }

  /**
   * Bambuddy keeps vendors, materials and colours in one flat colour list and its printable
   * filaments in another. Only combinations that resolve to a filament the printer recognises are
   * offered, because the rest cannot be loaded into a slot.
   */
  async getFilamentCatalog(): Promise<FilamentVendorDto[]> {
    const config = await this.bambuddyConfig();

    const [colors, builtin] = await Promise.all([
      this.bambuddyRepository.listColors(config),
      this.bambuddyRepository.listBuiltinFilaments(config),
    ]);

    const builtinIds = new Map(builtin.map((filament) => [filament.name, filament.filament_id]));
    const vendors = new Map<string, Map<string, { filamentId: string; colors: BambuddyColor[] }>>();

    for (const color of colors) {
      const base = baseMaterial(color.material);
      const filamentId =
        builtinIds.get(filamentName(color.manufacturer, color.material)) ??
        (base ? genericFilamentId(base) : '');

      if (!filamentId) continue;

      const materials = vendors.get(color.manufacturer) ?? new Map();
      vendors.set(color.manufacturer, materials);

      const material = materials.get(color.material) ?? { filamentId, colors: [] };
      materials.set(color.material, material);
      material.colors.push(color);
    }

    return [...vendors]
      .map(([vendor, materials]) => ({
        vendor,
        materials: [...materials]
          .map(([material, { filamentId, colors: entries }]) => ({
            material,
            filamentId,
            colors: entries
              .map((entry) => ({ name: entry.color_name, hex: entry.hex_color }))
              .toSorted(byChromaticOrder),
          }))
          .toSorted((a, b) => a.material.localeCompare(b.material)),
      }))
      .toSorted((a, b) => a.vendor.localeCompare(b.vendor));
  }

  async updateAMS(printerId: string, updates: { filaments: string[] }) {
    const config = await this.bambuddyConfig();

    const printers = await this.bambuddyRepository.listPrinters(config);
    const printerPostfix = printerId.split('SF-')[1];
    const printer = printers.find((p) => p.name.replace(/ /g, '').includes(printerPostfix));

    if (!printer) {
      throw new Error(`Printer with ID ${printerId} not found on the Bambuddy server`);
    }

    const materials = await this.getMaterials();
    const scanned = updates.filaments.map((tagId) =>
      materials.find((material) => material.tagId === tagId),
    );

    if (scanned.includes(undefined)) {
      throw new Error('One or more scanned tags do not match a print material');
    }

    const unlinked = (scanned as PrintMaterial[]).filter((material) => !material.filamentId);

    if (unlinked.length > 0) {
      throw new Error(`No filament is linked to ${unlinked.map((m) => m.name).join(', ')}`);
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

  private async bambuddyConfig(): Promise<BambuddyConfig> {
    const config = await this.settingsRepository.getSetting('bambuddy');

    if (!config.serverUrl || !config.apiKey) {
      throw new Error('Bambuddy server URL or API key not set in settings');
    }

    return config;
  }
}

function toSlotFilament(material: PrintMaterial): BambuddySlotFilament {
  const type = baseMaterial(material.materialType ?? '') ?? 'PLA';
  const temps = nozzleTemps(type);

  return {
    tray_info_idx: material.filamentId!,
    tray_type: type,
    tray_sub_brands: filamentName(material.vendor ?? '', material.materialType ?? ''),
    tray_color: toTrayColor(material.colorHex),
    nozzle_temp_min: temps.min,
    nozzle_temp_max: temps.max,
    // The filament id already identifies a stock filament, and a setting id the slicer cannot
    // resolve makes it fall back to the generic filament instead.
    setting_id: '',
  };
}

export const printMaterialsService = new PrintMaterialsService();
