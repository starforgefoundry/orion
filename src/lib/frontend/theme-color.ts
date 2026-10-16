const BACKDROP_VARIABLE = '--background';

/**
 * Resolves a theme CSS variable (e.g. `--card`) to an opaque hex color, for embeds such as
 * third-party iframes that can't read our variables or parse `oklch()`. Translucent colors are
 * blended over the page background so they look the same as they do in the app.
 */
export function themeColor(variable: string): string {
  const styles = getComputedStyle(document.documentElement);

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  for (const layer of [BACKDROP_VARIABLE, variable]) {
    context.fillStyle = styles.getPropertyValue(layer).trim();
    context.fillRect(0, 0, 1, 1);
  }

  const channels = context.getImageData(0, 0, 1, 1).data.slice(0, 3);
  return `#${Array.from(channels, (channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
