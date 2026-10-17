<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { requestPassEmailForm } from '$lib/remotes/endpoints/onboarding.remote';
  import { toast } from 'svelte-sonner';
  import type { KioskManager } from './kiosk-manager.svelte';

  interface Props {
    kiosk: KioskManager;
    requestId: string;
  }

  let { kiosk, requestId }: Props = $props();

  const passEmailForm = $derived(requestPassEmailForm.for(requestId));
  const submitting = $derived(passEmailForm.pending > 0);

  const enhanced = $derived(
    passEmailForm.enhance(async ({ submit }) => {
      try {
        await submit();
      } catch (error) {
        kiosk.fail(error);
        return;
      }

      const [issue] = passEmailForm.fields.allIssues() ?? [];
      if (issue) {
        toast.error(issue.message);
        return;
      }
      if (passEmailForm.result?.requested) kiosk.passEmailSent();
    }),
  );
</script>

<div class="h-full overflow-y-auto" onpointerdown={() => kiosk.keepFormOpen()} role="presentation">
  <div class="mx-auto flex max-w-3xl flex-col gap-6 p-8">
    <header class="flex items-start justify-between gap-6">
      <div>
        <h1 class="text-4xl font-semibold">Email my pass</h1>
        <p class="mt-2 text-xl text-muted-foreground">
          Enter the email you signed up with and we'll send your member pass.
        </p>
      </div>
      <Button variant="outline" class="h-14 px-8 text-lg" onclick={() => kiosk.reset()}>
        Cancel
      </Button>
    </header>

    <form {...enhanced} class="flex flex-col gap-6 rounded-xl border bg-card p-6">
      <FormField label="Email" required>
        <TextInput
          {...passEmailForm.fields.email.as('email')}
          placeholder="john@example.com"
          autocomplete="off"
          autocapitalize="off"
          class="h-14 text-lg"
        />
      </FormField>

      <Button
        type="submit"
        class="h-16 text-xl landscape:self-end landscape:px-12"
        disabled={submitting}
      >
        {#if submitting}<Spinner />{/if}
        Send my pass
      </Button>
    </form>
  </div>
</div>
