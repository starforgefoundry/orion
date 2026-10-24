import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { addPrintRequestCommentDto } from '$lib/remotes/dtos/print_request.dto';

describe('addPrintRequestCommentDto', () => {
  it('should accept a comment with only a body', () => {
    const result = v.safeParse(addPrintRequestCommentDto, {
      printRequestId: 'request-123',
      body: 'Waiting on filament',
    });

    expect(result.success).toBe(true);
  });

  it('should accept an empty body when a file is attached', () => {
    const result = v.safeParse(addPrintRequestCommentDto, {
      printRequestId: 'request-123',
      body: '   ',
      attachments: [new File(['solid'], 'plate.3mf')],
    });

    expect(result.success).toBe(true);
  });

  it('should reject an empty body without attachments', () => {
    const result = v.safeParse(addPrintRequestCommentDto, {
      printRequestId: 'request-123',
      body: '   ',
    });

    expect(result.success).toBe(false);
  });
});
