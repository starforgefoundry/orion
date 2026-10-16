import { TAG_ID_LENGTH } from '$lib/remotes/dtos/print_materials.dto';
import {
  createPrintMaterial,
  getFilamentCatalog,
  setMaterialSetup,
  updatePrintMaterial,
} from '$lib/remotes/endpoints/print_materials.remote';
import type { PrintMaterial } from '$lib/server/db/schema';
import { toast } from 'svelte-sonner';

type Color = { name: string; hex: string };

/** Creates or edits a material. Walks the vendor → material → color chain, clearing whatever a change upstream invalidates. */
export class MaterialEditor {
  name = $state('');
  available = $state(true);
  tagId = $state('');
  vendor = $state<string | null>(null);
  materialType = $state<string | null>(null);
  colorName = $state<string | null>(null);
  saving = $state(false);

  readonly isNew: boolean;

  private catalog = getFilamentCatalog();
  // Set after the first successful create so a retry after a failed setup step doesn't create a duplicate.
  private materialId = $state<string>();

  constructor(material?: PrintMaterial) {
    this.isNew = !material;
    this.materialId = material?.id;
    this.name = material?.name ?? '';
    this.available = material?.available ?? true;
    this.tagId = material?.tagId ?? '';
    this.vendor = material?.vendor ?? null;
    this.materialType = material?.materialType ?? null;
    this.colorName = material?.colorName ?? null;
  }

  get loading() {
    return this.catalog.loading;
  }

  get error() {
    return this.catalog.error;
  }

  get nameValid() {
    return this.name.trim().length > 0;
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
    return this.nameValid && this.tagValid && this.filamentValid && !this.saving;
  }

  get vendorOptions(): string[] {
    return (this.catalog.current ?? []).map((entry) => entry.vendor);
  }

  get materialOptions(): string[] {
    return (this.currentVendor?.materials ?? []).map((entry) => entry.material);
  }

  get colors(): Color[] {
    return (
      this.currentVendor?.materials.find((entry) => entry.material === this.materialType)?.colors ??
      []
    );
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

  clearFilament() {
    this.vendor = null;
    this.materialType = null;
    this.colorName = null;
  }

  async save() {
    if (!this.canSave) return false;

    this.saving = true;
    try {
      const details = { name: this.name.trim(), available: this.available };

      if (this.materialId) {
        await updatePrintMaterial({ id: this.materialId, ...details });
      } else {
        this.materialId = (await createPrintMaterial(details)).id;
      }

      await setMaterialSetup({
        id: this.materialId,
        tagId: this.tagId.trim() || null,
        filament: this.filament,
      });

      toast.success(this.isNew ? 'Material created' : 'Material saved');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save the material');
      return false;
    } finally {
      this.saving = false;
    }
  }

  private get filament() {
    const colorHex = this.colorHex;
    if (!this.vendor || !this.materialType || !this.colorName || !colorHex) return null;

    return {
      vendor: this.vendor,
      materialType: this.materialType,
      colorName: this.colorName,
      colorHex,
    };
  }

  private get currentVendor() {
    return (this.catalog.current ?? []).find((entry) => entry.vendor === this.vendor);
  }
}
