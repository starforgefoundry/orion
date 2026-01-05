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
      emailContent = emailContent.replace(`{{${key}}}`, value);
    }

    this.mailgun.messages.create('starforgefoundry.com', {
      from: from,
      to: [to],
      'h:Reply-To': replyTo,
      subject: subject,
      html: emailContent,
    });
  }
}
