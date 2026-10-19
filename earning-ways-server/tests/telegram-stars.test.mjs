import assert from 'node:assert/strict';
import { after, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'telegram-stars-tests-secret-at-least-32-bytes';
process.env.CLOUD_NAME = process.env.CLOUD_API_KEY = process.env.CLOUD_API_SECRET = 'test-only';
// The rail must be configured through the admin settings row, not the process env.
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.TELEGRAM_BOT_USERNAME = '';
process.env.TELEGRAM_WEBHOOK_SECRET = '';
process.env.STARS_PER_INR = '';
process.env.TELEGRAM_STARS_ENABLED = 'false';

const { default: prisma } = await import('../.test-build/config/prisma.js');
const { Prisma } = await import('../generated/prisma/client.js');
const { JWT } = await import('../.test-build/utils/jwt.utils.js');
const { ALL_PERMISSIONS } = await import('../.test-build/service/permissions.js');
const { app } = await import('../.test-build/index.js');
const D = value => new Prisma.Decimal(value);

// ---------------------------------------------------------------------------
// In-memory doubles. These check our own logic (rates, idempotency, policy),
// not Telegram or MySQL behaviour.
// ---------------------------------------------------------------------------
let settings = null;
prisma.telegramStarsSetting.findFirst = async () => (settings ? { ...settings } : null);
prisma.telegramStarsSetting.update = async ({ where, data }) => { settings = { ...settings, ...data, id: where.id }; return { ...settings }; };
prisma.telegramStarsSetting.create = async ({ data }) => {
  settings = { id: 'settings-1', maxStarsPerInvoice: 10000, isEnabled: false, ...data };
  return { ...settings };
};

const plan = {
  id: 'plan-monthly', name: 'Monthly', isActive: true,
  minimumInvestment: D('50'), maximumInvestment: D('1000'),
  roiPerMonth: D('0.10'), roiPerDay: null, durationInMonths: 6,
};
prisma.subscriptionPlan.findUnique = async ({ where }) => (where.id === plan.id ? { ...plan } : null);
prisma.subscriptionPlan.findMany = async () => [{ id: plan.id, name: plan.name }];

prisma.user.findUnique = async ({ where }) => {
  const id = where.id ?? (where.email === 'member@example.test' ? 'member' : undefined);
  return ['member', 'other'].includes(id) ? { id, email: 'member@example.test', tokenVersion: 0 } : null;
};
prisma.admin.findUnique = async ({ where }) => {
  const id = where.id ?? (where.email === 'admin@example.test' ? 'admin' : undefined);
  // 'super' is the owner (every permission), 'admin' is a sub-admin who may read
  // the payments list but not the rail's credentials.
  return ['admin', 'super'].includes(id)
    ? {
      id, email: 'admin@example.test', tokenVersion: 0, role: id === 'super' ? 'SUPER_ADMIN' : 'ADMIN',
      permissions: id === 'super' ? ALL_PERMISSIONS : ['payments:read'],
    }
    : null;
};
// Audit rows are asserted elsewhere; keep this suite off the database.
prisma.adminAuditLog.create = async ({ data }) => data;

const payments = new Map();
const investments = [];
// Referral movements recorded by the settlement transaction (empty unless the
// member was referred).
let referrer = null;
const bonusMovements = [];
// Member notifications written by the settlement transaction: the Notification
// row first, then its UserNotification link.
const notifications = [];
const reset = () => { payments.clear(); investments.length = 0; bonusMovements.length = 0; notifications.length = 0; referrer = null; };

prisma.payment.create = async ({ data }) => {
  const row = {
    id: `payment-${payments.size + 1}`,
    telegramChargeId: null, telegramUserId: null, investmentId: null, invoiceUrl: null,
    confirmedAt: null, ...data,
  };
  payments.set(row.id, row);
  return { ...row };
};
prisma.payment.findUnique = async ({ where }) => {
  const row = payments.get(where.id);
  return row ? { ...row } : null;
};
prisma.payment.update = async ({ where, data }) => {
  const row = payments.get(where.id);
  if (!row) throw new Error('Payment not found');
  Object.assign(row, data);
  return { ...row };
};
prisma.payment.updateMany = async ({ where, data }) => {
  const row = payments.get(where.id);
  if (!row) return { count: 0 };
  if (where.status !== undefined && row.status !== where.status) return { count: 0 };
  Object.assign(row, data);
  return { count: 1 };
};
function matchPayment(row, where = {}) {
  if (where.provider && row.provider !== where.provider) return false;
  if (where.status && row.status !== where.status) return false;
  if (where.OR) {
    return where.OR.some(condition => (
      (condition.telegramChargeId?.contains && String(row.telegramChargeId ?? '').includes(condition.telegramChargeId.contains))
      || (condition.user?.email?.contains && 'member@example.test'.includes(condition.user.email.contains))
      || (condition.user?.name?.contains && 'Member'.includes(condition.user.name.contains))
    ));
  }
  return true;
}
prisma.payment.count = async ({ where }) => [...payments.values()].filter(row => matchPayment(row, where)).length;
prisma.payment.findMany = async ({ where, skip = 0, take = 10 }) => [...payments.values()]
  .filter(row => matchPayment(row, where))
  .slice(skip, skip + take)
  .map(row => ({ ...row, user: { id: row.userId, name: 'Member', email: 'member@example.test' } }));
prisma.payment.aggregate = async ({ where }) => {
  const rows = [...payments.values()].filter(row => matchPayment(row, where));
  return {
    _count: { _all: rows.length },
    _sum: {
      starsAmount: rows.reduce((total, row) => total + (row.starsAmount ?? 0), 0),
      amount: rows.reduce((total, row) => total.add(row.amount), D('0')),
    },
  };
};

prisma.investment.create = async ({ data }) => { investments.push(data); return { id: `investment-${investments.length}`, ...data }; };
prisma.$transaction = async (callback, options) => {
  assert.equal(options.isolationLevel, 'ReadCommitted');
  return callback({
    payment: { findUnique: prisma.payment.findUnique, updateMany: prisma.payment.updateMany, update: prisma.payment.update },
    subscriptionPlan: { findUnique: prisma.subscriptionPlan.findUnique },
    investment: { create: prisma.investment.create },
    notification: {
      create: async ({ data }) => { notifications.push(data); return { id: `notification-${notifications.length}`, ...data }; },
    },
    userNotification: {
      create: async ({ data }) => { notifications.push({ link: true, ...data }); return data; },
    },
    // Settlement activates the plan and credits the referrer in the same
    // transaction, so the referral delegates belong to this double too.
    user: {
      findUnique: async ({ where }) => ({
        id: where.id,
        email: 'member@example.test',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        referredBy: referrer ? { id: referrer } : null,
      }),
      update: async ({ where, data }) => { bonusMovements.push({ kind: 'user', where, data }); return { id: where.id }; },
    },
    wallet: {
      updateMany: async ({ where, data }) => { bonusMovements.push({ kind: 'wallet', where, data }); return { count: 1 }; },
    },
    transaction: {
      create: async ({ data }) => { bonusMovements.push({ kind: 'transaction', data }); return data; },
    },
  });
};

// ---------------------------------------------------------------------------
// Telegram Bot API double. Everything that is not api.telegram.org goes to the
// real fetch so the test can still talk to the app over HTTP.
// ---------------------------------------------------------------------------
const realFetch = globalThis.fetch;
const telegramCalls = [];
let invoiceStub = { ok: true, result: 'https://t.me/invoice/stub-link' };
const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, init) => {
  const href = String(url);
  if (!href.startsWith('https://api.telegram.org')) return realFetch(url, init);
  const method = href.slice(href.lastIndexOf('/') + 1);
  telegramCalls.push({ method, href, payload: JSON.parse(init?.body ?? '{}') });
  if (method === 'createInvoiceLink') return json(invoiceStub);
  if (method === 'answerPreCheckoutQuery') return json({ ok: true, result: true });
  if (method === 'getMe') return json({ ok: true, result: { id: 42, username: 'demo_bot' } });
  if (method === 'setWebhook') return json({ ok: true, result: true });
  return json({ ok: false, description: `no stub for ${method}` });
};

