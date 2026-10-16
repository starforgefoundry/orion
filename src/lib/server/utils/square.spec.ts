import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env } = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));

vi.mock('$env/dynamic/private', () => ({ env }));

import {
  customerDisplayName,
  dayPassQuantity,
  memberSubscriptionStatus,
  squareApiUrl,
  squareWebSdkUrl,
  squareWebhookUrl,
} from './square';

beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
});

describe('squareApiUrl', () => {
  it('defaults to production', () => {
    expect(squareApiUrl()).toBe('https://connect.squareup.com');
  });
});

describe('squareWebSdkUrl', () => {
  it('loads the sandbox SDK when the API points at the sandbox', () => {
    env.SQUARE_URL = 'https://connect.squareupsandbox.com';

    expect(squareWebSdkUrl()).toBe('https://sandbox.web.squarecdn.com/v1/square.js');
  });

  it('loads the production SDK otherwise', () => {
    env.SQUARE_URL = 'https://connect.squareup.com';

    expect(squareWebSdkUrl()).toBe('https://web.squarecdn.com/v1/square.js');
  });
});

describe('squareWebhookUrl', () => {
  it('is the webhook route on the frontend URL', () => {
    env.FRONTEND_URL = 'https://orion.example.com';

    expect(squareWebhookUrl()).toBe('https://orion.example.com/api/square/webhook');
  });
});

describe('memberSubscriptionStatus', () => {
  it('lowercases Square statuses', () => {
    expect(memberSubscriptionStatus('ACTIVE')).toBe('active');
    expect(memberSubscriptionStatus('PENDING')).toBe('pending');
  });

  it('treats completed subscriptions as deactivated', () => {
    expect(memberSubscriptionStatus('COMPLETED')).toBe('deactivated');
  });
});

describe('customerDisplayName', () => {
  it('joins given and family names', () => {
    expect(customerDisplayName({ givenName: 'Ada', familyName: 'Lovelace' })).toBe('Ada Lovelace');
  });

  it('is undefined without a name', () => {
    expect(customerDisplayName({ emailAddress: 'ada@example.com' })).toBeUndefined();
  });
});

describe('dayPassQuantity', () => {
  it('sums quantities of configured variations only', () => {
    const order = {
      locationId: 'loc',
      lineItems: [
        { catalogObjectId: 'pass', quantity: '2' },
        { catalogObjectId: 'pass', quantity: '1' },
        { catalogObjectId: 'other', quantity: '4' },
        { quantity: '1' },
      ],
    };

    expect(dayPassQuantity(order, ['pass'])).toBe(3);
  });

  it('is zero for an order without line items', () => {
    expect(dayPassQuantity({ locationId: 'loc' }, ['pass'])).toBe(0);
  });
});
