// Phone screens are much brighter than the room, so the camera blows them out at normal exposure.
export const TARGET_EXPOSURE_COMPENSATION_EV = -2;
// Safari can't set exposure. Zooming in lets the phone fill the frame, so auto-exposure meters on it.
export const TARGET_ZOOM = 2;
// The kiosk app meters on the center of the frame, so it can keep the full view.
export const NATIVE_ZOOM = 1;

const CONTINUOUS_EXPOSURE = 'continuous';

type Range = { min: number; max: number };

/** The camera controls the DOM typings leave out. */
export type CameraTuningCapabilities = {
  exposureMode?: string[];
  exposureCompensation?: Range;
  zoom?: Range;
};

export type CameraTuning = {
  exposureMode?: string;
  exposureCompensation?: number;
  zoom?: number;
};

function clamp(value: number, { min, max }: Range) {
  return Math.min(Math.max(value, min), max);
}

export type NativeCameraFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
};

/** Where the native camera sits so it fills the inside of the bordered frame. */
export function nativeCameraFrame(
  inner: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>,
  frameRadius: number,
  frameBorder: number,
): NativeCameraFrame {
  return {
    x: inner.x,
    y: inner.y,
    width: inner.width,
    height: inner.height,
    cornerRadius: Math.max(frameRadius - frameBorder, 0),
  };
}

/** Picks the settings that keep a phone screen readable, limited to what this camera supports. */
export function cameraTuning(capabilities: CameraTuningCapabilities): CameraTuning {
  const tuning: CameraTuning = {};

  if (capabilities.exposureMode?.includes(CONTINUOUS_EXPOSURE)) {
    tuning.exposureMode = CONTINUOUS_EXPOSURE;
  }
  if (capabilities.exposureCompensation) {
    tuning.exposureCompensation = clamp(
      TARGET_EXPOSURE_COMPENSATION_EV,
      capabilities.exposureCompensation,
    );
  }
  if (capabilities.zoom) {
    tuning.zoom = clamp(TARGET_ZOOM, capabilities.zoom);
  }

  return tuning;
}
