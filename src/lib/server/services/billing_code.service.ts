import type {
  CreateBillingCodeDto,
  UpdateBillingCodeDto,
} from '$lib/remotes/dtos/billing_code.dto';
import type { BillingCode, Organization } from '$lib/server/db/schema';
import { ConflictError } from '$lib/errors';
import { BaseService } from '$lib/server/services/base.service';

export class BillingCodeTakenError extends ConflictError {}

type BillingCodeRow = { billingCode: BillingCode; organization: Organization | null };

function withOrganizationName({ billingCode, organization }: BillingCodeRow) {
  return { ...billingCode, organizationName: organization?.name ?? null };
}

function takenMessage({ billingCode, organization }: BillingCodeRow) {
  if (billingCode.archived) {
    return `Group code ${billingCode.code} was archived and can't be reused`;
  }
  const owner = organization?.name ?? 'another organization';
  return `Group code ${billingCode.code} is already used by ${owner}`;
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

  async createBillingCode(data: CreateBillingCodeDto) {
    const existing = await this.billingCodeRepository.getByCodeIncludingArchived(data.code);
    if (existing) {
      throw new BillingCodeTakenError(takenMessage(existing));
    }
    return await this.billingCodeRepository.create(data);
  }

  async updateBillingCode(id: string, updates: Omit<UpdateBillingCodeDto, 'id'>) {
    return await this.billingCodeRepository.update(id, updates);
  }
}

export const billingCodeService = new BillingCodeService();
