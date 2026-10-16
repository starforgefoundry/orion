<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import type { Component, Snippet } from 'svelte';
  import type { HTMLFormAttributes } from 'svelte/elements';
  import Modal, { type ModalSize } from './Modal.svelte';

  type Props = {
    title: string;
    description?: string;
    icon?: Component;
    size?: ModalSize;
    onClose: () => void;
    submitLabel: string;
    submitIcon?: Component;
    canSubmit?: boolean;
    submitting?: boolean;
    /** Attributes for the form element, e.g. a remote form's `enhance(...)` result. */
    form?: HTMLFormAttributes;
    /** For forms not backed by a remote form; the default submit is prevented. */
    onSubmit?: () => void;
    children: Snippet;
  };

  let {
    title,
    description,
    icon,
    size,
    onClose,
    submitLabel,
    submitIcon: SubmitIcon,
    canSubmit = true,
    submitting = false,
    form,
    onSubmit,
    children,
  }: Props = $props();

  const formId = $props.id();

  function handleSubmit(event: SubmitEvent) {
    if (!onSubmit) return;
    event.preventDefault();
    onSubmit();
  }
</script>

<Modal {title} {description} {icon} {size} {onClose}>
  <form id={formId} class="flex flex-col gap-4" onsubmit={handleSubmit} {...form}>
    {@render children()}
  </form>

  {#snippet footer()}
    <Button variant="outline" onclick={() => onClose()}>Cancel</Button>
    <Button type="submit" form={formId} disabled={!canSubmit || submitting}>
      {#if submitting}<Spinner />{:else if SubmitIcon}<SubmitIcon />{/if}
      {submitLabel}
    </Button>
  {/snippet}
</Modal>
