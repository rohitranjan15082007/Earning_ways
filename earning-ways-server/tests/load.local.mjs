// Local capacity / load test for the Earning Ways API.
//
// NOT part of `npm test`: it needs the local stack running (the API on :4000 —
// `npm run build && npm start` — and the MariaDB from .env) and it WRITES rows.
//
// Every row it creates carries the `load+<n>@local.test` marker, and `cleanup`
// removes exactly those rows. Nothing else in the database is touched.
//
//   node tests/load.local.mjs seed --users 5000
//   node tests/load.local.mjs crypto
//   node tests/load.local.mjs login --users 200 --concurrency 10
//   node tests/load.local.mjs ladder --levels 1,10,25,50,100,200 --seconds 8
//   node tests/load.local.mjs admin  --levels 1,10,25,50 --seconds 8
//   node tests/load.local.mjs payments --count 300 --concurrency 25
//   node tests/load.local.mjs cleanup
//
// The numbers it prints are for THIS machine (one Node process, one MariaDB on
// localhost) and are a lower bound for a production setup on real hardware.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client.js';

const API = process.env.LOAD_API ?? 'http://localhost:4000/api';
const PASSWORD = 'Load@12345';
const MARKER = 'load+';
const TOKENS_FILE = join(dirname(fileURLToPath(import.meta.url)), '.tmp-load-tokens.json');
const prisma = new PrismaClient();

const argv = process.argv.slice(2);
const command = argv[0];
const flag = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const bucket = (map, key) => {
  let list = map.get(key);
  if (!list) { list = []; map.set(key, list); }
  return list;
};
const money = value => Number(value.toString());

// ------------------------------------------------------------------ http

async function request(path, { method = 'GET', token, body, headers = {}, timeout = 30_000 } = {}) {
  const started = performance.now();
  try {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
    const text = await response.text();
    return { ms: performance.now() - started, status: response.status, ok: response.ok, text };
  } catch (error) {
    return { ms: performance.now() - started, status: 0, ok: false, text: String(error?.message ?? error) };
  }
}

const assertUp = async () => {
  const health = await request('/subscription/all');
  if (health.status === 0) throw new Error(`API not reachable at ${API} — start it with "npm run build && npm start"`);
};

// --------------------------------------------------------------- statistics

const percentile = (sorted, fraction) => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
};

function summarise(name, samples, errors, wallMs, requests) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    name,
    requests,
    rps: requests / (wallMs / 1000),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? 0,
    errors,
  };
}

