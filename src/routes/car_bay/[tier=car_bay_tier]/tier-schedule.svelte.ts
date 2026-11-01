import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { getCarBaySchedule } from '$lib/remotes/endpoints/car_bay.remote';
import {
  CAR_BAY_TIER,
  CarBayRules,
  consecutiveDates,
  type CarBayRequest,
  type CarBayTier,
} from '$lib/utils/car_bay';
import { DateTime } from 'luxon';
import CheckoutModal from '../CheckoutModal.svelte';
import { CarBayOffer } from '../car-bay-offer.svelte';
import { tierDetails } from '../tiers';

/** Customers can only book within the booking horizon. */
const CUSTOMER_BOOKING = { enforceHorizon: true };
const FULL_DAY_SLOT_DAYS = 1;

/** One booking tier's open times for customers. */
export class TierSchedule extends CarBayOffer {
  #schedule = getCarBaySchedule();

  readonly rules = $derived(this.policy && new CarBayRules(this.policy));
  readonly details = $derived(this.policy && tierDetails(this.policy)[this.tier]);
  readonly blocks = $derived(
    this.schedule && this.rules ? this.rules.scheduleBlocks(this.schedule) : [],
  );
  readonly days = $derived(
    this.schedule && this.policy
      ? consecutiveDates(this.schedule.today, this.policy.publicHorizonDays + 1)
      : [],
  );

  private getTier: () => CarBayTier;

  constructor(getTier: () => CarBayTier) {
    super();
    this.getTier = getTier;
  }

  get tier() {
    return this.getTier();
  }

  get schedule() {
    return this.#schedule.current;
  }

  override get loading() {
    return this.#schedule.loading || super.loading;
  }

  isSlotOpen(date: string, startHour: number) {
    if (!this.rules) return false;
    return this.rules.requestFits(
      this.shortestRequest(this.rules, date, startHour),
      this.blocks,
      DateTime.now(),
      CUSTOMER_BOOKING,
    );
  }

  isDayOpen(date: string) {
    return !!this.rules && this.isSlotOpen(date, this.rules.slotHours(date)[0]);
  }

  openCheckout(date: string, startHour: number) {
    if (!this.rates || !this.rules) return;
    modalManager.show(CheckoutModal, {
      tier: this.tier,
      date,
      startHour,
      bookings: () => this.blocks,
      rates: this.rates,
      rules: this.rules,
      onUnavailable: () => this.refresh(),
    });
  }

  openDay(date: string) {
    if (this.rules) this.openCheckout(date, this.rules.slotHours(date)[0]);
  }

  async refresh() {
    await this.#schedule.refresh();
  }

  private shortestRequest(rules: CarBayRules, date: string, startHour: number): CarBayRequest {
    const tier = this.tier;
    if (tier === CAR_BAY_TIER.QUICK_JOB) return { tier, date, startHour };
    if (tier === CAR_BAY_TIER.HOURLY) {
      return { tier, date, startHour, hours: rules.policy.hourlyMinHours };
    }
    return { tier, date, days: FULL_DAY_SLOT_DAYS };
  }
}
