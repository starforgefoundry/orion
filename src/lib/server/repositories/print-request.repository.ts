import { schema, type PrintRequest } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { PRINT_REQUEST_STATUS } from '$lib/utils/print-request';
import { count, desc, eq, ilike, or } from 'drizzle-orm';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;

export type NewPrintRequest = {
  customer: { name: string; email: string };
  projectName: string;
  specialRequests?: string;
  isQuote?: boolean;
  material: string;
  billingCode?: string;
};

export type PrintRequestSearch = { query: string; page?: number; pageSize?: number };

export class PrintRequestRepository extends BaseRepository {
  async submit(dto: NewPrintRequest) {
    const [printRequest] = await this.db
      .insert(schema.printRequest)
      .values({
        email: dto.customer.email,
        customerName: dto.customer.name,
        projectName: dto.projectName,
        specialRequests: dto.specialRequests ?? '',
        isQuote: dto.isQuote,
        status: PRINT_REQUEST_STATUS.IN_QUEUE,
        material: dto.material,
        billingCode: dto.billingCode ?? null,
      })
      .returning();
    return printRequest;
  }

  async getAll() {
    const results = await this.db
      .select()
      .from(schema.printRequest)
      .innerJoin(schema.printMaterial, eq(schema.printRequest.material, schema.printMaterial.id))
      .leftJoin(schema.payment, eq(schema.printRequest.paymentId, schema.payment.id))
      .orderBy(desc(schema.printRequest.submissionDate))
      .limit(100);

    return results.map(({ print_request, print_material, payment }) => ({
      ...print_request,
      material: print_material,
      payment: payment,
    }));
  }

  async search(dto: PrintRequestSearch) {
    const pageSize = dto.pageSize ?? DEFAULT_PAGE_SIZE;
    const currentPage = dto.page ?? DEFAULT_PAGE;
    const whereClause =
      dto.query.trim() !== ''
        ? or(
            ilike(schema.printRequest.projectName, `%${dto.query}%`),
            ilike(schema.printRequest.customerName, `%${dto.query}%`),
            ilike(schema.printRequest.email, `%${dto.query}%`),
          )
        : undefined;

    // Get total count
    const totalResult = await this.db
      .select({ count: count() })
      .from(schema.printRequest)
      .where(whereClause)
      .execute();

    const total = totalResult[0]?.count ?? 0;

    // Get paginated results
    const results = await this.db
      .select()
      .from(schema.printRequest)
      .innerJoin(schema.printMaterial, eq(schema.printRequest.material, schema.printMaterial.id))
      .leftJoin(schema.payment, eq(schema.printRequest.paymentId, schema.payment.id))
      .leftJoin(schema.billingCode, eq(schema.printRequest.billingCode, schema.billingCode.code))
      .leftJoin(schema.organization, eq(schema.billingCode.organizationId, schema.organization.id))
      .where(whereClause)
      .orderBy(desc(schema.printRequest.submissionDate))
      .limit(pageSize)
      .offset((currentPage - 1) * pageSize)
      .execute();

    const data = results.map(({ print_request, print_material, payment }) => ({
      ...print_request,
      material: print_material,
      payment: payment,
    }));

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        total,
        page: currentPage,
        pageSize,
        totalPages,
      },
    };
  }

  async getById(id: string) {
    const result = await this.db
      .select()
      .from(schema.printRequest)
      .innerJoin(schema.printMaterial, eq(schema.printRequest.material, schema.printMaterial.id))
      .leftJoin(schema.payment, eq(schema.printRequest.paymentId, schema.payment.id))
      .leftJoin(
        schema.printRequestFile,
        eq(schema.printRequest.id, schema.printRequestFile.printRequestId),
      )
      .leftJoin(schema.billingCode, eq(schema.printRequest.billingCode, schema.billingCode.code))
      .leftJoin(schema.organization, eq(schema.billingCode.organizationId, schema.organization.id))
      .orderBy(desc(schema.printRequest.submissionDate))
      .where(eq(schema.printRequest.id, id));

    return result
      ? {
          ...result[0].print_request,
          organization: result[0].organization,
          payment: result[0].payment,
          material: result[0].print_material,
          files: result.map((r) => r.print_request_file).filter((f) => f !== null),
        }
      : undefined;
  }

  async update(id: string, updates: Partial<PrintRequest>) {
    return await this.db
      .update(schema.printRequest)
      .set(updates)
      .where(eq(schema.printRequest.id, id))
      .returning();
  }

  async updatePartQuantity(partId: string, quantity: number) {
    const result = await this.db
      .update(schema.printRequestFile)
      .set({ quantity })
      .where(eq(schema.printRequestFile.id, partId))
      .returning();

    return result;
  }
}
