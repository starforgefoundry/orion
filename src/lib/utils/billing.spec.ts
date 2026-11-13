import { describe, expect, it } from 'vitest';
import {
  amountPaid,
  buildBill,
  initialStatus,
  isPayableOnline,
  lineItemsTotal,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  quoteRequiresCard,
} from './billing';

const ITEMS = [
  { name: 'Material', quantity: 1, unitAmount: 700 },
  { name: 'Plate', quantity: 2, unitAmount: 250 },
];

describe('buildBill', () => {
  it('totals line items by quantity', () => {
    expect(lineItemsTotal(ITEMS)).toBe(1200);
    expect(buildBill(ITEMS)).toEqual({
      lineItems: ITEMS,
      discounts: [],
      subtotal: 1200,
      total: 1200,
    });
  });

  it('applies each discount to what the ones before it left', () => {
    const bill = buildBill(ITEMS, [
      { name: 'Member', percent: 10 },
      { name: 'Promo', percent: 50 },
    ]);

    expect(bill.discounts).toEqual([
      { name: 'Member', amount: 120 },
      { name: 'Promo', amount: 540 },
    ]);
    expect(bill.total).toBe(540);
  });

  it('rounds discounts to the nearest cent so the total always adds up', () => {
    const bill = buildBill(
      [{ name: 'Odd', quantity: 1, unitAmount: 333 }],
      [{ name: 'Third', percent: 33 }],
    );

    expect(bill.discounts[0].amount).toBe(110);
    expect(bill.total).toBe(223);
  });

  it('leaves out discounts that take nothing off', () => {
    expect(buildBill(ITEMS, [{ name: 'None', percent: 0 }]).discounts).toEqual([]);
  });
});

describe('initialStatus', () => {
  it('settles a bill for nothing straight away', () => {
    expect(initialStatus(PAYMENT_STATUS.PENDING, 0)).toBe(PAYMENT_STATUS.PAID);
  });

  it('keeps a free quote waiting for the customer', () => {
    expect(initialStatus(PAYMENT_STATUS.QUOTE, 0)).toBe(PAYMENT_STATUS.QUOTE);
  });

  it('leaves a bill with money owed pending', () => {
    expect(initialStatus(PAYMENT_STATUS.PENDING, 100)).toBe(PAYMENT_STATUS.PENDING);
  });
});

describe('amountPaid', () => {
  it('counts only money the customer still has paid', () => {
    expect(amountPaid({ status: PAYMENT_STATUS.PAID, total: 500 })).toBe(500);
    expect(amountPaid({ status: PAYMENT_STATUS.REFUNDED, total: 500 })).toBe(0);
    expect(amountPaid({ status: PAYMENT_STATUS.CANCELED, total: 500 })).toBe(0);
    expect(amountPaid(null)).toBe(0);
  });
});

describe('isPayableOnline', () => {
  const PENDING = {
    type: PAYMENT_TYPE.PRINT_REQUEST,
    status: PAYMENT_STATUS.PENDING,
    organizationId: null,
    squareInvoiceId: null,
  };

  it('accepts a pending payment the customer owes', () => {
    expect(isPayableOnline(PENDING)).toBe(true);
  });

  it('accepts an organization paying its own balance', () => {
    expect(isPayableOnline({ ...PENDING, type: PAYMENT_TYPE.BALANCE, organizationId: 'org' })).toBe(
      true,
    );
  });

  it.each([
    ['is not pending', { status: PAYMENT_STATUS.PAID }],
    ['was sent as a Square invoice', { squareInvoiceId: 'inv-1' }],
    ['is billed to an organization', { organizationId: 'org' }],
  ])('refuses a payment that %s', (_, overrides) => {
    expect(isPayableOnline({ ...PENDING, ...overrides })).toBe(false);
  });
});

describe('quoteRequiresCard', () => {
  const QUOTE = {
    type: PAYMENT_TYPE.PRINT_REQUEST,
    status: PAYMENT_STATUS.QUOTE,
    organizationId: null,
    squareInvoiceId: null,
    total: 1000,
  };

  it('requires a card for a quote the customer owes', () => {
    expect(quoteRequiresCard(QUOTE)).toBe(true);
  });

  it.each([
    ['costs nothing', { total: 0 }],
    ['is billed to an organization', { organizationId: 'org' }],
  ])('approves a quote that %s without a card', (_, overrides) => {
    expect(quoteRequiresCard({ ...QUOTE, ...overrides })).toBe(false);
  });
});
