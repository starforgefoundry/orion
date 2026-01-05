import { getRequestEvent } from '$app/server';
import { env as publicEnv } from '$env/dynamic/public';
import type {
  SearchPrintRequestsDto,
  SubmitPrintRequestDto,
  UpdatePartQuantityDto,
  UpdatePrintRequestDto,
  UpdatePrintRequestStatusDto,
} from '$lib/remotes/dtos/print_request.dto';
import type { PrintRequest } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';
import { DateTime } from 'luxon';

export class PrintRequestService extends BaseService {
  async submitPrintRequest(dto: SubmitPrintRequestDto) {
    const printRequest = await this.printRequestRepository.submit(dto);

    const ctx = getRequestEvent().platform?.ctx;
    ctx?.waitUntil(this.printFilesRepository.uploadFiles(printRequest.id, dto.files));

    // Send Discord webhook notification
    const settings = await this.settingsRepository.getSetting('printRequest');
    if (settings.discordWebhookUrl) {
      const event = getRequestEvent();
      const origin = event?.url?.origin || 'http://localhost:5173';
      ctx?.waitUntil(
        this.sendDiscordNotification(printRequest.id, origin, settings.discordWebhookUrl),
      );
    }

    return {
      status: 'success',
      printRequestId: printRequest.id,
    };
  }

  async getPrintRequests() {
    return await this.printRequestRepository.getAll();
  }

  async searchPrintRequests(dto: SearchPrintRequestsDto) {
    return await this.printRequestRepository.search(dto);
  }

  async getPrintRequestById(id: string) {
    return await this.printRequestRepository.getById(id);
  }

  async updatePrintRequest(id: string, updates: UpdatePrintRequestDto) {
    const updated = await this.printRequestRepository.update(id, updates);

    return updated;
  }

  async updatePrintRequestStatus(id: string, dto: UpdatePrintRequestStatusDto) {
    const request = await this.printRequestRepository.getById(id);
    const payment = request?.paymentId
      ? await this.printPaymentRepository.getById(request?.paymentId)
      : undefined;

    const updates: Partial<PrintRequest> = { status: dto.status };

    if (dto.status === 'done') {
      updates.completionDate = DateTime.now();

      // Send pickup notification email to customer
      const ctx = getRequestEvent().platform?.ctx;
      if (ctx) {
        ctx.waitUntil(this.sendPickupNotification(id));
      } else {
        // Fallback if ctx is not available
        this.sendPickupNotification(id).catch((error) => {
          console.error('Failed to send pickup notification:', error);
        });
      }
    }

    if (dto.status === 'canceled') {
      updates.completionDate = DateTime.now();

      // cancel any outstanding invoices
      if (payment?.squareInvoiceId && payment.status !== 'canceled') {
        this.squareRepository.cancelInvoice(payment.squareInvoiceId);
      }

      // cancel payment
      if (payment) {
        await this.printPaymentRepository.updatePayment(payment.id, { status: 'canceled' });
      }
    }

    const updated = await this.printRequestRepository.update(id, updates);

    return updated;
  }

  async getFilesByRequestId(printRequestId: string) {
    return await this.printFilesRepository.getByPrintRequestId(printRequestId);
  }

  async updatePartQuantity(dto: UpdatePartQuantityDto) {
    return await this.printRequestRepository.updatePartQuantity(dto.partId, dto.quantity);
  }

  async sendPickupNotification(printRequestId: string) {
    const request = await this.printRequestRepository.getById(printRequestId);
    if (!request) {
      throw new Error('Print request not found');
    }

    await this.mailgunRepository.sendTemplate(
      request.email,
      `Starforge 3D Prints <${publicEnv.PUBLIC_PRINT_REQUEST_EMAIL}>`,
      publicEnv.PUBLIC_PRINT_REQUEST_EMAIL,
      `Your Print Request is Ready! - ${request.projectName}`,
      'print_pickup',
      {
        projectName: request.projectName,
      },
    );
  }

  async sendDiscordNotification(printRequestId: string, origin: string, webhookUrl: string) {
    const request = await this.printRequestRepository.getById(printRequestId);
    if (!request) {
      throw new Error('Print request not found');
    }

    const printQueueUrl = `${origin}/staff/print_queue?id=${printRequestId}`;

    const embed = {
      title: '🖨️ New Print Request Submitted',
      color: 0x5865f2, // Discord blurple color
      fields: [
        {
          name: 'Project Name',
          value: request.projectName,
          inline: true,
        },
        {
          name: 'Customer',
          value: request.customerName,
          inline: true,
        },
        {
          name: 'Email',
          value: request.email,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    if (request.specialRequests) {
      embed.fields.push({
        name: 'Special Requests',
        value: request.specialRequests,
        inline: false,
      });
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `[View in Print Queue](${printQueueUrl})`,
          embeds: [embed],
        }),
      });
    } catch (error) {
      console.error('Failed to send Discord webhook:', error);
      // Don't throw error - we don't want to fail the print request submission
    }
  }
}

export const printRequestService = new PrintRequestService();
