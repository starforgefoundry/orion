import type { Payment } from '$lib/server/db/schema';
import type { NewPayment } from '$lib/server/repositories/payment.repository';
import {
  authorizePayment,
  capturePayment,
  voidPayment,
  type PaymentRepositories,
} from '$lib/server/utils/payment';

export type PaidBookingSteps<Booking> = {
  create: (authorized: Payment) => Promise<Booking>;
  cancel: (booking: Booking) => Promise<unknown>;
};

/**
 * Holds the amount on the card, creates the booking, then takes the money. The hold is released
 * when the booking can't be created, and the booking is canceled when the money can't be taken.
 */
export async function bookWithPayment<Booking>(
  repos: PaymentRepositories,
  payment: NewPayment,
  sourceId: string,
  steps: PaidBookingSteps<Booking>,
) {
  const authorized = await authorizePayment(repos, payment, sourceId);

  let booking: Booking;
  try {
    booking = await steps.create(authorized);
  } catch (error) {
    await voidPayment(repos, authorized);
    throw error;
  }

  try {
    return { booking, payment: await capturePayment(repos, authorized) };
  } catch (error) {
    await steps.cancel(booking);
    throw error;
  }
}
