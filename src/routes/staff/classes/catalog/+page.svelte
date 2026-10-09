<script lang="ts">
  import { getCatalogs } from '$lib/remotes/endpoints/class.remote';
  import {
    Heading,
    IconButton,
    Input,
    LoadingSpinner,
    modalManager,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeading,
    TableRow,
  } from '@immich/ui';
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
  <title>Class Catalog</title>
</svelte:head>

<div class="mb-6 flex items-center justify-between">
  <Heading size="large" class="inline-block w-fit">Class Catalog</Heading>
  <div class="flex w-1/3 items-center gap-2">
    <IconButton
      icon={mdiPlus}
      variant="filled"
      aria-label="Add Class Catalog"
      class="min-w-10"
      onclick={openCreate}
    />
    <Input placeholder="Search Catalog" leadingIcon={mdiMagnify} bind:value={searchTerm} />
  </div>
</div>

{#if catalogsRemote.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else}
  <Table striped class="mt-4">
    <TableHeader>
      <TableHeading class="w-6/12 text-left">Name</TableHeading>
      <TableHeading class="w-3/12">Price</TableHeading>
      <TableHeading class="w-3/12">Actions</TableHeading>
    </TableHeader>
    <TableBody>
      {#each filtered as cls}
        <TableRow>
          <TableCell class="w-6/12 px-4 text-left">{cls.name}</TableCell>
          <TableCell class="w-3/12">${(cls.price / 100).toFixed(2)}</TableCell>
          <TableCell class="w-3/12">
            <div class="flex justify-center">
              <IconButton
                icon={mdiPencil}
                aria-label="Edit Catalog"
                color="primary"
                onclick={() => openEdit(cls)}
              />
            </div>
          </TableCell>
        </TableRow>
      {/each}

      {#if filtered.length === 0}
        <TableRow>
          <TableCell class="w-full text-center">No classes found.</TableCell>
        </TableRow>
      {/if}
    </TableBody>
  </Table>
{/if}
