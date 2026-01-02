import { BaseService } from '$lib/server/services/base.service';

class SquareService extends BaseService {
  async getLocations() {
    return await this.squareRepository.getLocations();
  }

  async getCatalog() {
    return await this.squareRepository.getCatalog();
  }

  async checkActiveMember(customerEmail: string) {
    const memberships = await this.squareRepository.getMembershipsByEmail(customerEmail);
    if (!memberships || memberships.length === 0) {
      return false;
    }

    const activeMemberships = memberships.filter((membership) => membership.status === 'ACTIVE');
    return activeMemberships.length > 0;
  }
}

export const squareService = new SquareService();
