<script lang="ts">
  import { CardBody, CardHeader, CardTitle, Icon, Text } from '@immich/ui';
  import { mdiCheckCircle, mdiReceipt } from '@mdi/js';
</script>

<CardHeader>
  <div class="flex items-center justify-start gap-2">
    <Icon icon={mdiReceipt} size="1.5rem" aria-hidden />
    <CardTitle>3D Print Request Quote</CardTitle>
  </div>
</CardHeader>
<CardBody>
  <div class="flex flex-col items-center justify-center text-center">
    <Icon icon={mdiCheckCircle} class="h-16 w-16 align-middle text-success" />
    <h1 class="mb-6 text-3xl font-bold">Quote Approved</h1>

    <Text class="mb-6">
      You will receive an email confirmation shortly with a payment link to complete your order.
    </Text>

    <Text>
      If you have any questions or need further assistance, please contact us at
      <a href="mailto:3dprint@starforgefoundry.com" class="text-primary">
        3dprint@starforgefoundry.com</a
      >
    </Text>
  </div>
</CardBody>
