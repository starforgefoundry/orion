// Relative imports: the database schema loads this file outside SvelteKit.
import type { EnumValue } from './member-enums.ts';
import { BYTES_PER_MB } from './print-request.ts';

export const SERVICE_PRICING = { FIXED: 'fixed', VARIABLE: 'variable' } as const;
export type ServicePricing = EnumValue<typeof SERVICE_PRICING>;

export const SERVICE_FIELD_TYPE = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  FILE: 'file',
} as const;
export type ServiceFieldType = EnumValue<typeof SERVICE_FIELD_TYPE>;

export const SERVICE_REQUEST_STATUS = {
  SUBMITTED: 'submitted',
  QUOTED: 'quoted',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  CANCELED: 'canceled',
} as const;
export type ServiceRequestStatus = EnumValue<typeof SERVICE_REQUEST_STATUS>;

/** One question on a service's request form. Stored as JSON on the service. */
export type ServiceField = {
  id: string;
  label: string;
  type: ServiceFieldType;
  required: boolean;
  /** Choices for a select field. */
  options: string[];
};

/** Field ids become form field paths, which cannot start with a digit or contain `-`. */
export const SERVICE_FIELD_ID_PATTERN = /^[A-Za-z_]\w*$/;
export const MAX_SERVICE_UPLOAD_MB = 50;
const MAX_FILE_NAME_LENGTH = 100;

/** Stored answers. A file answer is the storage key of the upload. */
export type ServiceAnswers = Record<string, string | number | boolean>;
export type ServiceAnswerInput = string | number | boolean | File | undefined;

function isEmpty(answer: ServiceAnswerInput): answer is undefined | '' | false {
  return answer === undefined || answer === '' || answer === false;
}

/** Number inputs submit text, so a numeric string counts as a number. */
function toNumber(answer: ServiceAnswerInput) {
  const number = typeof answer === 'string' ? Number(answer.trim() || NaN) : answer;
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined;
}

function invalidAnswerProblem(field: ServiceField, answer: ServiceAnswerInput) {
  switch (field.type) {
    case SERVICE_FIELD_TYPE.NUMBER:
      return toNumber(answer) === undefined ? `${field.label} must be a number.` : undefined;
    case SERVICE_FIELD_TYPE.SELECT:
      return typeof answer === 'string' && field.options.includes(answer)
        ? undefined
        : `${field.label} has an invalid choice.`;
    case SERVICE_FIELD_TYPE.CHECKBOX:
      return answer === true ? undefined : `${field.label} is invalid.`;
    case SERVICE_FIELD_TYPE.FILE:
      if (!(answer instanceof File)) return `${field.label} needs a file.`;
      return answer.size > MAX_SERVICE_UPLOAD_MB * BYTES_PER_MB
        ? `${field.label} must be at most ${MAX_SERVICE_UPLOAD_MB} MB.`
        : undefined;
    default:
      return typeof answer === 'string' ? undefined : `${field.label} is invalid.`;
  }
}

/** Done and canceled requests leave the queue unless staff ask to see them. */
export function isClosed(status: ServiceRequestStatus) {
  return status === SERVICE_REQUEST_STATUS.DONE || status === SERVICE_REQUEST_STATUS.CANCELED;
}

/** Fixed-price requests are priced at submit; variable ones take quotes until work starts. */
export function canQuote(request: { status: ServiceRequestStatus; price: number | null }) {
  return (
    request.status === SERVICE_REQUEST_STATUS.QUOTED ||
    (request.status === SERVICE_REQUEST_STATUS.SUBMITTED && request.price === null)
  );
}

/** Returns what is wrong with the answers, or undefined when they satisfy the form. */
export function answersProblem(
  fields: ServiceField[],
  answers: Record<string, ServiceAnswerInput>,
) {
  for (const field of fields) {
    const answer = answers[field.id];
    if (isEmpty(answer)) {
      if (field.required) return `${field.label} is required.`;
      continue;
    }
    const problem = invalidAnswerProblem(field, answer);
    if (problem) return problem;
  }
}

/**
 * Keeps the non-empty answers to the form's own fields, dropping anything else submitted.
 * Expects answers that passed `answersProblem`.
 */
export function formAnswers(fields: ServiceField[], answers: Record<string, ServiceAnswerInput>) {
  const kept: Record<string, Exclude<ServiceAnswerInput, undefined>> = {};
  for (const field of fields) {
    const answer = answers[field.id];
    if (isEmpty(answer)) continue;
    kept[field.id] =
      field.type === SERVICE_FIELD_TYPE.NUMBER ? (toNumber(answer) ?? answer) : answer;
  }
  return kept;
}

/** A file name that is safe as the last segment of a storage key. */
export function storageFileName(name: string) {
  return (
    name
      .replace(/[^\w.-]+/g, '_')
      .slice(-MAX_FILE_NAME_LENGTH)
      .replace(/^\.+/, '') || 'file'
  );
}
