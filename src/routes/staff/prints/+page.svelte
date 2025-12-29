<script lang="ts">
  import { Button, Heading, HStack, Icon } from '@immich/ui';
  import { mdiDeveloperBoard, mdiFormatListBulleted } from '@mdi/js';
  import Kanban from './Kanban.svelte';

  let selectedMode: 'board' | 'list' = $state('board');
</script>

<svelte:head>
  <title>3D-Print Requests | Orion</title>
</svelte:head>

<div class="mb-4 flex flex-row items-center justify-between">
  <Heading>3D-Print Requests</Heading>
  <HStack gap={0}>
    <Button
      color={selectedMode === 'board' ? 'primary' : 'secondary'}
      onclick={() => (selectedMode = 'board')}
      shape="rectangle"
      class="rounded-l-lg"
    >
      <Icon icon={mdiDeveloperBoard} size="24" />
    </Button>

    <Button
      color={selectedMode === 'list' ? 'primary' : 'secondary'}
      onclick={() => (selectedMode = 'list')}
      shape="rectangle"
      class="rounded-r-lg"
    >
      <Icon icon={mdiFormatListBulleted} size="24" />
    </Button>
  </HStack>
</div>

<!-- Divider -->
<hr class="border-border-500 mb-4 border-t" />

{#if selectedMode === 'board'}
  <Kanban />
{:else}
  <!-- <ListView /> -->
{/if}
