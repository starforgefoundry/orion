import { verifySignedUrl } from '$lib/server/utils/signed-url';
import { newTestService, type ServiceMocks } from '$test/utils';
import JSZip from 'jszip';
import type { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrintFilesService } from './print-files.service';

function storedFile(fileName: string, contents: string) {
  return {
    fileName,
    size: contents.length,
    stream: Readable.from([Buffer.from(contents)]) as ReadStream,
  };
}

async function unzip(zip: Readable) {
  return await JSZip.loadAsync(await buffer(zip));
}

describe(PrintFilesService.name, () => {
  let sut: PrintFilesService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PrintFilesService));
  });

  describe('getDownloadUrl', () => {
    it('should return a signed link to the request ZIP', () => {
      const url = new URL(sut.getDownloadUrl('request-abc'), 'https://orion.test');

      expect(url.pathname).toBe('/api/prints/download/request-abc');
      expect(verifySignedUrl(url)).toBe(true);
    });
  });

  describe('downloadRequestZIP', () => {
    it('should zip every stored file for the request', async () => {
      mocks.printFilesRepository.openForRequest.mockResolvedValue([
        storedFile('part1.stl', 'first'),
        storedFile('part2.stl', 'second'),
      ]);

      const archive = await unzip(await sut.downloadRequestZIP('request-multi'));

      expect(mocks.printFilesRepository.openForRequest).toHaveBeenCalledWith('request-multi');
      expect(await archive.file('part1.stl')?.async('string')).toBe('first');
      expect(await archive.file('part2.stl')?.async('string')).toBe('second');
    });

    it('should produce an empty archive when the request has no files', async () => {
      mocks.printFilesRepository.openForRequest.mockResolvedValue([]);

      const archive = await unzip(await sut.downloadRequestZIP('request-empty'));

      expect(Object.keys(archive.files)).toHaveLength(0);
    });

    it('should propagate missing file errors', async () => {
      mocks.printFilesRepository.openForRequest.mockRejectedValue(new Error('ENOENT'));

      await expect(sut.downloadRequestZIP('request-error')).rejects.toThrow('ENOENT');
    });
  });
});