const server = await new Promise(resolve => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const url = path => `http://127.0.0.1:${server.address().port}/api${path}`;
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });

const WEBHOOK_SECRET = 'webhook-secret-for-tests';
const token = (id, kind = 'user') => JWT.generateToken({ id, kind, tokenVersion: 0 });
const member = token('member');
const admin = token('admin', 'admin');
const owner = token('super', 'admin');

async function api(path, { method = 'GET', token: bearer, body } = {}) {
  const response = await realFetch(url(path), {
    method,
    headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

/** Saves a complete, working Stars configuration through the admin endpoint. */
async function configureRail(overrides = {}) {
  const response = await api('/payment/telegram/settings', {
    method: 'PUT', token: owner, body: {
      botToken: '123456789:AAExampleBotTokenForTestsOnly123456',
      botUsername: '@demo_bot',
      webhookSecret: WEBHOOK_SECRET,
      // Stars charged per INR 1.
      starsPerInr: '50',
      maxStarsPerInvoice: 10000,
      isEnabled: true,
      ...overrides,
    },
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response;
}

/** Creates a pending Stars intent for the standard plan. */
async function createIntent(amount = '100') {
  const response = await api('/payment/telegram/invoice', { method: 'POST', token: member, body: { planId: plan.id, amount } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
}

/** Posts a Telegram update to the public webhook. Pass null to omit the header. */
function sendWebhook(update, secret = WEBHOOK_SECRET) {
  return realFetch(url('/payment/telegram/webhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-telegram-bot-api-secret-token': secret } : {}) },
    body: JSON.stringify(update),
    signal: AbortSignal.timeout(5000),
  });
}

/** A successful_payment update for the given intent. */
function paidUpdate(paymentId, overrides = {}) {
  return {
    update_id: 1,
    message: {
      from: { id: 777 },
      successful_payment: {
        invoice_payload: paymentId, telegram_payment_charge_id: 'charge-abc', total_amount: 5000, currency: 'XTR', ...overrides,
      },
    },
  };
}

test('the Bot API test environment is used only when TELEGRAM_TEST_ENV is set', async () => {
  settings = null;
  await configureRail();
  const botToken = '123456789:AAExampleBotTokenForTestsOnly123456';

  process.env.TELEGRAM_TEST_ENV = '';
  telegramCalls.length = 0;
  const production = await api('/payment/telegram/setup', { method: 'POST', token: owner, body: { webhookUrl: 'https://example.test/hook' } });
  assert.equal(production.status, 200, JSON.stringify(production.body));
  assert.equal(
    telegramCalls.find(call => call.method === 'setWebhook')?.href,
    `https://api.telegram.org/bot${botToken}/setWebhook`,
  );

  // Telegram's test environment is the same method with /test/ before its name.
  process.env.TELEGRAM_TEST_ENV = 'true';
  telegramCalls.length = 0;
  const testEnvironment = await api('/payment/telegram/setup', { method: 'POST', token: owner, body: { webhookUrl: 'https://example.test/hook' } });
  assert.equal(testEnvironment.status, 200, JSON.stringify(testEnvironment.body));
  assert.equal(
    telegramCalls.find(call => call.method === 'setWebhook')?.href,
    `https://api.telegram.org/bot${botToken}/test/setWebhook`,
  );
  process.env.TELEGRAM_TEST_ENV = '';
});

test('public config never exposes credentials and reports a disabled rail', async () => {
  settings = null;
  const response = await api('/payment/telegram/config');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.enabled, false);
  const serialised = JSON.stringify(response.body);
  assert.equal(serialised.includes('botToken'), false);
  assert.equal(serialised.includes('webhookSecret'), false);
});

test('member invoice needs configuration and refuses admin or anonymous callers', async () => {
  settings = null;
  reset();
  assert.equal((await api('/payment/telegram/invoice', { method: 'POST', token: member, body: { planId: plan.id, amount: '100' } })).status, 503);
  assert.equal((await api('/payment/telegram/invoice', { method: 'POST', body: { planId: plan.id, amount: '100' } })).status, 401);
  await configureRail();
  assert.equal((await api('/payment/telegram/invoice', { method: 'POST', token: admin, body: { planId: plan.id, amount: '100' } })).status, 403);
  assert.equal(investments.length, 0);
});

test('the Stars settings are owner-only, validated, and the secret is never echoed back', async () => {
  settings = null;
  const rawToken = '123456789:AAExampleBotTokenForTestsOnly123456';
  await configureRail();
  assert.equal(settings.botToken, rawToken);

  const saved = await api('/payment/telegram/settings', { token: owner });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.botTokenSet, true);
  assert.equal(saved.body.data.webhookSecretSet, true);
  assert.notEqual(saved.body.data.botToken, rawToken);
  assert.match(saved.body.data.botToken, /••••/);
  assert.notEqual(saved.body.data.webhookSecret, WEBHOOK_SECRET);
  assert.equal(JSON.stringify(saved.body).includes(rawToken), false);

  assert.equal((await api('/payment/telegram/settings', { token: member })).status, 403);
  assert.equal((await api('/payment/telegram/payments', { token: member })).status, 403);
  assert.equal((await api('/payment/telegram/settings', { method: 'PUT', token: member, body: { isEnabled: true } })).status, 403);
  // The bot token and the on/off switch stay with the owner: a sub-admin may
  // read the payments list but never the rail's credentials.
  assert.equal((await api('/payment/telegram/settings', { token: admin })).status, 403);
  assert.equal((await api('/payment/telegram/settings', { method: 'PUT', token: admin, body: { isEnabled: true } })).status, 403);

  assert.equal((await api('/payment/telegram/settings', { method: 'PUT', token: owner, body: { botToken: 'not-a-token' } })).status, 400);
  for (const starsPerInr of ['0', '-5', 'abc', '2000000', 'NaN']) {
    assert.equal((await api('/payment/telegram/settings', { method: 'PUT', token: owner, body: { starsPerInr } })).status, 400, starsPerInr);
  }
  assert.equal((await api('/payment/telegram/settings', { method: 'PUT', token: owner, body: { webhookSecret: 'short' } })).status, 400);
  assert.equal((await api('/payment/telegram/settings', { method: 'PUT', token: owner, body: { starsPerInr: '' } })).status, 400);
  assert.equal((await api('/payment/telegram/settings', { method: 'PUT', token: owner, body: {} })).status, 400);
  // A rejected update must not have corrupted the working configuration.
  assert.equal(settings.botToken, rawToken);
  assert.equal(settings.isEnabled, true);
});

test('invoice creation uses the plan rules and charges the configured Stars rate', async () => {
  reset();
  await configureRail();
  invoiceStub = { ok: true, result: 'https://t.me/invoice/stub-link' };
  telegramCalls.length = 0;

  const created = await createIntent();
  assert.equal(created.stars, 5000); // INR 100 x 50 Stars per rupee
  assert.equal(created.amount, '100'); // the plan is worth the rupees the member typed
  assert.equal(created.invoiceUrl, 'https://t.me/invoice/stub-link');

  const intent = payments.get(created.paymentId);
  assert.equal(intent.provider, 'TELEGRAM_STARS');
  assert.equal(intent.status, 'PENDING');
  assert.equal(intent.userId, 'member');
  assert.equal(intent.planId, plan.id);
  assert.equal(intent.currency, 'INR');
  assert.equal(intent.invoiceUrl, 'https://t.me/invoice/stub-link');

  const call = telegramCalls.find(entry => entry.method === 'createInvoiceLink');
  assert.equal(call.payload.currency, 'XTR');
  assert.equal(call.payload.provider_token, undefined);
  assert.deepEqual(call.payload.prices, [{ label: 'Telegram Stars', amount: 5000 }]);
  assert.equal(call.payload.payload, created.paymentId);
  assert.equal(call.payload.title.length <= 32, true);
  assert.equal(call.payload.description.length <= 255, true);

  // Plan limits are enforced by the same helper as the manual rail.
  for (const amount of ['49.99', '1000.01', '100.999', '0', '-1', 'NaN', '1e2', 'abc', null]) {
    assert.equal((await api('/payment/telegram/invoice', { method: 'POST', token: member, body: { planId: plan.id, amount } })).status, 400, String(amount));
  }
  assert.equal((await api('/payment/telegram/invoice', { method: 'POST', token: member, body: { planId: 'missing', amount: '100' } })).status, 404);
  assert.equal((await api('/payment/telegram/invoice', { method: 'POST', token: member, body: { amount: '100' } })).status, 400);
  assert.equal(payments.size, 1);
});

test('the Stars cap and a disabled rail both refuse new invoices', async () => {
  reset();
  await configureRail({ maxStarsPerInvoice: 1000 });
  const capped = await api('/payment/telegram/invoice', { method: 'POST', token: member, body: { planId: plan.id, amount: '100' } });
  assert.equal(capped.status, 400);
  assert.match(capped.body.error, /Stars limit/);

  await configureRail({ isEnabled: false });
  const disabled = await api('/payment/telegram/invoice', { method: 'POST', token: member, body: { planId: plan.id, amount: '100' } });
  assert.equal(disabled.status, 503);
  assert.match(disabled.body.error, /disabled/);
  assert.equal(payments.size, 0);
  await configureRail();
});

test('a failed invoice call expires the intent instead of leaving it payable', async () => {
  reset();
  await configureRail();
  invoiceStub = { ok: false, description: 'Bad Request: invoice rejected' };
  const response = await api('/payment/telegram/invoice', { method: 'POST', token: member, body: { planId: plan.id, amount: '100' } });
  assert.equal(response.status, 503);
  assert.equal([...payments.values()][0].status, 'EXPIRED');
  invoiceStub = { ok: true, result: 'https://t.me/invoice/stub-link' };
});

test('webhook requires the secret header and validates pre-checkout queries', async () => {
  reset();
  await configureRail();
  const { paymentId } = await createIntent();

  assert.equal((await sendWebhook({}, null)).status, 401);
  assert.equal((await sendWebhook({}, 'wrong-secret-value')).status, 401);

  telegramCalls.length = 0;
  const unknown = await sendWebhook({ pre_checkout_query: { id: 'q1', invoice_payload: 'nope', currency: 'XTR', total_amount: 5000 } });
  assert.equal(unknown.status, 200);
  assert.equal((await unknown.json()).answered, false);
  assert.equal(telegramCalls.at(-1).payload.ok, false);

  const good = await sendWebhook({ pre_checkout_query: { id: 'q2', invoice_payload: paymentId, currency: 'XTR', total_amount: 5000 } });
  assert.equal(good.status, 200);
  assert.equal((await good.json()).answered, true);
  assert.equal(telegramCalls.at(-1).payload.pre_checkout_query_id, 'q2');

  const wrongAmount = await sendWebhook({ pre_checkout_query: { id: 'q3', invoice_payload: paymentId, currency: 'XTR', total_amount: 4000 } });
  assert.equal((await wrongAmount.json()).answered, false);

  // Already confirmed intents cannot be paid twice.
  payments.get(paymentId).status = 'CONFIRMED';
  const replayed = await sendWebhook({ pre_checkout_query: { id: 'q4', invoice_payload: paymentId, currency: 'XTR', total_amount: 5000 } });
  assert.equal((await replayed.json()).answered, false);
  payments.get(paymentId).status = 'PENDING';
});

test('a confirmed payment creates exactly one investment and is idempotent', async () => {
  reset();
  await configureRail();
  const { paymentId } = await createIntent();

  // A mismatched amount must never create an investment.
  const mismatch = await sendWebhook(paidUpdate(paymentId, { total_amount: 4000 }));
  assert.equal(mismatch.status, 200);
  assert.equal((await mismatch.json()).credited, false);
  assert.equal(investments.length, 0);

  const wrongCurrency = await sendWebhook(paidUpdate(paymentId, { currency: 'USD' }));
  assert.equal((await wrongCurrency.json()).credited, false);

  const settled = await sendWebhook(paidUpdate(paymentId));
  assert.equal(settled.status, 200);
  assert.deepEqual(await settled.json(), { received: true, credited: true });
  assert.equal(investments.length, 1);
  assert.equal(investments[0].userId, 'member');
  assert.equal(investments[0].planId, plan.id);
  assert.equal(investments[0].amountInvested.toString(), '100');
  assert.equal(investments[0].roiPercentage.toString(), '10');
  assert.equal(investments[0].transactionId, 'charge-abc');
  assert.equal(investments[0].status, 'ACTIVE', 'paying for the plan activates it immediately');
  assert.equal(investments[0].totalReturn, null);
  assert.ok(investments[0].endDate.getUTCMonth() === (investments[0].startDate.getUTCMonth() + 6) % 12);

  // The member hears about the activation immediately — one notification row
  // plus the link that puts it in their own feed.
  assert.equal(notifications.length, 2, 'one notification row plus one member link');
  assert.equal(notifications[0].type, 'SUCCESS');
  assert.match(notifications[0].title, /activated/i);
  assert.match(notifications[0].message, /₹100\.00/);
  assert.deepEqual(notifications[1], { link: true, userId: 'member', notificationId: 'notification-1' });

  const intent = payments.get(paymentId);
  assert.equal(intent.status, 'CONFIRMED');
  assert.equal(intent.telegramChargeId, 'charge-abc');
  assert.equal(intent.telegramUserId, '777');
  assert.equal(intent.investmentId, 'investment-1');

  // Telegram may redeliver; a replay must not pay twice.
  const replay = await sendWebhook(paidUpdate(paymentId));
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).credited, false);
  assert.equal(investments.length, 1);
  assert.equal(notifications.length, 2, 'a replay must not notify the member twice');

  // A second charge for the same intent is refused, not credited.
  const conflicting = await sendWebhook(paidUpdate(paymentId, { telegram_payment_charge_id: 'charge-different' }));
  assert.equal((await conflicting.json()).credited, false);
  assert.equal(investments.length, 1);
});

