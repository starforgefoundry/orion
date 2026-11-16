import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { saveFile } from '$lib/server/utils/storage';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import type { EnumValue } from '$lib/utils/enum';
import { SERVICE_REQUEST_STATUS, storageFileName } from '$lib/utils/services';
import { and, desc, eq, inArray, isNull, lte, type InferInsertModel } from 'drizzle-orm';
import type { DateTime } from 'luxon';

/** Each automatic reminder a request gets, named by the column that records it was sent. */
export const SERVICE_REMINDER = {
  PICKUP: 'pickupReminderSentDate',
  PAYMENT: 'paymentReminderSentDate',
} as const;
export type ServiceReminder = EnumValue<typeof SERVICE_REMINDER>;

const OPEN_STATUSES = [
  SERVICE_REQUEST_STATUS.SUBMITTED,
  SERVICE_REQUEST_STATUS.IN_PROGRESS,
  SERVICE_REQUEST_STATUS.DONE,
];

export class ServiceRepository extends BaseRepository {
  // ── Catalog ──

  async create(data: InferInsertModel<typeof schema.service>) {
    const [created] = await this.db.insert(schema.service).values(data).returning();
    return created;
  }

  async update(id: string, updates: Partial<InferInsertModel<typeof schema.service>>) {
    const [updated] = await this.db
      .update(schema.service)
      .set(updates)
      .where(eq(schema.service.id, id))
      .returning();
    return updated;
  }

  async getById(id: string) {
    const [found] = await this.db.select().from(schema.service).where(eq(schema.service.id, id));
    return found;
  }

  async getAll() {
    return await this.db.select().from(schema.service).orderBy(schema.service.name);
  }

  async getEnabled() {
    return await this.db
      .select()
      .from(schema.service)
      .where(eq(schema.service.enabled, true))
      .orderBy(schema.service.name);
  }

  // ── Request ──

  async createRequest(data: InferInsertModel<typeof schema.serviceRequest>) {
    const [created] = await this.db.insert(schema.serviceRequest).values(data).returning();
    return created;
  }

  /** Each request with its service and payment, which every request has from submit. */
  private selectRequests() {
    return this.db
      .select({
        request: schema.serviceRequest,
        serviceName: schema.service.name,
        pricingMode: schema.service.pricingMode,
        payment: schema.payment,
      })
      .from(schema.serviceRequest)
      .innerJoin(schema.service, eq(schema.service.id, schema.serviceRequest.serviceId))
      .innerJoin(schema.payment, eq(schema.payment.id, schema.serviceRequest.paymentId))
      .$dynamic();
  }

  async getRequestById(id: string) {
    const [found] = await this.selectRequests().where(eq(schema.serviceRequest.id, id));
    return found;
  }

  async updateRequest(
    id: string,
    updates: Partial<InferInsertModel<typeof schema.serviceRequest>>,
  ) {
    const [updated] = await this.db
      .update(schema.serviceRequest)
      .set(updates)
      .where(eq(schema.serviceRequest.id, id))
      .returning();
    return updated;
  }

  async getRequests() {
    return await this.selectRequests().orderBy(desc(schema.serviceRequest.submissionDate));
  }

  /** Requests that have waited for pickup since before `doneBefore`, not yet reminded. */
  async getPickupReminderCandidates(doneBefore: DateTime) {
    return await this.selectRequests().where(
      and(
        eq(schema.serviceRequest.status, SERVICE_REQUEST_STATUS.DONE),
        lte(schema.serviceRequest.completionDate, doneBefore),
        isNull(schema.serviceRequest.pickupReminderSentDate),
      ),
    );
  }

  /** Open requests whose bill was issued before `issuedBefore` and is unpaid, not yet reminded. */
  async getPaymentReminderCandidates(issuedBefore: DateTime) {
    return await this.selectRequests().where(
      and(
        inArray(schema.serviceRequest.status, OPEN_STATUSES),
        eq(schema.payment.status, PAYMENT_STATUS.PENDING),
        lte(schema.payment.issuedDate, issuedBefore),
        isNull(schema.serviceRequest.paymentReminderSentDate),
      ),
    );
  }

  /** Marks the reminder sent unless another sweep already did. */
  async claimReminder(requestId: string, reminder: ServiceReminder, now: DateTime) {
    const claimed = await this.db
      .update(schema.serviceRequest)
      .set({ [reminder]: now })
      .where(and(eq(schema.serviceRequest.id, requestId), isNull(schema.serviceRequest[reminder])))
      .returning({ id: schema.serviceRequest.id });
    return claimed.length > 0;
  }

  async releaseReminder(requestId: string, reminder: ServiceReminder) {
    await this.db
      .update(schema.serviceRequest)
      .set({ [reminder]: null })
      .where(eq(schema.serviceRequest.id, requestId));
  }

  async uploadRequestFile(requestId: string, fieldId: string, file: File) {
    const key = `service_requests/${requestId}/${fieldId}/${storageFileName(file.name)}`;
    return await saveFile(file, key);
  }
}
