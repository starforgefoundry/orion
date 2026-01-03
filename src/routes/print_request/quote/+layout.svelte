<script lang="ts">
  import banner from '$lib/assets/3dp-banner.jpeg';
  import { Card } from '@immich/ui';

  let { children } = $props();
</script>

<div class="relative flex h-screen w-screen items-center justify-center overflow-hidden">
  <div style="background-image: url('{banner}');" class="absolute inset-0 bg-cover bg-center">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
  </div>
  <Card class="relative m-8 w-full max-w-2xl bg-subtle shadow-lg">
    {@render children()}
  </Card>
</div>
