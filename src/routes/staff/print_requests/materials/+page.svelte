<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Spinner } from '$lib/components/ui/spinner';
  import { Switch } from '$lib/components/ui/switch';
  import * as Table from '$lib/components/ui/table';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import type { PrintMaterial } from '$lib/server/db/schema';
  import BoxIcon from '@lucide/svelte/icons/box';
  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SearchIcon from '@lucide/svelte/icons/search';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { MaterialsManager } from './materials.svelte';

  const manager = new MaterialsManager();

  function handleRowKeydown(event: KeyboardEvent, material: PrintMaterial) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    manager.edit(material);
  }
</script>

{#snippet swatch(hex: string | null)}
  {#if hex}
    <span class="size-4 shrink-0 rounded-full border" style={`background-color: ${hex}`}></span>
  {:else}
    <span class="size-4 shrink-0 rounded-full border border-dashed"></span>
  {/if}
{/snippet}

<PageHeader title="Print Materials">
  {#snippet actions()}
    <Button size="sm" onclick={() => manager.create()}>
      <PlusIcon />
      Add Material
    </Button>
  {/snippet}
</PageHeader>

<TextInput
  icon={SearchIcon}
  placeholder="Search name, filament or tag"
  class="mb-3 sm:max-w-xs"
  bind:value={manager.searchTerm}
/>

{#if manager.loading}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else if manager.error}
  <p class="text-sm text-destructive">Error loading print materials: {manager.error.message}</p>
{:else}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>Material</Table.Head>
          <Table.Head class="hidden md:table-cell">Filament</Table.Head>
          <Table.Head class="hidden sm:table-cell">Tag ID</Table.Head>
          <Table.Head class="w-24">Available</Table.Head>
          <Table.Head class="w-0"><span class="sr-only">Actions</span></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each manager.results as material (material.id)}
          {@const filament = manager.filamentLabel(material)}
          <Table.Row
            class="cursor-pointer"
            tabindex={0}
            onclick={() => manager.edit(material)}
            onkeydown={(e) => handleRowKeydown(e, material)}
          >
            <Table.Cell class="max-w-56">
              <div class="flex items-center gap-3">
                {@render swatch(material.colorHex)}
                <div class="min-w-0">
                  <div class="truncate font-medium">{material.name}</div>
                  <div class="truncate text-xs text-muted-foreground md:hidden">
                    {filament ?? 'No filament linked'}
                  </div>
                </div>
              </div>
            </Table.Cell>

            <Table.Cell class="hidden md:table-cell">
              <span class={filament ? '' : 'text-muted-foreground'}>
                {filament ?? 'Not linked'}
              </span>
            </Table.Cell>

            <Table.Cell class="hidden font-mono text-xs sm:table-cell">
              {#if material.tagId}
                {material.tagId}
              {:else}
                <span class="text-muted-foreground">—</span>
              {/if}
            </Table.Cell>

            <Table.Cell onclick={(e) => e.stopPropagation()}>
              <Switch
                checked={material.available}
                onCheckedChange={(value) => manager.setAvailability(material.id, value)}
                aria-label={`${material.name} available`}
              />
            </Table.Cell>

            <Table.Cell onclick={(e) => e.stopPropagation()}>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <IconButton
                      {...props}
                      icon={EllipsisVerticalIcon}
                      aria-label="Material options"
                      size="icon"
                      tooltip={false}
                    />
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" class="w-56">
                  <DropdownMenu.Item onSelect={() => manager.edit(material)}>
                    <PencilIcon />
                    Edit
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    disabled={!material.tagId || manager.downloadingCardId === material.id}
                    onSelect={() => manager.downloadCard(material)}
                  >
                    <BoxIcon />
                    Download Filament Card
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    variant="destructive"
                    onSelect={() => manager.archive(material)}
                  >
                    <TrashIcon />
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={5} class="h-24 text-center text-muted-foreground">
              {manager.searchTerm ? 'No materials match your search.' : 'No print materials yet.'}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
