<script lang="ts">
  interface Props {
    children?: any;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<table class="mt-4 w-full text-start {className}">
  {@render children()}
</table>
