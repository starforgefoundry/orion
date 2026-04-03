<script lang="ts">
  import logo from '$lib/assets/logo.png';

  let { children } = $props();
</script>

<div class="min-h-screen w-screen overflow-y-auto bg-[#0f0f0f]">
  <div class="mx-auto max-w-5xl p-4">
    <a href="/classes" class="mb-6 flex items-center gap-3 pt-4">
      <img src={logo} alt="Starforge" class="h-10 w-10" />
      <h1 class="text-xl font-bold text-white">Starforge Classes</h1>
    </a>
    {@render children()}
  </div>
</div>
