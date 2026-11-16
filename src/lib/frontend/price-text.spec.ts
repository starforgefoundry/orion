import { describe, expect, it } from 'vitest';
import { cleanPriceText, priceFromText } from './price-text';

const CENTS_PER_DOLLAR = 100;

describe(cleanPriceText.name, () => {
  it('drops everything but digits and the first decimal point', () => {
    expect(cleanPriceText('$1,2a3.4.5')).toBe('123.45');
  });

  it('keeps a trailing decimal point while it is being typed', () => {
    expect(cleanPriceText('40.')).toBe('40.');
  });
});

describe(priceFromText.name, () => {
  it('scales the typed amount to cents', () => {
    expect(priceFromText('40', CENTS_PER_DOLLAR)).toBe(4000);
    expect(priceFromText('12.345', CENTS_PER_DOLLAR)).toBe(1235);
  });

  it('reads a partly typed amount', () => {
    expect(priceFromText('40.', CENTS_PER_DOLLAR)).toBe(4000);
  });

  it('treats an empty field as zero', () => {
    expect(priceFromText('', CENTS_PER_DOLLAR)).toBe(0);
  });
});
