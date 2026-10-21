import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
const logs = [];

page.on('pageerror', (e) => errors.push(`PAGE: ${e.message}\n${e.stack || ''}`));
page.on('console', (m) => {
  if (m.type() === 'error') logs.push(`CON: ${m.text()}`);
});

await context.addInitScript(() => {
  const user = {
    id: '1',
    name: 'Lock Supervisor',
    email: 'locker@test.com',
    userType: 'workshop_user',
    lockerPortalRole: 'supervisor',
    workshopId: '1',
    branchId: null,
  };
  localStorage.setItem('filter_auth_token', 'debug-fake-token');
  localStorage.setItem('filter_auth_user', JSON.stringify(user));
});

await page.goto('http://localhost:3001/locker', {
  waitUntil: 'domcontentloaded',
  timeout: 45000,
}).catch((e) => errors.push(`NAV: ${e.message}`));

await page.waitForTimeout(4000);

const result = await page.evaluate(() => {
  const root = document.getElementById('root');
  return {
    url: location.href,
    bodyLen: (document.body?.innerText || '').length,
    bodySnip: (document.body?.innerText || '').slice(0, 600),
    hasLayout: !!document.querySelector('.workshop-layout'),
    hasBranchSelect: !!document.querySelector('.ws-branch-select'),
    rootHtml: root?.innerHTML?.slice(0, 1200) || 'NO_ROOT',
  };
}).catch((e) => ({ evaluateError: e.message }));

console.log(JSON.stringify({ ...result, errors, consoleErrors: logs.slice(0, 40) }, null, 2));

await browser.close();
