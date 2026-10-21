<script lang="ts">
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect, {
    type SelectOption,
  } from '$lib/frontend/components/form/OptionSelect.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { formatPeriod } from '$lib/utils/car_bay';
  import { DateTime } from 'luxon';
  import type { CarBayClosureForm } from './staff-entry.svelte';

  interface Props {
    form: CarBayClosureForm;
  }

  let { form }: Props = $props();

  const fieldId = $props.id();

  function hourOption(hour: number): SelectOption {
    return { value: hour.toString(), label: DateTime.fromObject({ hour }).toFormat('h:mm a') };
  }
</script>

<div class="flex flex-col gap-4">
  <div class="grid gap-4 sm:grid-cols-2">
    <FormField label="Closed from" required>
      <OptionSelect
        options={form.startHourOptions.map(hourOption)}
        value={form.startHour.toString()}
        placeholder="No open times"
        onValueChange={(value) => form.setStartHour(Number(value))}
      />
    </FormField>
    <FormField label="Until" required>
      <OptionSelect
        options={form.endHourOptions.map(hourOption)}
        value={form.endHour.toString()}
        placeholder="Not available"
        onValueChange={(value) => (form.endHour = Number(value))}
      />
    </FormField>
  </div>

  <FormField label="Reason" for="{fieldId}-reason" description="Only staff see this.">
    <TextInput id="{fieldId}-reason" bind:value={form.reason} placeholder="Lift inspection" />
  </FormField>

  <div class="rounded-md bg-muted/60 px-3 py-2">
    <p class="text-sm font-medium">Closed</p>
    {#if form.period}
      <p class="text-sm text-muted-foreground">{formatPeriod(form.period)}</p>
    {:else}
      <p class="text-sm text-destructive">
        This time overlaps a booking or another closure. Pick another one.
      </p>
    {/if}
  </div>
</div>
