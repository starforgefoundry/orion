import { NotFoundError } from '$lib/errors';
import type { SubmitServiceRequestDto } from '$lib/remotes/dtos/service.dto';
import { ServiceRequestError, ServiceService } from '$lib/server/services/service.service';
import { SERVICE_PRICING, SERVICE_REQUEST_STATUS } from '$lib/utils/services';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it } from 'vitest';

const FILE_FIELD = factory.serviceField({ id: 'design', label: 'Design', type: 'file' });
const MATERIAL_FIELD = factory.serviceField({
  id: 'material',
  label: 'Material',
  type: 'select',
  required: true,
  options: ['Wood', 'Acrylic'],
});

describe(ServiceService.name, () => {
  let sut: ServiceService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ServiceService));
  });

  describe('submitRequest', () => {
    function dto(overrides: Partial<SubmitServiceRequestDto> = {}): SubmitServiceRequestDto {
      return {
        serviceId: 'service-1',
        customerName: 'Jane Doe',
        email: 'jane@example.com',
        answers: { material: 'Wood' },
        ...overrides,
      };
    }

    function stubCreate() {
      mocks.serviceRepository.createRequest.mockImplementation(async (data) =>
        factory.serviceRequest({ ...data, price: data.price ?? null }),
      );
    }

    it('stores the fixed price and a snapshot of the form', async () => {
      const service = factory.service({ price: 4200, fields: [MATERIAL_FIELD] });
      mocks.serviceRepository.getById.mockResolvedValue(service);
      stubCreate();

      const result = await sut.submitRequest(dto());

      expect(result).toEqual({ pricingMode: SERVICE_PRICING.FIXED, price: 4200 });
      expect(mocks.serviceRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: service.id,
          price: 4200,
          fields: [MATERIAL_FIELD],
          status: SERVICE_REQUEST_STATUS.SUBMITTED,
        }),
      );
    });

    it('leaves a variable price empty until staff quote it', async () => {
      mocks.serviceRepository.getById.mockResolvedValue(
        factory.service({ pricingMode: SERVICE_PRICING.VARIABLE, fields: [MATERIAL_FIELD] }),
      );
      stubCreate();

      const result = await sut.submitRequest(dto());

      expect(result.price).toBeNull();
      expect(mocks.serviceRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ price: null }),
      );
    });

    it('rejects a disabled or missing service', async () => {
      mocks.serviceRepository.getById.mockResolvedValue(factory.service({ enabled: false }));
      await expect(sut.submitRequest(dto())).rejects.toBeInstanceOf(NotFoundError);

      mocks.serviceRepository.getById.mockResolvedValue(undefined as never);
      await expect(sut.submitRequest(dto())).rejects.toBeInstanceOf(NotFoundError);
      expect(mocks.serviceRepository.createRequest).not.toHaveBeenCalled();
    });

    it('rejects answers that do not satisfy the form', async () => {
      mocks.serviceRepository.getById.mockResolvedValue(
        factory.service({ fields: [MATERIAL_FIELD] }),
      );

      await expect(sut.submitRequest(dto({ answers: {} }))).rejects.toBeInstanceOf(
        ServiceRequestError,
      );
      expect(mocks.serviceRepository.createRequest).not.toHaveBeenCalled();
    });

    it('drops answers for fields the service does not have', async () => {
      mocks.serviceRepository.getById.mockResolvedValue(
        factory.service({ fields: [MATERIAL_FIELD] }),
      );
      stubCreate();

      await sut.submitRequest(dto({ answers: { material: 'Wood', admin: 'true' } }));

      expect(mocks.serviceRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ answers: { material: 'Wood' } }),
      );
    });

    it('stores uploaded files under the request and keeps the storage key as the answer', async () => {
      mocks.serviceRepository.getById.mockResolvedValue(factory.service({ fields: [FILE_FIELD] }));
      mocks.serviceRepository.uploadRequestFile.mockImplementation(
        async (requestId, fieldId, file) => `service_requests/${requestId}/${fieldId}/${file.name}`,
      );
      stubCreate();
      const file = new File(['svg'], 'logo.svg');

      await sut.submitRequest(dto({ answers: { design: file } }));

      const [requestId, fieldId, uploaded] =
        mocks.serviceRepository.uploadRequestFile.mock.calls[0];
      expect([fieldId, uploaded]).toEqual(['design', file]);
      expect(mocks.serviceRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          id: requestId,
          answers: { design: `service_requests/${requestId}/design/logo.svg` },
        }),
      );
    });
  });

  describe('getRequests', () => {
    it('signs file links using the field types saved with the request', async () => {
      // The text answer looks like a storage key but its field was never a file field.
      const request = factory.serviceRequest({
        fields: [FILE_FIELD, factory.serviceField({ id: 'note', type: 'text' })],
        answers: {
          design: 'service_requests/abc/design/logo.svg',
          note: 'service_requests/other/design/secret.svg',
        },
      });
      mocks.serviceRepository.getRequests.mockResolvedValue([{ request, serviceName: 'Laser' }]);

      const [row] = await sut.getRequests();

      expect(Object.keys(row.files)).toEqual(['design']);
      expect(row.files.design.name).toBe('logo.svg');
    });
  });

  describe('updateRequestStatus', () => {
    function stubRequest(overrides: Parameters<typeof factory.serviceRequest>[0] = {}) {
      const request = factory.serviceRequest({ id: 'request-1', ...overrides });
      mocks.serviceRepository.getRequestById.mockResolvedValue(request);
      mocks.serviceRepository.updateRequest.mockResolvedValue(request);
      return request;
    }

    it('rejects a missing request', async () => {
      mocks.serviceRepository.getRequestById.mockResolvedValue(undefined as never);

      await expect(
        sut.updateRequestStatus({ id: 'nope', status: SERVICE_REQUEST_STATUS.DONE }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('only lets a quote move a request to quoted', async () => {
      stubRequest();

      await expect(
        sut.updateRequestStatus({ id: 'request-1', status: SERVICE_REQUEST_STATUS.QUOTED }),
      ).rejects.toBeInstanceOf(ServiceRequestError);
    });

    it.each([SERVICE_REQUEST_STATUS.IN_PROGRESS, SERVICE_REQUEST_STATUS.DONE])(
      'does not start work (%s) before a quote',
      async (status) => {
        stubRequest({ price: null });

        await expect(sut.updateRequestStatus({ id: 'request-1', status })).rejects.toBeInstanceOf(
          ServiceRequestError,
        );
        expect(mocks.serviceRepository.updateRequest).not.toHaveBeenCalled();
      },
    );

    it('starts work on a priced request', async () => {
      stubRequest({ price: 5000, status: SERVICE_REQUEST_STATUS.QUOTED });

      await sut.updateRequestStatus({
        id: 'request-1',
        status: SERVICE_REQUEST_STATUS.IN_PROGRESS,
      });

      expect(mocks.serviceRepository.updateRequest).toHaveBeenCalledWith('request-1', {
        status: SERVICE_REQUEST_STATUS.IN_PROGRESS,
      });
    });

    it('clears the quote when a variable request goes back to submitted', async () => {
      stubRequest({ price: 5000, status: SERVICE_REQUEST_STATUS.QUOTED });
      mocks.serviceRepository.getById.mockResolvedValue(
        factory.service({ pricingMode: SERVICE_PRICING.VARIABLE }),
      );

      await sut.updateRequestStatus({ id: 'request-1', status: SERVICE_REQUEST_STATUS.SUBMITTED });

      expect(mocks.serviceRepository.updateRequest).toHaveBeenCalledWith('request-1', {
        status: SERVICE_REQUEST_STATUS.SUBMITTED,
        price: null,
      });
    });

    it('keeps the price of a fixed-price request that goes back to submitted', async () => {
      stubRequest({ price: 2500, status: SERVICE_REQUEST_STATUS.IN_PROGRESS });
      mocks.serviceRepository.getById.mockResolvedValue(
        factory.service({ pricingMode: SERVICE_PRICING.FIXED }),
      );

      await sut.updateRequestStatus({ id: 'request-1', status: SERVICE_REQUEST_STATUS.SUBMITTED });

      expect(mocks.serviceRepository.updateRequest).toHaveBeenCalledWith('request-1', {
        status: SERVICE_REQUEST_STATUS.SUBMITTED,
      });
    });
  });

  describe('quoteRequest', () => {
    it('quotes a request that is waiting for one', async () => {
      const request = factory.serviceRequest({ id: 'request-1', price: null });
      mocks.serviceRepository.getRequestById.mockResolvedValue(request);
      mocks.serviceRepository.updateRequest.mockResolvedValue(request);

      await sut.quoteRequest({ id: 'request-1', price: 6000 });

      expect(mocks.serviceRepository.updateRequest).toHaveBeenCalledWith('request-1', {
        price: 6000,
        status: SERVICE_REQUEST_STATUS.QUOTED,
      });
    });

    it('does not re-price a fixed-price request', async () => {
      mocks.serviceRepository.getRequestById.mockResolvedValue(
        factory.serviceRequest({ id: 'request-1', price: 2500 }),
      );

      await expect(sut.quoteRequest({ id: 'request-1', price: 1 })).rejects.toBeInstanceOf(
        ServiceRequestError,
      );
      expect(mocks.serviceRepository.updateRequest).not.toHaveBeenCalled();
    });
  });
});
