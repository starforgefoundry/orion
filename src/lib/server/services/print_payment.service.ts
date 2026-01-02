import { BaseService } from '$lib/server/services/base.service';

class PrintPaymentService extends BaseService {
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
