import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
  const itemId = params.id;

  try {
    // Fetch the inventory item
    const itemResponse = await fetch(`/api/inventory/${itemId}`);

    if (!itemResponse.ok) {
      throw new Error('Item not found');
    }

    const item = await itemResponse.json();

    // Add to purchase list
    await fetch('/api/inventory/purchase-list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inventoryItemId: itemId }),
    });

    return {
      item,
    };
  } catch (error) {
    return {
      error: 'Item not found or could not be added to purchase list',
    };
  }
};
