import { uploadForm } from '$lib/frontend/upload-form';
import {
  addPrintRequestCommentForm,
  getPrintRequestComments,
} from '$lib/remotes/endpoints/print-request.remote';
import { toast } from 'svelte-sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentComposer } from './comment-composer.svelte';

vi.mock('$lib/frontend/upload-form', () => ({ uploadForm: vi.fn() }));
vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));
vi.mock('$lib/remotes/endpoints/print-request.remote', () => ({
  getPrintRequestComments: vi.fn(),
  addPrintRequestCommentForm: {
    fields: {
      body: { value: vi.fn(), set: vi.fn() },
      printRequestId: { value: vi.fn() },
    },
  },
}));

const REQUEST_ID = 'request-1';
const OTHER_REQUEST_ID = 'request-2';
const FORM = { method: 'post', action: '/staff/print_requests/queue' } as HTMLFormElement;

const fields = vi.mocked(addPrintRequestCommentForm.fields, { deep: true });
const refresh = vi.fn();

type Upload = { progress: (percent: number) => void; finish: () => void; fail: () => void };

/** Holds the next upload open so a test can act while it is in flight. */
function holdUpload(): Upload {
  const upload = {} as Upload;
  vi.mocked(uploadForm).mockImplementationOnce(
    (_request, onProgress) =>
      new Promise<void>((resolve, reject) => {
        upload.progress = onProgress;
        upload.finish = resolve;
        upload.fail = () => reject(new Error('offline'));
      }),
  );
  return upload;
}

function draftComment(body: string, openRequestId = REQUEST_ID) {
  fields.body.value.mockReturnValue(body);
  fields.printRequestId.value.mockReturnValue(openRequestId);
}

beforeEach(() => {
  vi.stubGlobal('FormData', class {});
  refresh.mockResolvedValue(undefined);
  vi.mocked(getPrintRequestComments).mockReturnValue({ refresh } as never);
  draftComment('Needs supports');
});

describe(CommentComposer.name, () => {
  it('reports progress, then clears the draft and reloads comments', async () => {
    const composer = new CommentComposer(() => REQUEST_ID);
    const upload = holdUpload();

    const posting = composer.submit(FORM);
    upload.progress(40);
    expect(composer.progress).toBe(40);
    expect(composer.canPost).toBe(false);

    upload.finish();
    await posting;

    expect(composer.submitting).toBe(false);
    expect(fields.body.set).toHaveBeenCalledWith('');
    expect(refresh).toHaveBeenCalled();
  });

  it('blocks a second composer for the same request while an upload runs', async () => {
    const first = new CommentComposer(() => REQUEST_ID);
    const reopened = new CommentComposer(() => REQUEST_ID);
    const upload = holdUpload();

    const posting = first.submit(FORM);
    await reopened.submit(FORM);
    reopened.addFiles([new File(['x'], 'late.stl')]);

    expect(uploadForm).toHaveBeenCalledTimes(1);
    expect(reopened.attachments).toEqual([]);

    upload.finish();
    await posting;
  });

  it('swallows file drops while an upload runs so the browser does not open them', async () => {
    const composer = new CommentComposer(() => REQUEST_ID);
    const upload = holdUpload();
    const posting = composer.submit(FORM);

    const dataTransfer = { types: ['Files'], files: [new File(['x'], 'late.png')], dropEffect: '' };
    const drag = () => ({ dataTransfer, preventDefault: vi.fn() }) as unknown as DragEvent;
    const over = drag();
    const drop = drag();
    composer.handleDragOver(over);
    composer.handleDrop(drop);

    expect(over.preventDefault).toHaveBeenCalled();
    expect(drop.preventDefault).toHaveBeenCalled();
    expect(dataTransfer.dropEffect).toBe('none');
    expect(composer.attachments).toEqual([]);

    upload.finish();
    await posting;
  });

  it('keeps the draft of a request opened while the upload ran', async () => {
    const composer = new CommentComposer(() => REQUEST_ID);
    const upload = holdUpload();

    const posting = composer.submit(FORM);
    draftComment('Other note', OTHER_REQUEST_ID);
    upload.finish();
    await posting;

    expect(fields.body.set).not.toHaveBeenCalled();
  });

  it('keeps the draft and unlocks when the upload fails', async () => {
    const composer = new CommentComposer(() => REQUEST_ID);
    const upload = holdUpload();

    const posting = composer.submit(FORM);
    upload.fail();
    await posting;

    expect(composer.submitting).toBe(false);
    expect(fields.body.set).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('unlocks when the comment saved but the list failed to reload', async () => {
    const composer = new CommentComposer(() => REQUEST_ID);
    const upload = holdUpload();
    refresh.mockRejectedValue(new Error('offline'));

    const posting = composer.submit(FORM);
    upload.finish();
    await posting;

    expect(composer.submitting).toBe(false);
    expect(toast.warning).toHaveBeenCalled();
  });

  it('does not post a blank comment', async () => {
    draftComment('   ');
    const composer = new CommentComposer(() => REQUEST_ID);

    await composer.submit(FORM);

    expect(uploadForm).not.toHaveBeenCalled();
  });
});
