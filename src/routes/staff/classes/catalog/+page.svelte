<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getCatalogs } from '$lib/remotes/endpoints/class.remote';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SearchIcon from '@lucide/svelte/icons/search';
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

<PageHeader title="Class Catalog" formHref="/classes">
  {#snippet actions()}
    <Button onclick={openCreate}>
      <PlusIcon />
      Add Class
    </Button>
  {/snippet}
</PageHeader>

<TextInput
  icon={SearchIcon}
  placeholder="Search catalog"
  class="mb-3 w-full sm:max-w-xs"
  bind:value={searchTerm}
/>

{#if catalogsRemote.loading}
  <div class="flex justify-center py-10">
    <Spinner class="size-6" />
  </div>
{:else}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>Name</Table.Head>
          <Table.Head class="text-right">Price</Table.Head>
          <Table.Head class="w-12"><span class="sr-only">Actions</span></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each filtered as cls (cls.id)}
          <Table.Row>
            <Table.Cell class="max-w-48 truncate font-medium sm:max-w-none">{cls.name}</Table.Cell>
            <Table.Cell class="text-right tabular-nums">${(cls.price / 100).toFixed(2)}</Table.Cell>
            <Table.Cell class="py-1.5 text-right">
              <IconButton icon={PencilIcon} aria-label="Edit class" onclick={() => openEdit(cls)} />
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={3} class="h-20 text-center text-muted-foreground">
              No classes found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
