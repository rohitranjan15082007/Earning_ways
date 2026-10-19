import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import express from 'express';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-signing-secret-at-least-32-bytes';
process.env.CLOUD_NAME = 'test-only';
process.env.CLOUD_API_KEY = 'test-only';
process.env.CLOUD_API_SECRET = 'test-only';
const { JWT } = await import('../.test-build/utils/jwt.utils.js');
const { ALL_PERMISSIONS } = await import('../.test-build/service/permissions.js');
const { default: prisma } = await import('../.test-build/config/prisma.js');
const { default: accessRoutes } = await import('../.test-build/routes/access.routes.js');
const { app } = await import('../.test-build/index.js');

const { Prisma: TestPrisma } = await import('../generated/prisma/client.js');
const testDecimal = TestPrisma.Decimal;
const password = await bcrypt.hash('example-password', 10);
const calls = [];
prisma.user.findUnique = async ({ where }) => {
  calls.push(['user', where]);
  if (where.referralCode === 'REFCODE') return { id: 'referrer' };
  const id = where.id || (where.email === 'member@example.test' ? 'member' : undefined);
  return ['member', 'other'].includes(id) ? { id, email: 'member@example.test', passwordHash: password, tokenVersion: 0 } : null;
};
// Rights live in the stored list, never in the token: 'admin' is a sub-admin
// with a narrow grant, 'viewer' may only read the team list, and 'super' is the
// owner, who holds every permission and cannot be limited.
const ADMIN_PERMISSIONS = {
  admin: ['withdrawals:read'],
  viewer: ['team:read'],
  // A row that claims owner-only keys: the gate must resolve the effective list.
  sneaky: ['users:delete', 'transactions:write', 'wallets:adjust'],
  super: ALL_PERMISSIONS,
};
const ADMIN_ROLES = { admin: 'ADMIN', viewer: 'ADMIN', sneaky: 'ADMIN', super: 'SUPER_ADMIN' };
prisma.admin.findUnique = async ({ where }) => {
  const id = where.id || (where.email === 'admin@example.test' ? 'admin' : undefined);
  if (!id || !(id in ADMIN_PERMISSIONS)) return null;
  return { id, email: 'admin@example.test', password, tokenVersion: 0, role: ADMIN_ROLES[id], permissions: ADMIN_PERMISSIONS[id] };
};
for (const [model, owners] of [
  ['investment', { userId: 'member' }], ['withdrawal', { userId: 'member' }],
  ['transaction', { userId: 'member' }], ['rOIRecord', { userId: 'member' }],
  ['supportTicket', { userId: 'member' }], ['transfer', { senderId: 'member', receiverId: 'other' }],
  ['referral', { referrerId: 'member', referredUserId: 'other' }],
]) {
  prisma[model].findUnique = async ({ where }) => where.id === 'owned' ? { id: 'owned', ...owners } : null;
}
prisma.subscriptionPlan.findMany = async () => [{ id: 'plan', name: 'Test plan' }];
let catalogArgs;
prisma.subscriptionPlan.findUnique = async args => {
  catalogArgs = args;
  return args.where.id === 'plan' ? { id: 'plan', name: 'Test plan' } : null;
};
prisma.setting.findFirst = async () => ({ maxiumEarningReturn: 2 });
let investmentArgs;
prisma.investment.findMany = async args => { investmentArgs = args; return []; };
prisma.investment.findFirst = async () => null;
prisma.user.update = async ({ where }) => ({ id: where.id });
prisma.transfer.create = async ({ data }) => ({ id: 'new', ...data });
prisma.wallet.findUnique = async ({ where }) => ({ userId: where.userId, currency: 'INR', upiId: 'member@bank', balance: 100 });
prisma.withdrawal.create = async ({ data }) => ({ id: 'new', ...data });
prisma.wallet.update = async () => ({});
prisma.wallet.updateMany = async () => ({ count: 1 });
prisma.user.updateMany = async () => ({ count: 1 });
prisma.wallet.findMany = async ({ where }) => where.userId.in.map(userId => ({ userId, currency: 'INR', balance: new testDecimal(100) }));
prisma.transaction.create = async () => ({});
prisma.$transaction = async callback => callback(prisma);

// Sign-up stubs: a brand-new member, with the referral code entirely optional.
const createdUsers = [];
let createdReferrals = [];
prisma.user.create = async ({ data }) => {
  createdUsers.push(data);
  return { id: 'new-member', name: data.name, email: data.email, upiId: data.upiId ?? null, referralCode: data.referralCode, tokenVersion: 0 };
};
prisma.wallet.create = async ({ data }) => ({ ...data });
prisma.referral.create = async ({ data }) => { createdReferrals.push(data); return { id: 'referral-1', ...data }; };

