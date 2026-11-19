import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPLOYEE_PURPOSE_ADVANCE,
  EMPLOYEE_PURPOSE_SALARY,
  buildEmployeePurposePreview,
  formatRecentPayeeLabel,
  hasBulkTransactionRoutes,
  resolveEmployeePurposeAccountId,
  validateEmployeePurposeRows,
} from './txEmployeePurpose.js';

test('resolveEmployeePurposeAccountId prefers child then parent', () => {
  const accounts = [
    { id: '10', code: '1250' },
    { id: '11', code: '1250-E9' },
    { id: '20', code: '2250' },
  ];
  assert.equal(
    resolveEmployeePurposeAccountId(accounts, EMPLOYEE_PURPOSE_ADVANCE, '9'),
    '11',
  );
  assert.equal(
    resolveEmployeePurposeAccountId(accounts, EMPLOYEE_PURPOSE_ADVANCE, '99'),
    '10',
  );
  assert.equal(
    resolveEmployeePurposeAccountId(accounts, EMPLOYEE_PURPOSE_SALARY, '9'),
    '20',
  );
});

test('validateEmployeePurposeRows', () => {
  assert.equal(
    validateEmployeePurposeRows(
      [{ type: 'Employee', amount: '100', employeePurpose: '' }],
      { isPayment: true },
    ),
    'tx.purpose.required',
  );
  assert.equal(
    validateEmployeePurposeRows(
      [{ type: 'Employee', amount: '100', employeePurpose: EMPLOYEE_PURPOSE_ADVANCE }],
      { isPayment: true },
    ),
    null,
  );
  assert.equal(
    validateEmployeePurposeRows(
      [{ type: 'Employee', amount: '100', employeePurpose: '' }],
      { isPayment: false },
    ),
    null,
  );
});

test('preview + recent label + bulk visible', () => {
  assert.match(
    buildEmployeePurposePreview({
      purpose: EMPLOYEE_PURPOSE_ADVANCE,
      employeeName: 'Tech 2',
      cashLabel: 'Cash',
    }),
    /1250-E/,
  );
  assert.equal(
    formatRecentPayeeLabel({ payeeName: 'Tech 2', accountCode: '1250-E2' }),
    'Tech 2 (advance)',
  );
  assert.equal(hasBulkTransactionRoutes(), true);
});
