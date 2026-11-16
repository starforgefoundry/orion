import { EmailTemplateRepository } from '$lib/server/repositories/email-template.repository';
import { MemberEmailRepository } from '$lib/server/repositories/member-email.repository';
import { ResendRepository } from '$lib/server/repositories/resend.repository';
import { sendTemplate } from '$lib/server/utils/email';
import { factory } from '$test/factory';
import { automock } from '$test/utils';
import { describe, expect, it, vi } from 'vitest';
import { sendDayPass, sendOnboarding } from './member-notification';

vi.mock('$lib/server/utils/email', { spy: true });

const MEMBER = factory.member({
  id: 'member-1',
  email: 'sam@example.com',
  name: 'Sam <Smith>',
  onboardingToken: 'onboarding-abc',
});

function setup() {
  const repos = {
    emailTemplateRepository: automock(EmailTemplateRepository),
    resendRepository: automock(ResendRepository),
    memberEmailRepository: automock(MemberEmailRepository),
  };
  vi.mocked(sendTemplate).mockResolvedValue();
  repos.memberEmailRepository.log.mockResolvedValue(factory.memberEmail());
  return repos;
}

describe(sendOnboarding.name, () => {
  it('emails the onboarding link and logs the send', async () => {
    const repos = setup();

    await sendOnboarding(repos, MEMBER, 'day_pass');

    expect(sendTemplate).toHaveBeenCalledWith(
      repos,
      'sam@example.com',
      {
        from: 'Starforge Foundry <contact@starforgefoundry.com>',
        replyTo: 'contact@starforgefoundry.com',
      },
      'member_welcome',
      {
        memberName: 'Sam <Smith>',
        introMessage: 'Thanks for picking up a day pass at Starforge Foundry!',
        onboardingUrl: 'https://orion.example.com/member/onboard/onboarding-abc',
      },
    );
    expect(repos.memberEmailRepository.log).toHaveBeenCalledWith(
      'member-1',
      'onboarding',
      'day_pass',
    );
  });

  it.each(['manual', 'self_service'] as const)(
    'sends the existing-member template for %s sends',
    async (trigger) => {
      const repos = setup();

      await sendOnboarding(repos, MEMBER, trigger);

      expect(sendTemplate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'member_pass_setup',
        expect.anything(),
      );
    },
  );

  it('does not log when the email fails to send', async () => {
    const repos = setup();
    vi.mocked(sendTemplate).mockRejectedValue(new Error('resend down'));

    await expect(sendOnboarding(repos, MEMBER, 'manual')).rejects.toThrow('resend down');
    expect(repos.memberEmailRepository.log).not.toHaveBeenCalled();
  });
});

describe(sendDayPass.name, () => {
  it('emails the day pass QR code and logs the send', async () => {
    const repos = setup();

    await sendDayPass(repos, MEMBER, factory.dayPass({ passToken: 'day-abc' }));

    expect(sendTemplate).toHaveBeenCalledWith(
      repos,
      'sam@example.com',
      {
        from: 'Starforge Foundry <contact@starforgefoundry.com>',
        replyTo: 'contact@starforgefoundry.com',
      },
      'day_pass',
      {
        memberName: 'Sam <Smith>',
        passUrl: 'https://orion.example.com/pass/day-abc',
        passQrImageUrl: 'https://orion.example.com/api/pass/day-abc/qr',
      },
    );
    expect(repos.memberEmailRepository.log).toHaveBeenCalledWith(
      'member-1',
      'day_pass',
      'day_pass',
    );
  });
});
