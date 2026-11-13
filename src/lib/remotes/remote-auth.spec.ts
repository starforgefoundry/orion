import { getRequestEvent } from '$app/server';
import { HTTP_STATUS } from '$lib/http';
import { isHttpError } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Remote function wrappers need a live request, so each one hands back its handler instead.
vi.mock('$app/server', () => {
  const remote =
    (type: string) =>
    (...args: unknown[]) =>
      Object.assign(args.at(-1) as object, { __: { type } });
  return {
    query: remote('query'),
    command: remote('command'),
    form: remote('form'),
    prerender: remote('prerender'),
    getRequestEvent: vi.fn(),
  };
});

/**
 * Remotes anyone can call without signing in. Adding one here is a deliberate decision that the
 * endpoint is safe to expose.
 */
const PUBLIC_REMOTES: Record<string, string[]> = {
  'car-bay.remote.ts': [
    'getCarBaySchedule',
    'getCarBayMembership',
    'bookCarBay',
    'getCarBayBookingByToken',
    'cancelCarBayBooking',
  ],
  'class.remote.ts': [
    'getCatalogById',
    'getActiveClasses',
    'getClassInstances',
    'bookClass',
    'getBookingByToken',
    'cancelBooking',
  ],
  // Scanned from a QR code on the shelf.
  'inventory.remote.ts': ['addToPurchaseList'],
  // Guarded by the paired kiosk cookie instead of a staff login.
  'kiosk.remote.ts': ['getKioskStatus', 'checkInKiosk', 'kioskWaiverForm'],
  'onboarding.remote.ts': ['getOnboarding', 'requestPassEmailForm', 'submitOnboardingWaiverForm'],
  'pass.remote.ts': ['getPass'],
  'payment.remote.ts': ['getPaymentCheckout', 'payPayment', 'getCheckoutConfig'],
  'print-request.remote.ts': [
    'submitPrintRequestForm',
    'getPrintRequestStatus',
    'respondToPrintRequestQuote',
    'payPrintRequest',
  ],
  'service.remote.ts': ['getEnabledServices', 'getEnabledService', 'submitServiceRequestForm'],
  'settings.remote.ts': [
    'getPublicPrintRequestForm',
    'getCarBayRates',
    'getCarBayPolicy',
    'getCarBayAvailability',
  ],
  'waiver.remote.ts': ['submitWaiverForm'],
};

type Handler = (...args: unknown[]) => unknown;

const modules = import.meta.glob<Record<string, Handler>>('./endpoints/*.remote.ts', {
  eager: true,
});

const remotes = Object.entries(modules).flatMap(([path, exports]) => {
  const file = path.split('/').at(-1)!;
  return Object.entries(exports).map(([name, handler]) => ({ file, name, handler }));
});

const publicNames = new Set(
  Object.entries(PUBLIC_REMOTES).flatMap(([file, names]) => names.map((name) => `${file}#${name}`)),
);
const isPublic = ({ file, name }: { file: string; name: string }) =>
  publicNames.has(`${file}#${name}`);

async function caught(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('remote functions', () => {
  beforeEach(() => {
    vi.mocked(getRequestEvent).mockReturnValue({
      locals: {},
      cookies: { get: () => undefined },
    } as never);
  });

  it.each(
    remotes
      .filter((remote) => !isPublic(remote))
      .map((remote) => [`${remote.file} ${remote.name}`, remote.handler] as const),
  )('%s rejects a signed-out caller', async (_, handler) => {
    expect(isHttpError(await caught(() => handler(undefined)), HTTP_STATUS.UNAUTHORIZED)).toBe(
      true,
    );
  });

  it('lists only public remotes that exist', () => {
    const exported = new Set(remotes.map(({ file, name }) => `${file}#${name}`));

    expect([...publicNames].filter((name) => !exported.has(name))).toEqual([]);
  });
});
