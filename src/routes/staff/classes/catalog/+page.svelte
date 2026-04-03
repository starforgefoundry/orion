<script lang="ts">
  import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
  } from '$lib/frontend/components/table';
  import { getCatalogs } from '$lib/remotes/endpoints/class.remote';
  import { Heading, IconButton, Input, LoadingSpinner, modalManager } from '@immich/ui';
  import { mdiMagnify, mdiPencil, mdiPlus } from '@mdi/js';
  import ClassModal from './ClassModal.svelte';

  const catalogsRemote = getCatalogs();
  const catalogs = $derived(catalogsRemote.current ?? []);

  let searchTerm = $state('');
  const filtered = $derived(
    catalogs.filter((c) => c.name.toUpperCase().includes(searchTerm.toUpperCase())),
  );

  function openCreate() {
    modalManager.show(ClassModal, {});
  }

  function openEdit(cls: (typeof catalogs)[0]) {
    modalManager.show(ClassModal, {
      catalogId: cls.id,
      prefill: {
        name: cls.name,
        description: cls.description,
        price: cls.price,
        photoUrl: cls.photoUrl,
      },
    });
  }
</script>

<svelte:head>
  <title>Class Catalogs</title>
</svelte:head>

<div class="mb-6 flex items-center justify-between">
  <Heading size="large" class="inline-block w-fit">Class Catalogs</Heading>
  <div class="flex w-1/3 items-center gap-2">
    <IconButton
      icon={mdiPlus}
      variant="filled"
      aria-label="Add Class Catalog"
      class="min-w-10"
      onclick={openCreate}
    />
    <Input placeholder="Search Catalogs" leadingIcon={mdiMagnify} bind:value={searchTerm} />
  </div>
</div>

{#if catalogsRemote.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else}
  <Table>
    <TableHeader>
      <TableHeaderCell width="w-6/12">Name</TableHeaderCell>
      <TableHeaderCell width="w-3/12">Price</TableHeaderCell>
      <TableHeaderCell width="w-3/12">Actions</TableHeaderCell>
    </TableHeader>
    <TableBody>
      {#each filtered as cls}
        <TableRow>
          <TableCell width="w-6/12" align="left" class="pl-6">{cls.name}</TableCell>
          <TableCell width="w-3/12" align="center">${(cls.price / 100).toFixed(2)}</TableCell>
          <TableCell width="w-3/12" class="flex justify-center">
            <IconButton
              icon={mdiPencil}
              aria-label="Edit Catalog"
              color="primary"
              onclick={() => openEdit(cls)}
            />
          </TableCell>
        </TableRow>
      {/each}

      {#if filtered.length === 0}
        <TableRow>
          <TableCell width="w-full" class="text-center">No class catalogs found.</TableCell>
        </TableRow>
      {/if}
    </TableBody>
  </Table>
{/if}
