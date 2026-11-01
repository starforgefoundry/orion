import type { SubmitPrintRequestDto } from '$lib/remotes/dtos/print-request.dto';
import type { Payment, PrintRequest } from '$lib/server/db/schema';
import {
  PrintRequestService,
  PrintSubmissionError,
} from '$lib/server/services/print-request.service';
import { factory } from '$test/factory';
import type { PrintRequestDetail } from '$test/factory/print-request';
import { newTestService, stubSettings, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/test';

function printRequestSettings(discordWebhookUrl: string) {
  return {
    printRequest: {
      isOpen: true,
      announcement: '',
      announcementUntil: '',
      maxUploadMB: 1000,
      allowedFileTypes: '.stl',
      discordWebhookUrl,
    },
  };
}

describe(PrintRequestService.name, () => {
  let sut: PrintRequestService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PrintRequestService));
  });

  describe('submitPrintRequest', () => {
    function stubSubmission(printRequest: PrintRequest) {
      mocks.printRequestRepository.submit.mockResolvedValue(printRequest);
      mocks.printFilesRepository.uploadFiles.mockResolvedValue(undefined);
      mocks.printRequestRepository.getById.mockResolvedValue(
        factory.printRequestDetail({ id: printRequest.id }),
      );
      mocks.mailgunGateway.sendTemplate.mockResolvedValue(undefined);
      stubSettings(mocks.settingsRepository, printRequestSettings(''));
    }

    it('should create customer, submit request, and upload files with correct parameters', async () => {
      const printRequest = factory.printRequest({ projectName: 'Test Project' });
      const dto: SubmitPrintRequestDto = {
        customer: { name: 'John Doe', email: 'john@example.com' },
        projectName: 'Test Project',
        specialRequests: '',
        isQuote: false,
        material: 'material-789',
        billingCode: '',
        files: [
          {
            file: new File(['test'], 'test.stl', { type: 'model/stl' }),
            filename: 'test.stl',
            quantity: 1,
          },
        ],
      };
      stubSubmission(printRequest);

      const result = await sut.submitPrintRequest(dto);

      expect(mocks.printRequestRepository.submit).toHaveBeenCalledWith(dto);
      expect(mocks.printFilesRepository.uploadFiles).toHaveBeenCalledWith(
        printRequest.id,
        dto.files,
      );
      expect(result).toEqual({ printRequestId: printRequest.id });
    });

    it('should handle quote requests correctly', async () => {
      const printRequest = factory.printRequest({ isQuote: true, billingCode: 'DEPT-001' });
      const dto: SubmitPrintRequestDto = {
        customer: { name: 'Jane Smith', email: 'jane@example.com' },
        projectName: 'Quote Request',
        specialRequests: 'Please provide detailed quote',
        isQuote: true,
        material: 'material-456',
        billingCode: 'DEPT-001',
        files: [{ file: new File(['data'], 'part.stl'), filename: 'part.stl', quantity: 1 }],
      };
      stubSubmission(printRequest);

      const result = await sut.submitPrintRequest(dto);

      expect(mocks.printRequestRepository.submit).toHaveBeenCalledWith(dto);
      expect(result.printRequestId).toBe(printRequest.id);
    });

    it('rejects a submission the form settings do not allow without storing anything', async () => {
      const dto: SubmitPrintRequestDto = {
        customer: { name: 'Test', email: 'test@test.com' },
        projectName: 'Test',
        material: 'mat-1',
        files: [{ file: new File(['data'], 'payload.exe'), filename: 'payload.exe', quantity: 1 }],
      };
      stubSubmission(factory.printRequest());

      await expect(sut.submitPrintRequest(dto)).rejects.toThrow(PrintSubmissionError);
      expect(mocks.printRequestRepository.submit).not.toHaveBeenCalled();
      expect(mocks.printFilesRepository.uploadFiles).not.toHaveBeenCalled();
    });

    it('should store uploaded files before returning', async () => {
      const printRequest = factory.printRequest();
      const dto: SubmitPrintRequestDto = {
        customer: { name: 'Test', email: 'test@test.com' },
        projectName: 'Test',
        material: 'mat-1',
        files: [{ file: new File(['data'], 'part.stl'), filename: 'part.stl', quantity: 1 }],
      };
      stubSubmission(printRequest);
      let uploaded = false;
      mocks.printFilesRepository.uploadFiles.mockImplementation(async () => {
        await Promise.resolve();
        uploaded = true;
      });

      await sut.submitPrintRequest(dto);

      expect(mocks.printFilesRepository.uploadFiles).toHaveBeenCalledWith(
        printRequest.id,
        dto.files,
      );
      expect(uploaded).toBe(true);
    });
  });

  describe('discord notification on submit', () => {
    const dto: SubmitPrintRequestDto = {
      customer: { name: 'John Doe', email: 'john@example.com' },
      projectName: 'Test Project',
      material: 'mat-1',
      files: [{ file: new File(['data'], 'part.stl'), filename: 'part.stl', quantity: 1 }],
    };

    function stubSubmission(request: PrintRequestDetail) {
      mocks.printRequestRepository.submit.mockResolvedValue(
        factory.printRequest({ id: request.id }),
      );
      mocks.printFilesRepository.uploadFiles.mockResolvedValue(undefined);
      mocks.printRequestRepository.getById.mockResolvedValue(request);
      mocks.mailgunGateway.sendTemplate.mockResolvedValue(undefined);
      stubSettings(mocks.settingsRepository, printRequestSettings(WEBHOOK_URL));
      mocks.discordRepository.notify.mockResolvedValue(undefined);
    }

    it('should send Discord webhook notification with correct data', async () => {
      const request = factory.printRequestDetail({
        customerName: 'John Doe',
        email: 'john@example.com',
        projectName: 'Test Project',
        specialRequests: 'Handle with care',
      });
      stubSubmission(request);

      await sut.submitPrintRequest(dto);

      await vi.waitFor(() =>
        expect(mocks.discordRepository.notify).toHaveBeenCalledWith(
          WEBHOOK_URL,
          expect.objectContaining({
            content: expect.stringContaining(
              `(https://orion.example.com/staff/print_requests/queue?id=${request.id})`,
            ),
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: '🖨️ New Print Request Submitted',
                fields: expect.arrayContaining([
                  expect.objectContaining({ name: 'Project Name', value: 'Test Project' }),
                  expect.objectContaining({ name: 'Customer', value: 'John Doe' }),
                  expect.objectContaining({ name: 'Email', value: 'john@example.com' }),
                  expect.objectContaining({ name: 'Special Requests', value: 'Handle with care' }),
                ]),
              }),
            ]),
          }),
        ),
      );
    });

    it('should not include special requests field when empty', async () => {
      stubSubmission(factory.printRequestDetail({ specialRequests: '' }));

      await sut.submitPrintRequest(dto);

      await vi.waitFor(() =>
        expect(mocks.discordRepository.notify).toHaveBeenCalledWith(
          WEBHOOK_URL,
          expect.objectContaining({
            embeds: expect.arrayContaining([
              expect.objectContaining({
                fields: expect.not.arrayContaining([
                  expect.objectContaining({ name: 'Special Requests' }),
                ]),
              }),
            ]),
          }),
        ),
      );
    });
  });

  describe('updatePrintRequest', () => {
    it('should update request with provided fields and refresh list', async () => {
      const updates = { customerName: 'Updated Customer', projectName: 'Updated Project' };
      const updated = [factory.printRequest({ id: 'request-123', ...updates })];
      mocks.printRequestRepository.update.mockResolvedValue(updated);

      const result = await sut.updatePrintRequest('request-123', updates);

      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith('request-123', updates);
      expect(result).toEqual(updated);
    });

    it('should handle single-field updates', async () => {
      const updates = { buildplateCount: 3 };
      const updated = [factory.printRequest({ id: 'request-456', ...updates })];
      mocks.printRequestRepository.update.mockResolvedValue(updated);

      const result = await sut.updatePrintRequest('request-456', updates);

      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith('request-456', updates);
      expect(result).toEqual(updated);
    });

    it('should handle billing code updates', async () => {
      const updates = { billingCode: 'NEW-CODE-123' };
      const updated = [factory.printRequest({ id: 'request-789', ...updates })];
      mocks.printRequestRepository.update.mockResolvedValue(updated);

      const result = await sut.updatePrintRequest('request-789', updates);

      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith('request-789', updates);
      expect(result).toEqual(updated);
    });
  });

  describe('updatePartQuantity', () => {
    it('should update quantity for a specific part', async () => {
      const updated = [factory.printRequestFile({ id: 'part-123', quantity: 5 })];
      mocks.printRequestRepository.updatePartQuantity.mockResolvedValue(updated);

      const result = await sut.updatePartQuantity({ partId: 'part-123', quantity: 5 });

      expect(mocks.printRequestRepository.updatePartQuantity).toHaveBeenCalledWith('part-123', 5);
      expect(result).toEqual(updated);
    });

    it('should handle zero quantity updates', async () => {
      const updated = [factory.printRequestFile({ id: 'part-456', quantity: 0 })];
      mocks.printRequestRepository.updatePartQuantity.mockResolvedValue(updated);

      const result = await sut.updatePartQuantity({ partId: 'part-456', quantity: 0 });

      expect(mocks.printRequestRepository.updatePartQuantity).toHaveBeenCalledWith('part-456', 0);
      expect(result).toEqual(updated);
    });
  });

  describe('sendPickupNotification', () => {
    it('should send pickup email notification to customer', async () => {
      const request = factory.printRequestDetail({
        email: 'customer@example.com',
        projectName: 'Completed Project',
      });
      mocks.printRequestRepository.getById.mockResolvedValue(request);
      mocks.mailgunGateway.sendTemplate.mockResolvedValue(undefined);

      await sut.sendPickupNotification(request.id);

      expect(mocks.printRequestRepository.getById).toHaveBeenCalledWith(request.id);
      expect(mocks.mailgunGateway.sendTemplate).toHaveBeenCalledWith(
        'customer@example.com',
        expect.objectContaining({ from: expect.stringContaining('Starforge 3D Prints') }),
        'print_pickup',
        expect.objectContaining({ projectName: 'Completed Project' }),
      );
    });

    it('should throw error when request not found', async () => {
      mocks.printRequestRepository.getById.mockResolvedValue(undefined);

      await expect(sut.sendPickupNotification('nonexistent')).rejects.toThrow(
        'Print request not found',
      );
    });
  });

  describe('updatePrintRequestStatus', () => {
    function stubStatusUpdate(request: PrintRequestDetail, payment?: Payment) {
      const updated = [factory.printRequest({ id: request.id })];
      mocks.printRequestRepository.getById.mockResolvedValue(request);
      mocks.printRequestRepository.update.mockResolvedValue(updated);
      mocks.mailgunGateway.sendTemplate.mockResolvedValue(undefined);
      if (payment) {
        mocks.paymentRepository.getById.mockResolvedValue(payment);
        mocks.paymentRepository.markPaid.mockResolvedValue(payment);
        mocks.paymentGateway.cancel.mockResolvedValue(payment);
      }
      return updated;
    }

    it('should update status to done and set completion date', async () => {
      const request = factory.printRequestDetail({ status: 'printing' });
      const updated = stubStatusUpdate(request);

      const result = await sut.updatePrintRequestStatus(request.id, { status: 'done' });

      expect(mocks.printRequestRepository.getById).toHaveBeenCalledWith(request.id);
      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith(
        request.id,
        expect.objectContaining({ status: 'done', completionDate: expect.anything() }),
      );
      expect(result).toEqual(updated);
    });

    it('should mark organization payment as paid when status changes to done', async () => {
      const payment = factory.payment({ organizationId: 'org-456', status: 'pending' });
      const request = factory.printRequestDetail({ status: 'printing', paymentId: payment.id });
      const updated = stubStatusUpdate(request, payment);

      const result = await sut.updatePrintRequestStatus(request.id, { status: 'done' });

      expect(mocks.paymentRepository.getById).toHaveBeenCalledWith(payment.id);
      expect(mocks.paymentRepository.markPaid).toHaveBeenCalledWith(payment.id);
      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith(
        request.id,
        expect.objectContaining({ status: 'done', completionDate: expect.anything() }),
      );
      expect(result).toEqual(updated);
    });

    it('should not mark payment as paid when status is done but payment is not from organization', async () => {
      const payment = factory.payment({ organizationId: null, status: 'pending' });
      const request = factory.printRequestDetail({ status: 'printing', paymentId: payment.id });
      const updated = stubStatusUpdate(request, payment);

      const result = await sut.updatePrintRequestStatus(request.id, { status: 'done' });

      expect(mocks.paymentRepository.getById).toHaveBeenCalledWith(payment.id);
      expect(mocks.paymentRepository.markPaid).not.toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('should update status to canceled and set completion date', async () => {
      const request = factory.printRequestDetail({ status: 'in_queue' });
      const updated = stubStatusUpdate(request);

      const result = await sut.updatePrintRequestStatus(request.id, { status: 'canceled' });

      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith(
        request.id,
        expect.objectContaining({ status: 'canceled', completionDate: expect.anything() }),
      );
      expect(result).toEqual(updated);
    });

    it('should cancel the payment when status is canceled and payment exists', async () => {
      const payment = factory.payment({ squareInvoiceId: 'inv-456' });
      const request = factory.printRequestDetail({ status: 'in_queue', paymentId: payment.id });
      const updated = stubStatusUpdate(request, payment);

      const result = await sut.updatePrintRequestStatus(request.id, { status: 'canceled' });

      expect(mocks.paymentRepository.getById).toHaveBeenCalledWith(payment.id);
      expect(mocks.paymentGateway.cancel).toHaveBeenCalledWith(payment);
      expect(result).toEqual(updated);
    });

    it('should not cancel a payment when status is canceled but no payment exists', async () => {
      const request = factory.printRequestDetail({ status: 'in_queue' });
      stubStatusUpdate(request);

      await sut.updatePrintRequestStatus(request.id, { status: 'canceled' });

      expect(mocks.paymentRepository.getById).not.toHaveBeenCalled();
      expect(mocks.paymentGateway.cancel).not.toHaveBeenCalled();
    });

    it('should update status without setting completion date for other statuses', async () => {
      const request = factory.printRequestDetail({ status: 'in_queue' });
      const updated = stubStatusUpdate(request);

      const result = await sut.updatePrintRequestStatus(request.id, { status: 'printing' });

      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith(request.id, {
        status: 'printing',
      });
      expect(result).toEqual(updated);
    });

    it('should send the pickup notification when status changes to done', async () => {
      const request = factory.printRequestDetail({
        status: 'printing',
        projectName: 'Pickup Project',
      });
      stubStatusUpdate(request);

      await sut.updatePrintRequestStatus(request.id, { status: 'done' });

      await vi.waitFor(() =>
        expect(mocks.mailgunGateway.sendTemplate).toHaveBeenCalledWith(
          request.email,
          expect.anything(),
          'print_pickup',
          expect.objectContaining({ projectName: 'Pickup Project' }),
        ),
      );
    });

    it('should move a picked up request back to done without side effects', async () => {
      const payment = factory.payment({ organizationId: 'org-456', status: 'pending' });
      const request = factory.printRequestDetail({ status: 'picked_up', paymentId: payment.id });
      stubStatusUpdate(request, payment);

      await sut.updatePrintRequestStatus(request.id, { status: 'done' });

      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith(request.id, {
        status: 'done',
      });
      expect(mocks.paymentRepository.markPaid).not.toHaveBeenCalled();
      expect(mocks.mailgunGateway.sendTemplate).not.toHaveBeenCalled();
    });
  });
});
