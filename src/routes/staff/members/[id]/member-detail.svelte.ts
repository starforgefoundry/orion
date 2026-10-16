import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  checkInMember,
  getMemberDetail,
  getMemberVisits,
  resendMemberOnboarding,
} from '$lib/remotes/endpoints/member.remote';
import { SUBSCRIPTION_STATUS } from '$lib/member_enums';
import type { MemberSubscription } from '$lib/server/db/schema';
import CancelSubscriptionModal from './CancelSubscriptionModal.svelte';

const CANCELABLE_STATUSES: MemberSubscription['status'][] = [
  SUBSCRIPTION_STATUS.PENDING,
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.PAUSED,
];

export class MemberDetailManager {
  visitsPage = $state(1);
  checkingIn = $state(false);
  resending = $state(false);

  private getMemberId: () => string;

  detail = $derived(getMemberDetail(this.memberId));
  visits = $derived(getMemberVisits({ memberId: this.memberId, page: this.visitsPage }));

  constructor(getMemberId: () => string) {
    this.getMemberId = getMemberId;
  }

  get memberId() {
    return this.getMemberId();
  }

  /** Still offered after a period-end cancel so staff can refund the current month. */
  canCancel(subscription: MemberSubscription) {
    return CANCELABLE_STATUSES.includes(subscription.status) && !subscription.accessEndedDate;
  }

  setVisitsPage(page: number) {
    this.visitsPage = page;
  }

  async checkIn() {
    const name = this.detail.current?.member.name ?? 'this member';
    const confirmed = await modalManager.confirm({
      title: 'Manual Check-In',
      prompt: `Admit ${name} now? The visit is recorded as a staff check-in even without access or a waiver.`,
      confirmText: 'Check In',
    });
    if (!confirmed) return;

    this.checkingIn = true;
    try {
      const ok = await submitWithToast(() => checkInMember(this.memberId), {
        success: 'Member checked in',
        error: 'Check-in failed',
      });
      if (ok) {
        this.visitsPage = 1;
        await this.visits.refresh();
      }
    } finally {
      this.checkingIn = false;
    }
  }

  async resendOnboarding() {
    this.resending = true;
    try {
      await submitWithToast(() => resendMemberOnboarding(this.memberId), {
        success: 'Onboarding email sent',
        error: 'Failed to send onboarding email',
      });
    } finally {
      this.resending = false;
    }
  }

  cancelSubscription(subscription: MemberSubscription) {
    modalManager.show(CancelSubscriptionModal, { memberId: this.memberId, subscription });
  }
}
