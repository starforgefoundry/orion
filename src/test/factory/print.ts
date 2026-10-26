import type {
  PrintMaterial,
  PrintRequest,
  PrintRequestComment,
  PrintRequestCommentFile,
  PrintRequestFile,
} from '$lib/server/db/schema';
import { DateTime } from 'luxon';
import { newId } from './id';

export function printRequest(overrides: Partial<PrintRequest> = {}): PrintRequest {
  return {
    id: newId(),
    submissionDate: DateTime.now(),
    completionDate: null,
    email: 'customer@example.com',
    customerName: 'Test Customer',
    projectName: 'Test Project',
    status: 'in_queue',
    isQuote: false,
    material: newId(),
    specialRequests: '',
    billingCode: null,
    paymentId: null,
    buildplateCount: 1,
    materialCost: 0,
    ...overrides,
  };
}

export function printRequestFile(overrides: Partial<PrintRequestFile> = {}): PrintRequestFile {
  return {
    id: newId(),
    printRequestId: newId(),
    fileName: 'part.stl',
    fileUrl: 'print-files/part.stl',
    quantity: 1,
    ...overrides,
  };
}

export function printRequestComment(
  overrides: Partial<PrintRequestComment> = {},
): PrintRequestComment {
  return {
    id: newId(),
    printRequestId: newId(),
    authorEmail: 'staff@example.com',
    body: 'Looks good',
    createdDate: DateTime.now(),
    ...overrides,
  };
}

export function printRequestCommentFile(
  overrides: Partial<PrintRequestCommentFile> = {},
): PrintRequestCommentFile {
  return {
    id: newId(),
    commentId: newId(),
    fileName: 'photo.jpg',
    fileUrl: 'comment-files/photo.jpg',
    ...overrides,
  };
}

export function printMaterial(overrides: Partial<PrintMaterial> = {}): PrintMaterial {
  return {
    id: newId(),
    name: 'PLA Black',
    available: true,
    archived: false,
    tagId: null,
    filamentId: null,
    vendor: null,
    materialType: 'PLA',
    colorName: 'Black',
    colorHex: '000000',
    ...overrides,
  };
}
