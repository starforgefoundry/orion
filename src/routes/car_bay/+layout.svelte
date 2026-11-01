<script lang="ts">
  import PublicShell from '$lib/frontend/components/PublicShell.svelte';

  let { children } = $props();
</script>

<PublicShell title="Starforge Car Bay" href="/car_bay">
  {@render children()}
</PublicShell>
