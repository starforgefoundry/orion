import { env } from '$env/dynamic/private';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { EmailTemplateRepository } from '$lib/server/repositories/email_template.repository';
import { renderTemplate, type EmailTemplateKey, type Templates } from '$lib/utils/email_templates';
import { DateTime } from 'luxon';

export class MailgunRepository extends BaseRepository {
  private emailTemplateRepository: EmailTemplateRepository;

  constructor(emailTemplateRepository?: EmailTemplateRepository) {
    super();
    this.emailTemplateRepository = emailTemplateRepository ?? new EmailTemplateRepository();
  }

  async sendTemplate<T extends EmailTemplateKey>(
    to: string,
    from: string,
    replyTo: string,
    template: T,
    variables: Templates[T],
  ) {
    const content = await this.emailTemplateRepository.get(template);
    if (!content) {
      throw new Error(`Email template "${template}" not found`);
    }

    const body = new URLSearchParams({
      from,
      to,
      'h:Reply-To': replyTo,
      subject: renderTemplate(content.subject, variables),
      html: renderTemplate(content.body, variables),
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
