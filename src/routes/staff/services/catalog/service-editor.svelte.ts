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
import * as v from 'valibot';

const FIELD_ID_LENGTH = 8;

/** Choices and file types are edited as comma separated text and split on save. */
export type EditableField = Omit<ServiceField, 'options' | 'fileTypes' | 'maxUploadMB'> & {
  options: string;
  fileTypes: string;
  /** Null while the number input is empty. */
  maxUploadMB: number | null;
};

/** Creates or edits a service and the fields of its request form. */
export class ServiceEditor {
  name = $state('');
  description = $state('');
  pricingMode = $state<ServicePricing>(SERVICE_PRICING.FIXED);
  price = $state(0);
  enabled = $state(true);
  fields = $state<EditableField[]>([]);
  saving = $state(false);
  showErrors = $state(false);

  readonly isNew: boolean;

  private serviceId?: string;

  // Same schema as the server, so both report the same problems.
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

  /** The error at a path like `name`, `fields` or `fields.0.label`, once a save was tried. */
  error(path: string) {
    if (!this.showErrors) return undefined;
    return this.issues.find((issue) => {
      const issuePath = v.getDotPath(issue);
      return issuePath === path || (path !== 'fields' && issuePath?.startsWith(`${path}.`));
    })?.message;
  }

  addField() {
    this.fields.push({
      id: `f${crypto.randomUUID().slice(0, FIELD_ID_LENGTH)}`,
      label: '',
      type: SERVICE_FIELD_TYPE.TEXT,
      required: false,
      options: '',
      fileTypes: '',
      maxUploadMB: MAX_SERVICE_UPLOAD_MB,
    });
  }

  removeField(index: number) {
    this.fields.splice(index, 1);
  }

  moveField(index: number, offset: -1 | 1) {
    const [field] = this.fields.splice(index, 1);
    this.fields.splice(index + offset, 0, field);
  }

  async save() {
    if (this.saving) return false;
    if (this.issues.length > 0) {
      this.showErrors = true;
      await tick();
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
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
      price: this.price,
      enabled: this.enabled,
      fields: this.fields.map((field) => this.toField(field)),
    };
  }

  private toField(field: EditableField): ServiceField {
    const base = { ...field, options: this.choices(field) };
    if (field.type !== SERVICE_FIELD_TYPE.FILE) {
      return { ...base, fileTypes: undefined, maxUploadMB: undefined };
    }
    return {
      ...base,
      fileTypes: parseFileExtensions(field.fileTypes),
      // NaN fails the schema, so an empty size shows an error instead of a default.
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
