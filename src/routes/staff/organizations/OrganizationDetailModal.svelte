<script lang="ts">
  import { formatCents } from '$lib/utils/billing';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Tabs from '$lib/components/ui/tabs';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import CheckIcon from '@lucide/svelte/icons/check';
  import HandCoinsIcon from '@lucide/svelte/icons/hand-coins';
  import TicketIcon from '@lucide/svelte/icons/ticket';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import UsersIcon from '@lucide/svelte/icons/users';
  import XIcon from '@lucide/svelte/icons/x';
  import { SPACE_ZONE } from '$lib/utils/space';
  import { formatDate } from '$lib/frontend/format';
  import UserMinusIcon from '@lucide/svelte/icons/user-minus';
  import UserPlusIcon from '@lucide/svelte/icons/user-plus';
  import OrganizationBalancePayments from './OrganizationBalancePayments.svelte';
  import OrganizationBillingCodes from './OrganizationBillingCodes.svelte';
  import OrganizationCharges from './OrganizationCharges.svelte';
  import OrganizationMembers from './OrganizationMembers.svelte';
  import { ORGANIZATION_TABS, OrganizationDetail } from './organization-detail.svelte';

  type Props = ModalProps & {
    organizationId: string;
  };

  let { onClose, organizationId }: Props = $props();

  const detail = new OrganizationDetail(
    () => organizationId,
    () => onClose(),
  );
  const members = detail.members;
</script>

<Modal title="Organization Details" icon={UsersIcon} {onClose} size="xl">
  {#if detail.query.loading}
    <div class="flex justify-center py-8">
      <Spinner class="size-6" />
    </div>
  {:else if detail.query.error}
    <p class="text-sm text-destructive">
      Error loading organization details: {detail.query.error.message}
    </p>
  {:else if detail.organization}
    {@const organization = detail.organization}
    <div class="flex flex-col gap-3">
      <div class="grid gap-3 md:grid-cols-2">
        <Section title="Organization">
          {#snippet actions()}
            {#if detail.edits}
              <IconButton
                icon={CheckIcon}
                aria-label="Save Changes"
                onclick={() => detail.save()}
              />
              <IconButton icon={XIcon} aria-label="Cancel" onclick={() => detail.cancelEditing()} />
            {:else}
              <IconButton
                icon={PencilIcon}
                aria-label="Edit Organization"
                onclick={() => detail.startEditing()}
              />
              <IconButton
                icon={TrashIcon}
                aria-label="Archive Organization"
                class="text-destructive hover:text-destructive"
                onclick={() => detail.archive()}
              />
            {/if}
          {/snippet}
          {#if detail.edits}
            <div class="flex flex-col gap-3">
              <FormField label="Name" for="organization-name">
                <Input id="organization-name" bind:value={detail.edits.name} />
              </FormField>
              <FormField label="Email" for="organization-email">
                <Input id="organization-email" bind:value={detail.edits.email} type="email" />
              </FormField>
              <div class="flex items-center justify-between gap-3">
                <Label for="organization-grants-access">Grants member access</Label>
                <Switch id="organization-grants-access" bind:checked={detail.edits.grantsAccess} />
              </div>
              {#if detail.edits.grantsAccess}
                <FormField
                  label="Access Through"
                  for="organization-access-end"
                  description="Leave empty for no end date."
                >
                  <Input
                    id="organization-access-end"
                    bind:value={detail.edits.accessEndDate}
                    type="date"
                  />
                </FormField>
              {/if}
            </div>
          {:else}
            <dl>
              <InfoRow label="Name">{organization.name}</InfoRow>
              <InfoRow label="Email">{organization.email}</InfoRow>
              <InfoRow label="Member Access">
                {#if !organization.grantsAccess}
                  Off
                {:else if organization.accessEndDate}
                  Through {formatDate(organization.accessEndDate.setZone(SPACE_ZONE))}
                {:else}
                  No end date
                {/if}
              </InfoRow>
            </dl>
          {/if}
        </Section>

        <Section title="Outstanding Balance">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-2xl font-semibold tabular-nums">
              {formatCents(organization.outstandingBalance)}
            </span>
            {#if organization.outstandingBalance > 0}
              <Button
                size="sm"
                onclick={() => detail.chargeBalance()}
                disabled={detail.chargingBalance}
              >
                {#if detail.chargingBalance}<Spinner />{/if}
                Charge Balance
              </Button>
            {/if}
          </div>
        </Section>
      </div>

      <Tabs.Root bind:value={detail.activeTab}>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Tabs.List>
            <Tabs.Trigger value={ORGANIZATION_TABS.CHARGES}>Charges</Tabs.Trigger>
            <Tabs.Trigger value={ORGANIZATION_TABS.BALANCE_PAYMENTS}>Balance Payments</Tabs.Trigger>
            <Tabs.Trigger value={ORGANIZATION_TABS.MEMBERS}>Members</Tabs.Trigger>
            <Tabs.Trigger value={ORGANIZATION_TABS.GROUP_CODES}>Group Codes</Tabs.Trigger>
          </Tabs.List>
          {#if detail.activeTab === ORGANIZATION_TABS.CHARGES}
            <Button size="sm" variant="outline" onclick={() => detail.addCharge()}>
              <HandCoinsIcon />
              Add Charge
            </Button>
          {:else if detail.activeTab === ORGANIZATION_TABS.MEMBERS}
            <div class="flex flex-wrap gap-2">
              {#if members.selected.size > 0}
                <Button size="sm" variant="destructive" onclick={() => members.removeSelected()}>
                  <UserMinusIcon />
                  Remove {members.selected.size}
                </Button>
              {/if}
              <Button size="sm" variant="outline" onclick={() => members.add()}>
                <UserPlusIcon />
                Add Members
              </Button>
            </div>
          {:else if detail.activeTab === ORGANIZATION_TABS.GROUP_CODES}
            <Button size="sm" variant="outline" onclick={() => detail.addGroupCode()}>
              <TicketIcon />
              Add Group Code
            </Button>
          {/if}
        </div>

        <Tabs.Content value={ORGANIZATION_TABS.MEMBERS}>
          <OrganizationMembers manager={members} />
        </Tabs.Content>

        <Tabs.Content value={ORGANIZATION_TABS.GROUP_CODES}>
          <OrganizationBillingCodes {organizationId} />
        </Tabs.Content>

        <Tabs.Content value={ORGANIZATION_TABS.CHARGES}>
          <OrganizationCharges {detail} />
        </Tabs.Content>

        <Tabs.Content value={ORGANIZATION_TABS.BALANCE_PAYMENTS}>
          <OrganizationBalancePayments payments={organization.balancePayments} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  {/if}
</Modal>
