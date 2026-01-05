<script lang="ts">
  import { CardBody, CardHeader, CardTitle, Icon, Text } from '@immich/ui';
  import { mdiCloseCircle, mdiReceipt } from '@mdi/js';
</script>

<CardHeader>
  <div class="flex items-center justify-start gap-2">
    <Icon icon={mdiReceipt} size="1.5rem" aria-hidden />
    <CardTitle>3D Print Request Quote</CardTitle>
  </div>
</CardHeader>
<CardBody>
  <div class="flex flex-col items-center justify-center text-center">
    <Icon icon={mdiCloseCircle} class="h-16 w-16 align-middle text-danger" />
    <h1 class="pb-4 text-3xl font-bold">3D Print Request Canceled</h1>

    <Text>
      If you have any questions or need further assistance, please contact us at
      <a href="mailto:3dprint@starforgefoundry.com" class="text-primary">
        3dprint@starforgefoundry.com</a
      >
    </Text>
  </div>
</CardBody>
