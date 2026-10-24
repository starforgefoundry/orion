import { DateTime } from 'luxon';
import type { CatalogDiscount, CatalogObject, Customer, Invoice, Money, Order } from 'square';
import { newId } from './id';

export function usd(cents: number): Money {
  return { amount: BigInt(cents), currency: 'USD' };
}

export function squareCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: newId(),
    emailAddress: 'customer@example.com',
    givenName: 'Test',
    familyName: 'Customer',
    ...overrides,
  };
}

export function squareOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: newId(),
    locationId: newId(),
    netAmountDueMoney: usd(5000),
    ...overrides,
  };
}

export function squareInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: newId(),
    version: 1,
    createdAt: DateTime.now().toISO(),
    ...overrides,
  };
}

export function catalogDiscount(id: string, discountData: CatalogDiscount = {}): CatalogObject {
  return { type: 'DISCOUNT', id, discountData };
}

export function catalogItemVariation(id: string, priceCents: number): CatalogObject {
  return { type: 'ITEM_VARIATION', id, itemVariationData: { priceMoney: usd(priceCents) } };
}
