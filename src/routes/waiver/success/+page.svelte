<script lang="ts">
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import { SPACE_EMAIL } from '$lib/space';
</script>

<svelte:head>
  <title>Waiver Signed</title>
</svelte:head>

<div
  class="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-3 px-4 py-8 text-center text-sm"
>
  <CircleCheckIcon class="size-12 text-success" />
  <h1 class="text-xl font-semibold">Waiver Signed Successfully</h1>

  <p class="text-muted-foreground">
    Thank you for signing the Starforge waiver. You are now cleared to use our facilities.
  </p>

  <p class="text-muted-foreground">
    If you have any questions, please contact us at
    <a href="mailto:{SPACE_EMAIL.CONTACT}" class="text-primary hover:underline"
      >{SPACE_EMAIL.CONTACT}</a
    >.
  </p>
</div>
