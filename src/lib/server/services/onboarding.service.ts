import {
  ACCESS_BASIS,
  MEMBER_EMAIL_TRIGGER,
  MEMBER_EMAIL_TYPE,
  WAIVER_SOURCE,
} from '$lib/member_enums';
import type { OnboardingDto, SubmitOnboardingWaiverDto } from '$lib/remotes/dtos/onboarding.dto';
import { BaseService } from '$lib/server/services/base.service';
import { belongsToOrganization, resolveAccess } from '$lib/server/utils/member_access';
import { passUrl } from '$lib/server/utils/member_links';
import { availableWallets } from '$lib/server/utils/wallet_providers';
import { DateTime, Duration } from 'luxon';

/** Keeps the public form from being used to flood a member's inbox. */
export const PASS_EMAIL_COOLDOWN = Duration.fromObject({ minutes: 10 });

export class OnboardingService extends BaseService {
  async getOnboarding(onboardingToken: string): Promise<OnboardingDto | undefined> {
    const member = await this.memberRepository.getByOnboardingToken(onboardingToken);
    if (!member) return undefined;

    const access = await this.memberRepository.getAccessContext(member.id);

    return {
      name: member.name,
      email: member.email,
      passToken: member.passToken,
      passUrl: passUrl(member),
      hasWaiver: access?.hasWaiver ?? false,
      wallets: availableWallets(),
    };
  }

  /** Returns false when the token matches no member. Signing again is a no-op. */
  async submitWaiver(dto: SubmitOnboardingWaiverDto): Promise<boolean> {
    const member = await this.memberRepository.getByOnboardingToken(dto.token);
    if (!member) return false;

    const access = await this.memberRepository.getAccessContext(member.id);
    if (access?.hasWaiver) return true;

    await this.waiverRepository.submit(
      { name: dto.name, email: member.email, signature: dto.signature, isAdult: dto.isAdult },
      member.id,
      WAIVER_SOURCE.WEB,
    );
    return true;
  }

  /** Stays silent for unknown or inactive emails so the form never reveals who is a member. */
  async requestOnboardingEmail(email: string) {
    const context = await this.memberRepository.getAccessContextByEmail(email);
    if (!context) return;

    const now = DateTime.now();
    const hasAccess = resolveAccess(context, now).basis !== ACCESS_BASIS.NONE;
    if (!hasAccess && !belongsToOrganization(context)) return;

    const emails = await this.memberEmailRepository.listByMember(context.member.id);
    const lastOnboarding = emails.find((sent) => sent.type === MEMBER_EMAIL_TYPE.ONBOARDING);
    if (lastOnboarding && now.diff(lastOnboarding.sentDate) < PASS_EMAIL_COOLDOWN) return;

    await this.memberNotificationRepository.sendOnboarding(
      context.member,
      MEMBER_EMAIL_TRIGGER.SELF_SERVICE,
    );
  }
}

export const onboardingService = new OnboardingService();
