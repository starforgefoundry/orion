import type { Payment } from '$lib/server/db/schema';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { factory } from '$test/factory';
import type { PrintRequestDetail } from '$test/factory/print_request';
import { newTestService, stubSettings, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintPaymentError, PrintPaymentService } from './print_payment.service';

const REQUEST_ID = 'request-1';
const PAYMENT_ID = 'payment-1';
const STATUS_URL = `https://orion.example.com/print_request/status/${REQUEST_ID}`;
const PRINT_EMAIL = 'prints@example.com';
const WEBHOOK_URL = 'https://discord.test/webhook';
const PRICING = { additionalBuildPlatePrice: 250, memberDiscountPercent: 10 };
const ORGANIZATION = factory.organization({ name: 'Acme Robotics' });

function payment(overrides: Partial<Payment> = {}) {
  return factory.payment({
    id: PAYMENT_ID,
    total: 1000,
    lineItems: [{ name: '3D Print Material', description: 'PLA', quantity: 1, unitAmount: 1000 }],
    paymentUrl: STATUS_URL,
    ...overrides,
  });
}

function printRequest(overrides: Partial<PrintRequestDetail> = {}) {
  return factory.printRequestDetail({
    id: REQUEST_ID,
    email: 'jane@example.com',
    customerName: 'Jane Doe',
    projectName: 'Robot Arm',
    material: factory.printMaterial({ name: 'PLA Basic - Black', materialType: 'PLA' }),
    ...overrides,
  });
}

function organizationCode() {
  return {
    billingCode: factory.billingCode({ code: 'ACME', organizationId: ORGANIZATION.id }),
    organization: ORGANIZATION,
  };
}

