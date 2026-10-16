<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import DoorOpenIcon from '@lucide/svelte/icons/door-open';
  import MailIcon from '@lucide/svelte/icons/mail';
  import {
    ACCESS_BASIS_DISPLAY,
    EMAIL_TRIGGER_LABEL,
    EMAIL_TYPE_LABEL,
    formatDate,
    formatDateTime,
    formatIsoDate,
    waiverDisplay,
  } from '../display';
  import MemberSubscriptions from './MemberSubscriptions.svelte';
  import MemberVisits from './MemberVisits.svelte';
  import { MemberDetailManager } from './member-detail.svelte';

  const MEMBERS_HREF = '/staff/members';

  const manager = new MemberDetailManager(() => page.params.id!);
</script>

<a
  href={MEMBERS_HREF}
  class="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
>
  <ChevronLeftIcon class="size-4" />
  Members
</a>

{#if manager.detail.error}
  <p class="text-sm text-destructive">Error loading member: {manager.detail.error.message}</p>
{:else if !manager.detail.current}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else}
  {@const detail = manager.detail.current}
  {@const basis = ACCESS_BASIS_DISPLAY[detail.basis]}
  {@const waiver = waiverDisplay(detail.waiver !== null)}

  <PageHeader title={detail.member.name} description={detail.member.email}>
    {#snippet actions()}
      <Button
        size="sm"
        variant="outline"
        disabled={manager.resending}
        onclick={() => manager.resendOnboarding()}
      >
        {#if manager.resending}<Spinner />{:else}<MailIcon />{/if}
        Resend Onboarding
      </Button>
      <Button size="sm" disabled={manager.checkingIn} onclick={() => manager.checkIn()}>
        {#if manager.checkingIn}<Spinner />{:else}<DoorOpenIcon />{/if}
        Check In
      </Button>
    {/snippet}
  </PageHeader>

  <div class="flex flex-col gap-3">
    <div class="grid gap-3 md:grid-cols-2">
      <Section title="Contact">
        <dl>
          <InfoRow label="Name">{detail.member.name}</InfoRow>
          <InfoRow label="Email">{detail.member.email}</InfoRow>
          <InfoRow label="Phone">{detail.member.phone ?? '—'}</InfoRow>
          <InfoRow label="Member Since">{formatDate(detail.member.createdDate)}</InfoRow>
        </dl>
      </Section>

      <Section title="Access">
        <dl>
          <InfoRow label="Status">
            <StatusBadge tone={basis.tone}>{basis.label}</StatusBadge>
          </InfoRow>
          <InfoRow label="Waiver">
            <StatusBadge tone={waiver.tone}>{waiver.label}</StatusBadge>
          </InfoRow>
          {#if detail.waiver}
            <InfoRow label="Signed">
              <a
                href="/staff/waivers/view/{detail.waiver.id}"
                target="_blank"
                class="underline underline-offset-2"
              >
                {formatDate(detail.waiver.signedDate)}
              </a>
            </InfoRow>
          {/if}
        </dl>
      </Section>
    </div>

    <MemberSubscriptions subscriptions={detail.subscriptions} {manager} />

    <div class="grid gap-3 md:grid-cols-2">
      <Section title="Organizations">
        {#if detail.organizations.length === 0}
          <p class="text-sm text-muted-foreground">Not in any organization.</p>
        {:else}
          <dl>
            {#each detail.organizations as { membership, organization } (membership.id)}
              <InfoRow label={organization.name}>
                {#if organization.accessEndDate}
                  Through {formatDate(organization.accessEndDate)}
                {:else}
                  No end date
                {/if}
              </InfoRow>
            {/each}
          </dl>
        {/if}
      </Section>

      <Section title="Day Passes" class="overflow-hidden [&>div]:p-0">
        <Table.Root>
          <Table.Header class="bg-muted/50">
            <Table.Row>
              <Table.Head>Purchased</Table.Head>
              <Table.Head>Used</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each detail.dayPasses as pass (pass.id)}
              <Table.Row>
                <Table.Cell>{formatDate(pass.purchasedDate)}</Table.Cell>
                <Table.Cell>
                  {#if pass.usedDate}
                    {formatIsoDate(pass.usedDate)}
                  {:else}
                    <StatusBadge tone="primary">Unused</StatusBadge>
                  {/if}
                </Table.Cell>
              </Table.Row>
            {:else}
              <Table.Row>
                <Table.Cell colspan={2} class="h-16 text-center text-muted-foreground">
                  No day passes.
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </Section>
    </div>

    <MemberVisits {manager} />

    <Section title="Emails Sent" class="overflow-hidden [&>div]:p-0">
      <Table.Root>
        <Table.Header class="bg-muted/50">
          <Table.Row>
            <Table.Head>Sent</Table.Head>
            <Table.Head>Email</Table.Head>
            <Table.Head class="hidden sm:table-cell">Trigger</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each detail.emails as email (email.id)}
            <Table.Row>
              <Table.Cell>{formatDateTime(email.sentDate)}</Table.Cell>
              <Table.Cell>{EMAIL_TYPE_LABEL[email.type]}</Table.Cell>
              <Table.Cell class="hidden sm:table-cell">
                {EMAIL_TRIGGER_LABEL[email.trigger]}
              </Table.Cell>
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell colspan={3} class="h-16 text-center text-muted-foreground">
                No emails sent.
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Section>
  </div>
{/if}
