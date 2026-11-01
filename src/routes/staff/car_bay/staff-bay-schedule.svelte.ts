import type { BayClosureSlot } from '$lib/frontend/components/BayWeekCalendar.svelte';
import { DATE_FORMAT } from '$lib/frontend/format';
import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { DAYS_IN_WEEK } from '$lib/frontend/month-grid';
import { getCarBayStaffSchedule, reopenCarBay } from '$lib/remotes/endpoints/car-bay.remote';
import { getCarBayPolicy } from '$lib/remotes/endpoints/settings.remote';
import { SPACE_ZONE } from '$lib/utils/space';
import {
  CAR_BAY_STATUS,
  CAR_BAY_TIER,
  CarBayRules,
  consecutiveDates,
  formatPeriod,
  toPeriod,
} from '$lib/utils/car-bay';
import { DateTime } from 'luxon';
import BookingDetailModal from './BookingDetailModal.svelte';
import StaffBookingModal from './StaffBookingModal.svelte';

/** Staff can book any time, however far ahead. */
const STAFF_BOOKING = { enforceHorizon: false };

export class StaffBaySchedule {
  readonly today = DateTime.now().setZone(SPACE_ZONE).startOf('day');
  weekStart = $state(this.today.startOf('week'));

  readonly policy = getCarBayPolicy();
  readonly days = $derived(consecutiveDates(this.weekStart.toISODate()!, DAYS_IN_WEEK));
  readonly schedule = $derived(
    getCarBayStaffSchedule({ from: this.days[0], to: this.days.at(-1)! }),
  );
  readonly rules = $derived(this.policy.current && new CarBayRules(this.policy.current));
  readonly bookings = $derived(
    (this.schedule.current?.bookings ?? []).filter(
      (booking) => booking.status === CAR_BAY_STATUS.CONFIRMED,
    ),
  );
  readonly closures = $derived(this.schedule.current?.closures ?? []);
  readonly blocks = $derived(
    this.rules
      ? this.rules.scheduleBlocks({ bookings: this.bookings, closures: this.closures })
      : [],
  );

  get weekLabel() {
    const weekEnd = this.weekStart.plus({ days: DAYS_IN_WEEK - 1 });
    return `${this.weekStart.toFormat(DATE_FORMAT.MONTH_DAY)} – ${weekEnd.toFormat(DATE_FORMAT.MONTH_DAY_YEAR)}`;
  }

  previousWeek() {
    this.weekStart = this.weekStart.minus({ weeks: 1 });
  }

  nextWeek() {
    this.weekStart = this.weekStart.plus({ weeks: 1 });
  }

  isSlotOpen(date: string, startHour: number) {
    if (!this.rules) return false;
    return this.rules.requestFits(
      { tier: CAR_BAY_TIER.QUICK_JOB, date, startHour },
      this.blocks,
      DateTime.now(),
      STAFF_BOOKING,
    );
  }

  async refresh() {
    await this.schedule.refresh();
  }

  openNewBooking(date: string, startHour: number) {
    if (!this.rules) return;
    modalManager.show(StaffBookingModal, {
      date,
      startHour,
      blocks: () => this.blocks,
      rules: this.rules,
      onBooked: () => this.refresh(),
    });
  }

  openFirstAvailable() {
    if (!this.rules) return;
    const date = this.today.toISODate()!;
    this.openNewBooking(date, this.rules.slotHours(date)[0]);
  }

  openBooking(bookingId: string) {
    if (!this.rules) return;
    modalManager.show(BookingDetailModal, {
      bookingId,
      refundCutoffHours: this.rules.policy.refundCutoffHours,
      onChanged: () => this.refresh(),
    });
  }

  async reopen(closure: BayClosureSlot) {
    const confirmed = await modalManager.confirm({
      title: 'Reopen Car Bay',
      prompt: `Remove the closure on ${formatPeriod(toPeriod(closure))}? Customers can book this time again.`,
      confirmText: 'Reopen',
    });
    if (!confirmed) return;

    const reopened = await submitWithToast(() => reopenCarBay({ closureId: closure.id }), {
      success: 'Bay reopened',
      error: 'Failed to reopen the bay',
    });
    if (reopened) await this.refresh();
  }
}
