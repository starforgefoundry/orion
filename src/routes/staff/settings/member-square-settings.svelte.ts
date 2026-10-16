import type { SelectOption } from '$lib/frontend/components/form/OptionSelect.svelte';
import { getSquareCatalog, syncSquareMembers } from '$lib/remotes/endpoints/square.remote';
import { toast } from 'svelte-sonner';

type SyncSummary = Awaited<ReturnType<typeof syncSquareMembers>>;

export class MemberSquareSettingsManager {
  readonly catalog = getSquareCatalog();
  isSyncing = $state(false);
  lastSync = $state<SyncSummary>();

  readonly variationOptions: SelectOption[] = $derived(
    (this.catalog.current ?? []).flatMap((item) => {
      if (item.type !== 'ITEM') return [];

      const itemName = item.itemData?.name || 'Unnamed Item';
      const variations = item.itemData?.variations ?? [];
      return variations.flatMap((variation) => {
        if (!variation.id) return [];

        const variationName =
          variation.type === 'ITEM_VARIATION' ? variation.itemVariationData?.name : undefined;
        return {
          label:
            variations.length > 1 && variationName ? `${itemName} – ${variationName}` : itemName,
          value: variation.id,
        };
      });
    }),
  );

  async sync() {
    this.isSyncing = true;
    try {
      this.lastSync = await syncSquareMembers();
      toast.success('Members synced from Square');
    } catch (error) {
      toast.error('Error syncing members', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      this.isSyncing = false;
    }
  }
}
