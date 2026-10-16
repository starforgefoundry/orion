import { KIOSK_CHECK_IN_STATUS, type KioskCheckInResult } from '$lib/remotes/dtos/kiosk.dto';
import { checkInKiosk } from '$lib/remotes/endpoints/kiosk.remote';
import { isHttpError } from '@sveltejs/kit';

const RESULT_DISPLAY_MS = 6_000;
const WAIVER_IDLE_TIMEOUT_MS = 3 * 60_000;
// The camera reports a held pass on every frame; it must leave view this long to scan again.
const REPEAT_SCAN_COOLDOWN_MS = 8_000;
const UNAUTHORIZED = 401;

export const KIOSK_SCREEN = {
  SCANNING: 'scanning',
  CHECKING: 'checking',
  RESULT: 'result',
  WAIVER: 'waiver',
  UNPAIRED: 'unpaired',
} as const;

export type KioskScreen = (typeof KIOSK_SCREEN)[keyof typeof KIOSK_SCREEN];

export const KIOSK_ERROR = 'error';

type NeedsWaiver = Extract<
  KioskCheckInResult,
  { status: typeof KIOSK_CHECK_IN_STATUS.NEEDS_WAIVER }
>;
type KioskError = { status: typeof KIOSK_ERROR };
export type KioskDisplayResult = Exclude<KioskCheckInResult, NeedsWaiver> | KioskError;

export class KioskManager {
  screen = $state<KioskScreen>(KIOSK_SCREEN.SCANNING);
  result = $state<KioskDisplayResult | null>(null);
  waiver = $state<NeedsWaiver | null>(null);

  #lastScan: { value: string; at: number } | null = null;
  #returnTimer: ReturnType<typeof setTimeout> | undefined;

  async scan(value: string) {
    if (this.#isRepeat(value)) {
      this.#lastScan = { value, at: Date.now() };
      return;
    }
    if (this.screen !== KIOSK_SCREEN.SCANNING) return;

    this.#lastScan = { value, at: Date.now() };
    this.screen = KIOSK_SCREEN.CHECKING;

    try {
      this.show(await checkInKiosk(value));
    } catch (error) {
      this.fail(error);
    }
  }

  show(result: KioskCheckInResult | KioskError) {
    if (result.status === KIOSK_CHECK_IN_STATUS.NEEDS_WAIVER) {
      this.waiver = result;
      this.screen = KIOSK_SCREEN.WAIVER;
      this.#returnAfter(WAIVER_IDLE_TIMEOUT_MS);
      return;
    }

    this.waiver = null;
    this.result = result;
    this.screen = KIOSK_SCREEN.RESULT;
    this.#returnAfter(RESULT_DISPLAY_MS);
  }

  /** Keeps the waiver open while someone is still filling it in. */
  keepWaiverOpen() {
    if (this.screen === KIOSK_SCREEN.WAIVER) this.#returnAfter(WAIVER_IDLE_TIMEOUT_MS);
  }

  reset() {
    clearTimeout(this.#returnTimer);
    if (this.screen === KIOSK_SCREEN.UNPAIRED) return;

    if (this.#lastScan) this.#lastScan.at = Date.now();
    this.result = null;
    this.waiver = null;
    this.screen = KIOSK_SCREEN.SCANNING;
  }

  destroy() {
    clearTimeout(this.#returnTimer);
  }

  fail(error: unknown) {
    if (isHttpError(error, UNAUTHORIZED)) {
      clearTimeout(this.#returnTimer);
      this.screen = KIOSK_SCREEN.UNPAIRED;
      return;
    }
    this.show({ status: KIOSK_ERROR });
  }

  #isRepeat(value: string) {
    return (
      this.#lastScan?.value === value && Date.now() - this.#lastScan.at < REPEAT_SCAN_COOLDOWN_MS
    );
  }

  #returnAfter(delayMs: number) {
    clearTimeout(this.#returnTimer);
    this.#returnTimer = setTimeout(() => this.reset(), delayMs);
  }
}
