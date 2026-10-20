import { cameraTuning, type CameraTuningCapabilities } from '$lib/utils/kiosk_camera';

export const CAMERA_RETRY_MS = 10_000;

/**
 * Keeps the kiosk camera running unattended. iOS cuts the camera when the iPad sleeps and
 * doesn't hand it back on wake, so the stream is rebuilt whenever the page becomes visible again.
 */
export class KioskCamera {
  /** Changing this remounts the stream, which asks for a fresh camera. */
  streamId = $state(crypto.randomUUID());
  video = $state<HTMLVideoElement | null>(null);
  loading = $state(true);
  error = $state(false);

  #retryTimer: ReturnType<typeof setTimeout> | undefined;
  #track: MediaStreamTrack | null = null;
  #onTrackEnded = () => this.restart();

  async started() {
    this.loading = false;
    this.error = false;

    const stream = this.video?.srcObject;
    if (!(stream instanceof MediaStream)) return;
    const [track] = stream.getVideoTracks();
    if (!track) return;

    this.#watch(track);
    await this.#tune(track);
  }

  failed() {
    this.loading = false;
    this.error = true;
    clearTimeout(this.#retryTimer);
    this.#retryTimer = setTimeout(() => this.restart(), CAMERA_RETRY_MS);
  }

  visibilityChanged() {
    if (document.visibilityState === 'visible') this.restart();
  }

  restart() {
    clearTimeout(this.#retryTimer);
    this.#unwatch();
    this.loading = true;
    this.error = false;
    this.streamId = crypto.randomUUID();
  }

  destroy() {
    clearTimeout(this.#retryTimer);
    this.#unwatch();
  }

  #watch(track: MediaStreamTrack) {
    this.#unwatch();
    this.#track = track;
    track.addEventListener('ended', this.#onTrackEnded);
  }

  #unwatch() {
    this.#track?.removeEventListener('ended', this.#onTrackEnded);
    this.#track = null;
  }

  async #tune(track: MediaStreamTrack) {
    const capabilities = track.getCapabilities?.() as CameraTuningCapabilities | undefined;
    const tuning = cameraTuning(capabilities ?? {});
    if (Object.keys(tuning).length === 0) return;

    try {
      await track.applyConstraints({ advanced: [tuning as MediaTrackConstraintSet] });
    } catch (error) {
      console.warn('Kiosk camera rejected tuning', tuning, error);
    }
  }
}