test('the same plan can be invested in again — a repeat purchase is an explicit re-invest', async () => {
  reset();
  await configureRail();

  const first = await createIntent('100');
  await sendWebhook(paidUpdate(first.paymentId, { telegram_payment_charge_id: 'charge-first' }));
  assert.equal(investments.length, 1);

  // Buying the SAME plan a second time is allowed on purpose: it is a re-invest
  // (top-up) and must get its own investment next to the first one, not be
  // refused and not overwrite what the member already owns.
  const second = await createIntent('200');
  const settled = await sendWebhook(paidUpdate(second.paymentId, {
    telegram_payment_charge_id: 'charge-second', total_amount: 10000,
  }));
  assert.equal(settled.status, 200);
  assert.deepEqual(await settled.json(), { received: true, credited: true });

  assert.equal(investments.length, 2, 'a repeat purchase must create its own investment');
  assert.deepEqual(investments.map(entry => entry.planId), [plan.id, plan.id]);
  assert.deepEqual(investments.map(entry => entry.amountInvested.toString()), ['100', '200']);
  assert.deepEqual(investments.map(entry => entry.status), ['ACTIVE', 'ACTIVE']);
  assert.deepEqual(investments.map(entry => entry.transactionId), ['charge-first', 'charge-second']);
  // Each purchase keeps its own plan link, ROI terms and payment reference.
  assert.deepEqual(investments.map(entry => entry.roiPercentage.toString()), ['10', '10']);
  assert.equal(payments.get(first.paymentId).investmentId, 'investment-1');
  assert.equal(payments.get(second.paymentId).investmentId, 'investment-2');
  assert.equal(payments.get(first.paymentId).status, 'CONFIRMED', 'the first purchase stays intact');
});

