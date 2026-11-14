// Relative imports: the database schema loads this file outside SvelteKit.
import { PAYMENT_STATUS, type PaymentStatus } from './billing.ts';
import type { EnumValue } from './member-enums.ts';
import { BYTES_PER_MB, fileExtension } from './print-request.ts';

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
  /** Extensions a file field accepts, lowercase without the dot. Empty or missing accepts any file. */
  fileTypes?: string[];
  /** Size limit of a file field. Missing means `MAX_SERVICE_UPLOAD_MB`. */
  maxUploadMB?: number;
};

/** Field ids become form field paths, which cannot start with a digit or contain `-`. */
export const SERVICE_FIELD_ID_PATTERN = /^[A-Za-z_]\w*$/;
export const MAX_SERVICE_UPLOAD_MB = 50;
/** Staff can raise a field's limit this far. Stays under the server's 1G BODY_SIZE_LIMIT. */
export const MAX_SERVICE_UPLOAD_LIMIT_MB = 1000;
const MAX_FILE_NAME_LENGTH = 100;
/** `.svg, .pdf, or .dxf` */
const TYPE_LIST = new Intl.ListFormat('en', { type: 'disjunction' });

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

/** Lists extensions for people, e.g. `.svg, .pdf, or .dxf`. */
export function fileTypeList(types: string[]) {
  return TYPE_LIST.format(types.map((type) => `.${type}`));
}

export function fileUploadLimitMB(field: ServiceField) {
  return field.maxUploadMB ?? MAX_SERVICE_UPLOAD_MB;
}

/** Returns what is wrong with a file for this field, or undefined when it is accepted. */
export function fileProblem(field: ServiceField, file: { name: string; size: number }) {
  const types = field.fileTypes ?? [];
  if (types.length > 0 && !types.includes(fileExtension(file.name))) {
    return `${field.label} must be ${fileTypeList(types)}.`;
  }
  const limitMB = fileUploadLimitMB(field);
  if (file.size > limitMB * BYTES_PER_MB) return `${field.label} must be at most ${limitMB} MB.`;
}

function missingAnswerProblem(field: ServiceField) {
  return field.type === SERVICE_FIELD_TYPE.CHECKBOX
    ? `Check “${field.label}” to continue.`
    : `${field.label} is required.`;
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
      return answer instanceof File ? fileProblem(field, answer) : `${field.label} needs a file.`;
    default:
      return typeof answer === 'string' ? undefined : `${field.label} is invalid.`;
  }
}

type PaymentSummary = { status: PaymentStatus; lineItems: unknown[] };

// Matches the statuses the payment repository lets `save` overwrite.
const UNPAID_PAYMENT_STATUSES: PaymentStatus[] = [PAYMENT_STATUS.QUOTE, PAYMENT_STATUS.PENDING];
const WORK_STATUSES: ServiceRequestStatus[] = [
  SERVICE_REQUEST_STATUS.IN_PROGRESS,
  SERVICE_REQUEST_STATUS.DONE,
];

/** A variable-price request starts with an empty quote that staff fill in. */
export function awaitingQuote(payment: PaymentSummary) {
  return payment.status === PAYMENT_STATUS.QUOTE && payment.lineItems.length === 0;
}

/** An unpaid bill can still be re-quoted or canceled. Once a card is charging or paid, it is fixed. */
export function isUnpaid(payment: { status: PaymentStatus }) {
  return UNPAID_PAYMENT_STATUSES.includes(payment.status);
}

/** Work starts only once a quote is sent. */
export function quoteRequired(payment: PaymentSummary, status: ServiceRequestStatus) {
  return WORK_STATUSES.includes(status) && awaitingQuote(payment);
}

/** Variable prices can be re-quoted until the customer pays. */
export function canQuote(pricingMode: ServicePricing, payment: { status: PaymentStatus }) {
  return pricingMode === SERVICE_PRICING.VARIABLE && isUnpaid(payment);
}

/**
 * Paid requests need a refund and charging ones cannot be stopped, so only unpaid requests cancel.
 * A free request is settled at submit but has nothing to refund.
 */
export function isCancelable(payment: { status: PaymentStatus; total: number }) {
  return isUnpaid(payment) || (payment.status === PAYMENT_STATUS.PAID && payment.total === 0);
}

/** Returns what is wrong with one answer, or undefined when it satisfies the field. */
export function answerProblem(field: ServiceField, answer: ServiceAnswerInput) {
  if (isEmpty(answer)) return field.required ? missingAnswerProblem(field) : undefined;
  return invalidAnswerProblem(field, answer);
}

/** Returns what is wrong with the answers, or undefined when they satisfy the form. */
export function answersProblem(
  fields: ServiceField[],
  answers: Record<string, ServiceAnswerInput>,
) {
  for (const field of fields) {
    const problem = answerProblem(field, answers[field.id]);
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
