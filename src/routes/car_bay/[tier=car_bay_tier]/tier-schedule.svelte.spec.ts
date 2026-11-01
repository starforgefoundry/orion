import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { getCarBaySchedule } from '$lib/remotes/endpoints/car-bay.remote';
import {
  getCarBayAvailability,
  getCarBayPolicy,
  getCarBayRates,
} from '$lib/remotes/endpoints/settings.remote';
import { SPACE_ZONE } from '$lib/utils/space';
import { CAR_BAY_TIER, DEFAULT_CAR_BAY_POLICY, type CarBayTier } from '$lib/utils/car-bay';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TierSchedule } from './tier-schedule.svelte';

vi.mock('$lib/remotes/endpoints/car-bay.remote', () => ({ getCarBaySchedule: vi.fn() }));

vi.mock('$lib/remotes/endpoints/settings.remote', () => ({
  getCarBayAvailability: vi.fn(),
  getCarBayPolicy: vi.fn(),
  getCarBayRates: vi.fn(),
}));

vi.mock('$lib/frontend/modal-manager.svelte', () => ({
  modalManager: { show: vi.fn() },
}));

// A Monday, when the bay is open from 16:00 to 21:00.
const MONDAY = '2026-10-12';
const OPEN_HOUR = DEFAULT_CAR_BAY_POLICY.weekdayOpenHour;
const CLOSE_HOUR = DEFAULT_CAR_BAY_POLICY.weekdayCloseHour;
const NOW = DateTime.fromISO('2026-10-10T09:00', { zone: SPACE_ZONE });
const RATES = { quickJob: {} };

function query<T>(current: T, loading = false) {
  return { current, loading, refresh: vi.fn().mockResolvedValue(undefined) };
}

function scheduleFor(tier: CarBayTier, { isOpen = true, loading = false } = {}) {
  const schedule = query({ today: NOW.toISODate()!, bookings: [], closures: [] }, loading);
  vi.mocked(getCarBaySchedule).mockReturnValue(
    schedule as unknown as ReturnType<typeof getCarBaySchedule>,
  );
  vi.mocked(getCarBayPolicy).mockReturnValue(
    query(DEFAULT_CAR_BAY_POLICY) as unknown as ReturnType<typeof getCarBayPolicy>,
  );
  vi.mocked(getCarBayRates).mockReturnValue(
    query(RATES) as unknown as ReturnType<typeof getCarBayRates>,
  );
  vi.mocked(getCarBayAvailability).mockReturnValue(
    query({ isOpen }) as unknown as ReturnType<typeof getCarBayAvailability>,
  );
  return { view: new TierSchedule(() => tier), schedule };
}

describe(TierSchedule.name, () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW.toMillis() });
  });

  it('loads until the schedule arrives', () => {
    expect(scheduleFor(CAR_BAY_TIER.HOURLY, { loading: true }).view.loading).toBe(true);
    expect(scheduleFor(CAR_BAY_TIER.HOURLY).view.loading).toBe(false);
  });

  it('is closed when the bay stops taking bookings', () => {
    expect(scheduleFor(CAR_BAY_TIER.HOURLY, { isOpen: false }).view.closed).toBe(true);
    expect(scheduleFor(CAR_BAY_TIER.HOURLY).view.closed).toBe(false);
  });

  it('covers the booking horizon', () => {
    const { view } = scheduleFor(CAR_BAY_TIER.HOURLY);

    expect(view.days).toHaveLength(DEFAULT_CAR_BAY_POLICY.publicHorizonDays + 1);
    expect(view.days[0]).toBe(NOW.toISODate());
  });

  it('opens an hourly slot only when the minimum hours fit before closing', () => {
    const { view } = scheduleFor(CAR_BAY_TIER.HOURLY);
    const lastStart = CLOSE_HOUR - DEFAULT_CAR_BAY_POLICY.hourlyMinHours;

    expect(view.isSlotOpen(MONDAY, lastStart)).toBe(true);
    expect(view.isSlotOpen(MONDAY, lastStart + 1)).toBe(false);
  });

  it('opens checkout for the tier at the clicked slot', () => {
    const { view } = scheduleFor(CAR_BAY_TIER.QUICK_JOB);

    view.openCheckout(MONDAY, OPEN_HOUR);

    expect(modalManager.show).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tier: CAR_BAY_TIER.QUICK_JOB, date: MONDAY, startHour: OPEN_HOUR }),
    );
  });

  it('starts a full day checkout at opening time', () => {
    const { view } = scheduleFor(CAR_BAY_TIER.FULL_DAY);

    view.openDay(MONDAY);

    expect(modalManager.show).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ date: MONDAY, startHour: OPEN_HOUR }),
    );
  });
});
