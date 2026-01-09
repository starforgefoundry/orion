<script lang="ts">
  import { CardBody, CardHeader, CardTitle, Icon, Text } from '@immich/ui';
  import { mdiAlertCircle, mdiCheckCircle, mdiPackageVariant } from '@mdi/js';

  let { data }: { data: any } = $props();
</script>

<CardHeader>
  <div class="flex items-center justify-start gap-2">
    <Icon icon={mdiPackageVariant} size="1.5rem" aria-hidden />
    <CardTitle>Inventory Item Scanned</CardTitle>
  </div>
</CardHeader>
<CardBody>
  {#if data.error}
    <div class="flex flex-col items-center justify-center text-center">
      <Icon icon={mdiAlertCircle} class="h-16 w-16 align-middle text-danger" />
      <h1 class="mb-6 text-3xl font-bold">Error</h1>

      <Text class="mb-6">{data.error}</Text>

      <Text>If you believe this is an error, please contact the staff.</Text>
    </div>
  {:else}
    <div class="flex flex-col items-center justify-center text-center">
      <Icon icon={mdiCheckCircle} class="h-16 w-16 align-middle text-success" />
      <h1 class="mb-6 text-3xl font-bold">Added to Purchase List</h1>

      <div class="mb-6 w-full rounded-lg bg-gray-100 p-4 text-left">
        <div class="mb-2">
          <span class="font-bold">Item:</span>
          {data.item.name}
        </div>
        <div class="mb-2">
          <span class="font-bold">Vendor:</span>
          {data.item.vendor}
        </div>
        <div>
          <span class="font-bold">Description:</span>
          {data.item.description}
        </div>
      </div>

      <Text class="mb-6">
        This item has been added to the purchase list and will be reviewed by staff.
      </Text>

      <Text class="text-sm text-gray-600">
        If this item is already on the purchase list, it will not be duplicated.
      </Text>
    </div>
  {/if}
</CardBody>
