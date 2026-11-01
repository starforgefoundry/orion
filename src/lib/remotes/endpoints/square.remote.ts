import { command, query } from '$app/server';
import { exposeUserErrors, verifyAuth } from '$lib/remotes/utils';
import { NEW_MEMBER_ONBOARDING, squareService } from '$lib/server/services/square.service';

export const getSquareLocations = query(
  exposeUserErrors(() => {
    verifyAuth();
    return squareService.getLocations();
  }),
);

export const getSquareCatalog = query(
  exposeUserErrors(() => {
    verifyAuth();
    return squareService.getCatalog();
  }),
);

export const syncSquareMembers = command(
  exposeUserErrors(() => {
    verifyAuth();
    return squareService.syncSubscriptions(NEW_MEMBER_ONBOARDING.SKIP);
  }),
);
