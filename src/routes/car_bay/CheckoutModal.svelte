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
  import CarBayBookingReview from '$lib/frontend/components/CarBayBookingReview.svelte';
  import StepIndicator from '$lib/frontend/components/StepIndicator.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { errorDescription } from '$lib/frontend/form-submit';
  import { squareCard, type SquareCard } from '$lib/frontend/square-card';
  import { bookCarBay, getCarBayMembership } from '$lib/remotes/endpoints/car_bay.remote';
  import { getSquareConfig } from '$lib/remotes/endpoints/class.remote';
  import {
    formatDollars,
    type CarBayPeriod,
    type CarBayRates,
    type CarBayRules,
    type CarBayTier,
  } from '$lib/utils/car_bay';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
  import CarIcon from '@lucide/svelte/icons/car';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';

  interface Props extends ModalProps {
    tier: CarBayTier;
    date: string;
    startHour: number;
    bookings: () => CarBayPeriod[];
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

  const squareConfig = $derived(getSquareConfig().current);

  let card = $state<SquareCard>();
  let submitting = $state(false);

  function goBack() {
    card = undefined;
    form.back();
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!card || !form.canSubmit) return;

    submitting = true;
    try {
      const tokenResult = await card.tokenize();
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        toast.error('Payment card error. Please check your card details.');
        return;
      }

      const booking = await bookCarBay({
        request: form.request,
        ...form.customer(),
        sourceId: tokenResult.token,
      });
      onClose();
      await goto(`/car_bay/booking/${booking.bookingToken}`);
    } catch (error) {
      toast.error('Booking failed', { description: errorDescription(error) });
      await onUnavailable();
    } finally {
      submitting = false;
    }
  }
</script>

<Modal title="Book the Car Bay" icon={CarIcon} {onClose}>
  <form id={FORM_ID} class="flex flex-col gap-4" onsubmit={handleSubmit}>
    <StepIndicator steps={STEP_LIST} current={form.step} />

    {#if form.step === CHECKOUT_STEPS.DETAILS}
      <CarBayBookingFields {form} />
    {:else}
      <CarBayBookingReview {form} />

      <Section title="Payment">
        {#if squareConfig}
          <div {@attach squareCard(squareConfig, (created) => (card = created))}></div>
        {/if}
        {#if !card}
          <div
            class="flex h-24 items-center justify-center rounded-lg border"
            aria-label="Loading payment form"
          >
            <Spinner class="size-5 text-muted-foreground" />
          </div>
        {/if}
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
          <Button variant="outline" disabled={submitting} onclick={goBack}>
            <ArrowLeftIcon />
            Back
          </Button>
          <Button type="submit" form={FORM_ID} disabled={submitting || !card || !form.canSubmit}>
            {#if submitting}<Spinner />{:else}<CheckIcon />{/if}
            Confirm & Pay
          </Button>
        {/if}
      </div>
    </div>
  {/snippet}
</Modal>
