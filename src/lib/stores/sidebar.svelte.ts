import { MediaQuery } from 'svelte/reactivity';

const sidebar = new MediaQuery(`min-width: 850px`);

class SidebarManager {
  collapsedSidebar = $derived.by(() => sidebar.current);
  isOpen = $derived.by(() => sidebar.current);

  toggle() {
    this.isOpen = sidebar.current ? true : !this.isOpen;
  }
}

// Persist SidebarManager instance across HMRs
let sidebarManager: SidebarManager;

if (import.meta.hot) {
  if (!import.meta.hot.data.sidebarManager) {
    import.meta.hot.data.sidebarManager = new SidebarManager();
  }
  sidebarManager = import.meta.hot.data.sidebarManager;
} else {
  sidebarManager = new SidebarManager();
}

export { sidebarManager };
