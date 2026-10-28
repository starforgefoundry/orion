import logo from '$lib/assets/logo.png';
import qrcode from 'qrcode-generator';

const QR_TYPE_NUMBER_AUTO = 0;
const QR_ERROR_CORRECTION = 'M';
const QUIET_ZONE_MODULES = 4;
const IMAGE_TYPE = 'image/png';

export const PASS_COLORS = {
  navy: '#0e1630',
  gold: '#f2c446',
  white: '#ffffff',
  divider: 'rgba(255, 255, 255, 0.12)',
  ink: '#000000',
};

const LAYOUT = {
  width: 720,
  padding: 48,
  headerHeight: 168,
  logoSize: 80,
  qrBoxSize: 528,
  qrBoxPadding: 28,
  qrBoxRadius: 40,
  qrTopGap: 56,
  nameGap: 72,
  bottomPadding: 64,
};

const FONTS = {
  title: '700 40px system-ui, sans-serif',
  label: '600 24px system-ui, sans-serif',
  name: '700 52px system-ui, sans-serif',
};

const TITLE = 'Starforge Foundry';
const LABEL_LETTER_SPACING = '4px';

function makeQr(qrValue: string) {
  const qr = qrcode(QR_TYPE_NUMBER_AUTO, QR_ERROR_CORRECTION);
  qr.addData(qrValue);
  qr.make();
  return qr;
}

/** A scalable SVG of the QR code alone, for display. */
export function renderQrSvg(qrValue: string) {
  return makeQr(qrValue).createSvgTag({ margin: 0, scalable: true });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawQr(context: CanvasRenderingContext2D, qrValue: string, x: number, y: number) {
  const qr = makeQr(qrValue);
  const modules = qr.getModuleCount();
  const inner = LAYOUT.qrBoxSize - LAYOUT.qrBoxPadding * 2;
  const moduleSize = Math.floor(inner / modules);
  const offset = (LAYOUT.qrBoxSize - moduleSize * modules) / 2;

  context.fillStyle = PASS_COLORS.white;
  context.beginPath();
  context.roundRect(x, y, LAYOUT.qrBoxSize, LAYOUT.qrBoxSize, LAYOUT.qrBoxRadius);
  context.fill();

  context.fillStyle = PASS_COLORS.ink;
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (!qr.isDark(row, col)) continue;
      context.fillRect(
        x + offset + col * moduleSize,
        y + offset + row * moduleSize,
        moduleSize,
        moduleSize,
      );
    }
  }
}

export async function renderPassImage(qrValue: string, name: string, label: string) {
  const { width, padding, headerHeight } = LAYOUT;
  const qrTop = headerHeight + LAYOUT.qrTopGap;
  const nameY = qrTop + LAYOUT.qrBoxSize + LAYOUT.nameGap;
  const height = nameY + LAYOUT.bottomPadding;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported');

  context.fillStyle = PASS_COLORS.navy;
  context.fillRect(0, 0, width, height);

  const logoImage = await loadImage(logo);
  const logoHeight = (LAYOUT.logoSize * logoImage.height) / logoImage.width;
  context.drawImage(
    logoImage,
    padding,
    (headerHeight - logoHeight) / 2,
    LAYOUT.logoSize,
    logoHeight,
  );

  const textX = padding + LAYOUT.logoSize + 24;
  context.textBaseline = 'alphabetic';
  context.fillStyle = PASS_COLORS.white;
  context.font = FONTS.title;
  context.fillText(TITLE, textX, headerHeight / 2 - 4);
  context.fillStyle = PASS_COLORS.gold;
  context.font = FONTS.label;
  context.letterSpacing = LABEL_LETTER_SPACING;
  context.fillText(label.toUpperCase(), textX, headerHeight / 2 + 36);
  context.letterSpacing = '0px';

  context.fillStyle = PASS_COLORS.divider;
  context.fillRect(0, headerHeight, width, 2);

  drawQr(context, qrValue, (width - LAYOUT.qrBoxSize) / 2, qrTop);

  context.textAlign = 'center';
  context.fillStyle = PASS_COLORS.white;
  context.font = FONTS.name;
  context.fillText(name, width / 2, nameY, width - padding * 2);

  return canvas.toDataURL(IMAGE_TYPE);
}

export function passImageFilename(name: string) {
  return `${name.replace(/[^a-zA-Z0-9_-]+/g, '_')}_starforge_pass.png`;
}
