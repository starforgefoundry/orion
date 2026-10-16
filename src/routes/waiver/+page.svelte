<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import logo from '$lib/assets/logo.png';
  import SignaturePad from '$lib/frontend/components/SignaturePad.svelte';
  import WaiverAgreement from '$lib/frontend/components/WaiverAgreement.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { submitWaiverForm } from '$lib/remotes/endpoints/waiver.remote';

  const CONTACT_EMAIL = 'contact@starforgefoundry.com';

  let signature = $state<File | null>(null);

  const submitting = $derived(submitWaiverForm.pending > 0);
</script>

<svelte:head>
  <title>Starforge Waiver</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
  <header class="flex items-center gap-4">
    <img src={logo} alt="Starforge" class="size-12 shrink-0" />
    <div>
      <h1 class="text-2xl font-semibold">Liability Waiver</h1>
      <p class="text-sm text-muted-foreground">
        Read and sign before using the Starforge Foundry facilities.
      </p>
    </div>
  </header>

  <WaiverAgreement />

  <form
    {...enhanceWithToast(submitWaiverForm, {
      success: 'Waiver signed',
      error: 'Could not submit waiver',
    })}
    enctype="multipart/form-data"
    class="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:p-6"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <FormField label="Full Name" required>
        <TextInput
          {...submitWaiverForm.fields.name.as('text')}
          placeholder="John Doe"
          autocomplete="name"
        />
      </FormField>

      <FormField label="Email" required>
        <TextInput
          {...submitWaiverForm.fields.email.as('text')}
          type="email"
          placeholder="john@example.com"
          autocomplete="email"
        />
      </FormField>
    </div>

    <FormField label="Signature" required>
      <SignaturePad bind:signature />
    </FormField>
    {#if signature}
      <HiddenField field={submitWaiverForm.fields.signature} value={signature} />
    {/if}

    <label class="flex items-center gap-2 text-sm">
      <input {...submitWaiverForm.fields.isAdult.as('checkbox')} class="size-4" />
      I am 18 years of age or older
    </label>

    <Button type="submit" size="lg" class="sm:self-end" disabled={!signature || submitting}>
      {#if submitting}<Spinner />{/if}
      Sign Waiver
    </Button>
  </form>

  <p class="text-sm text-muted-foreground">
    Questions? Contact us at
    <a href={`mailto:${CONTACT_EMAIL}`} class="underline">{CONTACT_EMAIL}</a>
  </p>
</div>
