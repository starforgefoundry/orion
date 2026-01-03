import { command, query } from '$app/server';
import { verifyAuth, verifySquareSigning } from '$lib/remotes/utils';
import { squareService } from '$lib/server/services/square.service';

export const getSquareLocations = query(() => {
  verifyAuth();
  return squareService.getLocations();
});

export const getSquareCatalog = query(() => {
  verifyAuth();
  return squareService.getCatalog();
});

export const handleSquareWebhook = command('unchecked', async (body: string) => {
  await verifySquareSigning(body);
  const webhookData = JSON.parse(body);
  return await squareService.processWebhook(webhookData);
});
