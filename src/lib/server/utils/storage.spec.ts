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

import { InvalidStorageKeyError, fileUrl, openFile, saveFile, storagePath } from './storage';
import { verifySignedUrl } from './signed_url';

afterAll(() => rmSync(STORAGE_DIR, { recursive: true, force: true }));

const BASE_URL = 'https://orion.test';

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
    expect(verifySignedUrl(new URL(url, BASE_URL))).toBe(true);
  });
});
