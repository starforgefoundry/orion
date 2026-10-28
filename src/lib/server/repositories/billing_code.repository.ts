import type {
  CreateBillingCodeDto,
  UpdateBillingCodeDto,
} from '$lib/remotes/dtos/billing_code.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';

function matchesCode(code: string) {
  return eq(sql`upper(${schema.billingCode.code})`, code.toUpperCase());
}

export class BillingCodeRepository extends BaseRepository {
  async create(dto: CreateBillingCodeDto) {
    const [billingCode] = await this.db.insert(schema.billingCode).values(dto).returning();
    return billingCode;
  }

  private selectWithOrganization(where: SQL | undefined) {
    return this.db
      .select({
        billingCode: schema.billingCode,
        organization: schema.organization,
      })
      .from(schema.billingCode)
      .leftJoin(schema.organization, eq(schema.billingCode.organizationId, schema.organization.id))
      .where(where)
      .orderBy(asc(schema.billingCode.code));
  }

  async getAll() {
    return await this.selectWithOrganization(eq(schema.billingCode.archived, false));
  }

  async getByOrganization(organizationId: string) {
    return await this.selectWithOrganization(
      and(
        eq(schema.billingCode.organizationId, organizationId),
        eq(schema.billingCode.archived, false),
      ),
    );
  }

  async getById(id: string) {
    const [code] = await this.selectWithOrganization(eq(schema.billingCode.id, id));
    return code;
  }

  async getByCode(code: string) {
    const [billingCode] = await this.selectWithOrganization(
      and(matchesCode(code), eq(schema.billingCode.archived, false)),
    );
    return billingCode;
  }

  async getByCodeIncludingArchived(code: string) {
    const [billingCode] = await this.selectWithOrganization(matchesCode(code));
    return billingCode;
  }

  async update(id: string, updates: Omit<UpdateBillingCodeDto, 'id'>) {
    const [billingCode] = await this.db
      .update(schema.billingCode)
      .set(updates)
      .where(eq(schema.billingCode.id, id))
      .returning();

    return billingCode;
  }

  async delete(id: string) {
    await this.db.delete(schema.billingCode).where(eq(schema.billingCode.id, id));
  }

  async archive(id: string) {
    await this.db
      .update(schema.billingCode)
      .set({ archived: true })
      .where(eq(schema.billingCode.id, id));
  }
}
