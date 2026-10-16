import {
  CAR_BAY_TIER,
  formatDollars,
  formatHour,
  type CarBayPolicy,
  type CarBayRates,
  type CarBayTier,
  type PricePair,
} from '$lib/utils/car_bay';
import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
import ClockIcon from '@lucide/svelte/icons/clock';
import WrenchIcon from '@lucide/svelte/icons/wrench';
import type { Component } from 'svelte';

type TierDetails = { icon: Component; duration: string; copy: string };

export function tierDetails(policy: CarBayPolicy): Record<CarBayTier, TierDetails> {
  return {
    [CAR_BAY_TIER.QUICK_JOB]: {
      icon: WrenchIcon,
      duration: `${policy.quickJobMinutes} minutes`,
      copy: 'Good for an oil change, a brake job or other quick maintenance.',
    },
    [CAR_BAY_TIER.HOURLY]: {
      icon: ClockIcon,
      duration: `${policy.hourlyMinHours} hour minimum, whole hours`,
      copy: 'Jobs almost always run longer than planned. Book 2.5 to 3 times what you expect.',
    },
    [CAR_BAY_TIER.FULL_DAY]: {
      icon: CalendarDaysIcon,
      duration: `The whole day, 1 to ${policy.fullDayMaxDays} days`,
      copy: 'Pick this if the job might take more than 3.5 hours.',
    },
  };
}

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

export function openHoursSummary(policy: CarBayPolicy) {
  const weekdays = `${formatHour(policy.weekdayOpenHour)} to ${formatHour(policy.weekdayCloseHour)}`;
  const weekends = `${formatHour(policy.weekendOpenHour)} to ${formatHour(policy.weekendCloseHour)}`;
  return `Open ${weekdays} on weekdays and ${weekends} on weekends.`;
}
