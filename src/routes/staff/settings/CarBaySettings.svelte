<script lang="ts" module>
  import type { CarBayRates, PricePair } from '$lib/utils/car_bay';

  type PairKey = {
    [K in keyof CarBayRates]: CarBayRates[K] extends PricePair ? K : never;
  }[keyof CarBayRates];

  const CENTS_PER_DOLLAR = 100;

  const PAIR_FIELDS: { key: PairKey; label: string; description?: string }[] = [
    { key: 'quickJob', label: 'Quick Job', description: 'Flat rate for the 90 minute slot' },
    { key: 'hourly', label: 'Hourly', description: 'Per hour' },
    { key: 'fullDayWeekday', label: 'Full Day (Weekday)' },
    { key: 'fullDayWeekend', label: 'Full Day (Weekend)' },
    { key: 'overrunHourly', label: 'Overrun', description: 'Per hour or partial hour while open' },
  ];
</script>

<script lang="ts">
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { setCarBayRates } from '$lib/remotes/endpoints/settings.remote';
  import { untrack } from 'svelte';

  interface Props {
    rates: CarBayRates;
    formId?: string;
  }

  let { rates, formId = 'car-bay-settings' }: Props = $props();

  let draft = $state(untrack(() => $state.snapshot(rates)));

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    await submitWithToast(() => setCarBayRates(draft), {
      success: 'Car bay rates saved',
      error: 'Error saving rates',
    });
  }
</script>

<form id={formId} class="flex flex-col gap-5" onsubmit={handleSubmit}>
  {#each PAIR_FIELDS as field (field.key)}
    <FormField label={field.label} description={field.description}>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Member</span>
          <PriceInput bind:value={draft[field.key].member} multiplier={CENTS_PER_DOLLAR} />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Non-member</span>
          <PriceInput bind:value={draft[field.key].nonMember} multiplier={CENTS_PER_DOLLAR} />
        </div>
      </div>
    </FormField>
  {/each}

  <FormField
    label="Overnight Fee"
    description="Per night, for overruns past closing and between multi-day Full Day bookings"
  >
    <PriceInput bind:value={draft.overnightFee} multiplier={CENTS_PER_DOLLAR} />
  </FormField>
</form>
