<script lang="ts">
  import CarBayBookingFields from '$lib/frontend/components/CarBayBookingFields.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect, {
    type SelectOption,
  } from '$lib/frontend/components/form/OptionSelect.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import type { CarBayBlock, CarBayRules } from '$lib/utils/car_bay';
  import CarIcon from '@lucide/svelte/icons/car';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { untrack } from 'svelte';
  import ClosureFields from './ClosureFields.svelte';
  import { STAFF_ENTRY_NAMES, StaffBayEntry, type StaffEntryType } from './staff-entry.svelte';

  interface Props extends ModalProps {
    date: string;
    startHour: number;
    blocks: () => CarBayBlock[];
    rules: CarBayRules;
    onBooked: () => Promise<void>;
  }

  let { onClose, date, startHour, blocks, rules, onBooked }: Props = $props();

  const fieldId = $props.id();

  const entry = untrack(() => new StaffBayEntry({ rules, blocks }, { date, startHour }));

  const typeOptions: SelectOption[] = Object.entries(STAFF_ENTRY_NAMES).map(([value, label]) => ({
    value,
    label,
  }));

  async function handleSubmit() {
    if (!(await entry.submit())) return;
    await onBooked();
    onClose();
  }
</script>

<ModalForm
  title={entry.isClosure ? 'Close the Car Bay' : 'New Car Bay Booking'}
  icon={CarIcon}
  {onClose}
  submitLabel={entry.isClosure ? 'Close Bay' : 'Add Booking'}
  submitIcon={CheckIcon}
  canSubmit={entry.canSubmit}
  submitting={entry.submitting}
  onSubmit={handleSubmit}
>
  <div class="grid gap-4 sm:grid-cols-2">
    <FormField label="Type" required>
      <OptionSelect
        options={typeOptions}
        value={entry.type}
        onValueChange={(value) => entry.setType(value as StaffEntryType)}
      />
    </FormField>
    <FormField label="Date" for="{fieldId}-date" required>
      <TextInput id="{fieldId}-date" type="date" bind:value={entry.date} />
    </FormField>
  </div>

  {#if entry.isClosure}
    <ClosureFields form={entry.closure} />
    <p class="text-xs text-muted-foreground">
      Customers see closed times as unavailable. Click the closure on the schedule to reopen.
    </p>
  {:else}
    <CarBayBookingFields form={entry.booking} editableSchedule />
    <p class="text-xs text-muted-foreground">
      Staff bookings are free and can be made any distance ahead. The customer still gets a
      confirmation email.
    </p>
  {/if}
</ModalForm>
