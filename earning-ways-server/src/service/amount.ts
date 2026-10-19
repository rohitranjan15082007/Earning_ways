import { Prisma } from '../../generated/prisma/index.js';

/**
 * Money primitives for Earning Ways.
 *
 * Every amount on this platform is INR. Amounts are validated and compared as
 * Prisma Decimal values only — never floating point — so a financial check can
 * never drift by a paisa. The columns are Decimal(14, 2), so an amount may
 * carry at most two fractional digits (paise).
 */

export class PaymentError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const INR_AMOUNT_PATTERN = /^\d{1,12}(\.\d{1,2})?$/;

export function paymentAmount(value: unknown): Prisma.Decimal {
  if ((typeof value !== 'string' && typeof value !== 'number') || !INR_AMOUNT_PATTERN.test(String(value))) {
    throw new PaymentError('Amount must be a positive amount in INR with at most 2 decimal places');
  }
  const amount = new Prisma.Decimal(String(value));
  if (!amount.greaterThan(0)) throw new PaymentError('Amount must be positive');
  return amount;
}
