import { verifySignedUrl } from '$lib/server/utils/signed_url';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import JSZip from 'jszip';
import type { ReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrintFilesService } from './print_files.service';

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

  describe('getByRequestId', () => {
    it('should call repository with correct print request ID', async () => {
      const files = [
        factory.printRequestFile({ printRequestId: 'request-123', quantity: 2 }),
        factory.printRequestFile({ printRequestId: 'request-123', quantity: 1 }),
      ];
      mocks.printFilesRepository.getByPrintRequestId.mockResolvedValue(files);

      const result = await sut.getByRequestId('request-123');

      expect(mocks.printFilesRepository.getByPrintRequestId).toHaveBeenCalledWith('request-123');
      expect(mocks.printFilesRepository.getByPrintRequestId).toHaveBeenCalledTimes(1);
      expect(result).toEqual(files);
    });

    it('should return empty array when no files exist for request', async () => {
      mocks.printFilesRepository.getByPrintRequestId.mockResolvedValue([]);

      const result = await sut.getByRequestId('request-456');

      expect(mocks.printFilesRepository.getByPrintRequestId).toHaveBeenCalledWith('request-456');
      expect(result).toEqual([]);
    });

    it('should handle different request IDs correctly', async () => {
      const files1 = [factory.printRequestFile({ printRequestId: 'request-111' })];
      const files2 = [factory.printRequestFile({ printRequestId: 'request-222' })];
      mocks.printFilesRepository.getByPrintRequestId
        .mockResolvedValueOnce(files1)
        .mockResolvedValueOnce(files2);

      const result1 = await sut.getByRequestId('request-111');
      const result2 = await sut.getByRequestId('request-222');

      expect(mocks.printFilesRepository.getByPrintRequestId).toHaveBeenNthCalledWith(
        1,
        'request-111',
      );
      expect(mocks.printFilesRepository.getByPrintRequestId).toHaveBeenNthCalledWith(
        2,
        'request-222',
      );
      expect(result1).toEqual(files1);
      expect(result2).toEqual(files2);
    });

    it('should return multiple files with different quantities', async () => {
      mocks.printFilesRepository.getByPrintRequestId.mockResolvedValue([
        factory.printRequestFile({ quantity: 5 }),
        factory.printRequestFile({ quantity: 1 }),
        factory.printRequestFile({ quantity: 3 }),
      ]);

      const result = await sut.getByRequestId('request-789');

      expect(result).toHaveLength(3);
      expect(result[0].quantity).toBe(5);
      expect(result[1].quantity).toBe(1);
      expect(result[2].quantity).toBe(3);
    });
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
