<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import * as Tabs from '$lib/components/ui/tabs';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import Pagination from '$lib/frontend/components/Pagination.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import {
    archiveOrganization,
    chargeOrganizationBalance,
    getOrganizationDetail,
    updateOrganization,
  } from '$lib/remotes/endpoints/organization.remote';
  import CheckIcon from '@lucide/svelte/icons/check';
  import HandCoinsIcon from '@lucide/svelte/icons/hand-coins';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import UsersIcon from '@lucide/svelte/icons/users';
  import XIcon from '@lucide/svelte/icons/x';
  import { DateTime } from 'luxon';
  import { getPaymentStatusColor } from '../print_requests/queue/utils';
  import CreateChargeModal from './CreateChargeModal.svelte';

  const TABS = { CHARGES: 'charges', BALANCE_PAYMENTS: 'balance_payments' } as const;
  type Tab = (typeof TABS)[keyof typeof TABS];

  type Props = ModalProps & {
    organizationId: string;
  };

  let { onClose, organizationId }: Props = $props();

  let organizationDetail = $derived(getOrganizationDetail({ id: organizationId }));
  let activeTab: Tab = $state(TABS.CHARGES);
  let isEditing = $state(false);
  let isChargingBalance = $state(false);
  let editName = $state('');
  let editEmail = $state('');
  let originalName = $state('');
  let originalEmail = $state('');

  let chargesCurrentPage = $state(1);
  let chargesItemsPerPage = 10;

  let paginatedCharges = $derived(() => {
    if (!organizationDetail.current) return [];
    const startIndex = (chargesCurrentPage - 1) * chargesItemsPerPage;
    const endIndex = startIndex + chargesItemsPerPage;
    return organizationDetail.current.charges.slice(startIndex, endIndex);
  });

  let chargesTotalPages = $derived(() => {
    if (!organizationDetail.current) return 1;
    return Math.ceil(organizationDetail.current.charges.length / chargesItemsPerPage);
  });

  async function handleChargeBalance() {
    const confirm = await modalManager.confirm({
      title: 'Charge Outstanding Balance',
      prompt: `Are you sure you want to send an invoice for the outstanding balance of ${formatCurrency(
        organizationDetail.current?.outstandingBalance || 0,
      )} to the organization's email?`,
      confirmText: 'Charge Balance',
    });

    if (!confirm) {
      return;
    }

    isChargingBalance = true;
    try {
      await chargeOrganizationBalance({ organizationId });
      await organizationDetail.refresh();
    } finally {
      isChargingBalance = false;
    }
  }

  function startEditing() {
    if (organizationDetail.current) {
      editName = organizationDetail.current.name;
      editEmail = organizationDetail.current.email;
      originalName = organizationDetail.current.name;
      originalEmail = organizationDetail.current.email;
      isEditing = true;
    }
  }

  function cancelEditing() {
    editName = '';
    editEmail = '';
    originalName = '';
    originalEmail = '';
    isEditing = false;
  }

  function createOrganizationCharge() {
    modalManager.show(CreateChargeModal, {
      orgId: organizationId,
    });
  }

  async function saveEdits() {
    await updateOrganization({
      id: organizationId,
      name: editName,
      email: editEmail,
    });
    await organizationDetail.refresh();
    isEditing = false;
  }

  async function deleteOrganization() {
    const confirm = await modalManager.confirm({
      title: 'Archive Organization',
      prompt:
        'Are you sure you want to archive this organization? This will hide it from the list but preserve all data.',
      confirmText: 'Archive',
      variant: 'destructive',
    });

    if (confirm) {
      await archiveOrganization({ id: organizationId });
      onClose();
    }
  }

  function formatCurrency(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
</script>

<Modal title="Organization Details" icon={UsersIcon} {onClose} size="xl">
  {#if organizationDetail.loading}
    <div class="flex justify-center py-8">
      <Spinner class="size-6" />
    </div>
  {:else if organizationDetail.error}
    <p class="text-sm text-destructive">
      Error loading organization details: {organizationDetail.error.message}
    </p>
  {:else if organizationDetail.current}
    <div class="flex flex-col gap-3">
      <div class="grid gap-3 md:grid-cols-2">
        <Section title="Organization">
          {#snippet actions()}
            {#if isEditing}
              <IconButton icon={CheckIcon} aria-label="Save Changes" onclick={saveEdits} />
              <IconButton icon={XIcon} aria-label="Cancel" onclick={cancelEditing} />
            {:else}
              <IconButton icon={PencilIcon} aria-label="Edit Organization" onclick={startEditing} />
              <IconButton
                icon={TrashIcon}
                aria-label="Archive Organization"
                class="text-destructive hover:text-destructive"
                onclick={deleteOrganization}
              />
            {/if}
          {/snippet}
          {#if isEditing}
            <div class="flex flex-col gap-3">
              <FormField label="Name" for="organization-name">
                <Input id="organization-name" bind:value={editName} />
              </FormField>
              <FormField label="Email" for="organization-email">
                <Input id="organization-email" bind:value={editEmail} type="email" />
              </FormField>
            </div>
          {:else}
            <dl>
              <InfoRow label="Name">{organizationDetail.current.name}</InfoRow>
              <InfoRow label="Email">{organizationDetail.current.email}</InfoRow>
            </dl>
          {/if}
        </Section>

        <Section title="Outstanding Balance">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-2xl font-semibold tabular-nums">
              {formatCurrency(organizationDetail.current.outstandingBalance)}
            </span>
            {#if organizationDetail.current.outstandingBalance > 0}
              <Button size="sm" onclick={handleChargeBalance} disabled={isChargingBalance}>
                {#if isChargingBalance}<Spinner />{/if}
                Charge Balance
              </Button>
            {/if}
          </div>
        </Section>
      </div>

      <Tabs.Root bind:value={activeTab}>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Tabs.List>
            <Tabs.Trigger value={TABS.CHARGES}>Charges</Tabs.Trigger>
            <Tabs.Trigger value={TABS.BALANCE_PAYMENTS}>Balance Payments</Tabs.Trigger>
          </Tabs.List>
          {#if activeTab === TABS.CHARGES}
            <Button size="sm" variant="outline" onclick={createOrganizationCharge}>
              <HandCoinsIcon />
              Add Charge
            </Button>
          {/if}
        </div>

        <Tabs.Content value={TABS.CHARGES}>
          <div class="overflow-hidden rounded-lg border">
            <Table.Root>
              <Table.Header class="bg-muted/50">
                <Table.Row>
                  <Table.Head>Description</Table.Head>
                  <Table.Head class="hidden sm:table-cell">Date</Table.Head>
                  <Table.Head class="text-right">Amount</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each paginatedCharges() as charge, index (index)}
                  <Table.Row>
                    <Table.Cell class="max-w-64">
                      <div class="truncate">{charge.description}</div>
                      <div class="text-xs text-muted-foreground sm:hidden">
                        {DateTime.fromISO(charge.date).toLocaleString(DateTime.DATE_SHORT)}
                      </div>
                    </Table.Cell>
                    <Table.Cell class="hidden sm:table-cell">
                      {DateTime.fromISO(charge.date).toLocaleString(DateTime.DATE_SHORT)}
                    </Table.Cell>
                    <Table.Cell class="text-right tabular-nums">
                      {formatCurrency(charge.amount)}
                    </Table.Cell>
                  </Table.Row>
                {:else}
                  <Table.Row>
                    <Table.Cell colspan={3} class="h-20 text-center text-muted-foreground">
                      No charges found.
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>

          <Pagination
            currentPage={chargesCurrentPage}
            totalPages={chargesTotalPages()}
            onPageChange={(page) => (chargesCurrentPage = page)}
          />
        </Tabs.Content>

        <Tabs.Content value={TABS.BALANCE_PAYMENTS}>
          <div class="overflow-hidden rounded-lg border">
            <Table.Root>
              <Table.Header class="bg-muted/50">
                <Table.Row>
                  <Table.Head>Issued</Table.Head>
                  <Table.Head class="hidden sm:table-cell">Paid</Table.Head>
                  <Table.Head>Status</Table.Head>
                  <Table.Head class="text-right">Amount</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each organizationDetail.current.balancePayments as payment, index (index)}
                  <Table.Row>
                    <Table.Cell>
                      {payment.issuedDate.toLocaleString(DateTime.DATE_SHORT)}
                    </Table.Cell>
                    <Table.Cell class="hidden sm:table-cell">
                      {payment.paymentDate
                        ? payment.paymentDate.toLocaleString(DateTime.DATE_SHORT)
                        : '—'}
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge tone={getPaymentStatusColor(payment.status)}>
                        {formatStatus(payment.status)}
                      </StatusBadge>
                    </Table.Cell>
                    <Table.Cell class="text-right tabular-nums">
                      {formatCurrency(payment.total)}
                    </Table.Cell>
                  </Table.Row>
                {:else}
                  <Table.Row>
                    <Table.Cell colspan={4} class="h-20 text-center text-muted-foreground">
                      No balance payments found.
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  {/if}
</Modal>
