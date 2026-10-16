import * as v from 'valibot';

export const WALLET_PROVIDER = {
  APPLE: 'apple',
  GOOGLE: 'google',
} as const;

export type WalletProvider = (typeof WALLET_PROVIDER)[keyof typeof WALLET_PROVIDER];

export const submitOnboardingWaiverDto = v.object({
  token: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  signature: v.file(),
  isAdult: v.pipe(
    v.optional(v.boolean(), false),
    v.check((isAdult) => isAdult, 'You must be 18 or older to use the space'),
  ),
});

export type SubmitOnboardingWaiverDto = v.InferOutput<typeof submitOnboardingWaiverDto>;

export type MemberPassDto = {
  name: string;
  passUrl: string;
  wallets: WalletProvider[];
};

export type OnboardingDto = MemberPassDto & {
  email: string;
  passToken: string;
  hasWaiver: boolean;
};
