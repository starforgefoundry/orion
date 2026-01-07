import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '$lib/remotes/dtos/organization.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { and, eq } from 'drizzle-orm';

export class OrganizationRepository extends BaseRepository {
  async create(dto: CreateOrganizationDto) {
    const organization = await this.db.insert(schema.organization).values(dto).returning().get();
    return organization;
  }

  async getAll() {
    return await this.db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.archived, false));
  }

  async getById(id: string) {
    return await this.db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, id))
      .get();
  }

  async update(id: string, updates: Omit<UpdateOrganizationDto, 'id'>) {
    const organization = await this.db
      .update(schema.organization)
      .set(updates)
      .where(eq(schema.organization.id, id))
      .returning()
      .get();

    return organization;
  }

  async archive(id: string) {
    await this.db
      .update(schema.organization)
      .set({ archived: true })
      .where(eq(schema.organization.id, id));
  }

  async getOutstandingBalance(organizationId: string) {
    // Get all payments associated with this organization
    const allPayments = await this.db
      .select()
      .from(schema.payment)
      .where(eq(schema.payment.organizationId, organizationId));

    let totalOwed = 0;

    for (const row of allPayments) {
      if (row.status !== 'quote' && row.type !== 'balance') {
        totalOwed += row.total;
      }

      if (row.type === 'balance') {
        totalOwed -= row.total;
      }
    }

    return totalOwed;
  }

  async getPrintRequests(organizationId: string) {
    const requests = await this.db
      .select({
        printRequest: schema.printRequest,
        payment: schema.payment,
      })
      .from(schema.printRequest)
      .leftJoin(schema.payment, eq(schema.printRequest.paymentId, schema.payment.id))
      .where(eq(schema.payment.organizationId, organizationId));

    return requests.map(({ printRequest, payment }) => ({
      ...printRequest,
      payment,
    }));
  }

  async getBalancePayments(organizationId: string) {
    const balancePayments = await this.db
      .select()
      .from(schema.payment)
      .where(
        and(eq(schema.payment.organizationId, organizationId), eq(schema.payment.type, 'balance')),
      );

    return balancePayments;
  }
}
