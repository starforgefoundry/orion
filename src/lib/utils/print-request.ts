// Relative imports: the database schema and seed script load this file outside SvelteKit.
import type { EnumValue } from './member-enums.ts';

export const PRINT_REQUEST_STATUS = {
  IN_QUEUE: 'in_queue',
  PRINTING: 'printing',
  DONE: 'done',
  PICKED_UP: 'picked_up',
  CANCELED: 'canceled',
} as const;
export type PrintRequestStatus = EnumValue<typeof PRINT_REQUEST_STATUS>;

export const BYTES_PER_MB = 1024 * 1024;
export const MAX_PRINT_REQUEST_FILES = 50;

export const PRINT_SUBMISSION_PROBLEM = {
  CLOSED: 'Print requests are closed right now.',
  NO_FILES: 'Attach at least one file.',
  TOO_MANY_FILES: `Attach at most ${MAX_PRINT_REQUEST_FILES} files.`,
  TOO_LARGE: 'The files are larger than the upload limit.',
  FILE_TYPE: 'One or more files have a type we do not accept.',
} as const;

type SubmissionSettings = { isOpen: boolean; maxUploadMB: number; allowedFileTypes: string };
type SubmittedFile = { filename: string; file: { size: number } };

export function parseFileExtensions(allowedFileTypes: string) {
  return allowedFileTypes
    .split(',')
    .map((ext) => ext.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);
}

function fileExtension(filename: string) {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

export function printSubmissionProblem(settings: SubmissionSettings, files: SubmittedFile[]) {
  if (!settings.isOpen) return PRINT_SUBMISSION_PROBLEM.CLOSED;
  if (files.length === 0) return PRINT_SUBMISSION_PROBLEM.NO_FILES;
  if (files.length > MAX_PRINT_REQUEST_FILES) return PRINT_SUBMISSION_PROBLEM.TOO_MANY_FILES;

  const totalBytes = files.reduce((total, { file }) => total + file.size, 0);
  if (totalBytes > settings.maxUploadMB * BYTES_PER_MB) return PRINT_SUBMISSION_PROBLEM.TOO_LARGE;

  const extensions = parseFileExtensions(settings.allowedFileTypes);
  if (files.some(({ filename }) => !extensions.includes(fileExtension(filename)))) {
    return PRINT_SUBMISSION_PROBLEM.FILE_TYPE;
  }
}
