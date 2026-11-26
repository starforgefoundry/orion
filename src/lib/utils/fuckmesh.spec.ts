import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fuckmeshOrigin, fuckmeshUrl, opensInFuckmesh } from './fuckmesh';

const FUCKMESH_URL = 'https://fuckmesh.example.com';
const FILE_URL = 'https://orion.test/api/prints/download/req 1?expires=123&signature=a+b/c=';

describe('fuckmeshUrl', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_FUCKMESH_URL', FUCKMESH_URL);
  });

  it('passes the file url as the url param', () => {
    const url = new URL(fuckmeshUrl(FILE_URL));

    expect(url.origin).toBe(FUCKMESH_URL);
    expect(url.searchParams.get('url')).toBe(FILE_URL);
  });

  it('encodes the file url with encodeURIComponent', () => {
    expect(fuckmeshUrl(FILE_URL)).toBe(`${FUCKMESH_URL}/?url=${encodeURIComponent(FILE_URL)}`);
  });

  it('replaces any query already on the base url', () => {
    vi.stubEnv('PUBLIC_FUCKMESH_URL', `${FUCKMESH_URL}/?url=stale`);

    expect(new URL(fuckmeshUrl(FILE_URL)).searchParams.getAll('url')).toEqual([FILE_URL]);
  });

  it('falls back to the Starforge deployment when the base url is not configured', () => {
    vi.stubEnv('PUBLIC_FUCKMESH_URL', '');

    expect(new URL(fuckmeshUrl(FILE_URL)).origin).toBe('https://fuckmesh.starforgefoundry.com');
    expect(fuckmeshOrigin()).toBe('https://fuckmesh.starforgefoundry.com');
  });
});

describe('fuckmeshOrigin', () => {
  it('drops the path from the configured url', () => {
    vi.stubEnv('PUBLIC_FUCKMESH_URL', `${FUCKMESH_URL}/app/`);

    expect(fuckmeshOrigin()).toBe(FUCKMESH_URL);
  });
});

describe('opensInFuckmesh', () => {
  it.each(['part.stl', 'PART.STL', 'plate.3mf', 'PLATE.3MF', 'plate.zip'])(
    'opens %s',
    (fileName) => {
      expect(opensInFuckmesh(fileName)).toBe(true);
    },
  );

  it.each(['part.step', 'part.stp', 'stl', '3mf', 'photo.jpg'])('does not open %s', (fileName) => {
    expect(opensInFuckmesh(fileName)).toBe(false);
  });
});
