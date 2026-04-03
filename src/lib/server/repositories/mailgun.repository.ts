import { env } from '$env/dynamic/private';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { templates, type Templates } from '$lib/server/utils/email_templates';

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

    const data = await response.json();

    if (!response.ok) {
      console.error('Mailgun error response:', data);
      throw new Error(`Failed to send email via Mailgun: ${data || response.statusText}`);
    }
  }
}
