import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalPrinterService } from './local_printer.service';

function createService() {
  const mockBblRepo = {
    listLocalPrinters: vi.fn(),
    upsertLocalPrinter: vi.fn(),
    deleteLocalPrinter: vi.fn(),
  };

  const service = new LocalPrinterService(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    mockBblRepo as any,
  );

  return { service, mockBblRepo };
}

describe('LocalPrinterService', () => {
  let service: LocalPrinterService;
  let mockBblRepo: ReturnType<typeof createService>['mockBblRepo'];

  beforeEach(() => {
    vi.clearAllMocks();
    ({ service, mockBblRepo } = createService());
  });

  describe('getPrinters', () => {
    it('should return the configured printers', async () => {
      const printers = [
        {
          id: 'printer-1',
          name: 'SF-P1S-01',
          localIp: '192.168.1.100',
          serial: '01P00A000000000',
          accessCode: '12345678',
        },
      ];
      mockBblRepo.listLocalPrinters.mockResolvedValue(printers);

      const result = await service.getPrinters();

      expect(result).toEqual(printers);
    });

    it('should return an empty list when none are configured', async () => {
      mockBblRepo.listLocalPrinters.mockResolvedValue([]);

      await expect(service.getPrinters()).resolves.toEqual([]);
    });
  });

  describe('upsertPrinter', () => {
    it('should create a printer when no id is given', async () => {
      const dto = {
        name: 'SF-P1S-02',
        localIp: '192.168.1.101',
        serial: '01P00A000000001',
        accessCode: '87654321',
      };
      mockBblRepo.upsertLocalPrinter.mockResolvedValue({ id: 'printer-2', ...dto });

      const result = await service.upsertPrinter(dto);

      expect(mockBblRepo.upsertLocalPrinter).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 'printer-2', ...dto });
    });

    it('should update the printer matching the given id', async () => {
      const dto = {
        id: 'printer-1',
        name: 'SF-P1S-01',
        localIp: '192.168.1.150',
        serial: '01P00A000000000',
        accessCode: '12345678',
      };
      mockBblRepo.upsertLocalPrinter.mockResolvedValue(dto);

      const result = await service.upsertPrinter(dto);

      expect(mockBblRepo.upsertLocalPrinter).toHaveBeenCalledWith(dto);
      expect(result).toEqual(dto);
    });
  });

  describe('deletePrinter', () => {
    it('should delete the printer by id', async () => {
      mockBblRepo.deleteLocalPrinter.mockResolvedValue(undefined);

      await service.deletePrinter('printer-1');

      expect(mockBblRepo.deleteLocalPrinter).toHaveBeenCalledWith('printer-1');
    });
  });
});
