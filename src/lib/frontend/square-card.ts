import { themeColor } from '$lib/frontend/theme-color';
import { untrack } from 'svelte';
import type { Attachment } from 'svelte/attachments';

export type SquareCardConfig = {
  applicationId: string;
  locationId: string;
  webSdkUrl: string;
};

export type SquareCard = {
  attach(element: HTMLElement): Promise<void>;
  tokenize(): Promise<{ status: string; token?: string; errors?: unknown[] }>;
  destroy(): Promise<boolean>;
};

type SquareSdk = {
  payments(
    applicationId: string,
    locationId: string,
  ): {
    card(options: { style: Record<string, Record<string, string>> }): Promise<SquareCard>;
  };
};

declare global {
  interface Window {
    Square?: SquareSdk;
  }
}

let sdkLoading: Promise<SquareSdk> | undefined;

function loadSdk(url: string): Promise<SquareSdk> {
  sdkLoading ??= new Promise((resolve, reject) => {
    if (window.Square) return resolve(window.Square);

    const script = document.createElement('script');
    script.src = url;
    script.onload = () => (window.Square ? resolve(window.Square) : reject());
    script.onerror = () => {
      sdkLoading = undefined;
      script.remove();
      reject(new Error('Failed to load the Square payments SDK'));
    };
    document.head.appendChild(script);
  });
  return sdkLoading;
}

function cardStyle() {
  const muted = themeColor('--muted-foreground');
  const danger = themeColor('--destructive');

  return {
    input: { backgroundColor: themeColor('--background'), color: themeColor('--foreground') },
    'input::placeholder': { color: muted },
    '.input-container': { borderColor: themeColor('--input'), borderRadius: '8px' },
    '.input-container.is-focus': { borderColor: themeColor('--ring') },
    '.input-container.is-error': { borderColor: danger },
    '.message-text': { color: muted },
    '.message-text.is-error': { color: danger },
    '.message-icon': { color: muted },
    '.message-icon.is-error': { color: danger },
  };
}

/** Mounts a single Square card form in the element and tears it down when the element goes away. */
export function squareCard(
  config: SquareCardConfig,
  onReady: (card: SquareCard) => void,
): Attachment<HTMLElement> {
  return (element) => {
    let card: SquareCard | undefined;
    let removed = false;

    // Untracked so later re-renders never tear down and rebuild the payment iframe.
    untrack(() => mount()).catch((error) =>
      console.error('Failed to initialize Square payments:', error),
    );

    async function mount() {
      const sdk = await loadSdk(config.webSdkUrl);
      const created = await sdk
        .payments(config.applicationId, config.locationId)
        .card({ style: cardStyle() });

      if (removed) {
        await created.destroy();
        return;
      }

      await created.attach(element);
      card = created;
      onReady(created);
    }

    return () => {
      removed = true;
      card?.destroy();
    };
  };
}
