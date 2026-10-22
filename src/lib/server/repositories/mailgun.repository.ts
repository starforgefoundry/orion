import { env } from '$env/dynamic/private';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { templates, type Templates } from '$lib/server/utils/email_templates';
import { DateTime } from 'luxon';

export class MailgunRepository extends BaseRepository {
  async sendTemplate<T extends keyof Templates>(
    to: string,
    from: string,
    replyTo: string,
    subject: string,
    template: T,
    variables: Templates[T],
  ) {
    let emailContent = templates[template];
    if (!emailContent) {
      throw new Error(`Mailgun template "${template}" not found`);
    }

    for (const [key, value] of Object.entries(variables)) {
      emailContent = emailContent.replaceAll(`{{${key}}}`, value);
    }

    const body = new URLSearchParams({
      from,
      to,
      'h:Reply-To': replyTo,
      subject: subject,
      html: emailContent,
    });

    const response = await fetch('https://api.mailgun.net/v3/starforgefoundry.com/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`api:${env.MAILGUN_API_KEY}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (response.ok) return;

    const reason = await errorReason(response);
    if (response.status === HTTP_TOO_MANY_REQUESTS) {
      throw new MailgunRateLimitError(reason, retryAfter(reason));
    }
    throw new Error(`Failed to send email via Mailgun: ${reason}`);
  }
}

const HTTP_TOO_MANY_REQUESTS = 429;
const DEFAULT_RATE_LIMIT_WAIT = { minutes: 1 };
const RETRY_AFTER_PATTERN = /try again after (.+)$/;

export class MailgunRateLimitError extends Error {
  constructor(
    reason: string,
    readonly retryAt: DateTime,
  ) {
    super(`Mailgun rate limit: ${reason}`);
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

export function retryAfter(reason: string) {
  const match = reason.match(RETRY_AFTER_PATTERN);
  const retryAt = match ? DateTime.fromJSDate(new Date(match[1])) : undefined;
  return retryAt?.isValid ? retryAt : DateTime.now().plus(DEFAULT_RATE_LIMIT_WAIT);
}
