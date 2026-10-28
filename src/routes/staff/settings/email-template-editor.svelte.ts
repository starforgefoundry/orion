import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { updateEmailTemplate } from '$lib/remotes/endpoints/email_template.remote';
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  exampleVariables,
  renderTemplate,
  unknownVariables,
  variableToken,
  type EmailTemplateKey,
  type TemplateVariable,
} from '$lib/utils/email_templates';
import { tick } from 'svelte';

export const TEMPLATE_FIELD = {
  SUBJECT: 'subject',
  BODY: 'body',
} as const;
export type TemplateField = (typeof TEMPLATE_FIELD)[keyof typeof TEMPLATE_FIELD];

export type StoredTemplate = { key: EmailTemplateKey; subject: string; body: string };
type TextField = HTMLInputElement | HTMLTextAreaElement;

export class EmailTemplateEditor {
  readonly key: EmailTemplateKey;
  readonly definition;
  readonly variables: (TemplateVariable & { name: string; token: string })[];
  private readonly saved: StoredTemplate;
  private readonly examples: Record<string, string>;

  subject = $state('');
  body = $state('');
  isSaving = $state(false);
  fields: Record<TemplateField, TextField | null> = $state({
    [TEMPLATE_FIELD.SUBJECT]: null,
    [TEMPLATE_FIELD.BODY]: null,
  });
  private lastFocused: TemplateField = TEMPLATE_FIELD.BODY;

  readonly unknown = $derived.by(() => unknownVariables(this.key, `${this.subject}\n${this.body}`));
  readonly isDirty = $derived.by(
    () => this.subject !== this.saved.subject || this.body !== this.saved.body,
  );
  readonly canSave = $derived(
    this.isDirty && !this.isSaving && this.unknown.length === 0 && !!this.subject && !!this.body,
  );
  readonly preview = $derived.by(() => ({
    subject: renderTemplate(this.subject, this.examples),
    body: renderTemplate(this.body, this.examples),
  }));

  constructor(template: StoredTemplate) {
    this.key = template.key;
    this.saved = template;
    this.subject = template.subject;
    this.body = template.body;
    this.definition = EMAIL_TEMPLATE_DEFINITIONS[template.key];
    this.examples = exampleVariables(template.key);
    const variables: Record<string, TemplateVariable> = this.definition.variables;
    this.variables = Object.entries(variables).map(([name, variable]) => ({
      ...variable,
      name,
      token: variableToken(name),
    }));
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
