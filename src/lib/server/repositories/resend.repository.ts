import { env } from '$env/dynamic/private';
import { HTTP_STATUS } from '$lib/http';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import type { EmailSender } from '$lib/server/utils/email-templates/senders';
import { DateTime } from 'luxon';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const RETRY_AFTER_HEADER = 'retry-after';

export type Email = { to: string; sender: EmailSender; subject: string; html: string };

export class ResendRepository extends BaseRepository {
  async send({ to, sender, subject, html }: Email) {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender.from,
        to: [to],
        reply_to: sender.replyTo,
        subject,
        html,
      }),
    });

    if (response.ok) return;

    const reason = await errorReason(response);
    if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      throw new ResendRateLimitError(reason, retryAfter(response.headers.get(RETRY_AFTER_HEADER)));
    }
    throw new Error(`Failed to send email via Resend: ${reason}`);
  }
}

const DEFAULT_RATE_LIMIT_WAIT = { minutes: 1 };

export class ResendRateLimitError extends Error {
  constructor(
    reason: string,
    readonly retryAt: DateTime,
  ) {
    super(`Resend rate limit: ${reason}`);
  }
}

async function errorReason(response: Response) {
  const text = await response.text();
  try {
    return (JSON.parse(text) as { message?: string }).message ?? text;
  } catch {
    return text || response.statusText;
  }
}

export function retryAfter(seconds: string | null) {
  const wait = Number(seconds);
  return DateTime.now().plus(
    seconds && Number.isFinite(wait) ? { seconds: wait } : DEFAULT_RATE_LIMIT_WAIT,
  );
}
