<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
  import { getActiveClasses } from '$lib/remotes/endpoints/class.remote';

  const catalogsRemote = getActiveClasses();
  const catalogs = $derived(catalogsRemote.current ?? []);
</script>

<svelte:head>
  <title>Starforge Classes</title>
</svelte:head>

{#if catalogsRemote.loading}
  <Spinner class="mx-auto mt-12 size-8" />
{:else if catalogs.length === 0}
  <p class="rounded-lg border p-6 text-center text-sm text-muted-foreground">
    No classes are currently available.
  </p>
{:else}
  <div class="grid gap-4 md:grid-cols-2">
    {#each catalogs as cls}
      <Card.Root size="sm" class="h-full">
        {#if cls.photoUrl}
          <img src={cls.photoUrl} alt={cls.name} class="h-36 w-full object-cover" />
        {/if}
        <Card.Header>
          <Card.Title>{cls.name}</Card.Title>
          <Card.Description class="line-clamp-2">{cls.description}</Card.Description>
        </Card.Header>
        <Card.Footer class="mt-auto">
          <Button variant="outline" size="sm" class="w-full" href="/classes/{cls.id}">
            View Details
          </Button>
        </Card.Footer>
      </Card.Root>
    {/each}
  </div>
  <p class="mt-4 rounded-lg border bg-muted/50 p-4 text-center text-sm">
    Looking for classes on other topics? Send us an email with your suggestion to
    <a href="mailto:classes@starforgefoundry.com" class="text-primary hover:underline">
      classes@starforgefoundry.com
    </a>!
  </p>
{/if}
