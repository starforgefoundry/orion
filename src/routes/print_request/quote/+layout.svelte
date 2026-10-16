<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import banner from '$lib/assets/3dp-banner.jpeg';

  let { children } = $props();
</script>

<div class="relative min-h-dvh">
  <div style="background-image: url('{banner}');" class="fixed inset-0 bg-cover bg-center">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
  </div>
  <div class="relative flex min-h-dvh items-center justify-center px-4 py-8">
    <Card.Root class="w-full max-w-2xl shadow-lg">
      {@render children()}
    </Card.Root>
  </div>
</div>
