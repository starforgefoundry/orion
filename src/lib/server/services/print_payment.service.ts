import { BaseService } from '$lib/server/services/base.service';
import type { CatalogObjectDiscount, CatalogObjectModifier } from 'square';

class PrintPaymentService extends BaseService {
  async getById(id: string) {
    return await this.printPaymentRepository.getById(id);
  }

  async getPricingInfo(requestId: string) {
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');
    const items = await this.printPaymentRepository.getCatalog([
      squareSettings.additionalBuildPlateModifierId,
      squareSettings.memberPrintDiscountId,
    ]);

    const buildPlateModifier = items.objects?.find(
      (obj) => obj.id === squareSettings.additionalBuildPlateModifierId,
    ) as CatalogObjectModifier;

    const memberDiscount = items.objects?.find(
      (obj) => obj.id === squareSettings.memberPrintDiscountId,
    ) as CatalogObjectDiscount;

    // Determine if customer is member

    return {
      additionalBuildPlateModifier: Number(buildPlateModifier.modifierData?.priceMoney?.amount),
      memberPrintDiscount: memberDiscount.discountData?.percentage,
      memberDiscountApplied: false,
    };
  }

  async testCost() {
    return await this.printPaymentRepository.calculateCost(
      {
        locationId: 'L7Y0R43KJQ2RX',
        memberPrintDiscountId: 'EZJYJOVXCSAPHETNLIFNCJR3',
        printRequestItemId: 'U3LPNVSJHD7JLYD3H2CNOYLH',
        additionalBuildPlateModifierId: 'KBIQWUVKKKT22F2GWN2B5T4R',
      },
      {
        materialAmount: 123.45,
        materialCost: 10.0,
        buildPlates: 3,
        memberPricing: true,
      },
    );
  }
}

export const printPaymentService = new PrintPaymentService();
