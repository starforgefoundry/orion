import { HTTP_STATUS } from '$lib/http';
import { signUrl } from '$lib/server/utils/signed-url';
import { FILE_ROUTE } from '$lib/server/utils/storage';
import { isHttpError } from '@sveltejs/kit';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

const STORAGE_DIR = mkdtempSync(join(tmpdir(), 'orion-files-route-'));
const BASE_URL = 'https://orion.test';
const FUCKMESH_ORIGIN = 'https://fuckmesh.example.com';
const PRIVATE_KEY = 'print_requests/req-1/up-1';
const PUBLIC_KEY = 'inventory/item.png';

for (const key of [PRIVATE_KEY, PUBLIC_KEY]) {
  mkdirSync(dirname(join(STORAGE_DIR, key)), { recursive: true });
  writeFileSync(join(STORAGE_DIR, key), 'solid part');
}

afterAll(() => rmSync(STORAGE_DIR, { recursive: true, force: true }));

function get(path: string) {
  const url = new URL(path, BASE_URL);
  const key = url.pathname.slice(FILE_ROUTE.length + 1);
  return GET({ params: { key }, url } as unknown as Parameters<typeof GET>[0]);
}

async function caught(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw');
}

describe('GET /files/[...key]', () => {
  beforeEach(() => {
    vi.stubEnv('STORAGE_DIR', STORAGE_DIR);
    vi.stubEnv('PUBLIC_FUCKMESH_URL', `${FUCKMESH_ORIGIN}/`);
  });

  it('lets Fuckmesh read a signed file and its name', async () => {
    const response = await get(signUrl(`${FILE_ROUTE}/${PRIVATE_KEY}`));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(FUCKMESH_ORIGIN);
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('Content-Disposition');
    expect(response.headers.get('Content-Disposition')).toContain('filename="up-1"');
    expect(await response.text()).toBe('solid part');
  });

  it('rejects a private file without a signature', async () => {
    const error = await caught(() => get(`${FILE_ROUTE}/${PRIVATE_KEY}`));

    expect(isHttpError(error, HTTP_STATUS.FORBIDDEN)).toBe(true);
  });

  it('does not add CORS headers to public files', async () => {
    const response = await get(`${FILE_ROUTE}/${PUBLIC_KEY}`);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows the default Fuckmesh origin when none is configured', async () => {
    vi.stubEnv('PUBLIC_FUCKMESH_URL', '');

    const response = await get(signUrl(`${FILE_ROUTE}/${PRIVATE_KEY}`));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://fuckmesh.starforgefoundry.com',
    );
  });
});
