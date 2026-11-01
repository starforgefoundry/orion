<script lang="ts">
  import logo from '$lib/assets/logo.png';
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    /** Where the logo links back to. */
    href: string;
    children: Snippet;
  };

  let { title, href, children }: Props = $props();
</script>

<div class="min-h-dvh bg-background">
  <div class="mx-auto w-full max-w-5xl px-4 pt-6 pb-10">
    <a {href} class="mb-5 flex items-center gap-2.5">
      <img src={logo} alt="Starforge" class="size-9" />
      <h1 class="text-lg font-semibold">{title}</h1>
    </a>
    {@render children()}
  </div>
</div>
