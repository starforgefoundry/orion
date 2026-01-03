<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { getPayment } from '$lib/remotes/endpoints/print_payment.remote';
  import {
    getPrintRequestById,
    getPrintRequestFiles,
    updatePrintRequest,
  } from '$lib/remotes/endpoints/print_request.remote';
  import {
    Badge,
    Button,
    Heading,
    HStack,
    Icon,
    IconButton,
    LoadingSpinner,
    Modal,
    ModalBody,
    modalManager,
    Stack,
    Switch,
    Text,
  } from '@immich/ui';
  import {
    mdiAccount,
    mdiClose,
    mdiCurrencyUsd,
    mdiDownload,
    mdiEmail,
    mdiHelp,
    mdiMonitorShare,
    mdiPrinter3dNozzle,
  } from '@mdi/js';
  import PaymentModal from './PaymentModal.svelte';

  type Props = ModalProps & {
    requestId: string;
  };

  const { requestId, onClose }: Props = $props();

  let requestRemote = $derived(getPrintRequestById(requestId));
  let request = $derived(requestRemote.current);

  let printFiles = $derived(request ? getPrintRequestFiles(request.id) : undefined);
  let paymentInfo = $derived(request?.paymentId ? getPayment(request.paymentId).current : null);

  async function createPayment() {
    modalManager.show(PaymentModal, {
      request: request!,
    });
  }

  async function editPayment() {
    modalManager.show(PaymentModal, {
      request: request!,
      prefill: {
        buildPlates: request?.buildplateCount ?? 1,
        materialCost: request?.materialCost ?? 0,
      },
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
      await updatePrintRequest({
        id: request?.id ?? '',
        status: 'canceled',
      });

      onClose();
    }
  }
</script>

<Modal title={request?.projectName ?? ''} size="giant" {onClose} icon={mdiPrinter3dNozzle}>
  <ModalBody>
    <HStack gap={8} class="w-full items-start">
      <div class="flex flex-1 flex-col gap-4">
        <Stack class="rounded-2xl border-2 border-slate-700 p-4">
          <Heading size="medium">Customer Information</Heading>
          <HStack>
            <Icon icon={mdiAccount} size="24" />
            <Text>{request?.customerName}</Text>
          </HStack>
          <HStack>
            <Icon icon={mdiEmail} size="24" />
            <Text><a href={`mailto:${request?.email}`}>{request?.email}</a></Text>
          </HStack>
        </Stack>
        <Stack class="rounded-2xl border-2 border-slate-700 p-4">
          <Stack>
            <HStack class="justify-between">
              <Heading size="tiny">Status</Heading>
              <Badge
                color={request?.status === 'in_queue'
                  ? 'secondary'
                  : request?.status === 'printing'
                    ? 'info'
                    : request?.status === 'done'
                      ? 'success'
                      : 'danger'}
                size="small"
              >
                {request?.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </HStack>
            <HStack class="justify-between">
              <Heading size="tiny">Quote Requested</Heading>
              <Switch disabled checked={request?.isQuote} />
            </HStack>
            <HStack class="justify-between">
              <Heading size="tiny">Print Material</Heading>
              <Text>{request?.material.name}</Text>
            </HStack>
          </Stack>
        </Stack>
        {#if request?.specialRequests}
          <Stack class="rounded-2xl border-2 border-slate-700 p-4">
            <Heading size="small">Special Requests</Heading>
            <Text>{request?.specialRequests}</Text>
          </Stack>
        {/if}

        {#if paymentInfo}
          <Stack class="rounded-2xl border-2 border-slate-700 p-4">
            <Heading size="small" class="mb-2">Payment Information</Heading>

            <HStack class="justify-between">
              <Text>Issued Date</Text>
              <Text fontWeight="bold">{paymentInfo.issuedDate.toLocaleString()}</Text>
            </HStack>

            <HStack class="justify-between">
              <Text>Status</Text>
              <Text fontWeight="bold">{paymentInfo.status.toUpperCase()}</Text>
            </HStack>

            <HStack class="justify-between">
              <Text>Total</Text>
              <Text fontWeight="bold">${(paymentInfo.total / 100).toFixed(2)}</Text>
            </HStack>
          </Stack>
        {/if}
        <!-- Dont show buttons while loading (undefined == loading) -->
        {#if paymentInfo !== undefined}
          <Stack gap={2}>
            {#if paymentInfo}
              {#if request?.status !== 'canceled' && paymentInfo.status !== 'paid' && paymentInfo.status !== 'canceled'}
                <Button
                  leadingIcon={mdiCurrencyUsd}
                  fullWidth
                  color="primary"
                  onclick={editPayment}
                >
                  Edit Payment
                </Button>
              {/if}
            {:else}
              <Button
                leadingIcon={mdiCurrencyUsd}
                fullWidth
                color="success"
                onclick={createPayment}
              >
                Create Payment
              </Button>
            {/if}
            <Button leadingIcon={mdiClose} fullWidth color="danger" onclick={cancelRequest}>
              Cancel Request
            </Button>
          </Stack>
        {/if}
      </div>
      <div class="flex h-full flex-1 flex-col">
        <HStack class="justify-between">
          <Heading size="medium">Print Files</Heading>
          <HStack gap={2}>
            <IconButton
              icon={mdiDownload}
              aria-label="Download Files"
              color="primary"
              size="small"
              href={`${window.location.origin}/api/print_download/${request?.id}`}
            />
            <IconButton
              icon={mdiMonitorShare}
              aria-label="Send to OrcaSlicer"
              color="success"
              size="small"
              href={`orcaslicer://open?file=${encodeURIComponent(
                `${window.location.origin}/api/print_download/${request?.id}`,
              )}`}
            />
          </HStack>
        </HStack>
        {#if printFiles?.loading}
          <div class="flex w-full flex-col items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        {:else if printFiles?.error}
          <Text class="text-danger">Error loading files: {printFiles?.error.message}</Text>
        {/if}
        {#each printFiles?.current as file}
          <div class="bg-level-2 mt-2 rounded-lg border border-slate-600 p-4">
            <HStack class="justify-between">
              <Text>{file.fileName}</Text>
              <Text fontWeight="bold">{file.quantity}x</Text>
            </HStack>
          </div>
        {/each}
      </div>
    </HStack>
  </ModalBody>
</Modal>
