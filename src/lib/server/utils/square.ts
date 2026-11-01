import { env } from '$env/dynamic/private';
import type { MemberSubscription } from '$lib/server/db/schema';
import type { BillingDiscount, BillingLineItem } from '$lib/utils/billing';
import { WebhooksHelper, type Customer, type Order, type SubscriptionStatus } from 'square';

const SQUARE_PRODUCTION_API_URL = 'https://connect.squareup.com';
const SQUARE_SANDBOX_API_URL = 'https://connect.squareupsandbox.com';
const SQUARE_PRODUCTION_WEB_SDK_URL = 'https://web.squarecdn.com/v1/square.js';
const SQUARE_SANDBOX_WEB_SDK_URL = 'https://sandbox.web.squarecdn.com/v1/square.js';
const SQUARE_WEBHOOK_PATH = '/api/square/webhook';

export const SQUARE_CURRENCY = 'USD';

export const SQUARE_PAYMENT_STATUS = { APPROVED: 'APPROVED', COMPLETED: 'COMPLETED' } as const;

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

export const SQUARE_SIGNATURE_HEADER = 'x-square-hmacsha256-signature';

/** The parts of a Square webhook notification Orion reads. */
export type SquareWebhook = { event_id: string; type: string; data: { id: string } };

export async function isSquareSignatureValid(body: string, signature: string | null) {
  if (!signature) return false;
  return await WebhooksHelper.verifySignature({
    requestBody: body,
    signatureHeader: signature,
    signatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY!,
    notificationUrl: squareWebhookUrl(),
  });
}

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

/** Discounts go in as fixed amounts so Square's total always matches the one Orion showed. */
export function squareOrderLines(
  lineItems: BillingLineItem[],
  discounts: BillingDiscount[],
): Pick<Order, 'lineItems' | 'discounts'> {
  return {
    lineItems: lineItems.map((item) => ({
      name: item.name,
      note: item.description,
      quantity: item.quantity.toString(),
      basePriceMoney: { amount: BigInt(item.unitAmount), currency: SQUARE_CURRENCY },
    })),
    discounts: discounts
      .filter((discount) => discount.amount > 0)
      .map((discount) => ({
        name: discount.name,
        type: 'FIXED_AMOUNT',
        amountMoney: { amount: BigInt(discount.amount), currency: SQUARE_CURRENCY },
        scope: 'ORDER',
      })),
  };
}
