<script lang="ts">
  import banner from '$lib/assets/3dp-banner.jpeg';
  import logo from '$lib/assets/logo.png';
</script>

<header class="relative h-48 w-full overflow-hidden sm:h-60">
  <img src={banner} alt="" class="absolute inset-0 h-full w-full object-cover" />
  <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10"></div>
  <div class="relative mx-auto flex h-full max-w-6xl items-end px-4 pb-6">
    <div class="flex items-center gap-4">
      <img src={logo} alt="Starforge" class="size-12 shrink-0 sm:size-14" />
      <h1 class="min-w-0 text-2xl font-semibold text-white sm:text-3xl">3D Print Request Form</h1>
    </div>
  </div>
</header>
