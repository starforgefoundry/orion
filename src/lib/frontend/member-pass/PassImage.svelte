<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import { PASS_COLORS, renderQrSvg } from './pass-image';

  let { name, passUrl, label }: { name: string; passUrl: string; label: string } = $props();

  const qrSvg = $derived(renderQrSvg(passUrl));
</script>

<div
  class="w-full max-w-sm overflow-hidden rounded-3xl text-white shadow-lg"
  style:background-color={PASS_COLORS.navy}
>
  <div class="flex items-center gap-3 border-b border-white/10 px-5 py-4">
    <img src={logo} alt="" class="size-10 shrink-0 object-contain" />
    <div class="min-w-0">
      <p class="truncate font-semibold">Starforge Foundry</p>
      <p class="text-xs font-semibold tracking-widest uppercase" style:color={PASS_COLORS.gold}>
        {label}
      </p>
    </div>
  </div>

  <div class="flex flex-col items-center gap-5 px-6 pt-6 pb-7">
    <div
      role="img"
      aria-label={`${label} QR code for ${name}`}
      class="aspect-square w-full max-w-64 rounded-2xl bg-white p-4 [&>svg]:size-full"
    >
      <!-- Generated locally from the pass URL by qrcode-generator. -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html qrSvg}
    </div>
    <p class="text-center text-xl font-semibold">{name}</p>
  </div>
</div>
