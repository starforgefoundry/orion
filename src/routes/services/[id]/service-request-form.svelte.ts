import { submitServiceRequestDto } from '$lib/remotes/dtos/service.dto';
import type { submitServiceRequestForm } from '$lib/remotes/endpoints/service.remote';
import { answerProblem, fileProblem, type ServiceField } from '$lib/utils/services';
import { tick } from 'svelte';
import * as v from 'valibot';

type RequestForm = ReturnType<typeof submitServiceRequestForm.for>;

export const NAME_ID = 'customer-name';
export const EMAIL_ID = 'customer-email';

export function answerInputId(field: ServiceField) {
  return `answer-${field.id}`;
}

function schemaProblem(schema: v.GenericSchema, value: unknown) {
  return v.safeParse(schema, value ?? '').issues?.[0].message;
}

/** Holds a service request form's widget values and checks it with the server's rules. */
export class ServiceRequestForm {
  // Selects and checkboxes hold their value here; HiddenField puts it in the form.
  choices = $state<Record<string, string>>({});
  checks = $state<Record<string, boolean>>({});
  /** Shown when the server rejects a submission the checks here let through. */
  submitError = $state('');
  /** Errors show once the customer tries to submit, then follow their edits. */
  private submitted = $state(false);
  private fileErrors = $state<Record<string, string | undefined>>({});
  /** Number inputs, by id, holding text the browser can't read, such as `1e`. */
  private unreadableNumbers = $state<Record<string, boolean>>({});

  constructor(readonly form: RequestForm) {}

  /** Runs on every input event in the form, since any edit makes a server error stale. */
  edited(event: Event) {
    this.submitError = '';
    const input = event.target;
    if (input instanceof HTMLInputElement && input.type === 'number') {
      this.unreadableNumbers[input.id] = input.validity.badInput;
    }
  }

  choose(field: ServiceField, value: string) {
    this.choices[field.id] = value;
    this.submitError = '';
  }

  check(field: ServiceField, checked: boolean) {
    this.checks[field.id] = checked;
    this.submitError = '';
  }

  get nameError() {
    if (!this.submitted) return undefined;
    const { customerName } = submitServiceRequestDto.entries;
    return schemaProblem(customerName, this.form.fields.customerName.value());
  }

  get emailError() {
    if (!this.submitted) return undefined;
    return schemaProblem(submitServiceRequestDto.entries.email, this.form.fields.email.value());
  }

  answerError(field: ServiceField) {
    if (this.fileErrors[field.id]) return this.fileErrors[field.id];
    if (!this.submitted) return undefined;
    // The browser reports unreadable number text as '', so it is checked as NaN instead.
    const unreadable = this.unreadableNumbers[answerInputId(field)];
    return answerProblem(field, unreadable ? NaN : this.form.fields.answers[field.id].value());
  }

  pickFile(field: ServiceField, file: File) {
    const problem = fileProblem(field, file);
    this.fileErrors[field.id] = problem;
    this.submitError = '';
    if (!problem) this.form.fields.answers[field.id].set(file);
  }

  removeFile(field: ServiceField) {
    this.form.fields.answers[field.id].set('');
    this.submitError = '';
  }

  /** Shows every error and focuses the first. Returns whether the form can be sent. */
  validate(fields: ServiceField[]) {
    this.submitted = true;
    this.submitError = '';
    const invalid = [
      this.nameError && NAME_ID,
      this.emailError && EMAIL_ID,
      ...fields.map((field) => this.answerError(field) && answerInputId(field)),
    ].find(Boolean);
    if (!invalid) return true;

    void tick().then(() => document.getElementById(invalid)?.focus());
    return false;
  }
}
