<script lang="ts">
  import { CLASS_DATE_FORMAT } from '$lib/utils/classes';
  import { formatCents } from '$lib/utils/billing';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { formatTime } from '$lib/frontend/utils';
  import SquareCardField from '$lib/frontend/components/SquareCardField.svelte';
  import { SquarePayment } from '$lib/frontend/square-payment.svelte';
  import { bookClass } from '$lib/remotes/endpoints/class.remote';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { DateTime } from 'luxon';

  const FORM_ID = 'book-class-form';

  interface Props extends ModalProps {
    catalogName: string;
    price: number;
    instanceId: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    availableSpots: number;
  }

  let {
    onClose,
    catalogName,
    price,
    instanceId,
    date,
    startTime,
    durationMinutes,
    availableSpots,
  }: Props = $props();

  const formattedDate = $derived(DateTime.fromISO(date).toFormat(CLASS_DATE_FORMAT));

  let quantity = $state(1);

  const payment = new SquarePayment();

  const totalPrice = $derived(price * quantity);

  const customer = $state({ customerName: '', customerEmail: '', customerPhone: '' });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    await payment.pay(async (sourceId) => {
      const booking = await bookClass({ ...customer, instanceId, quantity, sourceId });
      onClose();
      await goto(`/classes/booking/${booking.bookingToken}`);
    }, 'Failed to book class');
  }
</script>

<Modal title="Book {catalogName}" icon={CalendarIcon} {onClose}>
  <form id={FORM_ID} onsubmit={handleSubmit} class="flex flex-col gap-4">
    <div class="rounded-lg border bg-muted/50 p-3 text-center">
      <p class="text-sm font-medium">{formattedDate}</p>
      <p class="text-xs text-muted-foreground">
        {formatTime(startTime)} ({durationMinutes} min)
      </p>
    </div>

    <FormField label="Full Name" required>
      <TextInput bind:value={customer.customerName} placeholder="John Doe" required />
    </FormField>

    <FormField label="Email" required>
      <TextInput
        bind:value={customer.customerEmail}
        type="email"
        placeholder="john@example.com"
        required
      />
    </FormField>

    <FormField label="Phone Number" required>
      <TextInput
        bind:value={customer.customerPhone}
        type="tel"
        placeholder="(555) 123-4567"
        required
      />
    </FormField>

    <div class="flex items-center justify-between gap-2">
      <span class="text-sm font-medium">Attendees</span>
      <NumberStepper bind:value={quantity} min={1} max={availableSpots} />
    </div>

    <FormField label="Payment">
      <SquareCardField {payment} />
    </FormField>
  </form>

  {#snippet footer()}
    <div class="flex w-full items-center justify-between gap-3">
      <div>
        <p class="text-base font-semibold">Total: {formatCents(totalPrice)}</p>
        {#if quantity > 1}
          <p class="text-xs text-muted-foreground">
            {formatCents(price)} x {quantity}
          </p>
        {/if}
      </div>
      <Button type="submit" form={FORM_ID} disabled={payment.paying || !payment.ready}>
        {#if payment.paying}<Spinner />{:else}<CheckIcon />{/if}
        Confirm & Pay
      </Button>
    </div>
  {/snippet}
</Modal>
