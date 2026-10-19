import assert from 'node:assert/strict';
import { after, test } from 'node:test';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'investment-tests-only-secret-32-bytes-long';
process.env.CLOUD_NAME = process.env.CLOUD_API_KEY = process.env.CLOUD_API_SECRET = 'test-only';
const { default: prisma } = await import('../.test-build/config/prisma.js');
const { Prisma } = await import('../generated/prisma/client.js');
const { JWT } = await import('../.test-build/utils/jwt.utils.js');
const { ALL_PERMISSIONS } = await import('../.test-build/service/permissions.js');
const { app } = await import('../.test-build/index.js');
const D = value => new Prisma.Decimal(value);
const monthlyPlan = { id: 'plan-monthly', name: 'Monthly', isActive: true, minimumInvestment: D('50'), maximumInvestment: D('1000'), roiPerMonth: D('0.10'), roiPerDay: null, durationInMonths: 6 };
const dailyPlan = { id: 'plan-daily', name: 'Daily', isActive: true, minimumInvestment: D('10'), maximumInvestment: null, roiPerMonth: null, roiPerDay: D('0.005'), durationInMonths: 3 };
// How the admin panel now prices every plan: one fixed amount, stored in both columns.
const fixedPlan = { id: 'plan-fixed', name: 'Fixed', isActive: true, minimumInvestment: D('250'), maximumInvestment: D('250'), roiPerMonth: D('0.08'), roiPerDay: null, durationInMonths: 6 };
let plans, created, bonusCalls, referred, notificationCalls;
// 'ghost' models a user id that does not exist; authentication relies on the
// same lookup, so a member token for it is rejected before the controller runs.
prisma.user.findUnique = async ({ where }) => (where.id === 'ghost' ? null : { id: where.id ?? 'member', tokenVersion: 0 });
// The operator driving the panel is fully authorised; the permission gates
// themselves are covered by tests/auth.test.mjs.
prisma.admin.findUnique = async ({ where }) => (where.id === 'ghost' ? null : { id: 'admin', role: 'ADMIN', tokenVersion: 0, permissions: ALL_PERMISSIONS });
prisma.adminAuditLog.create = async ({ data }) => data;
prisma.subscriptionPlan.findUnique = async ({ where }) => plans[where.id] ?? null;

// The controller runs inside one transaction, so the delegates it uses are the
// transaction client's.
const tx = {
  investment: {
    create: async ({ data }) => {
      created.push(data);
      return {
        id: 'investment-1',
        ...data,
        createdAt: data.startDate,
        amountInvested: data.amountInvested.toString(),
        roiPercentage: data.roiPercentage.toString(),
      };
    },
  },
  // Activating a plan also tells the member, in the same transaction.
  notification: {
    create: async ({ data }) => { notificationCalls.push(data); return { id: `notification-${notificationCalls.length}`, ...data }; },
  },
  userNotification: {
    create: async ({ data }) => { notificationCalls.push({ link: true, ...data }); return data; },
  },
  user: {
    findUnique: async ({ where }) => ({
      id: where.id,
      email: `${where.id}@example.test`,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      referredBy: referred ? { id: referred } : null,
    }),
    update: async ({ where, data }) => { bonusCalls.push({ kind: 'user', where, data }); return { id: where.id }; },
  },
  wallet: {
    updateMany: async ({ where, data }) => { bonusCalls.push({ kind: 'wallet', where, data }); return { count: 1 }; },
  },
  transaction: {
    create: async ({ data }) => { bonusCalls.push({ kind: 'transaction', data }); return { id: 'ledger-1', ...data }; },
  },
};
prisma.$transaction = async callback => callback(tx);

const server = await new Promise(resolve => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
// Recording a purchase is an operations action, so the default caller is an admin.
async function invest(body, admin = true) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/investment/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${JWT.generateToken({ id: admin ? 'admin' : 'member', kind: admin ? 'admin' : 'user', tokenVersion: 0 })}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'member', ...body }), signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, body: await response.json() };
}
const base = { planId: 'plan-monthly', amountInvested: '100', transactionId: 'TG-CHARGE-0001' };
const reset = (referrer = null) => { plans = { 'plan-monthly': monthlyPlan, 'plan-daily': dailyPlan, 'plan-fixed': fixedPlan }; created = []; bonusCalls = []; notificationCalls = []; referred = referrer; };