// A controller sentinel tests access independently from business/storage behavior.
const policyApp = express();
policyApp.enable('case sensitive routing');
policyApp.enable('strict routing');
policyApp.use(express.json());
policyApp.use('/api', accessRoutes);
policyApp.use((_req, res) => res.json({ reachedController: true, principal: res.locals.principal }));
policyApp.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
const listen = serverApp => new Promise(resolve => {
  const server = serverApp.listen(0, '127.0.0.1', () => resolve(server));
});
const policyServer = await listen(policyApp);
const realServer = await listen(app);
after(async () => {
  await Promise.all([policyServer, realServer].map(server => new Promise(resolve => server.close(resolve))));
  await prisma.$disconnect();
});
const token = (id, kind = 'user', tokenVersion = 0) => JWT.generateToken({ id, kind, tokenVersion });
const member = token('member');
const other = token('other');
const admin = token('admin', 'admin');
const viewer = token('viewer', 'admin');
const sneaky = token('sneaky', 'admin');
const superAdmin = token('super', 'admin');
async function request(path, { method = 'GET', token, body, real = false } = {}) {
  const server = real ? realServer : policyServer;
  return fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method,
    headers: { ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const protectedOperations = [
  ['GET', '/user/all'], ['GET', '/user/member'], ['PUT', '/user/member'], ['DELETE', '/user/member'],
  ['POST', '/admin/register'], ['GET', '/admin'], ['DELETE', '/admin/admin'],
  ['GET', '/user/referrals/member'], ['GET', '/user/wallet/member'], ['GET', '/user-dashboard/member'],
  ['POST', '/wallet/create'], ['GET', '/wallet/member'], ['PUT', '/wallet/member'], ['DELETE', '/wallet/member'],
  ['POST', '/withdraw/create'], ['POST', '/withdraw/qr'], ['GET', '/withdraw/all'], ['GET', '/withdraw/owned'], ['PUT', '/withdraw/owned'], ['DELETE', '/withdraw/owned'], ['GET', '/withdraw/user/member'],
  ['POST', '/investment/create'], ['GET', '/investment/all'], ['GET', '/investment/owned'], ['PUT', '/investment/owned'], ['DELETE', '/investment/owned'], ['GET', '/investment/details/owned'],
  ['POST', '/record/create'], ['GET', '/record/all?userId=member'], ['GET', '/record/owned'], ['PUT', '/record/owned'], ['DELETE', '/record/owned'], ['GET', '/record/user/member'], ['GET', '/record/investment/owned'],
  ['POST', '/transaction/create'], ['GET', '/transaction/all'], ['GET', '/transaction/owned'], ['PUT', '/transaction/owned'], ['DELETE', '/transaction/owned'], ['GET', '/transaction/user/member'], ['GET', '/transaction/investment/owned'],
  ['POST', '/transfer/create'], ['GET', '/transfer/all'], ['GET', '/transfer/owned'], ['PUT', '/transfer/owned'], ['DELETE', '/transfer/owned'], ['GET', '/transfer/sender/member'], ['GET', '/transfer/receiver/member'],
  ['POST', '/referral/create'], ['GET', '/referral/all'], ['GET', '/referral/owned'], ['PUT', '/referral/owned'], ['DELETE', '/referral/owned'], ['GET', '/referral/referrer/member'], ['GET', '/referral/referred/member'],
  ['POST', '/support-tickets'], ['GET', '/support-tickets'], ['GET', '/support-tickets/owned'], ['PUT', '/support-tickets/owned'], ['DELETE', '/support-tickets/owned'], ['GET', '/support-tickets/user/member'],
  ['POST', '/notifications/create'], ['GET', '/notifications/all'], ['GET', '/notifications/member'],
  ['GET', '/enquiry'], ['GET', '/enquiry/owned'], ['DELETE', '/enquiry/owned'], ['POST', '/setting/update/setting'], ['GET', '/dashboardRoutes'],
  ['POST', '/subscription/create'], ['PUT', '/subscription/plan'], ['DELETE', '/subscription/plan'], ['GET', '/subscription/plan/investments'],
  // Telegram Stars reporting and credentials (the only payment rail).
  ['GET', '/payment/telegram/payments'], ['GET', '/payment/telegram/settings'], ['PUT', '/payment/telegram/settings'], ['POST', '/payment/telegram/setup'],
];

test('all sensitive operations reject anonymous HTTP requests', async () => {
  for (const [method, path] of protectedOperations) {
    assert.equal((await request(path, { method })).status, 401, `${method} ${path}`);
  }
});
test('invalid, expired, wrong algorithm, legacy and deleted-account tokens fail closed', async () => {
  const claims = { id: 'member', kind: 'user', tokenVersion: 0 };
  const options = { issuer: 'earning-ways-api', audience: 'earning-ways-app' };
  const invalid = [
    'garbage', member.slice(0, -5) + 'abcde',
    jwt.sign(claims, process.env.JWT_SECRET, { ...options, expiresIn: -1 }),
    jwt.sign(claims, 'incorrect-signing-secret', { ...options, expiresIn: '1h' }),
    jwt.sign(claims, process.env.JWT_SECRET, { ...options, algorithm: 'HS384', expiresIn: '1h' }),
    jwt.sign({ id: 'member' }, process.env.JWT_SECRET, { expiresIn: '1h' }),
    jwt.sign({ id: 'member', kind: 'user' }, process.env.JWT_SECRET, { ...options, expiresIn: '1h' }),
    jwt.sign({ ...claims, tokenVersion: 9 }, process.env.JWT_SECRET, { ...options, expiresIn: '1h' }),
    jwt.sign(claims, process.env.JWT_SECRET, options),
    token('deleted'), token('deleted', 'admin'),
  ];
  for (const invalidToken of invalid) assert.equal((await request('/user/member', { token: invalidToken })).status, 401);
});
test('public login/signup/contact/catalog and the Stars webhook remain available; invalid tokens fail', async () => {
  for (const [method, path] of [['POST', '/user/create'], ['POST', '/user/login'], ['POST', '/admin/login'], ['POST', '/enquiry'], ['GET', '/subscription/all'], ['GET', '/subscription/plan'], ['GET', '/setting'], ['GET', '/payment/telegram/config'], ['POST', '/payment/telegram/webhook']]) {
    assert.equal((await request(path, { method })).status, 200, path);
  }
  assert.equal((await request('/subscription/all', { token: 'invalid' })).status, 401);
});
test('members cannot perform admin writes or read aggregate data', async () => {
  for (const [method, path] of protectedOperations.filter(([method, path]) =>
    ['PUT', 'DELETE'].includes(method) && !path.startsWith('/user/member') ||
    path.endsWith('/all') && !path.startsWith('/record/') ||
    ['/record/create', '/transaction/create', '/referral/create', '/notifications/create', '/subscription/create', '/setting/update/setting', '/dashboardRoutes', '/enquiry', '/admin/register', '/admin'].includes(path)
  )) assert.equal((await request(path, { method, token: member })).status, 403, `${method} ${path}`);
});
test('recording an investment is an operations-only action', async () => {
  // A purchase is activated by the Telegram Stars settlement, so a member can
  // never record one for themselves.
  assert.equal((await request('/investment/create', { method: 'POST', token: member })).status, 403);
});
test('admin management requires live SUPER_ADMIN role, not a signed role claim', async () => {
  // Handing out rights and deleting accounts is the owner's alone.
  for (const [method, path] of [['POST', '/admin/register'], ['DELETE', '/admin/admin']]) {
    assert.equal((await request(path, { method, token: admin })).status, 403);
    assert.equal((await request(path, { method, token: viewer })).status, 403);
    assert.equal((await request(path, { method, token: superAdmin })).status, 200);
  }
  // Reading the team list is a normal right: team:read is enough.
  assert.equal((await request('/admin', { token: admin })).status, 403);
  assert.equal((await request('/admin', { token: viewer })).status, 200);
  assert.equal((await request('/admin', { token: superAdmin })).status, 200);
  const forgedRole = JWT.generateToken({ id: 'admin', kind: 'admin', role: 'SUPER_ADMIN', tokenVersion: 0 });
  assert.equal((await request('/admin/register', { method: 'POST', token: forgedRole })).status, 403);
});
test('owner-only rights cannot be smuggled in through a stored permission row', async () => {
  // Deleting a member, editing the ledger and moving a balance by hand are the
  // owner's alone: the request gate resolves the effective list, which drops an
  // owner-only key no matter what the stored row says.
  assert.equal((await request('/user/member', { method: 'DELETE', token: sneaky })).status, 403);
  assert.equal((await request('/transaction/create', { method: 'POST', token: sneaky })).status, 403);
  assert.equal((await request('/wallet/member', { method: 'PUT', token: sneaky })).status, 403);
  // The owner performs exactly those actions.
  assert.equal((await request('/user/member', { method: 'DELETE', token: superAdmin })).status, 200);
  assert.equal((await request('/transaction/create', { method: 'POST', token: superAdmin })).status, 200);
  assert.equal((await request('/wallet/member', { method: 'PUT', token: superAdmin })).status, 200);
});
test('member URLs, body IDs and query IDs are ownership checked', async () => {
  for (const path of ['/user/member', '/user/referrals/member', '/user/wallet/member', '/wallet/member', '/withdraw/user/member', '/user-dashboard/member', '/record/user/member', '/record/all?userId=member', '/transaction/user/member', '/transfer/sender/member', '/transfer/receiver/member', '/referral/referrer/member', '/referral/referred/member', '/support-tickets/user/member', '/notifications/member']) {
    assert.equal((await request(path, { token: member })).status, 200, path);
    assert.equal((await request(path, { token: other })).status, 403, path);
  }
  for (const [path, key] of [['/withdraw/create', 'userId'], ['/wallet/create', 'userId'], ['/transfer/create', 'senderId'], ['/support-tickets', 'userId']]) {
    assert.equal((await request(path, { method: 'POST', token: member, body: { [key]: 'member' } })).status, 200);
    assert.equal((await request(path, { method: 'POST', token: other, body: { [key]: 'member' } })).status, 403);
    assert.equal((await request(path, { method: 'POST', token: member, body: { [key]: ['member'] } })).status, 403);
  }
});
test('resource lookups enforce ownership including related investment endpoints', async () => {
  for (const path of ['/investment/owned', '/investment/details/owned', '/withdraw/owned', '/transaction/owned', '/record/owned', '/support-tickets/owned', '/record/investment/owned', '/transaction/investment/owned']) {
    assert.equal((await request(path, { token: member })).status, 200, path);
    assert.equal((await request(path, { token: other })).status, 404, path);
    assert.equal((await request(path.replace('owned', 'missing'), { token: member })).status, 404);
  }
  for (const path of ['/transfer/owned', '/referral/owned']) {
    assert.equal((await request(path, { token: member })).status, 200);
    assert.equal((await request(path, { token: other })).status, 200);
  }
});
test('admin operations and unknown routes default to role enforcement', async () => {
  assert.equal((await request('/withdraw/owned', { method: 'PUT', token: admin })).status, 200);
  // A sub-admin with no payout grant never reaches the decision at all.
  assert.equal((await request('/withdraw/owned', { method: 'PUT', token: viewer })).status, 403);
  assert.equal((await request('/future-sensitive-route', { token: member })).status, 403);
  assert.equal((await request('/future-sensitive-route')).status, 401);

});

test('real app public plans cannot leak other users investments or spoof catalog identity', async () => {
  assert.equal((await request('/subscription/plan?id=other', { real: true })).status, 200);
  assert.equal(catalogArgs.include.investments, false);
  assert.equal((await request('/subscription/plan?id=other', { token: member, real: true })).status, 200);
  assert.equal(catalogArgs.include.investments.where.userId, 'member');
  assert.equal((await request('/subscription/all?id=other', { token: member, real: true })).status, 200);
  assert.equal(investmentArgs.where.userId, 'member');
});
test('real app prevents password takeover and approval bypasses including URL variants', async () => {
  assert.equal((await request('/user/other', { method: 'PUT', token: member, body: { password: 'hacked' }, real: true })).status, 403);
  assert.equal((await request('/user/member', { method: 'PUT', token: member, body: { name: 'Updated' }, real: true })).status, 200);
  for (const path of ['/withdraw/owned', '/withdraw/owned/', '/WITHDRAW/owned']) {
    assert.equal((await request(path, { method: 'PUT', token: member, body: { status: 'APPROVED' }, real: true })).status, 403);
  }
  for (const path of ['/user/all', '/user/all/', '/USER/all']) {
    assert.equal((await request(path, { real: true })).status, 401);
  }
  const variant = await request('/subscription/ALL', { real: true });
  assert.equal(variant.status, 404);
  assert.equal(catalogArgs.where.id, 'ALL');
  assert.equal(catalogArgs.include.investments, false);
  assert.equal((await request('/user/other/', { token: member, real: true })).status, 403);
});
test('real app accepts a UPI withdrawal and rejects spoofed sender/processed transfer', async () => {
  const payout = { qrCodeUrl: 'https://cdn.example.test/payout-qr.png' };
  assert.equal((await request('/withdraw/create', { method: 'POST', token: member, body: { userId: 'member', amount: 10, upiId: 'member@bank', ...payout }, real: true })).status, 201);
  assert.equal((await request('/withdraw/create', { method: 'POST', token: member, body: { userId: 'other', amount: 10, upiId: 'member@bank', ...payout }, real: true })).status, 403);
  assert.equal((await request('/withdraw/create', { method: 'POST', token: member, body: { userId: 'member', amount: 10, upiId: 'not-a-upi', ...payout }, real: true })).status, 400);
  // The payout QR is mandatory, so a request without one is refused too.
  assert.equal((await request('/withdraw/create', { method: 'POST', token: member, body: { userId: 'member', amount: 10, upiId: 'member@bank' }, real: true })).status, 400);
  assert.equal((await request('/transfer/create', { method: 'POST', token: member, body: { senderId: 'other', receiverId: 'member', amount: 10 }, real: true })).status, 403);
  assert.equal((await request('/transfer/create', { method: 'POST', token: member, body: { senderId: 'member', receiverId: 'other', amount: 10, status: 'SUCCESS' }, real: true })).status, 403);
  assert.equal((await request('/transfer/create', { method: 'POST', token: member, body: { senderId: 'member', receiverId: 'other', amount: 10 }, real: true })).status, 201);
});
test('real member and admin login issue scoped tokens consumable by guarded HTTP APIs', async () => {
  for (const [path, email, kind, protectedPath] of [
    ['/user/login', 'member@example.test', 'user', '/user/member'],
    ['/admin/login', 'admin@example.test', 'admin', '/dashboardRoutes'],
  ]) {
    const response = await request(path, { method: 'POST', body: { email, password: 'example-password' }, real: true });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(JWT.verifyToken(data.token).kind, kind);
    if (kind === 'user') assert.equal('passwordHash' in data.data, false);
    assert.equal((await request(protectedPath, { token: data.token })).status, 200);
  }
});
test('the referral code is optional at sign-up and validated only when supplied', async () => {
  createdUsers.length = 0; createdReferrals = [];
  // No referral code at all: a normal registration.
  const plain = await request('/user/create', { method: 'POST', real: true, body: { name: 'Plain', email: 'plain@example.test', password: 'example-password' } });
  assert.equal(plain.status, 200, JSON.stringify(await plain.clone().text()));
  assert.equal(createdUsers[0].referredById, null);
  assert.equal(createdReferrals.length, 0);
  // A blank code behaves exactly like an absent one.
  const blank = await request('/user/create', { method: 'POST', real: true, body: { name: 'Blank', email: 'blank@example.test', password: 'example-password', referredByCode: '   ' } });
  assert.equal(blank.status, 200);
  assert.equal(createdUsers[1].referredById, null);
  assert.equal(createdReferrals.length, 0);
  // A code that matches no member is refused instead of being silently ignored.
  const wrong = await request('/user/create', { method: 'POST', real: true, body: { name: 'Wrong', email: 'wrong@example.test', password: 'example-password', referredByCode: 'NOPE' } });
  assert.equal(wrong.status, 400);
  assert.equal(createdUsers.length, 2);
  // A valid code links the member to the referrer.
  const referred = await request('/user/create', { method: 'POST', real: true, body: { name: 'Referred', email: 'referred@example.test', password: 'example-password', referredByCode: 'REFCODE' } });
  assert.equal(referred.status, 200);
  assert.equal(createdUsers[2].referredById, 'referrer');
  assert.equal(createdReferrals.length, 1);
  assert.equal(createdReferrals[0].referrerId, 'referrer');
  assert.equal(createdReferrals[0].level, 1);
  assert.equal(createdReferrals[0].bonusPercentage, 0.05);
});

test('weak or missing signing secret fails configuration validation', async () => {
  const { default: ENV } = await import('../.test-build/config/env.js');
  const original = ENV.JWT_SECRET;
  try {
    ENV.JWT_SECRET = '';
    assert.throws(() => JWT.assertConfigured(), /32 bytes/);
    ENV.JWT_SECRET = 'short';
    assert.throws(() => JWT.generateToken({ id: 'member', kind: 'user' }), /32 bytes/);
  } finally { ENV.JWT_SECRET = original; }
});
