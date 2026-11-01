<script lang="ts">
  import Section from '$lib/frontend/components/Section.svelte';
  import { CAR_BAY_EMAIL } from '$lib/utils/car_bay';
</script>

<Section title="Car Bay Bookings Are Closed">
  <p class="text-sm">
    We are not taking car bay bookings at this time. Please check back later. If you have questions,
    contact us at
    <a href={`mailto:${CAR_BAY_EMAIL}`} class="underline">{CAR_BAY_EMAIL}</a>.
  </p>
</Section>
