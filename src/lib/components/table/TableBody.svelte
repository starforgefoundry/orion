<script lang="ts">
  interface Props {
    children?: any;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<tbody class="dark:border-immich-dark-gray block w-full overflow-y-auto rounded-md border {className}">
  {@render children()}
</tbody>
