import { getRequestEvent } from '$app/server';
import { ConflictError, NotFoundError, UserError } from '$lib/errors';
import { HTTP_STATUS } from '$lib/http';
import { exposeUserErrors, verifyAuth } from '$lib/remotes/utils';
import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/server', () => ({ getRequestEvent: vi.fn() }));

async function caught(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw');
}

describe(exposeUserErrors.name, () => {
  it('returns what the handler returns', async () => {
    const handler = exposeUserErrors(async (value: number) => value * 2);

    await expect(handler(21)).resolves.toBe(42);
  });

  it.each([
    [new UserError('Bad input'), HTTP_STATUS.BAD_REQUEST],
    [new NotFoundError('Missing'), HTTP_STATUS.NOT_FOUND],
    [new ConflictError('Taken'), HTTP_STATUS.CONFLICT],
  ])('sends %s to the browser with its status', async (thrown, status) => {
    const handler = exposeUserErrors(() => {
      throw thrown;
    });

    const error = await caught(handler);

    expect(isHttpError(error, status)).toBe(true);
    expect(isHttpError(error) && error.body.message).toBe(thrown.message);
  });

  it('rethrows other errors untouched', async () => {
    const internal = new Error('database is down');
    const handler = exposeUserErrors(() => {
      throw internal;
    });

    await expect(caught(handler)).resolves.toBe(internal);
  });
});

describe(verifyAuth.name, () => {
  it('returns the signed-in user', () => {
    const user = { email: 'staff@example.com' };
    vi.mocked(getRequestEvent).mockReturnValue({ locals: { user } } as never);

    expect(verifyAuth()).toBe(user);
  });

  it('rejects a signed-out request with 401', async () => {
    vi.mocked(getRequestEvent).mockReturnValue({ locals: {} } as never);

    const error = await caught(verifyAuth);

    expect(isHttpError(error, HTTP_STATUS.UNAUTHORIZED)).toBe(true);
  });
});
