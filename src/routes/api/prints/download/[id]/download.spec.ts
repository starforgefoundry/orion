import { HTTP_STATUS } from '$lib/http';
import { printFilesService } from '$lib/server/services/print-files.service';
import { signUrl } from '$lib/server/utils/signed-url';
import { isHttpError } from '@sveltejs/kit';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

vi.mock('$lib/server/services/print-files.service', () => ({
  printFilesService: { downloadRequestZIP: vi.fn() },
}));

const BASE_URL = 'https://orion.test';
const FUCKMESH_ORIGIN = 'https://fuckmesh.example.com';
const REQUEST_ID = 'req-1';
const DOWNLOAD_PATH = `/api/prints/download/${REQUEST_ID}`;

function get(path: string) {
  const url = new URL(path, BASE_URL);
  return GET({ params: { id: REQUEST_ID }, url } as unknown as Parameters<typeof GET>[0]);
}

async function caught(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw');
}

describe('GET /api/prints/download/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('PUBLIC_FUCKMESH_URL', FUCKMESH_ORIGIN);
    vi.mocked(printFilesService.downloadRequestZIP).mockResolvedValue(Readable.from(['zip']));
  });

  it('lets Fuckmesh read the signed ZIP and its name', async () => {
    const response = await get(signUrl(DOWNLOAD_PATH));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(FUCKMESH_ORIGIN);
    expect(response.headers.get('Access-Control-Expose-Headers')).toBe('Content-Disposition');
    expect(response.headers.get('Content-Disposition')).toContain(
      `print_request_${REQUEST_ID}.zip`,
    );
  });

  it('rejects an unsigned link', async () => {
    const error = await caught(() => get(DOWNLOAD_PATH));

    expect(isHttpError(error, HTTP_STATUS.FORBIDDEN)).toBe(true);
    expect(printFilesService.downloadRequestZIP).not.toHaveBeenCalled();
  });

  it('rejects a link signed for another request', async () => {
    const otherRequestQuery = signUrl('/api/prints/download/req-2').split('?')[1];
    const error = await caught(() => get(`${DOWNLOAD_PATH}?${otherRequestQuery}`));

    expect(isHttpError(error, HTTP_STATUS.FORBIDDEN)).toBe(true);
  });
});
