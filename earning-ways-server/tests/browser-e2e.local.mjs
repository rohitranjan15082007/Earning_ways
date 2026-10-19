// Local browser acceptance test for the Telegram Stars (INR) option.
//
// NOT part of `npm test`: it needs the local stack running (Vite dev servers on
// 8080/8081 and the API on 4000 with the local database) plus Chrome installed.
// Run it manually with:  node tests/browser-e2e.local.mjs
//
// It drives real Chrome over the DevTools Protocol (no test framework and no new
// dependency) through: member login -> Invest Now -> INR amount step -> Stars
// checkout, and admin login -> /admin/payments settings and payments table.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '../generated/prisma/client.js';

const API = 'http://localhost:4000/api';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const USER_APP = 'http://localhost:8080';
const ADMIN_APP = 'http://localhost:8081';

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function targetFor(match, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(item => item.type === 'page' && item.url.includes(match));
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* chrome not up yet */ }
    await sleep(300);
  }
  throw new Error(`no page target for ${match}`);
}

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  const consoleErrors = [];
  const exceptions = [];
  let id = 0;
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve());
    socket.addEventListener('error', event => reject(new Error(`ws error: ${event.message ?? 'unknown'}`)));
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    }
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params.exceptionDetails?.exception?.description ?? 'exception');
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const messageId = ++id;
    pending.set(messageId, { resolve, reject });
    socket.send(JSON.stringify({ id: messageId, method, params }));
    setTimeout(() => {
      if (pending.has(messageId)) { pending.delete(messageId); reject(new Error(`${method} timed out`)); }
    }, 15000);
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'eval failed');
    return result.result.value;
  };
  const waitFor = async (expression, timeoutMs = 15000) => {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    let answered = false;
    while (Date.now() < deadline) {
      try {
        const value = await evaluate(expression);
        answered = true;
        if (value) return true;
      } catch (error) { lastError = error; /* page navigating */ }
      await sleep(250);
    }
    // If the page never once returned a value the assertion itself is broken (a
    // syntax error, say). Surfacing that beats reporting a missing feature after
    // a blind 15s wait.
    if (!answered && lastError) throw lastError;
    return false;
  };
  return { send, evaluate, waitFor, consoleErrors, exceptions, closed: ready };
}

// React controlled inputs need the native setter, not a raw value assignment.
const fillScript = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;
const submitScript = `(() => { const form = document.querySelector('form'); if (!form) return false; form.requestSubmit(); return true; })()`;
const clickByTextScript = text => `(() => {
  const target = [...document.querySelectorAll('button,a')].find(node => node.textContent.trim().includes(${JSON.stringify(text)}));
  if (!target) return false;
  target.click();
  return true;
})()`;

const profile = mkdtempSync(join(tmpdir(), 'stars-e2e-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1280,900', `${USER_APP}/auth/login`,
], { stdio: 'ignore' });

