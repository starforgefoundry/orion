import { env } from '$env/dynamic/private';
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

  // Convert File to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await s3.putObject(filename, buffer);

  return `https://${env.S3_ENDPOINT}/${filename}`;
}

export const s3Repository = {
  uploadToS3,
};
