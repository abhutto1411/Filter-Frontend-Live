import test from 'node:test';
import assert from 'node:assert/strict';
import { payoutWithinShare } from '../../utils/corporateBillPayout.js';
import {
    buildDistributeAllocations,
    distributeErrorKey,
    distributeTodayYmd,
    distributeTotal,
    hqBalanceBlocks,
    balanceUnknown,
    payFromOptions,
    payoutConfirmState,
    payoutShortfall,
} from '../../utils/corporateBillDistribute.js';
import { cfx02T } from '../../utils/corporateFix02I18n.js';

// CLOSING F6: behaviour of the extracted payload builder (no source regex).
const dialog = {
    date: '2026-12-01',
    hqAccount: '9',
    rows: [
        { workshopId: '3', amount: '666.666', wsAccount: '30', payableNow: '666.67' },
        { workshopId: '50', amount: '0', wsAccount: '31', payableNow: '10.00' },
        { workshopId: 51, amount: 333.33, wsAccount: 32, payableNow: '333.33' },
    ],
};

test('panel posts per-workshop allocations with both registers', () => {
    assert.deepEqual(buildDistributeAllocations(dialog), [
        { workshopId: '3', amount: 666.67, hqCashBankAccountId: '9', workshopCashBankAccountId: '30' },
        { workshopId: '51', amount: 333.33, hqCashBankAccountId: '9', workshopCashBankAccountId: '32' },
    ]);
    assert.equal(distributeTotal(dialog), 1000);
    assert.deepEqual(buildDistributeAllocations(null), []);
});

test('payoutWithinShare mirrors the backend cap', () => {
    assert.equal(payoutWithinShare({ payableNow: '666.67' }, 666.67), true);
    assert.equal(payoutWithinShare({ payableNow: '666.67' }, 666.68), false);
    assert.equal(payoutWithinShare({ payableNow: '0.00' }, 1), false);
});

test('F4: Confirm blocked when HQ balance < Σ and the negative toggle is OFF', () => {
    assert.equal(hqBalanceBlocks({ balance: '999.99', total: 1000 }), true);
    assert.equal(hqBalanceBlocks({ balance: '1000.00', total: 1000 }), false);
    assert.equal(hqBalanceBlocks({ balance: '10', total: 1000, allowNegative: true }), false);
    assert.equal(hqBalanceBlocks({ balance: null, total: 1000 }), false);
});

test('F3: payout date default is the Riyadh calendar day', () => {
    assert.equal(distributeTodayYmd(new Date('2026-11-30T21:30:00Z')), '2026-12-01');
    assert.equal(distributeTodayYmd(new Date('2026-11-30T20:59:00Z')), '2026-11-30');
});

test('backend codes map to i18n keys', () => {
    assert.equal(distributeErrorKey({ code: 'REMITTANCE_EXCEEDS_SHARE' }), 'payout.exceeds');
    assert.equal(distributeErrorKey({ code: 'INSUFFICIENT_FUNDS' }), 'payout.insufficient');
    assert.equal(distributeErrorKey({ code: 'X' }), null);
});

// ---- FINAL F2: payoutConfirmState — every reason, no silent defaults ----
const okRows = [
    { workshopId: '3', amount: '100', wsAccount: '30', payableNow: '100.00' },
    { workshopId: '50', amount: '50.5', wsAccount: '31', payableNow: '60.00' },
];
const base = { hqPickedId: '9', hqBalance: '1000.00', total: 150.5, rows: okRows };

