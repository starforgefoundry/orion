import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  archiveOrganization,
  chargeOrganizationBalance,
  getOrganizationDetail,
  updateOrganization,
} from '$lib/remotes/endpoints/organization.remote';
import { SPACE_ZONE } from '$lib/space';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHARGES_PER_PAGE, OrganizationDetail } from './organization-detail.svelte';

vi.mock('$lib/remotes/endpoints/organization.remote', () => ({
  archiveOrganization: vi.fn(),
  chargeOrganizationBalance: vi.fn(),
  getOrganizationDetail: vi.fn(),
  getOrganizationMembers: vi.fn(),
  updateOrganization: vi.fn(),
}));

vi.mock('$lib/frontend/modal-manager.svelte', () => ({
  modalManager: { confirm: vi.fn(), show: vi.fn() },
}));

vi.mock('$lib/frontend/form-submit', () => ({
  submitWithToast: async (action: () => Promise<unknown>) => {
    await action();
    return true;
  },
}));

const ORGANIZATION_ID = 'org-1';
const ACCESS_END = '2026-12-31';

function charge(index: number) {
  return {
    id: `charge-${index}`,
    description: `Charge ${index}`,
    date: '2026-10-01T00:00:00.000Z',
    amount: 100,
    status: 'charged',
    type: 'charge',
  };
}

function organization(chargeCount = 0) {
  return {
    id: ORGANIZATION_ID,
    name: 'Robotics Club',
    email: 'club@example.com',
    grantsAccess: true,
    accessEndDate: DateTime.fromISO(ACCESS_END, { zone: SPACE_ZONE }),
    outstandingBalance: 2500,
    charges: Array.from({ length: chargeCount }, (_, index) => charge(index)),
    balancePayments: [],
  };
}

const refresh = vi.fn();

function detailWith(data = organization()) {
  vi.mocked(getOrganizationDetail).mockReturnValue({
    current: data,
    refresh,
  } as unknown as ReturnType<typeof getOrganizationDetail>);
  const onArchived = vi.fn();
  return { detail: new OrganizationDetail(() => ORGANIZATION_ID, onArchived), onArchived };
}

describe(OrganizationDetail.name, () => {
  beforeEach(() => {
    refresh.mockResolvedValue(undefined);
  });

  it('pages charges', () => {
    const { detail } = detailWith(organization(CHARGES_PER_PAGE + 3));

    expect(detail.chargesPageCount).toBe(2);
    expect(detail.pagedCharges).toHaveLength(CHARGES_PER_PAGE);

    detail.chargesPage = 2;

    expect(detail.pagedCharges.map((c) => c.id)).toEqual([
      `charge-${CHARGES_PER_PAGE}`,
      `charge-${CHARGES_PER_PAGE + 1}`,
      `charge-${CHARGES_PER_PAGE + 2}`,
    ]);
  });

  it('starts editing with the current organization values', () => {
    const { detail } = detailWith();

    detail.startEditing();

    expect(detail.edits).toEqual({
      name: 'Robotics Club',
      email: 'club@example.com',
      accessEndDate: ACCESS_END,
      grantsAccess: true,
    });
  });

  it('drops edits on cancel', () => {
    const { detail } = detailWith();
    detail.startEditing();

    detail.cancelEditing();

    expect(detail.edits).toBeNull();
  });

  it('saves edits and sends no end date when the date is cleared', async () => {
    const { detail } = detailWith();
    detail.startEditing();
    detail.edits!.name = 'Robotics Team';
    detail.edits!.accessEndDate = '';

    await detail.save();

    expect(updateOrganization).toHaveBeenCalledWith({
      id: ORGANIZATION_ID,
      name: 'Robotics Team',
      email: 'club@example.com',
      grantsAccess: true,
      accessEndDate: null,
    });
    expect(refresh).toHaveBeenCalled();
    expect(detail.edits).toBeNull();
  });

  it('charges the balance once confirmed', async () => {
    vi.mocked(modalManager.confirm).mockResolvedValue(true);
    const { detail } = detailWith();

    await detail.chargeBalance();

    expect(chargeOrganizationBalance).toHaveBeenCalledWith({ organizationId: ORGANIZATION_ID });
    expect(refresh).toHaveBeenCalled();
    expect(detail.chargingBalance).toBe(false);
  });

  it('does not charge the balance when the staff member backs out', async () => {
    vi.mocked(modalManager.confirm).mockResolvedValue(false);
    const { detail } = detailWith();

    await detail.chargeBalance();

    expect(chargeOrganizationBalance).not.toHaveBeenCalled();
  });

  it('closes after archiving', async () => {
    vi.mocked(modalManager.confirm).mockResolvedValue(true);
    const { detail, onArchived } = detailWith();

    await detail.archive();

    expect(archiveOrganization).toHaveBeenCalledWith({ id: ORGANIZATION_ID });
    expect(onArchived).toHaveBeenCalled();
  });
});
