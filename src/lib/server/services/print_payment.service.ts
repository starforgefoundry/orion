import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { CreatePaymentDto } from '$lib/remotes/dtos/print_payment.dto';
import type {
  PrintRequestDto,
  RespondToQuoteDto,
  UpdatePrintRequestDiscountDto,
} from '$lib/remotes/dtos/print_request.dto';
import type { SettingsMap } from '$lib/server/repositories/settings.repository';
import { BaseService } from '$lib/server/services/base.service';
import { printRequestService } from '$lib/server/services/print_request.service';
import { squareService } from '$lib/server/services/square.service';
import { runInBackground } from '$lib/server/utils/background';
import { stringifySquareObject } from '$lib/server/utils/square';
import { DateTime } from 'luxon';
import type {
  CalculateOrderRequest,
  CatalogObjectDiscount,
  CatalogObjectItemVariation,
  Customer,
  OrderLineItem,
  OrderLineItemDiscount,
} from 'square';

type SquareSettings = SettingsMap['printRequestSquare'];

type PrintRequestInfo = {
  customer?: Customer;
  materialCost: number;
  buildPlates: number;
};

export class PrintPaymentService extends BaseService {
  async getById(id: string) {
    return await this.paymentRepository.getById(id);
  }

  /**
   * Get all applicable discount IDs for a customer and billing code
   */
  private async getApplicableDiscounts(
    customerEmail: string,
    billingCode: string,
  ): Promise<string[]> {
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const discounts: string[] = [];

    // Check for member discount
    const activeMember = await squareService.checkActiveMember(customerEmail);
    if (activeMember) {
      discounts.push(squareSettings.memberPrintDiscountId);
    }

    // Check for billing code discount
    if (billingCode !== '') {
      const billingCodeData = await this.billingCodeRepository.getByCode(billingCode);
      if (billingCodeData?.billingCode.discountId) {
        discounts.push(billingCodeData.billingCode.discountId);
      }
    }

    return discounts;
  }

  async getPricingInfo(customerEmail: string, billingCode?: string) {
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const discountIds = await this.getApplicableDiscounts(customerEmail, billingCode ?? '');

    const items = await this.squareRepository.getCatalogByIds([
      squareSettings.additionalBuildPlateItemId,
      ...discountIds,
    ]);

    const buildPlateItem = items.objects?.find(
      (obj) => obj.id === squareSettings.additionalBuildPlateItemId,
    ) as CatalogObjectItemVariation;

    const discountObjects = items.objects?.filter(
      (obj) => obj.type === 'DISCOUNT',
    ) as CatalogObjectDiscount[];

    return {
      additionalBuildPlateModifier: Number(buildPlateItem?.itemVariationData?.priceMoney?.amount),
      discounts: discountObjects.map((discount) => ({
        id: discount.id,
        name: discount.discountData?.name || 'Unnamed Discount',
        percentage: Number(discount.discountData?.percentage),
      })),
    };
  }

  async upsertPayment(dto: CreatePaymentDto) {
    const request = await this.printRequestRepository.getById(dto.requestId);

    if (!request) {
      throw new Error('Print request not found');
    }

    if (request.payment?.status === 'paid') {
      throw new Error('Payment has already been paid');
    }

    const isQuote = request.isQuote && (!request.payment || request.payment?.status === 'quote');

    if (isQuote) {
      return await this.upsertQuote(request, dto);
    }

    return await this.upsertOrder(request, dto);
  }

