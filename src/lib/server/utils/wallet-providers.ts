import { WALLET_PROVIDER, type WalletProvider } from '$lib/remotes/dtos/pass.dto';
import { appleWalletConfig } from '$lib/server/utils/apple-wallet';
import { googleWalletConfig } from '$lib/server/utils/google-wallet';

export function availableWallets(): WalletProvider[] {
  const configured: Record<WalletProvider, boolean> = {
    [WALLET_PROVIDER.APPLE]: Boolean(appleWalletConfig()),
    [WALLET_PROVIDER.GOOGLE]: Boolean(googleWalletConfig()),
  };
  return Object.values(WALLET_PROVIDER).filter((provider) => configured[provider]);
}
