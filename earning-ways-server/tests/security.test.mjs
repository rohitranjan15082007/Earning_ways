import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'security-tests-only-secret-32-bytes-long';
process.env.CLOUD_NAME = process.env.CLOUD_API_KEY = process.env.CLOUD_API_SECRET = 'test-only';
const { default: prisma } = await import('../.test-build/config/prisma.js');
const { JWT } = await import('../.test-build/utils/jwt.utils.js');
const { app } = await import('../.test-build/index.js');

const passwordHash = await bcrypt.hash('correct-password', 10);
const accounts = {
  member: { id: 'member', email: 'member@example.test', passwordHash, tokenVersion: 0 },
  admin: { id: 'admin', email: 'admin@example.test', password: passwordHash, tokenVersion: 0 },
  // A back-office account that may edit profiles but not move money or reset logins.
  manager: { id: 'manager', email: 'manager@example.test', passwordHash, tokenVersion: 0, permissions: ['users:update'] },
};
prisma.user.findUnique = async ({ where }) => {
  if (where.id) return accounts.member.id === where.id ? { ...accounts.member } : null;
  return where.email === accounts.member.email ? { ...accounts.member } : null;
};
prisma.admin.findUnique = async ({ where }) => {
  if (where.id && where.id === accounts.manager.id) return { ...accounts.manager, role: 'ADMIN' };
  if (where.id) return accounts.admin.id === where.id ? { ...accounts.admin, role: 'ADMIN' } : null;
  return where.email === accounts.admin.email ? { ...accounts.admin, role: 'ADMIN' } : null;
};
const updates = [];
prisma.user.update = async ({ where, data }) => {
  updates.push({ where, data });
  if (data.tokenVersion?.increment) accounts.member.tokenVersion += data.tokenVersion.increment;
  if (typeof data.passwordHash === 'string') accounts.member.passwordHash = data.passwordHash;
  return { id: where.id };
};
prisma.admin.update = async ({ where, data }) => {
  if (data.tokenVersion?.increment) accounts.admin.tokenVersion += data.tokenVersion.increment;
  return { id: where.id };
};
const server = await new Promise(resolve => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
const url = path => `http://127.0.0.1:${server.address().port}${path}`;
const post = async (path, body, token) => {
  const response = await fetch(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
};
const put = async (path, body, token) => {
  const response = await fetch(url(path), {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, body: await response.json() };
};
const login = (body = { email: accounts.member.email, password: 'correct-password' }) => post('/api/user/login', body);
const version = () => JWT.generateToken({ id: 'member', kind: 'user', tokenVersion: accounts.member.tokenVersion });

test('security headers are set on API responses', async () => {
  const response = await login();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('strict-transport-security'), null, 'HSTS only in production');
});
test('unknown accounts and wrong passwords fail identically', async () => {
  const unknown = await login({ email: 'ghost@example.test', password: 'wrong' });
  const wrong = await login({ email: accounts.member.email, password: 'wrong' });
  // Same status and message: the response cannot be used to enumerate accounts.
  assert.equal(unknown.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal(unknown.body.error, wrong.body.error);
});
test('repeated failed logins are rate limited but valid credentials still work', async () => {
  let limited;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const response = await login({ email: 'attacker@example.test', password: 'wrong' });
    if (response.status === 429) { limited = response; break; }
    assert.equal(response.status, 401);
  }
  assert.ok(limited, 'expected a 429 after repeated failures');
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.match(limited.body.error, /Too many attempts/);
  // A different account from the same address is unaffected.
  assert.equal((await login()).status, 200);
});
test('password change needs the current password and revokes issued tokens', async () => {
  const before = (await login()).body.token;
  assert.equal((await put('/api/user/member', { name: 'Still Valid' }, before)).status, 200);
  // A stolen token alone cannot lock the owner out of the account.
  assert.equal((await put('/api/user/member', { password: 'a-new-password' }, before)).status, 400);
  assert.equal((await put('/api/user/member', { password: 'a-new-password', currentPassword: 'wrong' }, before)).status, 400);
  const changed = await put('/api/user/member', { password: 'a-new-password', currentPassword: 'correct-password' }, before);
  assert.equal(changed.status, 200);
  assert.equal(accounts.member.tokenVersion, 1);
  assert.ok(updates.some(entry => entry.data.tokenVersion?.increment === 1));
  // The token that performed the change is revoked too, along with older ones.
  assert.equal((await put('/api/user/member', { name: 'Nope' }, before)).status, 401);
  // The old password no longer authenticates (invalid credentials return 401).
  assert.equal((await login({ email: accounts.member.email, password: 'correct-password' })).status, 401);
  const reissued = await login({ email: accounts.member.email, password: 'a-new-password' });
  assert.equal(reissued.status, 200);
  assert.equal(JWT.verifyToken(reissued.body.token).tokenVersion, 1);
  assert.equal((await put('/api/user/member', { name: 'Works Again' }, reissued.body.token)).status, 200);
});
test('a sub-admin with users:update cannot reset a member password', async () => {
  const beforeHash = accounts.member.passwordHash;
  const managerToken = JWT.generateToken({ id: 'manager', kind: 'admin', tokenVersion: 0 });
  const response = await put('/api/user/member', { password: 'taken-over-password' }, managerToken);
  assert.equal(response.status, 403);
  assert.match(response.body.error, /owner/i);
  assert.equal(accounts.member.passwordHash, beforeHash);
});
test('logout revokes the session and admin logout revokes admin tokens', async () => {
  const token = version();
  assert.equal((await post('/api/user/logout', undefined, token)).status, 200);
  assert.equal(accounts.member.tokenVersion, 2);
  assert.equal((await put('/api/user/member', { name: 'Gone' }, token)).status, 401);
  // A member token cannot end an admin session, and vice versa.
  const adminToken = JWT.generateToken({ id: 'admin', kind: 'admin', tokenVersion: accounts.admin.tokenVersion });
  assert.equal((await post('/api/admin/logout', undefined, adminToken)).status, 200);
  assert.equal(accounts.admin.tokenVersion, 1);
  assert.equal((await post('/api/admin/logout', undefined, adminToken)).status, 401);
  assert.equal((await post('/api/admin/logout')).status, 401);
});
test('a token whose version no longer matches the account is rejected', async () => {
  const stale = JWT.generateToken({ id: 'member', kind: 'user', tokenVersion: accounts.member.tokenVersion - 1 });
  assert.equal((await put('/api/user/member', { name: 'Stale' }, stale)).status, 401);
});
