import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { cancelBookingStaff, getInstanceDetail } from '$lib/remotes/endpoints/class.remote';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import { CLASS_BOOKING_STATUS, CLASS_INSTANCE_STATUS } from '$lib/utils/classes';
import { describe, expect, it, vi } from 'vitest';
import { InstanceDetail, isPaid, type InstanceBooking } from './instance-detail.svelte';

vi.mock('$lib/remotes/endpoints/class.remote', () => ({
  cancelBookingStaff: vi.fn(),
  cancelInstance: vi.fn(),
  getAllInstances: vi.fn(),
  getInstanceDetail: vi.fn(),
}));

vi.mock('$lib/frontend/modal-manager.svelte', () => ({
  modalManager: { confirm: vi.fn(), show: vi.fn() },
}));

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const SEATS = 5;
const PRICE_CENTS = 2500;

function booking(
  id: string,
  {
    quantity = 1,
    status = CLASS_BOOKING_STATUS.CONFIRMED as InstanceBooking['status'],
    paid = false,
  } = {},
) {
  return {
    id,
    quantity,
    status,
    payment: paid ? { status: PAYMENT_STATUS.PAID, total: PRICE_CENTS } : null,
  } as unknown as InstanceBooking;
}

function instanceWith(bookings: InstanceBooking[]) {
  vi.mocked(getInstanceDetail).mockReturnValue({
    current: { status: CLASS_INSTANCE_STATUS.SCHEDULED, seats: SEATS, bookings },
  } as unknown as ReturnType<typeof getInstanceDetail>);
  return new InstanceDetail(
    () => 'instance-1',
    () => {},
  );
}

describe(InstanceDetail.name, () => {
  it('counts seats taken by confirmed bookings', () => {
    const instance = instanceWith([
      booking('a', { quantity: 2 }),
      booking('b'),
      booking('c', { status: CLASS_BOOKING_STATUS.CANCELED }),
    ]);

    expect(instance.scheduled).toBe(true);
    expect(instance.bookedSeats).toBe(3);
    expect(instance.openSeats).toBe(SEATS - 3);
    expect(instance.canceledBookings.map((b) => b.id)).toEqual(['c']);
  });

  it('only treats a paid, non-zero payment as paid', () => {
    expect(isPaid(booking('a', { paid: true }))).toBe(true);
    expect(isPaid(booking('b'))).toBe(false);
  });

  it('offers a refund when canceling a paid booking', async () => {
    vi.mocked(modalManager.confirm).mockResolvedValue(true);
    const paid = booking('a', { paid: true });
    const instance = instanceWith([paid]);

    await instance.cancelBooking(paid);

    expect(modalManager.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmText: 'Cancel & Refund' }),
    );
    expect(cancelBookingStaff).toHaveBeenCalledWith({ bookingId: 'a' });
    expect(instance.isCanceling(paid)).toBe(false);
  });

  it('keeps the booking when the cancel is not confirmed', async () => {
    vi.mocked(modalManager.confirm).mockResolvedValue(false);
    const manual = booking('a');
    const instance = instanceWith([manual]);

    await instance.cancelBooking(manual);

    expect(cancelBookingStaff).not.toHaveBeenCalled();
  });
});
