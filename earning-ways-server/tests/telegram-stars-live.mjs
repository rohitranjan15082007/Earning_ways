// LIVE acceptance test for the Telegram Stars rail — the real bot, the real
// Telegram API and a real customer invoice.
//
// NOT part of `npm test` (it needs a real bot token, a public HTTPS webhook and
// a human who can pay Stars). See TELEGRAM_STARS_LIVE_TEST.md for the runbook.
//
//   node tests/telegram-stars-live.mjs check
//   node tests/telegram-stars-live.mjs token --bot-token 123456:ABC… [--bot-username mybot]
//   node tests/telegram-stars-live.mjs webhook --url https://<public-host>/api/payment/telegram/webhook
//   node tests/telegram-stars-live.mjs pay --member user@local.test --password 'User@12345' \
//        --plan "Starter Plan" [--amount 100] [--timeout 600]
//
// `pay` creates a genuine invoice link: open it in Telegram and pay the Stars.
// The script then waits for Telegram's own webhook to confirm the payment and
// verifies the plan was activated exactly once.
import { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/index.js';

const API = process.env.LIVE_API ?? 'http://localhost:4000/api';
const SERVICE = '../public/service/telegramStars.js'; // the running build

let service;
try {
  service = await import(SERVICE);
} catch (error) {
  console.error(`Cannot load ${SERVICE} — run "npm run build" first (${error.message})`);
  process.exit(1);
}

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const command = argv[0];
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
};

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const mask = value => (typeof value === 'string' && value.length > 10
  ? `${value.slice(0, 4)}••••${value.slice(-4)} (len ${value.length})`
  : String(value ?? 'not set'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function http(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: response.status, ok: response.ok, json, text };
}

const requireConfig = async () => {
  try {
    return await service.loadStarsConfig();
  } catch (error) {
    console.error(`\nThe Stars rail is not configured: ${error.message}`);
    console.error('Save the real bot token on the admin Stars Payments page, then re-run "check".');
    process.exit(1);
  }
};

/** Reads what is actually stored, so a placeholder row can be called out. */
async function describeStorage() {
  const row = await service.loadStarsSettingsRow();
  console.log('stored settings');
  console.log(`  enabled          ${row ? row.isEnabled : `(env: ${process.env.TELEGRAM_STARS_ENABLED === 'true'})`}`);
  console.log(`  bot token        ${mask(row?.botToken ?? process.env.TELEGRAM_BOT_TOKEN)}`);
  console.log(`  bot username     ${row?.botUsername ?? process.env.TELEGRAM_BOT_USERNAME ?? 'not set'}`);
  console.log(`  webhook secret   ${mask(row?.webhookSecret ?? process.env.TELEGRAM_WEBHOOK_SECRET)}`);
  console.log(`  webhook url      ${row?.webhookUrl ?? 'not set'}`);
  console.log(`  stars per INR    ${row?.starsPerInr?.toString() ?? process.env.STARS_PER_INR ?? 'not set'}`);
  console.log(`  max stars/invoice ${row?.maxStarsPerInvoice ?? process.env.TELEGRAM_STARS_MAX_PER_INVOICE ?? 10000}`);
  console.log(`  environment      ${service.isTestEnvironment() ? "Telegram TEST environment (every method gets /test/)" : 'production (api.telegram.org)'}`);
  console.log('  (the stored admin row wins over .env, so a placeholder row here breaks the real flow)');
}

/** Runs a Bot API call in a chosen environment without leaking the switch. */
async function inEnvironment(testEnvironment, run) {
  const previous = process.env.TELEGRAM_TEST_ENV;
  process.env.TELEGRAM_TEST_ENV = testEnvironment ? 'true' : '';
  try {
    return await run();
  } catch (error) {
    return { error: error.message };
  } finally {
    process.env.TELEGRAM_TEST_ENV = previous;
  }
}

async function check() {
  await describeStorage();
  const config = await requireConfig();

  console.log('\nbot identity (real api.telegram.org calls, both environments)');
  const production = await inEnvironment(false, () => service.verifyBot(config));
  const testEnvironment = await inEnvironment(true, () => service.verifyBot(config));
  const describe = result => (result.error ? result.error : `id ${result.id}, @${result.username ?? 'no username'}`);
  console.log(`  production getMe → ${describe(production)}`);
  console.log(`  test-env getMe   → ${describe(testEnvironment)}`);
  const me = service.isTestEnvironment() ? testEnvironment : production;
  record('the stored bot token is accepted by Telegram', !me.error,
    me.error ? 'save the real token on the Stars Payments page' : `@${me.username}`);
  if (production.error && !testEnvironment.error) {
    console.log('  → this is a TEST-environment token: keep TELEGRAM_TEST_ENV=true, a production call will never work.');
  } else if (!production.error && testEnvironment.error) {
    console.log('  → this is a production token: Telegram\'s test environment will refuse it (see TELEGRAM_STARS_LIVE_TEST.md).');
  } else if (!production.error && !testEnvironment.error) {
    console.log('  → the same token is accepted in both environments.');
  }

  console.log('\nwebhook state');
  let info = null;
  try {
    info = await service.telegramApi(config.botToken, 'getWebhookInfo');
    console.log(`  url                  ${info?.url || 'not set'}`);
    console.log(`  pending_update_count ${info?.pending_update_count ?? 0}`);
    console.log(`  last_error           ${info?.last_error_message ?? 'none'}`);
  } catch (error) {
    console.log(`  getWebhookInfo → ${error.message}`);
  }
  const url = info?.url ?? '';
  record('a public https webhook is registered with Telegram',
    url.startsWith('https://') && !url.includes('example.com'),
    url || 'run: node tests/telegram-stars-live.mjs webhook --url https://<public-host>/api/payment/telegram/webhook');
  record('no undelivered updates are queued', (info?.pending_update_count ?? 0) === 0, String(info?.pending_update_count ?? 0));
  record('the webhook secret Telegram will echo back is configured', Boolean(config.webhookSecret), mask(config.webhookSecret));
  record('the rail is enabled', config.isEnabled === true);
  record('the Stars-per-INR rate is positive', Number(config.starsPerInr.toString()) > 0, `${config.starsPerInr.toString()} Stars per ₹1`);

  if (config.botUsername && me?.username && config.botUsername.toLowerCase() !== me.username.toLowerCase()) {
    console.log(`\nNote: the saved bot username (@${config.botUsername}) differs from the real one (@${me.username}); the invoice link itself is correct either way.`);
  }
  summarise();
}

async function saveToken() {
  const botToken = String(flag('bot-token', process.env.TELEGRAM_BOT_TOKEN ?? '')).trim();
  if (!botToken) throw new Error('pass --bot-token 123456:ABC… (create one with @BotFather; keep it out of shell history if you can)');
  const adminEmail = String(flag('admin', 'admin@local.test'));
  const adminPassword = String(flag('admin-password', 'Admin@12345'));

  const login = await http('/admin/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
  if (!login.ok) throw new Error(`admin login failed: ${login.status}`);

  const body = { botToken, isEnabled: true };
  const username = flag('bot-username');
  if (username) body.botUsername = username;
  const saved = await http('/payment/telegram/settings', { method: 'PUT', token: login.json.token, body });
  if (!saved.ok) throw new Error(`saving the token failed: ${saved.status} ${saved.text.slice(0, 200)}`);
  console.log(`saved. masked token now ${saved.json.data.botToken}`);

  const config = await requireConfig();
  const me = await service.verifyBot(config);
  console.log(`getMe → id ${me.id}, @${me.username ?? 'no username'}`);
  console.log(`\nNext: node tests/telegram-stars-live.mjs webhook --url https://<public-host>/api/payment/telegram/webhook`);
}

async function webhook() {
  const config = await requireConfig();
  const url = String(flag('url', config.webhookUrl ?? '')).trim();
  if (!/^https:\/\/[^\s]+/.test(url)) throw new Error('pass --url https://<public-host>/api/payment/telegram/webhook (Telegram cannot call http://localhost)');
  if (!config.webhookSecret) throw new Error('save a webhook secret on the admin page first');

  const adminEmail = String(flag('admin', 'admin@local.test'));
  const adminPassword = String(flag('admin-password', 'Admin@12345'));
  const login = await http('/admin/login', { method: 'POST', body: { email: adminEmail, password: adminPassword } });
  if (!login.ok) throw new Error(`admin login failed: ${login.status}`);
  const setup = await http('/payment/telegram/setup', { method: 'POST', token: login.json.token, body: { webhookUrl: url } });
  console.log(`POST /payment/telegram/setup → ${setup.status} ${setup.text.slice(0, 200)}`);

  const info = await service.telegramApi(config.botToken, 'getWebhookInfo');
  console.log(`webhook now: ${info?.url} (pending ${info?.pending_update_count ?? 0}, error ${info?.last_error_message ?? 'none'})`);
  record('Telegram accepted the webhook url', setup.ok && info?.url === url, info?.url);
  summarise();
}

async function pay() {
  const config = await requireConfig();
  if (!config.isEnabled) throw new Error('the Stars rail is disabled in the admin settings');

  const memberEmail = String(flag('member', 'user@local.test'));
  const memberPassword = String(flag('password', 'User@12345'));
  const planArg = flag('plan');
  const timeout = Number(flag('timeout', 600));

  const plan = planArg
    ? await prisma.subscriptionPlan.findFirst({ where: { OR: [{ id: planArg }, { name: planArg }] } })
    : null;
  if (!plan) throw new Error(`pass --plan with a plan id or name (available: ${(await prisma.subscriptionPlan.findMany({ select: { name: true } })).map(p => p.name).join(', ')})`);
  if (!plan.isActive) throw new Error(`plan "${plan.name}" is not active`);

  const amount = String(flag('amount', plan.minimumInvestment.toString()));
  const stars = service.starsForAmount(new Prisma.Decimal(amount), config.starsPerInr, config.maxStarsPerInvoice);

  const login = await http('/user/login', { method: 'POST', body: { email: memberEmail, password: memberPassword } });
  if (!login.ok) throw new Error(`member login failed for ${memberEmail}: ${login.status} ${login.text.slice(0, 160)}`);
  const token = login.json.token;
  const memberId = login.json.data.id;

  const invoice = await http('/payment/telegram/invoice', { method: 'POST', token, body: { planId: plan.id, amount } });
  if (!invoice.ok) throw new Error(`invoice creation failed: ${invoice.status} ${invoice.text.slice(0, 200)}`);
  const { paymentId, invoiceUrl, stars: starsInInvoice } = invoice.json;

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`REAL Telegram Stars invoice for ${memberEmail}`);
  console.log(`  plan          ${plan.name} (${plan.durationInMonths} months)`);
  console.log(`  amount        ₹${amount}`);
  console.log(`  stars         ${starsInInvoice} Telegram Stars  (real money)`);
  console.log(`  payment id    ${paymentId}`);
  console.log(`  invoice link  ${invoiceUrl}`);
  console.log(`  environment   ${config.testEnvironment ? "Telegram TEST environment (/test/)" : 'production'}`);
  if (config.testEnvironment) {
    console.log('  the link only opens for an account on the test servers, and test Stars may not');
    console.log('  be purchasable there — if it cannot be paid, see the runbook for the alternatives.');
  }
  console.log('  open the link in the Telegram app and pay; the script waits for the');
  console.log(`  webhook (up to ${timeout}s). Press Ctrl+C to stop.`);
  console.log('──────────────────────────────────────────────────────────────\n');

  const deadline = Date.now() + timeout * 1000;
  let status = 'PENDING';
  let lastSeen = '';
  while (Date.now() < deadline && status === 'PENDING') {
    await sleep(3000);
    const poll = await http(`/payment/telegram/status/${paymentId}`, { token });
    if (!poll.ok) { console.log(`  status poll → ${poll.status} ${poll.text.slice(0, 120)}`); continue; }
    status = poll.json.data.status;
    if (status !== lastSeen) { console.log(`  ${new Date().toISOString()}  payment is ${status}`); lastSeen = status; }
  }

  record('Telegram confirmed the payment (real successful_payment webhook)', status === 'CONFIRMED', status);

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  record('the intent was settled with a real Telegram charge id', Boolean(payment?.telegramChargeId), payment?.telegramChargeId ?? 'none');
  record('the payer identity was recorded', Boolean(payment?.telegramUserId), payment?.telegramUserId ?? 'none');
  record('the charged Stars match the invoice', payment?.starsAmount === starsInInvoice, `${payment?.starsAmount} vs ${starsInInvoice}`);

  const investments = payment?.telegramChargeId
    ? await prisma.investment.findMany({ where: { transactionId: payment.telegramChargeId } })
    : [];
  record('exactly one investment was activated for the charge', investments.length === 1, `${investments.length} investment(s)`);
  const investment = investments[0];
  record('the investment is ACTIVE and matches the plan amount', Boolean(investment) && investment.status === 'ACTIVE'
    && investment.amountInvested.toString() === Number(amount).toFixed(2), investment ? `${investment.status}, ₹${investment.amountInvested}` : 'none');

  const notifications = memberId
    ? await prisma.userNotification.findMany({ where: { userId: memberId }, include: { notification: true }, orderBy: { createdAt: 'desc' }, take: 3 })
    : [];
  const activated = notifications.find(link => link.notification.title === 'Investment activated');
  record('the member was notified that the plan went live', Boolean(activated), activated?.notification.message ?? 'no notification found');

  const totals = await prisma.payment.aggregate({ where: { provider: 'TELEGRAM_STARS', status: 'CONFIRMED' }, _count: { _all: true }, _sum: { amount: true, starsAmount: true } });
  console.log(`\nlive totals: ${totals._count._all} confirmed payments, ₹${totals._sum.amount ?? 0}, ${totals._sum.starsAmount ?? 0} Stars`);
  console.log('Refunds are available with refundStarPayment (telegram_payment_charge_id is stored on the investment).');
  summarise();
}

function summarise() {
  const failed = results.filter(entry => !entry.ok);
  console.log(`\n${results.length - failed.length}/${results.length} live checks passed`);
  if (failed.length) {
    console.log('failed:');
    for (const entry of failed) console.log(`  - ${entry.name}`);
    process.exitCode = 1;
  }
}

const commands = { check, token: saveToken, webhook, pay };

try {
  if (!commands[command]) {
    console.log('usage: node tests/telegram-stars-live.mjs <check|token|webhook|pay> [flags]');
    process.exitCode = 1;
  } else {
    await commands[command]();
  }
} catch (error) {
  console.error(`\nlive test failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
