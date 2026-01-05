<script lang="ts">
  import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
  } from '$lib/frontend/components/table';
  import {
    getPrintMaterials,
    updatePrintMaterial,
  } from '$lib/remotes/endpoints/print_materials.remote';
  import { Heading, IconButton, Input, LoadingSpinner, modalManager, Switch } from '@immich/ui';
  import { mdiChatQuestion, mdiMagnify, mdiPlus, mdiTrashCan } from '@mdi/js';
  import MaterialModal from './MaterialModal.svelte';

  let materials = getPrintMaterials();
  let searchTerm = $state('');
  let searchedMaterials = $derived(
    materials.current?.filter((material) =>
      material.name.toUpperCase().includes(searchTerm.toUpperCase()),
    ) || [],
  );

  function showCreateModal() {
    modalManager.show(MaterialModal);
  }

  function updateMaterialAvailability(id: string, available: boolean) {
    updatePrintMaterial({ id, available });
  }

  async function deleteMaterial(id: string) {
    const confirm = await modalManager.showDialog({
      title: 'Delete Print Material',
      prompt: 'Are you sure you want to delete this print material? This action cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'danger',
      icon: mdiChatQuestion,
    });

    if (confirm) {
      await updatePrintMaterial({ id, archived: true });
    }
  }
</script>

<div class="mb-6 flex items-center justify-between">
  <Heading size="large" class="inline-block w-fit">Print Materials</Heading>
  <div class="flex w-1/3 items-center gap-2">
    <IconButton
      icon={mdiPlus}
      variant="filled"
      aria-label="Add Print Material"
      class="min-w-10"
      onclick={showCreateModal}
    />
    <Input placeholder="Search Print Materials" leadingIcon={mdiMagnify} bind:value={searchTerm} />
  </div>
</div>

{#if materials.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if materials.error}
  <p class="text-danger">Error loading print materials: {materials.error.message}</p>
{:else}
  <Table>
    <TableHeader>
      <TableHeaderCell width="w-6/12">Name</TableHeaderCell>
      <TableHeaderCell width="w-3/12">Availability</TableHeaderCell>
      <TableHeaderCell width="w-3/12">Actions</TableHeaderCell>
    </TableHeader>
    <TableBody>
      {#each searchedMaterials as material}
        <TableRow>
          <TableCell width="w-6/12" align="left" class="pl-6">{material.name}</TableCell>

          <TableCell width="w-3/12" class="flex justify-center">
            <Switch
              checked={material.available}
              onCheckedChange={(value) => updateMaterialAvailability(material.id, value)}
            />
          </TableCell>
          <TableCell width="w-3/12" class="flex justify-center gap-2">
            <IconButton
              icon={mdiTrashCan}
              aria-label="Delete Material"
              color="danger"
              onclick={() => deleteMaterial(material.id)}
            />
          </TableCell>
        </TableRow>
      {/each}

      {#if searchedMaterials.length === 0}
        <TableRow>
          <TableCell width="w-full" class="text-center">No print materials found.</TableCell>
        </TableRow>
      {/if}
    </TableBody>
  </Table>
{/if}
