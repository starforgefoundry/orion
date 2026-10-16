<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Tabs from '$lib/components/ui/tabs';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import * as Item from '$lib/components/ui/item';
  import { cn } from '$lib/frontend/cn';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusIndicator from '$lib/frontend/components/StatusIndicator.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import type { PrintRequestStatus } from '$lib/remotes/dtos/print_request.dto';
  import {
    getPrintRequestById,
    getPrintRequestComments,
    getPrintRequestDownloadUrl,
    updatePrintRequestDiscount,
  } from '$lib/remotes/endpoints/print_request.remote';
  import PackageCheckIcon from '@lucide/svelte/icons/package-check';
  import CheckIcon from '@lucide/svelte/icons/check';
  import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import FileWarningIcon from '@lucide/svelte/icons/file-warning';
  import MailIcon from '@lucide/svelte/icons/mail';
  import MonitorUpIcon from '@lucide/svelte/icons/monitor-up';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import Printer3dIcon from '@lucide/svelte/icons/printer-3d';
  import TagIcon from '@lucide/svelte/icons/tag';
  import UserPenIcon from '@lucide/svelte/icons/user-pen';
  import XIcon from '@lucide/svelte/icons/x';
  import UserIcon from '@lucide/svelte/icons/user';
  import SpoolIcon from '@lucide/svelte/icons/spool';
  import ReceiptIcon from '@lucide/svelte/icons/receipt';
  import FileBoxIcon from '@lucide/svelte/icons/file-box';
  import { DateTime } from 'luxon';
  import { toast } from 'svelte-sonner';
  import { MediaQuery } from 'svelte/reactivity';
  import CustomerEditModal from './CustomerEditModal.svelte';
  import DiscountCodeModal from './DiscountCodeModal.svelte';
  import PaymentModal from './PaymentModal.svelte';
  import { QuantityEditor } from './quantity-editor.svelte';
  import RequestComments from './RequestComments.svelte';
  import {
    cancelRequest,
    changeStatus,
    isAwaitingPayment,
    isClosed,
    sendPickupEmail,
    STATUS,
  } from './request-actions';
  import { formatPrice, PAYMENT_STATUS_DISPLAY, REQUEST_STATUS_DISPLAY } from './utils';

  type Props = ModalProps & {
    requestId: string;
  };

  const { requestId, onClose }: Props = $props();

  const TABS = { DETAILS: 'details', FILES: 'files', COMMENTS: 'comments' } as const;
  type Tab = (typeof TABS)[keyof typeof TABS];

  const isDesktop = new MediaQuery('min-width: 1024px');
  const quantityEditor = new QuantityEditor();

  let activeTab = $state<Tab>(TABS.DETAILS);
  let isUpdatingStatus = $state(false);

  let request = $derived(getPrintRequestById(requestId).current);
  let commentCount = $derived(getPrintRequestComments(requestId).current?.length ?? 0);
  let downloadPath = $derived(getPrintRequestDownloadUrl(requestId).current);
  let downloadUrl = $derived(downloadPath && new URL(downloadPath, window.location.origin).href);
  let slicerUrl = $derived(
    downloadUrl && `orcaslicer://open?file=${encodeURIComponent(downloadUrl)}`,
  );

  let billingType = $derived(
    request?.isQuote && (!request.payment || request.payment.status === 'quote')
      ? 'Quote'
      : 'Payment',
  );

  const canEditPayment = $derived(
    !!request?.payment &&
      request.status !== STATUS.CANCELED &&
      request.payment.status !== 'paid' &&
      request.payment.status !== 'canceled',
  );
  const canCreatePayment = $derived(
    !!request && !request.payment && request.status !== STATUS.CANCELED,
  );
  const canCancel = $derived(
    !!request &&
      !isClosed(request) &&
      request.status !== STATUS.DONE &&
      request.payment?.status !== 'paid',
  );

  const quoteNotice = $derived.by(() => {
    if (!request?.isQuote || request.status === STATUS.CANCELED) return undefined;
    if (!request.payment) {
      return {
        title: 'Quote requested',
        description: 'Create a quote for the customer to approve before printing.',
      };
    }
    if (request.payment.status === 'quote') {
      return {
        title: 'Quote sent, awaiting approval',
        description: 'Hold off on printing until the customer approves the quote.',
      };
    }
    return undefined;
  });

  const hasFooterActions = $derived(
    canCancel || canEditPayment || canCreatePayment || request?.status === STATUS.DONE,
  );

  function handleClose() {
    goto('?', { replaceState: true, noScroll: true, keepFocus: true });
    onClose();
  }

  async function setStatus(status: PrintRequestStatus) {
    if (!request) return;
    isUpdatingStatus = true;
    try {
      const changed = await changeStatus(request, status);
      if (changed && status === STATUS.PICKED_UP) handleClose();
    } finally {
      isUpdatingStatus = false;
    }
  }

  async function cancel() {
    if (request && (await cancelRequest(request))) handleClose();
  }

  function openPayment() {
    if (!request) return;
    modalManager.show(PaymentModal, {
      request,
      billingType,
      ...(canEditPayment && {
        prefill: {
          buildPlates: request.buildplateCount ?? 1,
          materialCost: request.materialCost ?? 0,
        },
        isEdit: true,
      }),
    });
  }

  function editCustomer() {
    if (!request) return;
    modalManager.show(CustomerEditModal, {
      requestId: request.id,
      currentName: request.customerName,
      currentEmail: request.email,
    });
  }

  function editDiscountCode() {
    if (!request) return;
    const id = request.id;
    modalManager.show(DiscountCodeModal, {
      currentCode: request.billingCode ?? '',
      onSave: async (code: string) => {
        try {
          await updatePrintRequestDiscount({ id, billingCode: code });
          toast.success('Discount code updated', {
            description: code ? `Billing code set to "${code}".` : 'Billing code removed.',
          });
        } catch (error) {
          toast.error('Failed to update discount code', {
            description: (error as Error)?.message,
          });
        }
      },
    });
  }
