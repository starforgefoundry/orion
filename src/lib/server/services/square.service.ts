import { BaseService } from '$lib/server/services/base.service';

class SquareService extends BaseService {
  async getLocations() {
    return await this.squareRepository.getLocations();
  }

  async getCatalog() {
    return await this.squareRepository.getCatalog();
  }
}

export const squareService = new SquareService();
