<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { getSquareCatalog, getSquareLocations } from '$lib/remotes/endpoints/square.remote';
  import InfoIcon from '@lucide/svelte/icons/info';

  let { onClose }: ModalProps = $props();

  let squareLocations = getSquareLocations();
  let squareCatalog = getSquareCatalog();
</script>

<Modal title="Square Info" size="full" icon={InfoIcon} {onClose}>
  {#if squareLocations.loading || squareCatalog.loading}
    <div class="flex justify-center py-8">
      <Spinner class="size-6" />
    </div>
  {:else}
    <div class="grid gap-3 lg:grid-cols-2">
      <div class="min-w-0">
        <h3 class="mb-2 text-sm font-medium">Locations</h3>
        <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code
            >{JSON.stringify(squareLocations.current, null, 2)}</code
          ></pre>
      </div>
      <div class="min-w-0">
        <h3 class="mb-2 text-sm font-medium">Catalog</h3>
        <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code
            >{JSON.stringify(
              squareCatalog.current,
              (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
              2,
            )}</code
          ></pre>
      </div>
    </div>
  {/if}
</Modal>
