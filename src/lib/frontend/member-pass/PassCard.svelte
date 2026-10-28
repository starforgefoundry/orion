<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import { getPass } from '$lib/remotes/endpoints/pass.remote';
  import PassImage from './PassImage.svelte';
  import SavePassImageButton from './SavePassImageButton.svelte';
  import WalletButtons from './WalletButtons.svelte';

  const KIOSK_INSTRUCTIONS =
    "Scan it at the front desk kiosk when you arrive. If you haven't signed our waiver yet, the kiosk will walk you through it.";

  let { token, instructions = KIOSK_INSTRUCTIONS }: { token: string; instructions?: string } =
    $props();

  const passRemote = $derived(getPass(token));
  const pass = $derived(passRemote.current);
</script>

{#if passRemote.error}
  <div class="w-full rounded-2xl border bg-card p-6 text-center">
    <p class="font-semibold">Pass not found</p>
    <p class="mt-1 text-sm text-muted-foreground">This link may be invalid or out of date.</p>
  </div>
{:else if !pass}
  <Spinner class="mx-auto my-12 size-8" />
{:else}
  <div class="flex w-full flex-col items-center gap-8">
    <PassImage name={pass.holderName} passUrl={pass.passUrl} label={pass.title} />

    {#if pass.fields.length > 0}
      <dl class="grid w-full max-w-sm grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {#each pass.fields as field (field.label)}
          <dt class="text-muted-foreground">{field.label}</dt>
          <dd class="text-right font-medium">{field.value}</dd>
        {/each}
      </dl>
    {/if}

    <section class="flex w-full flex-col items-center gap-4">
      <div class="text-center">
        <h2 class="font-semibold">Keep it on your phone</h2>
        <p class="mt-1 text-sm text-muted-foreground">{instructions}</p>
      </div>
      <WalletButtons {token} wallets={pass.wallets} />
      <SavePassImageButton name={pass.holderName} passUrl={pass.passUrl} label={pass.title} />
    </section>
  </div>
{/if}
