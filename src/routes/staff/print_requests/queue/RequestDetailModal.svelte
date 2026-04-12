<script lang="ts">
  import { goto } from '$app/navigation';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import {
    getPrintRequestById,
    sendPickupNotification,
    updatePartQuantity,
    updatePrintRequestDiscount,
    updatePrintRequestStatus,
  } from '$lib/remotes/endpoints/print_request.remote';
  import {
    Badge,
    Button,
    ContextMenuButton,
    Heading,
    HStack,
    Icon,
    IconButton,
    Modal,
    ModalBody,
    modalManager,
    NumberInput,
    Stack,
    Switch,
    Text,
    toastManager,
    type MenuItems,
  } from '@immich/ui';
  import {
    mdiAccount,
    mdiAccountGroup,
    mdiCheck,
    mdiClose,
    mdiCurrencyUsd,
    mdiDotsVertical,
    mdiDownload,
    mdiEmail,
    mdiHelp,
    mdiMonitorShare,
    mdiOpenInNew,
    mdiPackageVariantClosed,
    mdiPencil,
    mdiPrinter3dNozzle,
    mdiTag,
  } from '@mdi/js';
  import DiscountCodeModal from './DiscountCodeModal.svelte';
  import PaymentModal from './PaymentModal.svelte';
  import { getPaymentStatusColor, getStatusColor } from './utils';

  type Props = ModalProps & {
    requestId: string;
  };

  const { requestId, onClose }: Props = $props();

  // Wrap onClose to also clear the query param
  const handleClose = () => {
    goto('?', { replaceState: true, noScroll: true, keepFocus: true });
    onClose();
  };

  // Track editing state
  let isEditingQuantities = $state(false);
  let editQuantities = $state<Record<string, number>>({});
  let originalQuantities = $state<Record<string, number>>({});

  let requestRemote = $derived(getPrintRequestById(requestId));
  let request = $derived(requestRemote.current);
  let billingType = $derived.by(() => {
    if (!request) {
      return 'N/A';
    }

    if (request.isQuote && (!request.payment || request.payment?.status === 'quote')) {
      return 'Quote';
    }

    return 'Payment';
  });

  async function createPayment() {
    modalManager.show(PaymentModal, {
      request: request!,
      billingType,
    });
  }

  async function editPayment() {
    modalManager.show(PaymentModal, {
      request: request!,
      prefill: {
        buildPlates: request?.buildplateCount ?? 1,
        materialCost: request?.materialCost ?? 0,
      },
      billingType,
      isEdit: true,
    });
  }

  async function cancelRequest() {
    const cancel = await modalManager.showDialog({
      title: 'Cancel Print Request',
      prompt: 'Are you sure you want to cancel this print request? This action cannot be undone.',
      confirmText: 'Cancel Request',
      confirmColor: 'danger',
      icon: mdiHelp,
    });

    if (cancel) {
      await updatePrintRequestStatus({
        id: request?.id ?? '',
        status: 'canceled',
      });

      onClose();
    }
  }

  async function markPickedUp() {
    // Check if payment is paid
    if (request?.payment && request.payment.status !== 'paid') {
      await modalManager.showDialog({
        title: 'Payment Required',
        prompt:
          'This print request cannot be marked as picked up because the payment has not been completed. Please ensure the payment is marked as paid before marking as picked up.',
        confirmText: 'OK',
        confirmColor: 'primary',
        icon: mdiPackageVariantClosed,
      });
      return;
    }

    await updatePrintRequestStatus({
      id: request?.id ?? '',
      status: 'picked_up',
    });

    onClose();
  }

  async function sendPickupEmail() {
    try {
      await sendPickupNotification(request?.id ?? '');
      toastManager.success({
        title: 'Pickup Notification Sent',
        description: 'The pickup notification email has been sent to the customer.',
      });
    } catch (error) {
      toastManager.danger({
        title: 'Error Sending Email',
        description:
          'An error occurred while sending the pickup notification email. Please try again later.',
      });
    }
  }

  function startEditingQuantities() {
    // Initialize quantities for all files
    if (request?.files) {
      request.files.forEach((file) => {
        editQuantities[file.id] = file.quantity;
        originalQuantities[file.id] = file.quantity;
      });
    }
    isEditingQuantities = true;
  }

  function cancelEditingQuantities() {
    editQuantities = {};
    originalQuantities = {};
    isEditingQuantities = false;
  }

  async function saveQuantities() {
    // Only update quantities that changed
    const updates = Object.entries(editQuantities).filter(
      ([fileId, newQuantity]) => originalQuantities[fileId] !== newQuantity,
    );

    for (const [fileId, quantity] of updates) {
      await updatePartQuantity({ id: request!.id, partId: fileId, quantity });
    }

    editQuantities = {};
    originalQuantities = {};
    isEditingQuantities = false;
  }

  async function promptDiscountCode() {
    modalManager.show(DiscountCodeModal, {
      currentCode: request?.billingCode ?? '',
      onSave: async (code: string) => {
        try {
          await updatePrintRequestDiscount({
            id: request!.id,
            billingCode: code,
          });
          toastManager.success({
            title: 'Discount Code Updated',
            description: code ? `Billing code set to "${code}".` : 'Billing code removed.',
          });
        } catch (error: any) {
          toastManager.danger({
            title: 'Error',
            description: error?.message ?? 'Failed to update discount code.',
          });
        }
      },
    });
  }

  const customerMenuItems: MenuItems = [
    {
      title: 'Edit Discount Code',
      icon: mdiTag,
      onAction: () => promptDiscountCode(),
    },
  ];
