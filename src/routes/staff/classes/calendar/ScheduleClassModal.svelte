<script lang="ts">
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import CalendarPlusIcon from '@lucide/svelte/icons/calendar-plus';
  import { ScheduleClassForm } from './schedule-class-form.svelte';

  const MIN_DURATION_MINUTES = 1;
  const MIN_SEATS = 1;

  let { onClose }: ModalProps = $props();

  const form = new ScheduleClassForm();

  async function submit() {
    if (await form.submit()) onClose();
  }
</script>

<ModalForm
  title="Schedule Class"
  icon={CalendarPlusIcon}
  {onClose}
  submitLabel={form.submitLabel}
  canSubmit={form.canSubmit}
  submitting={form.submitting}
  onSubmit={submit}
>
  <FormField label="Class" required>
    <OptionSelect
      options={form.catalogOptions}
      bind:value={form.classId}
      placeholder="Select class..."
    />
  </FormField>

  <FormField label="Teacher" required>
    <OptionSelect
      options={form.staffOptions}
      bind:value={form.teacherEmail}
      placeholder="Select teacher..."
    />
  </FormField>

  <FormField label={form.recurring ? 'Start Date' : 'Date'} for="schedule-date" required>
    <TextInput id="schedule-date" type="date" bind:value={form.date} />
  </FormField>

  <div class="grid grid-cols-2 gap-3">
    <FormField label="Start Time" for="schedule-start-time" required>
      <TextInput id="schedule-start-time" type="time" bind:value={form.startTime} />
    </FormField>
    <FormField label="Duration (min)" for="schedule-duration" required>
      <TextInput
        id="schedule-duration"
        type="number"
        min={MIN_DURATION_MINUTES}
        bind:value={form.durationMinutes}
      />
    </FormField>
  </div>

  <FormField label="Seats" for="schedule-seats" required>
    <TextInput id="schedule-seats" type="number" min={MIN_SEATS} bind:value={form.seats} />
  </FormField>

  <Label class="flex cursor-pointer items-center gap-2">
    <Checkbox bind:checked={form.recurring} />
    Recurring weekly
  </Label>

  {#if form.recurring}
    <FormField label="End Date" for="schedule-end-date" required>
      <TextInput id="schedule-end-date" type="date" min={form.date} bind:value={form.endDate} />
    </FormField>
  {/if}
</ModalForm>
