import { submitWithToast } from '$lib/frontend/form-submit';
import { upsertServiceDto, type UpsertServiceDto } from '$lib/remotes/dtos/service.dto';
import { upsertService } from '$lib/remotes/endpoints/service.remote';
import type { Service } from '$lib/server/db/schema';
import { parseFileExtensions } from '$lib/utils/print-request';
import {
  MAX_SERVICE_UPLOAD_MB,
  SERVICE_FIELD_TYPE,
  SERVICE_PRICING,
  type ServiceField,
  type ServicePricing,
} from '$lib/utils/services';
import { tick } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { toast } from 'svelte-sonner';
import * as v from 'valibot';

const FIELD_ID_LENGTH = 8;

export const ADD_FIELD_ID = 'service-add-field';

/** Choices and file types are edited as comma separated text and split on save. */
export type EditableField = Omit<ServiceField, 'options' | 'fileTypes' | 'maxUploadMB'> & {
  options: string;
  fileTypes: string;
  /** Null while the number input is empty. */
  maxUploadMB: number | null;
};

/** Ids of a field card's inputs, so errors can point at them. */
export function fieldInputId(
  field: EditableField,
  key: 'label' | 'options' | 'fileTypes' | 'maxUploadMB' | 'up' | 'down',
) {
  return `field-${field.id}-${key}`;
}

/** Creates or edits a service and the fields of its request form. */
export class ServiceEditor {
  name = $state('');
  description = $state('');
  pricingMode = $state<ServicePricing>(SERVICE_PRICING.FIXED);
  price = $state(0);
  enabled = $state(true);
  fields = $state<EditableField[]>([]);
  saving = $state(false);
  /** Errors show once staff try to save, then follow their edits. */
  showErrors = $state(false);
  /** A field's errors show once a save checked it or staff left it, so new fields start clean. */
  private checkedFields = new SvelteSet<string>();

  readonly isNew: boolean;

  private serviceId?: string;

  // Checked with the server's own schema so both report the same problems.
  private issues = $derived(v.safeParse(upsertServiceDto, this.payload).issues ?? []);

  constructor(service?: Service) {
    this.isNew = !service;
    this.serviceId = service?.id;
    this.name = service?.name ?? '';
    this.description = service?.description ?? '';
    this.pricingMode = service?.pricingMode ?? SERVICE_PRICING.FIXED;
    this.price = service?.price ?? 0;
    this.enabled = service?.enabled ?? true;
    this.fields = (service?.fields ?? []).map((field) => ({
      ...field,
      options: field.options.join(', '),
      fileTypes: (field.fileTypes ?? []).join(', '),
      maxUploadMB: field.maxUploadMB ?? MAX_SERVICE_UPLOAD_MB,
    }));
  }

  /** The error for a path like `name` or `fields.0.label`, once errors show. */
  error(path: string) {
    const [key, index] = path.split('.');
    const field = key === 'fields' ? this.fields[Number(index)] : undefined;
    if (!this.showErrors || (field && !this.checkedFields.has(field.id))) return undefined;
    return this.issues.find((issue) => v.getDotPath(issue)?.startsWith(path))?.message;
  }

  /** Shows a field's errors, or hides them again, e.g. after its type changes. */
  checkField(field: EditableField, checked = true) {
    if (checked) this.checkedFields.add(field.id);
    else this.checkedFields.delete(field.id);
  }

  /** Enter in a field label moves to the next label, adding a field after the last. */
  nextLabel(index: number) {
    const next = this.fields[index + 1];
    if (next) document.getElementById(fieldInputId(next, 'label'))?.focus();
    else void this.addField();
  }

  async addField() {
    const field: EditableField = {
      id: `f${crypto.randomUUID().slice(0, FIELD_ID_LENGTH)}`,
      label: '',
      type: SERVICE_FIELD_TYPE.TEXT,
      required: false,
      options: '',
      fileTypes: '',
      maxUploadMB: MAX_SERVICE_UPLOAD_MB,
    };
    this.fields.push(field);
    await tick();
    // Focusing also scrolls the new card into view.
    document.getElementById(fieldInputId(field, 'label'))?.focus();
  }

  /** Focus moves to the field that took its place, else the one before, else Add Field. */
  async removeField(index: number) {
    this.fields.splice(index, 1);
    const field = this.fields[index] ?? this.fields[index - 1];
    await tick();
    document.getElementById(field ? fieldInputId(field, 'label') : ADD_FIELD_ID)?.focus();
  }

  /** Moves a field one place up (-1) or down (1). */
  async moveField(index: number, offset: -1 | 1) {
    const [field] = this.fields.splice(index, 1);
    const target = index + offset;
    this.fields.splice(target, 0, field);
    // At either end the pressed button disables, so focus moves to the opposite one.
    const atEnd = offset === -1 ? target === 0 : target === this.fields.length - 1;
    const up = (offset === -1) !== atEnd;
    await tick();
    document.getElementById(fieldInputId(field, up ? 'up' : 'down'))?.focus();
  }

  async save() {
    if (this.saving) return false;
    if (this.issues.length > 0) {
      this.showErrors = true;
      for (const field of this.fields) this.checkedFields.add(field.id);
      this.focusFirstIssue();
      return false;
    }

    this.saving = true;
    const saved = await submitWithToast(() => upsertService(this.payload), {
      success: 'Service saved',
      error: 'Failed to save service',
    });
    this.saving = false;
    return saved;
  }

  private get payload(): UpsertServiceDto {
    return {
      id: this.serviceId,
      name: this.name,
      description: this.description,
      pricingMode: this.pricingMode,
      // A variable price is quoted per request; the typed one stays in case staff switch back.
      price: this.pricingMode === SERVICE_PRICING.FIXED ? this.price : 0,
      enabled: this.enabled,
      fields: this.fields.map((field) => this.toField(field)),
    };
  }

  /** Focuses the topmost input with a problem, since list checks report after field ones. */
  private async focusFirstIssue() {
    await tick();
    const [input] = this.issues
      .map((issue) => document.getElementById(this.issueInputId(issue)))
      .filter((input) => input !== null)
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    if (input) input.focus();
    else toast.error('Failed to save service', { description: this.issues[0].message });
  }

  private issueInputId(issue: v.BaseIssue<unknown>) {
    const [key, index, fieldKey] = (v.getDotPath(issue) ?? '').split('.');
    const field = this.fields[Number(index)];
    return key === 'fields' && field
      ? fieldInputId(field, fieldKey as Parameters<typeof fieldInputId>[1])
      : `service-${key}`;
  }

  private toField(field: EditableField): ServiceField {
    const base = { ...field, options: this.choices(field) };
    if (field.type !== SERVICE_FIELD_TYPE.FILE) {
      return { ...base, fileTypes: undefined, maxUploadMB: undefined };
    }
    return {
      ...base,
      fileTypes: parseFileExtensions(field.fileTypes),
      // NaN fails the schema's number check, so an empty size is reported instead of defaulted.
      maxUploadMB: field.maxUploadMB ?? NaN,
    };
  }

  private choices(field: EditableField) {
    if (field.type !== SERVICE_FIELD_TYPE.SELECT) return [];

    return field.options
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean);
  }
}
