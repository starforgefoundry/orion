import type { BillingCode, Organization, OrganizationCharge, Payment } from '$lib/server/db/schema';
import type { NewPayment } from '$lib/server/repositories/payment.repository';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { DateTime } from 'luxon';
import { newId } from './id';

export function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: newId(),
    name: 'Engineering Club',
    email: 'club@example.com',
    archived: false,
    grantsAccess: true,
    accessEndDate: null,
    ...overrides,
  };
}

export function organizationCharge(
  overrides: Partial<OrganizationCharge> = {},
): OrganizationCharge {
  return {
    id: newId(),
    organizationId: newId(),
    creationDate: DateTime.now(),
    description: 'Equipment fee',
    paymentId: newId(),
    ...overrides,
  };
}

export function billingCode(overrides: Partial<BillingCode> = {}): BillingCode {
  return {
    id: newId(),
    code: 'ENGCLUB',
    description: 'Engineering Club',
    organizationId: null,
    archived: false,
    ...overrides,
  };
}

export function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: newId(),
    issuedDate: DateTime.now(),
    paymentDate: null,
    refundedDate: null,
    status: PAYMENT_STATUS.PENDING,
    type: PAYMENT_TYPE.PRINT_REQUEST,
    customerName: 'Test Customer',
    customerEmail: 'customer@example.com',
    lineItems: [],
    discounts: [],
    total: 1000,
    paymentUrl: null,
    organizationId: null,
    squareOrderId: null,
    squarePaymentId: null,
    squareInvoiceId: null,
    ...overrides,
  };
}

export function paidPayment(overrides: Partial<Payment> = {}): Payment {
  return payment({ status: PAYMENT_STATUS.PAID, paymentDate: DateTime.now(), ...overrides });
}

/** The row a payment repository would store for `data`. */
export function savedPayment(data: NewPayment, overrides: Partial<Payment> = {}): Payment {
  return payment({
    type: data.type,
    status: data.status,
    customerName: data.customer.name,
    customerEmail: data.customer.email,
    total: data.bill.total,
    lineItems: data.bill.lineItems,
    discounts: data.bill.discounts,
    organizationId: data.organizationId ?? null,
    ...overrides,
  });
}
