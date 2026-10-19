import prisma from "../config/prisma.js";
import { asyncHandler } from "../middleware/error.middleware.js";
import { ErrorResponse } from "../utils/response.util.js";

export const getUserDashboard = asyncHandler(async (req, res, next) => {
  const userId = req.params.id!;

  // FIX 1: Fetch the 'wallet' relation to get the active balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      referralCode: true,
      totalEarnings: true,
      wallet: {
        select: {
          balance: true,
        },
      },
    },
  });

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  // Total Invested
  const investmentAggregate = await prisma.investment.aggregate({
    where: {
      userId,
      status: { in: ["ACTIVE", "COMPLETED"] },
    },
    _sum: { amountInvested: true },
  });
  const totalInvested = Number(investmentAggregate._sum.amountInvested || 0);

  // Monthly ROI
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRoiAggregate = await prisma.rOIRecord.aggregate({
    where: {
      userId,
      createdAt: { gte: startOfMonth },
    },
    _sum: { roiAmount: true },
  });
  const monthlyRoiAmount = Number(monthlyRoiAggregate._sum.roiAmount || 0);

  // Daily ROI
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dailyRoiAggregate = await prisma.rOIRecord.aggregate({
    where: {
      userId,
      createdAt: { gte: startOfDay },
    },
    _sum: { roiAmount: true },
  });
  const dailyRoiAmount = Number(dailyRoiAggregate._sum.roiAmount || 0);

  // Total ROI
  const allRoiAggregate = await prisma.rOIRecord.aggregate({
    where: { userId },
    _sum: { roiAmount: true },
  });
  const totalRoi = Number(allRoiAggregate._sum.roiAmount || 0);

  // Profit Earned
  const profitEarned = totalRoi + Number(user.totalEarnings);

  // ROI Percentage
  const roiPercentage = totalInvested > 0 ? (profitEarned / totalInvested) * 100 : 0;

  // FIX 2: Read the payout balance from 'user.wallet.balance' instead of 'user.inrBalance'
  // using optional chaining (?) in case wallet doesn't exist yet
  const currentBalance = Number(user.wallet?.balance || 0);

  // Charts Data
  const currentYear = now.getFullYear();
  const startDate = new Date(currentYear, 0, 1);
  const relevantTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: { in: ["ROI", "REFERRAL_BONUS"] },
      createdAt: { gte: startDate },
    },
    select: { createdAt: true, amount: true, type: true },
    orderBy: { createdAt: "asc" },
  });

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months: any[] = [];
  for (let i = 0; i < 12; i++) {
    const monthIndex = i;
    const monthKey = `${currentYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    months.push({
      key: monthKey,
      month: monthNames[monthIndex],
      total: 0,
      referral: 0,
    });
  }

  relevantTransactions.forEach((tx) => {
    const date = new Date(tx.createdAt);
    if (date.getFullYear() === currentYear) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthIndex = months.findIndex(m => m.key === monthKey);
      if (monthIndex !== -1) {
        const amt = Number(tx.amount);
        months[monthIndex].total += amt;
        if (tx.type === "REFERRAL_BONUS") {
          months[monthIndex].referral += amt;
        }
      }
    }
  });

  // FIX: Only show data up to current month to avoid confusing future projections
  const currentMonthIndex = now.getMonth();

  let cumulative = 0;
  const balanceData: any[] = [];
  const referralData: any[] = [];

  months.forEach((m, index) => {
    if (index <= currentMonthIndex) {
      cumulative += m.total;
      balanceData.push({ month: m.month, balance: Number(cumulative.toFixed(4)) });
      referralData.push({ month: m.month, earnings: Number(m.referral.toFixed(4)) });
    }
  });

  // Calculate Maximum Earning
  // Fetch global settings for maxiumEarningReturn
  const settings = await prisma.setting.findFirst();
  const maxEarningMultiplier = settings?.maxiumEarningReturn || 0;

  let totalMaximumEarning = 0;
  if (maxEarningMultiplier > 0) {
    // We already have activeInvestments fetched below, but we need it here.
    // Let's reuse the query logic or move the activeInvestments query up.
    // Since activeInvestments is needed for both activeSubs and calculation, let's fetch it earlier or just run a reduce here.
    
    // Actually, let's fetch active investments here to be safe and clean, or move the existing query up.
    // Moving existing query up seems cleaner.
  }
  
  // Refactoring to fetch active investments earlier
  const activeInvestmentsList = await prisma.investment.findMany({
    where: { userId, status: "ACTIVE" },
    include: { plan: true },
  });

  if (maxEarningMultiplier > 0) {
    totalMaximumEarning = activeInvestmentsList.reduce((sum, inv) => {
      return sum + (Number(inv.amountInvested) * maxEarningMultiplier);
    }, 0);
  }

  const activeSubs = activeInvestmentsList.map((inv: any) => {
    let remainingMonths = 0;
    if (inv.endDate) {
       remainingMonths = Math.ceil(
        (new Date(inv.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
    }
    remainingMonths = remainingMonths > 0 ? remainingMonths : 0;

    let roiRate = "0%";
    let roiType = "Monthly";
    if (inv.plan.roiPerDay) {
      roiRate = `${Number((Number(inv.plan.roiPerDay) * 100).toFixed(2))}% Daily`;
      roiType = "Daily";
    } else if (inv.plan.roiPerMonth) {
      roiRate = `${Number((Number(inv.plan.roiPerMonth) * 100).toFixed(2))}% Monthly`;
      roiType = "Monthly";
    }

    return {
      planName: inv.plan.name,
      duration: `${inv.plan.durationInMonths} Months`,
      amountInvested: Number(inv.amountInvested).toString(),
      roiRate,
      roiType,
      remaining: `${remainingMonths} months remaining`,
    };
  });

  const referralLink = `${process.env.FRONTEND_URL ?? 'http://localhost:8080'}/auth/signup?referralId=${user.referralCode}`;

  const dashboardData = {
    userName: user.name || "User",
    referralLink,
    kpis: {
      totalInvested: Number(totalInvested.toFixed(2)),
      currentBalance: Number(currentBalance.toFixed(4)), // Should now show 20
      monthlyROI: Number(monthlyRoiAmount.toFixed(4)),
      dailyROI: Number(dailyRoiAmount.toFixed(4)),
      referralEarnings: Number(Number(user.totalEarnings).toFixed(4)),
      maximumEarning: Number(totalMaximumEarning.toFixed(2)),
    },
    charts: {
      balanceData,
      referralData,
    },
    summary: {
      totalInvested: Number(totalInvested.toFixed(2)),
      profitEarned: Number(profitEarned.toFixed(4)),
      roiPercentage: `+${Number(roiPercentage.toFixed(2))}%`,
    },
    activeSubscriptions: {
      count: activeSubs.length,
      plans: activeSubs,
    },
  };

  res.status(200).json({
    success: true,
    data: dashboardData,
  });
});