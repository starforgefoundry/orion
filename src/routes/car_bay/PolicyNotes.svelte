<script lang="ts">
  import { CAR_BAY_EMAIL, type CarBayPolicy } from '$lib/utils/car_bay';

  interface Props {
    policy: CarBayPolicy;
  }

  let { policy }: Props = $props();
</script>

<div class="flex flex-col gap-1 text-sm text-muted-foreground">
  <p>
    You can move your own car outside when your booking ends, free of charge. It can stay on the
    property for up to {policy.storageDays} days from your booking's start date.
  </p>
  <p>
    Need to book more than {policy.publicHorizonDays} days out? Contact us at
    <a href={`mailto:${CAR_BAY_EMAIL}`} class="underline">{CAR_BAY_EMAIL}</a>
  </p>
</div>
