import {
  CAR_BAY_TIER,
  bookingLineItems,
  lineItemsTotal,
  type CarBayPeriod,
  type CarBayRules,
  type CarBayRates,
  type CarBayRequest,
  type CarBayTier,
} from '$lib/utils/car_bay';
import { DateTime } from 'luxon';

type BookingFormContext = {
  bookings: () => CarBayPeriod[];
  rates: () => CarBayRates | undefined;
  rules: CarBayRules;
  enforceHorizon: boolean;
  /** Looked up from Square for customers; `undefined` while the lookup is pending. */
  membership?: () => boolean | undefined;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CHECKOUT_STEPS = { DETAILS: 'details', PAYMENT: 'payment' } as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[keyof typeof CHECKOUT_STEPS];

type BookingFormStart = { tier: CarBayTier; date: string; startHour: number };

function range(from: number, to: number) {
  return Array.from({ length: Math.max(to - from + 1, 0) }, (_, i) => from + i);
}

export class CarBayBookingForm {
  tier = $state<CarBayTier>(CAR_BAY_TIER.QUICK_JOB);
  date = $state('');
  startHour = $state(0);
  hours = $state(0);
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
    this.hours = context.rules.policy.hourlyMinHours;
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

  #rules() {
    return this.#context.rules;
  }

  #options() {
    return { enforceHorizon: this.#context.enforceHorizon };
  }

  #fits(request: CarBayRequest) {
    return this.#context.rules.requestFits(
      request,
      this.#context.bookings(),
      this.#now,
      this.#options(),
    );
  }

  request = $derived(this.#requestFor({}));

  fits = $derived(this.#fits(this.request));

  period = $derived(
    this.fits ? this.#rules().resolvePeriod(this.request, this.#now, this.#options()) : null,
  );

  startHourOptions = $derived(
    this.date
      ? this.#rules()
          .slotHours(this.date)
          .filter((startHour) =>
            this.#fits(
              this.#requestFor({ startHour, hours: this.#rules().policy.hourlyMinHours, days: 1 }),
            ),
          )
      : [],
  );

  hourOptions = $derived(
    this.date
      ? range(
          this.#rules().policy.hourlyMinHours,
          this.#rules().slotHours(this.date).length,
        ).filter((hours) => this.#fits(this.#requestFor({ hours })))
      : [],
  );

  dayOptions = $derived(
    this.date
      ? range(1, this.#rules().policy.fullDayMaxDays).filter((days) =>
          this.#fits(this.#requestFor({ days })),
        )
      : [],
  );

  checkedEmail = $state('');

  #lookedUpMembership() {
    return this.#context.membership?.();
  }

  checksMembership = $derived(this.#hasMembershipLookup());

  #hasMembershipLookup() {
    return this.#context.membership !== undefined;
  }

  emailChecked = $derived(
    this.checkedEmail !== '' && this.checkedEmail === this.customerEmail.trim().toLowerCase(),
  );

  membershipPending = $derived(
    this.checksMembership && (!this.emailChecked || this.#lookedUpMembership() === undefined),
  );

  memberRate = $derived(
    this.checksMembership ? (this.#lookedUpMembership() ?? false) : this.isMember,
  );

  lineItems = $derived.by(() => {
    const rates = this.#context.rates();
    return rates ? bookingLineItems(this.request, rates, this.memberRate) : [];
  });

  total = $derived(lineItemsTotal(this.lineItems));

  hasCustomer = $derived(
    this.customerName.trim() !== '' &&
      EMAIL_PATTERN.test(this.customerEmail.trim()) &&
      this.customerPhone.trim() !== '',
  );

  canContinue = $derived(this.fits && this.hasCustomer);

  canSubmit = $derived(this.canContinue && !this.membershipPending);

  step = $state<CheckoutStep>(CHECKOUT_STEPS.DETAILS);

  next() {
    this.confirmEmail();
    if (this.canContinue) this.step = CHECKOUT_STEPS.PAYMENT;
  }

  back() {
    this.step = CHECKOUT_STEPS.DETAILS;
  }

  confirmEmail() {
    const email = this.customerEmail.trim().toLowerCase();
    this.checkedEmail = EMAIL_PATTERN.test(email) ? email : '';
  }

  customer() {
    return {
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      customerPhone: this.customerPhone,
    };
  }
}
