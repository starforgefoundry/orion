<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import { getCarBayPolicy, getCarBayRates } from '$lib/remotes/endpoints/settings.remote';
  import { CAR_BAY_TIER, CAR_BAY_TIER_NAMES } from '$lib/utils/car_bay';
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
  import ContactLine from './ContactLine.svelte';
  import TierPrices from './TierPrices.svelte';
  import { openHoursSummary, priceRows, tierDetails } from './tiers';

  const ratesRemote = getCarBayRates();
  const policyRemote = getCarBayPolicy();
  const rates = $derived(ratesRemote.current);
  const policy = $derived(policyRemote.current);
</script>

<svelte:head>
  <title>Car Bay Booking - Starforge</title>
</svelte:head>

<div class="flex flex-col gap-6">
  {#if ratesRemote.loading || policyRemote.loading}
    <Spinner class="mx-auto mt-12 size-8" />
  {:else if !rates || !policy}
    <p class="rounded-lg border p-6 text-center text-sm text-destructive">
      Booking isn't available right now. Try again later.
    </p>
  {:else}
    {@const details = tierDetails(policy)}
    <div class="flex flex-col gap-1">
      <h2 class="text-xl font-semibold">Book the car bay</h2>
      <p class="text-sm text-muted-foreground">
        One bay with a vehicle lift. {openHoursSummary(policy)} Pick how long you need it, then pick a
        time.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      {#each Object.values(CAR_BAY_TIER) as tier (tier)}
        {@const tierInfo = details[tier]}
        <a
          href="/car_bay/{tier}"
          class="group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition-all outline-none hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div class="flex items-center gap-3">
            <span
              class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
            >
              <tierInfo.icon class="size-5" />
            </span>
            <div class="min-w-0">
              <h3 class="font-semibold">{CAR_BAY_TIER_NAMES[tier]}</h3>
              <p class="text-xs text-muted-foreground">{tierInfo.duration}</p>
            </div>
          </div>

          <TierPrices rows={priceRows(rates, tier)} />

          <p class="flex-1 text-sm text-muted-foreground">{tierInfo.copy}</p>

          <span class="flex items-center gap-1.5 text-sm font-medium text-primary">
            See open times
            <ArrowRightIcon class="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </a>
      {/each}
    </div>

    <ContactLine />
  {/if}
</div>
