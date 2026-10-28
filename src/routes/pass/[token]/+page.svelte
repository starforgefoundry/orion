<script lang="ts">
  import { page } from '$app/state';
  import PassCard from '$lib/frontend/member-pass/PassCard.svelte';

  const CONTACT_EMAIL = 'contact@starforgefoundry.com';

  const token = page.params.token ?? '';
</script>

<svelte:head>
  <title>Pass - Starforge</title>
</svelte:head>

<div class="min-h-dvh bg-muted/40">
  <main class="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-10">
    <PassCard {token} />

    <p class="text-center text-sm text-muted-foreground">
      Questions? <a href={`mailto:${CONTACT_EMAIL}`} class="underline">{CONTACT_EMAIL}</a>
    </p>
  </main>
</div>
