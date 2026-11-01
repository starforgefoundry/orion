import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { getCarBayStaffSchedule, reopenCarBay } from '$lib/remotes/endpoints/car-bay.remote';
import { getCarBayPolicy } from '$lib/remotes/endpoints/settings.remote';
import { SPACE_ZONE } from '$lib/utils/space';
import { CAR_BAY_STATUS, DEFAULT_CAR_BAY_POLICY } from '$lib/utils/car-bay';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffBaySchedule } from './staff-bay-schedule.svelte';

vi.mock('$lib/remotes/endpoints/car-bay.remote', () => ({
  getCarBayStaffSchedule: vi.fn(),
  reopenCarBay: vi.fn(),
}));

vi.mock('$lib/remotes/endpoints/settings.remote', () => ({ getCarBayPolicy: vi.fn() }));

vi.mock('$lib/frontend/modal-manager.svelte', () => ({
  modalManager: { confirm: vi.fn(), show: vi.fn() },
}));

vi.mock('$lib/frontend/form-submit', () => ({
  submitWithToast: async (action: () => Promise<unknown>) => {
    await action();
    return true;
  },
}));

// A Monday, when the bay opens at 16:00.
const MONDAY = '2026-10-12';
const OPEN_HOUR = DEFAULT_CAR_BAY_POLICY.weekdayOpenHour;
const NOW = DateTime.fromISO('2026-10-10T09:00', { zone: SPACE_ZONE });

function slot(hour: number, length = 1) {
  const startAt = DateTime.fromISO(MONDAY, { zone: SPACE_ZONE }).set({ hour });
  return { startAt: startAt.toISO()!, endAt: startAt.plus({ hours: length }).toISO()! };
}

const CLOSURE = { id: 'closure-1', ...slot(OPEN_HOUR) };

const refresh = vi.fn();

function scheduleWith(bookings: unknown[] = [], closures: unknown[] = []) {
  vi.mocked(getCarBayStaffSchedule).mockReturnValue({
    current: { bookings, closures },
    refresh,
  } as unknown as ReturnType<typeof getCarBayStaffSchedule>);
  vi.mocked(getCarBayPolicy).mockReturnValue({
    current: DEFAULT_CAR_BAY_POLICY,
  } as unknown as ReturnType<typeof getCarBayPolicy>);
  return new StaffBaySchedule();
}

describe(StaffBaySchedule.name, () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW.toMillis() });
    refresh.mockResolvedValue(undefined);
  });

  it('shows the current week and steps between weeks', () => {
    const schedule = scheduleWith();

    expect(schedule.days[0]).toBe('2026-10-05');
    expect(schedule.weekLabel).toBe('Oct 5 – Oct 11, 2026');

    schedule.nextWeek();
    expect(schedule.days[0]).toBe(MONDAY);
    expect(schedule.schedule).toBeDefined();
    expect(getCarBayStaffSchedule).toHaveBeenLastCalledWith({
      from: MONDAY,
      to: '2026-10-18',
    });

    schedule.previousWeek();
    expect(schedule.days[0]).toBe('2026-10-05');
  });

  it('only counts confirmed bookings', () => {
    const confirmed = { id: 'a', status: CAR_BAY_STATUS.CONFIRMED, ...slot(OPEN_HOUR) };
    const canceled = { id: 'b', status: CAR_BAY_STATUS.CANCELED, ...slot(OPEN_HOUR + 1) };

    const schedule = scheduleWith([confirmed, canceled]);

    expect(schedule.bookings.map((booking) => booking.id)).toEqual(['a']);
  });

  it('closes slots covered by a closure', () => {
    const schedule = scheduleWith([], [CLOSURE]);

    expect(schedule.isSlotOpen(MONDAY, OPEN_HOUR)).toBe(false);
    expect(schedule.isSlotOpen(MONDAY, OPEN_HOUR + 2)).toBe(true);
  });

  it('reopens a closure once confirmed', async () => {
    vi.mocked(modalManager.confirm).mockResolvedValue(true);
    const schedule = scheduleWith([], [CLOSURE]);

    await schedule.reopen(CLOSURE);

    expect(reopenCarBay).toHaveBeenCalledWith({ closureId: CLOSURE.id });
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps a closure when the staff member backs out', async () => {
    vi.mocked(modalManager.confirm).mockResolvedValue(false);
    const schedule = scheduleWith([], [CLOSURE]);

    await schedule.reopen(CLOSURE);

    expect(reopenCarBay).not.toHaveBeenCalled();
  });
});
