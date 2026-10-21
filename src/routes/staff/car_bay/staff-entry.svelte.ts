import { CarBayBookingForm } from '$lib/frontend/car-bay-booking-form.svelte';
import { submitWithToast } from '$lib/frontend/form-submit';
import { staffBookCarBay, staffCloseCarBay } from '$lib/remotes/endpoints/car_bay.remote';
import {
  CAR_BAY_TIER,
  CAR_BAY_TIER_NAMES,
  type CarBayBlock,
  type CarBayClosureRequest,
  type CarBayRules,
  type CarBayTier,
} from '$lib/utils/car_bay';

export const CLOSED_ENTRY = 'closed';

export type StaffEntryType = CarBayTier | typeof CLOSED_ENTRY;

export const STAFF_ENTRY_NAMES: Record<StaffEntryType, string> = {
  ...CAR_BAY_TIER_NAMES,
  [CLOSED_ENTRY]: 'Closed',
};

type EntryContext = { rules: CarBayRules; blocks: () => CarBayBlock[] };

type EntryStart = { date: string; startHour: number };

export class CarBayClosureForm {
  date = $state('');
  startHour = $state(0);
  endHour = $state(0);
  reason = $state('');

  #context: EntryContext;

  constructor(context: EntryContext, start: EntryStart) {
    this.#context = context;
    this.date = start.date;
    this.startHour = start.startHour;
    this.endHour = start.startHour + 1;
  }

  #rules() {
    return this.#context.rules;
  }

  #fits(request: CarBayClosureRequest) {
    return this.#rules().closureFits(request, this.#context.blocks());
  }

  request = $derived<CarBayClosureRequest>({
    date: this.date,
    startHour: this.startHour,
    endHour: this.endHour,
  });

  fits = $derived(this.#fits(this.request));

  period = $derived(this.fits ? this.#rules().resolveClosure(this.request) : null);

  startHourOptions = $derived(
    this.date
      ? this.#rules()
          .slotHours(this.date)
          .filter((startHour) => this.#fits({ date: this.date, startHour, endHour: startHour + 1 }))
      : [],
  );

  endHourOptions = $derived(
    this.date
      ? this.#rules()
          .slotHours(this.date)
          .map((hour) => hour + 1)
          .filter((endHour) => this.#fits({ ...this.request, endHour }))
      : [],
  );

  setStartHour(hour: number) {
    this.startHour = hour;
    if (this.endHour <= hour) this.endHour = hour + 1;
  }
}

/** The staff "New Booking" form, which either books a customer in or closes the bay. */
export class StaffBayEntry {
  type = $state<StaffEntryType>(CAR_BAY_TIER.QUICK_JOB);
  submitting = $state(false);

  readonly booking: CarBayBookingForm;
  readonly closure: CarBayClosureForm;

  constructor(context: EntryContext, start: EntryStart) {
    this.booking = new CarBayBookingForm(
      {
        bookings: context.blocks,
        rates: () => undefined,
        rules: context.rules,
        enforceHorizon: false,
      },
      { tier: CAR_BAY_TIER.QUICK_JOB, ...start },
    );
    this.closure = new CarBayClosureForm(context, start);
  }

  isClosure = $derived(this.type === CLOSED_ENTRY);

  canSubmit = $derived(this.#canSubmitActive());

  #canSubmitActive() {
    return this.isClosure ? this.closure.fits : this.booking.canSubmit;
  }

  get date() {
    return this.booking.date;
  }

  set date(date: string) {
    this.booking.date = date;
    this.closure.date = date;
  }

  setType(type: StaffEntryType) {
    this.type = type;
    if (type !== CLOSED_ENTRY) this.booking.tier = type;
  }

  async submit() {
    this.submitting = true;
    const ok = this.isClosure
      ? await submitWithToast(
          () => staffCloseCarBay({ ...this.closure.request, reason: this.closure.reason }),
          { success: 'Bay closed', error: 'Failed to close the bay' },
        )
      : await submitWithToast(
          () =>
            staffBookCarBay({
              request: this.booking.request,
              ...this.booking.customer(),
              isMember: this.booking.isMember,
            }),
          { success: 'Booking added', error: 'Failed to add booking' },
        );
    this.submitting = false;
    return ok;
  }
}