test('status polling is limited to the owner and the admin list reports totals', async () => {
  reset();
  await configureRail();
  const { paymentId } = await createIntent();
  await sendWebhook(paidUpdate(paymentId));

  const own = await api(`/payment/telegram/status/${paymentId}`, { token: member });
  assert.equal(own.status, 200);
  assert.equal(own.body.data.status, 'CONFIRMED');
  assert.equal(own.body.data.stars, 5000);
  assert.equal(own.body.data.investmentId, 'investment-1');

  const other = await api(`/payment/telegram/status/${paymentId}`, { token: token('other') });
  assert.equal(other.status, 403);
  assert.equal((await api(`/payment/telegram/status/${paymentId}`)).status, 401);
  assert.equal((await api('/payment/telegram/status/missing', { token: member })).status, 404);

  const list = await api('/payment/telegram/payments', { token: admin });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].stars, 5000);
  assert.equal(list.body.data[0].plan.name, 'Monthly');
  assert.equal(list.body.data[0].user.email, 'member@example.test');
  assert.equal(list.body.stats.confirmedStars, 5000);
  assert.equal(list.body.stats.confirmedInr, '100');

  const filtered = await api('/payment/telegram/payments?status=REFUNDED', { token: admin });
  assert.equal(filtered.body.pagination.total, 0);
  const searched = await api('/payment/telegram/payments?search=charge-abc', { token: admin });
  assert.equal(searched.body.pagination.total, 1);
});

