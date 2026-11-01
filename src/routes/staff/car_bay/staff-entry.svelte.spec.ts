import { staffBookCarBay, staffCloseCarBay } from '$lib/remotes/endpoints/car-bay.remote';
import { SPACE_ZONE } from '$lib/utils/space';
import { CarBayRules, DEFAULT_CAR_BAY_POLICY, type CarBayBlock } from '$lib/utils/car-bay';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarBayClosureForm, CLOSED_ENTRY, StaffBayEntry } from './staff-entry.svelte';

vi.mock('$lib/remotes/endpoints/car-bay.remote', () => ({
  staffBookCarBay: vi.fn(),
  staffCloseCarBay: vi.fn(),
}));

vi.mock('$lib/frontend/form-submit', () => ({
  submitWithToast: async (action: () => Promise<unknown>) => {
    await action();
    return true;
  },
}));

// A weekday, when the bay opens at 16:00 and closes at 21:00.
const MONDAY = '2026-10-12';
const TUESDAY = '2026-10-13';
const OPEN_HOUR = DEFAULT_CAR_BAY_POLICY.weekdayOpenHour;
const CLOSE_HOUR = DEFAULT_CAR_BAY_POLICY.weekdayCloseHour;

function at(hour: number, date = MONDAY) {
  return DateTime.fromISO(date, { zone: SPACE_ZONE }).set({ hour });
}

function context(blocks: CarBayBlock[] = []) {
  return { rules: new CarBayRules(DEFAULT_CAR_BAY_POLICY), blocks: () => blocks };
}

describe(CarBayClosureForm.name, () => {
  it('starts as a one hour closure at the chosen slot', () => {
    const form = new CarBayClosureForm(context(), { date: MONDAY, startHour: OPEN_HOUR });

    expect(form.fits).toBe(true);
    expect(form.period?.startAt.toISO()).toBe(at(OPEN_HOUR).toISO());
    expect(form.period?.endAt.toISO()).toBe(at(OPEN_HOUR + 1).toISO());
  });

  it('pushes the end back when the start moves past it', () => {
    const form = new CarBayClosureForm(context(), { date: MONDAY, startHour: OPEN_HOUR });

    form.setStartHour(OPEN_HOUR + 2);

    expect(form.endHour).toBe(OPEN_HOUR + 3);
    expect(form.period?.startAt.toISO()).toBe(at(OPEN_HOUR + 2).toISO());
  });

  it('moves the end date along with a later start date', () => {
    const form = new CarBayClosureForm(context(), { date: MONDAY, startHour: OPEN_HOUR });

    form.setStartDate(TUESDAY);

    expect(form.endDate).toBe(TUESDAY);
  });

  it('only offers end hours that stop before the next booking', () => {
    const booking = { startAt: at(OPEN_HOUR + 2), blockedUntil: at(OPEN_HOUR + 3) };
    const form = new CarBayClosureForm(context([booking]), {
      date: MONDAY,
      startHour: OPEN_HOUR,
    });

    expect(form.endHourOptions).toEqual([OPEN_HOUR + 1, OPEN_HOUR + 2]);
  });

  it('does not fit once it ends after closing time', () => {
    const form = new CarBayClosureForm(context(), { date: MONDAY, startHour: OPEN_HOUR });

    form.endHour = CLOSE_HOUR + 1;

    expect(form.fits).toBe(false);
    expect(form.period).toBeNull();
  });
});

describe(StaffBayEntry.name, () => {
  let entry: StaffBayEntry;

  beforeEach(() => {
    entry = new StaffBayEntry(context(), { date: MONDAY, startHour: OPEN_HOUR });
  });

  it('closes the bay with the closure request and reason', async () => {
    entry.setType(CLOSED_ENTRY);
    entry.closure.reason = 'Lift inspection';

    await entry.submit();

    expect(staffCloseCarBay).toHaveBeenCalledWith({
      startDate: MONDAY,
      startHour: OPEN_HOUR,
      endDate: MONDAY,
      endHour: OPEN_HOUR + 1,
      reason: 'Lift inspection',
    });
    expect(staffBookCarBay).not.toHaveBeenCalled();
    expect(entry.submitting).toBe(false);
  });

  it('moves the closure start when the date changes', () => {
    entry.date = TUESDAY;

    expect(entry.closure.startDate).toBe(TUESDAY);
  });
});
