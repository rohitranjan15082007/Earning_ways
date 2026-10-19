import { Prisma } from '../../generated/prisma/index.js';

/**
 * Referral bonus crediting.
 *
 * The bonus is paid to the referrer the moment a referred member's investment
 * goes live. Both activation paths (the Telegram Stars webhook settlement and
 * the admin-assisted offline path) call this one helper, so the two can never
 * drift apart. Always run inside the caller's transaction.
 */

export const REFERRAL_BONUS_RATE = 0.05; // 5% by default
export const REFERRAL_BONUS_RATE_NEW_MEMBER = 0.15; // 15% when the investment happens within 10 days of joining
export const REFERRAL_BONUS_NEW_MEMBER_DAYS = 10;

export async function applyReferralBonus(
  tx: Prisma.TransactionClient,
  input: { userId: string; investmentId: string; amountInvested: Prisma.Decimal; investmentCreatedAt: Date },
): Promise<Prisma.Decimal | null> {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    include: { referredBy: true },
  });
  if (!user?.referredBy) return null;

  const investedAt = new Date(input.investmentCreatedAt).getTime();
  const joinedAt = new Date(user.createdAt).getTime();
  const diffDays = Math.abs(investedAt - joinedAt) / (1000 * 60 * 60 * 24);
  const rate = diffDays <= REFERRAL_BONUS_NEW_MEMBER_DAYS ? REFERRAL_BONUS_RATE_NEW_MEMBER : REFERRAL_BONUS_RATE;

  const bonus = input.amountInvested.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (!bonus.greaterThan(0)) return null;

  await tx.user.update({
    where: { id: user.referredBy.id },
    data: {
      totalEarnings: { increment: bonus },
      inrBalance: { increment: bonus },
    },
  });

  // Keep the payout wallet in step with the user balance.
  await tx.wallet.updateMany({
    where: { userId: user.referredBy.id },
    data: { balance: { increment: bonus } },
  });

  await tx.transaction.create({
    data: {
      userId: user.referredBy.id,
      type: 'REFERRAL_BONUS',
      amount: bonus,
      currency: 'INR',
      status: 'SUCCESS',
      description: `Referral bonus for ${user.email || user.id}`,
      investmentId: input.investmentId,
    },
  });

  return bonus;
}
