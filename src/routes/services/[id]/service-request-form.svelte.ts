import { submitServiceRequestDto } from '$lib/remotes/dtos/service.dto';
import type { submitServiceRequestForm } from '$lib/remotes/endpoints/service.remote';
import { fileProblem, type ServiceField } from '$lib/utils/services';
import { toast } from 'svelte-sonner';
import * as v from 'valibot';

export const STEPS = { CONTACT: 'contact', DETAILS: 'details' } as const;
export type Step = (typeof STEPS)[keyof typeof STEPS];

type RequestForm = ReturnType<typeof submitServiceRequestForm.for>;

/** Step and custom input values of a service request. HiddenField puts the values in the form. */
export class ServiceRequestForm {
  step = $state<Step>(STEPS.CONTACT);
  choices = $state<Record<string, string>>({});
  checks = $state<Record<string, boolean>>({});
  files = $state<Record<string, File | undefined>>({});
  error = $state('');
  private submitted = false;

  constructor(private readonly form: () => RequestForm) {}

  /** Errors first show on submit, then follow every edit. */
  submitting() {
    this.submitted = true;
  }

  edited() {
    this.revalidate();
  }

  get contactValid() {
    const { customerName, email } = this.form().fields;
    const { entries } = submitServiceRequestDto;
    return (
      v.is(entries.customerName, customerName.value() ?? '') &&
      v.is(entries.email, email.value() ?? '')
    );
  }

  next() {
    if (this.contactValid) this.step = STEPS.DETAILS;
  }

  back() {
    this.step = STEPS.CONTACT;
  }

  choose(field: ServiceField, value: string) {
    this.choices[field.id] = value;
    this.revalidate();
  }

  check(field: ServiceField, checked: boolean) {
    this.checks[field.id] = checked;
    this.revalidate();
  }

  pickFile(field: ServiceField, file: File) {
    const problem = fileProblem(field, file);
    if (problem) {
      toast.error(problem);
      return;
    }
    this.files[field.id] = file;
    this.revalidate();
  }

  removeFile(field: ServiceField) {
    this.files[field.id] = undefined;
    this.revalidate();
  }

  // Selects, checkboxes and files don't fire input events, so their errors refresh here.
  private revalidate() {
    if (this.submitted) void this.form().validate({ preflightOnly: true });
  }
}
