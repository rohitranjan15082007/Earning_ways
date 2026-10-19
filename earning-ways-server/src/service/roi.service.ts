import prisma from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/index.js';

// ROI accrual.
//
// The credit is claimed by inserting one `ROIRecord` per investment and
// `creditedForDate`. The schema has a unique key on that pair, so a repeated or
// concurrent call inserts nothing and therefore moves no money: the number of
// newly inserted rows — never a pre-computed total — decides the credit.

const MAX_ROWS_PER_RUN = 400; // safety valve for a very old, never-credited investment
const WEEKDAY = { MON: 1, FRI: 5 } as const;

type RoiRow = Prisma.ROIRecordCreateManyInput;

const startOfDay = (value: Date): Date => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

function dailyRows(
  userId: string,
  investmentId: string,
  cursor: Date,
  today: Date,
  amount: Prisma.Decimal,
): RoiRow[] {
  const rows: RoiRow[] = [];
  while (cursor < today && rows.length < MAX_ROWS_PER_RUN) {
    const day = cursor.getDay();
    // Weekends are not credited, matching the original accrual rules.
    if (day >= WEEKDAY.MON && day <= WEEKDAY.FRI) {
      rows.push({
        userId,
        investmentId,
        creditedForDate: new Date(cursor),
        roiAmount: amount,
        isReferralBonusApplied: false,
        weekNumber: 0,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

function monthlyRows(
  userId: string,
  investmentId: string,
  cursor: Date,
  today: Date,
  amount: Prisma.Decimal,
): RoiRow[] {
  const rows: RoiRow[] = [];
  let period = new Date(cursor);
  while (rows.length < MAX_ROWS_PER_RUN) {
    const next = new Date(period);
    next.setMonth(next.getMonth() + 1);
    if (next > today) break;
    rows.push({
      userId,
      investmentId,
      creditedForDate: next,
      roiAmount: amount,
      isReferralBonusApplied: false,
      weekNumber: 0,
    });
    period = next;
  }
  return rows;
}

/**
 * Inserts the rows that do not exist yet and credits the wallet by exactly the
 * number of rows this call created. Returns the credited amount.
 */
async function claim(userId: string, rows: RoiRow[], unit: Prisma.Decimal, kind: 'Daily' | 'Monthly'): Promise<Prisma.Decimal> {
  if (rows.length === 0) return new Prisma.Decimal(0);
  return prisma.$transaction(async tx => {
    const inserted = await tx.rOIRecord.createMany({ data: rows, skipDuplicates: true });
    if (inserted.count === 0) return new Prisma.Decimal(0);

    const total = unit.mul(inserted.count).toDecimalPlaces(2);
    // Both balances move together, like every other credit: a withdrawal checks
    // the guarded `inrBalance` as well as the payout wallet.
    const wallet = await tx.wallet.updateMany({
      where: { userId, currency: 'INR' },
      data: { balance: { increment: total } },
    });
    if (wallet.count !== 1) throw new Error('An INR wallet is required to credit ROI');
    await tx.user.updateMany({ where: { id: userId }, data: { inrBalance: { increment: total } } });

    await tx.transaction.create({
      data: {
        userId,
        type: 'ROI',
        amount: total,
        currency: 'INR',
        status: 'SUCCESS',
        description: `${kind} ROI credited for ${inserted.count} period(s)`,
        meta: { source: 'roi-accrual', kind, periods: inserted.count },
      },
    });
    return total;
  });
}

/** Credits every day/period that is due but not yet recorded for this member. */
export async function creditDueRoi(userId: string): Promise<Prisma.Decimal> {
  const today = startOfDay(new Date());
  const investments = await prisma.investment.findMany({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
    orderBy: { startDate: 'asc' },
  });

  let credited = new Prisma.Decimal(0);

  for (const investment of investments) {
    const last = await prisma.rOIRecord.findFirst({
      where: { investmentId: investment.id, creditedForDate: { not: null } },
      orderBy: { creditedForDate: 'desc' },
      select: { creditedForDate: true },
    });

    const cursor = startOfDay(last?.creditedForDate ?? investment.startDate);
    cursor.setDate(cursor.getDate() + 1);

    const invested = new Prisma.Decimal(investment.amountInvested);
    const rate = investment.plan.roiPerDay ?? investment.plan.roiPerMonth;
    if (!rate) continue;

    const unit = invested.mul(new Prisma.Decimal(rate)).toDecimalPlaces(2);
    if (unit.lessThanOrEqualTo(0)) continue;

    const rows = investment.plan.roiPerDay
      ? dailyRows(userId, investment.id, cursor, today, unit)
      : monthlyRows(userId, investment.id, cursor, today, unit);

    credited = credited.add(
      await claim(userId, rows, unit, investment.plan.roiPerDay ? 'Daily' : 'Monthly'),
    );
  }

  return credited;
}
