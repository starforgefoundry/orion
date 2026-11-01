<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { cn } from '$lib/frontend/cn';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import CheckIcon from '@lucide/svelte/icons/check';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import FileBoxIcon from '@lucide/svelte/icons/file-box';
  import MonitorUpIcon from '@lucide/svelte/icons/monitor-up';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import type { PrintRequestDetail, RequestDetail } from './request-detail.svelte';

  const MIN_QUANTITY = 1;
  const MAX_QUANTITY = 999;

  type Props = { detail: RequestDetail; request: PrintRequestDetail };

  let { detail, request }: Props = $props();
  const quantities = $derived(detail.quantities);
</script>

<Section title={`Files (${request.files.length})`}>
  {#snippet actions()}
    {#if quantities.isEditing}
      <Button size="sm" variant="ghost" onclick={() => quantities.cancel()}>Cancel</Button>
      <Button size="sm" onclick={() => detail.saveQuantities()}>
        <CheckIcon />
        Save
      </Button>
    {:else}
      <IconButton
        icon={PencilIcon}
        aria-label="Edit quantities"
        onclick={() => detail.editQuantities()}
      />
      <IconButton icon={DownloadIcon} aria-label="Download files" href={detail.downloadUrl} />
      <IconButton
        icon={MonitorUpIcon}
        aria-label="Open in OrcaSlicer"
        href={detail.slicerUrl}
        class="bg-success/15 text-success hover:bg-success/25 hover:text-success dark:hover:bg-success/25"
      />
    {/if}
  {/snippet}
  <ul class="-my-1 divide-y">
    {#each request.files as file (file.id)}
      <li class="flex min-h-12 items-center gap-3 py-2 text-base">
        <FileBoxIcon class="size-5 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1 truncate">{file.fileName}</span>
        {#if quantities.isEditing}
          <Input
            type="number"
            inputmode="numeric"
            bind:value={quantities.quantities[file.id]}
            min={MIN_QUANTITY}
            max={MAX_QUANTITY}
            class="h-9 w-20"
          />
        {:else}
          <span
            class={cn(
              'shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums',
              file.quantity > 1 ? 'bg-warning/15 text-warning' : 'bg-muted',
            )}
          >
            ×{file.quantity}
          </span>
        {/if}
      </li>
    {/each}
  </ul>
</Section>
