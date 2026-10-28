import type { UpdateEmailTemplateDto } from '$lib/remotes/dtos/email_template.dto';
import { BaseService } from '$lib/server/services/base.service';
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplateGroup,
} from '$lib/utils/email_templates';

export class EmailTemplateService extends BaseService {
  async getTemplates(group: EmailTemplateGroup) {
    const stored = await this.emailTemplateRepository.getAll();

    return stored
      .filter((template) => EMAIL_TEMPLATE_DEFINITIONS[template.key].group === group)
      .sort((a, b) => EMAIL_TEMPLATE_KEYS.indexOf(a.key) - EMAIL_TEMPLATE_KEYS.indexOf(b.key));
  }

  async updateTemplate({ key, subject, body }: UpdateEmailTemplateDto) {
    return await this.emailTemplateRepository.update(key, { subject, body });
  }
}

export const emailTemplateService = new EmailTemplateService();
