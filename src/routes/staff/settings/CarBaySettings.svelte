<script lang="ts" module>
  import { CENTS_PER_DOLLAR } from '$lib/utils/billing';
  import {
    formatHour,
    type CarBayPolicy,
    type CarBayRates,
    type PricePair,
  } from '$lib/utils/car_bay';

  type PairKey = {
    [K in keyof CarBayRates]: CarBayRates[K] extends PricePair ? K : never;
  }[keyof CarBayRates];

  type HourKey = 'weekdayOpenHour' | 'weekendOpenHour' | 'weekdayCloseHour' | 'weekendCloseHour';
  type CountKey = Exclude<keyof CarBayPolicy, HourKey>;

  type CountField = { key: CountKey; label: string; unit: string; description?: string };

  const HOURS_IN_DAY = 24;

  const HOUR_ROWS: { label: string; open: HourKey; close: HourKey }[] = [
    { label: 'Weekdays', open: 'weekdayOpenHour', close: 'weekdayCloseHour' },
    { label: 'Weekends', open: 'weekendOpenHour', close: 'weekendCloseHour' },
  ];

  const LENGTH_FIELDS: CountField[] = [
    { key: 'quickJobMinutes', label: 'Quick Job length', unit: 'minutes' },
    { key: 'hourlyMinHours', label: 'Hourly minimum', unit: 'hours' },
    { key: 'fullDayMaxDays', label: 'Full Day maximum', unit: 'days' },
    {
      key: 'bufferMinutes',
      label: 'Turnover buffer',
      unit: 'minutes',
      description: 'Applies to bookings made after you change it',
    },
  ];

  const WINDOW_FIELDS: CountField[] = [
    { key: 'publicHorizonDays', label: 'Book ahead', unit: 'days' },
    { key: 'refundCutoffHours', label: 'Full refund until', unit: 'hours before start' },
    { key: 'reminderLeadHours', label: 'Reminder email', unit: 'hours before start' },
    { key: 'storageDays', label: 'Vehicle storage', unit: 'days from start' },
  ];

  const PAIR_FIELDS: { key: PairKey; label: string; description?: string }[] = [
    { key: 'quickJob', label: 'Quick Job', description: 'Flat rate per booking' },
    { key: 'hourly', label: 'Hourly', description: 'Per hour' },
    { key: 'fullDayWeekday', label: 'Full Day (Weekday)' },
    { key: 'fullDayWeekend', label: 'Full Day (Weekend)' },
    { key: 'overrunHourly', label: 'Overrun', description: 'Per hour or partial hour while open' },
    {
      key: 'overnightFee',
      label: 'Overnight fee',
      description: 'Per night, past closing and between multi-day Full Day bookings',
    },
  ];

  const HOUR_OPTIONS = Array.from({ length: HOURS_IN_DAY }, (_, hour) => ({
    value: hour.toString(),
    label: formatHour(hour),
  }));
</script>

<script lang="ts">
  import * as Table from '$lib/components/ui/table';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { setCarBayPolicy, setCarBayRates } from '$lib/remotes/endpoints/settings.remote';
  import { untrack } from 'svelte';

  interface Props {
    rates: CarBayRates;
    policy: CarBayPolicy;
    formId?: string;
  }

  let { rates, policy, formId = 'car-bay-settings' }: Props = $props();

  const fieldId = $props.id();

  let draftRates = $state(untrack(() => $state.snapshot(rates)));
  let draftPolicy = $state(untrack(() => $state.snapshot(policy)));

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    await submitWithToast(
      () => Promise.all([setCarBayPolicy(draftPolicy), setCarBayRates(draftRates)]),
      { success: 'Car bay settings saved', error: 'Error saving car bay settings' },
    );
  }
</script>

{#snippet countFields(fields: CountField[])}
  <div class="grid gap-4 sm:grid-cols-2">
    {#each fields as field (field.key)}
      <FormField
        label={field.label}
        for="{fieldId}-{field.key}"
        description={field.description ?? field.unit}
      >
        <TextInput
          id="{fieldId}-{field.key}"
          type="number"
          min="0"
          step="1"
          bind:value={draftPolicy[field.key]}
        />
      </FormField>
    {/each}
  </div>
{/snippet}

<form id={formId} class="flex flex-col gap-8" onsubmit={handleSubmit}>
  <section class="flex flex-col gap-4">
    <h3 class="text-sm font-semibold">Open hours</h3>
    <div class="overflow-x-auto rounded-lg border">
      <Table.Root class="min-w-[24rem]">
        <Table.Header>
          <Table.Row class="bg-muted/50">
            <Table.Head></Table.Head>
            <Table.Head class="w-40">Opens</Table.Head>
            <Table.Head class="w-40">Closes</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each HOUR_ROWS as row (row.label)}
            <Table.Row>
              <Table.Cell class="font-medium">{row.label}</Table.Cell>
              {#each [row.open, row.close] as key (key)}
                <Table.Cell>
                  <OptionSelect
                    options={HOUR_OPTIONS}
                    value={draftPolicy[key].toString()}
                    onValueChange={(value) => (draftPolicy[key] = Number(value))}
                  />
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  </section>

  <section class="flex flex-col gap-4">
    <h3 class="text-sm font-semibold">Booking lengths</h3>
    {@render countFields(LENGTH_FIELDS)}
  </section>

  <section class="flex flex-col gap-4">
    <h3 class="text-sm font-semibold">Booking window</h3>
    {@render countFields(WINDOW_FIELDS)}
  </section>

  <section class="flex flex-col gap-4">
    <h3 class="text-sm font-semibold">Rates</h3>
    <div class="overflow-x-auto rounded-lg border">
      <Table.Root class="min-w-[32rem]">
        <Table.Header>
          <Table.Row class="bg-muted/50">
            <Table.Head>Charge</Table.Head>
            <Table.Head class="w-40">Member</Table.Head>
            <Table.Head class="w-40">Non-member</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each PAIR_FIELDS as field (field.key)}
            <Table.Row>
              <Table.Cell>
                <div class="font-medium">{field.label}</div>
                {#if field.description}
                  <div class="text-xs text-muted-foreground">{field.description}</div>
                {/if}
              </Table.Cell>
              <Table.Cell>
                <PriceInput
                  bind:value={draftRates[field.key].member}
                  multiplier={CENTS_PER_DOLLAR}
                />
              </Table.Cell>
              <Table.Cell>
                <PriceInput
                  bind:value={draftRates[field.key].nonMember}
                  multiplier={CENTS_PER_DOLLAR}
                />
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  </section>
</form>
