export const INVENTORY_LABEL_ITEM_PARAM = 'item';

const INVENTORY_LABELS_PATH = '/staff/inventory/labels';

/** The print page for labels of the given inventory items. */
export function inventoryLabelsHref(itemIds: string[]) {
  const params = new URLSearchParams(itemIds.map((id) => [INVENTORY_LABEL_ITEM_PARAM, id]));
  return `${INVENTORY_LABELS_PATH}?${params}`;
}