test('an investment is ACTIVE as soon as it is created and priced by the plan', async () => {
  reset();
  const before = Date.now();
  // Client-supplied ROI and dates are ignored.
  const response = await invest({ ...base, roiPercentage: 9999, startDate: '2000-01-01', endDate: '2000-01-02' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.data.roiPercentage, '10');
  assert.equal(created.length, 1);
  assert.equal(created[0].roiPercentage.toString(), '10');
  assert.equal(created[0].amountInvested.toString(), '100');
  assert.equal(created[0].status, 'ACTIVE', 'paying for the plan activates it, with no admin step');
  assert.equal(created[0].totalReturn, null);
  const start = created[0].startDate, end = created[0].endDate;
  assert.ok(start.getTime() >= before, 'start date must be server time, not client supplied');
  assert.equal(end.getUTCMonth(), (start.getUTCMonth() + 6) % 12);
  assert.notEqual(end.getUTCFullYear(), 2000);
  assert.equal(end.getUTCDate(), start.getUTCDate());
  // The member is notified that the plan is live, with a link into their feed.
  assert.equal(notificationCalls.length, 2);
  assert.equal(notificationCalls[0].type, 'SUCCESS');
  assert.match(notificationCalls[0].message, /₹100\.00/);
  assert.match(notificationCalls[0].message, /Monthly/);
  assert.deepEqual(notificationCalls[1], { link: true, userId: 'member', notificationId: 'notification-1' });
});

test('a fixed-amount plan accepts exactly its price and nothing else', async () => {
  reset();
  // Below and above the price are both refused with a message that names it.
  for (const amountInvested of ['249.99', '250.01', '1000', '10']) {
    const response = await invest({ planId: 'plan-fixed', amountInvested, transactionId: 'tx-fixed' });
    assert.equal(response.status, 400, String(amountInvested));
    assert.match(response.body.error, /fixed amount of 250/, JSON.stringify(response.body));
  }
  assert.equal(created.length, 0);
  // The exact price goes through and is still priced by the plan, not the caller.
  const accepted = await invest({ planId: 'plan-fixed', amountInvested: '250', transactionId: 'tx-fixed' });
  assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
  assert.equal(created.length, 1);
  assert.equal(created[0].amountInvested.toString(), '250');
  assert.equal(created[0].roiPercentage.toString(), '8');
  assert.equal(created[0].status, 'ACTIVE');
});

test('daily plan normalises ROI to a 30-day month', async () => {
  reset();
  const daily = await invest({ planId: 'plan-daily', amountInvested: '10', transactionId: 'tx' });
  assert.equal(daily.status, 201, JSON.stringify(daily.body));
  assert.equal(created[0].roiPercentage.toString(), '15');
});

test('activation credits the referrer exactly once when the member was referred', async () => {
  reset('referrer');
  const response = await invest({ ...base, transactionId: 'TG-CHARGE-0002' });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const userUpdate = bonusCalls.find(call => call.kind === 'user');
  assert.ok(userUpdate, 'the referrer balance and earnings must be credited');
  assert.equal(userUpdate.where.id, 'referrer');
  // The member joined 2026-01-01 and this investment is created today, so the
  // "new member" rate does not apply here.
  assert.equal(userUpdate.data.totalEarnings.increment.toString(), '5');
  assert.equal(userUpdate.data.inrBalance.increment.toString(), '5');
  assert.equal(bonusCalls.find(call => call.kind === 'wallet').data.balance.increment.toString(), '5');
  const ledger = bonusCalls.find(call => call.kind === 'transaction');
  assert.equal(ledger.data.type, 'REFERRAL_BONUS');
  assert.equal(ledger.data.currency, 'INR');
  assert.equal(ledger.data.amount.toString(), '5');
  assert.equal(ledger.data.investmentId, 'investment-1');
});

test('an unreferred member activates without any bonus movement', async () => {
  reset();
  assert.equal((await invest(base)).status, 201);
  assert.equal(bonusCalls.length, 0);
});

test('plan limits reject amounts outside the configured range', async () => {
  reset();
  assert.equal((await invest({ ...base, amountInvested: '49.99' })).status, 400);
  assert.equal((await invest({ ...base, amountInvested: '1000.01' })).status, 400);
  assert.equal((await invest({ ...base, amountInvested: '1000' })).status, 201);
  assert.equal((await invest({ ...base, planId: 'plan-daily', amountInvested: '999999999999' })).status, 201);
  assert.equal(created.length, 2);
});

test('invalid amounts, references, plans and users are rejected', async () => {
  reset();
  for (const amountInvested of [0, -1, 'NaN', 'Infinity', '1e2', '1.0000001', '100.999', {}, null, undefined, '0']) {
    assert.equal((await invest({ ...base, amountInvested })).status, 400, String(amountInvested));
  }
  for (const transactionId of ['', '   ', 5, 'x'.repeat(192), null, undefined]) {
    assert.equal((await invest({ ...base, transactionId })).status, 400, String(transactionId));
  }
  plans['plan-monthly'] = { ...monthlyPlan, isActive: false };
  assert.equal((await invest(base)).status, 400);
  plans['plan-monthly'] = { ...monthlyPlan, roiPerMonth: null, roiPerDay: null };
  assert.equal((await invest(base)).status, 400);
  plans['plan-monthly'] = { ...monthlyPlan, roiPerMonth: D('0'), durationInMonths: 0 };
  assert.equal((await invest(base)).status, 400);
  assert.equal((await invest({ ...base, planId: 'missing' })).status, 404);
  // An admin may record a purchase for any member; a missing account is a 404.
  assert.equal((await invest({ ...base, userId: 'ghost' })).status, 404);
  assert.equal(created.length, 0);
  assert.equal(bonusCalls.length, 0);
});

test('members cannot record investments for themselves or anyone else', async () => {
  reset();
  assert.equal((await invest(base, false)).status, 403);
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/investment/create`, {
    method: 'POST', headers: { Authorization: `Bearer ${JWT.generateToken({ id: 'other', kind: 'user', tokenVersion: 0 })}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'member', ...base }), signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 403);
  assert.equal(created.length, 0);
});
