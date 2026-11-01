import { env } from '$env/dynamic/private';
import type { PayPaymentDto } from '$lib/remotes/dtos/payment.dto';
import type { Payment } from '$lib/server/db/schema';
import { PaymentStateError } from '$lib/server/repositories/payment.repository';
import { BaseService } from '$lib/server/services/base.service';
import { squareWebSdkUrl } from '$lib/server/utils/square';
import { isPayableOnline, PAYMENT_TYPE, type PaymentType } from '$lib/utils/billing';

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
    payable: isPayableOnline(payment),
  };
}

export type PaymentCheckout = ReturnType<typeof toCheckout>;

export class PaymentService extends BaseService {
  async getCheckoutConfig() {
    const { locationId } = await this.settingsRepository.getSetting('printRequestSquare');
    return {
      applicationId: env.SQUARE_APPLICATION_ID ?? '',
      locationId,
      webSdkUrl: squareWebSdkUrl(),
    };
  }

  async getCheckout(id: string) {
    const payment = await this.paymentRepository.getById(id);
    return payment ? toCheckout(payment) : null;
  }

  async pay(dto: PayPaymentDto) {
    const payment = await this.paymentRepository.getById(dto.id);
    if (!payment || !isPayableOnline(payment)) {
      throw new PaymentStateError('This payment cannot be paid online');
    }

    return toCheckout(await this.paymentGateway.pay(payment, dto.sourceId));
  }
}

export const paymentService = new PaymentService();
