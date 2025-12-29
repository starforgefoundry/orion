<script lang="ts">
  import { AppShell, AppShellHeader, AppShellSidebar, Avatar, NavbarItem } from '@immich/ui';
  import {
    mdiPrinter3d
  } from '@mdi/js';

  import { page } from '$app/state';
  import logo from '$lib/assets/logo.png';

  let { children } = $props();

  const user = page.data.session?.user;
</script>

<AppShell>
  <AppShellHeader>
    <div class="flex w-full items-center justify-between p-4">
      <img src={logo} alt={"Polaris"} class="h-12" />
      <div class="flex items-center gap-4">

        <button>
          <Avatar name={user?.name ?? "SF"} />
        </button>
      </div>
    </div>
  </AppShellHeader>


  <AppShellSidebar class="gap-2 pt-2 pr-4">
    <NavbarItem href={'/main/prints'} title={"3D-Print Requests"} icon={mdiPrinter3d} />
  </AppShellSidebar>

  <div class="grow p-4">
    {@render children?.()}
  </div>
</AppShell>
