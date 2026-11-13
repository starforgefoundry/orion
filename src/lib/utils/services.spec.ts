import { describe, expect, it } from 'vitest';
import { BYTES_PER_MB } from './print-request';
import {
  answersProblem,
  awaitingQuote,
  formAnswers,
  MAX_SERVICE_UPLOAD_MB,
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
