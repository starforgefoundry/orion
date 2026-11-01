import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  archiveOrganization,
  chargeOrganizationBalance,
  getOrganizationDetail,
  updateOrganization,
} from '$lib/remotes/endpoints/organization.remote';
import { SPACE_ZONE } from '$lib/utils/space';
import { formatCents } from '$lib/utils/billing';
import CreateBillingCodeModal from './CreateBillingCodeModal.svelte';
import CreateChargeModal from './CreateChargeModal.svelte';
import { OrganizationMemberList } from './organization-members.svelte';

export const ORGANIZATION_TABS = {
  CHARGES: 'charges',
  BALANCE_PAYMENTS: 'balance_payments',
  MEMBERS: 'members',
  GROUP_CODES: 'group_codes',
} as const;
export type OrganizationTab = (typeof ORGANIZATION_TABS)[keyof typeof ORGANIZATION_TABS];

export const CHARGES_PER_PAGE = 10;

type OrganizationEdits = {
  name: string;
  email: string;
  accessEndDate: string;
  grantsAccess: boolean;
};

export class OrganizationDetail {
  activeTab = $state<OrganizationTab>(ORGANIZATION_TABS.CHARGES);
  /** Null while the organization is shown rather than edited. */
  edits = $state<OrganizationEdits | null>(null);
  chargingBalance = $state(false);
  chargesPage = $state(1);

  readonly members: OrganizationMemberList;
  readonly query = $derived(getOrganizationDetail({ id: this.organizationId }));

  private getOrganizationId: () => string;
  private onArchived: () => void;

  constructor(getOrganizationId: () => string, onArchived: () => void) {
    this.getOrganizationId = getOrganizationId;
    this.onArchived = onArchived;
    this.members = new OrganizationMemberList(getOrganizationId);
  }

  get organizationId() {
    return this.getOrganizationId();
  }

  get organization() {
    return this.query.current;
  }

  get pagedCharges() {
    const start = (this.chargesPage - 1) * CHARGES_PER_PAGE;
    return this.organization?.charges.slice(start, start + CHARGES_PER_PAGE) ?? [];
  }

  get chargesPageCount() {
    if (!this.organization) return 1;
    return Math.ceil(this.organization.charges.length / CHARGES_PER_PAGE);
  }

  startEditing() {
    if (!this.organization) return;

    this.edits = {
      name: this.organization.name,
      email: this.organization.email,
      accessEndDate: this.organization.accessEndDate?.setZone(SPACE_ZONE).toISODate() ?? '',
      grantsAccess: this.organization.grantsAccess,
    };
  }

  cancelEditing() {
    this.edits = null;
  }

  async save() {
    if (!this.edits) return;

    const { name, email, grantsAccess, accessEndDate } = this.edits;
    const saved = await submitWithToast(
      () =>
        updateOrganization({
          id: this.organizationId,
          name,
          email,
          grantsAccess,
          accessEndDate: accessEndDate || null,
        }),
      { success: 'Organization updated', error: 'Failed to update organization' },
    );
    if (!saved) return;

    await this.query.refresh();
    this.edits = null;
  }

  async chargeBalance() {
    const confirmed = await modalManager.confirm({
      title: 'Charge Outstanding Balance',
      prompt: `Are you sure you want to email a payment link for the outstanding balance of ${formatCents(
        this.organization?.outstandingBalance || 0,
      )} to the organization's email?`,
      confirmText: 'Charge Balance',
    });
    if (!confirmed) return;

    this.chargingBalance = true;
    const charged = await submitWithToast(
      () => chargeOrganizationBalance({ organizationId: this.organizationId }),
      { success: 'Payment link sent', error: 'Failed to charge balance' },
    );
    if (charged) await this.query.refresh();
    this.chargingBalance = false;
  }

  async archive() {
    const confirmed = await modalManager.confirm({
      title: 'Archive Organization',
      prompt:
        'Are you sure you want to archive this organization? This will hide it from the list but preserve all data.',
      confirmText: 'Archive',
      variant: 'destructive',
    });
    if (!confirmed) return;

    const archived = await submitWithToast(() => archiveOrganization({ id: this.organizationId }), {
      success: 'Organization archived',
      error: 'Failed to archive organization',
    });
    if (archived) this.onArchived();
  }

  addCharge() {
    modalManager.show(CreateChargeModal, { orgId: this.organizationId });
  }

  addGroupCode() {
    modalManager.show(CreateBillingCodeModal, { organizationId: this.organizationId });
  }
}

export type BalancePayment = NonNullable<
  OrganizationDetail['organization']
>['balancePayments'][number];
