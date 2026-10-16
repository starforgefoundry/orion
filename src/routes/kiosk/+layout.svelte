<script lang="ts">
  let { children } = $props();
</script>

<svelte:head>
  <title>Starforge Check-in</title>
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
</svelte:head>

<div class="fixed inset-0 overflow-hidden bg-background text-foreground select-none">
  {@render children()}
</div>
