import { EMAIL_TEMPLATE_KEYS } from '$lib/utils/email_templates';
import * as v from 'valibot';

export const updateEmailTemplateDto = v.object({
  key: v.picklist(EMAIL_TEMPLATE_KEYS),
  subject: v.pipe(v.string(), v.nonEmpty('Enter a subject')),
  body: v.pipe(v.string(), v.nonEmpty('Enter a body')),
});
export type UpdateEmailTemplateDto = v.InferOutput<typeof updateEmailTemplateDto>;
