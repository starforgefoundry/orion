import { EmailTemplateRepository } from '$lib/server/repositories/email-template.repository';
import { ResendRepository } from '$lib/server/repositories/resend.repository';
import { automock } from '$test/utils';
import { describe, expect, it } from 'vitest';
import { sendTemplate } from './email';

describe(sendTemplate.name, () => {
  function setup(template?: { subject: string; body: string }) {
    const emailTemplateRepository = automock(EmailTemplateRepository);
    emailTemplateRepository.get.mockResolvedValue(
      template ? { key: 'print_pickup', ...template } : (undefined as never),
    );
    const resendRepository = automock(ResendRepository);
    resendRepository.send.mockResolvedValue(undefined);
    return { emailTemplateRepository, resendRepository };
  }

  const VARIABLES = { projectName: 'Robot Arm', paymentNote: 'Paid.', statusURL: 'https://x' };
  const SENDER = { from: 'Prints <prints@example.com>', replyTo: 'prints@example.com' };

  it('fills the stored subject and body', async () => {
    const repos = setup({
      subject: 'Ready - {{projectName}}',
      body: '<a href="{{statusURL}}">{{projectName}}</a>',
    });

    await sendTemplate(repos, 'a@b.com', SENDER, 'print_pickup', VARIABLES);

    expect(repos.resendRepository.send).toHaveBeenCalledWith({
      to: 'a@b.com',
      sender: SENDER,
      subject: 'Ready - Robot Arm',
      html: '<a href="https://x">Robot Arm</a>',
    });
  });

  it('escapes customer-supplied values in the HTML body only', async () => {
    const repos = setup({ subject: '{{projectName}}', body: '{{projectName}}' });

    await sendTemplate(repos, 'a@b.com', SENDER, 'print_pickup', {
      ...VARIABLES,
      projectName: '<b>Arm</b>',
    });

    expect(repos.resendRepository.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: '<b>Arm</b>', html: '&lt;b&gt;Arm&lt;/b&gt;' }),
    );
  });

  it('fails when the template is missing from the database', async () => {
    const repos = setup();

    await expect(sendTemplate(repos, 'a@b.com', SENDER, 'print_pickup', VARIABLES)).rejects.toThrow(
      'Email template "print_pickup" not found',
    );
    expect(repos.resendRepository.send).not.toHaveBeenCalled();
  });
});
