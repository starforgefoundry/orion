import qrcode from 'qrcode-generator';

const QR_TYPE_NUMBER_AUTO = 0;
const QR_ERROR_CORRECTION = 'M';

export function makeQr(qrValue: string) {
  const qr = qrcode(QR_TYPE_NUMBER_AUTO, QR_ERROR_CORRECTION);
  qr.addData(qrValue);
  qr.make();
  return qr;
}

/** A scalable SVG of the QR code alone, for display. */
export function renderQrSvg(qrValue: string) {
  return makeQr(qrValue).createSvgTag({ margin: 0, scalable: true });
}
