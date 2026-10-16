<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import logo from '$lib/assets/logo.png';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { requestPassEmailForm } from '$lib/remotes/endpoints/onboarding.remote';
  import MailCheckIcon from '@lucide/svelte/icons/mail-check';

  const CONTACT_EMAIL = 'contact@starforgefoundry.com';

  const submitting = $derived(requestPassEmailForm.pending > 0);
</script>

<svelte:head>
  <title>Member Pass - Starforge</title>
</svelte:head>

<div class="min-h-dvh bg-muted/40">
  <main class="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-10">
    <header class="flex flex-col items-center gap-3 text-center">
      <img src={logo} alt="Starforge" class="size-14" />
      <h1 class="text-2xl font-semibold">Get Your Member Pass</h1>
      <p class="text-sm text-muted-foreground">
        Lost your welcome email? Enter the email you signed up with and we'll send your pass link
        again.
      </p>
    </header>

    {#if requestPassEmailForm.result?.requested}
      <div
        class="flex w-full flex-col items-center gap-2 rounded-2xl border bg-card p-6 text-center"
      >
        <MailCheckIcon class="size-8 text-primary" />
        <p class="font-semibold">Check your inbox</p>
        <p class="text-sm text-muted-foreground">
          If that email belongs to an active member, a link to your pass is on its way.
        </p>
      </div>
    {:else}
      <form
        {...enhanceWithToast(requestPassEmailForm, {
          success: 'Request sent',
          error: 'Could not send request',
        })}
        class="flex w-full flex-col gap-4 rounded-2xl border bg-card p-6"
      >
        <FormField label="Email" required>
          <TextInput
            {...requestPassEmailForm.fields.email.as('email')}
            placeholder="john@example.com"
            autocomplete="email"
          />
        </FormField>
        <Button type="submit" size="lg" disabled={submitting}>
          {#if submitting}<Spinner />{/if}
          Email My Pass
        </Button>
      </form>
    {/if}

    <p class="text-center text-sm text-muted-foreground">
      Questions? <a href={`mailto:${CONTACT_EMAIL}`} class="underline">{CONTACT_EMAIL}</a>
    </p>
  </main>
</div>
