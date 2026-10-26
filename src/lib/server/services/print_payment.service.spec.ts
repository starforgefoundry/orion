import type { PrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintPaymentError, PrintPaymentService } from './print_payment.service';

vi.mock('$env/dynamic/private', () => ({ env: { FRONTEND_URL: 'https://orion.test' } }));
vi.mock('$env/dynamic/public', () => ({
  env: { PUBLIC_PRINT_REQUEST_EMAIL: '3dprint@example.com' },
}));

const STATUS_URL = 'https://orion.test/print_request/status/request-1';
const WEBHOOK_URL = 'https://discord.test/webhook';
const PRICING = { additionalBuildPlatePrice: 250, memberDiscountPercent: 10 };
const MEMBER_CONTEXT = {
  subscriptions: [{ status: 'active', accessEndedDate: null }],
  organizations: [],
  dayPasses: [],
};
const ORGANIZATION = { id: 'org-1', name: 'Acme Robotics' };

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    status: PAYMENT_STATUS.PENDING,
    total: 1000,
    lineItems: [{ name: '3D Print Material', description: 'PLA', quantity: 1, unitAmount: 1000 }],
    discounts: [],
    organizationId: null,
    squareInvoiceId: null,
    paymentUrl: STATUS_URL,
    ...overrides,
  };
}

function printRequest(overrides: Partial<PrintRequestDto> = {}): PrintRequestDto {
  return {
    id: 'request-1',
    email: 'jane@example.com',
    customerName: 'Jane Doe',
    projectName: 'Robot Arm',
    status: 'in_queue',
    isQuote: false,
    billingCode: null,
    paymentId: null,
    payment: null,
    material: { id: 'material-1', name: 'PLA Basic - Black', materialType: 'PLA' },
    files: [],
    materialCost: 0,
    buildplateCount: 1,
    submissionDate: DateTime.now(),
    completionDate: null,
    specialRequests: '',
    ...overrides,
  } as unknown as PrintRequestDto;
}

