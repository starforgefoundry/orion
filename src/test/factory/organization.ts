import type { BillingCode, Organization, OrganizationCharge, Payment } from '$lib/server/db/schema';
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
    discountId: null,
    archived: false,
    ...overrides,
  };
}

export function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: newId(),
    issuedDate: DateTime.now(),
    paymentDate: null,
    status: 'pending',
    squareInvoiceId: null,
    squareOrderId: null,
    organizationId: null,
    type: 'print_request',
    total: 1000,
    orderObject: null,
    paymentUrl: null,
    carBayBookingId: null,
    ...overrides,
  };
}
