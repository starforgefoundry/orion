import type {
  CreateBillingCodeDto,
  UpdateBillingCodeDto,
} from '$lib/remotes/dtos/billing_code.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { and, eq, sql } from 'drizzle-orm';

export class BillingCodeRepository extends BaseRepository {
  async create(dto: CreateBillingCodeDto) {
    try {
      // Convert empty strings to null for foreign key fields
      const values = {
        ...dto,
        organizationId: dto.organizationId || null,
        discountId: dto.discountId || null,
      };
      const [billingCode] = await this.db.insert(schema.billingCode).values(values).returning();
      return billingCode;
    } catch (error) {
      console.error('Error creating billing code:', error);
      throw error;
    }
  }

  async getAll() {
    const codes = await this.db
      .select({
        billingCode: schema.billingCode,
        organization: schema.organization,
      })
      .from(schema.billingCode)
      .leftJoin(schema.organization, eq(schema.billingCode.organizationId, schema.organization.id))
      .where(eq(schema.billingCode.archived, false));

    return codes;
  }

  async getById(id: string) {
    const [code] = await this.db
      .select({
        billingCode: schema.billingCode,
        organization: schema.organization,
      })
      .from(schema.billingCode)
      .leftJoin(schema.organization, eq(schema.billingCode.organizationId, schema.organization.id))
      .where(eq(schema.billingCode.id, id));

    return code;
  }

  async getByCode(code: string) {
    const [billingCode] = await this.db
      .select({
        billingCode: schema.billingCode,
        organization: schema.organization,
      })
      .from(schema.billingCode)
      .leftJoin(schema.organization, eq(schema.billingCode.organizationId, schema.organization.id))
      .where(
        and(
          eq(sql`upper(${schema.billingCode.code})`, code.toUpperCase()),
          eq(schema.billingCode.archived, false),
        ),
      );

    return billingCode;
  }

  async update(id: string, updates: Omit<UpdateBillingCodeDto, 'id'>) {
    // Convert empty strings to null for foreign key fields
    const values = {
      ...updates,
      ...(updates.organizationId !== undefined && {
        organizationId: updates.organizationId || null,
      }),
      ...(updates.discountId !== undefined && { discountId: updates.discountId || null }),
    };
    const [billingCode] = await this.db
      .update(schema.billingCode)
      .set(values)
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
