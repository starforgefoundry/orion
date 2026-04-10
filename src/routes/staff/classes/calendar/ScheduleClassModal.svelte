<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import {
    createInstance,
    generateInstances,
    getAllInstances,
    getCatalogs,
    getStaffUsers,
  } from '$lib/remotes/endpoints/class.remote';
  import {
    Button,
    DatePicker,
    Field,
    Input,
    Modal,
    ModalBody,
    NumberInput,
    Select,
    Stack,
    Text,
    toastManager,
    type SelectItem,
  } from '@immich/ui';
  import { mdiCalendar } from '@mdi/js';
  import { DateTime } from 'luxon';

  let { onClose }: ModalProps = $props();

  const catalogsRemote = getCatalogs();
  const catalogs = $derived(catalogsRemote.current ?? []);
  const catalogOptions = $derived(catalogs.map((c) => ({ label: c.name, value: c.id })));

  const staffRemote = getStaffUsers();
  const staff = $derived(staffRemote.current ?? []);
  const staffOptions = $derived(staff.map((u) => ({ label: u.name, value: u.email })));

  let selectedCatalog: SelectItem | undefined = $state(undefined);
  let selectedTeacher: SelectItem | undefined = $state(undefined);
  let date: DateTime | undefined = $state(DateTime.now());
  let startTime = $state('');
  let durationMinutes = $state(60);
  let seats = $state(3);
  let recurring = $state(false);
  let endDate: DateTime | undefined = $state(undefined);
  let submitting = $state(false);

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
      toastManager.danger('Please fill in all fields');
      return;
    }

    const dateStr = date.toISODate()!;

    if (recurring) {
      if (!endDate) {
        toastManager.danger('Please fill in the end date');
        return;
      }
      submitting = true;
      try {
        await generateInstances({
          classId: selectedCatalog.value,
          teacherEmail: selectedTeacher.value,
          dayOfWeek: date.weekday % 7,
          startTime,
          durationMinutes: durationMinutes,
          seats: seats,
          startDate: dateStr,
          endDate: endDate.toISODate()!,
        });
        toastManager.success(`Created ${previewCount} class${previewCount !== 1 ? 'es' : ''}`);
        await getAllInstances().refresh();
        onClose();
      } catch (error: any) {
        toastManager.danger(error?.message ?? 'Failed to generate classes');
      } finally {
        submitting = false;
      }
    } else {
      submitting = true;
      try {
        await createInstance({
          classId: selectedCatalog.value,
          teacherEmail: selectedTeacher.value,
          date: dateStr,
          startTime,
          durationMinutes: durationMinutes,
          seats: seats,
        });
        toastManager.success('Class created');
        await getAllInstances().refresh();
        onClose();
      } catch (error: any) {
        toastManager.danger(error?.message ?? 'Failed to create class');
      } finally {
        submitting = false;
      }
    }
  }
</script>

<Modal title="Schedule Class" icon={mdiCalendar} {onClose}>
  <ModalBody>
    <Stack gap={4}>
      <Field label="Class" required="indicator">
        <Select data={catalogOptions} bind:value={selectedCatalog} placeholder="Select class..." />
      </Field>
      <Field label="Teacher" required="indicator">
        <Select data={staffOptions} bind:value={selectedTeacher} placeholder="Select teacher..." />
      </Field>
      <Field label={recurring ? 'Start Date' : 'Date'} required="indicator">
        <DatePicker bind:value={date} />
      </Field>
      <div class="grid grid-cols-2 gap-4">
        <Field label="Start Time" required="indicator">
          <Input type="time" bind:value={startTime} />
        </Field>
        <Field label="Duration (min)" required="indicator">
          <NumberInput bind:value={durationMinutes} min={1} />
        </Field>
      </div>
      <Field label="Seats" required="indicator">
        <NumberInput bind:value={seats} min={1} />
      </Field>

      <label class="flex cursor-pointer items-center gap-3">
        <input type="checkbox" bind:checked={recurring} class="h-4 w-4 rounded" />
        <Text fontWeight="bold">Recurring</Text>
      </label>

      {#if recurring}
        <div class="rounded-lg border border-gray-700 p-4">
          <Stack gap={4}>
            <Field label="End Date" required="indicator">
              <DatePicker bind:value={endDate} minDate={date} />
            </Field>
          </Stack>
        </div>
      {/if}

      <Button
        onclick={handleCreate}
        loading={submitting}
        disabled={submitting || (recurring && previewCount === 0)}
        fullWidth
      >
        {recurring ? `Create ${previewCount} Classes` : 'Create Class'}
      </Button>
    </Stack>
  </ModalBody>
</Modal>
