<script lang="ts">
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import {
    createInstance,
    generateInstances,
    getAllInstances,
    getCatalogs,
    getStaffUsers,
  } from '$lib/remotes/endpoints/class.remote';
  import CalendarPlusIcon from '@lucide/svelte/icons/calendar-plus';
  import { DateTime } from 'luxon';
  import { toast } from 'svelte-sonner';

  let { onClose }: ModalProps = $props();

  const catalogsRemote = getCatalogs();
  const catalogs = $derived(catalogsRemote.current ?? []);
  const catalogOptions = $derived(catalogs.map((c) => ({ label: c.name, value: c.id })));

  const staffRemote = getStaffUsers();
  const staff = $derived(staffRemote.current ?? []);
  const staffOptions = $derived(staff.map((u) => ({ label: u.name, value: u.email })));

  let selectedCatalog = $state('');
  let selectedTeacher = $state('');
  let dateValue = $state(DateTime.now().toISODate());
  let startTime = $state('');
  let durationMinutes = $state(60);
  let seats = $state(3);
  let recurring = $state(false);
  let endDateValue = $state('');
  let submitting = $state(false);

  const date = $derived(dateValue ? DateTime.fromISO(dateValue) : undefined);
  const endDate = $derived(endDateValue ? DateTime.fromISO(endDateValue) : undefined);

  const previewCount = $derived.by(() => {
    if (!recurring || !date || !endDate) return 0;
    if (!date.isValid || !endDate.isValid || endDate < date) return 0;

    let count = 0;
    let current = date;
    while (current <= endDate) {
      count++;
      current = current.plus({ days: 7 });
    }
    return count;
  });

  async function handleCreate() {
    if (!selectedCatalog || !selectedTeacher || !date || !startTime) {
      toast.error('Please fill in all fields');
      return;
    }

    const dateStr = date.toISODate()!;

    if (recurring && !endDate) {
      toast.error('Please fill in the end date');
      return;
    }

    submitting = true;
    const ok =
      recurring && endDate
        ? await submitWithToast(
            () =>
              generateInstances({
                classId: selectedCatalog,
                teacherEmail: selectedTeacher,
                dayOfWeek: date.weekday % 7,
                startTime,
                durationMinutes: durationMinutes,
                seats: seats,
                startDate: dateStr,
                endDate: endDate.toISODate()!,
              }),
            {
              success: `Created ${previewCount} class${previewCount !== 1 ? 'es' : ''}`,
              error: 'Failed to generate classes',
            },
          )
        : await submitWithToast(
            () =>
              createInstance({
                classId: selectedCatalog,
                teacherEmail: selectedTeacher,
                date: dateStr,
                startTime,
                durationMinutes: durationMinutes,
                seats: seats,
              }),
            { success: 'Class created', error: 'Failed to create class' },
          );

    if (ok) {
      await getAllInstances().refresh();
      onClose();
    }
    submitting = false;
  }
</script>

<ModalForm
  title="Schedule Class"
  icon={CalendarPlusIcon}
  {onClose}
  submitLabel={recurring ? `Create ${previewCount} Classes` : 'Create Class'}
  canSubmit={!(recurring && previewCount === 0)}
  {submitting}
  onSubmit={handleCreate}
>
  <FormField label="Class" required>
    <OptionSelect
      options={catalogOptions}
      bind:value={selectedCatalog}
      placeholder="Select class..."
    />
  </FormField>

  <FormField label="Teacher" required>
    <OptionSelect
      options={staffOptions}
      bind:value={selectedTeacher}
      placeholder="Select teacher..."
    />
  </FormField>

  <FormField label={recurring ? 'Start Date' : 'Date'} for="schedule-date" required>
    <TextInput id="schedule-date" type="date" bind:value={dateValue} />
  </FormField>

  <div class="grid grid-cols-2 gap-3">
    <FormField label="Start Time" for="schedule-start-time" required>
      <TextInput id="schedule-start-time" type="time" bind:value={startTime} />
    </FormField>
    <FormField label="Duration (min)" for="schedule-duration" required>
      <TextInput id="schedule-duration" type="number" min={1} bind:value={durationMinutes} />
    </FormField>
  </div>

  <FormField label="Seats" for="schedule-seats" required>
    <TextInput id="schedule-seats" type="number" min={1} bind:value={seats} />
  </FormField>

  <Label class="flex cursor-pointer items-center gap-2">
    <Checkbox bind:checked={recurring} />
    Recurring weekly
  </Label>

  {#if recurring}
    <FormField label="End Date" for="schedule-end-date" required>
      <TextInput id="schedule-end-date" type="date" min={dateValue} bind:value={endDateValue} />
    </FormField>
  {/if}
</ModalForm>
