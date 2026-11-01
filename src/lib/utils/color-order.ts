// Greys, black and white have no meaningful hue, so sorting them by it scatters them through the
// rainbow. They are collected at the end instead, running dark to light.
const ACHROMATIC_SATURATION = 0.15;
const HUE_DEGREES = 360;
const ACHROMATIC_HUE = HUE_DEGREES + 1;

export type Hsl = { hue: number; saturation: number; lightness: number };

export function hexToHsl(hex: string): Hsl {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) return { hue: 0, saturation: 0, lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;

  return { hue: (((hue * 60) % HUE_DEGREES) + HUE_DEGREES) % HUE_DEGREES, saturation, lightness };
}

/** Orders colors the way a paint swatch book does: around the wheel first, neutrals last. */
export function byChromaticOrder(a: { hex: string }, b: { hex: string }) {
  const left = hexToHsl(a.hex);
  const right = hexToHsl(b.hex);

  const leftHue = left.saturation < ACHROMATIC_SATURATION ? ACHROMATIC_HUE : left.hue;
  const rightHue = right.saturation < ACHROMATIC_SATURATION ? ACHROMATIC_HUE : right.hue;

  return leftHue - rightHue || left.lightness - right.lightness;
}
