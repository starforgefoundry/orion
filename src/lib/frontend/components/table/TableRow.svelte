<script lang="ts">
  interface Props {
    children?: any;
    class?: string;
    hoverable?: boolean;
    clickable?: boolean;
    onclick?: () => void;
  }

  let { children, class: className = '', hoverable = false, clickable = false, onclick }: Props = $props();

  const hoverClass = $derived(hoverable ? 'hover:bg-primary/10' : '');
  const clickableClass = $derived(clickable ? 'cursor-pointer' : '');
</script>

<tr
  class="dark:text-immich-dark-fg flex w-full place-items-center py-2 text-center odd:bg-subtle/80 even:bg-subtle/20 {hoverClass} {clickableClass} {className}"
  {onclick}
  role={clickable ? 'button' : undefined}
  tabindex={clickable ? 0 : undefined}
  onkeydown={(e) => {
    if (clickable && onclick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onclick();
    }
  }}
>
  {@render children()}
</tr>
