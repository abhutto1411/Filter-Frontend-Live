import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLastAdvanceLabel,
  formatSarLatn,
  isWalletTooLow,
  staffDisambiguationLabel,
  mapLegacyAdvancesTab,
  mapOverviewRows,
  mapPayrollSummaryCards,
  mapPosExpenseToRegister,
  mapRegisterItems,
  slicePage,
  sourceBadgeKey,
  filterOverviewRows,
} from './payrollAdvancesDisplay.js';

test('formatSarLatn western digits', () => {
  assert.equal(formatSarLatn(6450), '6,450.00');
});

test('mapLegacyAdvancesTab', () => {
  assert.equal(mapLegacyAdvancesTab('By Employee'), 'overview');
  assert.equal(mapLegacyAdvancesTab('Salary'), 'payroll');
  assert.equal(mapLegacyAdvancesTab('Employee Ledger'), 'statement');
  assert.equal(mapLegacyAdvancesTab('register'), 'register');
});

test('slicePage', () => {
  const r = slicePage([1, 2, 3, 4], 1, 2);
  assert.equal(r.items.length, 2);
  assert.equal(r.total, 4);
});

test('sourceBadgeKey + last advance label', () => {
  assert.equal(sourceBadgeKey('petty_cash_salary_advance'), 'pos');
  assert.match(formatLastAdvanceLabel({ lastAdvanceDate: '2027-01-14', lastAdvanceSource: 'pos' }, 'en'), /POS/);
});

test('mapOverviewRows + filter', () => {
  const rows = mapOverviewRows({
    employees: [{ name: 'Ali', outstandingBalance: 100, branchId: '1', staffKey: 'e:1' }],
  });
  assert.equal(rows[0].outstanding, 100);
  assert.equal(filterOverviewRows(rows, { employeeQ: 'ali' }).length, 1);
});

test('overview Active default hides inactive', () => {
  const rows = mapOverviewRows({
    employees: [
      { name: 'On', staffKey: 'e:1', isActive: true },
      { name: 'Off', staffKey: 'e:2', inactive: true },
    ],
  });
  assert.equal(filterOverviewRows(rows, { staffActive: 'active' }).length, 1);
  assert.equal(filterOverviewRows(rows, { staffActive: 'inactive' })[0].name, 'Off');
  assert.equal(filterOverviewRows(rows, { staffActive: 'all' }).length, 2);
});

test('isWalletTooLow', () => {
  assert.equal(isWalletTooLow(150, 300), true);
  assert.equal(isWalletTooLow(1020, 150), false);
});

test('mapPayrollSummaryCards omits missing', () => {
  const cards = mapPayrollSummaryCards({ outstandingBalance: 100, totalAdvancesPaid: 50 });
  assert.ok(cards.some((c) => c.id === 'outstanding'));
  assert.ok(!cards.some((c) => c.id === 'givenMonth')); // all-time total is not month given
  assert.ok(!cards.some((c) => c.id === 'salariesPayable'));
});

test('mapRegisterItems + POS expense', () => {
  const items = mapRegisterItems({ items: [{ id: 1, amount: 10, date: '2027-01-01', source: 'admin' }] });
  assert.equal(items[0].amount, 10);
  const pos = mapPosExpenseToRegister([{ id: 9, payToType: 'salary_advance', amount: 50, status: 'pending' }]);
  assert.equal(pos.length, 1);
  assert.equal(pos[0].expenseRequestId, 9);
});

test('staffDisambiguationLabel keeps three Tahas distinct', () => {
  assert.equal(
    staffDisambiguationLabel({
      name: 'Taha',
      role: 'technician',
      branchName: 'Pakistan Branch',
    }),
    'Taha (technician · Pakistan Branch)',
  );
  assert.equal(
    staffDisambiguationLabel({
      name: 'Taha',
      role: 'locker_supervisor',
      branchId: null,
    }),
    'Taha (locker_supervisor · Unassigned)',
  );
  assert.notEqual(
    staffDisambiguationLabel({ name: 'Taha', role: 'technician', branchName: 'Pakistan Branch' }),
    staffDisambiguationLabel({ name: 'Taha', role: 'locker_supervisor', branchId: null }),
  );
});

test('Decimal string 0.00 is displayed, not emdash', () => {
  const rows = mapOverviewRows({
    employees: [
      {
        name: 'Raza',
        staffKey: 'cashier:17',
        salaryPayable: '0.00',
        commissionPayable: '6.20',
        commissionPayableSource: '2200-E',
      },
      {
        name: 'Safi',
        staffKey: 'e:60',
        salaryPayable: '0.00',
        commissionPayable: '12.50',
        commissionPayableSource: '2200',
      },
    ],
  });
  assert.equal(formatSarLatn(rows[0].salaryPayable), '0.00');
  assert.equal(formatSarLatn(rows[0].commissionPayable), '6.20');
  assert.equal(rows[1].commissionPayableSource, '2200');
});

test('mapOverviewRows 0.00 vs omitted dash fields', () => {
  const zero = mapOverviewRows({
    employees: [
      {
        name: 'Raza',
        staffKey: 'cashier:1',
        outstanding: 0,
        salaryPayable: 0,
        commissionPayable: 0,
      },
    ],
  });
  assert.equal(zero[0].salaryPayable, 0);
  assert.equal(zero[0].commissionPayable, 0);
  const missing = mapOverviewRows({
    employees: [{ name: 'X', staffKey: 'e:2' }],
  });
  assert.equal(missing[0].salaryPayable, null);
  assert.equal(missing[0].commissionPayable, null);
});

test('mapPayrollSummaryCards includes zero commission payable', () => {
  const cards = mapPayrollSummaryCards({
    outstandingBalance: 0,
    salariesPayable: 0,
    commissionPayable: 0,
  });
  assert.equal(cards.find((c) => c.id === 'salariesPayable').value, 0);
  assert.equal(cards.find((c) => c.id === 'commissionPayable').value, 0);
});

test('mapOverviewRows from branches', () => {
  const rows = mapOverviewRows({
    branches: [{ branchId: '1', branchName: 'A', employees: [{ name: 'X', outstanding: 1, staffKey: 'e:1' }] }],
  });
  assert.equal(rows[0].branchName, 'A');
});
