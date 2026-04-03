<script lang="ts">
  import { getActiveClasses } from '$lib/remotes/endpoints/class.remote';
  import {
    Button,
    Card,
    CardBody,
    CardHeader,
    Heading,
    LoadingSpinner,
    Stack,
    Text,
  } from '@immich/ui';

  const catalogsRemote = getActiveClasses();
  const catalogs = $derived(catalogsRemote.current ?? []);
</script>

<svelte:head>
  <title>Starforge Classes</title>
</svelte:head>

{#if catalogsRemote.loading}
  <LoadingSpinner class="mx-auto mt-12" size="large" />
{:else if catalogs.length === 0}
  <Card>
    <CardBody>
      <Text color="muted" class="text-center">No classes are currently available.</Text>
    </CardBody>
  </Card>
{:else}
  <div class="grid gap-6 md:grid-cols-2">
    {#each catalogs as cls}
      <Card class="h-full overflow-hidden">
        <CardBody>
          <CardHeader class="p-0">
            {#if cls.photoUrl}
              <div class="h-36 w-full overflow-hidden">
                <img src={cls.photoUrl} alt={cls.name} class="h-full w-full object-cover" />
              </div>
            {/if}
          </CardHeader>
          <Stack gap={2}>
            <Heading size="small">{cls.name}</Heading>
            <Text color="muted" class="line-clamp-2">{cls.description}</Text>

            <div class="mt-2 flex flex-wrap justify-end gap-2">
              <Button variant="outline" fullWidth size="small" href="/classes/{cls.id}"
                >View Details</Button
              >
            </div>
          </Stack>
        </CardBody>
      </Card>
    {/each}
  </div>
{/if}
