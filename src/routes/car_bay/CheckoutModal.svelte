<script lang="ts">
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import {
    CHECKOUT_STEPS,
    CarBayBookingForm,
    type CheckoutStep,
  } from '$lib/frontend/car-bay-booking-form.svelte';
  import CarBayBookingFields from '$lib/frontend/components/CarBayBookingFields.svelte';
  import CarBayBookingReview from './CarBayBookingReview.svelte';
  import StepProgress from '$lib/frontend/components/StepProgress.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import SquareCardField from '$lib/frontend/components/SquareCardField.svelte';
  import { SquarePayment } from '$lib/frontend/square-payment.svelte';
  import { bookCarBay, getCarBayMembership } from '$lib/remotes/endpoints/car_bay.remote';
  import {
    formatDollars,
    type CarBayBlock,
    type CarBayRates,
    type CarBayRules,
    type CarBayTier,
  } from '$lib/utils/car_bay';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
  import CarIcon from '@lucide/svelte/icons/car';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { untrack } from 'svelte';

  interface Props extends ModalProps {
    tier: CarBayTier;
    date: string;
    startHour: number;
    bookings: () => CarBayBlock[];
    rates: CarBayRates;
    rules: CarBayRules;
    onUnavailable: () => Promise<void>;
  }

  let { onClose, tier, date, startHour, bookings, rates, rules, onUnavailable }: Props = $props();

  const FORM_ID = 'car-bay-checkout';

  const STEP_LIST: { id: CheckoutStep; label: string }[] = [
    { id: CHECKOUT_STEPS.DETAILS, label: 'Your booking' },
    { id: CHECKOUT_STEPS.PAYMENT, label: 'Review & pay' },
  ];

  const form: CarBayBookingForm = untrack(
    () =>
      new CarBayBookingForm(
        {
          bookings: () => bookings(),
          rates: () => rates,
          rules,
          enforceHorizon: true,
          membership: () => membershipQuery?.current,
        },
        { tier, date, startHour },
      ),
  );

  const membershipQuery = $derived(
    form.checkedEmail ? getCarBayMembership(form.checkedEmail) : undefined,
  );

  const payment = new SquarePayment();

  function goBack() {
    payment.reset();
    form.back();
  }

  async function book(sourceId: string) {
    try {
      const booking = await bookCarBay({ request: form.request, ...form.customer(), sourceId });
      onClose();
      await goto(`/car_bay/booking/${booking.bookingToken}`);
    } catch (error) {
      await onUnavailable();
      throw error;
    }
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!form.canSubmit) return;
    await payment.pay(book, 'Booking failed');
  }
</script>

<Modal title="Book the Car Bay" icon={CarIcon} {onClose}>
  <form id={FORM_ID} class="flex flex-col gap-4" onsubmit={handleSubmit}>
    <StepProgress steps={STEP_LIST} current={form.step} />

    {#if form.step === CHECKOUT_STEPS.DETAILS}
      <CarBayBookingFields {form} />
    {:else}
      <CarBayBookingReview {form} />

      <Section title="Payment">
        <SquareCardField {payment} />
        <p class="text-xs text-muted-foreground">
          Cancel at least {rules.policy.refundCutoffHours} hours before your start time and we refund
          you in full. Later cancellations and no-shows don't get a refund.
        </p>
      </Section>
    {/if}
  </form>

  {#snippet footer()}
    <div class="flex w-full items-center justify-between gap-3">
      <p class="text-base font-semibold">
        {form.membershipPending && form.step === CHECKOUT_STEPS.PAYMENT
          ? 'Checking membership…'
          : `Total: ${formatDollars(form.total)}`}
      </p>
      <div class="flex gap-2">
        {#if form.step === CHECKOUT_STEPS.DETAILS}
          <Button disabled={!form.canContinue} onclick={() => form.next()}>
            Continue
            <ArrowRightIcon />
          </Button>
        {:else}
          <Button variant="outline" disabled={payment.paying} onclick={goBack}>
            <ArrowLeftIcon />
            Back
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            disabled={payment.paying || !payment.ready || !form.canSubmit}
          >
            {#if payment.paying}<Spinner />{:else}<CheckIcon />{/if}
            Confirm & Pay
          </Button>
        {/if}
      </div>
    </div>
  {/snippet}
</Modal>
