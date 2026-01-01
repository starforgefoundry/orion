import type { PrintRequestCustomerDto } from '$lib/api/dtos/print_customer.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';

export class PrintCustomerRepository extends BaseRepository {
  async create(dto: PrintRequestCustomerDto) {
    return (await this.db.insert(schema.printRequestCustomer).values(dto).returning())[0];
  }
}
