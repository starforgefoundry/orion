<script lang="ts">
  interface Props {
    children?: any;
    class?: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
  }

  let { children, class: className = '', width = '', align = 'center' }: Props = $props();

  const alignmentClass = $derived(align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center');
</script>

<td class="{width} {alignmentClass} {className}">
  {@render children()}
</td>
