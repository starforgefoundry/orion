import { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import { MemberEmailRepository } from '$lib/server/repositories/member_email.repository';
import { factory } from '$test/factory';
import { automock } from '$test/utils';
import { describe, expect, it } from 'vitest';
import { MemberNotificationRepository } from './member_notification.repository';

const MEMBER = factory.member({
  id: 'member-1',
  email: 'sam@example.com',
  name: 'Sam <Smith>',
  onboardingToken: 'onboarding-abc',
});

function setup() {
  const mailgun = automock(MailgunRepository);
  const memberEmail = automock(MemberEmailRepository);
  mailgun.sendTemplate.mockResolvedValue(undefined as never);
  memberEmail.log.mockResolvedValue(factory.memberEmail());
  const repository = new MemberNotificationRepository(mailgun, memberEmail);
  return { mailgun, memberEmail, repository };
}

describe('MemberNotificationRepository.sendOnboarding', () => {
  it('emails the onboarding link and logs the send', async () => {
    const { mailgun, memberEmail, repository } = setup();

    await repository.sendOnboarding(MEMBER, 'day_pass');

    expect(mailgun.sendTemplate).toHaveBeenCalledWith(
      'sam@example.com',
      'Starforge Foundry <contact@starforgefoundry.com>',
      'contact@starforgefoundry.com',
      'member_welcome',
      {
        memberName: 'Sam &lt;Smith&gt;',
        introMessage: 'Thanks for picking up a day pass at Starforge Foundry!',
        onboardingUrl: 'https://orion.example.com/member/onboard/onboarding-abc',
      },
    );
    expect(memberEmail.log).toHaveBeenCalledWith('member-1', 'onboarding', 'day_pass');
  });

  it.each(['manual', 'self_service'] as const)(
    'sends the existing-member template for %s sends',
    async (trigger) => {
      const { mailgun, repository } = setup();

      await repository.sendOnboarding(MEMBER, trigger);

      expect(mailgun.sendTemplate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'member_pass_setup',
        expect.anything(),
      );
    },
  );

  it('does not log when the email fails to send', async () => {
    const { mailgun, memberEmail, repository } = setup();
    mailgun.sendTemplate.mockRejectedValue(new Error('mailgun down'));

    await expect(repository.sendOnboarding(MEMBER, 'manual')).rejects.toThrow('mailgun down');
    expect(memberEmail.log).not.toHaveBeenCalled();
  });
});
