import { TAG_ID_LENGTH } from '$lib/remotes/dtos/print_materials.dto';
import {
  getFilamentCatalog,
  setMaterialSetup,
} from '$lib/remotes/endpoints/print_materials.remote';
import type { PrintMaterial } from '$lib/server/db/schema';
import { toastManager, type SelectItem } from '@immich/ui';

type Color = { name: string; hex: string };

// Select renders the box from the chosen item's own `label`, not from the matching entry in its
// data, so an option without one shows an empty box while still ticking in the list.
function option(value: string): SelectItem {
  return { value, label: value };
}

/** Walks the vendor → material → color chain, clearing whatever a change upstream invalidates. */
export class MaterialEditor {
  tagId = $state('');
  vendor = $state<string | null>(null);
  materialType = $state<string | null>(null);
  colorName = $state<string | null>(null);

  private catalog = getFilamentCatalog();
  private materialId: string;

  constructor(material: PrintMaterial) {
    this.materialId = material.id;
    this.tagId = material.tagId ?? '';
    this.vendor = material.vendor;
    this.materialType = material.materialType;
    this.colorName = material.colorName;
  }

  get loading() {
    return this.catalog.loading;
  }

  get error() {
    return this.catalog.error;
  }

  get tagValid() {
    return this.tagId.trim().length === 0 || this.tagId.trim().length === TAG_ID_LENGTH;
  }

  /** A half-filled filament cannot be saved, but leaving all of it blank is fine. */
  get filamentValid() {
    const chosen = [this.vendor, this.materialType, this.colorName].filter(Boolean);

    return chosen.length === 0 || chosen.length === 3;
  }

  get canSave() {
    return this.tagValid && this.filamentValid;
  }

  get vendorOptions(): SelectItem[] {
    return (this.catalog.current ?? []).map((entry) => option(entry.vendor));
  }

  get materialOptions(): SelectItem[] {
    return (this.currentVendor?.materials ?? []).map((entry) => option(entry.material));
  }

  get colorOptions(): SelectItem[] {
    return this.colors.map((color) => option(color.name));
  }

  get selectedVendor() {
    return this.vendorOptions.find((item) => item.value === this.vendor);
  }

  get selectedMaterial() {
    return this.materialOptions.find((item) => item.value === this.materialType);
  }

  get selectedColor() {
    return this.colorOptions.find((item) => item.value === this.colorName);
  }

  get colorHex() {
    return this.colors.find((color) => color.name === this.colorName)?.hex ?? null;
  }

  selectVendor(vendor: string) {
    this.vendor = vendor;
    this.materialType = null;
    this.colorName = null;
  }

  selectMaterial(materialType: string) {
    this.materialType = materialType;
    this.colorName = null;
  }

  selectColor(colorName: string) {
    this.colorName = colorName;
  }

  async save() {
    if (!this.canSave) return false;

    const colorHex = this.colorHex;

    try {
      await setMaterialSetup({
        id: this.materialId,
        tagId: this.tagId.trim() || null,
        filament:
          this.vendor && this.materialType && this.colorName && colorHex
            ? {
                vendor: this.vendor,
                materialType: this.materialType,
                colorName: this.colorName,
                colorHex,
              }
            : null,
      });

      toastManager.success('Material saved');
      return true;
    } catch (error) {
      toastManager.danger(error instanceof Error ? error.message : 'Failed to save the material');
      return false;
    }
  }

  private get currentVendor() {
    return (this.catalog.current ?? []).find((entry) => entry.vendor === this.vendor);
  }

  get colors(): Color[] {
    return (
      this.currentVendor?.materials.find((entry) => entry.material === this.materialType)?.colors ??
      []
    );
  }
}
