import fontUrl from '$lib/assets/fonts/arimo-bold.ttf?url';
import type { FilamentCard } from './filament-card';

const MODEL_3MF_MIME = 'model/3mf';

let fontPromise: Promise<import('opentype.js').Font> | undefined;

function loadFont() {
  fontPromise ??= Promise.all([import('opentype.js'), fetch(fontUrl)]).then(
    async ([{ parse }, response]) => parse(await response.arrayBuffer()),
  );
  return fontPromise;
}

export async function downloadFilamentCard(card: FilamentCard, fileName: string) {
  const [font, { filamentCard3mf }] = await Promise.all([loadFont(), import('./filament-card')]);
  const bytes = await filamentCard3mf(font, card);

  const url = URL.createObjectURL(new Blob([bytes], { type: MODEL_3MF_MIME }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
