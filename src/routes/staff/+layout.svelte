<script lang="ts">
  import { beforeNavigate } from '$app/navigation';
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
    mdiCalendar,
    mdiCartOutline,
    mdiCog,
    mdiFileSign,
    mdiMenu,
    mdiPaperRoll,
    mdiPrinter3d,
    mdiQrcodeScan,
    mdiTicket,
    mdiViewList,
  } from '@mdi/js';

  let { children } = $props();

  const user = currentUser();

  function openUserModal() {
    modalManager.show(UserModal);
  }

  beforeNavigate(() => {
    if (!sidebarManager.collapsedSidebar) {
      sidebarManager.isOpen = false;
    }
  });
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
    <div class="flex flex-col gap-1 pe-4 pt-4 pb-8">
      <NavbarGroup title="3D Print Requests" />
      <NavbarItem
        href={'/staff/print_requests/queue'}
        title={'Request Queue'}
        icon={mdiPrinter3d}
      />
      <NavbarItem
        href={'/staff/print_requests/materials'}
        title={'Print Materials'}
        icon={mdiPaperRoll}
      />
      <NavbarItem href={'/staff/print_requests/scan'} title={'Scan AMS'} icon={mdiQrcodeScan} />
      <NavbarGroup title="Classes" />
      <NavbarItem href={'/staff/classes/calendar'} title={'Calendar'} icon={mdiCalendar} />
      <NavbarItem href={'/staff/classes/catalog'} title={'Catalog'} icon={mdiViewList} />
      <NavbarGroup title="Inventory" />
      <NavbarItem href={'/staff/inventory/items'} title={'Items'} icon={mdiArchive} />
      <NavbarItem
        href={'/staff/inventory/purchase'}
        title={'Purchase List'}
        icon={mdiCartOutline}
      />
      <NavbarGroup title="Members" />
      <NavbarItem href={'/staff/waivers'} title={'Waivers'} icon={mdiFileSign} />
      <NavbarItem href={'/staff/organizations'} title={'Organizations'} icon={mdiAccountGroup} />
      <NavbarItem href={'/staff/billing_codes'} title={'Billing Codes'} icon={mdiTicket} />
      <NavbarGroup title="" />
      <NavbarItem href={'/staff/settings'} title={'Settings'} icon={mdiCog} />
    </div>
  </AppShellSidebar>

  <div class="grow p-4">
    {@render children?.()}
  </div>
</AppShell>
