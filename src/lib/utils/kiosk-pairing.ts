export const KIOSK_PATH = '/kiosk';
export const KIOSK_PAIR_PATH = '/kiosk/pair';
export const KIOSK_PAIR_TOKEN_PARAM = 'token';
export const KIOSK_DEVICE_COOKIE = 'kiosk_device';

export function kioskPairPath(token: string) {
  const params = new URLSearchParams({ [KIOSK_PAIR_TOKEN_PARAM]: token });
  return `${KIOSK_PAIR_PATH}?${params}`;
}

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

  return kioskPairPath(token);
}
