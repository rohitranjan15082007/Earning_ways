import assert from 'node:assert/strict';
import { after, test } from 'node:test';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'money-tests-only-secret-at-least-32-bytes';
process.env.CLOUD_NAME = process.env.CLOUD_API_KEY = process.env.CLOUD_API_SECRET = 'test-only';
const { default: prisma } = await import('../.test-build/config/prisma.js');
const { Prisma } = await import('../generated/prisma/client.js');
const { JWT } = await import('../.test-build/utils/jwt.utils.js');
const { ALL_PERMISSIONS } = await import('../.test-build/service/permissions.js');
const { app } = await import('../.test-build/index.js');
const D = value => new Prisma.Decimal(value);
const CURRENCY = 'INR';
let state, failLedger, queue = Promise.resolve(), sequence = 0;
const reset = (balance = 100) => {
  state = { wallets: { member: { userId: 'member', currency: CURRENCY, balance: String(balance) }, other: { userId: 'other', currency: CURRENCY, balance: '0' } }, users: { member: String(balance), other: '0' }, withdrawals: {}, transfers: {}, ledger: {}, notifications: [], notificationLinks: [] };
  failLedger = false;
};
const row = value => value ? { ...value, ...(value.amount !== undefined ? { amount: D(value.amount) } : {}), ...(value.balance !== undefined ? { balance: D(value.balance) } : {}) } : null;
const updateBalance = (record, where, field, change) => {
  if (!record || (where.currency && record.currency !== where.currency) || (where[field]?.gte && D(record[field]).lessThan(where[field].gte))) return { count: 0 };
  record[field] = D(record[field])[change.increment !== undefined ? 'add' : 'sub'](change.increment ?? change.decrement).toString();
  return { count: 1 };
};
const delegates = {
  wallet: {
    findMany: async ({ where }) => where.userId.in.map(id => state.wallets[id]).filter(w => w?.currency === where.currency).map(row),
    updateMany: async ({ where, data }) => {
      assert.equal(where.currency, CURRENCY);
      if (data.balance.decrement) assert.ok(where.balance?.gte, 'debit must use atomic balance guard');
      return updateBalance(state.wallets[where.userId], where, 'balance', data.balance);
    },
  },
  user: {
    updateMany: async ({ where, data }) => {
      assert.ok(where.inrBalance?.gte, 'user debit must have balance guard');
      const record = state.users[where.id] === undefined ? null : { inrBalance: state.users[where.id] };
      const result = updateBalance(record, where, 'inrBalance', data.inrBalance);
      if (result.count) state.users[where.id] = record.inrBalance;
      return result;
    },
    update: async ({ where, data }) => {
      assert.ok(where.id in state.users);
      state.users[where.id] = D(state.users[where.id]).add(data.inrBalance.increment).toString();
      return {};
    },
  },
  notification: {
    create: async ({ data }) => {
      const id = `notification-${++sequence}`;
      state.notifications.push({ id, ...data });
      return { id, ...data };
    },
  },
  userNotification: {
    create: async ({ data }) => {
      state.notificationLinks.push({ ...data });
      return { id: `link-${++sequence}`, ...data };
    },
  },
  transaction: {
    create: async ({ data }) => {
      if (failLedger) throw new Error('Injected ledger failure');
      const id = `ledger-${++sequence}`;
      state.ledger[id] = { id, ...data, amount: data.amount.toString() };
      return row(state.ledger[id]);
    },
    findMany: async ({ where }) => Object.values(state.ledger).filter(item =>
      item.userId === where.userId && item.type === where.type && item.status === where.status &&
      item.currency === where.currency && D(item.amount).equals(where.amount) && item.meta?.withdrawalId === where.meta.equals).map(row),
    updateMany: async ({ where, data }) => {
      const item = state.ledger[where.id];
      if (!item || item.status !== where.status) return { count: 0 };
      Object.assign(item, data); return { count: 1 };
    },
  },
};
for (const [model, collection] of [['withdrawal', 'withdrawals'], ['transfer', 'transfers']]) {
  delegates[model] = {
    create: async ({ data }) => {
      const id = `${model}-${++sequence}`;
      state[collection][id] = { id, ...data, amount: data.amount.toString(), updatedAt: new Date() };
      return row(state[collection][id]);
    },
    findUnique: async ({ where }) => row(state[collection][where.id]),
    updateMany: async ({ where, data }) => {
      const item = state[collection][where.id];
      if (!item || item.status !== where.status || (where.amount && !D(item.amount).equals(where.amount)) ||
          (where.updatedAt && item.updatedAt.getTime() !== where.updatedAt.getTime())) return { count: 0 };
      Object.assign(item, data, ...(data.amount ? [{ amount: data.amount.toString() }] : []));
      return { count: 1 };
    },
    delete: async ({ where }) => { const item = state[collection][where.id]; delete state[collection][where.id]; return row(item); },
    deleteMany: async ({ where }) => {
      const item = state[collection][where.id];
      if (!item || !where.status.in.includes(item.status)) return { count: 0 };
      delete state[collection][where.id]; return { count: 1 };
    },
  };
}
prisma.user.findUnique = async ({ where }) => where.id in state.users ? { id: where.id, tokenVersion: 0 } : null;
// The operator driving the panel in these tests is fully authorised: the
// permission gates themselves are covered by tests/auth.test.mjs.
prisma.admin.findUnique = async () => ({ id: 'admin', role: 'ADMIN', tokenVersion: 0, permissions: ALL_PERMISSIONS });
// The approval policy and the audit trail stay out of these money assertions.
prisma.setting.findFirst = async () => null;
prisma.adminAuditLog.create = async ({ data }) => data;
prisma.withdrawal.findUnique = delegates.withdrawal.findUnique;
prisma.transfer.findUnique = delegates.transfer.findUnique;
prisma.transfer.deleteMany = delegates.transfer.deleteMany;
prisma.$transaction = (callback, options) => {
  assert.equal(options.isolationLevel, 'ReadCommitted');
  const operation = queue.then(async () => {
    const snapshot = structuredClone(state);
    try { return await callback(delegates); }
    catch (error) { state = snapshot; throw error; }
  });
  queue = operation.catch(() => {}); // Release the test queue after a modeled rollback.
  return operation;
};
reset();
const server = await new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});
after(async () => { await new Promise(resolve => server.close(resolve)); await prisma.$disconnect(); });
async function request(path, method, body, admin = false) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method, headers: { Authorization: `Bearer ${JWT.generateToken({ id: admin ? 'admin' : 'member', kind: admin ? 'admin' : 'user', tokenVersion: 0 })}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, body: await response.json() };
}
const withdraw = amount => request('/withdraw/create', 'POST', { userId: 'member', amount, upiId: 'member@bank', qrCodeUrl: 'https://cdn.example.test/payout-qr.png' });
const transfer = amount => request('/transfer/create', 'POST', { senderId: 'member', receiverId: 'other', amount });
const approve = (id, body = { status: 'SUCCESS' }) => request(`/transfer/${id}`, 'PUT', body, true);
const totals = () => [state.wallets.member.balance, state.users.member, state.wallets.other.balance, state.users.other];

test('a withdrawal snapshots the UPI id and the uploaded payout QR', async () => {
  reset();
  const response = await withdraw(20);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  const stored = state.withdrawals[response.body.data.id];
  assert.equal(stored.upiId, 'member@bank');
  assert.equal(stored.qrCodeUrl, 'https://cdn.example.test/payout-qr.png');
  assert.equal(Object.values(state.ledger)[0].currency, CURRENCY);
  // A malformed UPI id cannot create a payout request.
  for (const upiId of ['', '   ', 'not-a-vpa', 'name@', '@bank', 42, null]) {
    assert.equal((await request('/withdraw/create', 'POST', { userId: 'member', amount: 20, upiId, qrCodeUrl: 'https://cdn.example.test/payout-qr.png' })).status, 400, String(upiId));
  }
});

test('the payout QR is mandatory and a processed withdrawal notifies the member', async () => {
  reset();
  // No QR image, no payout request — refused before any money moves.
  for (const qrCodeUrl of [undefined, '', '   ', 42, null]) {
    const body = { userId: 'member', amount: 20, upiId: 'member@bank', ...(qrCodeUrl !== undefined ? { qrCodeUrl } : {}) };
    assert.equal((await request('/withdraw/create', 'POST', body)).status, 400, String(qrCodeUrl));
  }
  assert.equal(Object.keys(state.withdrawals).length, 0);
  assert.deepEqual(totals(), ['100', '100', '0', '0']);

  // Approval tells the member the money was sent...
  const approved = (await withdraw(20)).body.data.id;
  assert.equal((await request(`/withdraw/${approved}`, 'PUT', { status: 'APPROVED' }, true)).status, 200);
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].type, 'SUCCESS');
  assert.match(state.notifications[0].title, /paid/i);
  assert.match(state.notifications[0].message, /member@bank/);
  assert.deepEqual(state.notificationLinks, [{ userId: 'member', notificationId: state.notifications[0].id }]);

  // ...and a rejection tells them the amount came back, with the refund applied.
  const rejected = (await withdraw(20)).body.data.id;
  assert.equal((await request(`/withdraw/${rejected}`, 'PUT', { status: 'REJECTED' }, true)).status, 200);
  assert.equal(state.notifications.length, 2);
  assert.equal(state.notifications[1].type, 'WARNING');
  assert.match(state.notifications[1].message, /back in your balance/);
  assert.deepEqual(totals(), ['80', '80', '0', '0']);
});

test('parallel withdrawals cannot overspend; duplicate rejection refunds exactly once', async () => {
  reset(100);
  const responses = await Promise.all([withdraw(70), withdraw(70)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 400]);
  assert.deepEqual(totals(), ['30', '30', '0', '0']);
  const id = responses.find(r => r.status === 201).body.data.id;
  const rejected = await Promise.all(Array.from({ length: 6 }, () => request(`/withdraw/${id}`, 'PUT', { status: 'REJECTED' }, true)));
  assert.equal(rejected.filter(r => r.status === 200).length, 1);
  assert.equal(rejected.filter(r => r.status === 409).length, 5);
  assert.deepEqual(totals(), ['100', '100', '0', '0']);
  assert.equal(Object.values(state.ledger)[0].status, 'FAILED');
});
test('approval versus cancellation cannot produce a successful withdrawal and refund', async () => {
  reset();
  const { body: { data: { id } } } = await withdraw(20);
  const responses = await Promise.all([request(`/withdraw/${id}`, 'PUT', { status: 'APPROVED' }, true), request(`/withdraw/${id}`, 'DELETE', undefined, true)]);
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  if (responses[0].status === 200) {
    assert.equal(responses[1].status, 409);
    assert.deepEqual(totals(), ['80', '80', '0', '0']);
    assert.equal(state.withdrawals[id].status, 'APPROVED');
    assert.equal(Object.values(state.ledger)[0].status, 'SUCCESS');
  } else {
    assert.equal(responses[0].status, 404);
    assert.equal(responses[1].status, 200);
    assert.equal(state.withdrawals[id], undefined);
    assert.deepEqual(totals(), ['100', '100', '0', '0']);
    assert.equal(Object.values(state.ledger)[0].status, 'FAILED');
  }
  assert.equal((await request(`/withdraw/${id}`, 'PUT', { status: 'PENDING' }, true)).status, 400);
  reset();
  const pending = (await withdraw(20)).body.data.id;
  assert.equal((await request(`/withdraw/${pending}`, 'DELETE', undefined, true)).status, 200);
  assert.deepEqual(totals(), ['100', '100', '0', '0']);
  assert.equal((await request(`/withdraw/${pending}`, 'PUT', { status: 'APPROVED' }, true)).status, 404);
});
test('same-amount withdrawals resolve their exact ledger and legacy records fail closed', async () => {
  reset();
  const a = (await withdraw(20)).body.data.id, b = (await withdraw(20)).body.data.id;
  assert.equal((await request(`/withdraw/${a}`, 'PUT', { status: 'APPROVED' }, true)).status, 200);
  assert.equal(Object.values(state.ledger).find(l => l.meta.withdrawalId === b).status, 'PENDING');
  const linked = Object.values(state.ledger).find(l => l.meta.withdrawalId === b);
  delete linked.meta;
  assert.equal((await request(`/withdraw/${b}`, 'PUT', { status: 'REJECTED' }, true)).status, 409);
  assert.equal(state.withdrawals[b].status, 'PENDING');
  assert.deepEqual(totals(), ['60', '60', '0', '0']);
});
test('duplicate transfer approval moves money and creates two ledger entries only once', async () => {
  reset();
  const id = (await transfer('25.12')).body.data.id;
  assert.deepEqual(totals(), ['100', '100', '0', '0']);
  const responses = await Promise.all(Array.from({ length: 6 }, () => approve(id)));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 5);
  assert.deepEqual(totals(), ['74.88', '74.88', '25.12', '25.12']);
  assert.equal(Object.keys(state.ledger).length, 2);
  assert.equal((await approve(id, { status: 'PENDING' })).status, 409);
  assert.equal((await approve(id, { amount: 1 })).status, 409);
  assert.equal((await request(`/transfer/${id}`, 'DELETE', undefined, true)).status, 409);
});
test('competing transfers and mixed withdrawal/approval share the guarded debit', async () => {
  reset();
  const ids = [(await transfer(70)).body.data.id, (await transfer(70)).body.data.id];
  assert.deepEqual((await Promise.all(ids.map(id => approve(id)))).map(r => r.status).sort(), [200, 400]);
  assert.deepEqual(totals(), ['30', '30', '70', '70']);
  reset();
  const id = (await transfer(70)).body.data.id;
  const mixed = await Promise.all([withdraw(70), approve(id)]);
  if (mixed[0].status === 201) {
    assert.equal(mixed[1].status, 400);
    assert.deepEqual(totals(), ['30', '30', '0', '0']);
  } else {
    assert.equal(mixed[0].status, 400);
    assert.equal(mixed[1].status, 200);
    assert.deepEqual(totals(), ['30', '30', '70', '70']);
  }
});
test('failure rolls back claims, balances and ledgers; retry is safe', async () => {
  reset(); failLedger = true;
  assert.equal((await withdraw(20)).status, 500);
  assert.deepEqual(totals(), ['100', '100', '0', '0']);
  assert.equal(Object.keys(state.withdrawals).length, 0);
  failLedger = false;
  const id = (await transfer(20)).body.data.id;
  failLedger = true;
  assert.equal((await approve(id)).status, 500);
  assert.equal(state.transfers[id].status, 'PENDING');
  assert.deepEqual(totals(), ['100', '100', '0', '0']);
  assert.equal(Object.keys(state.ledger).length, 0);
  failLedger = false;
  assert.equal((await approve(id)).status, 200);
});
test('invalid amounts, insufficient user balance and wrong-currency recipients cannot move funds', async () => {
  reset();
  // INR amounts carry at most two decimal places (paise).
  for (const value of [0, -1, 'NaN', 'Infinity', '1e2', '1.0000001', '10.999', {}, null]) {
    assert.equal((await withdraw(value)).status, 400);
    assert.equal((await transfer(value)).status, 400);
  }
  assert.equal((await withdraw('9.99')).status, 400);
  state.users.member = '0';
  assert.equal((await withdraw(10)).status, 409);
  assert.equal(state.wallets.member.balance, '100');
  state.users.member = '100';
  const id = (await transfer(10)).body.data.id;
  state.wallets.other.currency = 'USD';
  assert.equal((await approve(id)).status, 409);
  assert.equal(state.transfers[id].status, 'PENDING');
  assert.deepEqual(totals(), ['100', '100', '0', '0']);
});
test('failed or deleted transfer cannot be approved later', async () => {
  reset();
  const a = (await transfer(10)).body.data.id;
  assert.equal((await approve(a, { status: 'FAILED' })).status, 200);
  assert.equal((await approve(a)).status, 409);
  const b = (await transfer(10)).body.data.id;
  assert.equal((await request(`/transfer/${b}`, 'DELETE', undefined, true)).status, 200);
  assert.equal((await approve(b)).status, 404);
  assert.deepEqual(totals(), ['100', '100', '0', '0']);
});
