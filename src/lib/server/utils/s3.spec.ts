import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
  env: { S3_PUBLIC_URL: 'https://data.example.com' },
}));

import { s3PublicUrl, uploadToS3 } from './s3';
import type S3mini from 's3mini';

describe('s3PublicUrl', () => {
  it('prepends the public base URL to an object key', () => {
    expect(s3PublicUrl('waivers/john_2025-01-01_abc')).toBe(
      'https://data.example.com/waivers/john_2025-01-01_abc',
    );
  });

  it('returns null for missing keys', () => {
    expect(s3PublicUrl(null)).toBeNull();
    expect(s3PublicUrl(undefined)).toBeNull();
  });
});

describe('uploadToS3', () => {
  it('uploads the object and returns the key, not a full URL', async () => {
    const putObject = vi.fn().mockResolvedValue(undefined);
    const s3 = { putObject } as unknown as S3mini;
    const file = new File(['data'], 'model.stl');

    const key = await uploadToS3(s3, file, 'print_requests/req-1/upload-1');

    expect(key).toBe('print_requests/req-1/upload-1');
    expect(putObject).toHaveBeenCalledWith('print_requests/req-1/upload-1', expect.anything());
  });
});
