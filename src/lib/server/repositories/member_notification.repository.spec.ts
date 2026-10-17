import type { Member } from '$lib/server/db/schema';
import type { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import type { MemberEmailRepository } from '$lib/server/repositories/member_email.repository';
import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import { MemberNotificationRepository } from './member_notification.repository';

vi.mock('$env/dynamic/private', () => ({
  env: { FRONTEND_URL: 'https://orion.example.com' },
}));

const MEMBER: Member = {
  id: 'member-1',
  email: 'sam@example.com',
  name: 'Sam <Smith>',
  phone: null,
  squareCustomerId: null,
  passToken: 'token-abc',
  onboardingToken: 'onboarding-abc',
  createdDate: DateTime.now(),
};

function setup() {
  const mailgun = { sendTemplate: vi.fn().mockResolvedValue(undefined) };
  const memberEmail = { log: vi.fn().mockResolvedValue(undefined) };
  const repository = new MemberNotificationRepository(
    mailgun as unknown as MailgunRepository,
    memberEmail as unknown as MemberEmailRepository,
  );
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
      'Welcome to Starforge Foundry',
      'member_onboarding',
      {
        memberName: 'Sam &lt;Smith&gt;',
        introMessage: 'Thanks for picking up a day pass at Starforge Foundry!',
        setupMessage: expect.stringContaining('Before your first visit'),
        onboardingUrl: 'https://orion.example.com/member/onboard/onboarding-abc',
      },
    );
    expect(memberEmail.log).toHaveBeenCalledWith('member-1', 'onboarding', 'day_pass');
  });

  it.each(['manual', 'self_service'] as const)(
    'sends existing-member copy for %s sends',
    async (trigger) => {
      const { mailgun, repository } = setup();

      await repository.sendOnboarding(MEMBER, trigger);

      expect(mailgun.sendTemplate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'Set up your Starforge Foundry member pass',
        'member_onboarding',
        expect.objectContaining({
          setupMessage: expect.stringContaining('before your next visit'),
        }),
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
