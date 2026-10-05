import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { afterAll, describe, expect, it, vi } from 'vitest';

const { STORAGE_DIR } = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  return { STORAGE_DIR: mkdtempSync(join(tmpdir(), 'orion-storage-')) };
});

vi.mock('$env/dynamic/private', () => ({
  env: { STORAGE_DIR, FILE_SIGNING_SECRET: 'test-secret' },
}));

import {
  InvalidStorageKeyError,
  fileUrl,
  openFile,
  saveFile,
  storagePath,
  verifySignature,
} from './storage';

afterAll(() => rmSync(STORAGE_DIR, { recursive: true, force: true }));

function signedParams(url: string) {
  const params = new URL(url, 'https://orion.test').searchParams;
  return [params.get('expires'), params.get('signature')] as const;
}

describe('saveFile', () => {
  it('writes the file under the storage directory and returns the key', async () => {
    const key = await saveFile(new File(['model data'], 'model.stl'), 'print_requests/req-1/up-1');

    expect(key).toBe('print_requests/req-1/up-1');
    expect(readFileSync(join(STORAGE_DIR, key), 'utf8')).toBe('model data');
  });
});

describe('openFile', () => {
  it('streams a stored file with its size', async () => {
    await saveFile(new File(['12345'], 'photo.png'), 'classes/c-1/photo.png');

    const { size, stream } = await openFile('classes/c-1/photo.png');

    expect(size).toBe(5);
    expect(await text(stream)).toBe('12345');
  });
});

describe('storagePath', () => {
  it('rejects keys that escape the storage directory', () => {
    expect(() => storagePath('../etc/passwd')).toThrow(InvalidStorageKeyError);
  });
});

describe('fileUrl', () => {
  it('returns null for missing keys', () => {
    expect(fileUrl(null)).toBeNull();
    expect(fileUrl(undefined)).toBeNull();
  });

  it('serves public prefixes without a signature', () => {
    expect(fileUrl('inventory/item-1/img')).toBe('/files/inventory/item-1/img');
  });

  it('signs private prefixes with a verifiable signature', () => {
    const url = fileUrl('waivers/john_2025-01-01_abc');

    expect(url.startsWith('/files/waivers/john_2025-01-01_abc?')).toBe(true);
    expect(verifySignature('waivers/john_2025-01-01_abc', ...signedParams(url))).toBe(true);
  });
});

describe('verifySignature', () => {
  it('rejects a signature issued for another key', () => {
    const url = fileUrl('print_requests/req-1/up-1');

    expect(verifySignature('print_requests/req-2/up-1', ...signedParams(url))).toBe(false);
  });

  it('rejects expired links', () => {
    const url = fileUrl('waivers/jane');
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 13 * 60 * 60 * 1000);

    expect(verifySignature('waivers/jane', ...signedParams(url))).toBe(false);
    vi.useRealTimers();
  });

  it('rejects missing parameters', () => {
    expect(verifySignature('waivers/jane', null, null)).toBe(false);
  });
});
