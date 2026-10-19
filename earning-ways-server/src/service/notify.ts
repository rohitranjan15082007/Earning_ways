import { Prisma } from '../../generated/prisma/index.js';

/**
 * Member notifications.
 *
 * A notification the member reads is two rows: `Notification` holds the
 * title/message/type that everybody shares, and `UserNotification` is the
 * per-member link that the member's own feed lists. Both are written inside the
 * caller's transaction, so a notification can never announce an operation that
 * was rolled back, and the money path stays atomic.
 */

export type NotifyType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'PROMOTIONAL' | 'SYSTEM';

export async function notifyUser(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    title: string;
    message: string;
    type?: NotifyType;
    meta?: Prisma.InputJsonValue;
  },
): Promise<void> {
  const notification = await tx.notification.create({
    data: {
      title: input.title,
      message: input.message,
      type: input.type ?? 'INFO',
      ...(input.meta !== undefined ? { meta: input.meta } : {}),
    },
  });
  await tx.userNotification.create({
    data: { userId: input.userId, notificationId: notification.id },
  });
}

/** `₹1,234.56` — the platform's only currency. */
export const inrText = (value: Prisma.Decimal | string | number): string =>
  `₹${Number(value.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
