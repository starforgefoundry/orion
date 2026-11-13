import type { Service, ServiceRequest } from '$lib/server/db/schema';
import { SERVICE_PRICING, SERVICE_REQUEST_STATUS, type ServiceField } from '$lib/utils/services';
import { DateTime } from 'luxon';
import { newId } from './id';

export function serviceField(overrides: Partial<ServiceField> = {}): ServiceField {
  return {
    id: 'material',
    label: 'Material',
    type: 'text',
    required: false,
    options: [],
    ...overrides,
  };
}

export function service(overrides: Partial<Service> = {}): Service {
  return {
    id: newId(),
    name: 'Laser Engraving',
    description: 'Engrave wood, acrylic, or leather',
    pricingMode: SERVICE_PRICING.FIXED,
    price: 2500,
    fields: [],
    enabled: true,
    createdDate: DateTime.now(),
    ...overrides,
  };
}

export function serviceRequest(overrides: Partial<ServiceRequest> = {}): ServiceRequest {
  return {
    id: newId(),
    serviceId: newId(),
    submissionDate: DateTime.now(),
    customerName: 'Jane Doe',
    email: 'jane@example.com',
    fields: [],
    answers: {},
    paymentId: newId(),
    status: SERVICE_REQUEST_STATUS.SUBMITTED,
    ...overrides,
  };
}
