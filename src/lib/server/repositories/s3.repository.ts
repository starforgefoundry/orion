import { env } from '$env/dynamic/private';
import pRetry from 'p-retry';
import S3mini from 's3mini';

function getS3() {
  return new S3mini({
    accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: env.S3_APPLICATION_KEY ?? '',
    endpoint: env.S3_ENDPOINT ?? '',
  });
}

async function uploadToS3(file: File, filename: string) {
  const s3 = getS3();

  // Convert File to buffer
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

  return `https://${env.S3_ENDPOINT}/${filename}`;
}

export const s3Repository = {
  uploadToS3,
};
