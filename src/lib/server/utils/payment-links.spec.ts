import { factory } from '$test/factory';
import { describe, expect, it } from 'vitest';
import { PAY_PATH, paymentLink } from './payment-links';

const FRONTEND_URL = 'https://orion.example.com';
const SQUARE_INVOICE_URL = 'https://square.link/u/invoice';

describe(paymentLink.name, () => {
  it('links Orion checkout for a payment billed in Orion', () => {
    const payment = factory.payment({ paymentUrl: SQUARE_INVOICE_URL });

    expect(paymentLink(payment)).toBe(`${FRONTEND_URL}${PAY_PATH}/${payment.id}`);
  });

  it('keeps the stored link for a legacy Square invoice', () => {
    const payment = factory.payment({
      squareInvoiceId: 'invoice-1',
      paymentUrl: SQUARE_INVOICE_URL,
    });

    expect(paymentLink(payment)).toBe(SQUARE_INVOICE_URL);
  });
});
