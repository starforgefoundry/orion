/** Keeps digits and the first decimal point of what was typed into a price field. */
export function cleanPriceText(text: string) {
  const [whole, ...fractions] = text.replace(/[^0-9.]/g, '').split('.');
  return fractions.length > 0 ? `${whole}.${fractions.join('')}` : whole;
}

/** The amount a price field's text stands for, scaled by `multiplier` (100 for cents). */
export function priceFromText(text: string, multiplier: number) {
  const parsed = parseFloat(text);
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * multiplier);
}