describe('PrintPaymentService', () => {
  let service: PrintPaymentService;
  let paymentRepo: any;
  let requestRepo: any;
  let squareRepo: any;
  let mailgunRepo: any;
  let discordRepo: any;
  let billingCodeRepo: any;
  let memberRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();

    paymentRepo = {
      getById: vi.fn(),
      save: vi.fn(async (data, id) => ({
        id: id ?? 'payment-1',
        status:
          data.status === PAYMENT_STATUS.PENDING && data.bill.total === 0 ? 'paid' : data.status,
        total: data.bill.total,
        organizationId: data.organizationId ?? null,
      })),
      approveQuote: vi.fn(async (p) => ({ ...p, status: PAYMENT_STATUS.PENDING })),
      pay: vi.fn(async (p) => ({ ...p, status: PAYMENT_STATUS.PAID })),
      cancel: vi.fn(),
    };
    requestRepo = { getById: vi.fn(async () => printRequest()), update: vi.fn() };
    squareRepo = { cancelInvoice: vi.fn() };
    mailgunRepo = { sendTemplate: vi.fn() };
    discordRepo = { sendWebhookNotification: vi.fn() };
    billingCodeRepo = { getByCode: vi.fn(async () => undefined) };
    memberRepo = { getAccessContextByEmail: vi.fn(async () => undefined) };
    const settingsRepo = {
      getSetting: vi.fn(async (key: string) =>
        key === 'printRequest' ? { discordWebhookUrl: WEBHOOK_URL } : PRICING,
      ),
    };

    service = new PrintPaymentService(
      undefined,
      undefined,
      requestRepo,
      paymentRepo,
      settingsRepo as any,
      squareRepo,
      mailgunRepo,
      discordRepo,
      undefined,
      billingCodeRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { memberRepository: memberRepo },
    );
  });

  function savedPayment() {
    return paymentRepo.save.mock.calls[0][0];
  }

  describe('upsertPayment', () => {
    const dto = { requestId: 'request-1', materialCost: 700, buildPlates: 3 };

    it('bills material and extra build plates as Orion line items', async () => {
      await service.upsertPayment(dto);

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
      expect(requestRepo.update).toHaveBeenCalledWith('request-1', {
        paymentId: 'payment-1',
        materialCost: 700,
        buildplateCount: 3,
      });
    });

    it('emails the customer a link to pay', async () => {
      await service.upsertPayment(dto);

      expect(mailgunRepo.sendTemplate).toHaveBeenCalledWith(
        'jane@example.com',
        expect.any(String),
        '3dprint@example.com',
        'Print Request Payment - Robot Arm',
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
      memberRepo.getAccessContextByEmail.mockResolvedValue(MEMBER_CONTEXT);

      await service.upsertPayment(dto);

      expect(savedPayment().bill.discounts).toEqual([
        { name: 'Member Discount (10%)', amount: 120 },
      ]);
      expect(savedPayment().bill.total).toBe(1080);
    });

    it('sends a quote instead of a bill when the customer asked for one', async () => {
      requestRepo.getById.mockResolvedValue(printRequest({ isQuote: true }));

      await service.upsertPayment(dto);

      expect(savedPayment().status).toBe(PAYMENT_STATUS.QUOTE);
      expect(mailgunRepo.sendTemplate).toHaveBeenCalledWith(
        'jane@example.com',
        expect.any(String),
        expect.any(String),
        'Print Request Quote - Robot Arm',
        'print_quote',
        expect.objectContaining({ quotePrice: '12.00', quoteURL: STATUS_URL }),
      );
    });

    it('keeps an approved quote as a bill when it is edited', async () => {
      requestRepo.getById.mockResolvedValue(
        printRequest({ isQuote: true, payment: payment() as any }),
      );

      await service.upsertPayment(dto);

      expect(savedPayment().status).toBe(PAYMENT_STATUS.PENDING);
      expect(paymentRepo.save.mock.calls[0][1]).toBe('payment-1');
    });

    it('bills an organization without the member discount or an email', async () => {
      memberRepo.getAccessContextByEmail.mockResolvedValue(MEMBER_CONTEXT);
      billingCodeRepo.getByCode.mockResolvedValue({ organization: ORGANIZATION });
      requestRepo.getById.mockResolvedValue(printRequest({ billingCode: 'ACME' }));

      await service.upsertPayment(dto);

      expect(savedPayment()).toMatchObject({
        organizationId: 'org-1',
        paymentUrl: null,
        bill: { discounts: [], total: 1200 },
      });
      expect(mailgunRepo.sendTemplate).not.toHaveBeenCalled();
    });

    it('does not ask for a card when nothing is owed', async () => {
      await service.upsertPayment({ ...dto, materialCost: 0, buildPlates: 1 });

      expect(mailgunRepo.sendTemplate).not.toHaveBeenCalled();
    });

    it('cancels the Square invoice of a payment made before Orion billing', async () => {
      requestRepo.getById.mockResolvedValue(
        printRequest({ payment: payment({ squareInvoiceId: 'inv-1' }) as any }),
      );

      await service.upsertPayment(dto);

      expect(squareRepo.cancelInvoice).toHaveBeenCalledWith('inv-1');
    });

    it('refuses to change a paid bill', async () => {
      requestRepo.getById.mockResolvedValue(
        printRequest({ payment: payment({ status: PAYMENT_STATUS.PAID }) as any }),
      );

      await expect(service.upsertPayment(dto)).rejects.toThrow('already been paid');
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it.each([PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.CANCELED, PAYMENT_STATUS.REFUNDED])(
      'refuses to re-price a %s bill',
      async (status) => {
        requestRepo.getById.mockResolvedValue(
          printRequest({ payment: payment({ status }) as any }),
        );

        await expect(service.upsertPayment(dto)).rejects.toThrow('can no longer be changed');
        expect(paymentRepo.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('updatePrintRequestDiscount', () => {
    it('rebuilds an unpaid bill for the new group code', async () => {
      requestRepo.getById.mockResolvedValue(
        printRequest({ payment: payment() as any, materialCost: 500, buildplateCount: 1 }),
      );
      billingCodeRepo.getByCode.mockResolvedValue({ organization: ORGANIZATION });

      await service.updatePrintRequestDiscount('request-1', { billingCode: 'ACME' });

      expect(requestRepo.update).toHaveBeenCalledWith('request-1', { billingCode: 'ACME' });
      expect(paymentRepo.save).toHaveBeenCalledOnce();
    });

    it('only stores the code when there is no unpaid bill', async () => {
      billingCodeRepo.getByCode.mockResolvedValue({ organization: ORGANIZATION });

      await service.updatePrintRequestDiscount('request-1', { billingCode: 'ACME' });

      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a code that does not exist', async () => {
      await expect(
        service.updatePrintRequestDiscount('request-1', { billingCode: 'NOPE' }),
      ).rejects.toThrow('Group code not found');
    });
  });

  describe('respondToQuote', () => {
    beforeEach(() => {
      requestRepo.getById.mockResolvedValue(
        printRequest({ isQuote: true, payment: payment({ status: PAYMENT_STATUS.QUOTE }) as any }),
      );
    });

    it('approves the quote so the customer can pay', async () => {
      const approved = await service.respondToQuote({ id: 'request-1', approve: true });

      expect(approved?.status).toBe(PAYMENT_STATUS.PENDING);
      await vi.waitFor(() =>
        expect(discordRepo.sendWebhookNotification).toHaveBeenCalledWith(
          WEBHOOK_URL,
          expect.objectContaining({
            content: expect.stringContaining('/staff/print_requests/queue?id=request-1'),
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
      await service.respondToQuote({ id: 'request-1', approve: false });

      expect(paymentRepo.cancel).toHaveBeenCalledWith(expect.objectContaining({ id: 'payment-1' }));
      expect(requestRepo.update).toHaveBeenCalledWith('request-1', {
        status: 'canceled',
        completionDate: expect.any(DateTime),
      });
      expect(paymentRepo.approveQuote).not.toHaveBeenCalled();
    });

    it('rejects a quote that was already answered', async () => {
      requestRepo.getById.mockResolvedValue(
        printRequest({ isQuote: true, payment: payment() as any }),
      );

      await expect(service.respondToQuote({ id: 'request-1', approve: true })).rejects.toThrow(
        PrintPaymentError,
      );
    });
  });

  describe('payPrintRequest', () => {
    it('charges the card for an unpaid bill', async () => {
      requestRepo.getById.mockResolvedValue(printRequest({ payment: payment() as any }));

      await service.payPrintRequest({ id: 'request-1', sourceId: 'cnon:ok' });

      expect(paymentRepo.pay).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'payment-1' }),
        'cnon:ok',
      );
    });

    it.each([
      ['a quote', payment({ status: PAYMENT_STATUS.QUOTE })],
      ['a paid bill', payment({ status: PAYMENT_STATUS.PAID })],
      ['an organization bill', payment({ organizationId: 'org-1' })],
      ['a Square invoice', payment({ squareInvoiceId: 'inv-1' })],
    ])('refuses to charge %s', async (_, existing) => {
      requestRepo.getById.mockResolvedValue(printRequest({ payment: existing as any }));

      await expect(
        service.payPrintRequest({ id: 'request-1', sourceId: 'cnon:ok' }),
      ).rejects.toThrow(PrintPaymentError);
      expect(paymentRepo.pay).not.toHaveBeenCalled();
    });
  });
});
