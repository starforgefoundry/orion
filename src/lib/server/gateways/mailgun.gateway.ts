import { env } from '$env/dynamic/private';
import { HTTP_STATUS } from '$lib/http';
import type { EmailTemplateRepository } from '$lib/server/repositories/email_template.repository';
import type { EmailSender } from '$lib/server/utils/email_templates/senders';
import {
  renderHtmlTemplate,
  renderTemplate,
  type EmailTemplateKey,
  type Templates,
} from '$lib/utils/email_templates';
import { DateTime } from 'luxon';

const MAILGUN_DOMAIN = 'starforgefoundry.com';
const MAILGUN_MESSAGES_URL = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`;

/** Sends the stored email templates through Mailgun. */
export class MailgunGateway {
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

    const body = new URLSearchParams({
      from: sender.from,
      to,
      'h:Reply-To': sender.replyTo,
      subject: renderTemplate(content.subject, variables),
      html: renderHtmlTemplate(content.body, variables),
    });

    const response = await fetch(MAILGUN_MESSAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`api:${env.MAILGUN_API_KEY}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (response.ok) return;

    const reason = await errorReason(response);
    if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
      throw new MailgunRateLimitError(reason, retryAfter(reason));
    }
    throw new Error(`Failed to send email via Mailgun: ${reason}`);
  }
}

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
