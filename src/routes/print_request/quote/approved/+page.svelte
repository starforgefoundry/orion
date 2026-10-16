<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import ReceiptIcon from '@lucide/svelte/icons/receipt';
</script>

<Card.Header>
  <Card.Title class="flex items-center gap-2">
    <ReceiptIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    3D Print Request Quote
  </Card.Title>
</Card.Header>
<Card.Content>
  <div class="flex flex-col items-center gap-2 py-4 text-center">
    <CircleCheckIcon class="size-12 text-success" />
    <h1 class="text-xl font-semibold">Quote Approved</h1>
    <p class="text-muted-foreground">
      You will receive an email confirmation shortly with a payment link to complete your order.
    </p>
    <p class="text-muted-foreground">
      If you have any questions or need further assistance, please contact us at
      <a href="mailto:3dprint@starforgefoundry.com" class="text-primary hover:underline">
        3dprint@starforgefoundry.com</a
      >
    </p>
  </div>
</Card.Content>
