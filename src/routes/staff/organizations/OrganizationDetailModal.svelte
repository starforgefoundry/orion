<script lang="ts">
  import Pagination from '$lib/frontend/components/Pagination.svelte';
  import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
  } from '$lib/frontend/components/table';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import {
    archiveOrganization,
    chargeOrganizationBalance,
    getOrganizationDetail,
    updateOrganization,
  } from '$lib/remotes/endpoints/organization.remote';
  import {
    Badge,
    Button,
    Heading,
    HStack,
    IconButton,
    Input,
    LoadingSpinner,
    Modal,
    ModalBody,
    modalManager,
    Stack,
  } from '@immich/ui';
  import {
    mdiAccountGroup,
    mdiCashPlus,
    mdiChatQuestion,
    mdiCheck,
    mdiClose,
    mdiPencil,
    mdiTrashCan,
  } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { getPaymentStatusColor } from '../print_queue/utils';
  import CreateChargeModal from './CreateChargeModal.svelte';

  type Props = ModalProps & {
    organizationId: string;
  };

  let { onClose, organizationId }: Props = $props();

  let organizationDetail = $derived(getOrganizationDetail({ id: organizationId }));
  let activeTab: 'charges' | 'balance_payments' = $state('charges');
  let isEditing = $state(false);
  let isChargingBalance = $state(false);
  let editName = $state('');
  let editEmail = $state('');
  let originalName = $state('');
  let originalEmail = $state('');

  // Pagination state
  let chargesCurrentPage = $state(1);
  let chargesItemsPerPage = 10;

  // Paginated data
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
    const confirm = await modalManager.showDialog({
      title: 'Charge Outstanding Balance',
      prompt: `Are you sure you want to send an invoice for the outstanding balance of ${formatCurrency(
        organizationDetail.current?.outstandingBalance || 0,
      )} to the organization's email?`,
      confirmText: 'Charge Balance',
      confirmColor: 'success',
      icon: mdiCashPlus,
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
    const confirm = await modalManager.showDialog({
      title: 'Archive Organization',
      prompt:
        'Are you sure you want to archive this organization? This will hide it from the list but preserve all data.',
      confirmText: 'Archive',
      confirmColor: 'danger',
      icon: mdiChatQuestion,
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

<Modal title="Organization Details" icon={mdiAccountGroup} {onClose} size="giant">
  <ModalBody>
    {#if organizationDetail.loading}
      <div class="flex justify-center py-8">
        <LoadingSpinner size="large" />
      </div>
    {:else if organizationDetail.error}
      <p class="text-danger">
        Error loading organization details: {organizationDetail.error.message}
      </p>
    {:else if organizationDetail.current}
      <Stack gap={4}>
        <HStack class="justify-between">
          <div>
            <p class="text-sm text-gray-500">Name</p>
            {#if isEditing}
              <Input bind:value={editName} />
            {:else}
              <p class="font-semibold">{organizationDetail.current.name}</p>
            {/if}
          </div>
          <div>
            <p class="text-sm text-gray-500">Email</p>
            {#if isEditing}
              <Input bind:value={editEmail} type="email" />
            {:else}
              <p class="font-semibold">{organizationDetail.current.email}</p>
            {/if}
          </div>

          <HStack class="justify-end" gap={2}>
            {#if isEditing}
              <IconButton
                icon={mdiCheck}
                aria-label="Save Changes"
                color="success"
                size="small"
                onclick={saveEdits}
              />
              <IconButton
                icon={mdiClose}
                aria-label="Cancel"
                color="danger"
                size="small"
                onclick={cancelEditing}
              />
            {:else}
              <IconButton
                icon={mdiCashPlus}
                aria-label="Create Organization Charge"
                color="success"
                size="small"
                onclick={createOrganizationCharge}
              />
              <IconButton
                icon={mdiPencil}
                aria-label="Edit Organization"
                color="primary"
                size="small"
                onclick={startEditing}
              />
              <IconButton
                icon={mdiTrashCan}
                aria-label="Delete Organization"
                color="danger"
                size="small"
                onclick={deleteOrganization}
              />
            {/if}
          </HStack>
        </HStack>

        <div class="rounded-lg border border-gray-400 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-gray-500">Outstanding Balance</p>
              <Heading size="medium" class="mt-1">
                {formatCurrency(organizationDetail.current.outstandingBalance)}
              </Heading>
            </div>
            {#if organizationDetail.current.outstandingBalance > 0}
              <Button variant="filled" onclick={handleChargeBalance} loading={isChargingBalance}>
                <div class="flex items-center gap-2">Charge Balance</div>
              </Button>
            {/if}
          </div>
        </div>

        <div class="flex gap-2">
          <button
            class="px-4 py-2 {activeTab === 'charges'
              ? 'border-b-2 border-primary font-semibold'
              : ''}"
            onclick={() => (activeTab = 'charges')}
          >
            Charges
          </button>
          <button
            class="px-4 py-2 {activeTab === 'balance_payments'
              ? 'border-b-2 border-primary font-semibold'
              : ''}"
            onclick={() => (activeTab = 'balance_payments')}
          >
            Balance Payments
          </button>
        </div>

        {#if activeTab === 'charges'}
          <Table>
            <TableHeader class="bg-level-3">
              <TableHeaderCell width="w-6/12" align="left" class="px-4">
                Description
              </TableHeaderCell>
              <TableHeaderCell width="w-3/12" align="left" class="px-4">Date</TableHeaderCell>
              <TableHeaderCell width="w-3/12" align="right" class="px-4">Amount</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {#each paginatedCharges() as charge}
                <TableRow>
                  <TableCell width="w-6/12" align="left" class="px-4">
                    {charge.description}
                  </TableCell>
                  <TableCell width="w-3/12" align="left" class="px-4">
                    {DateTime.fromISO(charge.date).toLocaleString(DateTime.DATE_SHORT)}
                  </TableCell>
                  <TableCell width="w-3/12" align="right" class="px-4">
                    {formatCurrency(charge.amount)}
                  </TableCell>
                </TableRow>
              {/each}
              {#if organizationDetail.current.charges.length === 0}
                <TableRow>
                  <TableCell width="w-full" class="text-center">No charges found.</TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>

          <Pagination
            currentPage={chargesCurrentPage}
            totalPages={chargesTotalPages()}
            onPageChange={(page) => (chargesCurrentPage = page)}
          />
        {:else if activeTab === 'balance_payments'}
          <Table>
            <TableHeader class="bg-level-3">
              <TableHeaderCell width="w-3/12" align="left" class="px-4">
                Issued Date
              </TableHeaderCell>
              <TableHeaderCell width="w-3/12" align="left" class="px-4">
                Payment Date
              </TableHeaderCell>
              <TableHeaderCell width="w-3/12">Status</TableHeaderCell>
              <TableHeaderCell width="w-3/12" align="right" class="px-4">Amount</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {#each organizationDetail.current.balancePayments as payment}
                <TableRow>
                  <TableCell width="w-3/12" align="left" class="px-4">
                    {payment.issuedDate.toLocaleString(DateTime.DATE_SHORT)}
                  </TableCell>
                  <TableCell width="w-3/12" align="left" class="px-4">
                    {payment.paymentDate
                      ? payment.paymentDate.toLocaleString(DateTime.DATE_SHORT)
                      : '-'}
                  </TableCell>
                  <TableCell width="w-3/12">
                    <Badge color={getPaymentStatusColor(payment.status)}
                      >{formatStatus(payment.status)}</Badge
                    >
                  </TableCell>
                  <TableCell width="w-3/12" align="right" class="px-4">
                    {formatCurrency(payment.total)}
                  </TableCell>
                </TableRow>
              {/each}
              {#if organizationDetail.current.balancePayments.length === 0}
                <TableRow>
                  <TableCell width="w-full" class="text-center">
                    No balance payments found.
                  </TableCell>
                </TableRow>
              {/if}
            </TableBody>
          </Table>
        {/if}
      </Stack>
    {/if}
  </ModalBody>
</Modal>
