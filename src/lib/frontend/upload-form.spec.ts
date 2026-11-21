import { describe, expect, it, vi } from 'vitest';
import { UploadError, uploadForm } from './upload-form';

class FakeXhr {
  static last: FakeXhr;

  status = 0;
  upload: { onprogress?: (event: Partial<ProgressEvent>) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();

  constructor() {
    FakeXhr.last = this;
  }

  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  finish(status: number) {
    this.status = status;
    this.onload?.();
  }
}

function startUpload() {
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  const onProgress = vi.fn();
  const body = new FormData();
  const done = uploadForm({ method: 'POST', action: '/comments', body }, onProgress);
  return { xhr: FakeXhr.last, onProgress, body, done };
}

describe(uploadForm.name, () => {
  it('posts the form body and reports progress as a percentage', async () => {
    const { xhr, onProgress, body, done } = startUpload();

    xhr.progress(1, 3);
    xhr.finish(200);
    await done;

    expect(xhr.open).toHaveBeenCalledWith('POST', '/comments', true);
    expect(xhr.send).toHaveBeenCalledWith(body);
    expect(onProgress.mock.calls).toEqual([[33], [100]]);
  });

  it('rejects when the server responds with an error', async () => {
    const { xhr, done } = startUpload();

    xhr.finish(403);

    await expect(done).rejects.toEqual(new UploadError(403));
  });

  it('rejects when the network fails', async () => {
    const { xhr, done } = startUpload();

    xhr.onerror?.();

    await expect(done).rejects.toBeInstanceOf(UploadError);
  });
});
