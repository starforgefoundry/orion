import type { PrintRequestCustomerDto } from '$lib/api/dtos/print_customer.dto';
import { getDB } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';

async function create(dto: PrintRequestCustomerDto) {
  const db = getDB();

  return (await db.insert(schema.printRequestCustomer).values(dto).returning())[0];
}

export const printCustomerRepository = {
  create,
};