describe(PrintPaymentService.name, () => {
  let sut: PrintPaymentService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PrintPaymentService));
    stubSettings(mocks.settingsRepository, {
      printPricing: PRICING,
      printRequest: {
        isOpen: true,
        announcement: '',
        announcementUntil: '',
        maxUploadMB: 1000,
        allowedFileTypes: '.stl',
        discordWebhookUrl: WEBHOOK_URL,
      },
    });
    mocks.printRequestRepository.getById.mockResolvedValue(printRequest());
    mocks.printRequestRepository.update.mockResolvedValue([]);
    mocks.billingCodeRepository.getByCode.mockResolvedValue(undefined as never);
    mocks.memberRepository.getAccessContextByEmail.mockResolvedValue(undefined);
    mocks.mailgunRepository.sendTemplate.mockResolvedValue(undefined as never);
    mocks.squareRepository.cancelInvoice.mockResolvedValue(undefined as never);
    mocks.paymentRepository.save.mockImplementation(async (data, id) =>
      factory.payment({
        id: id ?? PAYMENT_ID,
        status:
          data.status === PAYMENT_STATUS.PENDING && data.bill.total === 0
            ? PAYMENT_STATUS.PAID
            : data.status,
        total: data.bill.total,
        organizationId: data.organizationId ?? null,
      }),
    );
    mocks.paymentRepository.approveQuote.mockImplementation(async (quote) => ({
      ...quote,
      status: PAYMENT_STATUS.PENDING,
    }));
    mocks.paymentRepository.pay.mockImplementation(async (pending) => ({
      ...pending,
      status: PAYMENT_STATUS.PAID,
    }));
  });

  function mockMember() {
    mocks.memberRepository.getAccessContextByEmail.mockResolvedValue(
      factory.memberAccessContext({ subscriptions: [factory.memberSubscription()] }),
    );
  }

  function savedPayment() {
    return mocks.paymentRepository.save.mock.calls[0][0];
  }

  describe('upsertPayment', () => {
    const dto = { requestId: REQUEST_ID, materialCost: 700, buildPlates: 3 };

    it('bills material and extra build plates as Orion line items', async () => {
      await sut.upsertPayment(dto);

      expect(savedPayment()).toMatchObject({
        type: PAYMENT_TYPE.PRINT_REQUEST,
        status: PAYMENT_STATUS.PENDING,
        customer: { name: 'Jane Doe', email: 'jane@example.com' },
        paymentUrl: STATUS_URL,
        bill: {
          lineItems: [
            { name: '3D Print Material', description: 'PLA', quantity: 1, unitAmount: 700 },
            { name: 'Additional Build Plate', quantity: 2, unitAmount: 250 },
          ],
          discounts: [],
          total: 1200,
        },
      });
      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith(REQUEST_ID, {
        paymentId: PAYMENT_ID,
        materialCost: 700,
        buildplateCount: 3,
      });
    });

    it('emails the customer a link to pay', async () => {
      await sut.upsertPayment(dto);

      expect(mocks.mailgunRepository.sendTemplate).toHaveBeenCalledWith(
        'jane@example.com',
        expect.any(String),
        PRINT_EMAIL,
        'print_payment',
        {
          customerName: 'Jane Doe',
          projectName: 'Robot Arm',
          total: '12.00',
          paymentURL: STATUS_URL,
        },
      );
    });

    it('takes the member discount off for members', async () => {
      mockMember();

      await sut.upsertPayment(dto);

      expect(savedPayment().bill.discounts).toEqual([
        { name: 'Member Discount (10%)', amount: 120 },
      ]);
      expect(savedPayment().bill.total).toBe(1080);
    });

    it('sends a quote instead of a bill when the customer asked for one', async () => {
      mocks.printRequestRepository.getById.mockResolvedValue(printRequest({ isQuote: true }));

      await sut.upsertPayment(dto);

      expect(savedPayment().status).toBe(PAYMENT_STATUS.QUOTE);
      expect(mocks.mailgunRepository.sendTemplate).toHaveBeenCalledWith(
        'jane@example.com',
        expect.any(String),
        expect.any(String),
        'print_quote',
        expect.objectContaining({ quotePrice: '12.00', quoteURL: STATUS_URL }),
      );
    });

    it('keeps an approved quote as a bill when it is edited', async () => {
      mocks.printRequestRepository.getById.mockResolvedValue(
        printRequest({ isQuote: true, payment: payment() }),
      );

      await sut.upsertPayment(dto);

      expect(savedPayment().status).toBe(PAYMENT_STATUS.PENDING);
      expect(mocks.paymentRepository.save.mock.calls[0][1]).toBe(PAYMENT_ID);
    });

    it('bills an organization without the member discount or an email', async () => {
      mockMember();
      mocks.billingCodeRepository.getByCode.mockResolvedValue(organizationCode());
      mocks.printRequestRepository.getById.mockResolvedValue(printRequest({ billingCode: 'ACME' }));

      await sut.upsertPayment(dto);

      expect(savedPayment()).toMatchObject({
        organizationId: ORGANIZATION.id,
        paymentUrl: null,
        bill: { discounts: [], total: 1200 },
      });
      expect(mocks.mailgunRepository.sendTemplate).not.toHaveBeenCalled();
    });

    it('does not ask for a card when nothing is owed', async () => {
      await sut.upsertPayment({ ...dto, materialCost: 0, buildPlates: 1 });

      expect(mocks.mailgunRepository.sendTemplate).not.toHaveBeenCalled();
    });

    it('cancels the Square invoice of a payment made before Orion billing', async () => {
      mocks.printRequestRepository.getById.mockResolvedValue(
        printRequest({ payment: payment({ squareInvoiceId: 'inv-1' }) }),
      );

      await sut.upsertPayment(dto);

      expect(mocks.squareRepository.cancelInvoice).toHaveBeenCalledWith('inv-1');
    });

    it('refuses to change a paid bill', async () => {
      mocks.printRequestRepository.getById.mockResolvedValue(
        printRequest({ payment: payment({ status: PAYMENT_STATUS.PAID }) }),
      );

      await expect(sut.upsertPayment(dto)).rejects.toThrow('already been paid');
      expect(mocks.paymentRepository.save).not.toHaveBeenCalled();
    });

    it.each([PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.CANCELED, PAYMENT_STATUS.REFUNDED])(
      'refuses to re-price a %s bill',
      async (status) => {
        mocks.printRequestRepository.getById.mockResolvedValue(
          printRequest({ payment: payment({ status }) }),
        );

        await expect(sut.upsertPayment(dto)).rejects.toThrow('can no longer be changed');
        expect(mocks.paymentRepository.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('updatePrintRequestDiscount', () => {
    it('rebuilds an unpaid bill for the new group code', async () => {
      mocks.printRequestRepository.getById.mockResolvedValue(
        printRequest({ payment: payment(), materialCost: 500, buildplateCount: 1 }),
      );
      mocks.billingCodeRepository.getByCode.mockResolvedValue(organizationCode());

      await sut.updatePrintRequestDiscount(REQUEST_ID, { billingCode: 'ACME' });

      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith(REQUEST_ID, {
        billingCode: 'ACME',
      });
      expect(mocks.paymentRepository.save).toHaveBeenCalledOnce();
    });

    it('only stores the code when there is no unpaid bill', async () => {
      mocks.billingCodeRepository.getByCode.mockResolvedValue(organizationCode());

      await sut.updatePrintRequestDiscount(REQUEST_ID, { billingCode: 'ACME' });

      expect(mocks.paymentRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a code that does not exist', async () => {
      await expect(
        sut.updatePrintRequestDiscount(REQUEST_ID, { billingCode: 'NOPE' }),
      ).rejects.toThrow('Group code not found');
    });
  });

  describe('respondToQuote', () => {
    beforeEach(() => {
      mocks.printRequestRepository.getById.mockResolvedValue(
        printRequest({ isQuote: true, payment: payment({ status: PAYMENT_STATUS.QUOTE }) }),
      );
      mocks.paymentRepository.cancel.mockResolvedValue(undefined as never);
      mocks.discordRepository.sendWebhookNotification.mockResolvedValue(undefined as never);
    });

    it('approves the quote so the customer can pay', async () => {
      const approved = await sut.respondToQuote({ id: REQUEST_ID, approve: true });

      expect(approved?.status).toBe(PAYMENT_STATUS.PENDING);
      await vi.waitFor(() =>
        expect(mocks.discordRepository.sendWebhookNotification).toHaveBeenCalledWith(
          WEBHOOK_URL,
          expect.objectContaining({
            content: expect.stringContaining(`/staff/print_requests/queue?id=${REQUEST_ID}`),
            embeds: [
              expect.objectContaining({
                fields: expect.arrayContaining([{ name: 'Total', value: '$10.00', inline: false }]),
              }),
            ],
          }),
        ),
      );
    });

    it('cancels the request and its quote when the customer declines', async () => {
      await sut.respondToQuote({ id: REQUEST_ID, approve: false });

      expect(mocks.paymentRepository.cancel).toHaveBeenCalledWith(
        expect.objectContaining({ id: PAYMENT_ID }),
      );
      expect(mocks.printRequestRepository.update).toHaveBeenCalledWith(REQUEST_ID, {
        status: 'canceled',
        completionDate: expect.any(DateTime),
      });
      expect(mocks.paymentRepository.approveQuote).not.toHaveBeenCalled();
    });

    it('rejects a quote that was already answered', async () => {
      mocks.printRequestRepository.getById.mockResolvedValue(
        printRequest({ isQuote: true, payment: payment() }),
      );

      await expect(sut.respondToQuote({ id: REQUEST_ID, approve: true })).rejects.toThrow(
        PrintPaymentError,
      );
    });
  });

  describe('payPrintRequest', () => {
    it('charges the card for an unpaid bill', async () => {
      mocks.printRequestRepository.getById.mockResolvedValue(printRequest({ payment: payment() }));

      await sut.payPrintRequest({ id: REQUEST_ID, sourceId: 'cnon:ok' });

      expect(mocks.paymentRepository.pay).toHaveBeenCalledWith(
        expect.objectContaining({ id: PAYMENT_ID }),
        'cnon:ok',
      );
    });

    it.each([
      ['a quote', payment({ status: PAYMENT_STATUS.QUOTE })],
      ['a paid bill', payment({ status: PAYMENT_STATUS.PAID })],
      ['an organization bill', payment({ organizationId: ORGANIZATION.id })],
      ['a Square invoice', payment({ squareInvoiceId: 'inv-1' })],
    ])('refuses to charge %s', async (_, existing) => {
      mocks.printRequestRepository.getById.mockResolvedValue(printRequest({ payment: existing }));

      await expect(sut.payPrintRequest({ id: REQUEST_ID, sourceId: 'cnon:ok' })).rejects.toThrow(
        PrintPaymentError,
      );
      expect(mocks.paymentRepository.pay).not.toHaveBeenCalled();
    });
  });
});
