// Bambuddy names filaments the way a vendor's catalogue does ("Bambu PLA Basic", "rPETG"), but the
// AMS slot command wants the fields Bambu Studio would have sent. These functions rebuild those
// fields the same way Bambuddy's own Configure AMS Slot dialog does.

const MATERIAL_TYPES = [
  'PLA',
  'PETG',
  'PCTG',
  'ABS',
  'ASA',
  'TPU',
  'PC',
  'PA',
  'NYLON',
  'PVA',
  'HIPS',
  'PP',
  'PET',
];

const GENERIC_FILAMENT_IDS: Record<string, string> = {
  PLA: 'GFL99',
  'PLA-CF': 'GFL98',
  'PLA SILK': 'GFL96',
  'PLA HIGH SPEED': 'GFL95',
  PETG: 'GFG99',
  'PETG HF': 'GFG96',
  'PETG-CF': 'GFG98',
  PCTG: 'GFG97',
  ABS: 'GFB99',
  ASA: 'GFB98',
  PC: 'GFC99',
  PA: 'GFN99',
  'PA-CF': 'GFN98',
  NYLON: 'GFN99',
  TPU: 'GFU99',
  PVA: 'GFS99',
  HIPS: 'GFS98',
  PE: 'GFP99',
  PP: 'GFP97',
};

const NOZZLE_TEMPS: [match: (material: string) => boolean, min: number, max: number][] = [
  [(m) => m === 'PCTG', 220, 260],
  [(m) => m.includes('PLA'), 190, 230],
  [(m) => m.includes('PETG'), 220, 260],
  [(m) => m.includes('ABS'), 240, 280],
  [(m) => m.includes('ASA'), 240, 280],
  [(m) => m.includes('TPU'), 200, 240],
  [(m) => m.includes('PC'), 260, 300],
  [(m) => m.includes('PA') || m.includes('NYLON'), 250, 290],
];

const DEFAULT_NOZZLE_TEMPS = { min: 190, max: 230 };

// Two-letter codes like PA and PC turn up inside ordinary trade names — "Panchroma" is not a
// polyamide — so only longer codes are worth matching mid-word.
const LOOSE_MATCH_MIN_LENGTH = 3;

/**
 * The stock material a vendor's trade name is built on. Whole words win first so "PLA Support for
 * PETG" is not read as PET, then a loose match catches names that run the material together with
 * something else, like HTPLA, rPETG or NylonX.
 */
export function baseMaterial(name: string): string | null {
  const upper = name.toUpperCase();

  return (
    MATERIAL_TYPES.find((type) => new RegExp(`\\b${type}\\b`).test(upper)) ??
    MATERIAL_TYPES.find((type) => type.length >= LOOSE_MATCH_MIN_LENGTH && upper.includes(type)) ??
    null
  );
}

/** The closest stock Bambu filament for a material, so firmware still recognises a custom preset. */
export function genericFilamentId(material: string): string {
  const upper = material.toUpperCase();

  return (
    GENERIC_FILAMENT_IDS[upper] ??
    GENERIC_FILAMENT_IDS[upper.replace(/[-\s]?CF$/, '')] ??
    GENERIC_FILAMENT_IDS[upper.replace(/\+$/, '')] ??
    GENERIC_FILAMENT_IDS[upper.split(/[-\s]/)[0]] ??
    ''
  );
}

export function nozzleTemps(material: string): { min: number; max: number } {
  const upper = material.toUpperCase();
  const match = NOZZLE_TEMPS.find(([test]) => test(upper));

  return match ? { min: match[1], max: match[2] } : DEFAULT_NOZZLE_TEMPS;
}

/** AMS colors are RRGGBBAA, and the picker gives us "#RRGGBB". */
export function toTrayColor(colorHex: string | null): string {
  const hex = (colorHex ?? '').replace('#', '').toUpperCase();

  return /^[0-9A-F]{6}$/.test(hex) ? `${hex}FF` : 'FFFFFFFF';
}
