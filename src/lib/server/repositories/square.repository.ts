import { BaseRepository } from '$lib/server/repositories/base.repository';

export class SquareRepository extends BaseRepository {
  async getLocations() {
    const response = await this.square.locations.list();
    return response.locations ?? [];
  }

  async getCatalog() {
    const response = await this.square.catalog.list();
    return response.data ?? [];
  }

  async getCatalogByIds(ids: string[]) {
    return await this.square.catalog.batchGet({
      objectIds: ids,
    });
  }

  async getMembershipsByEmail(customerEmail: string) {
    const customerSearch = await this.square.customers.search({
      query: {
        filter: {
          emailAddress: {
            exact: customerEmail,
          },
        },
      },
    });

    const customers = customerSearch.customers ?? [];
    if (customers.length === 0) {
      return undefined;
    }

    const membershipsSearch = await this.square.subscriptions.search({
      query: {
        filter: {
          customerIds: [customers[0].id ?? ''],
        },
      },
    });

    return membershipsSearch.subscriptions;
  }
}