const printTable = rows => {
  console.log('scenario            requests   req/s    p50     p95     p99     max   errors');
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(18)} ${String(row.requests).padStart(9)} ${row.rps.toFixed(1).padStart(7)}`
      + ` ${row.p50.toFixed(0).padStart(6)} ${row.p95.toFixed(0).padStart(7)} ${row.p99.toFixed(0).padStart(7)}`
      + ` ${row.max.toFixed(0).padStart(7)} ${String(row.errors).padStart(8)}`,
    );
  }
  console.log('(latencies in ms; errors = non-2xx responses including 429/500)');
};

// --------------------------------------------------------------- seed

async function seed() {
  const users = Number(flag('users', 5000));
  console.log(`seeding ${users} synthetic members (password ${PASSWORD}) …`);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { minimumInvestment: 'asc' } });
  if (plans.length === 0) throw new Error('no subscription plans in the database — run the seed first');

  const batch = async (rows, write, size = 1000) => {
    for (let index = 0; index < rows.length; index += size) await write(rows.slice(index, index + size));
  };

  const now = Date.now();
  const userIds = [];
  const userRows = [];
  const walletRows = [];
  const investmentRows = [];
  const transactionRows = [];
  const roiRows = [];
  const notificationRows = [];
  const userNotificationRows = [];

  for (let index = 0; index < users; index += 1) {
    const id = randomUUID();
    userIds.push(id);
    userRows.push({
      id,
      name: `Load User ${index}`,
      email: `${MARKER}${index}@local.test`,
      passwordHash,
      referralCode: `LOAD${String(index).padStart(7, '0')}`,
      inrBalance: '1250.00',
      totalEarnings: '250.00',
    });
    walletRows.push({ userId: id, currency: 'INR', balance: '1250.00' });

    plans.slice(0, 2).forEach((plan, slot) => {
      const investmentId = randomUUID();
      investmentRows.push({
        id: investmentId,
        userId: id,
        planId: plan.id,
        transactionId: `load-inv-${index}-${slot}`,
        amountInvested: plan.minimumInvestment,
        roiPercentage: plan.roiPerMonth ?? '0.10',
        startDate: new Date(now - 30 * 86_400_000),
        endDate: new Date(now + plan.durationInMonths * 30 * 86_400_000),
        status: 'ACTIVE',
      });
      for (let year = 0; year < 2; year += 1) {
        transactionRows.push({
          userId: id,
          type: 'ROI',
          amount: '12.50',
          currency: 'INR',
          status: 'SUCCESS',
          description: 'Load test ROI credit',
          investmentId,
          createdAt: new Date(now - year * 200 * 86_400_000 - slot * 86_400_000),
        });
      }
      for (let record = 0; record < 6; record += 1) {
        roiRows.push({
          userId: id,
          investmentId,
          weekNumber: record + 1,
          roiAmount: '12.50',
          creditedForDate: new Date(now - record * 3 * 86_400_000),
          createdAt: new Date(now - record * 3 * 86_400_000),
        });
      }
    });

    for (let note = 0; note < 3; note += 1) {
      const notificationId = randomUUID();
      notificationRows.push({
        id: notificationId,
        title: `Load notification ${note}`,
        message: 'Synthetic notification created by tests/load.local.mjs',
        type: 'INFO',
      });
      userNotificationRows.push({ userId: id, notificationId });
    }
  }

  await batch(userRows, rows => prisma.user.createMany({ data: rows, skipDuplicates: true }));
  await batch(walletRows, rows => prisma.wallet.createMany({ data: rows, skipDuplicates: true }));
  await batch(investmentRows, rows => prisma.investment.createMany({ data: rows, skipDuplicates: true }));
  await batch(transactionRows, rows => prisma.transaction.createMany({ data: rows }));
  await batch(roiRows, rows => prisma.rOIRecord.createMany({ data: rows }));
  await batch(notificationRows, rows => prisma.notification.createMany({ data: rows, skipDuplicates: true }));
  await batch(userNotificationRows, rows => prisma.userNotification.createMany({ data: rows, skipDuplicates: true }));

  console.log(`seeded: ${userRows.length} users, ${investmentRows.length} investments, ${transactionRows.length} transactions,`
    + ` ${roiRows.length} roi records, ${notificationRows.length} notifications`);
}

// --------------------------------------------------------------- credentials

async function loginCount() {
  if (existsSync(TOKENS_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(TOKENS_FILE, 'utf8'));
      if (Array.isArray(cached) && cached.length) return cached;
    } catch { /* re-login */ }
  }
  return null;
}

/** Logs in `count` distinct synthetic members (each has its own e-mail, so the
 *  per-account credential limiter is not tripped). Returns [{id, token}]. */
async function loginMembers(count) {
  const cached = await loginCount();
  if (cached && cached.length >= count) return cached.slice(0, count);

  const users = await prisma.user.findMany({
    where: { email: { startsWith: MARKER } },
    select: { id: true, email: true },
    take: count,
  });
  if (users.length < count) throw new Error(`only ${users.length} synthetic members stored — run "seed --users ${count}" first`);

  const tokens = [];
  for (const user of users) {
    const response = await request('/user/login', { method: 'POST', body: { email: user.email, password: PASSWORD }, timeout: 60_000 });
    if (!response.ok) throw new Error(`login failed for ${user.email}: ${response.status} ${response.text.slice(0, 120)}`);
    tokens.push({ id: user.id, token: JSON.parse(response.text).token });
  }
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens));
  return tokens;
}

async function loginAdmin() {
  const response = await request('/admin/login', { method: 'POST', body: { email: 'admin@local.test', password: 'Admin@12345' }, timeout: 60_000 });
  if (!response.ok) throw new Error(`admin login failed: ${response.status} ${response.text.slice(0, 120)}`);
  return JSON.parse(response.text).token;
}

// --------------------------------------------------------------- benchmarks

/** Pure CPU cost of the login hash — bcryptjs is JavaScript, so this runs on
 *  the event loop thread and is the platform's real login ceiling. */
async function crypto() {
  const rounds = 20;
  for (const cost of [8, 10, 12]) {
    const hash = await bcrypt.hash('benchmark', cost);
    const started = performance.now();
    for (let index = 0; index < rounds; index += 1) await bcrypt.compare('benchmark', hash);
    const perCompare = (performance.now() - started) / rounds;
    console.log(`bcryptjs cost ${cost}: ${perCompare.toFixed(1)} ms per compare → ~${(1000 / perCompare).toFixed(1)} logins/s on one core`);
  }
  console.log(`(the API runs a single Node process, so this is a hard ceiling for the whole login endpoint)`);
}

async function loginLadder() {
  const users = Number(flag('users', 200));
  const concurrency = Number(flag('concurrency', 10));
  await assertUp();
  const members = await prisma.user.findMany({ where: { email: { startsWith: MARKER } }, select: { email: true }, take: users });
  if (members.length === 0) throw new Error('no synthetic members — run "seed" first');

  console.log(`logging in ${members.length} distinct members at concurrency ${concurrency} …`);
  const samples = [];
  const errors = [];
  const started = performance.now();
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < members.length) {
      const member = members[cursor++];
      const response = await request('/user/login', { method: 'POST', body: { email: member.email, password: PASSWORD }, timeout: 60_000 });
      samples.push(response.ms);
      if (!response.ok) errors.push(response.status);
    }
  }));
  printTable([summarise('member login', samples, errors.length, performance.now() - started, samples.length)]);
  console.log(`error statuses: ${JSON.stringify(errors.slice(0, 8))}${errors.length > 8 ? ` … ${errors.length} total` : ''}`);
}

const READ_MIX = [
  { name: 'catalog', weight: 40, path: () => '/subscription/all' },
  { name: 'user-dashboard', weight: 30, path: user => `/user-dashboard/${user.id}` },
  { name: 'transactions', weight: 15, path: user => `/transaction/user/${user.id}?page=1&limit=10` },
  { name: 'notifications', weight: 10, path: user => `/notifications/${user.id}` },
];

async function runLevel(name, workers, seconds, members, endpoints) {
  const cumulative = [];
  let total = 0;
  for (const endpoint of endpoints) { total += endpoint.weight; cumulative.push({ ...endpoint, upTo: total }); }
  const pick = () => {
    const roll = Math.random() * total;
    return cumulative.find(endpoint => roll <= endpoint.upTo);
  };

  const perEndpoint = new Map();
  const perEndpointErrors = new Map();
  const all = [];
  let errors = 0;
  const deadline = performance.now() + seconds * 1000;

  const worker = async index => {
    let counter = index;
    while (performance.now() < deadline) {
      const member = members[counter++ % members.length];
      const endpoint = pick();
      const response = await request(endpoint.path(member), { token: member.token });
      bucket(perEndpoint, endpoint.name).push(response.ms);
      all.push(response.ms);
      if (!response.ok) { errors += 1; bucket(perEndpointErrors, endpoint.name).push(response.status); }
    }
  };

  const started = performance.now();
  await Promise.all(Array.from({ length: workers }, (_, index) => worker(index)));
  const wall = performance.now() - started;

  const rows = [summarise(`${name} all`, all, errors, wall, all.length)];
  for (const endpoint of endpoints) {
    const samples = perEndpoint.get(endpoint.name) ?? [];
    const failures = perEndpointErrors.get(endpoint.name) ?? [];
    rows.push(summarise(`${name} ${endpoint.name}`, samples, failures.length, wall, samples.length));
  }
  return rows;
}

async function ladder() {
  await assertUp();
  const levels = String(flag('levels', '1,10,25,50,100,200')).split(',').map(Number);
  const seconds = Number(flag('seconds', 8));
  const members = await loginMembers(Math.max(...levels) + 5);
  console.log(`read ladder: ${members.length} members, ${seconds}s per level\n`);

  const report = [];
  // Warm-up, so the first level is not measuring compile/JIT time.
  await runLevel('warmup', 5, 3, members, READ_MIX);
  for (const level of levels) {
    const rows = await runLevel(`${level} users`, level, seconds, members, READ_MIX);
    report.push(...rows);
  }
  printTable(report);
}

async function adminProbe() {
  await assertUp();
  const levels = String(flag('levels', '1,10,25,50')).split(',').map(Number);
  const seconds = Number(flag('seconds', 8));
  const token = await loginAdmin();
  const members = [{ id: token, token }];
  const endpoints = [{ name: 'admin-dashboard', weight: 1, path: () => '/dashboardRoutes' }];
  console.log(`admin dashboard probe (one aggregate-heavy admin request per worker)\n`);
  const report = [];
  for (const level of levels) report.push(...await runLevel(`${level} admins`, level, seconds, members, endpoints));
  printTable(report);
}

/** Telegram Stars settlement: the money path. Creates real PENDING intents in
 *  the database, then delivers genuine webhook bodies (with the stored secret)
 *  and measures how fast a payment can be confirmed + a plan activated. */
async function payments() {
  await assertUp();
  const count = Number(flag('count', 300));
  const concurrency = Number(flag('concurrency', 25));
  const setting = await prisma.telegramStarsSetting.findFirst({});
  if (!setting?.webhookSecret) throw new Error('no Telegram Stars row with a webhook secret in the database');
  const secret = setting.webhookSecret;

  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { minimumInvestment: 'asc' }, take: 2 });
  if (plans.length === 0) throw new Error('no plans');
  const members = await loginMembers(50);

  const intents = [];
  for (let index = 0; index < count; index += 1) {
    const plan = plans[index % plans.length];
    const member = members[index % members.length];
    const stars = Math.ceil(money(plan.minimumInvestment) * 0.55);
    intents.push({
      id: randomUUID(),
      userId: member.id,
      amount: plan.minimumInvestment,
      currency: 'INR',
      provider: 'TELEGRAM_STARS',
      status: 'PENDING',
      planId: plan.id,
      starsAmount: stars,
      chargeId: `load-charge-${randomUUID()}`,
    });
  }
  await prisma.payment.createMany({
    data: intents.map(intent => ({
      id: intent.id, userId: intent.userId, amount: intent.amount, currency: intent.currency,
      provider: intent.provider, status: intent.status, planId: intent.planId, starsAmount: intent.starsAmount,
    })),
  });

  const webhookBody = intent => ({
    message: {
      from: { id: 987654321 },
      successful_payment: {
        invoice_payload: intent.id,
        telegram_payment_charge_id: intent.chargeId,
        total_amount: intent.starsAmount,
        currency: 'XTR',
      },
    },
  });

  console.log(`settling ${count} Stars payments at concurrency ${concurrency} (secret-authenticated webhooks) …`);
  const samples = [];
  const failures = [];
  let cursor = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < intents.length) {
      const intent = intents[cursor++];
      const response = await request('/payment/telegram/webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': secret },
        body: webhookBody(intent),
        timeout: 60_000,
      });
      samples.push(response.ms);
      let credited = null;
      try { credited = JSON.parse(response.text).credited; } catch { /* not json */ }
      if (!response.ok || credited !== true) failures.push({ status: response.status, body: response.text.slice(0, 140) });
    }
  }));
  const wall = performance.now() - started;
  printTable([summarise('stars settlement', samples, failures.length, wall, samples.length)]);
  if (failures.length) console.log('first failures:', JSON.stringify(failures.slice(0, 3), null, 1));

  const confirmed = await prisma.payment.count({ where: { id: { in: intents.map(i => i.id) }, status: 'CONFIRMED' } });
  const chargeIds = intents.map(intent => intent.chargeId);
  const investments = await prisma.investment.count({ where: { transactionId: { in: chargeIds } } });
  console.log(`confirmed ${confirmed}/${count}, investments created ${investments} (must equal ${count} — one plan per payment)`);

  // Replay idempotency: the same receipt delivered twice must never double-credit.
  const replay = [];
  for (const intent of intents.slice(0, 25)) {
    const response = await request('/payment/telegram/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': secret },
      body: webhookBody(intent),
    });
    let credited = null;
    try { credited = JSON.parse(response.text).credited; } catch { /* not json */ }
    replay.push({ status: response.status, credited });
  }
  const afterReplay = await prisma.investment.count({ where: { transactionId: { in: chargeIds } } });
  const replayCredited = replay.filter(entry => entry.credited === true).length;
  console.log(`replayed 25 webhooks → credited=${replayCredited} (must be 0), investments still ${afterReplay} (must be ${count})`);

  const wrongSecret = await request('/payment/telegram/webhook', {
    method: 'POST', headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' }, body: webhookBody(intents[0]),
  });
  console.log(`webhook with a wrong secret → ${wrongSecret.status} (must be 401)`);
}

// --------------------------------------------------------------- cleanup

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: MARKER } }, select: { id: true } });
  const ids = users.map(user => user.id);
  console.log(`removing ${ids.length} synthetic members and their rows …`);
  if (ids.length) {
    const [payments, transfers, referrals, withdrawals, tickets, notifications] = await Promise.all([
      prisma.payment.deleteMany({ where: { userId: { in: ids } } }),
      prisma.transfer.deleteMany({ where: { OR: [{ senderId: { in: ids } }, { receiverId: { in: ids } }] } }),
      prisma.referral.deleteMany({ where: { OR: [{ referrerId: { in: ids } }, { referredUserId: { in: ids } }] } }),
      prisma.withdrawal.deleteMany({ where: { userId: { in: ids } } }),
      prisma.supportTicket.deleteMany({ where: { userId: { in: ids } } }),
      prisma.userNotification.deleteMany({ where: { userId: { in: ids } } }),
    ]);
    const removed = await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log({ payments: payments.count, transfers: transfers.count, referrals: referrals.count, withdrawals: withdrawals.count, tickets: tickets.count, userNotifications: notifications.count, users: removed.count });
  }
  // Notifications are shared rows; only the ones nothing links to any more go —
  // the seeded ones and the "Investment activated" notes the payments left behind.
  const orphans = await prisma.notification.findMany({
    where: {
      userNotifications: { none: {} },
      OR: [
        { message: { contains: 'tests/load.local.mjs' } },
        { message: { contains: 'Telegram Stars were received' } },
      ],
    },
    select: { id: true },
  });
  if (orphans.length) await prisma.notification.deleteMany({ where: { id: { in: orphans.map(row => row.id) } } });
  if (existsSync(TOKENS_FILE)) rmSync(TOKENS_FILE);
  console.log(`removed ${orphans.length} orphan notifications; token cache cleared`);
}

// --------------------------------------------------------------- entry point

const commands = { seed, crypto, login: loginLadder, ladder, admin: adminProbe, payments, cleanup };

try {
  const run = commands[command];
  if (!run) {
    console.log('usage: node tests/load.local.mjs <seed|crypto|login|ladder|admin|payments|cleanup> [flags]');
    process.exitCode = 1;
  } else {
    await run();
  }
} catch (error) {
  console.error('load test failed:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
