import {
  createInstance,
  generateInstances,
  getAllInstances,
} from '$lib/remotes/endpoints/class.remote';
import { toast } from 'svelte-sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DURATION_MINUTES,
  DEFAULT_SEATS,
  ScheduleClassForm,
} from './schedule-class-form.svelte';

vi.mock('$lib/remotes/endpoints/class.remote', () => ({
  createInstance: vi.fn(),
  generateInstances: vi.fn(),
  getAllInstances: vi.fn(),
  getCatalogs: vi.fn(),
  getStaffUsers: vi.fn(),
}));

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('$lib/frontend/form-submit', () => ({
  submitWithToast: async (action: () => Promise<unknown>) => {
    await action();
    return true;
  },
}));

// A Monday, and the Monday three weeks later.
const MONDAY = '2026-10-12';
const THIRD_MONDAY_AFTER = '2026-11-02';
const MONDAY_DAY_OF_WEEK = 1;

function filledForm() {
  const form = new ScheduleClassForm();
  form.classId = 'class-1';
  form.teacherEmail = 'teacher@example.com';
  form.date = MONDAY;
  form.startTime = '18:00';
  return form;
}

const BASE_DETAILS = {
  classId: 'class-1',
  teacherEmail: 'teacher@example.com',
  startTime: '18:00',
  durationMinutes: DEFAULT_DURATION_MINUTES,
  seats: DEFAULT_SEATS,
};

describe(ScheduleClassForm.name, () => {
  beforeEach(() => {
    vi.mocked(getAllInstances).mockReturnValue({
      refresh: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getAllInstances>);
  });

  it('refuses to submit with missing fields', async () => {
    const form = new ScheduleClassForm();

    await expect(form.submit()).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Please fill in all fields');
    expect(createInstance).not.toHaveBeenCalled();
  });

  it('creates a single class', async () => {
    const form = filledForm();

    await expect(form.submit()).resolves.toBe(true);
    expect(createInstance).toHaveBeenCalledWith({ ...BASE_DETAILS, date: MONDAY });
    expect(form.submitting).toBe(false);
  });

  it('counts the weekly classes a recurring schedule creates', () => {
    const form = filledForm();
    form.recurring = true;

    expect(form.classCount).toBe(0);
    expect(form.canSubmit).toBe(false);

    form.endDate = THIRD_MONDAY_AFTER;

    expect(form.classCount).toBe(4);
    expect(form.submitLabel).toBe('Create 4 Classes');
    expect(form.canSubmit).toBe(true);
  });

  it('needs an end date for a recurring schedule', async () => {
    const form = filledForm();
    form.recurring = true;

    await expect(form.submit()).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Please fill in the end date');
  });

  it('generates weekly classes on the start date weekday', async () => {
    const form = filledForm();
    form.recurring = true;
    form.endDate = THIRD_MONDAY_AFTER;

    await expect(form.submit()).resolves.toBe(true);
    expect(generateInstances).toHaveBeenCalledWith({
      ...BASE_DETAILS,
      dayOfWeek: MONDAY_DAY_OF_WEEK,
      startDate: MONDAY,
      endDate: THIRD_MONDAY_AFTER,
    });
  });
});
