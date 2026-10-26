import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrintRequestCommentService } from './print_request_comment.service';

describe(PrintRequestCommentService.name, () => {
  let sut: PrintRequestCommentService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PrintRequestCommentService));
  });

  describe('getForRequest', () => {
    it('should return the comments for the request', async () => {
      const comment = factory.printRequestComment({
        printRequestId: 'request-123',
        body: 'Reprinted the base',
      });
      const comments = [{ ...comment, authorName: 'Staff Member', attachments: [] }];
      mocks.printRequestCommentRepository.getForRequest.mockResolvedValue(comments);

      const result = await sut.getForRequest('request-123');

      expect(mocks.printRequestCommentRepository.getForRequest).toHaveBeenCalledWith('request-123');
      expect(result).toEqual(comments);
    });
  });

  describe('addComment', () => {
    beforeEach(() => {
      mocks.printRequestCommentRepository.create.mockResolvedValue(factory.printRequestComment());
    });

    it('should attribute the comment to the signed in staff member', async () => {
      await sut.addComment(
        { printRequestId: 'request-123', body: 'Waiting on filament' },
        'staff@example.com',
      );

      expect(mocks.printRequestCommentRepository.create).toHaveBeenCalledWith({
        printRequestId: 'request-123',
        authorEmail: 'staff@example.com',
        body: 'Waiting on filament',
        attachments: [],
      });
    });

    it('should pass the attachments through to the repository', async () => {
      const attachments = [new File(['solid'], 'fixed-base.3mf'), new File(['solid'], 'lid.stl')];

      await sut.addComment(
        { printRequestId: 'request-123', body: 'Reoriented the parts', attachments },
        'staff@example.com',
      );

      expect(mocks.printRequestCommentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ attachments }),
      );
    });
  });
});
