<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
</script>

<svelte:head>
  <title>3D Print Request Submitted</title>
</svelte:head>

<div
  class="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center gap-3 px-4 py-8 text-center text-sm"
>
  <CircleCheckIcon class="size-12 text-success" />
  <h1 class="text-xl font-semibold">3D Print Request Submitted</h1>

  <p class="text-muted-foreground">
    We will review your request and get back to you shortly. Keep an eye on your email for further
    updates!
  </p>

  <p class="text-muted-foreground">
    If you have any questions or need further assistance, please contact us at
    <a href="mailto:3dprint@starforgefoundry.com" class="text-primary hover:underline">
      3dprint@starforgefoundry.com
    </a>.
  </p>

  <Button onclick={() => (window.location.href = '/print_request')} class="mt-2">
    Submit Another Request
  </Button>
</div>
