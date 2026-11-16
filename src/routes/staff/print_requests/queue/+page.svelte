<script lang="ts">
  import WorkOrderQueue from '$lib/frontend/components/WorkOrderQueue.svelte';
  import Kanban from './Kanban.svelte';
  import { openRequest } from './open-request';
  import Table from './Table.svelte';
</script>

<WorkOrderQueue title="Request Queue" formHref="/print_request" {openRequest}>
  {#snippet board()}
    <Kanban />
  {/snippet}
  {#snippet list()}
    <Table />
  {/snippet}
</WorkOrderQueue>
