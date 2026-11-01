import { errorDescription } from '$lib/frontend/form-submit';
import { squareCard, type SquareCard, type SquareCardConfig } from '$lib/frontend/square-card';
import { toast } from 'svelte-sonner';

const TOKENIZED = 'OK';

export const CARD_ERROR_MESSAGE = 'Payment card error. Please check your card details.';

/** One Square card form: holds the mounted card and turns it into a charge. */
export class SquarePayment {
  card = $state<SquareCard>();
  paying = $state(false);

  readonly ready = $derived(this.card !== undefined);

  attach(config: SquareCardConfig) {
    return squareCard(config, (card) => (this.card = card));
  }

  /** Forgets the card, for when its form leaves the page. */
  reset() {
    this.card = undefined;
  }

  /**
   * Tokenizes the card and passes the token to `charge`. Failures are shown as a toast titled
   * `failureTitle`. Resolves to whether the charge went through.
   */
  async pay(charge: (sourceId: string) => Promise<unknown>, failureTitle: string) {
    if (!this.card || this.paying) return false;

    this.paying = true;
    try {
      const result = await this.card.tokenize();
      if (result.status !== TOKENIZED || !result.token) {
        toast.error(CARD_ERROR_MESSAGE);
        return false;
      }
      await charge(result.token);
      return true;
    } catch (error) {
      toast.error(failureTitle, { description: errorDescription(error) });
      return false;
    } finally {
      this.paying = false;
    }
  }
}
