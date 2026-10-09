<script lang="ts">
  import {
    Heading,
    IconButton,
    Input,
    LoadingSpinner,
    modalManager,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeading,
    TableRow,
    Text,
  } from '@immich/ui';
  import { mdiCubeOutline, mdiMagnify, mdiPencil, mdiPlus, mdiPrinter, mdiTrashCan } from '@mdi/js';
  import MaterialModal from './MaterialModal.svelte';
  import { MaterialsManager } from './materials.svelte';

  const manager = new MaterialsManager();
</script>

<div class="mb-6 flex items-center justify-between">
  <Heading size="large" class="inline-block w-fit">Print Materials</Heading>
  <div class="flex w-1/3 items-center gap-2">
    <IconButton
      icon={mdiPlus}
      variant="filled"
      aria-label="Add Print Material"
      class="min-w-10"
      onclick={() => modalManager.show(MaterialModal)}
    />
    <Input
      placeholder="Search Print Materials"
      leadingIcon={mdiMagnify}
      bind:value={manager.searchTerm}
    />
  </div>
</div>

{#if manager.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if manager.error}
  <p class="text-danger">Error loading print materials: {manager.error.message}</p>
{:else}
  <Table striped class="mt-4">
    <TableHeader>
      <TableHeading class="w-3/12">Name</TableHeading>
      <TableHeading class="w-1/12">Available</TableHeading>
      <TableHeading class="w-4/12">Filament</TableHeading>
      <TableHeading class="w-2/12">Tag ID</TableHeading>
      <TableHeading class="w-2/12">Actions</TableHeading>
    </TableHeader>
    <TableBody>
      {#each manager.results as material (material.id)}
        <TableRow>
          <TableCell class="w-3/12 px-4 text-left">{material.name}</TableCell>

          <TableCell class="w-1/12">
            <div class="flex justify-center">
              <Switch
                checked={material.available}
                onCheckedChange={(value) => manager.setAvailability(material.id, value)}
              />
            </div>
          </TableCell>

          <TableCell class="w-4/12">
            <div class="flex items-center justify-center gap-2">
              {#if material.colorHex}
                <div
                  class="size-4 shrink-0 rounded-full border border-subtle"
                  style={`background-color: ${material.colorHex}`}
                ></div>
              {/if}
              <Text color={material.filamentId ? 'primary' : 'secondary'}>
                {manager.filamentLabel(material)}
              </Text>
            </div>
          </TableCell>

          <TableCell class="w-2/12 font-mono">
            {material.tagId ?? '-'}
          </TableCell>

          <TableCell class="w-2/12">
            <div class="flex justify-center gap-2">
              <IconButton
                icon={mdiPencil}
                aria-label="Edit Material"
                color="primary"
                onclick={() => manager.edit(material)}
              />
              <IconButton
                icon={mdiPrinter}
                aria-label="Print Tag"
                color="secondary"
                disabled={!material.tagId}
                onclick={() => manager.printTag(material)}
              />
              <IconButton
                icon={mdiCubeOutline}
                aria-label="Download Filament Card"
                color="secondary"
                disabled={!material.tagId || manager.downloadingCardId === material.id}
                onclick={() => manager.downloadCard(material)}
              />
              <IconButton
                icon={mdiTrashCan}
                aria-label="Delete Material"
                color="danger"
                onclick={() => manager.archive(material.id)}
              />
            </div>
          </TableCell>
        </TableRow>
      {/each}

      {#if manager.results.length === 0}
        <TableRow>
          <TableCell class="w-full text-center">No print materials found.</TableCell>
        </TableRow>
      {/if}
    </TableBody>
  </Table>
{/if}
