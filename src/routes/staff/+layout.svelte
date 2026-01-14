<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import UserModal from '$lib/frontend/components/UserModal.svelte';
  import { sidebarManager } from '$lib/frontend/stores/sidebar.svelte';
  import { currentUser } from '$lib/frontend/stores/user.svelte';
  import {
    AppShell,
    AppShellHeader,
    AppShellSidebar,
    Avatar,
    IconButton,
    modalManager,
    NavbarGroup,
    NavbarItem,
  } from '@immich/ui';
  import {
    mdiAccountGroup,
    mdiArchive,
    mdiCartOutline,
    mdiCog,
    mdiMenu,
    mdiPaperRoll,
    mdiPrinter3d,
    mdiTicket,
  } from '@mdi/js';

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
      <NavbarGroup title="3D Print Requests" />
      <NavbarItem href={'/staff/print_queue'} title={'Print Queue'} icon={mdiPrinter3d} />
      <NavbarItem href={'/staff/print_materials'} title={'Print Materials'} icon={mdiPaperRoll} />
      <NavbarItem href={'/staff/print_settings'} title={'Settings'} icon={mdiCog} />
      <NavbarGroup title="Inventory" />
      <NavbarItem href={'/staff/inventory'} title={'Items'} icon={mdiArchive} />
      <NavbarItem
        href={'/staff/inventory/purchase'}
        title={'Purchase List'}
        icon={mdiCartOutline}
      />
      <NavbarGroup title="Payments" />
      <NavbarItem href={'/staff/organizations'} title={'Organizations'} icon={mdiAccountGroup} />
      <NavbarItem href={'/staff/billing_codes'} title={'Billing Codes'} icon={mdiTicket} />
    </div>
  </AppShellSidebar>

  <div class="grow p-4">
    {@render children?.()}
  </div>
</AppShell>
