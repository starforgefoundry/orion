import type { PrintRequestFile } from '$lib/server/db/schema';
import { updatePartQuantity } from '$lib/remotes/endpoints/print_request.remote';

export class QuantityEditor {
  isEditing = $state(false);
  quantities = $state<Record<string, number>>({});
  #original: Record<string, number> = {};

  start(files: PrintRequestFile[]) {
    this.#original = Object.fromEntries(files.map((file) => [file.id, file.quantity]));
    this.quantities = { ...this.#original };
    this.isEditing = true;
  }

  cancel() {
    this.quantities = {};
    this.isEditing = false;
  }

  async save(requestId: string) {
    const changed = Object.entries(this.quantities).filter(
      ([fileId, quantity]) => this.#original[fileId] !== quantity,
    );

    for (const [partId, quantity] of changed) {
      await updatePartQuantity({ id: requestId, partId, quantity });
    }

    this.cancel();
  }
}
