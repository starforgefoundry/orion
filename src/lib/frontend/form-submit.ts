import type { RemoteForm, RemoteFormInput } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';

export type SubmitMessages = {
  success: string;
  error: string;
};

function errorDescription(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}

/** Runs an action and reports the outcome as a toast. Resolves to whether it succeeded. */
export async function submitWithToast(action: () => Promise<unknown>, messages: SubmitMessages) {
  try {
    await action();
    toast.success(messages.success);
    return true;
  } catch (error) {
    toast.error(messages.error, { description: errorDescription(error) });
    return false;
  }
}

/**
 * Enhances a remote form so submission reports a toast, and calls `onSuccess` only once the
 * server accepted it. Validation issues stay on the form instead of counting as success.
 */
export function enhanceWithToast<T extends RemoteFormInput, R>(
  form: RemoteForm<T, R>,
  messages: SubmitMessages,
  onSuccess?: () => void,
) {
  return form.enhance(async ({ submit }) => {
    const ok = await submitWithToast(async () => {
      await submit();
      const issues = form.fields.allIssues();
      if (issues?.length) throw new Error(issues[0].message);
    }, messages);

    if (ok) onSuccess?.();
  });
}
