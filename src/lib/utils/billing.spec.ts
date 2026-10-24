import { describe, expect, it } from 'vitest';
import { buildBill, initialStatus, lineItemsTotal, PAYMENT_STATUS } from './billing';

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
