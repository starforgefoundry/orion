<script lang="ts">
  import PublicShell from '$lib/frontend/components/PublicShell.svelte';

  let { children } = $props();
</script>

<PublicShell title="Starforge Services" href="/services">
  {@render children()}
</PublicShell>
