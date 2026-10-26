import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BILLING_CODE_NOT_FOUND,
  BILLING_CODE_TAKEN,
  BillingCodeService,
} from './billing_code.service';

const ORGANIZATION = {
  id: 'org-1',
  name: 'Engineering Club',
  email: 'club@example.com',
  archived: false,
};

function codeRow(overrides: Record<string, unknown> = {}, organization: unknown = ORGANIZATION) {
  return {
    billingCode: {
      id: 'code-1',
      code: 'ENGCLUB',
      description: 'Engineering Club',
      organizationId: 'org-1',
      archived: false,
      ...overrides,
    },
    organization,
  };
}

describe('BillingCodeService', () => {
  let service: BillingCodeService;
  let billingCodeRepo: any;

  beforeEach(() => {
    billingCodeRepo = {
      create: vi.fn(async (data) => ({ id: 'code-new', archived: false, ...data })),
      getAll: vi.fn(async () => [codeRow()]),
      getByOrganization: vi.fn(async () => [codeRow()]),
      getById: vi.fn(async () => codeRow()),
      getByCode: vi.fn(async () => undefined),
      update: vi.fn(async (id, updates) => ({ ...codeRow({ id, ...updates }).billingCode })),
      delete: vi.fn(),
    };

    service = new BillingCodeService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      billingCodeRepo,
    );
  });

  it('lists codes with the organization they bill', async () => {
    const codes = await service.getBillingCodes();

    expect(codes).toEqual([
      expect.objectContaining({ code: 'ENGCLUB', organizationName: 'Engineering Club' }),
    ]);
  });

  it('lists only the codes of one organization', async () => {
    const codes = await service.getBillingCodesForOrganization('org-1');

    expect(billingCodeRepo.getByOrganization).toHaveBeenCalledWith('org-1');
    expect(codes[0].organizationName).toBe('Engineering Club');
  });

  it('reports no organization name for a code whose organization is gone', async () => {
    billingCodeRepo.getById.mockResolvedValue(codeRow({ organizationId: null }, null));

    const code = await service.getBillingCodeById('code-1');

    expect(code.organizationName).toBeNull();
  });

  it('throws when a code id does not exist', async () => {
    billingCodeRepo.getById.mockResolvedValue(undefined);

    await expect(service.getBillingCodeById('missing')).rejects.toThrow(BILLING_CODE_NOT_FOUND);
  });

  it('looks a code up by its text', async () => {
    billingCodeRepo.getByCode.mockResolvedValue(codeRow());

    expect(await service.getBillingCodeByCode('engclub')).toEqual(
      expect.objectContaining({ code: 'ENGCLUB', organizationName: 'Engineering Club' }),
    );
  });

  it('returns null for an unknown code', async () => {
    expect(await service.getBillingCodeByCode('NOPE')).toBeNull();
  });

  it('creates a code for an organization', async () => {
    const dto = { code: 'NEW', description: 'New club', organizationId: 'org-1' };

    const created = await service.createBillingCode(dto);

    expect(billingCodeRepo.create).toHaveBeenCalledWith(dto);
    expect(created.organizationId).toBe('org-1');
  });

  it('rejects a code that is already in use', async () => {
    billingCodeRepo.getByCode.mockResolvedValue(codeRow());

    await expect(
      service.createBillingCode({ code: 'ENGCLUB', description: 'Dup', organizationId: 'org-1' }),
    ).rejects.toThrow(BILLING_CODE_TAKEN);
    expect(billingCodeRepo.create).not.toHaveBeenCalled();
  });

  it('archives a code through an update', async () => {
    const updated = await service.updateBillingCode('code-1', { archived: true });

    expect(billingCodeRepo.update).toHaveBeenCalledWith('code-1', { archived: true });
    expect(updated.archived).toBe(true);
  });

  it('deletes a code', async () => {
    await service.deleteBillingCode('code-1');

    expect(billingCodeRepo.delete).toHaveBeenCalledWith('code-1');
  });
});
