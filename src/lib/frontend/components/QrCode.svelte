<script lang="ts">
  import { renderQrSvg } from '$lib/frontend/qr-code';

  let { data, size }: { data: string; size: number } = $props();

  const qrSvg = $derived(renderQrSvg(data));
</script>

<div
  role="img"
  aria-label="QR code"
  class="[&>svg]:size-full"
  style:width="{size}px"
  style:height="{size}px"
>
  <!-- Generated locally by qrcode-generator. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html qrSvg}
</div>
