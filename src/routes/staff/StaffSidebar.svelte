<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import logo from '$lib/assets/logo.png';
  import * as Avatar from '$lib/components/ui/avatar';
  import * as Sidebar from '$lib/components/ui/sidebar';
  import { useSidebar } from '$lib/components/ui/sidebar';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import { currentUser } from '$lib/frontend/stores/user.svelte';
  import { signOut } from '@auth/sveltekit/client';
  import ArchiveIcon from '@lucide/svelte/icons/archive';
  import LogOutIcon from '@lucide/svelte/icons/log-out';
  import BookOpenIcon from '@lucide/svelte/icons/book-open';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import CarIcon from '@lucide/svelte/icons/car';
  import SpoolIcon from '@lucide/svelte/icons/spool';
  import FileSignatureIcon from '@lucide/svelte/icons/file-pen-line';
  import PrinterIcon from '@lucide/svelte/icons/printer-3d';
  import ScanLineIcon from '@lucide/svelte/icons/scan-line';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import ShoppingCartIcon from '@lucide/svelte/icons/shopping-cart';
  import TicketIcon from '@lucide/svelte/icons/ticket';
  import UsersIcon from '@lucide/svelte/icons/users';
  import type { Component } from 'svelte';

  type NavItem = { href: string; title: string; icon: Component };
  type NavGroup = { title?: string; items: NavItem[] };

  const SETTINGS_HREF = '/staff/settings';

  const NAV_GROUPS: NavGroup[] = [
    {
      title: '3D Print Requests',
      items: [
        { href: '/staff/print_requests/queue', title: 'Request Queue', icon: PrinterIcon },
        { href: '/staff/print_requests/materials', title: 'Print Materials', icon: SpoolIcon },
        { href: '/staff/print_requests/scan', title: 'Scan AMS', icon: ScanLineIcon },
      ],
    },
    {
      title: 'Classes',
      items: [
        { href: '/staff/classes/calendar', title: 'Calendar', icon: CalendarIcon },
        { href: '/staff/classes/catalog', title: 'Catalog', icon: BookOpenIcon },
      ],
    },
    {
      title: 'Car Bay',
      items: [{ href: '/staff/car_bay', title: 'Bookings', icon: CarIcon }],
    },
    {
      title: 'Inventory',
      items: [
        { href: '/staff/inventory/items', title: 'Items', icon: ArchiveIcon },
        { href: '/staff/inventory/purchase', title: 'Purchase List', icon: ShoppingCartIcon },
      ],
    },
    {
      title: 'Members',
      items: [
        { href: '/staff/waivers', title: 'Waivers', icon: FileSignatureIcon },
        { href: '/staff/organizations', title: 'Organizations', icon: UsersIcon },
        { href: '/staff/billing_codes', title: 'Billing Codes', icon: TicketIcon },
      ],
    },
  ];

  const sidebar = useSidebar();
  const user = currentUser();

  afterNavigate(() => sidebar.setOpenMobile(false));

  function initials(name: string) {
    return name
      .split(' ')
      .map((part) => part.at(0) ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
</script>

<Sidebar.Root collapsible="icon">
  <Sidebar.Header class="flex-row items-center justify-between gap-2 px-3 py-3">
    <a href="/staff/print_requests/queue" class="group-data-[collapsible=icon]:hidden">
      <img src={logo} alt="Orion" class="h-8" />
    </a>
    <Sidebar.Trigger class="max-md:hidden" />
  </Sidebar.Header>
  <Sidebar.Content class="gap-0">
    {#each NAV_GROUPS as group (group.title ?? 'default')}
      <Sidebar.Group class="py-1">
        {#if group.title}
          <Sidebar.GroupLabel>{group.title}</Sidebar.GroupLabel>
        {/if}
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each group.items as item (item.href)}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton
                  isActive={page.url.pathname.startsWith(item.href)}
                  tooltipContent={item.title}
                >
                  {#snippet child({ props })}
                    <a href={item.href} {...props}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    {/each}
  </Sidebar.Content>
  <Sidebar.Footer>
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          isActive={page.url.pathname.startsWith(SETTINGS_HREF)}
          tooltipContent="Settings"
        >
          {#snippet child({ props })}
            <a href={SETTINGS_HREF} {...props}>
              <SettingsIcon />
              <span>Settings</span>
            </a>
          {/snippet}
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
      <Sidebar.MenuItem>
        <div class="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:p-0">
          <Avatar.Root class="size-8 rounded-md">
            <Avatar.Image src={user?.picture} alt={user?.name} />
            <Avatar.Fallback class="rounded-md">{initials(user?.name ?? 'SF')}</Avatar.Fallback>
          </Avatar.Root>
          <div
            class="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden"
          >
            <span class="truncate font-medium">{user?.name}</span>
            <span class="truncate text-xs text-muted-foreground">{user?.email}</span>
          </div>
          <IconButton
            icon={LogOutIcon}
            aria-label="Sign out"
            class="group-data-[collapsible=icon]:hidden"
            onclick={() => signOut()}
          />
        </div>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  </Sidebar.Footer>
  <Sidebar.Rail />
</Sidebar.Root>
