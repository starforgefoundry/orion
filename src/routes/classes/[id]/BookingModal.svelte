<script lang="ts">
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { formatTime } from '$lib/frontend/utils';
  import { squareCard, type SquareCard } from '$lib/frontend/square-card';
  import { bookClass, bookClassForm, getSquareConfig } from '$lib/remotes/endpoints/class.remote';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { DateTime } from 'luxon';
  import { toast } from 'svelte-sonner';

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

  const formattedDate = (() => DateTime.fromISO(date).toFormat('EEEE, MMMM d, yyyy'))();

  let quantity = $state(1);
  let submitting = $state(false);

  let cardInstance = $state<SquareCard>();
  let squareReady = $state(false);

  const squareConfigRemote = getSquareConfig();
  const squareConfig = $derived(squareConfigRemote.current);

  const totalPrice = $derived(price * quantity);

  initForm(bookClassForm, () => ({
    instanceId,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    quantity: 1,
    sourceId: '',
  }));

  type SubmitParameters = Parameters<Parameters<typeof bookClassForm.enhance>[0]>[0];
  async function handleSubmit(params: SubmitParameters) {
    if (!cardInstance) {
      toast.error('Payment form not ready. Please wait and try again.');
      return;
    }

    submitting = true;

    try {
      const tokenResult = await cardInstance.tokenize();
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        toast.error('Payment card error. Please check your card details.');
        submitting = false;
        return;
      }

      const booking = await bookClass({
        ...params.data,
        sourceId: tokenResult.token,
      });

      if (booking) {
        onClose();
        await goto(`/classes/booking/${booking.bookingToken}`);
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to book class');
    } finally {
      submitting = false;
    }
  }
</script>

<Modal title="Book {catalogName}" icon={CalendarIcon} {onClose}>
  <form id={FORM_ID} {...bookClassForm.enhance(handleSubmit)} class="flex flex-col gap-4">
    <input {...bookClassForm.fields.instanceId.as('text')} hidden />
    <input {...bookClassForm.fields.sourceId.as('text')} hidden />
    <input {...bookClassForm.fields.quantity.as('number')} value={quantity} hidden />

    <div class="rounded-lg border bg-muted/50 p-3 text-center">
      <p class="text-sm font-medium">{formattedDate}</p>
      <p class="text-xs text-muted-foreground">
        {formatTime(startTime)} ({durationMinutes} min)
      </p>
    </div>

    <FormField label="Full Name" required>
      <TextInput {...bookClassForm.fields.customerName.as('text')} placeholder="John Doe" />
    </FormField>

    <FormField label="Email" required>
      <TextInput
        {...bookClassForm.fields.customerEmail.as('text')}
        type="email"
        placeholder="john@example.com"
      />
    </FormField>

    <FormField label="Phone Number" required>
      <TextInput
        {...bookClassForm.fields.customerPhone.as('text')}
        type="tel"
        placeholder="(555) 123-4567"
      />
    </FormField>

    <div class="flex items-center justify-between gap-2">
      <span class="text-sm font-medium">Attendees</span>
      <NumberStepper bind:value={quantity} min={1} max={availableSpots} />
    </div>

    <FormField label="Payment">
      {#if squareConfig}
        <div
          id="card-container"
          {@attach squareCard(squareConfig, (card) => {
            cardInstance = card;
            squareReady = true;
          })}
        ></div>
      {/if}
      {#if !squareReady}
        <div
          class="flex h-24 items-center justify-center rounded-lg border"
          aria-label="Loading payment form"
        >
          <Spinner class="size-5 text-muted-foreground" />
        </div>
      {/if}
    </FormField>
  </form>

  {#snippet footer()}
    <div class="flex w-full items-center justify-between gap-3">
      <div>
        <p class="text-base font-semibold">Total: ${(totalPrice / 100).toFixed(2)}</p>
        {#if quantity > 1}
          <p class="text-xs text-muted-foreground">
            ${(price / 100).toFixed(2)} x {quantity}
          </p>
        {/if}
      </div>
      <Button type="submit" form={FORM_ID} disabled={submitting || !squareReady}>
        {#if submitting}<Spinner />{:else}<CheckIcon />{/if}
        Confirm & Pay
      </Button>
    </div>
  {/snippet}
</Modal>
