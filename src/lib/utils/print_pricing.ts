import { buildBill, type Bill, type BillingLineItem } from '$lib/utils/billing';

const MATERIAL_LINE_ITEM = '3D Print Material';

/** Amounts are in cents. */
export type PrintPricing = {
  additionalBuildPlatePrice: number;
  memberDiscountPercent: number;
};

export const DEFAULT_PRINT_PRICING: PrintPricing = {
  additionalBuildPlatePrice: 0,
  memberDiscountPercent: 0,
};

export type PrintBillInput = {
  materialType: string | null;
  materialCost: number;
  buildPlates: number;
  isMember: boolean;
  billedToOrganization: boolean;
};

/** The first build plate is included in the material cost. */
export function printBill(input: PrintBillInput, pricing: PrintPricing): Bill {
  const lineItems: BillingLineItem[] = [
    {
      name: MATERIAL_LINE_ITEM,
      quantity: 1,
      unitAmount: input.materialCost,
      ...(input.materialType && { description: input.materialType }),
    },
  ];

  const extraPlates = input.buildPlates - 1;
  if (extraPlates > 0) {
    lineItems.push({
      name: 'Additional Build Plate',
      quantity: extraPlates,
      unitAmount: pricing.additionalBuildPlatePrice,
    });
  }

  // Organizations negotiate their own rates, so member pricing does not stack on top.
  const memberDiscount = input.isMember && !input.billedToOrganization;
  return buildBill(
    lineItems,
    memberDiscount
      ? [
          {
            name: `Member Discount (${pricing.memberDiscountPercent}%)`,
            percent: pricing.memberDiscountPercent,
          },
        ]
      : [],
  );
}
