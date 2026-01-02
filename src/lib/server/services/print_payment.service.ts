import type { CreatePaymentDto } from '$lib/remotes/dtos/print_payment.dto';
import { getPayment } from '$lib/remotes/endpoints/print_payment.remote';
import { getPrintRequestById, getPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
import type { SettingsMap } from '$lib/server/repositories/settings.repository';
import { BaseService } from '$lib/server/services/base.service';
import { squareService } from '$lib/server/services/square.service';
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

class PrintPaymentService extends BaseService {
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

    const payment = request.paymentId
      ? await this.printPaymentRepository.getById(request.paymentId)
      : undefined;
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const getPricingInfo = await this.getPricingInfo(request.email);

    const customer = await this.printPaymentRepository.upsertCustomer(
      request.customerName,
      request.email,
    );

    const order = this.buildOrder(squareSettings, {
      customer,
      materialCost: dto.materialCost,
      buildPlates: dto.buildPlates,
      memberPricing: getPricingInfo.memberDiscountApplied,
    });

    if (!payment) {
      const createdOrder = await this.printPaymentRepository.createOrder(order);
      if (!createdOrder) {
        throw new Error('Failed to create order in Square');
      }

      const invoice = await this.printPaymentRepository.createInvoice(createdOrder);
      if (!invoice) {
        throw new Error('Failed to create invoice in Square');
      }

      if (!request.isQuote) {
        await this.printPaymentRepository.sendInvoice(invoice.id!, invoice.version!);
      }

      const paymentRecord = await this.printPaymentRepository.savePayment(request.id, {
        status: 'pending',
        issuedDate: DateTime.fromISO(invoice.createdAt!),
        total: Number(createdOrder.netAmountDueMoney?.amount),
        squareInvoiceId: invoice.id!,
        squareOrderId: createdOrder.id!,
      });

      await this.printRequestRepository.update(request.id, {
        materialCost: dto.materialCost,
        buildplateCount: dto.buildPlates,
      });

      await getPayment(paymentRecord.id).refresh();
      await getPrintRequests().refresh();
      await getPrintRequestById(request.id).refresh();

      return paymentRecord;
    } else {
      // TODO: Update existing payment/order/invoice in Square
    }
  }

  private buildOrder(
    squareSettings: SquareSettings,
    info: PrintRequestInfo,
  ): CalculateOrderRequest {
    const discounts: OrderLineItemDiscount[] = [];
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

    if (info.memberPricing) {
      discounts.push({
        catalogObjectId: squareSettings.memberPrintDiscountId,
        scope: 'ORDER',
      });
    }

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
