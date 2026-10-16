<script lang="ts">
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import type { CarBayBookingForm } from '$lib/frontend/car-bay-booking-form.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect, {
    type SelectOption,
  } from '$lib/frontend/components/form/OptionSelect.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import {
    CAR_BAY_TIER,
    CAR_BAY_TIER_NAMES,
    formatPeriod,
    type CarBayTier,
  } from '$lib/utils/car_bay';
  import { DateTime } from 'luxon';

  interface Props {
    form: CarBayBookingForm;
    /** Staff pick the tier and date in the form; customers pick them on the calendar. */
    editableSchedule?: boolean;
  }

  let { form, editableSchedule = false }: Props = $props();

  const fieldId = $props.id();

  const tierOptions: SelectOption[] = Object.values(CAR_BAY_TIER).map((tier) => ({
    value: tier,
    label: CAR_BAY_TIER_NAMES[tier],
  }));

  const showsStartTime = $derived(
    form.tier === CAR_BAY_TIER.HOURLY || (editableSchedule && form.tier === CAR_BAY_TIER.QUICK_JOB),
  );

  function hourOption(hour: number): SelectOption {
    return { value: hour.toString(), label: DateTime.fromObject({ hour }).toFormat('h:mm a') };
  }

  function countOptions(counts: number[], unit: string): SelectOption[] {
    return counts.map((count) => ({
      value: count.toString(),
      label: `${count} ${unit}${count === 1 ? '' : 's'}`,
    }));
  }
</script>

<div class="flex flex-col gap-4">
  <Section title="When">
    <div class="flex flex-col gap-4">
      {#if editableSchedule}
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="Booking type" required>
            <OptionSelect
              options={tierOptions}
              value={form.tier}
              onValueChange={(value) => (form.tier = value as CarBayTier)}
            />
          </FormField>
          <FormField label="Date" for="{fieldId}-date" required>
            <TextInput id="{fieldId}-date" type="date" bind:value={form.date} />
          </FormField>
        </div>
      {/if}

      {#if showsStartTime}
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="Start time" required>
            <OptionSelect
              options={form.startHourOptions.map(hourOption)}
              value={form.startHour.toString()}
              placeholder="No open times"
              onValueChange={(value) => (form.startHour = Number(value))}
            />
          </FormField>
          {#if form.tier === CAR_BAY_TIER.HOURLY}
            <FormField label="Hours" required>
              <OptionSelect
                options={countOptions(form.hourOptions, 'hour')}
                value={form.hours.toString()}
                placeholder="Not available"
                onValueChange={(value) => (form.hours = Number(value))}
              />
            </FormField>
          {/if}
        </div>
      {/if}

      {#if form.tier === CAR_BAY_TIER.FULL_DAY}
        <FormField label="Days" description="Each day is billed at its own rate." required>
          <OptionSelect
            options={countOptions(form.dayOptions, 'day')}
            value={form.days.toString()}
            placeholder="Not available"
            onValueChange={(value) => (form.days = Number(value))}
          />
        </FormField>
      {/if}

      <div class="rounded-md bg-muted/60 px-3 py-2">
        <p class="text-sm font-medium">{CAR_BAY_TIER_NAMES[form.tier]}</p>
        {#if form.period}
          <p class="text-sm text-muted-foreground">{formatPeriod(form.period)}</p>
        {:else}
          <p class="text-sm text-destructive">This time isn't open. Pick another one.</p>
        {/if}
      </div>
    </div>
  </Section>

  <Section title={editableSchedule ? 'Customer' : 'Your details'}>
    <div class="flex flex-col gap-4">
      <FormField label="Full name" for="{fieldId}-name" required>
        <TextInput id="{fieldId}-name" bind:value={form.customerName} placeholder="John Doe" />
      </FormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="Email" for="{fieldId}-email" required>
          <TextInput
            id="{fieldId}-email"
            type="email"
            bind:value={form.customerEmail}
            placeholder="john@example.com"
          />
        </FormField>

        <FormField label="Phone" for="{fieldId}-phone" required>
          <TextInput
            id="{fieldId}-phone"
            type="tel"
            bind:value={form.customerPhone}
            placeholder="(555) 123-4567"
          />
        </FormField>
      </div>

      {#if form.checksMembership}
        <p class="text-sm text-muted-foreground">
          Members get member pricing. We check your email against Starforge memberships on the next
          step.
        </p>
      {:else}
        <div class="flex items-center gap-2">
          <Checkbox id="{fieldId}-member" bind:checked={form.isMember} />
          <Label for="{fieldId}-member">Customer is a Starforge member</Label>
        </div>
      {/if}
    </div>
  </Section>
</div>
