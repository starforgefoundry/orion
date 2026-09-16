import { refreshBambuCredentials } from '$lib/remotes/endpoints/settings.remote';

type SignedInProfile = {
  account: string;
  name: string;
  userId: string;
};

const FALLBACK_ERROR = 'Sign in failed. Please try again.';

// A rejected command arrives as an HttpError, which carries its message in `body`
// and is not an Error instance.
function readErrorMessage(cause: unknown) {
  if (typeof cause === 'object' && cause !== null && 'body' in cause) {
    const body = (cause as { body?: { message?: string } }).body;
    if (body?.message) {
      return body.message;
    }
  }

  return cause instanceof Error ? cause.message : FALLBACK_ERROR;
}

export class BambuLoginManager {
  account = $state('');
  password = $state('');
  tfaCode = $state('');

  isSubmitting = $state(false);
  error = $state<string | undefined>();
  profile = $state<SignedInProfile | undefined>();

  canSubmit = $derived(
    !this.isSubmitting &&
      this.account.trim().length > 0 &&
      this.password.length > 0 &&
      /^\d{6}$/.test(this.tfaCode),
  );

  async submit() {
    if (!this.canSubmit) {
      return;
    }

    this.isSubmitting = true;
    this.error = undefined;

    try {
      this.profile = await refreshBambuCredentials({
        account: this.account.trim(),
        password: this.password,
        tfaCode: this.tfaCode,
      });
      this.password = '';
      this.tfaCode = '';
    } catch (error) {
      this.error = readErrorMessage(error);
      this.tfaCode = '';
    } finally {
      this.isSubmitting = false;
    }
  }
}
