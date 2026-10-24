import type { PayPaymentDto } from '$lib/remotes/dtos/payment.dto';
import type { Payment } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';
import { PAYMENT_STATUS, PAYMENT_TYPE, type PaymentType } from '$lib/utils/billing';

export class PaymentNotPayableError extends Error {
  constructor() {
    super('This payment cannot be paid online');
  }
}

const PAYMENT_TITLES: Record<PaymentType, string> = {
  [PAYMENT_TYPE.PRINT_REQUEST]: '3D Print Request',
  [PAYMENT_TYPE.CLASS_BOOKING]: 'Class Booking',
  [PAYMENT_TYPE.CAR_BAY_BOOKING]: 'Car Bay Booking',
  [PAYMENT_TYPE.CAR_BAY_OVERRUN]: 'Car Bay Overrun',
  [PAYMENT_TYPE.ORG_CHARGE]: 'Organization Charge',
  [PAYMENT_TYPE.BALANCE]: 'Organization Balance',
};

function toCheckout(payment: Payment) {
  return {
    id: payment.id,
    title: PAYMENT_TITLES[payment.type],
    customerName: payment.customerName,
    status: payment.status,
    issuedDate: payment.issuedDate.toISO()!,
    paymentDate: payment.paymentDate?.toISO() ?? null,
    lineItems: payment.lineItems,
    discounts: payment.discounts,
    total: payment.total,
    invoiceUrl: payment.squareInvoiceId ? payment.paymentUrl : null,
  };
}

export type PaymentCheckout = ReturnType<typeof toCheckout>;

export class PaymentService extends BaseService {
  async getCheckout(id: string) {
    const payment = await this.paymentRepository.getById(id);
    return payment ? toCheckout(payment) : null;
  }

  async pay(dto: PayPaymentDto) {
    const payment = await this.paymentRepository.getById(dto.id);
    if (!payment || payment.status !== PAYMENT_STATUS.PENDING || payment.squareInvoiceId) {
      throw new PaymentNotPayableError();
    }

    return toCheckout(await this.paymentRepository.pay(payment, dto.sourceId));
  }
}

export const paymentService = new PaymentService();