  async upsertOrder(request: PrintRequestDto, paymentInfo: CreatePaymentDto) {
    // Check if this request has a billing code with organization association
    if (request.billingCode) {
      const billingCodeData = await this.billingCodeRepository.getByCode(request.billingCode);

      if (billingCodeData?.billingCode.organizationId) {
        // This is an organization billing code - mark as paid and associate with organization
        return await this.handleOrganizationBilling(
          request,
          paymentInfo,
          billingCodeData.billingCode.organizationId,
          billingCodeData.billingCode.id,
        );
      }
    }

    if (request.payment && request.payment.squareInvoiceId && request.payment.status !== 'quote') {
      // We have to cancel the existing invoice before creating a new one
      // https://stackoverflow.com/questions/66733189
      await this.squareRepository.cancelInvoice(request.payment.squareInvoiceId);
    }

    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const customer = await this.squareRepository.upsertCustomer(
      request.customerName,
      request.email,
    );

    // Get all applicable discounts
    const discountIds = await this.getApplicableDiscounts(request.email, request.billingCode ?? '');

    const order = this.buildOrder(
      squareSettings,
      {
        customer,
        materialCost: paymentInfo.materialCost,
        buildPlates: paymentInfo.buildPlates,
      },
      discountIds,
    );

    const createdOrder = await this.squareRepository.createOrder(order);
    if (!createdOrder) {
      throw new Error('Failed to create order in Square');
    }

    if (createdOrder.totalMoney?.amount === BigInt(0)) {
      // No payment required, mark as paid
      const paymentRecord = await this.paymentRepository.savePayment(request.id, {
        id: request.payment?.id,
        status: 'paid',
        issuedDate: DateTime.now(),
        paymentDate: DateTime.now(),
        orderObject: stringifySquareObject(createdOrder),
        total: 0,
        squareInvoiceId: null,
        squareOrderId: createdOrder.id!,
        type: 'print_request',
      });

      await this.printRequestRepository.update(request.id, {
        materialCost: paymentInfo.materialCost,
        buildplateCount: paymentInfo.buildPlates,
      });

      return paymentRecord;
    }

    const invoice = await this.paymentRepository.createInvoice(createdOrder);
    if (!invoice) {
      throw new Error('Failed to create invoice in Square');
    }

    // Send the invoice only if this is not a quote or
    // if it was a quote being converted to an order
    let paymentUrl: string | null = null;
    if (!request.isQuote || request.payment?.status === 'quote') {
      const publishedInvoice = await this.squareRepository.sendInvoice(
        invoice.id!,
        invoice.version!,
      );
      paymentUrl = publishedInvoice?.publicUrl ?? null;
    }

    const paymentRecord = await this.paymentRepository.savePayment(request.id, {
      id: request.payment?.id,
      status: 'pending',
      issuedDate: DateTime.fromISO(invoice.createdAt!),
      orderObject: stringifySquareObject(createdOrder),
      total: Number(createdOrder.netAmountDueMoney?.amount),
      squareInvoiceId: invoice.id!,
      squareOrderId: createdOrder.id!,
      paymentUrl,
      type: 'print_request',
    });

    await this.printRequestRepository.update(request.id, {
      materialCost: paymentInfo.materialCost,
      buildplateCount: paymentInfo.buildPlates,
    });

    return paymentRecord;
  }

  private async handleOrganizationBilling(
    request: PrintRequestDto,
    paymentInfo: CreatePaymentDto,
    organizationId: string,
    billingCodeId: string,
  ) {
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const customer = await this.squareRepository.upsertCustomer(
      request.customerName,
      request.email,
    );

    // Get billing code discount (no member discounts for organization billing)
    const billingCodeData = await this.billingCodeRepository.getById(billingCodeId);
    const discountIds = billingCodeData?.billingCode.discountId
      ? [billingCodeData.billingCode.discountId]
      : [];

    const order = this.buildOrder(
      squareSettings,
      {
        customer,
        materialCost: paymentInfo.materialCost,
        buildPlates: paymentInfo.buildPlates,
      },
      discountIds,
    );

    const calculatedOrder = await this.squareRepository.calculateOrder(order);
    if (!calculatedOrder) {
      throw new Error('Failed to calculate order in Square');
    }

    // Create payment record marked as pending and associated with the organization
    // It will be marked as paid when the print request is moved to 'done' status
    const paymentRecord = await this.paymentRepository.savePayment(request.id, {
      id: request.payment?.id,
      status: 'pending',
      issuedDate: DateTime.now(),
      paymentDate: null,
      orderObject: stringifySquareObject(calculatedOrder),
      total: Number(calculatedOrder.netAmountDueMoney?.amount ?? 0),
      squareInvoiceId: null,
      squareOrderId: null,
      organizationId: organizationId,
      type: 'print_request',
    });

    await this.printRequestRepository.update(request.id, {
      materialCost: paymentInfo.materialCost,
      buildplateCount: paymentInfo.buildPlates,
    });

    return paymentRecord;
  }

