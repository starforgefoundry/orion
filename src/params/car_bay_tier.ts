import { CAR_BAY_TIER, type CarBayTier } from '$lib/utils/car_bay';
import type { ParamMatcher } from '@sveltejs/kit';

const TIERS: string[] = Object.values(CAR_BAY_TIER);

export const match = ((param: string): param is CarBayTier =>
  TIERS.includes(param)) satisfies ParamMatcher;