</script>

{#snippet overviewPanel()}
  {#if request}
    <div class="flex flex-col gap-4">
      <Item.Group class="gap-0 rounded-lg border has-data-[size=sm]:gap-0">
        <Item.Root size="sm" class="rounded-none border-0 border-b border-border last:border-b-0">
          <Item.Media class="size-9 translate-y-0! self-center! rounded-md bg-muted">
            <UserIcon class="size-4" />
          </Item.Media>
          <Item.Content class="min-w-0 gap-0.5">
            <Item.Title class="max-w-full truncate">{request.customerName}</Item.Title>
            <Item.Description class="truncate [&>a]:no-underline">
              <a href={`mailto:${request.email}`} class="text-primary hover:underline">
                {request.email}
              </a>
              {#if request.organization}· {request.organization.name}{/if}
            </Item.Description>
          </Item.Content>
          <Item.Actions class="flex-col items-end gap-0.5 text-right">
            <span class="text-sm">{request.submissionDate.toLocaleString(DateTime.DATE_MED)}</span>
            <span class="text-xs text-muted-foreground">{request.submissionDate.toRelative()}</span>
          </Item.Actions>
          <Item.Actions>
            <IconButton icon={UserPenIcon} aria-label="Edit customer" onclick={editCustomer} />
          </Item.Actions>
        </Item.Root>

        <Item.Root size="sm" class="rounded-none border-0 border-b border-border last:border-b-0">
          <Item.Media class="size-9 translate-y-0! self-center! rounded-md bg-muted">
            {#if request.material.colorHex}
              <span
                class="size-5 rounded-full border"
                style={`background-color: ${request.material.colorHex}`}
              ></span>
            {:else}
              <SpoolIcon class="size-4" />
            {/if}
          </Item.Media>
          <Item.Content class="min-w-0 gap-0.5">
            <Item.Title class="max-w-full truncate">{request.material.name}</Item.Title>
            {#if request.materialCost && request.materialCost >= 0}
              <Item.Description>
                {formatPrice(request.materialCost)} material · {request.buildplateCount}
                {request.buildplateCount === 1 ? 'plate' : 'plates'}
              </Item.Description>
            {/if}
          </Item.Content>
        </Item.Root>

        <Item.Root size="sm" class="rounded-none border-0 border-b border-border last:border-b-0">
          <Item.Media class="size-9 translate-y-0! self-center! rounded-md bg-muted">
            <ReceiptIcon class="size-4" />
          </Item.Media>
          <Item.Content class="min-w-0 gap-0.5">
            {#if request.payment}
              <Item.Title>
                <span class="tabular-nums">{formatPrice(request.payment.total)}</span>
                <StatusIndicator display={PAYMENT_STATUS_DISPLAY[request.payment.status]} />
              </Item.Title>
              <Item.Description class="truncate [&>a]:no-underline">
                {billingType} issued {request.payment.issuedDate.toLocaleString(DateTime.DATE_MED)}
                {#if request.billingCode}· <span class="font-mono">{request.billingCode}</span>{/if}
              </Item.Description>
            {:else}
              <Item.Title class="text-muted-foreground"
                >No {billingType.toLowerCase()} yet</Item.Title
              >
              {#if request.billingCode}
                <Item.Description class="font-mono">{request.billingCode}</Item.Description>
              {/if}
            {/if}
          </Item.Content>
          <Item.Actions>
            {#if canEditPayment}
              <IconButton
                icon={TagIcon}
                aria-label="Edit discount code"
                onclick={editDiscountCode}
              />
            {/if}
            {#if request.payment?.squareInvoiceId}
              <IconButton
                icon={ExternalLinkIcon}
                aria-label="View invoice in Square"
                href={`https://app.squareup.com/dashboard/invoices/${request.payment.squareInvoiceId}`}
                target="_blank"
              />
            {/if}
          </Item.Actions>
        </Item.Root>
      </Item.Group>

      {#if request.specialRequests}
        <div class="rounded-lg border-l-4 border-primary bg-muted/40 px-4 py-3">
          <h3 class="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Special Requests
          </h3>
          <p class="text-base whitespace-pre-line">{request.specialRequests}</p>
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet filesPanel()}
  <Section title={`Files (${request?.files.length ?? 0})`}>
    {#snippet actions()}
      {#if quantityEditor.isEditing}
        <Button size="sm" variant="ghost" onclick={() => quantityEditor.cancel()}>Cancel</Button>
        <Button size="sm" onclick={() => quantityEditor.save(requestId)}>
          <CheckIcon />
          Save
        </Button>
      {:else}
        <IconButton
          icon={PencilIcon}
          aria-label="Edit quantities"
          onclick={() => request && quantityEditor.start(request.files)}
        />
        <IconButton icon={DownloadIcon} aria-label="Download files" href={downloadUrl} />
        <IconButton
          icon={MonitorUpIcon}
          aria-label="Open in OrcaSlicer"
          href={slicerUrl}
          class="bg-success/15 text-success hover:bg-success/25 hover:text-success dark:hover:bg-success/25"
        />
      {/if}
    {/snippet}
    <ul class="-my-1 divide-y">
      {#each request?.files ?? [] as file (file.id)}
        <li class="flex min-h-12 items-center gap-3 py-2 text-base">
          <FileBoxIcon class="size-5 shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1 truncate">{file.fileName}</span>
          {#if quantityEditor.isEditing}
            <Input
              type="number"
              inputmode="numeric"
              bind:value={quantityEditor.quantities[file.id]}
              min={1}
              max={999}
              class="h-9 w-20"
            />
          {:else}
            <span
              class={cn(
                'shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums',
                file.quantity > 1 ? 'bg-warning/15 text-warning' : 'bg-muted',
              )}
            >
              ×{file.quantity}
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  </Section>
{/snippet}

{#snippet footerActions()}
  <div class="grid w-full grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
    {#if canCancel}
      <Button
        variant="ghost"
        class="text-destructive hover:text-destructive sm:mr-auto"
        onclick={cancel}
      >
        <XIcon />
        Cancel Request
      </Button>
    {/if}
    {#if request?.status === STATUS.DONE}
      <Button variant="outline" onclick={() => sendPickupEmail(requestId)}>
        <MailIcon />
        Send Pickup Reminder
      </Button>
    {/if}
    {#if canEditPayment || canCreatePayment}
      <Button variant="outline" onclick={openPayment}>
        <DollarSignIcon />
        {canEditPayment ? 'Edit' : 'Create'}
        {billingType}
      </Button>
    {/if}
    {#if request?.status === STATUS.DONE}
      <Button
        disabled={isUpdatingStatus || isAwaitingPayment(request)}
        onclick={() => setStatus(STATUS.PICKED_UP)}
      >
        {#if isUpdatingStatus}<Spinner />{:else}<PackageCheckIcon />{/if}
        {isAwaitingPayment(request) ? 'Awaiting Payment' : 'Mark Picked Up'}
      </Button>
    {/if}
  </div>
{/snippet}

<Modal
  title={request?.projectName ?? 'Print Request'}
  size="full"
  icon={Printer3dIcon}
  onClose={handleClose}
  footer={hasFooterActions ? footerActions : undefined}
  class="flex flex-col gap-4 max-lg:px-3 lg:p-5"
>
  {#snippet headerActions()}
    {#if request}
      <StatusIndicator display={REQUEST_STATUS_DISPLAY[request.status]} size="lg" />
    {/if}
  {/snippet}

  {#if !request}
    <div class="flex justify-center py-10"><Spinner class="size-6" /></div>
  {:else}
    {#if quoteNotice}
      <Alert.Root variant="warning">
        <FileWarningIcon />
        <Alert.Title>{quoteNotice.title}</Alert.Title>
        <Alert.Description>{quoteNotice.description}</Alert.Description>
      </Alert.Root>
    {/if}

    {#if isDesktop.current}
      <div class="grid grid-cols-[3fr_2fr] gap-4">
        <div class="flex min-w-0 flex-col gap-4">
          {@render overviewPanel()}
          {@render filesPanel()}
        </div>
        <div class="flex min-h-[30rem] flex-col">
          <RequestComments {requestId} />
        </div>
      </div>
    {:else}
      <Tabs.Root bind:value={activeTab} class="flex min-h-0 flex-1 flex-col">
        <Tabs.List class="w-full">
          <Tabs.Trigger value={TABS.DETAILS}>Details</Tabs.Trigger>
          <Tabs.Trigger value={TABS.FILES}>Files ({request.files.length})</Tabs.Trigger>
          <Tabs.Trigger value={TABS.COMMENTS}>Comments ({commentCount})</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value={TABS.DETAILS}>{@render overviewPanel()}</Tabs.Content>
        <Tabs.Content value={TABS.FILES}>{@render filesPanel()}</Tabs.Content>
        <Tabs.Content value={TABS.COMMENTS} class="flex min-h-[60dvh] flex-col">
          <RequestComments {requestId} />
        </Tabs.Content>
      </Tabs.Root>
    {/if}
  {/if}
</Modal>
