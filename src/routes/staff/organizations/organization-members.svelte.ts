import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  addOrganizationMembers,
  getOrganizationMembers,
  removeOrganizationMembers,
} from '$lib/remotes/endpoints/organization.remote';
import type { Member, OrganizationMember } from '$lib/server/db/schema';
import { SvelteSet } from 'svelte/reactivity';
import AddOrganizationMembersModal from './AddOrganizationMembersModal.svelte';

type AddResult = Awaited<ReturnType<typeof addOrganizationMembers>>;

export class OrganizationMembersManager {
  private getOrganizationId: () => string;

  members = $derived(getOrganizationMembers(this.organizationId));
  selected = new SvelteSet<string>();

  constructor(getOrganizationId: () => string) {
    this.getOrganizationId = getOrganizationId;
  }

  get organizationId() {
    return this.getOrganizationId();
  }

  add() {
    modalManager.show(AddOrganizationMembersModal, { organizationId: this.organizationId });
  }

  get memberships() {
    return this.members.current ?? [];
  }

  get allSelected() {
    return this.memberships.length > 0 && this.selected.size === this.memberships.length;
  }

  get someSelected() {
    return this.selected.size > 0 && !this.allSelected;
  }

  isSelected(membership: OrganizationMember) {
    return this.selected.has(membership.id);
  }

  toggle(membership: OrganizationMember, checked: boolean) {
    if (checked) this.selected.add(membership.id);
    else this.selected.delete(membership.id);
  }

  toggleAll(checked: boolean) {
    this.selected.clear();
    if (checked) this.memberships.forEach(({ membership }) => this.selected.add(membership.id));
  }

  async remove(membership: OrganizationMember, member: Member) {
    await this.confirmAndRemove(
      [membership.id],
      `Remove ${member.name} from this organization? They lose access granted by it.`,
    );
  }

  async removeSelected() {
    await this.confirmAndRemove(
      [...this.selected],
      `Remove ${this.selected.size} members from this organization? They lose access granted by it.`,
    );
  }

  private async confirmAndRemove(membershipIds: string[], prompt: string) {
    const confirmed = await modalManager.confirm({
      title: membershipIds.length === 1 ? 'Remove Member' : 'Remove Members',
      prompt,
      confirmText: 'Remove',
      variant: 'destructive',
    });
    if (!confirmed) return;

    const removed = await submitWithToast(
      () => removeOrganizationMembers({ organizationId: this.organizationId, membershipIds }),
      { success: 'Members removed', error: 'Failed to remove members' },
    );
    if (removed) membershipIds.forEach((id) => this.selected.delete(id));
  }
}

export class AddOrganizationMembersManager {
  lines = $state('');
  submitting = $state(false);
  result = $state<AddResult>();

  private getOrganizationId: () => string;

  constructor(getOrganizationId: () => string) {
    this.getOrganizationId = getOrganizationId;
  }

  private get organizationId() {
    return this.getOrganizationId();
  }

  get canSubmit() {
    return this.lines.trim() !== '';
  }

  get hasProblems() {
    return Boolean(
      this.result && (this.result.errors.length || this.result.onboardingFailed.length),
    );
  }

  /** Resolves true when every line was added cleanly. */
  async submit() {
    this.submitting = true;
    try {
      const ok = await submitWithToast(
        async () => {
          this.result = await addOrganizationMembers({
            organizationId: this.organizationId,
            lines: this.lines,
          });
        },
        { success: 'Members processed', error: 'Failed to add members' },
      );
      if (!ok || !this.result) return false;

      this.lines = this.result.errors.map((error) => error.text).join('\n');
      return !this.hasProblems;
    } finally {
      this.submitting = false;
    }
  }
}
