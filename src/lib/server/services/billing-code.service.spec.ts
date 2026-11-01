import type { BillingCode, Organization } from '$lib/server/db/schema';
import {
  BillingCodeService,
  BillingCodeTakenError,
} from '$lib/server/services/billing-code.service';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it } from 'vitest';

const ORGANIZATION = factory.organization({ id: 'org-1', name: 'Engineering Club' });

function codeRow(
  overrides: Partial<BillingCode> = {},
  organization: Organization | null = ORGANIZATION,
) {
  return {
    billingCode: factory.billingCode({ id: 'code-1', organizationId: 'org-1', ...overrides }),
    organization,
  };
}

describe(BillingCodeService.name, () => {
  let sut: BillingCodeService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(BillingCodeService));
  });

  it('lists codes with the organization they bill', async () => {
    mocks.billingCodeRepository.getAll.mockResolvedValue([codeRow()]);

    const codes = await sut.getBillingCodes();

    expect(codes).toEqual([
      expect.objectContaining({ code: 'ENGCLUB', organizationName: 'Engineering Club' }),
    ]);
  });

  it('lists only the codes of one organization', async () => {
    mocks.billingCodeRepository.getByOrganization.mockResolvedValue([codeRow()]);

    const codes = await sut.getBillingCodesForOrganization('org-1');

    expect(mocks.billingCodeRepository.getByOrganization).toHaveBeenCalledWith('org-1');
    expect(codes[0].organizationName).toBe('Engineering Club');
  });

  it('reports no organization name for a code whose organization is gone', async () => {
    mocks.billingCodeRepository.getAll.mockResolvedValue([codeRow({ organizationId: null }, null)]);

    const [code] = await sut.getBillingCodes();

    expect(code.organizationName).toBeNull();
  });

  it('creates a code for an organization', async () => {
    const dto = { code: 'NEW', description: 'New club', organizationId: 'org-1' };
    mocks.billingCodeRepository.getByCodeIncludingArchived.mockResolvedValue(undefined as never);
    mocks.billingCodeRepository.create.mockResolvedValue(factory.billingCode(dto));

    const created = await sut.createBillingCode(dto);

    expect(mocks.billingCodeRepository.create).toHaveBeenCalledWith(dto);
    expect(created.organizationId).toBe('org-1');
  });

  it('rejects a code that is already in use, naming its organization', async () => {
    mocks.billingCodeRepository.getByCodeIncludingArchived.mockResolvedValue(codeRow());

    await expect(
      sut.createBillingCode({ code: 'engclub', description: 'Dup', organizationId: 'org-1' }),
    ).rejects.toThrow(
      new BillingCodeTakenError('Group code ENGCLUB is already used by Engineering Club'),
    );
    expect(mocks.billingCodeRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a code that matches an archived one', async () => {
    mocks.billingCodeRepository.getByCodeIncludingArchived.mockResolvedValue(
      codeRow({ archived: true }),
    );

    await expect(
      sut.createBillingCode({ code: 'ENGCLUB', description: 'Dup', organizationId: 'org-1' }),
    ).rejects.toThrow(
      new BillingCodeTakenError("Group code ENGCLUB was archived and can't be reused"),
    );
    expect(mocks.billingCodeRepository.create).not.toHaveBeenCalled();
  });

  it('archives a code through an update', async () => {
    mocks.billingCodeRepository.update.mockResolvedValue(
      factory.billingCode({ id: 'code-1', archived: true }),
    );

    const updated = await sut.updateBillingCode('code-1', { archived: true });

    expect(mocks.billingCodeRepository.update).toHaveBeenCalledWith('code-1', { archived: true });
    expect(updated.archived).toBe(true);
  });
});
