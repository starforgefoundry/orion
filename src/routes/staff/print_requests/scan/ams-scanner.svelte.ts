import { updateAMSForPrinter } from '$lib/remotes/endpoints/print_materials.remote';
import type { DetectedBarcode } from 'barqode';
import { toast } from 'svelte-sonner';
import { isFilamentTag, isPrinterLabel, printerLabelName } from './ams-scan';

// The five labels sit far enough from the camera that each QR lands on ~60px of sensor at
// 1080p. Below that the decoder stops resolving modules and the scan looks "flaky". Ask for
// as much resolution as the camera will give, and pin the object so barqode doesn't read it
// as a settings change and restart the stream on every render.
export const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'environment',
  width: { ideal: 2560 },
  height: { ideal: 1440 },
  // focusMode is widely supported on phones but missing from the DOM typings
  advanced: [{ focusMode: 'continuous' }] as unknown as MediaTrackConstraintSet[],
};

export const AMS_SLOT_COUNT = 4;

/** A code drops off once the camera hasn't seen it for this long. */
export const CODE_TTL_MS = 1500;
const PRUNE_INTERVAL_MS = 100;
/** Two sightings of the same value closer than this are the same physical label. */
export const SAME_LABEL_DISTANCE_PX = 50;

const CODE_OUTLINE_COLOR = '#ff0000';
const CODE_OUTLINE_WIDTH = 4;

type TrackedCode = {
  code: DetectedBarcode;
  lastSeen: number;
};

function center(code: DetectedBarcode) {
  const { left, top, width, height } = code.boundingBox;
  return { x: left + width / 2, y: top + height / 2 };
}

function isSameLabel(a: DetectedBarcode, b: DetectedBarcode) {
  if (a.rawValue !== b.rawValue) return false;

  const aCenter = center(a);
  const bCenter = center(b);
  return Math.hypot(aCenter.x - bCenter.x, aCenter.y - bCenter.y) < SAME_LABEL_DISTANCE_PX;
}

function outline(code: DetectedBarcode, ctx: CanvasRenderingContext2D) {
  const [firstPoint, ...otherPoints] = code.cornerPoints;

  ctx.strokeStyle = CODE_OUTLINE_COLOR;
  ctx.lineWidth = CODE_OUTLINE_WIDTH;
  ctx.beginPath();
  ctx.moveTo(firstPoint.x, firstPoint.y);
  for (const { x, y } of otherPoints) {
    ctx.lineTo(x, y);
  }
  ctx.lineTo(firstPoint.x, firstPoint.y);
  ctx.closePath();
  ctx.stroke();
}

export class AmsScanner {
  loadingCamera = $state(true);
  updating = $state(false);
  torchOn = $state(false);
  torchSupported = $state(false);

  #tracked = $state<TrackedCode[]>([]);

  get codes() {
    return this.#tracked.map((tracked) => tracked.code);
  }

  get printer() {
    return this.codes.find((code) => isPrinterLabel(code.rawValue));
  }

  get printerName() {
    return this.printer && printerLabelName(this.printer.rawValue);
  }

  get filaments() {
    return this.codes.filter((code) => isFilamentTag(code.rawValue));
  }

  get hasAllFilaments() {
    return this.filaments.length === AMS_SLOT_COUNT;
  }

  get canUpdate() {
    return this.hasAllFilaments && !!this.printer && !this.updating;
  }

  /** Starts dropping codes that left the frame. Returns a function that stops it. */
  start() {
    const interval = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
    return () => clearInterval(interval);
  }

  cameraOn(capabilities: MediaTrackCapabilities) {
    this.loadingCamera = false;
    this.torchSupported = 'torch' in capabilities;
  }

  toggleTorch() {
    this.torchOn = !this.torchOn;
  }

  /** Records a camera frame's codes and outlines them on the overlay. */
  track(detected: DetectedBarcode[], ctx: CanvasRenderingContext2D) {
    if (this.updating) return;

    this.see(detected);
    for (const code of detected) outline(code, ctx);
  }

  see(detected: DetectedBarcode[], now = Date.now()) {
    if (this.updating) return;

    const previous = this.#tracked;
    const tracked = [...previous];
    const matched = new Set<TrackedCode>();

    for (const code of detected) {
      const existing = previous.find(
        (candidate) => !matched.has(candidate) && isSameLabel(candidate.code, code),
      );

      if (existing) {
        matched.add(existing);
        tracked[previous.indexOf(existing)] = { code, lastSeen: now };
      } else {
        tracked.push({ code, lastSeen: now });
      }
    }

    this.#tracked = tracked;
  }

  prune(now = Date.now()) {
    if (this.updating) return;

    this.#tracked = this.#tracked.filter((tracked) => now - tracked.lastSeen <= CODE_TTL_MS);
  }

  async updateAms() {
    const printer = this.printer;
    if (!printer) return;

    this.updating = true;
    try {
      const filaments = this.filaments
        .toSorted((a, b) => a.boundingBox.left - b.boundingBox.left)
        .map((code) => code.rawValue);

      await updateAMSForPrinter({ printer_id: printer.rawValue, filaments });

      toast.success('AMS updated successfully');
    } catch {
      toast.error('Failed to update AMS');
    } finally {
      this.updating = false;
    }
  }
}
