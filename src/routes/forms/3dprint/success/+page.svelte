<script lang="ts">
  import { Button, Icon, Text } from '@immich/ui';
  import { mdiCheckCircle } from '@mdi/js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>3D Print Request Submitted</title>
</svelte:head>

<div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4 text-center">
  <Icon icon={mdiCheckCircle} class="h-16 w-16 text-success" />
  <h1 class="text-3xl font-bold">3D Print Request Submitted</h1>

  <Text>
    We will review your request and get back to you shortly. Keep an eye on your email for further
    updates!
  </Text>

  <Text>
    If you have any questions or need further assistance, please contact us at
    <a href="mailto:contact@starforgefoundry.com"> contact@starforgefoundry.com</a>
  </Text>

  <Button onclick={() => (window.location.href = '/forms/3dprint')} class="mt-4">
    Submit Another Request
  </Button>
</div>
