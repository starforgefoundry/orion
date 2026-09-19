import { byChromaticOrder, hexToHsl } from '$lib/utils/color_order';
import { describe, expect, it } from 'vitest';

function order(hexes: string[]) {
  return hexes.map((hex) => ({ hex })).toSorted(byChromaticOrder);
}

describe('hexToHsl', () => {
  it('reads pure red as hue zero', () => {
    expect(hexToHsl('#FF0000')).toMatchObject({ hue: 0, saturation: 1, lightness: 0.5 });
  });

  it('reads pure green at 120 degrees', () => {
    expect(hexToHsl('#00FF00').hue).toBe(120);
  });

  it('reads pure blue at 240 degrees', () => {
    expect(hexToHsl('#0000FF').hue).toBe(240);
  });

  it('gives grey no saturation', () => {
    expect(hexToHsl('#808080').saturation).toBe(0);
  });

  it('accepts a hex without the leading hash', () => {
    expect(hexToHsl('FF0000').hue).toBe(0);
  });
});

describe('byChromaticOrder', () => {
  it('walks around the colour wheel', () => {
    const sorted = order(['#0000FF', '#00FF00', '#FF0000']);

    expect(sorted.map((color) => color.hex)).toEqual(['#FF0000', '#00FF00', '#0000FF']);
  });

  it('puts neutrals after every colour', () => {
    const sorted = order(['#FFFFFF', '#FF0000', '#808080', '#0000FF']);

    expect(sorted.map((color) => color.hex)).toEqual(['#FF0000', '#0000FF', '#808080', '#FFFFFF']);
  });

  it('runs neutrals dark to light', () => {
    const sorted = order(['#FFFFFF', '#000000', '#808080']);

    expect(sorted.map((color) => color.hex)).toEqual(['#000000', '#808080', '#FFFFFF']);
  });

  it('separates two shades of one hue by lightness', () => {
    const sorted = order(['#FF9999', '#660000']);

    expect(sorted.map((color) => color.hex)).toEqual(['#660000', '#FF9999']);
  });
});
