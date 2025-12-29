<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import { currentUser } from '$lib/auth/user.svelte';
  import UserModal from '$lib/components/UserModal.svelte';
  import { sidebarManager } from '$lib/managers/sidebar.svelte';
  import {
    AppShell,
    AppShellHeader,
    AppShellSidebar,
    Avatar,
    IconButton,
    modalManager,
    NavbarItem,
  } from '@immich/ui';
  import { mdiMenu, mdiPrinter3d } from '@mdi/js';

  let { children } = $props();

  const user = currentUser();

  function openUserModal() {
    modalManager.show(UserModal);
  }
</script>

<AppShell>
  <AppShellHeader>
    <div class="flex w-full items-center justify-between p-4">
      {#if !sidebarManager.collapsedSidebar}
        <IconButton
          aria-label="Toggle sidebar"
          icon={mdiMenu}
          variant="ghost"
          color="secondary"
          onclick={() => sidebarManager.toggle()}
        />
      {/if}
      <img src={logo} alt={'Orion'} class="h-10" />
      <div class="flex items-center gap-4">
        <button onclick={openUserModal}>
          <Avatar name={user?.name ?? 'SF'} />
        </button>
      </div>
    </div>
  </AppShellHeader>

  <AppShellSidebar class="shadow-none" bind:open={sidebarManager.isOpen}>
    <div class="flex flex-col gap-1 pe-4 pt-4">
      <NavbarItem href={'/staff/prints'} title={'3D-Print Requests'} icon={mdiPrinter3d} />
    </div>
  </AppShellSidebar>

  <div class="grow p-4">
    {@render children?.()}
  </div>
</AppShell>
