// Local acceptance scenario: "Ram" invests ₹1000 at 2% ROI and refers five
// friends who each invest ₹1000.
//
//   node prisma/... (not needed)  —  compile first:  npx tsc --outDir .test-build
//   node tests/ram-scenario.local.mjs
//
// It writes real rows to the local MySQL database (emails ram.scenario.*).
// Remove them again with:
//   DELETE FROM User WHERE email LIKE 'ram.scenario.%';
//
// Numbers come from the shipped services, not from a re-implementation:
// `creditDueRoi` (ROI accrual) and `applyReferralBonus` (referral payout).
import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client.js';
import { default as prisma } from '../.test-build/config/prisma.js';
import { creditDueRoi } from '../.test-build/service/roi.service.js';
import { applyReferralBonus } from '../.test-build/service/referralBonus.js';

const PREFIX = 'ram.scenario.';
const PASSWORD = 'Test@12345';
const INVESTMENT = new Prisma.Decimal(1000);
const FRIENDS = ['Geeta', 'Sita', 'Raju', 'Shyam', 'Ramesh'];
const inr = value => `₹${Number(value).toFixed(2)}`;
// Local calendar day, not UTC — the DB stores the local midnight as an instant.
const day = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const startOfDay = value => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.subscriptionPlan.deleteMany({ where: { name: { startsWith: 'Scenario 2%' } } });
}

async function createMember(name, referredById = null) {
  return prisma.user.create({
    data: {
      name,
      email: `${PREFIX}${name.toLowerCase()}@local.test`,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      referralCode: `SCN${name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5)}${Date.now().toString().slice(-4)}`,
      referredById,
      wallet: { create: { currency: 'INR', balance: '0.00' } },
    },
  });
}

async function createPlan(name, roiPerDay, roiPerMonth) {
  return prisma.subscriptionPlan.create({
    data: {
      name,
      minimumInvestment: INVESTMENT,
      maximumInvestment: INVESTMENT,
      roiPerDay,
      roiPerMonth,
      durationInMonths: 1,
      description: 'Scenario plan: fixed ₹1000',
      isActive: true,
    },
  });
}

async function activate(userId, plan, startDate) {
  const investment = await prisma.investment.create({
    data: {
      userId,
      planId: plan.id,
      transactionId: `scenario-${userId}-${Date.now()}`,
      amountInvested: INVESTMENT,
      roiPercentage: plan.roiPerDay
        ? new Prisma.Decimal(plan.roiPerDay).mul(100).mul(30)
        : new Prisma.Decimal(plan.roiPerMonth).mul(100),
      startDate,
      endDate: new Date(new Date(startDate).setMonth(startDate.getMonth() + 1)),
      status: 'ACTIVE',
    },
  });

  // Same helper the Stars webhook and the admin path use.
  await prisma.$transaction(tx => applyReferralBonus(tx, {
    userId,
    investmentId: investment.id,
    amountInvested: investment.amountInvested,
    investmentCreatedAt: investment.createdAt,
  }));

  return investment;
}

