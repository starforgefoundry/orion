<script lang="ts">
  import type { CarBayPolicy } from '$lib/utils/car_bay';

  interface Props {
    policy: CarBayPolicy;
  }

  let { policy }: Props = $props();
</script>

<div class="flex flex-col gap-2 rounded-lg border bg-muted/50 p-4 text-sm">
  <p>
    Need to book more than {policy.publicHorizonDays} days out? Contact us through our website.
  </p>
  <p>
    You can move your own car outside when your booking ends, free of charge. It can stay on the
    property for up to {policy.storageDays} days from your booking's start date.
  </p>
</div>
