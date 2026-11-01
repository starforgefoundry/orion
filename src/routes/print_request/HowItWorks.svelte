<script lang="ts">
  import { SPACE_EMAIL } from '$lib/utils/space';

  const PRINTING_GUIDE_URL = 'https://wiki.starforgefoundry.com/en/3d-printers';

  const HOW_IT_WORKS = [
    {
      title: 'Tell us who you are',
      description: 'We use your email to send updates and invoices.',
    },
    {
      title: 'Upload your models',
      description: 'Add your files, pick a material and note any special requests.',
    },
    {
      title: 'We print it',
      description: 'Staff review your request and reach out with a quote if you asked for one.',
    },
    { title: 'Pick it up', description: "You'll get an email when your print is ready." },
  ];
</script>

<aside class="flex flex-col gap-5 rounded-xl bg-muted/40 p-5 sm:p-6">
  <h2 class="text-base font-semibold">How it works</h2>
  <ol class="flex flex-col gap-4">
    {#each HOW_IT_WORKS as item, index (item.title)}
      <li class="flex gap-3">
        <span
          class="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
        >
          {index + 1}
        </span>
        <div>
          <p class="text-sm font-medium">{item.title}</p>
          <p class="text-sm text-muted-foreground">{item.description}</p>
        </div>
      </li>
    {/each}
  </ol>
  <div class="mt-auto flex flex-col gap-1 border-t pt-4 text-sm text-muted-foreground">
    <a href={PRINTING_GUIDE_URL} class="text-primary underline" target="_blank">
      Read the 3D Printing Guide
    </a>
    <span>
      Questions? <a href={`mailto:${SPACE_EMAIL.PRINTS}`} class="underline">{SPACE_EMAIL.PRINTS}</a>
    </span>
  </div>
</aside>
