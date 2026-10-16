<script lang="ts">
  import type { CarBayBookingForm } from '$lib/frontend/car-bay-booking-form.svelte';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import { CAR_BAY_TIER_NAMES, formatDollars, formatPeriod } from '$lib/utils/car_bay';

  interface Props {
    form: CarBayBookingForm;
  }

  let { form }: Props = $props();
</script>

<Section title="Review">
  <div class="flex flex-col gap-3">
    <dl>
      <InfoRow label="Booking">{CAR_BAY_TIER_NAMES[form.tier]}</InfoRow>
      {#if form.period}
        <InfoRow label="When">{formatPeriod(form.period)}</InfoRow>
      {/if}
      <InfoRow label="Name">{form.customerName}</InfoRow>
      <InfoRow label="Rate">
        {#if form.membershipPending}
          Checking membership…
        {:else}
          {form.memberRate ? 'Member (active membership found)' : 'Non-member'}
        {/if}
      </InfoRow>
    </dl>

    <ul class="flex flex-col gap-1.5 border-t pt-3 text-sm">
      {#each form.lineItems as item (item.name)}
        <li class="flex justify-between gap-3">
          <span class="text-muted-foreground">
            {item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}
          </span>
          <span class="tabular-nums">{formatDollars(item.quantity * item.unitAmount)}</span>
        </li>
      {/each}
      <li class="mt-1 flex justify-between gap-3 border-t pt-2 font-semibold">
        <span>Total</span>
        <span class="tabular-nums">{formatDollars(form.total)}</span>
      </li>
    </ul>
  </div>
</Section>
