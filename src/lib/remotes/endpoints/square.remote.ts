import { command, query } from '$app/server';
import { staffOnly } from '$lib/server/remote-utils';
import { NEW_MEMBER_ONBOARDING, squareService } from '$lib/server/services/square.service';

export const getSquareLocations = query(staffOnly(() => squareService.getLocations()));

export const getSquareCatalog = query(staffOnly(() => squareService.getCatalog()));

export const syncSquareMembers = command(
  staffOnly(() => squareService.syncSubscriptions(NEW_MEMBER_ONBOARDING.SKIP)),
);
