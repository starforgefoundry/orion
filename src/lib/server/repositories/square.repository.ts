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
}
