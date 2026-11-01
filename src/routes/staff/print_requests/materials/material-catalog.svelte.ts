import { downloadFilamentCard } from './filament-card/download';
import { filterBySearch } from '$lib/frontend/search';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  getPrintMaterials,
  updatePrintMaterial,
} from '$lib/remotes/endpoints/print-materials.remote';
import type { PrintMaterial } from '$lib/server/db/schema';
import MaterialModal from './MaterialModal.svelte';

export class MaterialCatalog {
  searchTerm = $state('');
  downloadingCardId = $state<string | null>(null);

  private materials = getPrintMaterials();

  get loading() {
    return this.materials.loading;
  }

  get error() {
    return this.materials.error;
  }

  get results(): PrintMaterial[] {
    return filterBySearch(this.materials.current ?? [], this.searchTerm.trim(), [
      'name',
      'vendor',
      'materialType',
      'colorName',
      'tagId',
    ]);
  }

  filamentLabel(material: PrintMaterial) {
    if (!material.filamentId) return null;

    return `${material.vendor} ${material.materialType} · ${material.colorName}`;
  }

  create() {
    modalManager.show(MaterialModal);
  }

  edit(material: PrintMaterial) {
    modalManager.show(MaterialModal, { material });
  }

  async setAvailability(id: string, available: boolean) {
    await updatePrintMaterial({ id, available });
  }

  async downloadCard(material: PrintMaterial) {
    if (!material.tagId) return;

    this.downloadingCardId = material.id;
    try {
      await downloadFilamentCard(
        { qrData: material.tagId, label: material.name },
        `card_${material.name.replaceAll(' ', '-')}.3mf`,
      );
    } finally {
      this.downloadingCardId = null;
    }
  }

  async archive(material: PrintMaterial) {
    const confirmed = await modalManager.confirm({
      title: 'Delete Print Material',
      prompt: `Delete "${material.name}"? It will no longer be offered to customers. Existing requests keep their material.`,
      confirmText: 'Delete',
      variant: 'destructive',
    });

    if (confirmed) {
      await updatePrintMaterial({ id: material.id, archived: true });
    }
  }
}
