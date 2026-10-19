import { Prisma } from '../../generated/prisma/index.js';
import { PaymentError } from './amount.js';

// Single source of truth for how an investment is priced and dated. The
// Telegram Stars checkout and the admin-assisted offline path both go through
// these helpers so the two can never drift apart. All amounts are INR.

/** The payment reference recorded against the investment. */
export function investmentReference(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 191) {
    throw new PaymentError('A payment reference is required and must be at most 191 characters');
  }
  return value.trim();
}

export type PlanLike = {
  isActive?: boolean | null;
  minimumInvestment: Prisma.Decimal | string | number;
  maximumInvestment?: Prisma.Decimal | string | number | null;
  roiPerMonth?: Prisma.Decimal | string | number | null;
  roiPerDay?: Prisma.Decimal | string | number | null;
  durationInMonths: number;
};

export type PlanTerms = {
  roiPercentage: Prisma.Decimal;
  startDate: Date;
  endDate: Date;
};

/**
 * Plan-level rules: active flag, investment limits, duration and ROI.
 * ROI is always derived from the plan (a fraction such as 0.10 = 10%), never
 * from the client; a daily plan is normalised to a 30-day month.
 */
export function planInvestmentTerms(plan: PlanLike, amount: Prisma.Decimal): PlanTerms {
  if (!plan.isActive) {
    throw new PaymentError('Subscription plan is not active');
  }
  const minimum = new Prisma.Decimal(plan.minimumInvestment);
  const maximum = plan.maximumInvestment ? new Prisma.Decimal(plan.maximumInvestment) : null;
  if (maximum && maximum.equals(minimum)) {
    // A plan with one fixed price: the member invests exactly that, no more and
    // no less. The admin panel prices every plan this way.
    if (!amount.equals(minimum)) {
      throw new PaymentError(`This plan invests a fixed amount of ${minimum.toString()}`);
    }
  } else {
    if (amount.lessThan(minimum)) {
      throw new PaymentError(`Amount invested must be at least ${plan.minimumInvestment}`);
    }
    if (maximum && amount.greaterThan(maximum)) {
      throw new PaymentError(`Amount invested must not exceed ${plan.maximumInvestment}`);
    }
  }
  if (!Number.isInteger(plan.durationInMonths) || plan.durationInMonths <= 0) {
    throw new PaymentError('Plan duration is invalid');
  }

  let monthlyPercent: Prisma.Decimal | null = null;
  if (plan.roiPerMonth) monthlyPercent = new Prisma.Decimal(plan.roiPerMonth).mul(100);
  else if (plan.roiPerDay) monthlyPercent = new Prisma.Decimal(plan.roiPerDay).mul(100).mul(30);
  if (!monthlyPercent || monthlyPercent.lessThanOrEqualTo(0)) {
    throw new PaymentError('Plan has no ROI configured');
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setUTCMonth(endDate.getUTCMonth() + plan.durationInMonths);

  return { roiPercentage: monthlyPercent, startDate, endDate };
}
