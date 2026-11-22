import test from 'node:test';
import assert from 'node:assert/strict';
import {
  balanceAfterExpense,
  balanceAfterFundApproval,
  clearsPayableAmount,
  filterPayFromRegisters,
  formatPayableToLabel,
  formatSarLatn,
  mapPettyCashApiError,
  mapPettyCashCashierBlockedMessage,
  resolveHolderWalletClass,
  slicePage,
} from './pettyCashWalletsDisplay.js';

test('formatSarLatn western digits', () => {
  assert.equal(formatSarLatn(18500), '18,500.00');
  assert.equal(formatSarLatn(-270), '-270.00');
});

test('balanceAfterFundApproval', () => {
  assert.equal(balanceAfterFundApproval(-270, 500), '230.00');
  assert.equal(balanceAfterFundApproval(100, 50), '150.00');
});

test('balanceAfterExpense', () => {
  assert.equal(balanceAfterExpense(100, 150), '-50.00');
  assert.equal(balanceAfterExpense(200, 50), '150.00');
});

test('resolveHolderWalletClass', () => {
  assert.equal(resolveHolderWalletClass('cashier'), 'CASHIER');
  assert.equal(resolveHolderWalletClass('outdoor_purchaser'), 'PURCHASER');
  assert.equal(resolveHolderWalletClass('technician'), 'STAFF');
});

test('clearsPayableAmount', () => {
  assert.equal(clearsPayableAmount(-270, 500), '270.00');
  assert.equal(clearsPayableAmount(-270, 100), '100.00');
  assert.equal(clearsPayableAmount(50, 100), '0.00');
});

test('formatPayableToLabel EN/AR', () => {
  assert.equal(formatPayableToLabel('Ali', 'en'), 'Payable to Ali');
  assert.equal(formatPayableToLabel('Ali', 'ar'), 'مستحق لـ Ali');
});

test('mapPettyCashCashierBlockedMessage + API code', () => {
  assert.match(mapPettyCashCashierBlockedMessage('en'), /cannot go below 0/i);
  assert.equal(
    mapPettyCashApiError({ code: 'PETTY_CASH_CASHIER_NEGATIVE_BLOCKED' }, 'en'),
    mapPettyCashCashierBlockedMessage('en'),
  );
});

test('slicePage', () => {
  const r = slicePage([1, 2, 3, 4], 1, 2);
  assert.equal(r.items.length, 2);
  assert.equal(r.total, 4);
  assert.equal(r.from, 1);
  assert.equal(r.to, 2);
});

test('filterPayFromRegisters excludes 1005', () => {
  const rows = filterPayFromRegisters([
    { id: '1', kind: 'SYSTEM_LOCKER_VAULT', name: 'Locker' },
    { id: '2', kind: 'OPERATING', type: 'BANK', name: 'Bank', coaCode: '1100' },
    { id: '3', kind: 'OPERATING', type: 'CASH', name: 'CIT', coaCode: '1005-O1' },
  ]);
  assert.equal(rows.length, 2);
  assert.ok(!rows.some((r) => String(r.coaCode || '').startsWith('1005')));
});
