import { env as publicEnv } from '$env/dynamic/public';
import type { PayPaymentDto } from '$lib/remotes/dtos/payment.dto';
import type { CreatePaymentDto } from '$lib/remotes/dtos/print_payment.dto';
import type {
  PrintRequestDto,
  RespondToQuoteDto,
  UpdatePrintRequestDiscountDto,
} from '$lib/remotes/dtos/print_request.dto';
import { PaymentError } from '$lib/server/repositories/payment.repository';
import { BaseService } from '$lib/server/services/base.service';
import { runInBackground } from '$lib/server/utils/background';
import { printSender } from '$lib/server/utils/email_templates/senders';
import { hasMembership } from '$lib/server/utils/member_access';
import { printQueueUrl, printRequestStatusUrl } from '$lib/server/utils/payment_links';
import {
  centsToDollars,
  formatCents,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  type PaymentStatus,
} from '$lib/utils/billing';
import { printBill } from '$lib/utils/print_pricing';
import { PRINT_REQUEST_STATUS } from '$lib/utils/print_request';
import { DateTime } from 'luxon';

const DISCORD_SUCCESS_COLOR = 0x57f287;
const ACTIVE_STATUSES = new Set<PaymentStatus>([PAYMENT_STATUS.QUOTE, PAYMENT_STATUS.PENDING]);

export class PrintPaymentError extends PaymentError {}

export class PrintPaymentService extends BaseService {
  async getById(id: string) {
    return await this.paymentRepository.getById(id);
  }

  private async isMember(email: string) {
    const context = await this.memberRepository.getAccessContextByEmail(email);
    return context !== undefined && hasMembership(context, DateTime.now());
  }

  private async organizationFor(billingCode: string | null | undefined) {
    if (!billingCode) return undefined;
    const code = await this.billingCodeRepository.getByCode(billingCode);
    return code?.organization ?? undefined;
  }

  async getPricingInfo(customerEmail: string, billingCode?: string) {
    const [pricing, isMember, organization] = await Promise.all([
      this.settingsRepository.getSetting('printPricing'),
      this.isMember(customerEmail),
      this.organizationFor(billingCode),
    ]);

    return { pricing, isMember, organizationName: organization?.name ?? null };
  }

  async upsertPayment(dto: CreatePaymentDto) {
    const request = await this.printRequestRepository.getById(dto.requestId);
    if (!request) throw new Error('Print request not found');

    return await this.savePayment(request, dto.materialCost, dto.buildPlates);
  }

  private async savePayment(request: PrintRequestDto, materialCost: number, buildPlates: number) {
    const existing = request.payment;
    if (existing?.status === PAYMENT_STATUS.PAID) {
      throw new Error('Payment has already been paid');
    }
    if (existing && !ACTIVE_STATUSES.has(existing.status)) {
      throw new Error('This payment can no longer be changed');
    }

    const [pricing, isMember, organization] = await Promise.all([
      this.settingsRepository.getSetting('printPricing'),
      this.isMember(request.email),
      this.organizationFor(request.billingCode),
    ]);
    const bill = printBill(
      {
        materialType: request.material.materialType,
        materialCost,
        buildPlates,
        isMember,
        billedToOrganization: organization !== undefined,
      },
      pricing,
    );

    const awaitingQuote = !existing || existing.status === PAYMENT_STATUS.QUOTE;
    const status = request.isQuote && awaitingQuote ? PAYMENT_STATUS.QUOTE : PAYMENT_STATUS.PENDING;

    if (existing?.squareInvoiceId && ACTIVE_STATUSES.has(existing.status)) {
      await this.squareRepository.cancelInvoice(existing.squareInvoiceId);
    }

    const payment = await this.paymentRepository.save(
      {
        type: PAYMENT_TYPE.PRINT_REQUEST,
        status,
        customer: { name: request.customerName, email: request.email },
        bill,
        organizationId: organization?.id,
        paymentUrl: organization ? null : printRequestStatusUrl(request.id),
      },
      existing?.id,
    );

    await this.printRequestRepository.update(request.id, {
      paymentId: payment.id,
      materialCost,
      buildplateCount: buildPlates,
    });

    if (payment.status === PAYMENT_STATUS.QUOTE) {
      await this.sendQuoteEmail(request, payment.total);
    } else if (payment.status === PAYMENT_STATUS.PENDING && !organization) {
      await this.sendPaymentEmail(request, payment.total);
    }

    return payment;
  }

