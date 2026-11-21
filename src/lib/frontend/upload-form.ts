const PERCENT = 100;
const HTTP_OK = 200;

export type UploadRequest = {
  method: string;
  action: string;
  body: FormData;
};

export class UploadError extends Error {
  constructor(readonly status: number) {
    super(`Upload failed with status ${status}`);
  }
}

/** Posts with XHR instead of fetch because fetch cannot report upload progress. */
export function uploadForm(request: UploadRequest, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(request.method, request.action, true);
    xhr.setRequestHeader('Accept', 'text/html');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * PERCENT));
    };

    xhr.onload = () => {
      if (xhr.status !== HTTP_OK) return reject(new UploadError(xhr.status));
      onProgress(PERCENT);
      resolve();
    };
    xhr.onerror = () => reject(new UploadError(xhr.status));

    xhr.send(request.body);
  });
}
