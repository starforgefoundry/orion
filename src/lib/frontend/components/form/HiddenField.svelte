<script lang="ts" generics="V extends RemoteFormFieldValue">
  import type { RemoteFormField, RemoteFormFieldValue } from '@sveltejs/kit';

  type Props = {
    field: RemoteFormField<V>;
    value: V;
  };

  let { field, value }: Props = $props();

  $effect(() => {
    field.set(value);
  });

  // Remote forms submit from the DOM, so values held in component state need a real input.
  const inputType = $derived.by(() => {
    if (typeof value === 'boolean') return 'checkbox';
    if (typeof value === 'number') return 'number';
    if (value instanceof File || Array.isArray(value)) return 'file';
    return 'text';
  });
</script>

<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -->
<input hidden {...field.as(inputType as any)} />
