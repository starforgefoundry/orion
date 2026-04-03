<script lang="ts">
  import { goto } from '$app/navigation';
  import { env } from '$env/dynamic/public';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { formatTime } from '$lib/frontend/utils';
  import { bookClass, bookClassForm, getSquareConfig } from '$lib/remotes/endpoints/class.remote';
  import { Button, Field, HStack, Modal, ModalBody, Stack, Text, toastManager } from '@immich/ui';
  import { mdiCalendar, mdiCheck } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { onMount } from 'svelte';

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

  let cardInstance: any = $state(null);
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

  $effect(() => {
    bookClassForm.fields.quantity.set(quantity);
  });

  onMount(() => {
    if ((window as any).Square) {
      initializeSquare();
    } else {
      const script = document.createElement('script');

      if (env.PUBLIC_ENV === 'dev') {
        script.src = 'https://sandbox.web.squarecdn.com/v1/square.js';
      } else {
        script.src = 'https://web.squarecdn.com/v1/square.js';
      }

      script.onload = () => initializeSquare();
      document.head.appendChild(script);
    }
  });

  async function initializeSquare() {
    if (!(window as any).Square || !squareConfig) return;

    try {
      const payments = (window as any).Square.payments(
        squareConfig.applicationId,
        squareConfig.locationId,
      );
      cardInstance = await payments.card({
        style: {
          '.input-container': {
            borderColor: '#4b5563',
            borderRadius: '8px',
          },
          '.input-container.is-focus': {
            borderColor: '#9ca3af',
          },
          '.input-container.is-error': {
            borderColor: '#ef4444',
          },

          '.message-text': {
            color: '#9ca3af',
          },
          '.message-text.is-error': {
            color: '#ef4444',
          },
          '.message-icon': {
            color: '#9ca3af',
          },
          '.message-icon.is-error': {
            color: '#ef4444',
          },
        },
      });
      await cardInstance.attach('#card-container');
      squareReady = true;
    } catch (err) {
      console.error('Failed to initialize Square payments:', err);
    }
  }

  $effect(() => {
    if (squareConfig && (window as any).Square && !cardInstance) {
      initializeSquare();
    }
  });

  type SubmitParameters = Parameters<Parameters<typeof bookClassForm.enhance>[0]>[0];
  async function handleSubmit(params: SubmitParameters) {
    if (!cardInstance) {
      toastManager.danger('Payment form not ready. Please wait and try again.');
      return;
    }

    submitting = true;

    try {
      const tokenResult = await cardInstance.tokenize();
      if (tokenResult.status !== 'OK') {
        toastManager.danger('Payment card error. Please check your card details.');
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
      toastManager.danger(error?.message ?? 'Failed to book class');
    } finally {
      submitting = false;
    }
  }
</script>

<Modal title="Book {catalogName}" icon={mdiCalendar} {onClose}>
  <ModalBody>
    <form {...bookClassForm.enhance(handleSubmit)}>
      <input {...bookClassForm.fields.instanceId.as('text')} hidden />
      <input {...bookClassForm.fields.sourceId.as('text')} hidden />
      <input {...bookClassForm.fields.quantity.as('number')} hidden />

      <Stack gap={4}>
        <div class="rounded-lg border border-gray-600 p-3 text-center">
          <Text fontWeight="bold">{formattedDate}</Text>
          <Text color="muted" size="small">
            {formatTime(startTime)} ({durationMinutes} min)
          </Text>
        </div>

        <Field label="Full Name" required="indicator">
          <TextInput {...bookClassForm.fields.customerName.as('text')} placeholder="John Doe" />
        </Field>

        <Field label="Email" required="indicator">
          <TextInput
            {...bookClassForm.fields.customerEmail.as('text')}
            type="email"
            placeholder="john@example.com"
          />
        </Field>

        <Field label="Phone Number" required="indicator">
          <TextInput
            {...bookClassForm.fields.customerPhone.as('text')}
            type="tel"
            placeholder="(555) 123-4567"
          />
        </Field>

        <div class="flex items-center justify-between">
          <Text>Attendees</Text>
          <NumberStepper bind:value={quantity} min={1} max={availableSpots} />
        </div>

        <Field label="Payment">
          <div id="card-container"></div>
          {#if !squareReady}
            <Text size="small" color="muted" class="mt-1">Loading payment form...</Text>
          {/if}
        </Field>

        <HStack class="items-center justify-between">
          <div>
            <Text fontWeight="bold" class="text-lg">
              Total: ${(totalPrice / 100).toFixed(2)}
            </Text>
            {#if quantity > 1}
              <Text size="small" color="muted">
                ${(price / 100).toFixed(2)} x {quantity}
              </Text>
            {/if}
          </div>
          <Button
            type="submit"
            color="success"
            leadingIcon={mdiCheck}
            loading={submitting}
            disabled={submitting || !squareReady}
          >
            Confirm & Pay
          </Button>
        </HStack>
      </Stack>
    </form>
  </ModalBody>
</Modal>
