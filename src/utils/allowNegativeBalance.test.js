import test from 'node:test';
import assert from 'node:assert/strict';
import { accT } from './accountingI18n.js';
import {
    buildAllowNegativePatch,
    canEditAllowNegative,
    permissionTooltipKey,
    reasonAcceptable,
    reduceAllowNegative,
} from './allowNegativeBalance.js';

const hasCashEdit = (code) => code === 'workshop.accounting.cash-bank.edit';

test('OFF → confirm → ON; cancel keeps OFF', () => {
    let s = reduceAllowNegative({ on: false }, { type: 'request-on', canChange: true });
    assert.equal(s.pending, 'on');
    assert.equal(s.on, false);
    s = reduceAllowNegative(s, { type: 'cancel' });
    assert.deepEqual(s, { on: false, pending: null, reason: '' });
    s = reduceAllowNegative({ on: false }, { type: 'request-on', canChange: true });
    s = reduceAllowNegative(s, { type: 'reason', reason: 'owner approved' });
    s = reduceAllowNegative(s, { type: 'confirm' });
    assert.equal(s.on, true);
    assert.equal(s.pending, null);
});

test('turning OFF needs a reason and no risk pending stays off until confirm', () => {
    let s = reduceAllowNegative({ on: true }, { type: 'request-off', canChange: true });
    assert.equal(s.pending, 'off');
    assert.equal(s.on, true);
    s = reduceAllowNegative(s, { type: 'reason', reason: 'no' });
    assert.equal(reduceAllowNegative(s, { type: 'confirm' }).on, true);
    s = reduceAllowNegative(s, { type: 'reason', reason: 'close it' });
    assert.equal(reduceAllowNegative(s, { type: 'confirm' }).on, false);
});

test('disabled without permission does not open the dialog', () => {
    const s = reduceAllowNegative({ on: false }, { type: 'request-on', canChange: false });
    assert.equal(s.pending, null);
    const cashier = { type: 'cashier', userType: 'cashier_user' };
    const owner = { type: 'workshop', userType: 'workshop_owner' };
    const staff = { type: 'workshop', userType: 'workshop_user' };
    const admin = { type: 'admin', userType: 'platform_admin' };
    assert.equal(canEditAllowNegative({ user: cashier, isHq: false, hasPermission: hasCashEdit }), false);
    assert.equal(canEditAllowNegative({ user: owner, isHq: false }), true);
    assert.equal(canEditAllowNegative({ user: staff, isHq: false, hasPermission: hasCashEdit }), true);
    assert.equal(canEditAllowNegative({ user: staff, isHq: false, hasPermission: () => false }), false);
    assert.equal(canEditAllowNegative({ user: owner, isHq: true }), false);
    assert.equal(canEditAllowNegative({ user: admin, isHq: true }), true);
    assert.equal(canEditAllowNegative({ user: { userType: 'platform_admin' }, isHq: true }), true);
    assert.equal(permissionTooltipKey(), 'cb.neg.onlyAdmin');
});

test('PATCH payload builder', () => {
    assert.deepEqual(buildAllowNegativePatch({ allowNegativeBalance: true, reason: '  because  ' }), {
        allowNegativeBalance: true,
        reason: 'because',
    });
    assert.equal(reasonAcceptable('ab'), false);
    assert.equal(reasonAcceptable('abc'), true);
});

test('new strings exist in EN and AR', () => {
    for (const k of [
        'cb.neg.label',
        'cb.neg.chip',
        'cb.neg.confirmOn',
        'cb.neg.onlyAdmin',
        'cb.neg.saved',
    ]) {
        assert.notEqual(accT('en', k), k);
        assert.notEqual(accT('ar', k), k);
        assert.notEqual(accT('ar', k), accT('en', k));
    }
});
