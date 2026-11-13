import type {
  QuoteServiceRequestDto,
  SubmitServiceRequestDto,
  UpdateServiceRequestStatusDto,
  UpsertServiceDto,
} from '$lib/remotes/dtos/service.dto';
import { NotFoundError, UserError } from '$lib/errors';
import { BaseService } from '$lib/server/services/base.service';
import { fileUrl } from '$lib/server/utils/storage';
import {
  answersProblem,
  canQuote,
  formAnswers,
  SERVICE_FIELD_TYPE,
  SERVICE_PRICING,
  SERVICE_REQUEST_STATUS,
  type ServiceAnswers,
} from '$lib/utils/services';
import { posix } from 'node:path';

const SERVICE_NOT_FOUND_MESSAGE = 'Service not found';
const REQUEST_NOT_FOUND_MESSAGE = 'Service request not found';

export class ServiceRequestError extends UserError {}

export class ServiceService extends BaseService {
  // ── Catalog ──

  async upsertService({ id, ...fields }: UpsertServiceDto) {
    // Variable services are priced per request, so a stray fixed price is dropped.
    const data = {
      ...fields,
      price: fields.pricingMode === SERVICE_PRICING.FIXED ? fields.price : 0,
    };
    if (!id) return await this.serviceRepository.create(data);

    const updated = await this.serviceRepository.update(id, data);
    if (!updated) throw new NotFoundError(SERVICE_NOT_FOUND_MESSAGE);
    return updated;
  }

  async getAllServices() {
    return await this.serviceRepository.getAll();
  }

  async getEnabledServices() {
    return await this.serviceRepository.getEnabled();
  }

  /** Disabled services are hidden from the public form. */
  async getEnabledService(id: string) {
    const service = await this.serviceRepository.getById(id);
    return service?.enabled ? service : null;
  }

  // ── Request ──

  async submitRequest(dto: SubmitServiceRequestDto) {
    const service = await this.getEnabledService(dto.serviceId);
    if (!service) throw new NotFoundError('This service is not available');

    const submitted = dto.answers ?? {};
    const problem = answersProblem(service.fields, submitted);
    if (problem) throw new ServiceRequestError(problem);

    // Files are stored under the request's id, so the id is chosen before the insert.
    const requestId = crypto.randomUUID();
    const answers: ServiceAnswers = {};
    for (const [fieldId, answer] of Object.entries(formAnswers(service.fields, submitted))) {
      answers[fieldId] =
        answer instanceof File
          ? await this.serviceRepository.uploadRequestFile(requestId, fieldId, answer)
          : answer;
    }

    const request = await this.serviceRepository.createRequest({
      id: requestId,
      serviceId: service.id,
      customerName: dto.customerName,
      email: dto.email,
      answers,
      price: service.pricingMode === SERVICE_PRICING.FIXED ? service.price : null,
      status: SERVICE_REQUEST_STATUS.SUBMITTED,
    });
    return { pricingMode: service.pricingMode, price: request.price };
  }

  async getRequests() {
    const rows = await this.serviceRepository.getRequests();
    // File answers are storage keys; staff get a signed link and the original file name.
    return rows.map((row) => ({
      ...row,
      files: Object.fromEntries(
        row.fields
          .filter((field) => field.type === SERVICE_FIELD_TYPE.FILE)
          .flatMap((field) => {
            const key = row.request.answers[field.id];
            return typeof key === 'string'
              ? [[field.id, { name: posix.basename(key), url: fileUrl(key) }]]
              : [];
          }),
      ),
    }));
  }

  private async requireRequest(id: string) {
    const request = await this.serviceRepository.getRequestById(id);
    if (!request) throw new NotFoundError(REQUEST_NOT_FOUND_MESSAGE);
    return request;
  }

  async updateRequestStatus({ id, status }: UpdateServiceRequestStatusDto) {
    const request = await this.requireRequest(id);
    // Only sending a quote moves a request to quoted.
    if (status === SERVICE_REQUEST_STATUS.QUOTED && request.status !== status) {
      throw new ServiceRequestError('Send a quote to mark this request as quoted.');
    }
    return await this.serviceRepository.updateRequest(id, { status });
  }

  async quoteRequest({ id, price }: QuoteServiceRequestDto) {
    const request = await this.requireRequest(id);
    if (!canQuote(request)) {
      throw new ServiceRequestError('Only requests waiting for a quote can be quoted.');
    }
    return await this.serviceRepository.updateRequest(id, {
      price,
      status: SERVICE_REQUEST_STATUS.QUOTED,
    });
  }
}

export const serviceService = new ServiceService();
