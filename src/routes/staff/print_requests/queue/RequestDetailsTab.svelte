<script lang="ts">
  import * as Item from '$lib/components/ui/item';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import { formatDate } from '$lib/frontend/format';
  import { PAYMENT_STATUS_DISPLAY } from '$lib/frontend/payment-status';
  import { formatCents } from '$lib/utils/billing';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import LinkIcon from '@lucide/svelte/icons/link';
  import ReceiptIcon from '@lucide/svelte/icons/receipt';
  import SpoolIcon from '@lucide/svelte/icons/spool';
  import TagIcon from '@lucide/svelte/icons/tag';
  import UserIcon from '@lucide/svelte/icons/user';
  import UserPenIcon from '@lucide/svelte/icons/user-pen';
  import StatusIndicator from './StatusIndicator.svelte';
  import type { PrintRequestDetail, RequestDetail } from './request-detail.svelte';

  type Props = { detail: RequestDetail; request: PrintRequestDetail };

  let { detail, request }: Props = $props();
</script>

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
        <span class="text-sm">{formatDate(request.submissionDate)}</span>
        <span class="text-xs text-muted-foreground">{request.submissionDate.toRelative()}</span>
      </Item.Actions>
      <Item.Actions>
        <IconButton
          icon={UserPenIcon}
          aria-label="Edit customer"
          onclick={() => detail.editCustomer()}
        />
      </Item.Actions>
    </Item.Root>

    <div class="grid sm:grid-cols-2">
      <Item.Root
        size="sm"
        class="rounded-none border-0 border-b border-border sm:border-r sm:border-b-0"
      >
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
              {formatCents(request.materialCost)} material · {request.buildplateCount}
              {request.buildplateCount === 1 ? 'plate' : 'plates'}
            </Item.Description>
          {/if}
        </Item.Content>
      </Item.Root>

      <Item.Root size="sm" class="rounded-none border-0">
        <Item.Media class="size-9 translate-y-0! self-center! rounded-md bg-muted">
          <ReceiptIcon class="size-4" />
        </Item.Media>
        <Item.Content class="min-w-0 gap-0.5">
          {#if request.payment}
            <Item.Title>
              <span class="tabular-nums">{formatCents(request.payment.total)}</span>
              <StatusIndicator display={PAYMENT_STATUS_DISPLAY[request.payment.status]} />
            </Item.Title>
            <Item.Description class="truncate [&>a]:no-underline">
              {detail.billingType} issued {formatDate(request.payment.issuedDate)}
              {#if request.billingCode}· <span class="font-mono">{request.billingCode}</span>{/if}
            </Item.Description>
          {:else}
            <Item.Title class="text-muted-foreground"
              >No {detail.billingType.toLowerCase()} yet</Item.Title
            >
            {#if request.billingCode}
              <Item.Description class="font-mono">{request.billingCode}</Item.Description>
            {/if}
          {/if}
        </Item.Content>
        <Item.Actions>
          {#if detail.canEditPayment}
            <IconButton
              icon={TagIcon}
              aria-label="Edit group code"
              onclick={() => detail.editDiscountCode()}
            />
          {/if}
          <IconButton
            icon={LinkIcon}
            aria-label="Open customer status page"
            href={detail.statusPageUrl}
            target="_blank"
          />
          {#if detail.squareInvoiceUrl}
            <IconButton
              icon={ExternalLinkIcon}
              aria-label="View invoice in Square"
              href={detail.squareInvoiceUrl}
              target="_blank"
            />
          {/if}
        </Item.Actions>
      </Item.Root>
    </div>
  </Item.Group>

  {#if request.specialRequests}
    <Section title="Special Requests">
      <p class="text-base whitespace-pre-line">{request.specialRequests}</p>
    </Section>
  {/if}
</div>
