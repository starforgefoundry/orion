import { describe, expect, it } from 'vitest';
import {
  TARGET_EXPOSURE_COMPENSATION_EV,
  TARGET_ZOOM,
  cameraTuning,
  nativeCameraFrame,
} from './kiosk_camera';

describe('cameraTuning', () => {
  it('lowers exposure when the camera supports it', () => {
    expect(
      cameraTuning({
        exposureMode: ['manual', 'continuous'],
        exposureCompensation: { min: -3, max: 3 },
      }),
    ).toEqual({
      exposureMode: 'continuous',
      exposureCompensation: TARGET_EXPOSURE_COMPENSATION_EV,
    });
  });

  it('stays within the camera exposure range', () => {
    expect(cameraTuning({ exposureCompensation: { min: -1, max: 1 } })).toEqual({
      exposureCompensation: -1,
    });
  });

  it('zooms in when the camera supports zoom', () => {
    expect(cameraTuning({ zoom: { min: 1, max: 5 } })).toEqual({ zoom: TARGET_ZOOM });
  });

  it('stays within the camera zoom range', () => {
    expect(cameraTuning({ zoom: { min: 1, max: 1.5 } })).toEqual({ zoom: 1.5 });
  });

  it('changes nothing on a camera without these controls', () => {
    expect(cameraTuning({})).toEqual({});
  });
});

describe('nativeCameraFrame', () => {
  const inner = { x: 36, y: 36, width: 800, height: 600 };

  it('rounds the camera to fit inside the frame border', () => {
    expect(nativeCameraFrame(inner, 24, 4)).toEqual({ ...inner, cornerRadius: 20 });
  });

  it('keeps square corners when the border is wider than the rounding', () => {
    expect(nativeCameraFrame(inner, 2, 4).cornerRadius).toBe(0);
  });
});
