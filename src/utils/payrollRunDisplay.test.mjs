import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arabicMonthLabel,
  filterSlips,
  formatOutstandingCell,
  formatSarLatn,
  lastDayOfPeriodYmd,
  mapPayrollStaffSearchOptions,
  mapRunSummaryCards,
  parsePayrollPath,
  payslipDeductionRows,
  payslipEarningsRows,
  payrollErrorI18nKey,
  recoveryExceedsMax,
  slicePage,
  validateDraftSlipEdits,
} from './payrollRunDisplay.js';

test('formatSarLatn + lastDay', () => {
  assert.equal(formatSarLatn(42800), '42,800.00');
  assert.equal(lastDayOfPeriodYmd('2027-01'), '2027-01-31');
});

test('parsePayrollPath', () => {
  assert.deepEqual(
    parsePayrollPath('/workshop/accounting/advances/payroll/2027-01'),
    { kind: 'run', period: '2027-01' },
  );
  assert.deepEqual(
    parsePayrollPath('/workshop/accounting/advances/payroll/slip/99'),
    { kind: 'slip', slipId: '99' },
  );
  assert.equal(parsePayrollPath('/workshop/accounting/advances').kind, 'none');
});

test('recoveryExceedsMax + slice + filter', () => {
  assert.equal(recoveryExceedsMax(100, 50), true);
  assert.equal(recoveryExceedsMax(50, 50), false);
  assert.equal(slicePage([1, 2, 3], 1, 2).items.length, 2);
  assert.equal(
    filterSlips([{ employeeName: 'Ali' }, { employeeName: 'Bob' }], {
      employeeQ: 'ali',
    }).length,
    1,
  );
});

test('mapRunSummaryCards + payslip rows', () => {
  const cards = mapRunSummaryCards({
    status: 'draft',
    slips: [
      { gross: 100, advanceRecovery: 10, penalties: 1, net: 89 },
      { gross: 200, advanceRecovery: 0, penalties: 0, net: 200 },
    ],
  });
  assert.equal(cards.find((c) => c.id === 'employees').value, 2);
  assert.equal(cards.find((c) => c.id === 'gross').value, 300);
  assert.equal(payslipEarningsRows({ basic: 1, gross: 1 }).length, 2);
  assert.ok(payslipDeductionRows({ advanceRecovery: 1, net: 2, paidAmount: 2 }).length >= 3);
  assert.match(arabicMonthLabel('2027-01'), /يناير/);
});

test('payrollErrorI18nKey maps not-found and Prisma noise', () => {
  assert.equal(
    payrollErrorI18nKey({ message: 'Payroll run not found' }),
    'pr.err.notFound',
  );
  assert.equal(
    payrollErrorI18nKey({ code: 'PAYROLL_RUN_NOT_FOUND' }),
    'pr.err.notFound',
  );
  assert.equal(
    payrollErrorI18nKey({
      message:
        'Invalid `db.payrollRun.findFirst()` invocation Transaction API error: Transaction not found.',
    }),
    'pr.err.unavailable',
  );
  assert.equal(payrollErrorI18nKey({ code: 'PAYROLL_NO_USER' }), 'pr.err.noUser');
  assert.equal(payrollErrorI18nKey({ code: 'PAYROLL_SLIP_EXISTS' }), 'pr.err.slipExists');
  assert.equal(
    payrollErrorI18nKey({ code: 'PAYROLL_INACTIVE_REMARK_REQUIRED' }),
    'pr.err.inactiveRemark',
  );
});

test('0.00 vs emdash; staff suggestions; draft validation EN/AR codes', () => {
  assert.equal(formatOutstandingCell(0).text, '0.00');
  assert.equal(formatOutstandingCell('0.00').unknown, false);
  assert.equal(formatOutstandingCell(null).unknown, true);
  const opts = mapPayrollStaffSearchOptions({
    items: [
      { userId: '1', label: 'Zain (technician · Pakistan Branch)', inactive: false },
      { userId: '2', name: 'Zaid', inactive: true, alreadyInRun: true },
    ],
  });
  assert.equal(opts[0].label.includes('Zain'), true);
  assert.equal(opts[0].trailing, 'Active');
  assert.equal(opts[1].disabled, true);
  assert.equal(opts[1].inactive, true);
  const ok = validateDraftSlipEdits(
    { basic: '100', allowances: '0', bonus: '0', commission: '0', advanceRecovery: '0', penalties: '0', outstandingAdvance: '0' },
    { bonus: '5.00', remarks: 'ok' },
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.net, '105.00');
  assert.equal(
    validateDraftSlipEdits(
      { basic: '10', commission: '0', advanceRecovery: '0', penalties: '0', outstandingAdvance: '0' },
      { bonus: '-1' },
    ).code,
    'PAYROLL_AMOUNT_NEGATIVE',
  );
  assert.equal(
    validateDraftSlipEdits(
      {
        basic: '10',
        allowances: '0',
        bonus: '0',
        commission: '0',
        advanceRecovery: '0',
        penalties: '0',
        outstandingAdvance: '0',
        inactive: true,
      },
      {},
    ).code,
    'PAYROLL_INACTIVE_REMARK_REQUIRED',
  );
});
