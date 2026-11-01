import type { RemoteForm, RemoteFormInput } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';
import { describe, expect, it, vi } from 'vitest';
import { enhanceForm, enhanceWithToast, errorDescription } from './form-submit';

vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Submit = () => Promise<void>;
type EnhanceCallback = (options: { submit: Submit }) => Promise<void>;

const MESSAGES = { success: 'Saved', error: 'Failed to save' };

/** A remote form whose submission resolves or rejects as told, then reports `issues`. */
function fakeForm(options: { fails?: unknown; issues?: string[]; result?: string }) {
  let callback: EnhanceCallback | undefined;
  const form = {
    result: options.result,
    fields: { allIssues: () => options.issues?.map((message) => ({ message })) },
    enhance: (handler: EnhanceCallback) => {
      callback = handler;
      return {};
    },
  } as unknown as RemoteForm<RemoteFormInput, string>;

  const submit = () =>
    callback!({
      submit: () => (options.fails ? Promise.reject(options.fails) : Promise.resolve()),
    });

  return { form, submit };
}

function handlers() {
  return { onIssue: vi.fn(), onError: vi.fn(), onSuccess: vi.fn() };
}

describe(errorDescription.name, () => {
  it('reads messages from errors and HTTP error bodies', () => {
    expect(errorDescription(new Error('boom'))).toBe('boom');
    expect(errorDescription({ body: { message: 'Class is full' } })).toBe('Class is full');
    expect(errorDescription(undefined)).toBeUndefined();
  });
});

describe(enhanceForm.name, () => {
  it('passes the result on success', async () => {
    const { form, submit } = fakeForm({ result: 'done' });
    const on = handlers();
    enhanceForm(form, on);

    await submit();

    expect(on.onSuccess).toHaveBeenCalledWith('done');
    expect(on.onIssue).not.toHaveBeenCalled();
  });

  it('reports the first validation issue', async () => {
    const { form, submit } = fakeForm({ issues: ['Name is required', 'Email is required'] });
    const on = handlers();
    enhanceForm(form, on);

    await submit();

    expect(on.onIssue).toHaveBeenCalledWith('Name is required');
    expect(on.onSuccess).not.toHaveBeenCalled();
  });

  it('reports a failed submission', async () => {
    const failure = new Error('offline');
    const { form, submit } = fakeForm({ fails: failure });
    const on = handlers();
    enhanceForm(form, on);

    await submit();

    expect(on.onError).toHaveBeenCalledWith(failure);
    expect(on.onSuccess).not.toHaveBeenCalled();
  });
});

describe(enhanceWithToast.name, () => {
  it('toasts success and calls back', async () => {
    const { form, submit } = fakeForm({});
    const onSuccess = vi.fn();
    enhanceWithToast(form, MESSAGES, onSuccess);

    await submit();

    expect(toast.success).toHaveBeenCalledWith('Saved');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('toasts validation issues and server errors under the error title', async () => {
    const invalid = fakeForm({ issues: ['Name is required'] });
    enhanceWithToast(invalid.form, MESSAGES);
    await invalid.submit();

    const failed = fakeForm({ fails: { body: { message: 'Server down' } } });
    enhanceWithToast(failed.form, MESSAGES);
    await failed.submit();

    expect(toast.error).toHaveBeenCalledWith('Failed to save', { description: 'Name is required' });
    expect(toast.error).toHaveBeenCalledWith('Failed to save', { description: 'Server down' });
    expect(toast.success).not.toHaveBeenCalled();
  });
});
