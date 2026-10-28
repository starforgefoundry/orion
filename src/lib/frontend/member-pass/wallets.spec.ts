import { WALLET_PROVIDER } from '$lib/remotes/dtos/pass.dto';
import { describe, expect, it } from 'vitest';
import { walletsForDevice } from './wallets';

const BOTH = [WALLET_PROVIDER.APPLE, WALLET_PROVIDER.GOOGLE];
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0';

describe('walletsForDevice', () => {
  it('puts Google Wallet first on Android', () => {
    expect(walletsForDevice(BOTH, ANDROID)).toEqual([
      WALLET_PROVIDER.GOOGLE,
      WALLET_PROVIDER.APPLE,
    ]);
  });

  it('puts Apple Wallet first on iPhone', () => {
    expect(walletsForDevice([WALLET_PROVIDER.GOOGLE, WALLET_PROVIDER.APPLE], IPHONE)).toEqual([
      WALLET_PROVIDER.APPLE,
      WALLET_PROVIDER.GOOGLE,
    ]);
  });

  it('keeps the configured order on other devices', () => {
    expect(walletsForDevice(BOTH, WINDOWS)).toEqual(BOTH);
  });

  it('only returns configured wallets', () => {
    expect(walletsForDevice([WALLET_PROVIDER.GOOGLE], IPHONE)).toEqual([WALLET_PROVIDER.GOOGLE]);
  });
});
