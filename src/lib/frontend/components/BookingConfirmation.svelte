<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import { Spinner } from '$lib/components/ui/spinner';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import PassCard from '$lib/frontend/member-pass/PassCard.svelte';
  import BanIcon from '@lucide/svelte/icons/ban';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import type { Snippet } from 'svelte';

  type Props = {
    confirmed: boolean;
    heading: string;
    statusLabel: string;
    title: string;
    customerName: string;
    customerEmail: string;
    /** Rows shown above the customer's name and email. */
    details: Snippet;
    /** Rows shown below the customer's name and email. */
    payment: Snippet;
    passTitle: string;
    passToken: string;
    /** Shown after the pass, whatever the status. */
    extras?: Snippet;
    /** Shown above the cancel button. */
    cancelNotice?: Snippet;
    canCancel: boolean;
    canceling: boolean;
    onCancel: () => void;
  };

  let {
    confirmed,
    heading,
    statusLabel,
    title,
    customerName,
    customerEmail,
    details,
    payment,
    passTitle,
    passToken,
    extras,
    cancelNotice,
    canCancel,
    canceling,
    onCancel,
  }: Props = $props();
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center gap-2">
    {#if confirmed}
      <CircleCheckIcon class="size-5 text-success" />
    {:else}
      <BanIcon class="size-5 text-destructive" />
    {/if}
    <h2 class="flex-1 text-lg font-semibold">{heading}</h2>
    <StatusBadge tone={confirmed ? 'success' : 'danger'}>{statusLabel}</StatusBadge>
  </div>

  <Section {title}>
    <dl>
      {@render details()}
      <InfoRow label="Name">{customerName}</InfoRow>
      <InfoRow label="Email">{customerEmail}</InfoRow>
      {@render payment()}
    </dl>
  </Section>

  {#if confirmed}
    <Section title={passTitle}>
      <PassCard token={passToken} />
    </Section>
  {/if}

  {@render extras?.()}

  {#if confirmed && canCancel}
    <Separator />
    {@render cancelNotice?.()}
    <Button
      variant="destructive"
      class="self-start max-sm:w-full"
      onclick={onCancel}
      disabled={canceling}
    >
      {#if canceling}<Spinner />{:else}<BanIcon />{/if}
      Cancel Booking
    </Button>
  {/if}
</div>
