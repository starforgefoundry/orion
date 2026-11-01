import type { SquareCard } from '$lib/frontend/square-card';
import { toast } from 'svelte-sonner';
import { describe, expect, it, vi } from 'vitest';
import { CARD_ERROR_MESSAGE, SquarePayment } from './square-payment.svelte';

vi.mock('svelte-sonner', () => ({ toast: { error: vi.fn() } }));

const TOKEN = 'cnon:card-token';

function cardReturning(result: Awaited<ReturnType<SquareCard['tokenize']>>): SquareCard {
  return {
    attach: vi.fn(),
    tokenize: vi.fn().mockResolvedValue(result),
    destroy: vi.fn(),
  };
}

function paymentWith(card: SquareCard) {
  const payment = new SquarePayment();
  payment.card = card;
  return payment;
}

describe(SquarePayment.name, () => {
  it('is not ready until a card mounts', () => {
    const payment = new SquarePayment();
    expect(payment.ready).toBe(false);

    payment.card = cardReturning({ status: 'OK', token: TOKEN });
    expect(payment.ready).toBe(true);

    payment.reset();
    expect(payment.ready).toBe(false);
  });

  it('charges the tokenized card', async () => {
    const charge = vi.fn().mockResolvedValue(undefined);
    const payment = paymentWith(cardReturning({ status: 'OK', token: TOKEN }));

    await expect(payment.pay(charge, 'Failed')).resolves.toBe(true);
    expect(charge).toHaveBeenCalledWith(TOKEN);
    expect(payment.paying).toBe(false);
  });

  it('does not charge when the card does not tokenize', async () => {
    const charge = vi.fn();
    const payment = paymentWith(cardReturning({ status: 'Invalid', errors: [] }));

    await expect(payment.pay(charge, 'Failed')).resolves.toBe(false);
    expect(charge).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(CARD_ERROR_MESSAGE);
  });

  it('shows the server message when the charge fails', async () => {
    const charge = vi.fn().mockRejectedValue({ body: { message: 'Class is full' } });
    const payment = paymentWith(cardReturning({ status: 'OK', token: TOKEN }));

    await expect(payment.pay(charge, 'Booking failed')).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Booking failed', { description: 'Class is full' });
    expect(payment.paying).toBe(false);
  });

  it('does nothing without a card', async () => {
    const charge = vi.fn();

    await expect(new SquarePayment().pay(charge, 'Failed')).resolves.toBe(false);
    expect(charge).not.toHaveBeenCalled();
  });
});
