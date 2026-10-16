<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import * as Sidebar from '$lib/components/ui/sidebar';
  import { SIDEBAR_COOKIE_NAME } from '$lib/components/ui/sidebar/constants';
  import StaffSidebar from './StaffSidebar.svelte';

  let { children } = $props();

  let sidebarOpen = $state(!document.cookie.includes(`${SIDEBAR_COOKIE_NAME}=false`));
</script>

<Sidebar.Provider bind:open={sidebarOpen}>
  <StaffSidebar />

  <Sidebar.Inset class="min-w-0">
    <header
      class="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:hidden"
    >
      <Sidebar.Trigger />
      <img src={logo} alt="Orion" class="h-6" />
    </header>
    <main class="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
      {@render children?.()}
    </main>
  </Sidebar.Inset>
</Sidebar.Provider>
