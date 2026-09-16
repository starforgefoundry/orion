import { command, form, query } from '$app/server';
import { deleteLocalPrinterDto, upsertLocalPrinterDto } from '$lib/remotes/dtos/local_printer.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { localPrinterService } from '$lib/server/services/local_printer.service';

export const getLocalPrinters = query(async () => {
  verifyAuth();
  return await localPrinterService.getPrinters();
});

export const upsertLocalPrinter = form(upsertLocalPrinterDto, async (dto) => {
  verifyAuth();
  const printer = await localPrinterService.upsertPrinter(dto);
  await getLocalPrinters().refresh();

  return printer;
});

export const deleteLocalPrinter = command(deleteLocalPrinterDto, async (dto) => {
  verifyAuth();
  await localPrinterService.deletePrinter(dto.id);
  await getLocalPrinters().refresh();
});
