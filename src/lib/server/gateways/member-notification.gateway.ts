import {
  MEMBER_EMAIL_TRIGGER,
  MEMBER_EMAIL_TYPE,
  type MemberEmailTrigger,
} from '$lib/utils/member-enums';
import type { DayPass, Member } from '$lib/server/db/schema';
import type { MailgunGateway } from '$lib/server/gateways/mailgun.gateway';
import type { MemberEmailRepository } from '$lib/server/repositories/member-email.repository';
import { SENDERS } from '$lib/server/utils/email-templates/senders';
import { onboardingUrl, passLinks } from '$lib/server/utils/member-links';
import type { EmailTemplateKey } from '$lib/utils/email-templates';

const DAY_PASS_TEMPLATE: EmailTemplateKey = 'day_pass';

type OnboardingTemplate = Extract<EmailTemplateKey, 'member_welcome' | 'member_pass_setup'>;

const ONBOARDING_TEMPLATE: Record<MemberEmailTrigger, OnboardingTemplate> = {
  [MEMBER_EMAIL_TRIGGER.SUBSCRIPTION]: 'member_welcome',
  [MEMBER_EMAIL_TRIGGER.ORGANIZATION]: 'member_welcome',
  [MEMBER_EMAIL_TRIGGER.DAY_PASS]: 'member_welcome',
  [MEMBER_EMAIL_TRIGGER.MANUAL]: 'member_pass_setup',
  [MEMBER_EMAIL_TRIGGER.SELF_SERVICE]: 'member_pass_setup',
};

const ONBOARDING_INTRO: Record<MemberEmailTrigger, string> = {
  [MEMBER_EMAIL_TRIGGER.SUBSCRIPTION]: 'Thanks for becoming a member of Starforge Foundry!',
  [MEMBER_EMAIL_TRIGGER.ORGANIZATION]:
    'Your organization has given you access to Starforge Foundry.',
  [MEMBER_EMAIL_TRIGGER.DAY_PASS]: 'Thanks for picking up a day pass at Starforge Foundry!',
  [MEMBER_EMAIL_TRIGGER.MANUAL]:
    'Thanks for being a member of Starforge Foundry! Check-in now uses a digital member pass.',
  [MEMBER_EMAIL_TRIGGER.SELF_SERVICE]: 'Here is the member pass link you asked for.',
};

/** Emails members their passes and records each send. */
export class MemberNotificationGateway {
  constructor(
    private readonly mailgunGateway: MailgunGateway,
    private readonly memberEmailRepository: MemberEmailRepository,
  ) {}

  async sendOnboarding(member: Member, trigger: MemberEmailTrigger): Promise<void> {
    await this.mailgunGateway.sendTemplate(
      member.email,
      SENDERS.members,
      ONBOARDING_TEMPLATE[trigger],
      {
        memberName: member.name,
        introMessage: ONBOARDING_INTRO[trigger],
        onboardingUrl: onboardingUrl(member),
      },
    );
    await this.memberEmailRepository.log(member.id, MEMBER_EMAIL_TYPE.ONBOARDING, trigger);
  }

  async sendDayPass(member: Member, dayPass: DayPass): Promise<void> {
    await this.mailgunGateway.sendTemplate(member.email, SENDERS.members, DAY_PASS_TEMPLATE, {
      memberName: member.name,
      ...passLinks(dayPass),
    });
    await this.memberEmailRepository.log(
      member.id,
      MEMBER_EMAIL_TYPE.DAY_PASS,
      MEMBER_EMAIL_TRIGGER.DAY_PASS,
    );
  }
}
