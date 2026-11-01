import { command, query } from '$app/server';
import { exposeUserErrors, verifyAuth, verifySquareSigning } from '$lib/remotes/utils';
import { squareService } from '$lib/server/services/square.service';

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
    return squareService.syncSubscriptions({ onboardNewMembers: false });
  }),
);

export const handleSquareWebhook = command(
  'unchecked',
  exposeUserErrors(async (body: string) => {
    await verifySquareSigning(body);
    const webhookData = JSON.parse(body);
    return await squareService.processWebhook(webhookData);
  }),
);