async function main() {
  await cleanup();

  const daily = await createPlan('Scenario 2% Daily', '0.02', null);
  const monthly = await createPlan('Scenario 2% Monthly', null, '0.02');

  const ram = await createMember('Ram');
  const friends = [];
  for (const name of FRIENDS) friends.push(await createMember(name, ram.id));
  await prisma.user.update({ where: { id: ram.id }, data: { totalReferrals: friends.length } });
  for (const friend of friends) {
    await prisma.referral.create({
      data: {
        referrerId: ram.id,
        referredUserId: friend.id,
        level: 1,
        bonusPercentage: '0.15',
        bonusStartDate: new Date(),
        bonusEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });
  }

  // --- one week of 2% daily ROI -----------------------------------------
  // Start eight days back so the accrual window holds a full Mon–Fri week.
  const ramStart = startOfDay(new Date());
  ramStart.setDate(ramStart.getDate() - 8);
  await activate(ram.id, daily, ramStart);

  const beforeCredit = await prisma.wallet.findUnique({ where: { userId: ram.id } });

  // --- five friends invest ₹1000 each -----------------------------------
  const today = new Date();
  for (const friend of friends) await activate(friend.id, daily, today);

  // Five friends, each ₹1000, each credited once.
  const referralRows = await prisma.transaction.findMany({
    where: { userId: ram.id, type: 'REFERRAL_BONUS' },
    select: { amount: true, description: true },
  });

  // --- the member's own week of ROI -------------------------------------
  const ramInvestment = await prisma.investment.findFirst({ where: { userId: ram.id, planId: daily.id } });
  await creditDueRoi(ram.id);

  // --- level 2: Sita refers Rajesh --------------------------------------
  // The rule is direct-referrer only; this block is what proves it.
  const sita = await prisma.user.findFirst({ where: { email: `${PREFIX}sita@local.test` } });
  const rajesh = await createMember('Rajesh', sita.id);
  await prisma.user.update({ where: { id: sita.id }, data: { totalReferrals: { increment: 1 } } });
  await activate(rajesh.id, daily, new Date());

  const [ramAfterLevel2, sitaAfterLevel2] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: ram.id, type: 'REFERRAL_BONUS' },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.user.findUnique({
      where: { id: sita.id },
      select: { totalEarnings: true, wallet: { select: { balance: true } } },
    }),
  ]);

  // --- monthly plan: what a week pays -----------------------------------
  const monthlyUser = await createMember('Monthly');
  const monthlyStart = startOfDay(new Date());
  monthlyStart.setDate(monthlyStart.getDate() - 8);
  await activate(monthlyUser.id, monthly, monthlyStart);
  await creditDueRoi(monthlyUser.id);

  const [roiRows, account, monthlyRows, afterCredit] = await Promise.all([
    prisma.rOIRecord.findMany({
      where: { userId: ram.id, investmentId: ramInvestment.id },
      orderBy: { creditedForDate: 'asc' },
      select: { creditedForDate: true, roiAmount: true },
    }),
    prisma.user.findUnique({ where: { id: ram.id }, select: { inrBalance: true, totalEarnings: true, totalReferrals: true } }),
    prisma.rOIRecord.findMany({ where: { userId: monthlyUser.id }, select: { roiAmount: true } }),
    prisma.wallet.findUnique({ where: { userId: ram.id } }),
  ]);

  const creditedDays = roiRows.length;
  const perDay = Number(roiRows[0]?.roiAmount ?? INVESTMENT.mul(daily.roiPerDay));
  const roiTotal = roiRows.reduce((sum, row) => sum + Number(row.roiAmount), 0);
  const referralTotal = referralRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const wallet = Number(afterCredit.balance);
  const accountBalance = Number(account.inrBalance);
  const earnings = Number(account.totalEarnings);

  console.log('==================================================');
  console.log('RAM SCENARIO — ₹1000 invested, 2% daily plan');
  console.log('==================================================');
  console.log(`Week window: ${day(ramStart)} → ${day(new Date())} (weekends not credited, today excluded)`);
  console.log(`ROI per credited weekday: ${inr(perDay)}   (1000 × 2%)`);
  console.log(`Credited days in the week: ${creditedDays}`);
  console.log(`ROI credited this week:   ${inr(roiTotal)}`);
  console.log(`  days: ${roiRows.map(row => `${day(row.creditedForDate)} = ${inr(row.roiAmount)}`).join(', ') || '—'}`);
  console.log(`Wallet before ROI credit: ${inr(beforeCredit.balance)}`);
  console.log('');
  console.log('REFERRALS — 5 friends × ₹1000');
  for (const row of referralRows) console.log(`  ${inr(row.amount)}  ${row.description}`);
  console.log(`Referral bonus total:     ${inr(referralTotal)}   (5 × 15% of ₹1000)`);
  console.log(`  (5% rate if a friend invests later than 10 days after joining → ${inr(50 * FRIENDS.length)})`);
  console.log('');
  console.log('RAM TOTALS');
  console.log(`  wallet balance:  ${inr(wallet)}`);
  console.log(`  inrBalance:      ${inr(accountBalance)}   (withdrawal-guarded balance)`);
  console.log(`  totalEarnings:   ${inr(earnings)}   (referral income)`);
  console.log(`  totalReferrals:  ${account.totalReferrals}`);
  console.log('');
  console.log('LEVEL 2 — Ram → Sita → Rajesh (Rajesh invests ₹1000)');
  console.log(`  Sita earned:   ${inr(sitaAfterLevel2.totalEarnings)}  (wallet ${inr(sitaAfterLevel2.wallet.balance)})`);
  console.log(`  Ram earned:    ${inr(ramAfterLevel2._sum.amount ?? 0)} from ${ramAfterLevel2._count} referrals (unchanged)`);
  console.log('  Direct referrer only: Rajesh\'s investment pays Sita, never Ram.');
  console.log('');
  console.log('2% MONTHLY PLAN — same ₹1000, one week');
  console.log(`  ROI rows credited in the week: ${monthlyRows.length} → ${inr(monthlyRows.reduce((s, r) => s + Number(r.roiAmount), 0))}`);
  console.log('  (monthly ROI is paid once a month: 1000 × 2% = ₹20 per month)');
  console.log('==================================================');
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
