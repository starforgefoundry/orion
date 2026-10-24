export const CENTS_PER_DOLLAR = 100;
const PERCENT = 100;

type EnumValue<T> = T[keyof T];

export const PAYMENT_TYPE = {
  PRINT_REQUEST: 'print_request',
  CLASS_BOOKING: 'class_booking',
  CAR_BAY_BOOKING: 'car_bay_booking',
  CAR_BAY_OVERRUN: 'car_bay_overrun',
  ORG_CHARGE: 'org_charge',
  BALANCE: 'balance',
} as const;
export type PaymentType = EnumValue<typeof PAYMENT_TYPE>;

export const PAYMENT_STATUS = {
  QUOTE: 'quote',
  PENDING: 'pending',
  PAID: 'paid',
  CANCELED: 'canceled',
  REFUNDED: 'refunded',
} as const;
export type PaymentStatus = EnumValue<typeof PAYMENT_STATUS>;

/** Amounts are in cents. */
export type BillingLineItem = {
  name: string;
  quantity: number;
  unitAmount: number;
  /** Shown under the name, and as the item note on Square receipts. */
  description?: string;
};

export type BillingDiscountRate = { name: string; percent: number };

/** A discount after it has been applied to a bill, in cents. */
export type BillingDiscount = { name: string; amount: number };

export type Bill = {
  lineItems: BillingLineItem[];
  discounts: BillingDiscount[];
  subtotal: number;
  total: number;
};

export function lineItemsTotal(items: BillingLineItem[]) {
  return items.reduce((total, item) => total + item.quantity * item.unitAmount, 0);
}

/** Each discount applies to what is left after the ones before it. */
export function buildBill(lineItems: BillingLineItem[], rates: BillingDiscountRate[] = []): Bill {
  const subtotal = lineItemsTotal(lineItems);
  const discounts: BillingDiscount[] = [];
  let total = subtotal;

  for (const rate of rates.filter((r) => r.percent > 0)) {
    const amount = Math.round((total * rate.percent) / PERCENT);
    discounts.push({ name: rate.name, amount });
    total -= amount;
  }

  return { lineItems, discounts, subtotal, total };
}

export function formatCents(cents: number) {
  return `$${(cents / CENTS_PER_DOLLAR).toFixed(2)}`;
}

/** Settles a payment the customer owes nothing on, so it never asks for a card. */
export function initialStatus(status: PaymentStatus, total: number): PaymentStatus {
  return status === PAYMENT_STATUS.PENDING && total === 0 ? PAYMENT_STATUS.PAID : status;
}
