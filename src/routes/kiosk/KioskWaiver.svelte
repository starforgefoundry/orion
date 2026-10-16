<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import SignaturePad from '$lib/frontend/components/SignaturePad.svelte';
  import WaiverAgreement from '$lib/frontend/components/WaiverAgreement.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { kioskWaiverForm } from '$lib/remotes/endpoints/kiosk.remote';
  import { toast } from 'svelte-sonner';
  import type { KioskManager } from './kiosk-manager.svelte';

  interface Props {
    kiosk: KioskManager;
    passToken: string;
    name: string;
    email: string;
  }

  let { kiosk, passToken, name, email }: Props = $props();

  // Each member gets a fresh form so the previous person's entries never carry over.
  const waiverForm = $derived(kioskWaiverForm.for(passToken));
  let signature = $state<File | null>(null);

  const submitting = $derived(waiverForm.pending > 0);

  $effect(() => {
    waiverForm.fields.name.set(name);
  });

  const enhanced = $derived(
    waiverForm.enhance(async ({ submit }) => {
      try {
        await submit();
      } catch (error) {
        kiosk.fail(error);
        return;
      }

      const [issue] = waiverForm.fields.allIssues() ?? [];
      if (issue) {
        toast.error(issue.message);
        return;
      }
      if (waiverForm.result) kiosk.show(waiverForm.result);
    }),
  );
</script>

<div
  class="h-full overflow-y-auto"
  onpointerdown={() => kiosk.keepWaiverOpen()}
  role="presentation"
>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 p-8">
    <header class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-4xl font-semibold">Sign the waiver to check in</h1>
        <p class="mt-2 text-xl text-muted-foreground">
          We need a signed liability waiver before your first visit.
        </p>
      </div>
      <Button variant="outline" class="h-14 px-8 text-lg" onclick={() => kiosk.reset()}>
        Cancel
      </Button>
    </header>

    <WaiverAgreement />

    <form
      {...enhanced}
      enctype="multipart/form-data"
      class="flex flex-col gap-6 rounded-xl border bg-card p-6"
    >
      <HiddenField field={waiverForm.fields.passToken} value={passToken} />

      <div class="grid gap-6 landscape:grid-cols-2">
        <FormField label="Full Name" required>
          <TextInput {...waiverForm.fields.name.as('text')} class="h-14 text-lg" />
        </FormField>
        <FormField label="Email">
          <TextInput value={email} type="email" readonly disabled class="h-14 text-lg" />
        </FormField>
      </div>

      <FormField label="Signature" required>
        <SignaturePad bind:signature />
      </FormField>
      {#if signature}
        <HiddenField field={waiverForm.fields.signature} value={signature} />
      {/if}

      <label class="flex items-center gap-4 text-xl">
        <input {...waiverForm.fields.isAdult.as('checkbox')} required class="size-8" />
        I am 18 years of age or older
      </label>

      <Button
        type="submit"
        class="h-16 text-xl landscape:self-end landscape:px-12"
        disabled={!signature || submitting}
      >
        {#if submitting}<Spinner />{/if}
        Sign and check in
      </Button>
    </form>
  </div>
</div>
