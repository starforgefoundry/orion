<script lang="ts">
  import MailCheckIcon from '@lucide/svelte/icons/mail-check';

  interface Props {
    onDismiss: () => void;
  }

  let { onDismiss }: Props = $props();
</script>

<button
  type="button"
  class="flex h-full w-full flex-col items-center justify-center gap-8 p-12 text-center"
  onclick={onDismiss}
>
  <MailCheckIcon class="size-40 text-primary" />
  <h1 class="text-6xl font-semibold">Check your inbox</h1>
  <p class="max-w-3xl text-3xl text-muted-foreground">
    If that email belongs to an active member, your pass is on its way.
  </p>
</button>
