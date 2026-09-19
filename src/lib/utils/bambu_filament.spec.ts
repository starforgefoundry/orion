import {
  baseMaterial,
  genericFilamentId,
  nozzleTemps,
  toTrayColor,
} from '$lib/utils/bambu_filament';
import { describe, expect, it } from 'vitest';

describe('baseMaterial', () => {
  it('reads a trade name that runs the material into a prefix', () => {
    expect(baseMaterial('HTPLA')).toBe('PLA');
  });

  it('keeps PETG whole rather than matching PET inside it', () => {
    expect(baseMaterial('rPETG')).toBe('PETG');
  });

  it('finds nylon in a vendor trade name', () => {
    expect(baseMaterial('NylonX')).toBe('NYLON');
  });

  it('prefers a whole word over a loose match', () => {
    expect(baseMaterial('PolyTerra PLA')).toBe('PLA');
  });

  it('returns null for a trade name with no recognisable material', () => {
    expect(baseMaterial('CPE HG100')).toBeNull();
  });

  it('does not read a two-letter code out of the middle of a trade name', () => {
    expect(baseMaterial('Panchroma')).toBeNull();
  });
});

describe('genericFilamentId', () => {
  it('matches a plain material', () => {
    expect(genericFilamentId('PLA')).toBe('GFL99');
  });

  it('falls back to the base material when the exact blend is unknown', () => {
    expect(genericFilamentId('PLA-GF')).toBe('GFL99');
  });

  it('returns empty for a material Bambu has no generic for', () => {
    expect(genericFilamentId('PEEK')).toBe('');
  });
});

describe('nozzleTemps', () => {
  it('reads PCTG as its own material, not as PC', () => {
    expect(nozzleTemps('PCTG')).toEqual({ min: 220, max: 260 });
  });

  it('handles blends by their base material', () => {
    expect(nozzleTemps('PLA-CF')).toEqual({ min: 190, max: 230 });
  });

  it('defaults to the PLA range for an unknown material', () => {
    expect(nozzleTemps('PEEK')).toEqual({ min: 190, max: 230 });
  });
});

describe('toTrayColor', () => {
  it('drops the hash and appends full opacity', () => {
    expect(toTrayColor('#C12E1F')).toBe('C12E1FFF');
  });

  it('falls back to white when no color is set', () => {
    expect(toTrayColor(null)).toBe('FFFFFFFF');
  });

  it('falls back to white for a malformed color', () => {
    expect(toTrayColor('#nope')).toBe('FFFFFFFF');
  });
});
