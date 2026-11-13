import { submitWithToast } from '$lib/frontend/form-submit';
import { upsertService } from '$lib/remotes/endpoints/service.remote';
import type { Service } from '$lib/server/db/schema';
import {
  SERVICE_FIELD_TYPE,
  SERVICE_PRICING,
  type ServiceField,
  type ServicePricing,
} from '$lib/utils/services';

const FIELD_ID_LENGTH = 8;

/** Choices are edited as comma separated text and split on save. */
export type EditableField = Omit<ServiceField, 'options'> & { options: string };

/** Creates or edits a service and the fields of its request form. */
export class ServiceEditor {
  name = $state('');
  description = $state('');
  pricingMode = $state<ServicePricing>(SERVICE_PRICING.FIXED);
  price = $state(0);
  enabled = $state(true);
  fields = $state<EditableField[]>([]);
  saving = $state(false);

  readonly isNew: boolean;

  private serviceId?: string;

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
    }));
  }

  get canSave() {
    return this.name.trim() !== '' && this.description.trim() !== '' && !this.saving;
  }

  addField() {
    this.fields.push({
      id: `f${crypto.randomUUID().slice(0, FIELD_ID_LENGTH)}`,
      label: '',
      type: SERVICE_FIELD_TYPE.TEXT,
      required: false,
      options: '',
    });
  }

  removeField(index: number) {
    this.fields.splice(index, 1);
  }

  async save() {
    if (!this.canSave) return false;

    this.saving = true;
    const saved = await submitWithToast(
      () =>
        upsertService({
          id: this.serviceId,
          name: this.name,
          description: this.description,
          pricingMode: this.pricingMode,
          price: this.price,
          enabled: this.enabled,
          fields: this.fields.map((field) => ({ ...field, options: this.choices(field) })),
        }),
      { success: 'Service saved', error: 'Failed to save service' },
    );
    this.saving = false;
    return saved;
  }

  private choices(field: EditableField) {
    if (field.type !== SERVICE_FIELD_TYPE.SELECT) return [];

    return field.options
      .split(',')
      .map((option) => option.trim())
      .filter(Boolean);
  }
}
