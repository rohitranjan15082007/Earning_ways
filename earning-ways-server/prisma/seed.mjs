// Local seed for the Earning Ways acceptance run.
//
// Creates the member, the super admin, an active plan, the Telegram Stars
// settings and one already-CONFIRMED Stars payment so the browser acceptance
// test (tests/browser-e2e.local.mjs) has a deterministic stack to drive.
//
// Run with:  node prisma/seed.mjs
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

const MEMBER = { email: 'user@local.test', password: 'User@12345' };
const ADMIN = { email: 'admin@local.test', password: 'Admin@12345' };

async function main() {
  const passwordHash = await bcrypt.hash(MEMBER.password, 10);
  const adminHash = await bcrypt.hash(ADMIN.password, 10);

  // --- admin -----------------------------------------------------------------
  const existingAdmin = await prisma.admin.findUnique({ where: { email: ADMIN.email } });
  if (existingAdmin) {
    await prisma.admin.update({ where: { email: ADMIN.email }, data: { password: adminHash, role: 'SUPER_ADMIN' } });
  } else {
    await prisma.admin.create({ data: { email: ADMIN.email, password: adminHash, role: 'SUPER_ADMIN' } });
  }

  // --- plan ------------------------------------------------------------------
  let plan = await prisma.subscriptionPlan.findFirst({ where: { name: 'Starter Plan' } });
  if (plan) {
    plan = await prisma.subscriptionPlan.update({
      where: { id: plan.id },
      // A plan has ONE fixed price, so both columns carry the same amount.
      data: { minimumInvestment: '100.00', maximumInvestment: '100.00', roiPerMonth: '0.10', durationInMonths: 12, isActive: true },
    });
  } else {
    plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Starter Plan',
        minimumInvestment: '100.00',
        maximumInvestment: '100.00',
        roiPerMonth: '0.10',
        durationInMonths: 12,
        description: 'Entry plan, 10% monthly ROI in INR.',
        isActive: true,
      },
    });
  }

  // A second plan the member does NOT own, so the subscriptions page offers an
  // actual "Invest Now" button next to the plan the seeded investment owns.
  let secondPlan = await prisma.subscriptionPlan.findFirst({ where: { name: 'Growth Plan' } });
  if (secondPlan) {
    secondPlan = await prisma.subscriptionPlan.update({
      where: { id: secondPlan.id },
      data: { minimumInvestment: '500.00', maximumInvestment: '500.00', roiPerMonth: '0.08', durationInMonths: 6, isActive: true },
    });
  } else {
    secondPlan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Growth Plan',
        minimumInvestment: '500.00',
        maximumInvestment: '500.00',
        roiPerMonth: '0.08',
        durationInMonths: 6,
        description: 'Longer horizon, 8% monthly ROI in INR.',
        isActive: true,
      },
    });
  }

  // --- member ----------------------------------------------------------------
  let member = await prisma.user.findUnique({ where: { email: MEMBER.email } });
  if (member) {
    member = await prisma.user.update({ where: { id: member.id }, data: { passwordHash, inrBalance: '500.00' } });
  } else {
    member = await prisma.user.create({
      data: {
        name: 'Local Member',
        email: MEMBER.email,
        passwordHash,
        upiId: 'localmember@bank',
        inrBalance: '500.00',
        referralCode: 'EWLOCAL01',
      },
    });
  }
  await prisma.wallet.upsert({
    where: { userId: member.id },
    update: { upiId: 'localmember@bank', currency: 'INR', balance: '500.00' },
    create: { userId: member.id, upiId: 'localmember@bank', currency: 'INR', balance: '500.00' },
  });

  // --- an activated investment + its confirmed Stars payment -----------------
  const chargeId = 'local-charge-0001';
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setUTCMonth(endDate.getUTCMonth() + 12);

  const existingInvestment = await prisma.investment.findFirst({ where: { transactionId: chargeId } });
  const investment = existingInvestment
    ? await prisma.investment.update({
        where: { id: existingInvestment.id },
        data: { userId: member.id, planId: plan.id, amountInvested: '100.00', status: 'ACTIVE', startDate, endDate },
      })
    : await prisma.investment.create({
        data: {
          userId: member.id,
          planId: plan.id,
          transactionId: chargeId,
          amountInvested: '100.00',
          roiPercentage: '10.000000',
          startDate,
          endDate,
          status: 'ACTIVE',
          totalReturn: null,
        },
      });

  const existingPayment = await prisma.payment.findUnique({ where: { telegramChargeId: chargeId } });
  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: { userId: member.id, planId: plan.id, investmentId: investment.id, status: 'CONFIRMED', amount: '100.00', starsAmount: 5000, confirmedAt: new Date() },
    });
  } else {
    await prisma.payment.create({
      data: {
        userId: member.id,
        amount: '100.00',
        currency: 'INR',
        provider: 'TELEGRAM_STARS',
        status: 'CONFIRMED',
        planId: plan.id,
        starsAmount: 5000,
        telegramChargeId: chargeId,
        telegramUserId: '42',
        invoiceUrl: 'https://t.me/invoice/local-charge-0001',
        confirmedAt: new Date(),
        investmentId: investment.id,
      },
    });
  }

  // --- Telegram Stars settings ----------------------------------------------
  // The token is a syntactically valid placeholder: Telegram rejects it, which is
  // exactly what the acceptance test asserts (the browser must surface the
  // provider's answer instead of pretending the payment started).
  const settings = {
    botToken: '123456:ABCdefGHIjklMNOpqrsTUVwxyz123456',
    botUsername: 'earningways_local_bot',
    webhookSecret: 'local-secret-value',
    webhookUrl: 'https://api.example.com/api/payment/telegram/webhook',
    starsPerInr: '0.55',
    maxStarsPerInvoice: 10000,
    isEnabled: true,
  };
  const existingSettings = await prisma.telegramStarsSetting.findFirst();
  if (existingSettings) {
    await prisma.telegramStarsSetting.update({ where: { id: existingSettings.id }, data: settings });
  } else {
    await prisma.telegramStarsSetting.create({ data: settings });
  }

  console.log('Seeded:', {
    member: member.email,
    admin: ADMIN.email,
    plan: plan.name,
    investablePlan: secondPlan.name,
    investmentId: investment.id,
    starsPerInr: settings.starsPerInr,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async error => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
