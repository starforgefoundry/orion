import type {
  CreateBillingCodeDto,
  UpdateBillingCodeDto,
} from '$lib/remotes/dtos/billing_code.dto';
import type { BillingCode, Organization } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';

export const BILLING_CODE_NOT_FOUND = 'Billing code not found';
export const BILLING_CODE_TAKEN = 'A billing code with that code already exists';

type BillingCodeRow = { billingCode: BillingCode; organization: Organization | null };

function withOrganizationName({ billingCode, organization }: BillingCodeRow) {
  return { ...billingCode, organizationName: organization?.name ?? null };
}

export class BillingCodeService extends BaseService {
  async getBillingCodes() {
    const codes = await this.billingCodeRepository.getAll();
    return codes.map(withOrganizationName);
  }

  async getBillingCodesForOrganization(organizationId: string) {
    const codes = await this.billingCodeRepository.getByOrganization(organizationId);
    return codes.map(withOrganizationName);
  }

  async getBillingCodeById(id: string) {
    const code = await this.billingCodeRepository.getById(id);
    if (!code) {
      throw new Error(BILLING_CODE_NOT_FOUND);
    }
    return withOrganizationName(code);
  }

  async getBillingCodeByCode(code: string) {
    const billingCode = await this.billingCodeRepository.getByCode(code);
    return billingCode ? withOrganizationName(billingCode) : null;
  }

  async createBillingCode(data: CreateBillingCodeDto) {
    if (await this.billingCodeRepository.getByCode(data.code)) {
      throw new Error(BILLING_CODE_TAKEN);
    }
    return await this.billingCodeRepository.create(data);
  }

  async updateBillingCode(id: string, updates: Omit<UpdateBillingCodeDto, 'id'>) {
    return await this.billingCodeRepository.update(id, updates);
  }

  async deleteBillingCode(id: string) {
    await this.billingCodeRepository.delete(id);
  }
}

export const billingCodeService = new BillingCodeService();
