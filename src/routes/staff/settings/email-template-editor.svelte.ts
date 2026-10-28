import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { updateEmailTemplate } from '$lib/remotes/endpoints/email_template.remote';
import type { EmailTemplate } from '$lib/server/db/schema';
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  renderTemplate,
  templateVariables,
  unknownVariables,
} from '$lib/utils/email_templates';
import { tick } from 'svelte';

export const TEMPLATE_FIELD = {
  SUBJECT: 'subject',
  BODY: 'body',
} as const;
export type TemplateField = (typeof TEMPLATE_FIELD)[keyof typeof TEMPLATE_FIELD];

type TextField = HTMLInputElement | HTMLTextAreaElement;

export class EmailTemplateEditor {
  readonly variables;
  private readonly saved: EmailTemplate;

  subject = $state('');
  body = $state('');
  isSaving = $state(false);
  fields: Record<TemplateField, TextField | null> = $state({
    [TEMPLATE_FIELD.SUBJECT]: null,
    [TEMPLATE_FIELD.BODY]: null,
  });
  private lastFocused: TemplateField = TEMPLATE_FIELD.BODY;

  readonly unknown = $derived.by(() =>
    unknownVariables(this.key, { subject: this.subject, body: this.body }),
  );
  readonly isDirty = $derived.by(
    () => this.subject !== this.saved.subject || this.body !== this.saved.body,
  );
  readonly canSave = $derived(
    this.isDirty && !this.isSaving && this.unknown.length === 0 && !!this.subject && !!this.body,
  );
  readonly preview = $derived.by(() => {
    const examples = Object.fromEntries(this.variables.map(({ name, example }) => [name, example]));
    return {
      subject: renderTemplate(this.subject, examples),
      body: renderTemplate(this.body, examples),
    };
  });

  constructor(template: EmailTemplate) {
    this.saved = template;
    this.subject = template.subject;
    this.body = template.body;
    this.variables = templateVariables(template.key);
  }

  get key() {
    return this.saved.key;
  }

  get definition() {
    return EMAIL_TEMPLATE_DEFINITIONS[this.key];
  }

  focus(field: TemplateField) {
    this.lastFocused = field;
  }

  async insert(token: string) {
    const field = this.lastFocused;
    const element = this.fields[field];
    const value = this[field];
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;

    this[field] = value.slice(0, start) + token + value.slice(end);

    await tick();
    const cursor = start + token.length;
    element?.focus();
    element?.setSelectionRange(cursor, cursor);
  }

  /** Resolves true once the changes are saved. */
  async save() {
    this.isSaving = true;
    const ok = await submitWithToast(
      () => updateEmailTemplate({ key: this.key, subject: this.subject, body: this.body }),
      { success: `${this.definition.name} template saved`, error: 'Error saving template' },
    );
    this.isSaving = false;
    return ok;
  }

  async confirmDiscard() {
    if (!this.isDirty) return true;
    return await modalManager.confirm({
      title: 'Discard changes?',
      prompt: `Your edits to ${this.definition.name} have not been saved.`,
      confirmText: 'Discard',
      variant: 'destructive',
    });
  }
}
