import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/repositories/print_request_comment.repository', () => {
  const MockPrintRequestCommentRepository = vi.fn();
  MockPrintRequestCommentRepository.prototype.create = vi.fn();
  MockPrintRequestCommentRepository.prototype.getForRequest = vi.fn();
  return { PrintRequestCommentRepository: MockPrintRequestCommentRepository };
});

describe('PrintRequestCommentService', () => {
  let printRequestCommentService: any;
  let mockCommentRepo: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { printRequestCommentService: service } =
      await import('$lib/server/services/print_request_comment.service');
    printRequestCommentService = service;

    const { PrintRequestCommentRepository } =
      await import('$lib/server/repositories/print_request_comment.repository');
    mockCommentRepo = PrintRequestCommentRepository.prototype;
  });

  describe('getForRequest', () => {
    it('should return the comments for the request', async () => {
      const comments = [{ id: 'comment-1', body: 'Reprinted the base' }];
      vi.mocked(mockCommentRepo.getForRequest).mockResolvedValue(comments);

      const result = await printRequestCommentService.getForRequest('request-123');

      expect(mockCommentRepo.getForRequest).toHaveBeenCalledWith('request-123');
      expect(result).toEqual(comments);
    });
  });

  describe('addComment', () => {
    it('should attribute the comment to the signed in staff member', async () => {
      await printRequestCommentService.addComment(
        { printRequestId: 'request-123', body: 'Waiting on filament' },
        'staff@example.com',
      );

      expect(mockCommentRepo.create).toHaveBeenCalledWith({
        printRequestId: 'request-123',
        authorEmail: 'staff@example.com',
        body: 'Waiting on filament',
        attachments: [],
      });
    });

    it('should pass the attachments through to the repository', async () => {
      const attachments = [new File(['solid'], 'fixed-base.3mf'), new File(['solid'], 'lid.stl')];

      await printRequestCommentService.addComment(
        { printRequestId: 'request-123', body: 'Reoriented the parts', attachments },
        'staff@example.com',
      );

      expect(mockCommentRepo.create).toHaveBeenCalledWith(expect.objectContaining({ attachments }));
    });
  });
});
