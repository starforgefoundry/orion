<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import SignaturePad from '$lib/frontend/components/SignaturePad.svelte';
  import WaiverAgreement from '$lib/frontend/components/WaiverAgreement.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { submitOnboardingWaiverForm } from '$lib/remotes/endpoints/onboarding.remote';

  let { token, name, email }: { token: string; name: string; email: string } = $props();

  let signature = $state<File | null>(null);

  const fields = submitOnboardingWaiverForm.fields;
  const submitting = $derived(submitOnboardingWaiverForm.pending > 0);

  $effect(() => {
    fields.name.set(name);
  });
</script>

<WaiverAgreement />

<form
  {...enhanceWithToast(submitOnboardingWaiverForm, {
    success: 'Waiver signed',
    error: 'Could not submit waiver',
  })}
  enctype="multipart/form-data"
  class="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:p-6"
>
  <HiddenField field={fields.token} value={token} />

  <div class="grid gap-4 sm:grid-cols-2">
    <FormField label="Full Name" required>
      <TextInput {...fields.name.as('text')} autocomplete="name" />
    </FormField>

    <FormField label="Email">
      <TextInput type="email" value={email} disabled />
    </FormField>
  </div>

  <FormField label="Signature" required>
    <SignaturePad bind:signature />
  </FormField>
  {#if signature}
    <HiddenField field={fields.signature} value={signature} />
  {/if}

  <label class="flex items-center gap-2 text-sm">
    <input {...fields.isAdult.as('checkbox')} class="size-4" required />
    I am 18 years of age or older
  </label>

  <Button type="submit" size="lg" class="sm:self-end" disabled={!signature || submitting}>
    {#if submitting}<Spinner />{/if}
    Sign Waiver
  </Button>
</form>
