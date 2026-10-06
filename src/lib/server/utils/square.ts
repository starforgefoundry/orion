import { env } from '$env/dynamic/private';

const SQUARE_PRODUCTION_API_URL = 'https://connect.squareup.com';
const SQUARE_SANDBOX_API_URL = 'https://connect.squareupsandbox.com';
const SQUARE_PRODUCTION_WEB_SDK_URL = 'https://web.squarecdn.com/v1/square.js';
const SQUARE_SANDBOX_WEB_SDK_URL = 'https://sandbox.web.squarecdn.com/v1/square.js';
const SQUARE_WEBHOOK_PATH = '/api/square/webhook';

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

export function stringifySquareObject(obj: any): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}
