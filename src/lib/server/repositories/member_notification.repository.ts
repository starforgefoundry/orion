import {
  MEMBER_EMAIL_TRIGGER,
  MEMBER_EMAIL_TYPE,
  type MemberEmailTrigger,
} from '$lib/member_enums';
import type { Member } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { MailgunRepository } from '$lib/server/repositories/mailgun.repository';
import { MemberEmailRepository } from '$lib/server/repositories/member_email.repository';
import { onboardingUrl } from '$lib/server/utils/member_links';

const MEMBER_EMAIL_REPLY_TO = 'contact@starforgefoundry.com';
const MEMBER_EMAIL_FROM = `Starforge Foundry <${MEMBER_EMAIL_REPLY_TO}>`;
const ONBOARDING_TEMPLATE = 'member_onboarding';

type OnboardingCopy = { subject: string; setupMessage: string };

const NEW_MEMBER_COPY: OnboardingCopy = {
  subject: 'Welcome to Starforge Foundry',
  setupMessage:
    "Before your first visit, finish setting up your access. It only takes a minute: sign the liability waiver if you haven't already, then add your member pass to your phone. Scan the pass at the front door kiosk each time you visit.",
};

const EXISTING_MEMBER_COPY: OnboardingCopy = {
  subject: 'Set up your Starforge Foundry member pass',
  setupMessage:
    "Set up your pass before your next visit. It only takes a minute: sign the liability waiver if you haven't already, then add the pass to your phone. From then on, scan it at the front door kiosk to check in.",
};

const ONBOARDING_COPY: Record<MemberEmailTrigger, OnboardingCopy> = {
  [MEMBER_EMAIL_TRIGGER.SUBSCRIPTION]: NEW_MEMBER_COPY,
  [MEMBER_EMAIL_TRIGGER.ORGANIZATION]: NEW_MEMBER_COPY,
  [MEMBER_EMAIL_TRIGGER.DAY_PASS]: NEW_MEMBER_COPY,
  [MEMBER_EMAIL_TRIGGER.MANUAL]: EXISTING_MEMBER_COPY,
  [MEMBER_EMAIL_TRIGGER.SELF_SERVICE]: EXISTING_MEMBER_COPY,
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

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export class MemberNotificationRepository extends BaseRepository {
  private mailgunRepository: MailgunRepository;
  private memberEmailRepository: MemberEmailRepository;

  constructor(
    mailgunRepository?: MailgunRepository,
    memberEmailRepository?: MemberEmailRepository,
  ) {
    super();
    this.mailgunRepository = mailgunRepository ?? new MailgunRepository();
    this.memberEmailRepository = memberEmailRepository ?? new MemberEmailRepository();
  }

  async sendOnboarding(member: Member, trigger: MemberEmailTrigger): Promise<void> {
    const copy = ONBOARDING_COPY[trigger];
    await this.mailgunRepository.sendTemplate(
      member.email,
      MEMBER_EMAIL_FROM,
      MEMBER_EMAIL_REPLY_TO,
      ONBOARDING_TEMPLATE,
      {
        subject: copy.subject,
        memberName: escapeHtml(member.name),
        introMessage: ONBOARDING_INTRO[trigger],
        setupMessage: copy.setupMessage,
        onboardingUrl: onboardingUrl(member),
      },
    );
    await this.memberEmailRepository.log(member.id, MEMBER_EMAIL_TYPE.ONBOARDING, trigger);
  }
}
