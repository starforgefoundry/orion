import { describe, expect, it } from 'vitest';
import { printBill } from './print_pricing';

const PRICING = { additionalBuildPlatePrice: 250, memberDiscountPercent: 10 };
const INPUT = {
  materialType: 'PLA',
  materialCost: 700,
  buildPlates: 1,
  isMember: false,
  billedToOrganization: false,
};

describe('printBill', () => {
  it('includes the first build plate in the material cost', () => {
    expect(printBill(INPUT, PRICING).lineItems).toEqual([
      { name: '3D Print Material', description: 'PLA', quantity: 1, unitAmount: 700 },
    ]);
  });

  it('leaves out the subtitle for a material with no type', () => {
    expect(printBill({ ...INPUT, materialType: null }, PRICING).lineItems[0]).toEqual({
      name: '3D Print Material',
      quantity: 1,
      unitAmount: 700,
    });
  });

  it('charges for each build plate after the first', () => {
    const bill = printBill({ ...INPUT, buildPlates: 3 }, PRICING);

    expect(bill.lineItems[1]).toEqual({
      name: 'Additional Build Plate',
      quantity: 2,
      unitAmount: 250,
    });
    expect(bill.total).toBe(1200);
  });

  it('gives members the member discount', () => {
    const bill = printBill({ ...INPUT, isMember: true }, PRICING);

    expect(bill.discounts).toEqual([{ name: 'Member Discount (10%)', amount: 70 }]);
    expect(bill.total).toBe(630);
  });

  it('does not give the member discount on prints an organization pays for', () => {
    const bill = printBill({ ...INPUT, isMember: true, billedToOrganization: true }, PRICING);

    expect(bill.discounts).toEqual([]);
  });
});
