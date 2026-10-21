import { chromium } from 'playwright';
import crypto from 'crypto';

const JWT_SECRET = 'super-secret-key-change-me';
function signJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7200,
  })).toString('base64url');
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

const token = signJwt({
  sub: '143',
  id: '143',
  email: 'testsup@filter.sa',
  userType: 'workshop_user',
  lockerPortalRole: 'supervisor',
  workshopId: '3',
});

const user = {
  id: '143',
  name: 'Lock Supervisor',
  email: 'testsup@filter.sa',
  userType: 'workshop_user',
  lockerPortalRole: 'supervisor',
  workshopId: '3',
  branchId: null,
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
const logs = [];

page.on('pageerror', (e) => errors.push(`PAGE: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') logs.push(`CON: ${m.text()}`);
});

await context.addInitScript(([t, u]) => {
  localStorage.setItem('filter_auth_token', t);
  localStorage.setItem('filter_auth_user', JSON.stringify(u));
}, [token, user]);

const tabs = [
  '/locker',
  '/locker/dashboard',
  '/locker/pending',
  '/locker/record',
  '/locker/approvals',
  '/locker/expenses',
  '/locker/transaction_log',
  '/locker/history',
  '/locker/differences',
  '/locker/issue_petty_cash',
  '/locker/petty_cash_issue_log',
];

const results = [];
for (const path of tabs) {
  await page.goto(`http://localhost:3001${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  }).catch((e) => errors.push(`NAV ${path}: ${e.message}`));
  await page.waitForTimeout(1500);
  const snap = await page.evaluate(() => ({
    url: location.href,
    hasLayout: !!document.querySelector('.workshop-layout'),
    hasBranch: !!document.querySelector('.ws-branch-select'),
    title: document.querySelector('.ws-topbar-title')?.textContent || '',
    bodyLen: (document.body?.innerText || '').length,
    bodySnip: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 180),
  }));
  results.push({ path, ...snap });
}

// Verify TransactionLog module export
const mod = await page.evaluate(async () => {
  try {
    const m = await import('/src/pages/locker/TransactionLog.jsx');
    return { ok: typeof m.default === 'function', keys: Object.keys(m) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

console.log(JSON.stringify({
  module: mod,
  results,
  pageErrors: errors,
  consoleErrors: logs.filter((l) => !l.includes('platform-chat')).slice(0, 25),
}, null, 2));

await browser.close();
