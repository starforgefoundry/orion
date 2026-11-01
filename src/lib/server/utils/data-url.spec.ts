import { describe, expect, it } from 'vitest';
import { decodeDataUrl } from './data-url';

describe(decodeDataUrl.name, () => {
  it('splits a base64 data URL into its content type and bytes', () => {
    const bytes = Buffer.from('signature');

    const decoded = decodeDataUrl(`data:image/png;base64,${bytes.toString('base64')}`);

    expect(decoded.contentType).toBe('image/png');
    expect(decoded.body.equals(bytes)).toBe(true);
  });
});
