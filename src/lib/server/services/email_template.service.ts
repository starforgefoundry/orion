import type { UpdateEmailTemplateDto } from '$lib/remotes/dtos/email_template.dto';
import { BaseService } from '$lib/server/services/base.service';
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_KEYS,
  unknownVariables,
  variableToken,
  type EmailTemplateGroup,
} from '$lib/utils/email_templates';

export class UnknownTemplateVariableError extends Error {
  constructor(names: string[]) {
    super(`Unknown variables: ${names.map(variableToken).join(', ')}`);
  }
}

export class EmailTemplateService extends BaseService {
  async getTemplates(group: EmailTemplateGroup) {
    const stored = await this.emailTemplateRepository.getAll();

    return EMAIL_TEMPLATE_KEYS.filter(
      (key) => EMAIL_TEMPLATE_DEFINITIONS[key].group === group,
    ).flatMap((key) => {
      const template = stored.find((candidate) => candidate.key === key);
      return template ? [{ key, subject: template.subject, body: template.body }] : [];
    });
  }

  async updateTemplate({ key, subject, body }: UpdateEmailTemplateDto) {
    const unknown = unknownVariables(key, `${subject}\n${body}`);
    if (unknown.length > 0) throw new UnknownTemplateVariableError(unknown);

    return await this.emailTemplateRepository.update(key, { subject, body });
  }
}

export const emailTemplateService = new EmailTemplateService();
