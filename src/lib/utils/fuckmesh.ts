import { env } from '$env/dynamic/public';
import { fileExtension } from '$lib/utils/print-request';

const DEFAULT_FUCKMESH_URL = 'https://fuckmesh.starforgefoundry.com';
const DEEPLINK_PARAM = 'url';
const MODEL_EXTENSIONS = ['stl', '3mf', 'zip'];

function baseUrl() {
  return new URL(env.PUBLIC_FUCKMESH_URL || DEFAULT_FUCKMESH_URL);
}

export function fuckmeshOrigin() {
  return baseUrl().origin;
}

/** Fuckmesh fetches `fileUrl` itself, so it must be absolute and work without a session. */
export function fuckmeshUrl(fileUrl: string) {
  const url = baseUrl();
  url.search = `${DEEPLINK_PARAM}=${encodeURIComponent(fileUrl)}`;
  return url.href;
}

export function opensInFuckmesh(fileName: string) {
  return MODEL_EXTENSIONS.includes(fileExtension(fileName));
}
