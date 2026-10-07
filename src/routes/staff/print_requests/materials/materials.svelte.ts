import { goto } from '$app/navigation';
import { downloadFilamentCard } from '$lib/frontend/filament-card/download';
import {
  getPrintMaterials,
  updatePrintMaterial,
} from '$lib/remotes/endpoints/print_materials.remote';
import type { PrintMaterial } from '$lib/server/db/schema';
import { modalManager } from '@immich/ui';
import { mdiChatQuestion } from '@mdi/js';
import MaterialEditModal from './MaterialEditModal.svelte';

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
    const term = this.searchTerm.toUpperCase();

    return (this.materials.current ?? []).filter((material) =>
      material.name.toUpperCase().includes(term),
    );
  }

  filamentLabel(material: PrintMaterial) {
    if (!material.filamentId) return 'Not linked';

    return `${material.vendor} ${material.materialType} — ${material.colorName}`;
  }

  edit(material: PrintMaterial) {
    modalManager.show(MaterialEditModal, { material });
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

  printTag(material: PrintMaterial) {
    if (!material.tagId) return;

    const tags = [{ name: material.name, tagId: material.tagId, colorHex: material.colorHex }];

    goto('/staff/print_requests/materials/labels?tags=' + encodeURIComponent(JSON.stringify(tags)));
  }

  async archive(id: string) {
    const confirmed = await modalManager.showDialog({
      title: 'Delete Print Material',
      prompt: 'Are you sure you want to delete this print material? This action cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'danger',
      icon: mdiChatQuestion,
    });

    if (confirmed) {
      await updatePrintMaterial({ id, archived: true });
    }
  }
}
