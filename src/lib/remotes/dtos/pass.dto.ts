import type { EnumValue } from '$lib/utils/member-enums';

export const WALLET_PROVIDER = {
  APPLE: 'apple',
  GOOGLE: 'google',
} as const;

export type WalletProvider = EnumValue<typeof WALLET_PROVIDER>;

export type PassDto = {
  title: string;
  holderName: string;
  passUrl: string;
  fields: { label: string; value: string }[];
  wallets: WalletProvider[];
};
