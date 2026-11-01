import { BaseRepository } from '$lib/server/repositories/base.repository';

export const DISCORD_COLOR = {
  GREEN: 0x57f287,
  BLURPLE: 0x5865f2,
} as const;

export type DiscordEmbed = {
  title: string;
  color: number;
  fields: { name: string; value: string; inline: boolean }[];
  timestamp: string;
};

export type DiscordMessage = { content?: string; embeds: DiscordEmbed[] };

export class DiscordRepository extends BaseRepository {
  /** Staff may leave a webhook unset, so an empty URL skips the message instead of failing. */
  async notify(webhookUrl: string, message: DiscordMessage) {
    if (!webhookUrl) {
      console.warn(`Discord webhook URL not configured, skipped "${message.embeds[0]?.title}"`);
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Failed to send Discord webhook: ${response.statusText}`);
    }
  }
}
