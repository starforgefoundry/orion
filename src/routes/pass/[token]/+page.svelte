<script lang="ts">
  import { page } from '$app/state';
  import { Spinner } from '$lib/components/ui/spinner';
  import MemberPassImage from '$lib/frontend/member-pass/MemberPassImage.svelte';
  import SavePassImageButton from '$lib/frontend/member-pass/SavePassImageButton.svelte';
  import WalletButtons from '$lib/frontend/member-pass/WalletButtons.svelte';
  import { getMemberPass } from '$lib/remotes/endpoints/onboarding.remote';

  const CONTACT_EMAIL = 'contact@starforgefoundry.com';

  const token = page.params.token ?? '';
  const passRemote = getMemberPass(token);
  const pass = $derived(passRemote.current);
</script>

<svelte:head>
  <title>Member Pass - Starforge</title>
</svelte:head>

<div class="min-h-dvh bg-muted/40">
  <main class="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-10">
    {#if passRemote.error}
      <div class="w-full rounded-2xl border bg-card p-6 text-center">
        <p class="font-semibold">Pass not found</p>
        <p class="mt-1 text-sm text-muted-foreground">This link may be invalid or out of date.</p>
      </div>
    {:else if !pass}
      <Spinner class="mt-24 size-8" />
    {:else}
      <MemberPassImage name={pass.name} passUrl={pass.passUrl} />

      <section class="flex w-full flex-col items-center gap-4">
        <div class="text-center">
          <h2 class="font-semibold">Keep it on your phone</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Add your pass to your wallet so it's ready when you arrive.
          </p>
        </div>
        <WalletButtons {token} wallets={pass.wallets} />
        <SavePassImageButton name={pass.name} passUrl={pass.passUrl} />
      </section>
    {/if}

    <p class="text-center text-sm text-muted-foreground">
      Questions? <a href={`mailto:${CONTACT_EMAIL}`} class="underline">{CONTACT_EMAIL}</a>
    </p>
  </main>
</div>
