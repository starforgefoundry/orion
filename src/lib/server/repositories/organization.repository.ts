import { schema, type Organization } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { PaymentRepository, type NewPayment } from '$lib/server/repositories/payment.repository';
import { PAYMENT_TYPE } from '$lib/utils/billing';
import { and, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';

export type OrganizationUpdates = Partial<
  Pick<Organization, 'name' | 'email' | 'grantsAccess' | 'accessEndDate'>
>;

export class OrganizationRepository extends BaseRepository {
  async create(organization: Pick<Organization, 'name' | 'email'>) {
    const [created] = await this.db.insert(schema.organization).values(organization).returning();
    return created;
  }

  async getAll() {
    return await this.db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.archived, false));
  }

  async getById(id: string) {
    const [organization] = await this.db
      .select()
      .from(schema.organization)
      .where(eq(schema.organization.id, id));
    return organization;
  }

  async update(id: string, updates: OrganizationUpdates) {
    const [organization] = await this.db
      .update(schema.organization)
      .set(updates)
      .where(eq(schema.organization.id, id))
      .returning();

    return organization;
  }

  async archive(id: string) {
    await this.db
      .update(schema.organization)
      .set({ archived: true })
      .where(eq(schema.organization.id, id));
  }

  async getPayments(organizationId: string) {
    const payments = await this.db
      .select()
      .from(schema.payment)
      .where(eq(schema.payment.organizationId, organizationId));

    return payments;
  }

  // TODO: convert this to include all items related to the organization
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
        and(
          eq(schema.payment.organizationId, organizationId),
          eq(schema.payment.type, PAYMENT_TYPE.BALANCE),
        ),
      );

    return balancePayments;
  }

  async getCharges(organizationId: string) {
    const charges = await this.db
      .select()
      .from(schema.organizationCharge)
      .innerJoin(schema.payment, eq(schema.organizationCharge.paymentId, schema.payment.id))
      .where(eq(schema.organizationCharge.organizationId, organizationId));

    return charges.map(({ organization_charge, payment }) => ({
      ...organization_charge,
      payment,
    }));
  }

  /** Stores the charge and the payment that bills it together. */
  async createCharge(organizationId: string, description: string, payment: NewPayment) {
    return await this.db.transaction(async (tx) => {
      const saved = await new PaymentRepository(tx).save({ ...payment, organizationId });
      const [charge] = await tx
        .insert(schema.organizationCharge)
        .values({ organizationId, description, creationDate: DateTime.now(), paymentId: saved.id })
        .returning();
      return charge;
    });
  }
}
