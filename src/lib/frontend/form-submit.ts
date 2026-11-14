import type { RemoteForm, RemoteFormInput } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';

export type SubmitMessages = {
  success: string;
  error: string;
};

/** Remote functions reject with an `HttpError`, which carries its message on `body`. */
export function errorDescription(error: unknown) {
  if (error instanceof Error) return error.message;
  const body = (error as { body?: { message?: unknown } } | undefined)?.body;
  return typeof body?.message === 'string' ? body.message : undefined;
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

/** Keyed instances from `form.for(key)` lack `for` themselves. */
type EnhanceableForm<T extends RemoteFormInput, R> = Omit<RemoteForm<T, R>, 'for'>;

type EnhanceHandlers<R> = {
  /** Runs before submitting. Returning false stops the submission. */
  validate?: () => boolean;
  /** Called with the first validation issue the server reported. */
  onIssue: (message: string) => void;
  /** Called when the submission itself failed. */
  onError: (error: unknown) => void;
  onSuccess: (result: R | undefined) => void;
};

/** Enhances a remote form and sorts each submission into success, a validation issue or a failure. */
export function enhanceForm<T extends RemoteFormInput, R>(
  form: EnhanceableForm<T, R>,
  handlers: EnhanceHandlers<R>,
) {
  return form.enhance(async ({ submit }) => {
    if (handlers.validate?.() === false) return;
    try {
      await submit();
    } catch (error) {
      handlers.onError(error);
      return;
    }

    const [issue] = form.fields.allIssues() ?? [];
    if (issue) handlers.onIssue(issue.message);
    else handlers.onSuccess(form.result);
  });
}

/**
 * Enhances a remote form so submission reports a toast, and calls `onSuccess` only once the
 * server accepted it. Validation issues stay on the form instead of counting as success.
 */
export function enhanceWithToast<T extends RemoteFormInput, R>(
  form: EnhanceableForm<T, R>,
  messages: SubmitMessages,
  onSuccess?: () => void,
) {
  return enhanceForm(form, {
    onIssue: (message) => toast.error(messages.error, { description: message }),
    onError: (error) => toast.error(messages.error, { description: errorDescription(error) }),
    onSuccess: () => {
      toast.success(messages.success);
      onSuccess?.();
    },
  });
}
