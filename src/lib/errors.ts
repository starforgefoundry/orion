import { HTTP_STATUS } from '$lib/http';

/** An error whose message is safe to show the person who caused it. */
export class UserError extends Error {
  readonly status: number = HTTP_STATUS.BAD_REQUEST;
}

export class NotFoundError extends UserError {
  override readonly status = HTTP_STATUS.NOT_FOUND;
}

export class ConflictError extends UserError {
  override readonly status = HTTP_STATUS.CONFLICT;
}
