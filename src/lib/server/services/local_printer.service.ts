import type { UpsertLocalPrinterDto } from '$lib/remotes/dtos/local_printer.dto';
import { BaseService } from '$lib/server/services/base.service';

export class LocalPrinterService extends BaseService {
  async getPrinters() {
    return await this.bblRepository.listLocalPrinters();
  }

  async upsertPrinter(dto: UpsertLocalPrinterDto) {
    return await this.bblRepository.upsertLocalPrinter(dto);
  }

  async deletePrinter(id: string) {
    await this.bblRepository.deleteLocalPrinter(id);
  }
}

export const localPrinterService = new LocalPrinterService();
