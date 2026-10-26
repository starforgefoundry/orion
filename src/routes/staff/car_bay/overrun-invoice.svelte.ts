import { lineItemsTotal } from '$lib/utils/billing';
import { sendCarBayOverrunInvoice } from '$lib/remotes/endpoints/car_bay.remote';
import {
  CAR_BAY_OVERRUN,
  CarBayRuleError,
  overrunLineItems,
  type CarBayOverrun,
  type CarBayRates,
} from '$lib/utils/car_bay';

type OverrunKind = CarBayOverrun['kind'];

export class OverrunInvoice {
  kind = $state<OverrunKind>(CAR_BAY_OVERRUN.HOURLY);
  hours = $state(1);
  nights = $state(1);
  extraDays = $state(0);

  #bookingId: string;
  #bookingEndDate: string;
  #isMember: boolean;

  constructor(booking: { id: string; endDate: string; isMember: boolean }) {
    this.#bookingId = booking.id;
    this.#bookingEndDate = booking.endDate;
    this.#isMember = booking.isMember;
  }

  overrun = $derived<CarBayOverrun>(
    this.kind === CAR_BAY_OVERRUN.HOURLY
      ? { kind: this.kind, hours: this.hours }
      : { kind: this.kind, nights: this.nights, extraDays: Math.min(this.extraDays, this.nights) },
  );

  lineItems(rates: CarBayRates) {
    try {
      return overrunLineItems(this.overrun, this.#bookingEndDate, rates, this.#isMember);
    } catch (error) {
      if (error instanceof CarBayRuleError) return [];
      throw error;
    }
  }

  total(rates: CarBayRates) {
    return lineItemsTotal(this.lineItems(rates));
  }

  async send() {
    return await sendCarBayOverrunInvoice({ bookingId: this.#bookingId, overrun: this.overrun });
  }
}
