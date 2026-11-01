import { command, query } from '$app/server';
import { updateEmailTemplateDto } from '$lib/remotes/dtos/email_template.dto';
import { exposeUserErrors, verifyAuth } from '$lib/remotes/utils';
import { emailTemplateService } from '$lib/server/services/email_template.service';
import { EMAIL_TEMPLATE_DEFINITIONS, EMAIL_TEMPLATE_GROUP } from '$lib/utils/email_templates';
import * as v from 'valibot';

export const getEmailTemplates = query(
  v.picklist(Object.values(EMAIL_TEMPLATE_GROUP)),
  exposeUserErrors((group) => {
    verifyAuth();
    return emailTemplateService.getTemplates(group);
  }),
);

export const updateEmailTemplate = command(
  updateEmailTemplateDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const response = await emailTemplateService.updateTemplate(dto);
    await getEmailTemplates(EMAIL_TEMPLATE_DEFINITIONS[dto.key].group).refresh();

    return response;
  }),
);