try {
  // ---------------------------------------------------------------- member app
  const page = connect(await targetFor('localhost:8080'));
  await page.closed;
  await page.send('Runtime.enable');
  await page.send('Page.enable');

  record('member login page renders', await page.waitFor(`Boolean(document.querySelector('input[type=password]'))`));

  await page.evaluate(fillScript('input[type=email]', 'user@local.test'));
  await page.evaluate(fillScript('input[type=password]', 'User@12345'));
  await page.evaluate(submitScript);
  record('member login succeeds in the browser', await page.waitFor(`location.pathname.startsWith('/app/')`, 20000),
    await page.evaluate('location.pathname'));

  // The Redeem feature is gone: no nav entry and no route that still links to it.
  record('the Redeem entry is gone from the member app',
    !(await page.evaluate(`document.body.innerText.includes('Redeem')`)));

  // Referrals show the count and the earning only — level income is gone.
  await page.send('Page.navigate', { url: `${USER_APP}/app/referrals` });
  const referralsText = await page.waitFor(`document.body.innerText.includes('Total Referrals')`, 20000)
    ? await page.evaluate('document.body.innerText') : '';
  record('referrals page shows the count and earning without level income',
    referralsText.includes('Total Referrals') && referralsText.includes('Total Earnings') &&
    !/Level \d|Current Level|level income/i.test(referralsText));

  await page.send('Page.navigate', { url: `${USER_APP}/app/subscriptions` });
  record('subscriptions page lists plans', await page.waitFor(`document.body.innerText.includes('Invest Now')`, 20000));

  // Re-invest: a plan the member already owns stays purchasable, so its button is
  // a live "Invest Again" instead of a dead "Subscribed".
  record('the already-owned plan offers an enabled Invest Again button',
    await page.waitFor(`Boolean([...document.querySelectorAll('button')].find(button => button.textContent.includes('Invest Again') && !button.disabled))`, 15000));
  await page.evaluate(clickByTextScript('Invest Again'));
  record('Invest Again opens the amount step for the owned plan',
    await page.waitFor(`document.body.innerText.includes('Invest again in')`, 15000));
  // Reopen the page so the dialog is closed again for the fresh-purchase flow.
  await page.send('Page.navigate', { url: `${USER_APP}/app/subscriptions` });
  await page.waitFor(`document.body.innerText.includes('Invest Now')`, 20000);

  await page.evaluate(clickByTextScript('Invest Now'));
  const modalOpen = await page.waitFor(`document.body.innerText.includes('Investment Amount (₹)')`, 15000);
  record('Invest Now opens the amount step', modalOpen,
    await page.evaluate(`(document.querySelector('[role=dialog]')?.innerText || '').split('\\n')[0]`));
  record('the amount step asks for rupees', await page.evaluate(`document.body.innerText.includes('Investment Amount (₹)')`));
  // A plan has ONE fixed price now, so the member cannot type an amount. Which
  // price that is comes from the catalog, so the check reads it instead of
  // hardcoding one plan's number (adding a plan must not break the suite).
  const amountField = await page.evaluate(`(() => {
    const input = document.querySelector('[role=dialog] input');
    return input ? { readOnly: input.readOnly, value: input.value } : null;
  })()`);
  const dialogText = await page.evaluate(`(document.querySelector('[role=dialog]')?.innerText || '')`);
  const dialogPlanName = (dialogText.match(/Invest (?:in|again in) (.+)/) || [])[1]?.trim() ?? '';
  const catalog = await (await fetch(`${API}/subscription/all`)).json();
  const dialogPlan = (catalog.data ?? []).find(plan => plan.name === dialogPlanName);
  record('the checkout amount is fixed to the plan price',
    amountField?.readOnly === true && Boolean(dialogPlan)
      && Number(amountField.value) === Number(dialogPlan.minimumInvestment),
    `${dialogPlanName || 'plan not read'}: ₹${amountField?.value}, catalog ₹${dialogPlan?.minimumInvestment ?? '?'}`);
  record('no cryptocurrency wording is offered', !/USDT|BEP-20|transaction hash/i.test(await page.evaluate('document.body.innerText')));

  await page.evaluate(clickByTextScript('Continue to Payment'));
  const methodStep = await page.waitFor(`document.body.innerText.includes('Pay with Telegram Stars')`, 15000);
  record('checkout goes straight to the Telegram Stars step', methodStep);
  const pickerText = await page.evaluate('document.body.innerText');
  record('the checkout shows the INR amount', /₹[\d,.]+/.test(pickerText),
    (pickerText.match(/₹[\d,.]+/) || ['not found'])[0]);
  record('the checkout shows the admin-configured Stars price', /[\d,]+ Stars/.test(pickerText),
    (pickerText.match(/[\d,]+ Stars/) || ['not found'])[0]);
  record('a single payment method is offered', !pickerText.includes('Choose Payment Method'));

  // The local DB holds a placeholder bot token, so Telegram must reject it:
  // this proves the browser actually calls our API and surfaces the failure.
  await page.evaluate(clickByTextScript('Pay with Telegram Stars'));
  await sleep(3500);
  const afterPay = await page.evaluate('document.body.innerText');
  record('browser calls the invoice API and surfaces the provider answer',
    /Unauthorized|Could not start|Creating invoice/.test(afterPay) || afterPay.includes('Waiting for Telegram'),
    (afterPay.match(/(Unauthorized|Could not start the Telegram Stars payment)/) || ['no error text'])[0]);

  // ------------------------------------------------- withdrawal needs a QR
  await page.send('Page.navigate', { url: `${USER_APP}/app/withdraw` });
  record('the withdraw form demands a payout QR code',
    await page.waitFor(`document.body.innerText.includes('Payout QR Code (required)')`, 20000));
  await page.evaluate(fillScript('#amount', '50'));
  await page.evaluate(fillScript('#upiId', 'localmember@bank'));
  await page.evaluate(clickByTextScript('Submit Withdrawal'));
  // Without an attached QR the request must never reach the API.
  record('submitting without a QR is refused with a clear reason',
    await page.waitFor(`document.body.innerText.includes('Please upload your payout QR code')`, 10000));

  // Whole member app: no screen may print a dollar amount.
  const memberDollarRoutes = [];
  for (const route of ['dashboard', 'wallet', 'transfer', 'transactions', 'subscriptions', 'referrals', 'withdraw', 'settings', 'notifications']) {
    await page.send('Page.navigate', { url: `${USER_APP}/app/${route}` });
    await page.waitFor(`document.body.innerText.length > 200`, 20000);
    const text = await page.evaluate('document.body.innerText');
    if (text.includes('$')) memberDollarRoutes.push(route);
  }
  record('no member page prints a dollar amount', memberDollarRoutes.length === 0, memberDollarRoutes.join(', '));

  // ------------------------------------------------------------- admin panel
  const adminTarget = await page.send('Target.createTarget', { url: `${ADMIN_APP}/admin/login` });
  await sleep(1500);
  const adminList = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const adminPageTarget = adminList.find(item => item.id === adminTarget.targetId);
  const admin = connect(adminPageTarget.webSocketDebuggerUrl);
  await admin.closed;
  await admin.send('Runtime.enable');
  await admin.send('Page.enable');

  record('admin login page renders', await admin.waitFor(`Boolean(document.querySelector('input[type=password]'))`));
  await admin.evaluate(fillScript('input[type=email]', 'admin@local.test'));
  await admin.evaluate(fillScript('input[type=password]', 'Admin@12345'));
  await admin.evaluate(submitScript);
  // Wait for the stored admin session, not just for a URL that already matches.
  const adminLoggedIn = await admin.waitFor(`Boolean(localStorage.getItem('admin_token'))`, 20000);
  record('admin login succeeds in the browser', adminLoggedIn,
    `${await admin.evaluate('location.pathname')} token=${await admin.evaluate(`Boolean(localStorage.getItem('admin_token'))`)}`);

  await admin.send('Page.navigate', { url: `${ADMIN_APP}/admin/payments` });
  record('admin payments page renders settings', await admin.waitFor(`document.body.innerText.includes('Bot & Pricing Settings')`, 20000));
  const adminText = await admin.evaluate('document.body.innerText');
  record('sidebar exposes the Stars Payments entry', adminText.includes('Stars Payments') || await admin.evaluate(`Boolean([...document.querySelectorAll('a')].find(a => a.textContent.includes('Stars Payments')))`));
  // Input values/placeholders are not part of innerText, so read the form itself.
  const formState = await admin.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('input')];
    return {
      values: inputs.map(input => input.value).filter(Boolean),
      placeholders: inputs.map(input => input.placeholder).filter(Boolean),
      enabled: inputs.some(input => input.type === 'checkbox' && input.checked),
    };
  })()`);
  record('settings show the admin-saved Stars-per-rupee rate and cap',
    formState.values.includes('0.55') && formState.values.includes('10000'),
    JSON.stringify(formState.values));
  record('settings show the masked token/secret hints',
    formState.placeholders.some(text => text.includes('1234••••3456')) && formState.placeholders.some(text => text.includes('loca••••alue')),
    JSON.stringify(formState.placeholders.map(text => text.slice(0, 28))));
  record('INR option is enabled by the saved setting', formState.enabled === true);
  record('payments table lists the confirmed Stars payment',
    adminText.includes('CONFIRMED') && /5,000/.test(adminText) && adminText.includes('user@local.test'));
  record('totals card reports the invested rupees', adminText.includes('Invested via Stars') && /₹100/.test(adminText));
  // The platform's own deposit UPI/QR feature is gone: page, hook and endpoint.
  record('the payout UPI entry is gone from the admin sidebar',
    !(await admin.evaluate(`document.body.innerText.includes('Payout UPI')`)));

  // Plans are priced with a single fixed amount: no min/max range anywhere.
  await admin.send('Page.navigate', { url: `${ADMIN_APP}/admin/plans` });
  const plansText = await admin.waitFor(`document.body.innerText.includes('Investment Amount')`, 20000)
    ? await admin.evaluate('document.body.innerText') : '';
  record('the admin plan page shows one fixed amount and no investment range',
    plansText.includes('Investment Amount') && !/Minimum Investment|Maximum Investment|Investment Range/i.test(plansText));

  // The create form itself: one amount field, no min/max pair. A closed dialog is
  // not in the DOM, so it has to be opened to check its fields.
  await admin.evaluate(clickByTextScript('Add Plan'));
  record('the create-plan form asks for one fixed investment amount',
    await admin.waitFor(`document.body.innerText.includes('Create New Plan') && document.body.innerText.includes('Investment Amount (₹)')`, 15000));
  const planDialogText = await admin.evaluate(`(document.querySelector('[role=dialog]')?.innerText || '')`);
  record('the create-plan form has no minimum/maximum investment fields',
    planDialogText.includes('Investment Amount (₹)') && !/Minimum Investment|Maximum Investment/i.test(planDialogText));

  // The user-investment page used to format every amount as USD.
  await admin.send('Page.navigate', { url: `${ADMIN_APP}/admin/AdminInvestmentPage` });
  await admin.waitFor(`document.body.innerText.length > 0`, 20000);
  const userInvestmentText = await admin.evaluate('document.body.innerText');
  record('the user-investment page shows rupees and no dollars',
    userInvestmentText.includes('₹') && !userInvestmentText.includes('$'),
    (userInvestmentText.match(/₹[\d,]+/) || ['no rupee amount'])[0]);

  // Whole admin panel: the same rupee-only rule.
  const adminDollarRoutes = [];
  for (const route of ['dashboard', 'users', 'investments', 'plans', 'withdrawals', 'payments', 'transfers', 'roi', 'wallets', 'referrals', 'support', 'enquiry', 'AdminInvestmentPage', 'SettingsPage', 'notifications']) {
    await admin.send('Page.navigate', { url: `${ADMIN_APP}/admin/${route}` });
    await admin.waitFor(`document.body.innerText.length > 200`, 20000);
    const text = await admin.evaluate('document.body.innerText');
    if (text.includes('$')) adminDollarRoutes.push(route);
  }
  record('no admin page prints a dollar amount', adminDollarRoutes.length === 0, adminDollarRoutes.join(', '));

  // ------------------------------------------------- member notifications page
  // The member must actually see the notifications the platform creates. A
  // notification is seeded through the same admin endpoint the panel uses, then
  // read back on the member's own feed page.
  const login = (path, body) => fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(response => response.json());
  const memberSession = await login('/user/login', { email: 'user@local.test', password: 'User@12345' });
  const adminSession = await login('/admin/login', { email: 'admin@local.test', password: 'Admin@12345' });
  const NOTIFY_TITLE = 'Acceptance check notification';
  const seeded = await fetch(`${API}/notifications/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSession.token}` },
    body: JSON.stringify({
      title: NOTIFY_TITLE, message: 'Your ₹100.00 investment is active now.', type: 'SUCCESS',
      userIds: [memberSession.data.id],
    }),
  });
  record('the admin notification endpoint accepts a member notification', seeded.status === 201, `status ${seeded.status}`);
  await page.send('Page.navigate', { url: `${USER_APP}/app/notifications` });
  record('the member notification feed shows it',
    await page.waitFor(`document.body.innerText.includes(${JSON.stringify(NOTIFY_TITLE)})`, 20000));
  // Leave no test data behind.
  const cleanup = new PrismaClient();
  const links = await cleanup.userNotification.findMany({ where: { userId: memberSession.data.id } });
  await cleanup.userNotification.deleteMany({ where: { id: { in: links.map(link => link.id) } } });
  await cleanup.notification.deleteMany({ where: { id: { in: links.map(link => link.notificationId) } } });
  await cleanup.$disconnect();

  // --------------------------------------------------------------- hygiene
  record('member app has no uncaught exceptions', page.exceptions.length === 0, page.exceptions.slice(0, 2).join(' | '));
  record('admin app has no uncaught exceptions', admin.exceptions.length === 0, admin.exceptions.slice(0, 2).join(' | '));
  const realConsoleErrors = [...page.consoleErrors, ...admin.consoleErrors]
    .filter(text => !/401|403|503|400|Failed to load resource|Unauthorized/.test(text));
  record('no unexpected console errors', realConsoleErrors.length === 0, realConsoleErrors.slice(0, 3).join(' | '));
} catch (error) {
  record('driver completed', false, error.message);
} finally {
  chrome.kill();
  await sleep(500);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}

const failed = results.filter(result => !result.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