</script>

<Modal
  title={request?.projectName ?? ''}
  size="giant"
  onClose={handleClose}
  icon={mdiPrinter3dNozzle}
>
  <ModalBody>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div class="flex flex-1 flex-col gap-4">
        <Stack class="rounded-2xl border-2 border-slate-700 p-4">
          <HStack class="items-center justify-between">
            <Heading size="medium">Customer Information</Heading>
            <ContextMenuButton
              icon={mdiDotsVertical}
              position="top-right"
              items={customerMenuItems}
              size="small"
              color="secondary"
              variant="ghost"
              shape="round"
              aria-label="Customer options"
            />
          </HStack>
          <HStack>
            <Icon icon={mdiAccount} size="24" />
            <Text>{request?.customerName}</Text>
          </HStack>
          <HStack>
            <Icon icon={mdiEmail} size="24" />
            <Text color="primary"><a href={`mailto:${request?.email}`}>{request?.email}</a></Text>
          </HStack>
          {#if request?.organization}
            <HStack>
              <Icon icon={mdiAccountGroup} size="24" />
              <Text>{request?.organization.name}</Text>
            </HStack>
          {/if}
          {#if request?.billingCode}
            <HStack>
              <Icon icon={mdiTag} size="24" />
              <Text>{request?.billingCode}</Text>
            </HStack>
          {/if}
        </Stack>
        <Stack class="rounded-2xl border-2 border-slate-700 p-4">
          <Stack>
            <HStack class="justify-between">
              <Text>Status</Text>
              <Badge color={getStatusColor(request?.status ?? 'pending')}>
                {request?.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </HStack>
            <HStack class="justify-between">
              <Text>Quote Requested</Text>
              <Switch disabled checked={request?.isQuote} />
            </HStack>
            <HStack class="justify-between">
              <Text>Print Material</Text>
              <Text>{request?.material.name}</Text>
            </HStack>
            {#if request?.materialCost && request?.materialCost >= 0}
              <HStack class="justify-between">
                <Text>Build Plates</Text>
                <Text>{request?.buildplateCount}</Text>
              </HStack>
              <HStack class="justify-between">
                <Text>Material Cost</Text>
                <Text>${(request?.materialCost / 100).toFixed(2)}</Text>
              </HStack>
            {/if}
          </Stack>
        </Stack>
        {#if request?.specialRequests}
          <Stack class="rounded-2xl border-2 border-slate-700 p-4">
            <Heading size="small">Special Requests</Heading>
            <Stack class="rounded-lg border bg-neutral-900 p-4">
              {#each request?.specialRequests.split('\n') as line}
                <Text class="font-mono" size="small">{line}</Text>
              {/each}
            </Stack>
          </Stack>
        {/if}

        {#if request?.payment}
          <Stack class="rounded-2xl border-2 border-slate-700 p-4">
            <HStack class="items-center justify-between">
              <Heading size="small">Payment Information</Heading>
              {#if request.payment.squareInvoiceId}
                <IconButton
                  icon={mdiOpenInNew}
                  aria-label="View Invoice"
                  color="primary"
                  variant="ghost"
                  shape="round"
                  href={`https://app.squareup.com/dashboard/invoices/${request.payment.squareInvoiceId}`}
                />
              {/if}
            </HStack>

            <HStack class="justify-between">
              <Text>Issued Date</Text>
              <Text fontWeight="bold">{request.payment.issuedDate.toLocaleString()}</Text>
            </HStack>

            <HStack class="justify-between">
              <Text>Status</Text>
              <Badge color={getPaymentStatusColor(request.payment.status)}
                >{request.payment.status.toUpperCase()}</Badge
              >
            </HStack>

            <HStack class="justify-between">
              <Text>Total</Text>
              <Text fontWeight="bold">${(request.payment.total / 100).toFixed(2)}</Text>
            </HStack>
          </Stack>
        {/if}
        {#if request?.payment}
          {#if request?.status !== 'canceled' && request.payment.status !== 'paid' && request.payment.status !== 'canceled'}
            <Button leadingIcon={mdiCurrencyUsd} fullWidth color="primary" onclick={editPayment}>
              Edit {billingType}
            </Button>
          {/if}
        {:else if request?.status !== 'canceled'}
          <Button leadingIcon={mdiCurrencyUsd} fullWidth color="success" onclick={createPayment}>
            Create {billingType}
          </Button>
        {/if}
        <Stack gap={2}>
          {#if request?.status === 'done'}
            <Button leadingIcon={mdiEmail} fullWidth color="primary" onclick={sendPickupEmail}>
              Send Pickup Email
            </Button>
            <Button
              leadingIcon={mdiPackageVariantClosed}
              fullWidth
              color="success"
              onclick={markPickedUp}
            >
              Picked up
            </Button>
          {/if}

          {#if request?.status !== 'canceled' && request?.status !== 'done' && request?.payment?.status !== 'paid'}
            <Button leadingIcon={mdiClose} fullWidth color="danger" onclick={cancelRequest}>
              Cancel Request
            </Button>
          {/if}
        </Stack>
      </div>
      <div class="flex h-full flex-1 flex-col rounded-2xl border-2 border-slate-700 p-4">
        <HStack class="justify-between ">
          <Heading size="medium">Print Files</Heading>
          <HStack gap={2}>
            {#if isEditingQuantities}
              <IconButton
                icon={mdiCheck}
                aria-label="Save Changes"
                color="success"
                size="small"
                onclick={saveQuantities}
              />
              <IconButton
                icon={mdiClose}
                aria-label="Cancel"
                color="danger"
                size="small"
                onclick={cancelEditingQuantities}
              />
            {:else}
              <IconButton
                icon={mdiPencil}
                aria-label="Edit Quantities"
                color="primary"
                size="small"
                onclick={startEditingQuantities}
              />
              <IconButton
                icon={mdiDownload}
                aria-label="Download Files"
                color="primary"
                size="small"
                href={`${window.location.origin}/api/prints/download/${request?.id}`}
              />
              <IconButton
                icon={mdiMonitorShare}
                aria-label="Send to OrcaSlicer"
                color="success"
                size="small"
                href={`orcaslicer://open?file=${encodeURIComponent(
                  `${window.location.origin}/api/prints/download/${request?.id}`,
                )}`}
              />
            {/if}
          </HStack>
        </HStack>

        {#each request?.files as file}
          <div class="bg-level-2 mt-2 rounded-lg border border-slate-600 p-4">
            <HStack class="items-center justify-between gap-4">
              <Text class="min-w-0 flex-1">{file.fileName}</Text>
              {#if isEditingQuantities}
                <div class="shrink-0">
                  <NumberInput
                    bind:value={editQuantities[file.id]}
                    min={1}
                    max={999}
                    step={1}
                    class="w-24"
                  />
                </div>
              {:else}
                <Text fontWeight="bold" class="shrink-0">{file.quantity}x</Text>
              {/if}
            </HStack>
          </div>
        {/each}
      </div>
    </div>
  </ModalBody>
</Modal>
