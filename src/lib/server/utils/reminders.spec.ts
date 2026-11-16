import { DateTime, Duration } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import { dueForReminder, sendOnce } from './reminders';

const NOW = DateTime.fromISO('2026-10-12T09:00', { zone: 'utc' });
const LEAD = Duration.fromObject({ hours: 24 });
const BOOKED_EARLY = NOW.minus({ days: 3 });

describe(dueForReminder.name, () => {
  it('reminds a booking that starts within the lead time', () => {
    const booking = { startsAt: NOW.plus({ hours: 20 }), bookedAt: BOOKED_EARLY };

    expect(dueForReminder(booking, NOW, LEAD)).toBe(true);
  });

  it('includes a booking that starts exactly at the end of the lead time', () => {
    const booking = { startsAt: NOW.plus(LEAD), bookedAt: BOOKED_EARLY };

    expect(dueForReminder(booking, NOW, LEAD)).toBe(true);
  });

  it.each([
    ['already started', NOW.minus({ hours: 1 })],
    ['starts right now', NOW],
    ['starts after the lead time', NOW.plus({ hours: 30 })],
  ])('skips a booking that %s', (_, startsAt) => {
    expect(dueForReminder({ startsAt, bookedAt: BOOKED_EARLY }, NOW, LEAD)).toBe(false);
  });

  it('skips a booking made inside the lead time', () => {
    const startsAt = NOW.plus({ hours: 20 });

    expect(dueForReminder({ startsAt, bookedAt: NOW.minus({ hours: 1 }) }, NOW, LEAD)).toBe(false);
    expect(dueForReminder({ startsAt, bookedAt: startsAt.minus(LEAD) }, NOW, LEAD)).toBe(false);
  });
});

describe(sendOnce.name, () => {
  function reminder(claimed = true) {
    return { claim: vi.fn(async () => claimed), release: vi.fn(async () => {}) };
  }

  it('sends a reminder it claimed', async () => {
    const send = vi.fn(async () => {});

    expect(await sendOnce(reminder(), send)).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });

  it('skips a reminder another sweep already claimed', async () => {
    const send = vi.fn(async () => {});

    expect(await sendOnce(reminder(false), send)).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('gives the reminder back when the send fails', async () => {
    const claimed = reminder();
    const failure = new Error('resend down');

    await expect(sendOnce(claimed, async () => Promise.reject(failure))).rejects.toBe(failure);
    expect(claimed.release).toHaveBeenCalledOnce();
  });
});
