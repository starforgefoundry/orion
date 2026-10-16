import { downloadFilamentCard } from '$lib/frontend/filament-card/download';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  getPrintMaterials,
  updatePrintMaterial,
} from '$lib/remotes/endpoints/print_materials.remote';
import type { PrintMaterial } from '$lib/server/db/schema';
import MaterialModal from './MaterialModal.svelte';

export class MaterialsManager {
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
    const term = this.searchTerm.trim().toUpperCase();

    return (this.materials.current ?? []).filter((material) =>
      [material.name, material.vendor, material.materialType, material.colorName, material.tagId]
        .filter(Boolean)
        .some((value) => value!.toUpperCase().includes(term)),
    );
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
