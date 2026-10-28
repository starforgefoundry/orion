import { EMAIL_TEMPLATE_GROUP } from '$lib/utils/email_templates';
import { newTestService, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { EmailTemplateService } from './email_template.service';

describe(EmailTemplateService.name, () => {
  let sut: EmailTemplateService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(EmailTemplateService));
  });

  describe('getTemplates', () => {
    it('returns only the stored templates in the group, in definition order', async () => {
      mocks.emailTemplateRepository.getAll.mockResolvedValue([
        { key: 'print_pickup', subject: 'Ready', body: 'pickup' },
        { key: 'class_booking', subject: 'Booked', body: 'class' },
        { key: 'print_submitted', subject: 'Received', body: 'submitted' },
      ]);

      const templates = await sut.getTemplates(EMAIL_TEMPLATE_GROUP.PRINTING);

      expect(templates.map((template) => template.key)).toEqual([
        'print_submitted',
        'print_pickup',
      ]);
    });
  });

  describe('updateTemplate', () => {
    it('saves the subject and body', async () => {
      const content = { subject: 'Ready - {{projectName}}', body: '<a href="{{statusURL}}">x</a>' };
      mocks.emailTemplateRepository.update.mockResolvedValue({ key: 'print_pickup', ...content });

      await sut.updateTemplate({ key: 'print_pickup', ...content });

      expect(mocks.emailTemplateRepository.update).toHaveBeenCalledWith('print_pickup', content);
    });
  });
});
