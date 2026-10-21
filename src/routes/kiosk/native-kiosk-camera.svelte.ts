import {
  nativeCameraFrame,
  TARGET_EXPOSURE_COMPENSATION_EV,
  NATIVE_ZOOM,
  type NativeCameraFrame,
} from '$lib/utils/kiosk_camera';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { CAMERA_RETRY_MS } from './kiosk-camera.svelte';

const KIOSK_SCANNER_PLUGIN = 'KioskScanner';
const SCAN_EVENT = 'scan';

interface KioskScannerPlugin {
  start(options: NativeCameraFrame & { zoom: number; exposureBias: number }): Promise<void>;
  stop(): Promise<void>;
  setFrame(frame: NativeCameraFrame): Promise<void>;
  setHidden(options: { hidden: boolean }): Promise<void>;
  addListener(
    event: typeof SCAN_EVENT,
    listener: (scan: { value: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const KioskScanner = registerPlugin<KioskScannerPlugin>(KIOSK_SCANNER_PLUGIN);

/** True inside the kiosk iPad app, which scans with the native camera so it can control exposure. */
export function hasNativeCamera() {
  return Capacitor.isPluginAvailable(KIOSK_SCANNER_PLUGIN);
}

/**
 * Drives the app's native camera, which is drawn over the page at the attached element's position.
 * Anything the page shows on top of the camera has to hide it.
 */
export class NativeKioskCamera {
  loading = $state(true);
  error = $state(false);

  #onScan: (value: string) => void;
  #element: HTMLElement | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #scanListener: Promise<PluginListenerHandle> | null = null;
  #retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(onScan: (value: string) => void) {
    this.#onScan = onScan;
  }

  attach = (element: HTMLElement) => {
    this.#element = element;
    this.#scanListener = KioskScanner.addListener(SCAN_EVENT, ({ value }) => this.#onScan(value));
    this.#resizeObserver = new ResizeObserver(() => this.#place());
    this.#resizeObserver.observe(element);
    this.#start();

    return () => this.#detach();
  };

  setHidden(hidden: boolean) {
    void KioskScanner.setHidden({ hidden });
  }

  async #start() {
    if (!this.#element) return;
    this.loading = true;
    this.error = false;

    try {
      await KioskScanner.start({
        ...this.#frame(this.#element),
        zoom: NATIVE_ZOOM,
        exposureBias: TARGET_EXPOSURE_COMPENSATION_EV,
      });
      this.loading = false;
    } catch (error) {
      console.warn('Kiosk native camera failed to start', error);
      this.loading = false;
      this.error = true;
      this.#retryTimer = setTimeout(() => this.#start(), CAMERA_RETRY_MS);
    }
  }

  #place() {
    if (this.#element) void KioskScanner.setFrame(this.#frame(this.#element));
  }

  #frame(element: HTMLElement) {
    const frame = element.offsetParent ?? element;
    return nativeCameraFrame(
      element.getBoundingClientRect(),
      parseFloat(getComputedStyle(frame).borderTopLeftRadius),
      frame.clientTop,
    );
  }

  #detach() {
    clearTimeout(this.#retryTimer);
    this.#resizeObserver?.disconnect();
    void this.#scanListener?.then((listener) => listener.remove());
    void KioskScanner.stop();
    this.#element = null;
  }
}
