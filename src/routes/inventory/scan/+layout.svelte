<script lang="ts">
  import banner from '$lib/assets/3dp-banner.jpeg';
  import { Card } from '@immich/ui';

  let { children } = $props();
</script>

<div class="relative min-h-screen w-screen overflow-y-auto">
  <div style="background-image: url('{banner}');" class="absolute inset-0 bg-cover bg-center">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
  </div>
  <div class="relative flex min-h-screen w-screen items-center justify-center">
    <Card class="relative m-8 w-full max-w-2xl bg-subtle shadow-lg">
      {@render children()}
    </Card>
  </div>
</div>
