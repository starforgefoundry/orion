<script lang="ts">
  import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
  } from '$lib/frontend/components/table';
  import type { LocalPrinterDto } from '$lib/remotes/dtos/local_printer.dto';
  import {
    deleteLocalPrinter,
    getLocalPrinters,
  } from '$lib/remotes/endpoints/local_printer.remote';
  import { IconButton, LoadingSpinner, modalManager, toastManager } from '@immich/ui';
  import { mdiChatQuestion, mdiPencil, mdiTrashCan } from '@mdi/js';
  import LocalPrinterModal from './LocalPrinterModal.svelte';

  let printers = getLocalPrinters();

  function showEditModal(printer: LocalPrinterDto) {
    modalManager.show(LocalPrinterModal, { printer });
  }

  async function removePrinter(printer: LocalPrinterDto) {
    const confirmed = await modalManager.showDialog({
      title: 'Delete Printer',
      prompt: `Are you sure you want to delete ${printer.name}? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmColor: 'danger',
      icon: mdiChatQuestion,
    });

    if (!confirmed) return;

    try {
      await deleteLocalPrinter({ id: printer.id });
      toastManager.success('Printer deleted');
    } catch {
      toastManager.danger('Failed to delete printer. Please try again.');
    }
  }
</script>

{#if printers.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if printers.error}
  <p class="text-danger">Error loading LAN mode printers: {printers.error.message}</p>
{:else}
  <Table>
    <TableHeader>
      <TableHeaderCell width="w-4/12" align="left">Name</TableHeaderCell>
      <TableHeaderCell width="w-3/12">IP Address</TableHeaderCell>
      <TableHeaderCell width="w-3/12">Serial</TableHeaderCell>
      <TableHeaderCell width="w-2/12">Actions</TableHeaderCell>
    </TableHeader>
    <TableBody>
      {#each printers.current ?? [] as printer}
        <TableRow>
          <TableCell width="w-4/12" align="left" class="pl-6">{printer.name}</TableCell>
          <TableCell width="w-3/12">{printer.localIp}</TableCell>
          <TableCell width="w-3/12">{printer.serial}</TableCell>
          <TableCell width="w-2/12" class="flex justify-center gap-2">
            <IconButton
              icon={mdiPencil}
              aria-label="Edit Printer"
              color="primary"
              onclick={() => showEditModal(printer)}
            />
            <IconButton
              icon={mdiTrashCan}
              aria-label="Delete Printer"
              color="danger"
              onclick={() => removePrinter(printer)}
            />
          </TableCell>
        </TableRow>
      {/each}

      {#if (printers.current ?? []).length === 0}
        <TableRow>
          <TableCell width="w-full" class="text-center">No LAN mode printers configured.</TableCell>
        </TableRow>
      {/if}
    </TableBody>
  </Table>
{/if}
