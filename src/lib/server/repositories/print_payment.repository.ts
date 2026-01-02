import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import type { SettingsMap } from '$lib/server/repositories/settings.repository';
import { eq } from 'drizzle-orm';
import type { CalculateOrderRequest, OrderLineItemDiscount, OrderLineItemModifier } from 'square';

type SquareSettings = SettingsMap['printRequestSquare'];

type PrintRequestInfo = {
  materialAmount: number;
  materialCost: number;
  buildPlates: number;
  memberPricing: boolean;
};

export class PrintPaymentRepository extends BaseRepository {
  async getById(paymentId: string) {
    return await this.db
      .select()
      .from(schema.printRequestPayment)
      .where(eq(schema.printRequestPayment.id, paymentId))
      .get();
  }

  async getCatalog(ids: string[]) {
    return await this.square.catalog.batchGet({
      objectIds: ids,
    });
  }

  private buildOrder(
    squareSettings: SquareSettings,
    info: PrintRequestInfo,
  ): CalculateOrderRequest {
    const discounts: OrderLineItemDiscount[] = [];
    const modifiers: OrderLineItemModifier[] = [];
    const totalMaterialCost = Math.round(info.materialAmount * info.materialCost);
    if (info.memberPricing) {
      discounts.push({
        catalogObjectId: squareSettings.memberPrintDiscountId,
        scope: 'ORDER',
      });
    }

    if (info.buildPlates > 1) {
      modifiers.push({
        catalogObjectId: squareSettings.additionalBuildPlateModifierId,
        quantity: (info.buildPlates - 1).toString(),
      });
    }

    return {
      order: {
        locationId: squareSettings.locationId,
        lineItems: [
          {
            quantity: '1',
            catalogObjectId: squareSettings.printRequestItemId,
            basePriceMoney: {
              amount: BigInt(totalMaterialCost),
              currency: 'USD',
            },
            modifiers: modifiers,
          },
        ],
        discounts: discounts,
      },
    };
  }

  async createOrder(squareSettings: SquareSettings, info: PrintRequestInfo) {
    const order = this.buildOrder(squareSettings, info);
    const created = await this.square.orders.create(order);

    return created.order?.netAmountDueMoney?.amount ?? BigInt(0);
  }

  async calculateCost(squareSettings: SquareSettings, info: PrintRequestInfo) {
    const order = await this.square.orders.calculate(this.buildOrder(squareSettings, info));

    return order.order?.netAmountDueMoney?.amount ?? BigInt(0);
  }
}
