import type { EmailTemplateRepository } from '$lib/server/repositories/email-template.repository';
import type { ResendRepository } from '$lib/server/repositories/resend.repository';
import type { EmailSender } from '$lib/server/utils/email-templates/senders';
import {
  renderHtmlTemplate,
  renderTemplate,
  type EmailTemplateKey,
  type Templates,
} from '$lib/utils/email-templates';

export type EmailRepositories = {
  emailTemplateRepository: EmailTemplateRepository;
  resendRepository: ResendRepository;
};

/** Fills a stored email template and sends it. */
export async function sendTemplate<T extends EmailTemplateKey>(
  repos: EmailRepositories,
  to: string,
  sender: EmailSender,
  template: T,
  variables: Templates[T],
) {
  const content = await repos.emailTemplateRepository.get(template);
  if (!content) {
    throw new Error(`Email template "${template}" not found`);
  }

  await repos.resendRepository.send({
    to,
    sender,
    subject: renderTemplate(content.subject, variables),
    html: renderHtmlTemplate(content.body, variables),
  });
}
