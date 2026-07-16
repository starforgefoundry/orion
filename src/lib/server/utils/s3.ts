import { env } from '$env/dynamic/private';
import { Buffer } from 'node:buffer';
import pRetry from 'p-retry';
import type S3mini from 's3mini';

export async function uploadToS3(s3: S3mini, file: File, filename: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  await pRetry(
    async () => {
      await s3.putObject(filename, buffer);
    },
    {
      onFailedAttempt(context) {
        console.warn(
          `Upload attempt (${context.attemptNumber}/${context.retriesLeft}) for ${filename} failed. Reason: ${context.error.message}`,
        );
      },
    },
  );

  return filename;
}

export function s3PublicUrl(key: string): string;
export function s3PublicUrl(key: string | null | undefined): string | null;
export function s3PublicUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return `${env.S3_PUBLIC_URL}/${key}`;
}
