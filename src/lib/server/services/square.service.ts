import { BaseService } from '$lib/server/services/base.service';

export class SquareService extends BaseService {
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

  async processWebhook(webhookData: any) {
    const log = await this.squareRepository.logWebhook(webhookData);
    if (!log) {
      console.log('Already received and processed webhook event:', webhookData);
      return { success: true, message: 'Already received and processed webhook event' };
    }

    // Process different webhook event types
    if (webhookData.type === 'invoice.payment_made') {
      const invoiceId = webhookData.data.id;
      await this.paymentRepository.updateInvoiceStatus(invoiceId, 'paid');
    }

    if (webhookData.type === 'invoice.canceled') {
      const invoiceId = webhookData.data.id;
      await this.paymentRepository.updateInvoiceStatus(invoiceId, 'canceled');
    }

    return { success: true };
  }
}

export const squareService = new SquareService();
