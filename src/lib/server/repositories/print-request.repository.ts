import { schema, type PrintRequest } from '$lib/server/db/schema';
import { paginate, type PageRequest } from '$lib/server/db/pagination';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { PRINT_REQUEST_STATUS } from '$lib/utils/print-request';
import { count, desc, eq, ilike, or } from 'drizzle-orm';

export type NewPrintRequest = {
  customer: { name: string; email: string };
  projectName: string;
  specialRequests?: string;
  isQuote?: boolean;
  material: string;
  billingCode?: string;
};

export type PrintRequestSearch = PageRequest & { query: string };

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
    const where =
      dto.query.trim() !== ''
        ? or(
            ilike(schema.printRequest.projectName, `%${dto.query}%`),
            ilike(schema.printRequest.customerName, `%${dto.query}%`),
            ilike(schema.printRequest.email, `%${dto.query}%`),
          )
        : undefined;

    const { data, pagination } = await paginate(
      this.db
        .select({
          print_request: schema.printRequest,
          print_material: schema.printMaterial,
          payment: schema.payment,
        })
        .from(schema.printRequest)
        .innerJoin(schema.printMaterial, eq(schema.printRequest.material, schema.printMaterial.id))
        .leftJoin(schema.payment, eq(schema.printRequest.paymentId, schema.payment.id))
        .where(where)
        .orderBy(desc(schema.printRequest.submissionDate))
        .$dynamic(),
      this.db.select({ total: count() }).from(schema.printRequest).where(where),
      dto,
    );

    return {
      data: data.map(({ print_request, print_material, payment }) => ({
        ...print_request,
        material: print_material,
        payment,
      })),
      pagination,
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
      .where(eq(schema.printRequest.id, id));

    const [first] = result;
    if (!first) return undefined;

    return {
      ...first.print_request,
      organization: first.organization,
      payment: first.payment,
      material: first.print_material,
      files: result.map((r) => r.print_request_file).filter((f) => f !== null),
    };
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
