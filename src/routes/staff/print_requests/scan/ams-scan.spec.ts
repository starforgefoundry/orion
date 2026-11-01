import { EMPTY_SLOT_TAG_ID } from '$lib/utils/print-materials';
import { describe, expect, it } from 'vitest';
import { isFilamentTag, isPrinterLabel, printerLabelName } from './ams-scan';

describe(isPrinterLabel.name, () => {
  it('recognises printer labels by their prefix', () => {
    expect(isPrinterLabel('SF-02')).toBe(true);
    expect(isPrinterLabel('AB12CD34')).toBe(false);
  });
});

describe(isFilamentTag.name, () => {
  it('accepts tag ids and the empty slot card', () => {
    expect(isFilamentTag('AB12CD34')).toBe(true);
    expect(isFilamentTag(EMPTY_SLOT_TAG_ID)).toBe(true);
  });

  it('rejects printer labels and codes of other lengths', () => {
    expect(isFilamentTag('SF-X1C01')).toBe(false);
    expect(isFilamentTag('https://example.com')).toBe(false);
  });
});

describe(printerLabelName.name, () => {
  it('drops the label prefix', () => {
    expect(printerLabelName('SF-02')).toBe('02');
  });
});
