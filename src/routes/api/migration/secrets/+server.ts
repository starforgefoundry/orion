import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { error, type RequestHandler } from '@sveltejs/kit';

const PRIVATE_KEYS = [
  'AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  'SQUARE_TOKEN',
  'SQUARE_URL',
  'SQUARE_APPLICATION_ID',
  'SQUARE_WEBHOOK_SIGNATURE_KEY',
  'SQUARE_WEBHOOK_NOTIFICATION_URL',
  'MAILGUN_API_KEY',
  'FRONTEND_URL',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_APPLICATION_KEY',
  'S3_PUBLIC_URL',
];

const PUBLIC_KEYS = ['PUBLIC_ENV', 'PUBLIC_PRINT_REQUEST_EMAIL'] as const;

function dotenvLine(key: string, value: string | undefined) {
  return `${key}=${JSON.stringify(value ?? '')}`;
}

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) error(401, 'Unauthorized');

  console.warn(`Migration secrets exported by ${locals.user.email}`);

  const lines = [
    ...PRIVATE_KEYS.map((key) => dotenvLine(key, env[key])),
    ...PUBLIC_KEYS.map((key) => dotenvLine(key, publicEnv[key])),
  ];

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};
