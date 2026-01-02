import { query } from '$app/server';
import { printPaymentService } from '$lib/server/services/print_payment.service';

export const testPrintPayment = query(async () => {
  return await printPaymentService.testCost();
});
