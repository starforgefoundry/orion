<script lang="ts">
  import { Button, Icon, Text } from '@immich/ui';
  import { mdiCheckCircle } from '@mdi/js';
</script>

<svelte:head>
  <title>Waiver Signed</title>
</svelte:head>

<div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4 text-center">
  <Icon icon={mdiCheckCircle} class="h-16 w-16 text-success" />
  <h1 class="text-3xl font-bold">Waiver Signed Successfully</h1>

  <Text>
    Thank you for signing the Starforge waiver. You are now cleared to use our facilities.
  </Text>

  <Text>
    If you have any questions, please contact us at
    <a href="mailto:info@starforgefoundry.com" class="text-primary">info@starforgefoundry.com</a>.
  </Text>

  <Button onclick={() => (window.location.href = '/waiver')} class="mt-4">
    Sign Another Waiver
  </Button>
</div>