  private async upsertQuote(request: PrintRequestDto, paymentInfo: CreatePaymentDto) {
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const customer = await this.squareRepository.upsertCustomer(
      request.customerName,
      request.email,
    );

    // Get all applicable discounts
    const discountIds = await this.getApplicableDiscounts(request.email, request.billingCode ?? '');

    const order = this.buildOrder(
      squareSettings,
      {
        customer,
        materialCost: paymentInfo.materialCost,
        buildPlates: paymentInfo.buildPlates,
      },
      discountIds,
    );

    const calculatedOrder = await this.squareRepository.calculateOrder(order);

    if (!calculatedOrder) {
      throw new Error('Failed to calculate order in Square');
    }

    const orderTotal = Number(calculatedOrder.netAmountDueMoney?.amount ?? 0);

    const paymentRecord = await this.paymentRepository.savePayment(request.id, {
      id: request.payment?.id,
      status: 'quote',
      issuedDate: DateTime.now(),
      orderObject: stringifySquareObject(calculatedOrder),
      total: orderTotal,
      squareInvoiceId: null,
      squareOrderId: null,
      type: 'print_request',
    });

    await this.printRequestRepository.update(request.id, {
      materialCost: paymentInfo.materialCost,
      buildplateCount: paymentInfo.buildPlates,
    });

    // Send Quote Email
    await this.mailgunRepository.sendTemplate(
      request.email,
      `Starforge 3D Prints <${publicEnv.PUBLIC_PRINT_REQUEST_EMAIL}>`,
      publicEnv.PUBLIC_PRINT_REQUEST_EMAIL,
      `Print Request Quote - ${request.projectName}`,
      'print_quote',
      {
        projectName: request.projectName,
        quotePrice: (orderTotal / 100).toFixed(2),
        quoteURL: `${env.FRONTEND_URL}/print_request/quote?id=${request.id}`,
      },
    );

    return paymentRecord;
  }

  private buildOrder(
    squareSettings: SquareSettings,
    info: PrintRequestInfo,
    discountIds: string[] = [],
  ): CalculateOrderRequest {
    // Build discounts array from all applicable discount IDs
    const discounts: OrderLineItemDiscount[] = discountIds.map((discountId) => ({
      catalogObjectId: discountId,
      scope: 'ORDER',
    }));

    const lineItems: OrderLineItem[] = [
      {
        quantity: '1',
        catalogObjectId: squareSettings.printRequestItemId,
        basePriceMoney: {
          amount: BigInt(Math.round(info.materialCost)),
          currency: 'USD',
        },
      },
    ];

    if (info.buildPlates > 1) {
      lineItems.push({
        catalogObjectId: squareSettings.additionalBuildPlateItemId,
        quantity: (info.buildPlates - 1).toString(),
      });
    }

    return {
      order: {
        customerId: info.customer?.id,
        locationId: squareSettings.locationId,
        lineItems: lineItems,
        discounts: discounts,
      },
    };
  }

  async updatePrintRequestDiscount(id: string, dto: UpdatePrintRequestDiscountDto) {
    const request = await this.printRequestRepository.getById(id);
    if (!request) {
      throw new Error('Print request not found');
    }

    const newCode = dto.billingCode?.trim() || '';

    // Look up the new billing code if one was provided
    const billingCodeData =
      newCode !== '' ? await this.billingCodeRepository.getByCode(newCode) : null;

    if (newCode !== '' && !billingCodeData) {
      throw new Error('Billing code not found');
    }

    // Update the billing code on the print request
    await this.printRequestRepository.update(id, {
      billingCode: newCode !== '' ? newCode : null,
    });

    // If there's an existing payment that hasn't been finalized, re-run the payment flow
    const existingPayment = request.payment;
    const hasActivePayment =
      existingPayment && existingPayment.status !== 'paid' && existingPayment.status !== 'canceled';

    if (hasActivePayment) {
      // Cancel any outstanding Square invoice before rebuilding payment
      if (existingPayment.squareInvoiceId) {
        await this.squareRepository.cancelInvoice(existingPayment.squareInvoiceId);
      }

      // Re-fetch with updated billing code and re-run the payment flow
      const updatedRequest = await this.printRequestRepository.getById(id);
      if (updatedRequest) {
        await this.upsertOrder(updatedRequest, {
          requestId: id,
          materialCost: request.materialCost ?? 0,
          buildPlates: request.buildplateCount ?? 1,
        });
      }
    }

    return await this.printRequestRepository.getById(id);
  }

  async getPrintRequestQuote(id: string) {
    const request = await this.printRequestRepository.getById(id);
    if (request?.payment?.status !== 'quote') {
      throw new Error('Print request is not in quote status');
    }

    return request;
  }

  async respondToQuote(dto: RespondToQuoteDto) {
    const request = await this.printRequestRepository.getById(dto.id);
    if (!request) {
      throw new Error('Print request not found');
    }

    if (request.payment?.status !== 'quote' || !request.isQuote) {
      throw new Error('Print request is not a quote');
    }

    if (!dto.approve) {
      // User declined the quote, cancel the request
      await printRequestService.updatePrintRequestStatus(dto.id, { status: 'canceled' });
      return null;
    }

    // User accepted the quote, proceed to create an order
    const payment = await printPaymentService.upsertOrder(request, {
      requestId: request.id,
      materialCost: request.materialCost!,
      buildPlates: request.buildplateCount!,
    });

    runInBackground(
      printRequestService.sendQuoteApprovedDiscordNotification(request.id),
      'send quote approved notification',
    );

    return payment;
  }
}

export const printPaymentService = new PrintPaymentService();
