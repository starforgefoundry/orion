import { EMAIL_TEMPLATE_KEYS, unknownVariables, variableToken } from '$lib/utils/email_templates';
import * as v from 'valibot';

export const updateEmailTemplateDto = v.pipe(
  v.object({
    key: v.picklist(EMAIL_TEMPLATE_KEYS),
    subject: v.pipe(v.string(), v.nonEmpty('Enter a subject')),
    body: v.pipe(v.string(), v.nonEmpty('Enter a body')),
  }),
  v.check(
    (template) => unknownVariables(template.key, template).length === 0,
    ({ input }) =>
      `Unknown variables: ${unknownVariables(input.key, input).map(variableToken).join(', ')}`,
  ),
);
export type UpdateEmailTemplateDto = v.InferOutput<typeof updateEmailTemplateDto>;
