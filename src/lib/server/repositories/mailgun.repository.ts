import { BaseRepository } from '$lib/server/repositories/base.repository';
import {
  templates,
  type MailgunTemplates,
  type TemplateVariables,
} from '$lib/server/utils/mailgun_templates';

export class MailgunRepository extends BaseRepository {
  async sendTemplate<T extends MailgunTemplates>(
    to: string,
    from: string,
    replyTo: string,
    subject: string,
    template: T,
    variables: TemplateVariables[T],
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
      text: emailContent,
    });
  }
}
