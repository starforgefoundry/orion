import { goto } from '$app/navigation';
import type { PrintRequestFileDto } from '$lib/remotes/dtos/print_request.dto';
import { submitPrintRequestForm } from '$lib/remotes/endpoints/print_request.remote';
import { toast } from 'svelte-sonner';

export const STEPS = { CONTACT: 'contact', PROJECT: 'project' } as const;
export type Step = (typeof STEPS)[keyof typeof STEPS];

const BYTES_PER_MB = 1024 * 1024;
const PERCENT = 100;
const HTTP_OK = 200;
const SUCCESS_PATH = '/print_request/form/success';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SubmitParameters = Parameters<Parameters<typeof submitPrintRequestForm.enhance>[0]>[0];

export class PrintRequestFormManager {
  step = $state<Step>(STEPS.CONTACT);
  files = $state<PrintRequestFileDto[]>([]);
  isQuote = $state(false);
  material = $state('');
  submitting = $state(false);
  progress = $state(0);

  #maxUploadMB: number;

  constructor(maxUploadMB: number) {
    this.#maxUploadMB = maxUploadMB;
  }

  get totalBytes() {
    return this.files.reduce((total, entry) => total + entry.file.size, 0);
  }

  get exceedsSizeLimit() {
    return this.totalBytes > this.#maxUploadMB * BYTES_PER_MB;
  }

  get contactValid() {
    const { name, email } = submitPrintRequestForm.fields.customer;
    return name.value()?.trim().length > 0 && EMAIL_PATTERN.test(email.value()?.trim() ?? '');
  }

  get canSubmit() {
    const projectName = submitPrintRequestForm.fields.projectName.value()?.trim() ?? '';
    return (
      this.files.length > 0 &&
      !this.exceedsSizeLimit &&
      this.material !== '' &&
      projectName.length > 0 &&
      !this.submitting
    );
  }

  next() {
    if (this.contactValid) this.step = STEPS.PROJECT;
  }

  back() {
    this.step = STEPS.CONTACT;
  }

  addFile(file: File) {
    this.files.push({ file, filename: file.name, quantity: 1 });
  }

  removeFile(index: number) {
    this.files.splice(index, 1);
  }

  setQuantity(index: number, quantity: number) {
    this.files[index].quantity = quantity;
  }

  /** Posts with XHR instead of fetch so upload progress can be shown for large models. */
  submit({ form }: SubmitParameters) {
    this.submitting = true;
    this.progress = 0;

    const xhr = new XMLHttpRequest();
    xhr.open(form.method, form.action, true);
    xhr.setRequestHeader('Accept', 'text/html');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        this.progress = Math.round((event.loaded / event.total) * PERCENT);
      }
    };

    const fail = () => {
      this.submitting = false;
      this.progress = 0;
      toast.error('Failed to submit print request. Please try again later.');
    };

    xhr.onload = () => {
      if (xhr.status !== HTTP_OK) return fail();
      this.submitting = false;
      this.progress = PERCENT;
      goto(SUCCESS_PATH);
    };
    xhr.onerror = fail;

    xhr.send(new FormData(form));
  }
}
