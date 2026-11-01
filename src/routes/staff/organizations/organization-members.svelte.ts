import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  addOrganizationMembers,
  getOrganizationMembers,
  removeOrganizationMembers,
} from '$lib/remotes/endpoints/organization.remote';
import type { Member, OrganizationMember } from '$lib/server/db/schema';
import { TableSelection } from '$lib/frontend/table-selection.svelte';
import AddOrganizationMembersModal from './AddOrganizationMembersModal.svelte';

type AddResult = Awaited<ReturnType<typeof addOrganizationMembers>>;

export class OrganizationMemberList {
  private getOrganizationId: () => string;

  members = $derived(getOrganizationMembers(this.organizationId));
  selected = new TableSelection(
    () => this.memberships,
    (row) => row.membership.id,
  );

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

  async remove(membership: OrganizationMember, member: Member) {
    await this.confirmAndRemove(
      [membership.id],
      `Remove ${member.name} from this organization? They lose access granted by it.`,
    );
  }

  async removeSelected() {
    await this.confirmAndRemove(
      this.selected.selectedIds,
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
    if (removed) this.selected.deselect(membershipIds);
  }
}

export class AddOrganizationMembersForm {
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
    return Boolean(this.result?.errors.length);
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
