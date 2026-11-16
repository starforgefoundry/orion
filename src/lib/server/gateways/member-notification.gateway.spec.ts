import { ResendGateway } from '$lib/server/gateways/resend.gateway';
import { MemberEmailRepository } from '$lib/server/repositories/member-email.repository';
import { factory } from '$test/factory';
import { automock } from '$test/utils';
import { describe, expect, it } from 'vitest';
import { MemberNotificationGateway } from './member-notification.gateway';

const MEMBER = factory.member({
  id: 'member-1',
  email: 'sam@example.com',
  name: 'Sam <Smith>',
  onboardingToken: 'onboarding-abc',
});

function setup() {
  const resend = automock(ResendGateway);
  const memberEmail = automock(MemberEmailRepository);
  resend.sendTemplate.mockResolvedValue(undefined as never);
  memberEmail.log.mockResolvedValue(factory.memberEmail());
  const repository = new MemberNotificationGateway(resend, memberEmail);
  return { resend, memberEmail, repository };
}

describe('MemberNotificationGateway.sendOnboarding', () => {
  it('emails the onboarding link and logs the send', async () => {
    const { resend, memberEmail, repository } = setup();

    await repository.sendOnboarding(MEMBER, 'day_pass');

    expect(resend.sendTemplate).toHaveBeenCalledWith(
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
    expect(memberEmail.log).toHaveBeenCalledWith('member-1', 'onboarding', 'day_pass');
  });

  it.each(['manual', 'self_service'] as const)(
    'sends the existing-member template for %s sends',
    async (trigger) => {
      const { resend, repository } = setup();

      await repository.sendOnboarding(MEMBER, trigger);

      expect(resend.sendTemplate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'member_pass_setup',
        expect.anything(),
      );
    },
  );

  it('does not log when the email fails to send', async () => {
    const { resend, memberEmail, repository } = setup();
    resend.sendTemplate.mockRejectedValue(new Error('resend down'));

    await expect(repository.sendOnboarding(MEMBER, 'manual')).rejects.toThrow('resend down');
    expect(memberEmail.log).not.toHaveBeenCalled();
  });
});

describe('MemberNotificationGateway.sendDayPass', () => {
  it('emails the day pass QR code and logs the send', async () => {
    const { resend, memberEmail, repository } = setup();

    await repository.sendDayPass(MEMBER, factory.dayPass({ passToken: 'day-abc' }));

    expect(resend.sendTemplate).toHaveBeenCalledWith(
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
    expect(memberEmail.log).toHaveBeenCalledWith('member-1', 'day_pass', 'day_pass');
  });
});
