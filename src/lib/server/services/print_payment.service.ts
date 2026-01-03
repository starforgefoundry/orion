import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { CreatePaymentDto } from '$lib/remotes/dtos/print_payment.dto';
import type { PrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
import { getPayment } from '$lib/remotes/endpoints/print_payment.remote';
import { getPrintRequestById, getPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
import type { SettingsMap } from '$lib/server/repositories/settings.repository';
import { BaseService } from '$lib/server/services/base.service';
import { squareService } from '$lib/server/services/square.service';
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
  memberPricing: boolean;
};

export class PrintPaymentService extends BaseService {
  async getById(id: string) {
    return await this.printPaymentRepository.getById(id);
  }

  async getPricingInfo(customerEmail: string) {
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');

    const [items, activeMember] = await Promise.all([
      this.squareRepository.getCatalogByIds([
        squareSettings.additionalBuildPlateItemId,
        squareSettings.memberPrintDiscountId,
      ]),
      squareService.checkActiveMember(customerEmail),
    ]);

    const buildPlateItem = items.objects?.find(
      (obj) => obj.id === squareSettings.additionalBuildPlateItemId,
    ) as CatalogObjectItemVariation;

    const memberDiscount = items.objects?.find(
      (obj) => obj.id === squareSettings.memberPrintDiscountId,
    ) as CatalogObjectDiscount;

    return {
      additionalBuildPlateModifier: Number(buildPlateItem?.itemVariationData?.priceMoney?.amount),
      memberPrintDiscount: Number(memberDiscount.discountData?.percentage),
      memberDiscountApplied: activeMember,
    };
  }

  async upsertPayment(dto: CreatePaymentDto) {
    const request = await this.printRequestRepository.getById(dto.requestId);

    if (!request) {
      throw new Error('Print request not found');
    }

    const isQuote = request.isQuote && (!request.payment || request.payment?.status === 'quote');

    if (isQuote) {
      return await this.upsertQuote(request, dto);
    }

    return await this.upsertOrder(request, dto);
  }

  private async upsertOrder(request: PrintRequestDto, paymentInfo: CreatePaymentDto) {
    if (request.payment && request.payment.squareInvoiceId) {
      // We have to cancel the existing invoice before creating a new one
      // https://stackoverflow.com/questions/66733189
      await this.squareRepository.cancelInvoice(request.payment.squareInvoiceId);
    }

    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const activeMember = await squareService.checkActiveMember(request.email);
    const customer = await this.squareRepository.upsertCustomer(
      request.customerName,
      request.email,
    );

    const order = this.buildOrder(squareSettings, {
      customer,
      materialCost: paymentInfo.materialCost,
      buildPlates: paymentInfo.buildPlates,
      memberPricing: activeMember,
    });

    const createdOrder = await this.squareRepository.createOrder(order);
    if (!createdOrder) {
      throw new Error('Failed to create order in Square');
    }

    const invoice = await this.printPaymentRepository.createInvoice(createdOrder);
    if (!invoice) {
      throw new Error('Failed to create invoice in Square');
    }

    if (!request.isQuote) {
      await this.squareRepository.sendInvoice(invoice.id!, invoice.version!);
    }

    const paymentRecord = await this.printPaymentRepository.savePayment(request.id, {
      id: request.payment?.id,
      status: 'pending',
      issuedDate: DateTime.fromISO(invoice.createdAt!),
      orderObject: stringifySquareObject(createdOrder),
      total: Number(createdOrder.netAmountDueMoney?.amount),
      squareInvoiceId: invoice.id!,
      squareOrderId: createdOrder.id!,
    });

    await this.printRequestRepository.update(request.id, {
      materialCost: paymentInfo.materialCost,
      buildplateCount: paymentInfo.buildPlates,
    });

    await getPayment(paymentRecord.id).refresh();
    await getPrintRequests().refresh();
    await getPrintRequestById(request.id).refresh();

    return paymentRecord;
  }

  private async upsertQuote(request: PrintRequestDto, paymentInfo: CreatePaymentDto) {
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const activeMember = await squareService.checkActiveMember(request.email);
    const customer = await this.squareRepository.upsertCustomer(
      request.customerName,
      request.email,
    );

    const order = this.buildOrder(squareSettings, {
      customer,
      materialCost: paymentInfo.materialCost,
      buildPlates: paymentInfo.buildPlates,
      memberPricing: activeMember,
    });

    const calculatedOrder = await this.squareRepository.calculateOrder(order);

    if (!calculatedOrder) {
      throw new Error('Failed to calculate order in Square');
    }

    const orderTotal = Number(calculatedOrder.netAmountDueMoney?.amount ?? 0);

    const paymentRecord = await this.printPaymentRepository.savePayment(request.id, {
      id: request.payment?.id,
      status: 'quote',
      issuedDate: DateTime.now(),
      orderObject: stringifySquareObject(calculatedOrder),
      total: orderTotal,
      squareInvoiceId: null,
      squareOrderId: null,
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
        quoteURL: `${env.FRONTEND_URL}/print_request/quote/${request.id}`,
      },
    );

    await getPayment(paymentRecord.id).refresh();
    await getPrintRequests().refresh();
    await getPrintRequestById(request.id).refresh();

    return paymentRecord;
  }

  private buildOrder(
    squareSettings: SquareSettings,
    info: PrintRequestInfo,
  ): CalculateOrderRequest {
    const discounts: OrderLineItemDiscount[] = [];
    if (info.memberPricing) {
      discounts.push({
        catalogObjectId: squareSettings.memberPrintDiscountId,
        scope: 'ORDER',
      });
    }

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
}

export const printPaymentService = new PrintPaymentService();
