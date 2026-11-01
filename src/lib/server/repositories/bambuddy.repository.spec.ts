import { describe, expect, it } from 'vitest';
import { printerForLabel, type BambuddyPrinter } from './bambuddy.repository';

const PRINTERS: BambuddyPrinter[] = [
  { id: 1, name: 'SF 01', model: 'X1C', is_active: true },
  { id: 2, name: 'SF 02', model: 'P1S', is_active: true },
];

describe(printerForLabel.name, () => {
  it('matches the printer whose name without spaces follows the label prefix', () => {
    expect(printerForLabel(PRINTERS, 'SF-02')?.id).toBe(2);
  });

  it('matches nothing for a label without the prefix', () => {
    expect(printerForLabel(PRINTERS, '02')).toBeUndefined();
  });
});
