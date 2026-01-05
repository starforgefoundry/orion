import { BaseRepository } from '$lib/server/repositories/base.repository';

export class DiscordRepository extends BaseRepository {
  async sendWebhookNotification(webhookUrl: string, payload: any) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to send Discord webhook: ${response.statusText}`);
    }
  }
}
