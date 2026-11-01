const DATA_URL_PREFIX = 'data:';

export function decodeDataUrl(dataUrl: string) {
  const [header, base64] = dataUrl.split(',');
  return {
    contentType: header.slice(DATA_URL_PREFIX.length, header.indexOf(';')),
    body: Buffer.from(base64, 'base64'),
  };
}
