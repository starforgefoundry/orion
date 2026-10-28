import appleWalletBadge from '$lib/assets/wallet/apple-wallet-badge.svg';
import googleWalletBadge from '$lib/assets/wallet/google-wallet-badge.svg';
import { WALLET_PROVIDER, type WalletProvider } from '$lib/remotes/dtos/pass.dto';

type WalletLink = {
  label: string;
  href: (token: string) => string;
  badge: string;
};

export const WALLET_LINKS: Record<WalletProvider, WalletLink> = {
  [WALLET_PROVIDER.APPLE]: {
    label: 'Add to Apple Wallet',
    href: (token) => `/api/pass/${token}/apple-wallet`,
    badge: appleWalletBadge,
  },
  [WALLET_PROVIDER.GOOGLE]: {
    label: 'Add to Google Wallet',
    href: (token) => `/api/pass/${token}/google-wallet`,
    badge: googleWalletBadge,
  },
};

const DEVICE_WALLETS: { pattern: RegExp; wallet: WalletProvider }[] = [
  { pattern: /Android/i, wallet: WALLET_PROVIDER.GOOGLE },
  { pattern: /iPhone|iPad|iPod|Macintosh/i, wallet: WALLET_PROVIDER.APPLE },
];

/** Puts the wallet that matches the visitor's device first. */
export function walletsForDevice(wallets: WalletProvider[], userAgent: string) {
  const preferred = DEVICE_WALLETS.find(({ pattern }) => pattern.test(userAgent))?.wallet;
  return wallets.toSorted((a, b) => Number(b === preferred) - Number(a === preferred));
}
