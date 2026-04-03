<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { getSquareCatalog, getSquareLocations } from '$lib/remotes/endpoints/square.remote';
  import { CodeBlock, HStack, LoadingSpinner, Modal, ModalBody } from '@immich/ui';
  import { mdiSquare } from '@mdi/js';
  import { json } from 'svelte-highlight/languages';

  let { onClose }: ModalProps = $props();

  let squareLocations = getSquareLocations();
  let squareCatalog = getSquareCatalog();
</script>

<Modal title="Square Info" size="giant" icon={mdiSquare} {onClose}>
  <ModalBody>
    {#if squareLocations.loading || squareCatalog.loading}
      <div class="flex w-full justify-center">
        <LoadingSpinner />
      </div>
    {:else}
      <HStack class="mb-4">
        <div class="w-1/2 self-start">
          <h3 class="mb-2 text-lg font-semibold">Locations</h3>
          <CodeBlock language={json} code={JSON.stringify(squareLocations.current, null, 2)} />
        </div>
        <div class="w-1/2 self-start">
          <h3 class="mb-2 text-lg font-semibold">Catalog</h3>
          <CodeBlock
            language={json}
            code={JSON.stringify(
              squareCatalog.current,
              (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
              2,
            )}
          />
        </div>
      </HStack>
    {/if}
  </ModalBody>
</Modal>
