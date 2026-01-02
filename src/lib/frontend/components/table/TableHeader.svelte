<script lang="ts">
  interface Props {
    children?: any;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<thead class="mb-4 flex h-12 w-full rounded-md border bg-subtle {className}">
  <tr class="flex w-full place-items-center text-center text-sm font-medium">
    {@render children()}
  </tr>
</thead>
