import { describe, expect, it } from 'vitest';
import { PAYMENT_STATUS } from './billing';
import { BYTES_PER_MB } from './print-request';
import {
  answersProblem,
  awaitingQuote,
  canQuote,
  formAnswers,
  isCancelable,
  MAX_SERVICE_UPLOAD_MB,
  quoteRequired,
  SERVICE_PRICING,
  SERVICE_REQUEST_STATUS,
  storageFileName,
  type ServiceField,
} from './services';

const fields: ServiceField[] = [
  { id: 'a', label: 'Material', type: 'select', required: true, options: ['Wood', 'Acrylic'] },
  { id: 'b', label: 'Quantity', type: 'number', required: false, options: [] },
  { id: 'c', label: 'Design', type: 'file', required: false, options: [] },
];

describe('answersProblem', () => {
  it('accepts valid answers', () => {
    expect(answersProblem(fields, { a: 'Wood', b: 2 })).toBeUndefined();
  });
  it('requires required fields', () => {
    expect(answersProblem(fields, {})).toBe('Material is required.');
  });
  it('rejects unknown choices and non-numbers', () => {
    expect(answersProblem(fields, { a: 'Steel' })).toBe('Material has an invalid choice.');
    expect(answersProblem(fields, { a: 'Wood', b: 'x' })).toBe('Quantity must be a number.');
    expect(answersProblem(fields, { a: 'Wood', b: ' ' })).toBe('Quantity must be a number.');
    expect(answersProblem(fields, { a: 'Wood', b: '2.5' })).toBeUndefined();
  });
  it('rejects a string where a file belongs, and oversized files', () => {
    expect(answersProblem(fields, { a: 'Wood', c: 'service_requests/other/x' })).toBe(
      'Design needs a file.',
    );
    const file = new File([], 'big.svg');
    Object.defineProperty(file, 'size', { value: MAX_SERVICE_UPLOAD_MB * BYTES_PER_MB + 1 });
    expect(answersProblem(fields, { a: 'Wood', c: file })).toBe('Design must be at most 50 MB.');
  });
});

describe('formAnswers', () => {
  it('drops keys that are not on the form and empty answers', () => {
    expect(formAnswers(fields, { a: 'Wood', b: '', extra: 'x' })).toEqual({ a: 'Wood' });
  });
  it('stores number answers as numbers', () => {
    expect(formAnswers(fields, { a: 'Wood', b: '3' })).toEqual({ a: 'Wood', b: 3 });
  });
});

describe('awaitingQuote', () => {
  const item = { name: 'Engraving', quantity: 1, unitAmount: 500 };
  it('is true only for an empty quote', () => {
    expect(awaitingQuote({ status: 'quote', lineItems: [] })).toBe(true);
    expect(awaitingQuote({ status: 'quote', lineItems: [item] })).toBe(false);
    expect(awaitingQuote({ status: 'pending', lineItems: [item] })).toBe(false);
  });
});

describe('storageFileName', () => {
  it('keeps a safe single path segment', () => {
    expect(storageFileName('my design (1).svg')).toBe('my_design_1_.svg');
    expect(storageFileName('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(storageFileName('..')).toBe('file');
  });
});

const unquoted = { status: PAYMENT_STATUS.QUOTE, lineItems: [] };
const quoted = { status: PAYMENT_STATUS.PENDING, lineItems: [{}] };

describe('quoteRequired', () => {
  it('blocks starting or finishing work until a quote is sent', () => {
    expect(quoteRequired(unquoted, SERVICE_REQUEST_STATUS.IN_PROGRESS)).toBe(true);
    expect(quoteRequired(unquoted, SERVICE_REQUEST_STATUS.DONE)).toBe(true);
  });

  it('allows moving an unquoted request back to submitted or canceling it', () => {
    expect(quoteRequired(unquoted, SERVICE_REQUEST_STATUS.SUBMITTED)).toBe(false);
    expect(quoteRequired(unquoted, SERVICE_REQUEST_STATUS.CANCELED)).toBe(false);
  });

  it('allows work once quoted', () => {
    expect(quoteRequired(quoted, SERVICE_REQUEST_STATUS.IN_PROGRESS)).toBe(false);
  });
});

describe('canQuote', () => {
  it('quotes variable requests until they are paid', () => {
    expect(canQuote(SERVICE_PRICING.VARIABLE, unquoted)).toBe(true);
    expect(canQuote(SERVICE_PRICING.VARIABLE, quoted)).toBe(true);
    expect(canQuote(SERVICE_PRICING.VARIABLE, { status: PAYMENT_STATUS.PAID })).toBe(false);
    expect(canQuote(SERVICE_PRICING.VARIABLE, { status: PAYMENT_STATUS.PROCESSING })).toBe(false);
  });

  it('never quotes fixed-price requests', () => {
    expect(canQuote(SERVICE_PRICING.FIXED, quoted)).toBe(false);
  });
});

describe('isCancelable', () => {
  it('only cancels while the payment is a quote or pending', () => {
    expect(isCancelable({ status: PAYMENT_STATUS.QUOTE })).toBe(true);
    expect(isCancelable({ status: PAYMENT_STATUS.PENDING })).toBe(true);
  });

  it.each([PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED])(
    'does not cancel a %s payment',
    (status) => {
      expect(isCancelable({ status })).toBe(false);
    },
  );
});
