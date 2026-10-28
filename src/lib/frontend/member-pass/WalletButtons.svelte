<script lang="ts">
  import { browser } from '$app/environment';
  import type { WalletProvider } from '$lib/remotes/dtos/pass.dto';
  import { WALLET_LINKS, walletsForDevice } from './wallets';

  let { token, wallets }: { token: string; wallets: WalletProvider[] } = $props();

  const ordered = $derived(walletsForDevice(wallets, browser ? navigator.userAgent : ''));
</script>

<div class="flex flex-col items-center gap-3">
  {#each ordered as wallet (wallet)}
    {@const link = WALLET_LINKS[wallet]}
    <a href={link.href(token)} data-sveltekit-reload class="rounded-xl focus-visible:ring-3">
      <img src={link.badge} alt={link.label} class="h-14 w-auto" />
    </a>
  {/each}
</div>
