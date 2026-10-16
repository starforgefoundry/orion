import { env } from '$env/dynamic/private';
import type { MemberSubscription } from '$lib/server/db/schema';
import type { Customer, Order, SubscriptionStatus } from 'square';

const SQUARE_PRODUCTION_API_URL = 'https://connect.squareup.com';
const SQUARE_SANDBOX_API_URL = 'https://connect.squareupsandbox.com';
const SQUARE_PRODUCTION_WEB_SDK_URL = 'https://web.squarecdn.com/v1/square.js';
const SQUARE_SANDBOX_WEB_SDK_URL = 'https://sandbox.web.squarecdn.com/v1/square.js';
const SQUARE_WEBHOOK_PATH = '/api/square/webhook';

export const SQUARE_CURRENCY = 'USD';

export function squareApiUrl() {
  return env.SQUARE_URL || SQUARE_PRODUCTION_API_URL;
}

export function squareWebSdkUrl() {
  return squareApiUrl() === SQUARE_SANDBOX_API_URL
    ? SQUARE_SANDBOX_WEB_SDK_URL
    : SQUARE_PRODUCTION_WEB_SDK_URL;
}

/** Square signs webhooks over the URL it delivered to, so this must match the subscription. */
export function squareWebhookUrl() {
  return `${env.FRONTEND_URL}${SQUARE_WEBHOOK_PATH}`;
}

export type SquareWebhook<T> = {
  merchant_id: string;
  location_id: string;
  type: string;
  event_id: string;
  created_at: string;
  data: {
    type: string;
    id: string;
    object: T;
  };
};

const SUBSCRIPTION_STATUS_MAP: Record<SubscriptionStatus, MemberSubscription['status']> = {
  PENDING: 'pending',
  ACTIVE: 'active',
  PAUSED: 'paused',
  CANCELED: 'canceled',
  DEACTIVATED: 'deactivated',
  COMPLETED: 'deactivated',
};

export function memberSubscriptionStatus(status: SubscriptionStatus): MemberSubscription['status'] {
  return SUBSCRIPTION_STATUS_MAP[status];
}

export function customerDisplayName(customer: Customer): string | undefined {
  const name = [customer.givenName, customer.familyName].filter(Boolean).join(' ').trim();
  return name || undefined;
}

export function dayPassQuantity(order: Order, dayPassItemVariationIds: string[]): number {
  const dayPassIds = new Set(dayPassItemVariationIds);

  return (order.lineItems ?? [])
    .filter((item) => item.catalogObjectId && dayPassIds.has(item.catalogObjectId))
    .reduce((total, item) => total + Math.floor(Number(item.quantity)), 0);
}

export function stringifySquareObject(obj: any): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}
