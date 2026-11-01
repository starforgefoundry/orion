<script lang="ts">
  import Section from '$lib/frontend/components/Section.svelte';
  import { SPACE_EMAIL } from '$lib/utils/space';
</script>

<Section title="Car Bay Bookings Are Closed">
  <p class="text-sm">
    We are not taking car bay bookings at this time. Please check back later. If you have questions,
    contact us at
    <a href={`mailto:${SPACE_EMAIL.CAR_BAY}`} class="underline">{SPACE_EMAIL.CAR_BAY}</a>.
  </p>
</Section>
