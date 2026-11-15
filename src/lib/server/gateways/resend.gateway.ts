import { env } from '$env/dynamic/private';
import { HTTP_STATUS } from '$lib/http';
import type { EmailTemplateRepository } from '$lib/server/repositories/email-template.repository';
import type { EmailSender } from '$lib/server/utils/email-templates/senders';
import {
  renderHtmlTemplate,
  renderTemplate,
  type EmailTemplateKey,
  type Templates,
} from '$lib/utils/email-templates';
import { DateTime } from 'luxon';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const RETRY_AFTER_HEADER = 'retry-after';

/** Sends the stored email templates through Resend. */
export class ResendGateway {
  constructor(private readonly emailTemplateRepository: EmailTemplateRepository) {}

  async sendTemplate<T extends EmailTemplateKey>(
    to: string,
    sender: EmailSender,
    template: T,
    variables: Templates[T],
  ) {
    const content = await this.emailTemplateRepository.get(template);
    if (!content) {
      throw new Error(`Email template "${template}" not found`);
    }

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
        subject: renderTemplate(content.subject, variables),
        html: renderHtmlTemplate(content.body, variables),
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
