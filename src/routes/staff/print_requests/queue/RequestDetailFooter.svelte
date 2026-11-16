<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';
  import MailIcon from '@lucide/svelte/icons/mail';
  import PackageCheckIcon from '@lucide/svelte/icons/package-check';
  import PackageXIcon from '@lucide/svelte/icons/package-x';
  import XIcon from '@lucide/svelte/icons/x';
  import type { RequestDetail } from './request-detail.svelte';

  type Props = { detail: RequestDetail };

  let { detail }: Props = $props();
</script>

<div class="grid w-full grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
  {#if detail.canCancel}
    <Button
      variant="ghost"
      class="text-destructive hover:text-destructive sm:mr-auto"
      onclick={() => detail.cancel()}
    >
      <XIcon />
      Cancel Request
    </Button>
  {/if}
  {#if detail.readyForPickup}
    <Button variant="outline" onclick={() => detail.sendPickupReminder()}>
      <MailIcon />
      Send Pickup Reminder
    </Button>
  {/if}
  {#if detail.canEditPayment || detail.canCreatePayment}
    <Button variant="outline" onclick={() => detail.openPayment()}>
      <DollarSignIcon />
      {detail.canEditPayment ? 'Edit' : 'Create'}
      {detail.billingType}
    </Button>
  {/if}
  {#if detail.readyForPickup}
    <Button
      disabled={detail.updatingStatus || detail.awaitingPayment}
      onclick={() => detail.markPickedUp()}
    >
      {#if detail.updatingStatus}<Spinner />{:else}<PackageCheckIcon />{/if}
      {detail.awaitingPayment ? 'Awaiting Payment' : 'Mark Picked Up'}
    </Button>
  {/if}
  {#if detail.pickedUp}
    <Button variant="outline" onclick={() => detail.unmarkPickedUp()}>
      <PackageXIcon />
      Unmark Picked Up
    </Button>
  {/if}
</div>
