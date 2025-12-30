import type { PrintRequestCustomerDto } from '$lib/api/dtos/print_customer.dto';
import { getDB } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

async function getByEmail(email: string) {
  const db = getDB();

  const customer = await db
    .select()
    .from(schema.printRequestCustomer)
    .where(eq(schema.printRequestCustomer.email, email))
    .limit(1);

  return customer[0] ?? null;
}

async function upsert(dto: PrintRequestCustomerDto) {
  const db = getDB();

  const customer = await db
    .insert(schema.printRequestCustomer)
    .values(dto)
    .onConflictDoNothing({ target: schema.printRequestCustomer.email })
    .returning();

  return customer[0] ?? getByEmail(dto.email);
}

export const printCustomerRepository = {
  getByEmail,
  upsert,
};
