<script lang="ts" module>
  export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

  const SIZE_CLASSES: Record<ModalSize, string> = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-6xl',
  };
</script>

<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { buttonVariants } from '$lib/components/ui/button';
  import { cn } from '$lib/frontend/cn';
  import XIcon from '@lucide/svelte/icons/x';
  import type { Component, Snippet } from 'svelte';

  type Props = {
    title: string;
    description?: string;
    icon?: Component;
    size?: ModalSize;
    class?: string;
    onClose: () => void;
    children: Snippet;
    footer?: Snippet;
    headerActions?: Snippet;
  };

  let {
    title,
    description,
    icon: Icon,
    size = 'md',
    class: className,
    onClose,
    children,
    footer,
    headerActions,
  }: Props = $props();
</script>

<Dialog.Root open onOpenChange={(open) => !open && onClose()}>
  <Dialog.Content
    showCloseButton={false}
    class={cn(
      'flex max-h-[90dvh] flex-col gap-0 p-0',
      'max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:ring-0',
      SIZE_CLASSES[size],
    )}
  >
    <Dialog.Header class="min-h-12 flex-row items-center gap-2 border-b py-2.5 pr-2 pl-4">
      {#if Icon}
        <Icon class="size-4 shrink-0 text-muted-foreground" />
      {/if}
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <Dialog.Title class="truncate leading-snug">{title}</Dialog.Title>
        {#if description}
          <Dialog.Description class="truncate leading-snug">{description}</Dialog.Description>
        {/if}
      </div>
      {@render headerActions?.()}
      <Dialog.Close class={buttonVariants({ variant: 'ghost', size: 'icon' })}>
        <XIcon />
        <span class="sr-only">Close</span>
      </Dialog.Close>
    </Dialog.Header>

    <div class={cn('min-h-0 flex-1 overflow-y-auto p-4', className)}>
      {@render children()}
    </div>

    {#if footer}
      <Dialog.Footer class="border-t px-4 py-3">
        {@render footer()}
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
