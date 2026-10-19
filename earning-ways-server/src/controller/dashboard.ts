import { InvestmentStatus, PrismaClient, TransactionType, WithdrawalStatus } from '../../generated/prisma/client.js';

import { StatusCodes } from 'http-status-codes';
import prisma from '../config/prisma.js';
import type { Request, Response } from 'express';

interface DashboardStats {
  totalUsers: number;
  totalInvestments: string; // Formatted as string with ₹
  referralBonuses: string;
  totalWithdrawals: string;
}

interface InvestmentTrendData {
  month: string;
  amount: number;
}

interface InvestmentDistributionData {
  name: string;
  value: number;
  fill: string;
}

interface RecentActivity {
  id: string;
  user: string;
  type: string;
  amount: string;
  date: string;
  status: string;
}

export const getDashboardData = async (req: Request, res: Response) => {
  try {
    // Stats
    const [totalUsersCount, totalInvestmentsSum, referralBonusesSum, totalWithdrawalsSum] = await Promise.all([
      prisma.user.count(),
      prisma.investment.aggregate({
        where: { status: InvestmentStatus.ACTIVE },
        _sum: { amountInvested: true },
      }),
      prisma.transaction.aggregate({
        where: { type: TransactionType.REFERRAL_BONUS, status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      prisma.withdrawal.aggregate({
        where: { status: WithdrawalStatus.APPROVED },
        _sum: { amount: true },
      }),
    ]);

    // Every amount on this platform is INR; the panel reads these strings as-is.
    const formatAmount = (amount: number | null | undefined): string =>
      (amount ? `₹${amount.toLocaleString('en-IN')}` : '₹0');

    const stats: DashboardStats = {
      totalUsers: totalUsersCount,
      totalInvestments: formatAmount(totalInvestmentsSum._sum?.amountInvested?.toNumber() || 0),
      referralBonuses: formatAmount(referralBonusesSum._sum?.amount?.toNumber() || 0),
      totalWithdrawals: formatAmount(totalWithdrawalsSum._sum?.amount?.toNumber() || 0),
    };

    // Investment Trend: Last 6 months investment amounts
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const investmentTrends = await prisma.investment.groupBy({
      by: ['startDate'],
      where: {
        status: InvestmentStatus.ACTIVE,
        startDate: { gte: sixMonthsAgo },
      },
      _sum: { amountInvested: true },
      orderBy: { startDate: 'asc' },
    });

    const trendData: InvestmentTrendData[] = investmentTrends.map((trend, index) => ({
      month: new Date(trend.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      amount: trend._sum.amountInvested?.toNumber() || 0,
    }));

    // Investment Distribution: By plan
    const distributions = await prisma.subscriptionPlan.findMany({
      include: {
        investments: {
          where: { status: InvestmentStatus.ACTIVE },
          select: { amountInvested: true },
        },
      },
    });

    const totalActiveInvestments = await prisma.investment.aggregate({
      where: { status: InvestmentStatus.ACTIVE },
      _sum: { amountInvested: true },
    });

    const totalActiveAmount = totalActiveInvestments._sum?.amountInvested?.toNumber() || 0;

    const distributionData: InvestmentDistributionData[] = distributions.map((plan, index) => {
      const planTotal = plan.investments.reduce((sum, inv) => sum + (inv.amountInvested.toNumber() || 0), 0);
      const percentage = totalActiveAmount > 0 ? (planTotal / totalActiveAmount) * 100 : 0;
      return {
        name: plan.name,
        value: percentage,
        fill: `hsl(${220 + index * 60}, 70%, 50%)`, // Dynamic colors
      };
    }).filter(d => d.value > 0);

    // Recent Activities: Last 10 transactions
    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        investment: { select: { plan: { select: { name: true } } } },
      },
    });

    const recentActivities: RecentActivity[] = recentTransactions.map((tx) => ({
      id: tx.id.slice(-6), // Short ID
      user: tx.user.name || tx.user.email,
      type: tx.type,
      amount: `₹${tx.amount.toNumber().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      date: new Date(tx.createdAt).toLocaleDateString('en-IN'),
      status: tx.status,
    }));

    return res.status(StatusCodes.OK).json({
      stats,
      charts: {
        investmentTrend: trendData,
        investmentDistribution: distributionData,
      },
      recentActivities,
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: 'Failed to fetch dashboard data',
    });
  }
};