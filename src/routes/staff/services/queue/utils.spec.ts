import { PAYMENT_STATUS } from '$lib/utils/billing';
import { SERVICE_PRICING } from '$lib/utils/services';
import { describe, expect, it } from 'vitest';
import { canQuote, quoteRequired, STATUS } from './utils';

const unquoted = { status: PAYMENT_STATUS.QUOTE, lineItems: [] };
const quoted = { status: PAYMENT_STATUS.PENDING, lineItems: [{}] };

describe(quoteRequired.name, () => {
  it('blocks starting or finishing work until a quote is sent', () => {
    expect(quoteRequired(unquoted, STATUS.IN_PROGRESS)).toBe(true);
    expect(quoteRequired(unquoted, STATUS.DONE)).toBe(true);
  });

  it('allows moving an unquoted request back to submitted or canceling it', () => {
    expect(quoteRequired(unquoted, STATUS.SUBMITTED)).toBe(false);
    expect(quoteRequired(unquoted, STATUS.CANCELED)).toBe(false);
  });

  it('allows work once quoted', () => {
    expect(quoteRequired(quoted, STATUS.IN_PROGRESS)).toBe(false);
  });
});

describe(canQuote.name, () => {
  it('quotes variable requests until they are paid', () => {
    expect(canQuote(SERVICE_PRICING.VARIABLE, unquoted)).toBe(true);
    expect(canQuote(SERVICE_PRICING.VARIABLE, quoted)).toBe(true);
    expect(canQuote(SERVICE_PRICING.VARIABLE, { ...quoted, status: PAYMENT_STATUS.PAID })).toBe(
      false,
    );
  });

  it('never quotes fixed-price requests', () => {
    expect(canQuote(SERVICE_PRICING.FIXED, quoted)).toBe(false);
  });
});
