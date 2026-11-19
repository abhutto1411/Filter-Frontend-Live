import test from 'node:test';
import assert from 'node:assert/strict';
import {
    deriveManagedBy,
    hqWorkshopIdFrom,
    isUsableBranchCache,
    rederiveEditManagedBy,
    disabledStoreIdsForManagedBy,
    groupedStoreOptions,
    managedByChanged,
    managedByErrorKey,
    managedByStoreError,
    ownerWorkshopRequired,
    workshopIdsOfStores,
} from './corporateManagedBy.js';

const branches = [
    { id: 6, workshopId: 3 },
    { id: 63, workshopId: 50 },
    { id: 64, workshopId: 50 },
];

test('HQ-managed may mix workshops', () => {
    assert.equal(managedByStoreError('hq', ['6', '64'], branches), null);
});
test('workshop-managed may span workshops; home workshop is required on create', () => {
    assert.equal(managedByStoreError('workshop', ['6', '64'], branches), null);
    assert.equal(managedByStoreError('workshop', ['63', '64'], branches), null);
    assert.deepEqual(workshopIdsOfStores(['64', '6'], branches), ['50', '3']);
    assert.equal(ownerWorkshopRequired({ managedBy: 'workshop', ownerWorkshopId: '' }), 'err.ownerWorkshopRequired');
    assert.equal(ownerWorkshopRequired({ managedBy: 'workshop', ownerWorkshopId: '50' }), null);
    assert.equal(ownerWorkshopRequired({ managedBy: 'workshop', ownerWorkshopId: '', managerChanged: false }), null);
});
test('owner change detection + backend codes', () => {
    assert.equal(managedByChanged(null, 'workshop'), false);
    assert.equal(managedByChanged('hq', 'hq'), false);
    assert.equal(managedByChanged('hq', 'workshop'), true);
    assert.equal(managedByErrorKey({ code: 'CORPORATE_BRANCH_DOUBLE_MANAGED' }), 'err.doubleManaged');
    assert.equal(managedByErrorKey({ code: 'CORPORATE_OWNER_WORKSHOP_REQUIRED' }), 'err.ownerWorkshopRequired');
    assert.equal(managedByErrorKey({ code: 'CORPORATE_OWNER_WORKSHOP_INVALID' }), 'err.ownerWorkshopInvalid');
    assert.equal(managedByErrorKey({ code: 'CORPORATE_MULTI_WORKSHOP_USE_HQ_BILL' }), 'err.multiWorkshopUseHqBill');
});

// CLOSING F1
test('no store is disabled for hq or workshop', () => {
    assert.equal(disabledStoreIdsForManagedBy('workshop', ['64'], branches).size, 0);
    assert.equal(disabledStoreIdsForManagedBy('hq', ['64'], branches).size, 0);
});
test('options grouped by workshop and none disabled', () => {
    const options = [
        { id: '64', label: 'Store 64 · W50', chipLabel: 'Store 64', group: 'W50' },
        { id: '6', label: 'Store 6 · W3', chipLabel: 'Store 6', group: 'W3' },
        { id: '63', label: 'Store 63 · W50', chipLabel: 'Store 63', group: 'W50' },
    ];
    const out = groupedStoreOptions(options, { managedBy: 'workshop', selectedIds: ['64'], branches });
    assert.deepEqual(out.map((o) => [o.id, o.group, Boolean(o.disabled)]), [
        ['6', 'W3', false],
        ['63', 'W50', false],
        ['64', 'W50', false],
    ]);
    const mixed = groupedStoreOptions(options, { managedBy: 'workshop', selectedIds: ['64', '6'], branches });
    assert.equal(mixed.some((o) => o.disabled), false);
    assert.equal(groupedStoreOptions(options, { managedBy: 'hq', selectedIds: ['64'], branches }).some((o) => o.disabled), false);
});
test('edit derives managedBy from owner vs HQ when missing', () => {
    assert.equal(deriveManagedBy({ managedBy: 'workshop', ownerWorkshopId: '1', hqWorkshopId: '1' }), 'workshop');
    assert.equal(deriveManagedBy({ ownerWorkshopId: '1', hqWorkshopId: '1' }), 'hq');
    assert.equal(deriveManagedBy({ ownerWorkshopId: 50, hqWorkshopId: '1' }), 'workshop');
    assert.equal(deriveManagedBy({ ownerWorkshopId: '50' }), 'hq');
    assert.equal(deriveManagedBy({}, null), null);
});

// ---- FINAL F1: hqWorkshopIdFrom / re-derive / cache (real options shape) ----

const OPTIONS = [
    { id: '1', name: 'Filter HQ', status: 'active', isPlatformHq: true },
    { id: '50', name: 'Al Noor', status: 'active', isPlatformHq: false },
];

test('F1 hqWorkshopIdFrom: HQ id from { id, name, status, isPlatformHq }', () => {
    assert.equal(hqWorkshopIdFrom(OPTIONS), '1');
    assert.equal(hqWorkshopIdFrom([OPTIONS[1]]), null);
    assert.equal(hqWorkshopIdFrom([]), null);
    assert.equal(hqWorkshopIdFrom(undefined), null);
});

test('F1 details before workshops: re-derived to "workshop" once the HQ id arrives', () => {
    // Details arrived while the HQ id was still unknown → fallback 'hq'.
    const editing = {
        id: '7', managedBy: 'hq', initialManagedBy: null,
        managedByFromApi: false, managedByTouched: false, ownerWorkshopId: '50',
    };
    assert.equal(rederiveEditManagedBy(editing, null), editing);
    const next = rederiveEditManagedBy(editing, hqWorkshopIdFrom(OPTIONS));
    assert.equal(next.managedBy, 'workshop');
    assert.equal(next.initialManagedBy, 'workshop');
    const hqOwned = rederiveEditManagedBy({ ...editing, ownerWorkshopId: '1' }, '1');
    assert.equal(hqOwned.managedBy, 'hq');
});

test('F1 API managedBy present (or user touched) → never overridden', () => {
    const fromApi = { managedBy: 'hq', initialManagedBy: 'hq', managedByFromApi: true, ownerWorkshopId: '50' };
    assert.equal(rederiveEditManagedBy(fromApi, '1'), fromApi);
    const touched = { managedBy: 'hq', initialManagedBy: null, managedByTouched: true, ownerWorkshopId: '50' };
    assert.equal(rederiveEditManagedBy(touched, '1'), touched);
});

test('F1 stale cache without isPlatformHq is ignored', () => {
    assert.equal(isUsableBranchCache({ workshops: [{ id: '1', name: 'HQ', status: 'active' }] }), false);
    assert.equal(isUsableBranchCache({ workshops: OPTIONS }), true);
    assert.equal(isUsableBranchCache({ workshops: [] }), false);
    assert.equal(isUsableBranchCache(null), false);
});
