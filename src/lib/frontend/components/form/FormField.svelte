<script lang="ts" module>
  import { getContext, setContext } from 'svelte';

  /** The `aria-describedby` of the control in a FormField with this `for`. */
  export function describedBy(id: string, shown: { description?: unknown; error?: unknown }) {
    const ids = [shown.description && `${id}-description`, shown.error && `${id}-error`];
    return ids.filter(Boolean).join(' ') || undefined;
  }

  type FieldContext = { required: () => boolean; labelId: () => string };

  const FIELD_KEY = Symbol('form-field');

  /** Call while a control initializes to read the FormField around it, if any. */
  export function formFieldContext() {
    const field = getContext<FieldContext | undefined>(FIELD_KEY);
    return {
      /** The control's default `aria-required`, since the star is hidden from screen readers. */
      required: () => field?.required() || undefined,
      /** For controls that `for` can't label. */
      labelId: () => field?.labelId(),
    };
  }
</script>

<script lang="ts">
  import * as Field from '$lib/components/ui/field';
  import { cn } from '$lib/frontend/cn';
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    for?: string;
    required?: boolean;
    description?: string;
    error?: string;
    class?: string;
    children: Snippet;
  };

  let {
    label,
    for: htmlFor,
    required = false,
    description,
    error,
    class: className,
    children,
  }: Props = $props();

  const uid = $props.id();
  const labelId = $derived(`${htmlFor ?? uid}-label`);

  setContext<FieldContext>(FIELD_KEY, { required: () => required, labelId: () => labelId });
</script>

<!-- The label gets a `<for>-label` id, and with `for` the description and error get `<for>-description` and `<for>-error` ids for aria-describedby. -->

<Field.Field class={cn('gap-1.5', className)} data-invalid={error ? true : undefined}>
  <Field.Label for={htmlFor} id={labelId}>
    {label}
    {#if required}<span class="text-destructive" aria-hidden="true">*</span>{/if}
  </Field.Label>
  {@render children()}
  {#if description}
    <Field.Description id={htmlFor && `${htmlFor}-description`}>{description}</Field.Description>
  {/if}
  {#if error}
    <Field.Error id={htmlFor && `${htmlFor}-error`}>{error}</Field.Error>
  {/if}
</Field.Field>
