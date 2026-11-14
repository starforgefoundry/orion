import { NotFoundError } from '$lib/errors';
import type { SubmitServiceRequestDto } from '$lib/remotes/dtos/service.dto';
import type { Payment } from '$lib/server/db/schema';
import { ServiceRequestError, ServiceService } from '$lib/server/services/service.service';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import {
  SERVICE_PRICING,
  SERVICE_REQUEST_STATUS,
  type ServiceRequestStatus,
} from '$lib/utils/services';
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
const PAYMENT_ID = 'payment-1';
const REQUEST_ID = 'request-1';
const ENGRAVING_ITEM = { name: 'Laser Engraving', quantity: 1, unitAmount: 6000 };
const PRICED = { status: PAYMENT_STATUS.PENDING, lineItems: [ENGRAVING_ITEM], total: 6000 };

describe(ServiceService.name, () => {
  let sut: ServiceService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ServiceService));
    // Mirrors the repository, which settles a $0 pending bill on save.
    mocks.paymentRepository.save.mockImplementation(async (data, id) =>
      factory.savedPayment(data, {
        id: id ?? PAYMENT_ID,
        status:
          data.status === PAYMENT_STATUS.PENDING && data.bill.total === 0
            ? PAYMENT_STATUS.PAID
            : data.status,
      }),
    );
  });

  /** A variable-price request whose payment starts as an empty quote. */
  function stubRequest(
    payment: Partial<Payment> = {},
    status: ServiceRequestStatus = SERVICE_REQUEST_STATUS.SUBMITTED,
  ) {
    const request = factory.serviceRequest({ id: REQUEST_ID, paymentId: PAYMENT_ID, status });
    const row = {
      request,
      serviceName: 'Laser Engraving',
      pricingMode: SERVICE_PRICING.VARIABLE,
      payment: factory.payment({
        id: PAYMENT_ID,
        type: PAYMENT_TYPE.SERVICE_REQUEST,
        status: PAYMENT_STATUS.QUOTE,
        lineItems: [],
        total: 0,
        ...payment,
      }),
    };
    mocks.serviceRepository.getRequestById.mockResolvedValue(row);
    mocks.serviceRepository.updateRequest.mockResolvedValue(request);
    return row;
  }

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
        factory.serviceRequest(data),
      );
    }

    it('bills a fixed price as one pending line item and keeps a snapshot of the form', async () => {
      const service = factory.service({ price: 4200, fields: [MATERIAL_FIELD] });
      mocks.serviceRepository.getById.mockResolvedValue(service);
      stubCreate();

      const result = await sut.submitRequest(dto());

      expect(result).toEqual({
        id: expect.any(String),
        pricingMode: SERVICE_PRICING.FIXED,
        price: 4200,
        paymentId: PAYMENT_ID,
        email: 'jane@example.com',
      });
      expect(mocks.paymentRepository.save).toHaveBeenCalledWith({
        type: PAYMENT_TYPE.SERVICE_REQUEST,
        status: PAYMENT_STATUS.PENDING,
        customer: { name: 'Jane Doe', email: 'jane@example.com' },
        bill: expect.objectContaining({
          lineItems: [{ name: service.name, quantity: 1, unitAmount: 4200 }],
          total: 4200,
        }),
      });
      expect(mocks.serviceRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: service.id,
          paymentId: PAYMENT_ID,
          fields: [MATERIAL_FIELD],
          status: SERVICE_REQUEST_STATUS.SUBMITTED,
        }),
      );
    });

    it('settles a $0 fixed price at submit', async () => {
      mocks.serviceRepository.getById.mockResolvedValue(
        factory.service({ price: 0, fields: [MATERIAL_FIELD] }),
      );
      stubCreate();

      const result = await sut.submitRequest(dto());

      expect(result.price).toBe(0);
      await expect(mocks.paymentRepository.save.mock.results[0].value).resolves.toMatchObject({
        status: PAYMENT_STATUS.PAID,
      });
    });

    it('opens an empty quote for a variable price', async () => {
      mocks.serviceRepository.getById.mockResolvedValue(
        factory.service({ pricingMode: SERVICE_PRICING.VARIABLE, fields: [MATERIAL_FIELD] }),
      );
      stubCreate();

      const result = await sut.submitRequest(dto());

      expect(result).toMatchObject({ pricingMode: SERVICE_PRICING.VARIABLE, price: 0 });
      expect(mocks.paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PAYMENT_STATUS.QUOTE,
          bill: expect.objectContaining({ lineItems: [], total: 0 }),
        }),
      );
    });

    it('rejects a disabled or missing service', async () => {
      mocks.serviceRepository.getById.mockResolvedValue(factory.service({ enabled: false }));
      await expect(sut.submitRequest(dto())).rejects.toBeInstanceOf(NotFoundError);

      mocks.serviceRepository.getById.mockResolvedValue(undefined as never);
      await expect(sut.submitRequest(dto())).rejects.toBeInstanceOf(NotFoundError);
      expect(mocks.paymentRepository.save).not.toHaveBeenCalled();
      expect(mocks.serviceRepository.createRequest).not.toHaveBeenCalled();
    });

    it('rejects answers that do not satisfy the form', async () => {
      mocks.serviceRepository.getById.mockResolvedValue(
        factory.service({ fields: [MATERIAL_FIELD] }),
      );

      await expect(sut.submitRequest(dto({ answers: {} }))).rejects.toBeInstanceOf(
        ServiceRequestError,
      );
      expect(mocks.paymentRepository.save).not.toHaveBeenCalled();
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
      const row = stubRequest();
      row.request.fields = [FILE_FIELD, factory.serviceField({ id: 'note', type: 'text' })];
      row.request.answers = {
        design: 'service_requests/abc/design/logo.svg',
        note: 'service_requests/other/design/secret.svg',
      };
      mocks.serviceRepository.getRequests.mockResolvedValue([row]);

      const [result] = await sut.getRequests();

      expect(Object.keys(result.files)).toEqual(['design']);
      expect(result.files.design.name).toBe('logo.svg');
    });
  });

  describe('updateRequestStatus', () => {
    it('rejects a missing request', async () => {
      mocks.serviceRepository.getRequestById.mockResolvedValue(undefined as never);

      await expect(
        sut.updateRequestStatus({ id: 'nope', status: SERVICE_REQUEST_STATUS.DONE }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it.each([SERVICE_REQUEST_STATUS.IN_PROGRESS, SERVICE_REQUEST_STATUS.DONE])(
      'does not start work (%s) before a quote',
      async (status) => {
        stubRequest();

        await expect(sut.updateRequestStatus({ id: REQUEST_ID, status })).rejects.toThrow(
          new ServiceRequestError('Send a quote before starting work.'),
        );
        expect(mocks.serviceRepository.updateRequest).not.toHaveBeenCalled();
      },
    );

    it('starts work on a priced request', async () => {
      stubRequest(PRICED);

      await sut.updateRequestStatus({ id: REQUEST_ID, status: SERVICE_REQUEST_STATUS.IN_PROGRESS });

      expect(mocks.serviceRepository.updateRequest).toHaveBeenCalledWith(REQUEST_ID, {
        status: SERVICE_REQUEST_STATUS.IN_PROGRESS,
      });
    });

    it('cancels an unpaid payment with the request', async () => {
      const { payment } = stubRequest();
      mocks.paymentGateway.cancel.mockResolvedValue({
        ...payment,
        status: PAYMENT_STATUS.CANCELED,
      });

      await sut.updateRequestStatus({ id: REQUEST_ID, status: SERVICE_REQUEST_STATUS.CANCELED });

      expect(mocks.paymentGateway.cancel).toHaveBeenCalledWith(payment);
      expect(mocks.serviceRepository.updateRequest).toHaveBeenCalledWith(REQUEST_ID, {
        status: SERVICE_REQUEST_STATUS.CANCELED,
      });
    });

    it.each([PAYMENT_STATUS.PAID, PAYMENT_STATUS.PROCESSING])(
      'rejects canceling a request whose payment is %s',
      async (status) => {
        stubRequest({ ...PRICED, status });

        await expect(
          sut.updateRequestStatus({ id: REQUEST_ID, status: SERVICE_REQUEST_STATUS.CANCELED }),
        ).rejects.toThrow(new ServiceRequestError('Only unpaid requests can be canceled.'));
        expect(mocks.paymentGateway.cancel).not.toHaveBeenCalled();
        expect(mocks.serviceRepository.updateRequest).not.toHaveBeenCalled();
      },
    );

    it('cancels a free request that was settled at submit', async () => {
      const { payment } = stubRequest({ status: PAYMENT_STATUS.PAID, total: 0 });
      mocks.paymentGateway.cancel.mockResolvedValue({
        ...payment,
        status: PAYMENT_STATUS.CANCELED,
      });

      await sut.updateRequestStatus({ id: REQUEST_ID, status: SERVICE_REQUEST_STATUS.CANCELED });

      expect(mocks.paymentGateway.cancel).toHaveBeenCalledWith(payment);
      expect(mocks.serviceRepository.updateRequest).toHaveBeenCalledWith(REQUEST_ID, {
        status: SERVICE_REQUEST_STATUS.CANCELED,
      });
    });

    it('accepts a repeated cancel without canceling the payment again', async () => {
      stubRequest({ status: PAYMENT_STATUS.CANCELED }, SERVICE_REQUEST_STATUS.CANCELED);

      await sut.updateRequestStatus({ id: REQUEST_ID, status: SERVICE_REQUEST_STATUS.CANCELED });

      expect(mocks.paymentGateway.cancel).not.toHaveBeenCalled();
    });

    it('does not reopen a request whose payment was canceled', async () => {
      stubRequest({ status: PAYMENT_STATUS.CANCELED }, SERVICE_REQUEST_STATUS.CANCELED);

      await expect(
        sut.updateRequestStatus({ id: REQUEST_ID, status: SERVICE_REQUEST_STATUS.SUBMITTED }),
      ).rejects.toBeInstanceOf(ServiceRequestError);
      expect(mocks.serviceRepository.updateRequest).not.toHaveBeenCalled();
    });
  });

  describe('priceRequest', () => {
    it('turns the quote into a pending bill with one line item', async () => {
      stubRequest();

      const payment = await sut.priceRequest({ id: REQUEST_ID, price: 6000 });

      expect(mocks.paymentRepository.save).toHaveBeenCalledWith(
        {
          type: PAYMENT_TYPE.SERVICE_REQUEST,
          status: PAYMENT_STATUS.PENDING,
          customer: { name: 'Jane Doe', email: 'jane@example.com' },
          bill: expect.objectContaining({ lineItems: [ENGRAVING_ITEM], total: 6000 }),
        },
        PAYMENT_ID,
      );
      expect(payment).toMatchObject({ status: PAYMENT_STATUS.PENDING, total: 6000 });
    });

    it('re-prices a bill that is still unpaid', async () => {
      stubRequest(PRICED);

      await sut.priceRequest({ id: REQUEST_ID, price: 7000 });

      expect(mocks.paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ bill: expect.objectContaining({ total: 7000 }) }),
        PAYMENT_ID,
      );
    });

    it.each([PAYMENT_STATUS.PAID, PAYMENT_STATUS.CANCELED])(
      'does not re-price a %s payment',
      async (status) => {
        stubRequest({ ...PRICED, status });

        await expect(sut.priceRequest({ id: REQUEST_ID, price: 1 })).rejects.toBeInstanceOf(
          ServiceRequestError,
        );
        expect(mocks.paymentRepository.save).not.toHaveBeenCalled();
      },
    );

    it('does not quote a fixed-price request', async () => {
      const row = stubRequest(PRICED);
      mocks.serviceRepository.getRequestById.mockResolvedValue({
        ...row,
        pricingMode: SERVICE_PRICING.FIXED,
      });

      await expect(sut.priceRequest({ id: REQUEST_ID, price: 1 })).rejects.toBeInstanceOf(
        ServiceRequestError,
      );
      expect(mocks.paymentRepository.save).not.toHaveBeenCalled();
    });
  });
});
