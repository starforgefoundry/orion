import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { saveFile } from '$lib/server/utils/storage';
import { storageFileName } from '$lib/utils/services';
import { desc, eq, type InferInsertModel } from 'drizzle-orm';

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

  async uploadRequestFile(requestId: string, fieldId: string, file: File) {
    const key = `service_requests/${requestId}/${fieldId}/${storageFileName(file.name)}`;
    return await saveFile(file, key);
  }
}