test('an activated plan credits the referrer once, in the settlement transaction', async () => {
  reset();
  await configureRail();
  referrer = 'referrer';
  const { paymentId } = await createIntent();

  const settled = await sendWebhook(paidUpdate(paymentId));
  assert.deepEqual(await settled.json(), { received: true, credited: true });
  const userUpdate = bonusMovements.find(movement => movement.kind === 'user');
  assert.ok(userUpdate, 'the referrer must be credited when the plan activates');
  assert.equal(userUpdate.where.id, 'referrer');
  // The member joined long before this investment, so the standard 5% applies.
  assert.equal(userUpdate.data.totalEarnings.increment.toString(), '5');
  assert.equal(userUpdate.data.inrBalance.increment.toString(), '5');
  assert.equal(bonusMovements.find(movement => movement.kind === 'wallet').data.balance.increment.toString(), '5');
  assert.equal(bonusMovements.find(movement => movement.kind === 'transaction').data.type, 'REFERRAL_BONUS');

  // A replayed webhook must not pay the bonus a second time.
  const replay = await sendWebhook(paidUpdate(paymentId));
  assert.equal((await replay.json()).credited, false);
  assert.equal(bonusMovements.filter(movement => movement.kind === 'transaction').length, 1);
  assert.equal(investments.length, 1);
});

test('webhook setup needs a public https url and reports the bot identity', async () => {
  await configureRail();
  const local = await api('/payment/telegram/setup', { method: 'POST', token: owner, body: {} });
  assert.equal(local.status, 400);
  assert.match(local.body.error, /https/);
  assert.equal(local.body.bot.username, 'demo_bot');

  telegramCalls.length = 0;
  const registered = await api('/payment/telegram/setup', { method: 'POST', token: owner, body: { webhookUrl: 'https://api.example.test/api/payment/telegram/webhook' } });
  assert.equal(registered.status, 200, JSON.stringify(registered.body));
  assert.equal(registered.body.webhookUrl, 'https://api.example.test/api/payment/telegram/webhook');
  const setWebhook = telegramCalls.find(entry => entry.method === 'setWebhook');
  assert.equal(setWebhook.payload.secret_token, WEBHOOK_SECRET);
  assert.deepEqual(setWebhook.payload.allowed_updates, ['pre_checkout_query', 'message']);
  assert.equal(settings.webhookUrl, 'https://api.example.test/api/payment/telegram/webhook');
});
