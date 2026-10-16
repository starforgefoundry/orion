import { WAIVER_SOURCE } from '$lib/member_enums';
import {
  WALLET_PROVIDER,
  type MemberPassDto,
  type OnboardingDto,
  type SubmitOnboardingWaiverDto,
  type WalletProvider,
} from '$lib/remotes/dtos/onboarding.dto';
import { BaseService } from '$lib/server/services/base.service';
import { appleWalletConfig, buildApplePass } from '$lib/server/utils/apple_wallet';
import { googleWalletConfig, googleWalletSaveUrl } from '$lib/server/utils/google_wallet';
import { passUrl } from '$lib/server/utils/member_links';

export class OnboardingService extends BaseService {
  async getMemberPass(token: string): Promise<MemberPassDto | undefined> {
    const member = await this.memberRepository.getByPassToken(token);
    if (!member) return undefined;

    return { name: member.name, passUrl: passUrl(member), wallets: this.availableWallets() };
  }

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
      wallets: this.availableWallets(),
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

  async getGoogleWalletUrl(token: string): Promise<string | undefined> {
    const config = googleWalletConfig();
    if (!config) return undefined;

    const member = await this.memberRepository.getByPassToken(token);
    if (!member) return undefined;

    return googleWalletSaveUrl(member, config);
  }

  async getApplePass(token: string): Promise<Buffer | undefined> {
    const config = appleWalletConfig();
    if (!config) return undefined;

    const member = await this.memberRepository.getByPassToken(token);
    if (!member) return undefined;

    return buildApplePass(member, config);
  }

  private availableWallets(): WalletProvider[] {
    const configured: Record<WalletProvider, boolean> = {
      [WALLET_PROVIDER.APPLE]: Boolean(appleWalletConfig()),
      [WALLET_PROVIDER.GOOGLE]: Boolean(googleWalletConfig()),
    };
    return Object.values(WALLET_PROVIDER).filter((provider) => configured[provider]);
  }
}

export const onboardingService = new OnboardingService();
