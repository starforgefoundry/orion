import type {
  CreateBillingCodeDto,
  UpdateBillingCodeDto,
} from '$lib/remotes/dtos/billing_code.dto';
import { BaseService } from '$lib/server/services/base.service';

export class BillingCodeService extends BaseService {
  async getBillingCodes() {
    const codes = await this.billingCodeRepository.getAll();

    // Get all unique discount IDs
    const discountIds = codes
      .map((row) => row.billingCode.discountId)
      .filter((id): id is string => !!id);

    // Fetch discount names from Square if there are any
    let discountMap = new Map<string, string>();
    if (discountIds.length > 0) {
      const catalog = await this.squareRepository.getCatalogByIds(discountIds);
      catalog.objects?.forEach((obj) => {
        if (obj.type === 'DISCOUNT' && obj.id) {
          discountMap.set(obj.id, obj.discountData?.name || 'Unnamed Discount');
        }
      });
    }

    return codes.map((row) => ({
      ...row.billingCode,
      organizationName: row.organization?.name ?? null,
      discountName: row.billingCode.discountId
        ? (discountMap.get(row.billingCode.discountId) ?? null)
        : null,
    }));
  }

  async getBillingCodeById(id: string) {
    const code = await this.billingCodeRepository.getById(id);
    if (!code) {
      throw new Error('Billing code not found');
    }

    let discountName: string | null = null;
    if (code.billingCode.discountId) {
      const catalog = await this.squareRepository.getCatalogByIds([code.billingCode.discountId]);
      const discount = catalog.objects?.find((obj) => obj.id === code.billingCode.discountId);
      discountName = (discount as any)?.discountData?.name || 'Unnamed Discount';
    }

    return {
      ...code.billingCode,
      organizationName: code.organization?.name ?? null,
      discountName,
    };
  }

  async getBillingCodeByCode(code: string) {
    const billingCode = await this.billingCodeRepository.getByCode(code);
    if (!billingCode) {
      return null;
    }

    let discountName: string | null = null;
    if (billingCode.billingCode.discountId) {
      const catalog = await this.squareRepository.getCatalogByIds([
        billingCode.billingCode.discountId,
      ]);
      const discount = catalog.objects?.find(
        (obj) => obj.id === billingCode.billingCode.discountId,
      );
      discountName = (discount as any)?.discountData?.name || 'Unnamed Discount';
    }

    return {
      ...billingCode.billingCode,
      organizationName: billingCode.organization?.name ?? null,
      discountName,
    };
  }

  async createBillingCode(data: CreateBillingCodeDto) {
    if ((data.discountId ?? '') === '' && (data.organizationId ?? '') === '') {
      throw new Error('Either discountId or organizationId must be provided');
    }

    const billingCode = await this.billingCodeRepository.create(data);
    return billingCode;
  }

  async updateBillingCode(id: string, updates: Omit<UpdateBillingCodeDto, 'id'>) {
    return await this.billingCodeRepository.update(id, updates);
  }

  async deleteBillingCode(id: string) {
    await this.billingCodeRepository.delete(id);
  }
}

export const billingCodeService = new BillingCodeService();
