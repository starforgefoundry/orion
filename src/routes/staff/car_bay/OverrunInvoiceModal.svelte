<script lang="ts">
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { getCarBayRates } from '$lib/remotes/endpoints/settings.remote';
  import { CAR_BAY_OVERRUN, formatDollars, type CarBayOverrun } from '$lib/utils/car_bay';
  import ReceiptIcon from '@lucide/svelte/icons/receipt';
  import SendIcon from '@lucide/svelte/icons/send';
  import { untrack } from 'svelte';
  import { OverrunInvoice } from './overrun-invoice.svelte';

  interface Props extends ModalProps {
    bookingId: string;
    bookingEndDate: string;
    isMember: boolean;
  }

  let { onClose, bookingId, bookingEndDate, isMember }: Props = $props();

  const invoice = untrack(
    () => new OverrunInvoice({ id: bookingId, endDate: bookingEndDate, isMember }),
  );
  const rates = $derived(getCarBayRates().current);
  const lineItems = $derived(rates ? invoice.lineItems(rates) : []);

  let submitting = $state(false);

  async function handleSubmit() {
    submitting = true;
    const ok = await submitWithToast(() => invoice.send(), {
      success: 'Invoice sent',
      error: 'Failed to send invoice',
    });
    submitting = false;
    if (ok) onClose();
  }
</script>

<ModalForm
  title="Send Overrun Invoice"
  icon={ReceiptIcon}
  {onClose}
  submitLabel="Send Invoice"
  submitIcon={SendIcon}
  canSubmit={lineItems.length > 0}
  {submitting}
  onSubmit={handleSubmit}
>
  <ToggleGroup.Root
    type="single"
    variant="outline"
    value={invoice.kind}
    onValueChange={(value) => value && (invoice.kind = value as CarBayOverrun['kind'])}
  >
    <ToggleGroup.Item value={CAR_BAY_OVERRUN.HOURLY}>While open</ToggleGroup.Item>
    <ToggleGroup.Item value={CAR_BAY_OVERRUN.OVERNIGHT}>Past closing</ToggleGroup.Item>
  </ToggleGroup.Root>

  {#if invoice.kind === CAR_BAY_OVERRUN.HOURLY}
    <FormField label="Hours over" description="Round any partial hour up">
      <NumberStepper bind:value={invoice.hours} min={1} />
    </FormField>
  {:else}
    <FormField label="Nights" description="Each night is a flat overnight fee">
      <NumberStepper bind:value={invoice.nights} min={1} />
    </FormField>
    <FormField
      label="Extra days"
      description="Days after the booking the car stayed into, billed at that day's Full Day rate"
    >
      <NumberStepper bind:value={invoice.extraDays} min={0} max={invoice.nights} />
    </FormField>
  {/if}

  <ul class="flex flex-col gap-1 text-sm">
    {#each lineItems as item (item.name)}
      <li class="flex justify-between gap-3">
        <span class="text-muted-foreground">
          {item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}
        </span>
        <span class="tabular-nums">{formatDollars(item.quantity * item.unitAmount)}</span>
      </li>
    {/each}
    {#if rates}
      <li class="flex justify-between gap-3 border-t pt-1 font-semibold">
        <span>Total</span>
        <span class="tabular-nums">{formatDollars(invoice.total(rates))}</span>
      </li>
    {/if}
  </ul>

  <p class="text-xs text-muted-foreground">
    Square emails the invoice to the customer at the {isMember ? 'member' : 'non-member'} rate.
  </p>
</ModalForm>
