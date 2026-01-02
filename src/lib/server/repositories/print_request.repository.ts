import type {
  SubmitPrintRequestDto,
  UpdatePrintRequestDto,
} from '$lib/remotes/dtos/print_request.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { desc, eq } from 'drizzle-orm';

export class PrintRequestRepository extends BaseRepository {
  async submit(dto: SubmitPrintRequestDto) {
    const result = await this.db
      .insert(schema.printRequest)
      .values({
        email: dto.customer.email,
        customerName: dto.customer.name,
        projectName: dto.projectName,
        specialRequests: dto.specialRequests ?? '',
        isQuote: dto.isQuote,
        status: 'in_queue',
        material: dto.material,
        billingCode: dto.billingCode ?? null,
      })
      .returning();

    return result[0];
  }

  async getAll() {
    const results = await this.db
      .select()
      .from(schema.printRequest)
      .innerJoin(schema.printMaterial, eq(schema.printRequest.material, schema.printMaterial.id))
      .orderBy(desc(schema.printRequest.submissionDate))
      .limit(100);

    return results.map(({ print_request, print_material }) => ({
      ...print_request,
      material: print_material,
    }));
  }

  async getById(id: string) {
    const results = await this.db
      .select()
      .from(schema.printRequest)
      .innerJoin(schema.printMaterial, eq(schema.printRequest.material, schema.printMaterial.id))
      .orderBy(desc(schema.printRequest.submissionDate))
      .where(eq(schema.printRequest.id, id))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return results.map(({ print_request, print_material }) => ({
      ...print_request,
      material: print_material,
    }))[0];
  }

  async update(id: string, updates: UpdatePrintRequestDto) {
    return await this.db
      .update(schema.printRequest)
      .set(updates)
      .where(eq(schema.printRequest.id, id))
      .returning();
  }
}
