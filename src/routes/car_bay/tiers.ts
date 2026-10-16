import {
  CAR_BAY_TIER,
  formatDollars,
  type CarBayRates,
  type CarBayTier,
  type PricePair,
} from '$lib/utils/car_bay';
import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
import ClockIcon from '@lucide/svelte/icons/clock';
import WrenchIcon from '@lucide/svelte/icons/wrench';
import type { Component } from 'svelte';

type TierDetails = { icon: Component; duration: string; copy: string };

export const TIER_DETAILS: Record<CarBayTier, TierDetails> = {
  [CAR_BAY_TIER.QUICK_JOB]: {
    icon: WrenchIcon,
    duration: '90 minutes',
    copy: 'Good for an oil change, a brake job or other quick maintenance.',
  },
  [CAR_BAY_TIER.HOURLY]: {
    icon: ClockIcon,
    duration: '2 hour minimum, whole hours',
    copy: 'Jobs almost always run longer than planned. Book 2.5 to 3 times what you expect.',
  },
  [CAR_BAY_TIER.FULL_DAY]: {
    icon: CalendarDaysIcon,
    duration: 'The whole day, 1 to 3 days',
    copy: 'Pick this if the job might take more than 3.5 hours.',
  },
};

export type PriceRow = { label?: string; member: string; nonMember: string };

function row(pair: PricePair, unit = '', label?: string): PriceRow {
  return {
    label,
    member: `${formatDollars(pair.member)}${unit}`,
    nonMember: `${formatDollars(pair.nonMember)}${unit}`,
  };
}

export function priceRows(rates: CarBayRates, tier: CarBayTier): PriceRow[] {
  if (tier === CAR_BAY_TIER.QUICK_JOB) return [row(rates.quickJob)];
  if (tier === CAR_BAY_TIER.HOURLY) return [row(rates.hourly, '/hr')];
  return [row(rates.fullDayWeekday, '', 'Weekday'), row(rates.fullDayWeekend, '', 'Weekend')];
}
