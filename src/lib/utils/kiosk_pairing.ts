import { KIOSK_PAIR_PATH, KIOSK_PAIR_TOKEN_PARAM } from '$lib/remotes/dtos/kiosk.dto';

/** Returns the same-origin pairing path for a scanned code, or null if it isn't a pairing link. */
export function kioskPairPathFromScan(scanned: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(scanned.trim());
  } catch {
    return null;
  }

  const token = url.searchParams.get(KIOSK_PAIR_TOKEN_PARAM);
  if (url.origin !== origin || url.pathname !== KIOSK_PAIR_PATH || !token) return null;

  const params = new URLSearchParams({ [KIOSK_PAIR_TOKEN_PARAM]: token });
  return `${KIOSK_PAIR_PATH}?${params}`;
}