test('F2 valid form → Confirm enabled, no reason', () => {
    assert.deepEqual(payoutConfirmState(base), { disabled: false, reasonKey: null });
});
test('F2 nothing picked on the HQ side → disabled, pickHq', () => {
    assert.deepEqual(payoutConfirmState({ ...base, hqPickedId: '' }), { disabled: true, reasonKey: 'payout.reason.pickHq' });
});
test('F2 a row without a workshop register → disabled, pickWs', () => {
    const rows = [okRows[0], { ...okRows[1], wsAccount: '' }];
    assert.equal(payoutConfirmState({ ...base, rows }).reasonKey, 'payout.reason.pickWs');
});
test('F2 amount ≤ 0 or above payableNow → disabled, amount', () => {
    assert.equal(payoutConfirmState({ ...base, rows: [{ ...okRows[0], amount: '0' }] }).reasonKey, 'payout.reason.amount');
    assert.equal(payoutConfirmState({ ...base, rows: [{ ...okRows[0], amount: '-1' }] }).reasonKey, 'payout.reason.amount');
    assert.equal(payoutConfirmState({ ...base, rows: [{ ...okRows[0], amount: '100.01' }] }).reasonKey, 'payout.reason.amount');
    assert.equal(payoutConfirmState({ ...base, rows: [{ ...okRows[0], amount: 'abc' }] }).reasonKey, 'payout.reason.amount');
});
test('F2 HQ short and setting OFF → disabled, insufficient; ON → enabled', () => {
    assert.equal(payoutConfirmState({ ...base, hqBalance: '150.49' }).reasonKey, 'payout.insufficient');
    assert.equal(payoutConfirmState({ ...base, hqBalance: '150.49', allowNegative: true }).disabled, false);
    assert.equal(payoutConfirmState({ ...base, hqBalance: '150.50' }).disabled, false);
});
test('F2 posting / loading → disabled, busy', () => {
    assert.equal(payoutConfirmState({ ...base, posting: true }).reasonKey, 'payout.reason.busy');
    assert.equal(payoutConfirmState({ ...base, loading: true }).reasonKey, 'payout.reason.busy');
});
test('B7 short + OFF disables Confirm; short + ON keeps it enabled', () => {
    const short = { ...base, hqBalance: '10.00', total: 1000 };
    assert.equal(payoutConfirmState({ ...short, allowNegative: false }).disabled, true);
    assert.equal(payoutConfirmState({ ...short, allowNegative: false }).reasonKey, 'payout.insufficient');
    assert.equal(payoutConfirmState({ ...short, allowNegative: true }).disabled, false);
    assert.equal(payoutShortfall({ balance: '10.00', total: 1000 }), 990);
    assert.equal(payoutShortfall({ balance: '1000.00', total: 1000 }), 0);
});
test('payout.negativeAllowed exists in EN and AR', () => {
    assert.notEqual(cfx02T('en', 'payout.negativeAllowed'), 'payout.negativeAllowed');
    assert.notEqual(cfx02T('ar', 'payout.negativeAllowed'), cfx02T('en', 'payout.negativeAllowed'));
});
test('F2 unknown balance (null) → not blocked here; hint shown, backend B1 decides', () => {
    assert.equal(payoutConfirmState({ ...base, hqBalance: null }).disabled, false);
    assert.equal(balanceUnknown(null), true);
    assert.equal(balanceUnknown('12.00'), false);
});
test('F2 every reason key has EN and AR text', () => {
    for (const k of ['payout.reason.busy', 'payout.reason.pickHq', 'payout.reason.pickWs', 'payout.reason.amount',
        'payout.insufficient', 'payout.balanceUnknown', 'payout.noRegister', 'payout.loadingRegisters']) {
        assert.notEqual(cfx02T('en', k), k);
        assert.notEqual(cfx02T('ar', k), k);
        assert.notEqual(cfx02T('ar', k), cfx02T('en', k));
    }
});

// ---- FINAL F3: picker options + payload from the pickers ----
test('F3 payFromOptions feeds the FIX-03 picker with live balance', () => {
    const opts = payFromOptions([{ id: 30, name: 'WS Bank', type: 'BANK', availableBalance: '12.50' }], () => 'Bank');
    assert.deepEqual(opts, [{ id: '30', name: 'WS Bank', balance: 12.5, branchId: '', branchName: '', kind: 'OPERATING', kindLabel: 'Bank', type: 'BANK' }]);
    assert.deepEqual(payFromOptions(undefined), []);
});
test('F3 payload still sends hqCashBankAccountId / workshopCashBankAccountId from the pickers', () => {
    const picked = { date: '2026-12-01', hqAccount: '9', rows: [{ workshopId: '3', amount: '100', wsAccount: '30', payableNow: '100' }] };
    assert.deepEqual(buildDistributeAllocations(picked), [
        { workshopId: '3', amount: 100, hqCashBankAccountId: '9', workshopCashBankAccountId: '30' },
    ]);
});

// ---- FINAL F5: backend codes → EN/AR messages ----
test('F5 INSUFFICIENT_FUNDS / BILL_CHANGED / CORP_COST_* / REMITTANCE_EXCEEDS_SHARE map to EN/AR keys', () => {
    for (const code of ['INSUFFICIENT_FUNDS', 'BILL_CHANGED', 'CORP_COST_ACCOUNT_CONFLICT', 'CORP_COST_ACCOUNT_MISSING', 'REMITTANCE_EXCEEDS_SHARE']) {
        const k = distributeErrorKey({ code });
        assert.ok(k, code);
        assert.notEqual(cfx02T('ar', k), k);
        assert.doesNotMatch(cfx02T('en', k), /something went wrong/i);
    }
});
