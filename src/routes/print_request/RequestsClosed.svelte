<script lang="ts">
  import Section from '$lib/frontend/components/Section.svelte';
  import { SPACE_EMAIL } from '$lib/utils/space';
</script>

<Section title="Print Requests Are Closed">
  <p class="text-sm">
    We are not accepting print requests at this time. Please check back later. If you have
    questions, contact us at
    <a href={`mailto:${SPACE_EMAIL.PRINTS}`} class="underline">
      {SPACE_EMAIL.PRINTS}
    </a>.
  </p>
</Section>
