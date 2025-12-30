import type { SubmitPrintRequestDto, UpdatePrintRequestDto } from '$lib/api/dtos/print_request.dto';
import { getDB } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

async function submit(dto: SubmitPrintRequestDto) {
  const db = getDB();

  const result = await db
    .insert(schema.printRequest)
    .values({
      customer: dto.customer.email,
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

async function getAll() {
  const db = getDB();

  const results = await db
    .select()
    .from(schema.printRequest)
    .innerJoin(
      schema.printRequestCustomer,
      eq(schema.printRequest.customer, schema.printRequestCustomer.email),
    )
    .innerJoin(schema.printMaterial, eq(schema.printRequest.material, schema.printMaterial.id))
    .orderBy(desc(schema.printRequest.submissionDate))
    .limit(100);

  return results.map(({ print_request, print_request_customer, print_material }) => ({
    ...print_request,
    customer: print_request_customer,
    material: print_material,
  }));
}

async function getById(id: string) {
  const db = getDB();

  const results = await db
    .select()
    .from(schema.printRequest)
    .innerJoin(
      schema.printRequestCustomer,
      eq(schema.printRequest.customer, schema.printRequestCustomer.email),
    )
    .innerJoin(schema.printMaterial, eq(schema.printRequest.material, schema.printMaterial.id))
    .orderBy(desc(schema.printRequest.submissionDate))
    .where(eq(schema.printRequest.id, id))
    .limit(1);

  if (results.length === 0) {
    return null;
  }

  return results.map(({ print_request, print_request_customer, print_material }) => ({
    ...print_request,
    customer: print_request_customer,
    material: print_material,
  }))[0];
}

export async function update(id: string, updates: UpdatePrintRequestDto) {
  const db = getDB();

  return await db
    .update(schema.printRequest)
    .set(updates)
    .where(eq(schema.printRequest.id, id))
    .returning();
}

export const printRequestRepository = {
  submit,
  getAll,
  update,
  getById,
};