  private async sendQuoteEmail(request: PrintRequestDto, total: number) {
    await this.mailgunRepository.sendTemplate(
      request.email,
      printSender(),
      publicEnv.PUBLIC_PRINT_REQUEST_EMAIL,
      `Print Request Quote - ${request.projectName}`,
      'print_quote',
      {
        customerName: request.customerName,
        projectName: request.projectName,
        quotePrice: centsToDollars(total),
        quoteURL: printRequestStatusUrl(request.id),
      },
    );
  }

  private async sendPaymentEmail(request: PrintRequestDto, total: number) {
    await this.mailgunRepository.sendTemplate(
      request.email,
      printSender(),
      publicEnv.PUBLIC_PRINT_REQUEST_EMAIL,
      `Print Request Payment - ${request.projectName}`,
      'print_payment',
      {
        customerName: request.customerName,
        projectName: request.projectName,
        total: centsToDollars(total),
        paymentURL: printRequestStatusUrl(request.id),
      },
    );
  }

  /** Changing the group code moves who pays, so any unpaid bill is rebuilt and resent. */
  async updatePrintRequestDiscount(id: string, dto: UpdatePrintRequestDiscountDto) {
    const request = await this.printRequestRepository.getById(id);
    if (!request) throw new Error('Print request not found');

    const newCode = dto.billingCode?.trim() || '';
    if (newCode !== '' && !(await this.billingCodeRepository.getByCode(newCode))) {
      throw new Error('Group code not found');
    }

    await this.printRequestRepository.update(id, { billingCode: newCode || null });

    if (request.payment && ACTIVE_STATUSES.has(request.payment.status)) {
      const updated = await this.printRequestRepository.getById(id);
      if (updated) {
        await this.savePayment(updated, request.materialCost ?? 0, request.buildplateCount ?? 1);
      }
    }

    return await this.printRequestRepository.getById(id);
  }

  private async requireQuote(id: string) {
    const request = await this.printRequestRepository.getById(id);
    if (!request) throw new Error('Print request not found');
    if (request.payment?.status !== PAYMENT_STATUS.QUOTE || !request.isQuote) {
      throw new PrintPaymentError('This quote has already been answered');
    }
    return { request, payment: request.payment };
  }

  async respondToQuote(dto: RespondToQuoteDto) {
    const { request, payment } = await this.requireQuote(dto.id);

    if (!dto.approve) {
      await this.paymentRepository.cancel(payment);
      await this.printRequestRepository.update(request.id, {
        status: PRINT_REQUEST_STATUS.CANCELED,
        completionDate: DateTime.now(),
      });
      return null;
    }

    const approved = await this.paymentRepository.approveQuote(payment);
    if (!approved) throw new PrintPaymentError('This quote has already been answered');

    runInBackground(
      this.sendQuoteApprovedNotification(request, approved.total),
      'send quote approved notification',
    );

    return approved;
  }

  private async sendQuoteApprovedNotification(request: PrintRequestDto, total: number) {
    const { discordWebhookUrl } = await this.settingsRepository.getSetting('printRequest');
    if (!discordWebhookUrl) {
      console.warn('Discord webhook URL not configured for print requests');
      return;
    }

    await this.discordRepository.sendWebhookNotification(discordWebhookUrl, {
      content: `A quote has been approved! [View in Print Queue](${printQueueUrl(request.id)})`,
      embeds: [
        {
          title: '✅ Quote Approved',
          color: DISCORD_SUCCESS_COLOR,
          fields: [
            { name: 'Project Name', value: request.projectName, inline: true },
            { name: 'Customer', value: request.customerName, inline: true },
            { name: 'Total', value: formatCents(total), inline: false },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  async payPrintRequest(dto: PayPaymentDto) {
    const request = await this.printRequestRepository.getById(dto.id);
    const payment = request?.payment;
    if (!payment || payment.status !== PAYMENT_STATUS.PENDING) {
      throw new PrintPaymentError('This print request has nothing to pay');
    }
    if (payment.organizationId || payment.squareInvoiceId) {
      throw new PrintPaymentError('This print request cannot be paid here');
    }

    return await this.paymentRepository.pay(payment, dto.sourceId);
  }
}

export const printPaymentService = new PrintPaymentService();
