<script lang="ts">
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
</script>

{#each modalManager.stack as modal (modal.id)}
  <modal.component {...modal.props} />
{/each}
