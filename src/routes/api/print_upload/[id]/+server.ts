import { printRequestRepository } from '$lib/server/repositories/print_request.repository';
import { s3Repository } from '$lib/server/repositories/s3.repository';
import { type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, params }) => {
  if (!params.id) {
    return new Response('Print request ID is required', { status: 400 });
  }

  const formData = Object.fromEntries(await request.formData());
  if (!(formData.upload instanceof File) || formData.upload.size === 0 || !formData.upload.name) {
    return new Response('Invalid file upload', { status: 400 });
  }

  if (!(formData.quantity) || isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0) {
    return new Response('Invalid quantity', { status: 400 });
  }

  const { upload } = formData as { upload: File };

  const printRequest = await printRequestRepository.getById(params.id);
  if (!printRequest || printRequest.submissionDate.diffNow().as('minutes') > 10) {
    return new Response('Print request not found or too old to upload', { status: 404 });
  }

  await s3Repository.uploadToS3(upload, `print_requests/${params.id}/${upload.name}`);

  return new Response(
    JSON.stringify({
      success: true,
    }),
  );
};
