import {
  CAR_BAY_TIER,
  FULL_DAY_MAX_DAYS,
  HOURLY_MIN_HOURS,
  bookingLineItems,
  lineItemsTotal,
  requestFits,
  resolvePeriod,
  slotHours,
  type CarBayPeriod,
  type CarBayRates,
  type CarBayRequest,
  type CarBayTier,
} from '$lib/utils/car_bay';
import { DateTime } from 'luxon';

type BookingFormContext = {
  bookings: () => CarBayPeriod[];
  rates: () => CarBayRates | undefined;
  enforceHorizon: boolean;
};

type BookingFormStart = { tier: CarBayTier; date: string; startHour: number };

function range(from: number, to: number) {
  return Array.from({ length: Math.max(to - from + 1, 0) }, (_, i) => from + i);
}

export class CarBayBookingForm {
  tier = $state<CarBayTier>(CAR_BAY_TIER.QUICK_JOB);
  date = $state('');
  startHour = $state(0);
  hours = $state(HOURLY_MIN_HOURS);
  days = $state(1);

  customerName = $state('');
  customerEmail = $state('');
  customerPhone = $state('');
  isMember = $state(false);

  #context: BookingFormContext;
  #now = DateTime.now();

  constructor(context: BookingFormContext, start: BookingFormStart) {
    this.#context = context;
    this.tier = start.tier;
    this.date = start.date;
    this.startHour = start.startHour;
  }

  #requestFor(overrides: { startHour?: number; hours?: number; days?: number }): CarBayRequest {
    const startHour = overrides.startHour ?? this.startHour;
    if (this.tier === CAR_BAY_TIER.QUICK_JOB) {
      return { tier: this.tier, date: this.date, startHour };
    }
    if (this.tier === CAR_BAY_TIER.HOURLY) {
      return { tier: this.tier, date: this.date, startHour, hours: overrides.hours ?? this.hours };
    }
    return { tier: this.tier, date: this.date, days: overrides.days ?? this.days };
  }

  #options() {
    return { enforceHorizon: this.#context.enforceHorizon };
  }

  #fits(request: CarBayRequest) {
    return requestFits(request, this.#context.bookings(), this.#now, this.#options());
  }

  request = $derived(this.#requestFor({}));

  fits = $derived(this.#fits(this.request));

  period = $derived(this.fits ? resolvePeriod(this.request, this.#now, this.#options()) : null);

  startHourOptions = $derived(
    this.date
      ? slotHours(this.date).filter((startHour) =>
          this.#fits(this.#requestFor({ startHour, hours: HOURLY_MIN_HOURS, days: 1 })),
        )
      : [],
  );

  hourOptions = $derived(
    this.date
      ? range(HOURLY_MIN_HOURS, slotHours(this.date).length).filter((hours) =>
          this.#fits(this.#requestFor({ hours })),
        )
      : [],
  );

  dayOptions = $derived(
    this.date
      ? range(1, FULL_DAY_MAX_DAYS).filter((days) => this.#fits(this.#requestFor({ days })))
      : [],
  );

  lineItems = $derived.by(() => {
    const rates = this.#context.rates();
    return rates ? bookingLineItems(this.request, rates, this.isMember) : [];
  });

  total = $derived(lineItemsTotal(this.lineItems));

  hasCustomer = $derived(
    this.customerName.trim() !== '' &&
      this.customerEmail.trim() !== '' &&
      this.customerPhone.trim() !== '',
  );

  canSubmit = $derived(this.fits && this.hasCustomer);

  customer() {
    return {
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      customerPhone: this.customerPhone,
      isMember: this.isMember,
    };
  }
}
