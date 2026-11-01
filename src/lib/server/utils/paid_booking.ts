import type { Payment } from '$lib/server/db/schema';
import type { NewPayment, PaymentRepository } from '$lib/server/repositories/payment.repository';

export type PaidBookingSteps<Booking> = {
  create: (authorized: Payment) => Promise<Booking>;
  cancel: (booking: Booking) => Promise<unknown>;
};

/**
 * Holds the amount on the card, creates the booking, then takes the money. The hold is released
 * when the booking can't be created, and the booking is canceled when the money can't be taken.
 */
export async function bookWithPayment<Booking>(
  payments: Pick<PaymentRepository, 'authorize' | 'void' | 'capture'>,
  payment: NewPayment,
  sourceId: string,
  steps: PaidBookingSteps<Booking>,
) {
  const authorized = await payments.authorize(payment, sourceId);

  let booking: Booking;
  try {
    booking = await steps.create(authorized);
  } catch (error) {
    await payments.void(authorized);
    throw error;
  }

  try {
    return { booking, payment: await payments.capture(authorized) };
  } catch (error) {
    await steps.cancel(booking);
    throw error;
  }
}
