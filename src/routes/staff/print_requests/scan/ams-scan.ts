import { PRINTER_LABEL_PREFIX, TAG_ID_LENGTH } from '$lib/utils/print_materials';

export function isPrinterLabel(value: string) {
  return value.startsWith(PRINTER_LABEL_PREFIX);
}

/** Spool and empty slot cards carry a fixed length tag id. */
export function isFilamentTag(value: string) {
  return !isPrinterLabel(value) && value.length === TAG_ID_LENGTH;
}

/** The printer name a printer label was made for. */
export function printerLabelName(label: string) {
  return label.slice(PRINTER_LABEL_PREFIX.length);
}
