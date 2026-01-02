import { query } from '$app/server';
import { verifyAuth } from '$lib/remotes/utils';
import { squareService } from '$lib/server/services/square.service';

export const getSquareLocations = query(() => {
  verifyAuth();
  return squareService.getLocations();
});

export const getSquareCatalog = query(() => {
  verifyAuth();
  return squareService.getCatalog();
});
