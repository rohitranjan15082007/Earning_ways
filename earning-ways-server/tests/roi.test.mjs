import assert from 'node:assert/strict';
import { after, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'roi-tests-only-secret-at-least-32-bytes';
process.env.CLOUD_NAME = process.env.CLOUD_API_KEY = process.env.CLOUD_API_SECRET = 'test-only';

const { default: prisma } = await import('../.test-build/config/prisma.js');
const { creditDueRoi } = await import('../.test-build/service/roi.service.js');
const { Prisma: ClientPrisma } = await import('../generated/prisma/client.js');

const Decimal = ClientPrisma.Decimal;
const USER = 'member';
const INVESTMENT = 'investment-1';
const INVESTED = new Decimal(1000);
const DAILY_RATE = new Decimal('0.01');
const UNIT = INVESTED.mul(DAILY_RATE); // ₹10 per credited weekday

const startOfDay = value => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const today = startOfDay(new Date());
const startDate = startOfDay(new Date());
startDate.setDate(startDate.getDate() - 8);

// Weekdays after the investment start and before today.
let expectedDays = 0;
for (let cursor = new Date(startDate); cursor < today; ) {
  cursor.setDate(cursor.getDate() + 1);
  if (cursor >= today) break;
  const day = cursor.getDay();
  if (day >= 1 && day <= 5) expectedDays += 1;
}

// In-memory stand-in for the unique key on (investmentId, creditedForDate):
// a repeated insert of the same day contributes nothing to `count`.
const recorded = new Map();
const walletCredits = [];
const accountCredits = [];
const ledgerEntries = [];
let walletMissing = false;

const tx = {
  rOIRecord: {
    createMany: async ({ data }) => {
      let count = 0;
      for (const row of data) {
        const key = `${row.investmentId}|${startOfDay(row.creditedForDate).toISOString()}`;
        if (recorded.has(key)) continue;
        recorded.set(key, row);
        count += 1;
      }
      return { count };
    },
  },
  wallet: {
    updateMany: async ({ data }) => {
      if (walletMissing) return { count: 0 };
      walletCredits.push(data.balance.increment);
      return { count: 1 };
    },
  },
  user: {
    updateMany: async ({ data }) => {
      accountCredits.push(data.inrBalance.increment);
      return { count: 1 };
    },
  },
  transaction: {
    create: async ({ data }) => {
      ledgerEntries.push(data);
      return data;
    },
  },
};

// Atomic, like the real transaction: a throw undoes everything this run wrote.
prisma.$transaction = async run => {
  const snapshot = new Map(recorded);
  const credits = walletCredits.length;
  const account = accountCredits.length;
  const entries = ledgerEntries.length;
  try {
    return await run(tx);
  } catch (error) {
    recorded.clear();
    for (const [key, value] of snapshot) recorded.set(key, value);
    walletCredits.length = credits;
    accountCredits.length = account;
    ledgerEntries.length = entries;
    throw error;
  }
};
prisma.rOIRecord.findFirst = async () => null;
prisma.investment.findMany = async () => [
  {
    id: INVESTMENT,
    userId: USER,
    amountInvested: INVESTED,
    startDate,
    plan: { roiPerDay: DAILY_RATE, roiPerMonth: null },
  },
];

after(async () => { await prisma.$disconnect(); });

test('ROI is credited once per day, and a repeated call moves no money', async () => {
  assert.ok(expectedDays > 0, 'fixture spans at least one weekday');

  const first = await creditDueRoi(USER);
  assert.equal(recorded.size, expectedDays);
  assert.ok(first.equals(UNIT.mul(expectedDays)), `expected ${UNIT.mul(expectedDays)}, got ${first}`);
  assert.equal(walletCredits.length, 1);
  assert.ok(walletCredits[0].equals(first));
  // The guarded account balance moves with the payout wallet, so a withdrawal
  // can spend the credited ROI.
  assert.equal(accountCredits.length, 1);
  assert.ok(accountCredits[0].equals(first));
  assert.equal(ledgerEntries.length, 1);

  // A refresh, a retry or a second concurrent request inserts nothing.
  const second = await creditDueRoi(USER);
  assert.ok(second.equals(0), `second call credited ${second}`);
  assert.equal(walletCredits.length, 1, 'wallet moved twice');
  assert.equal(ledgerEntries.length, 1, 'duplicate ROI ledger entry');
  assert.equal(recorded.size, expectedDays);
});

test('a missing INR wallet rolls the whole claim back instead of recording orphan ROI', async () => {
  recorded.clear();
  walletCredits.length = 0;
  accountCredits.length = 0;
  ledgerEntries.length = 0;
  walletMissing = true;

  await assert.rejects(() => creditDueRoi(USER), /INR wallet/);
  assert.equal(walletCredits.length, 0);
  assert.equal(accountCredits.length, 0);
  assert.equal(ledgerEntries.length, 0);
  // The failed claim leaves no ROI row behind, so the next call can retry it.
  assert.equal(recorded.size, 0);

  walletMissing = false;
});
