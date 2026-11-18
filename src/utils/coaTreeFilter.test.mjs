import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countLeafAndHeading } from './accountingReportDisplay.js';
import {
  accountSelfMatchesFilters,
  clampPageOffset,
  coaRowKind,
  collectMergedAccounts,
  collectSelfMatchingAccounts,
  filterTreeByTypeStatus,
  filterTreeForSearch,
  flattenVisibleTree,
  isCoaHeadingRow,
  mergeCoaRow,
} from './coaTreeFilter.js';

const tree = [
  {
    id: '1',
    code: '1000',
    name: 'Assets',
    type: 'ASSET',
    children: [
      { id: '2', code: '1100', name: 'Cash', type: 'ASSET', children: [] },
      { id: '3', code: '1200', name: 'Old Bank', type: 'ASSET', children: [] },
    ],
  },
  {
    id: '4',
    code: '4000',
    name: 'Revenue',
    type: 'INCOME',
    children: [{ id: '5', code: '4010', name: 'Product Sales', type: 'INCOME', children: [] }],
  },
];

const byId = new Map([
  ['1', { id: '1', type: 'ASSET', status: 'active', hasChildren: true, isHeading: true }],
  ['2', { id: '2', type: 'ASSET', status: 'active' }],
  ['3', { id: '3', type: 'ASSET', status: 'inactive' }],
  ['4', { id: '4', type: 'INCOME', status: 'active', hasChildren: true, isHeading: true }],
  ['5', { id: '5', type: 'INCOME', status: 'active' }],
]);

describe('coaRowKind / isCoaHeadingRow', () => {
  it('detects heading via any flag', () => {
    assert.equal(coaRowKind({ isHeading: true }), 'heading');
    assert.equal(coaRowKind({ hasChildren: true }), 'heading');
    assert.equal(coaRowKind({ _hasChildren: true }), 'heading');
    assert.equal(coaRowKind({}), 'leaf');
    assert.equal(isCoaHeadingRow(null), false);
  });
});

describe('filterTreeForSearch', () => {
  it('matches code or name and keeps ancestors', () => {
    const out = filterTreeForSearch(tree, 'cash');
    assert.deepEqual(out.map((n) => n.id), ['1']);
    assert.deepEqual(out[0].children.map((n) => n.id), ['2']);
    const byCode = filterTreeForSearch(tree, '4010');
    assert.deepEqual(byCode[0].children.map((n) => n.id), ['5']);
  });

  it('returns tree unchanged for blank query', () => {
    assert.equal(filterTreeForSearch(tree, '  '), tree);
  });
});

describe('filterTreeByTypeStatus', () => {
  it('returns tree unchanged when both filters are All', () => {
    assert.equal(filterTreeByTypeStatus(tree, { byId }), tree);
  });

  it('filters by type', () => {
    const out = filterTreeByTypeStatus(tree, { type: 'INCOME', byId });
    assert.deepEqual(out.map((n) => n.id), ['4']);
  });

  it('active status hides inactive leaves but keeps heading', () => {
    const out = filterTreeByTypeStatus(tree, { status: 'active', byId });
    const assets = out.find((n) => n.id === '1');
    assert.deepEqual(assets.children.map((n) => n.id), ['2']);
  });

  it('inactive status keeps ancestors of an inactive leaf', () => {
    const out = filterTreeByTypeStatus(tree, { status: 'inactive', byId });
    assert.deepEqual(out.map((n) => n.id), ['1']);
    assert.deepEqual(out[0].children.map((n) => n.id), ['3']);
  });
});

describe('flatten + merge + counts', () => {
  it('respects expandedIds unless forced', () => {
    assert.equal(flattenVisibleTree(tree, new Set()).length, 2);
    assert.equal(flattenVisibleTree(tree, new Set(['1'])).length, 4);
    assert.equal(flattenVisibleTree(tree, new Set(), true).length, 5);
  });

  it('keeps heading flag when filter removed all children', () => {
    const filtered = filterTreeByTypeStatus(tree, { status: 'inactive', type: 'INCOME', byId });
    assert.equal(filtered.length, 0);
    const merged = mergeCoaRow({ id: '1', _hasChildren: false }, byId.get('1'));
    assert.equal(merged.isHeading, true);
    assert.equal(merged.hasChildren, true);
  });

  it('counts leaf and heading over the filtered list', () => {
    const filtered = filterTreeByTypeStatus(tree, { status: 'active', byId });
    const rows = collectMergedAccounts(filtered, byId);
    assert.deepEqual(countLeafAndHeading(rows), { leaf: 2, heading: 2, total: 4 });
  });
});

describe('collectSelfMatchingAccounts (card counts)', () => {
  it('ignores path-only headings when search matches two leaves', () => {
    const cashTree = [
      {
        id: '1',
        code: '1000',
        name: 'Assets',
        type: 'ASSET',
        children: [
          { id: '2', code: '1100', name: 'Petty Cash Drawer', type: 'ASSET', children: [] },
          { id: '3', code: '1200', name: 'Safe Cash Box', type: 'ASSET', children: [] },
        ],
      },
    ];
    const map = new Map([
      ['1', { id: '1', type: 'ASSET', status: 'active', hasChildren: true, isHeading: true }],
      ['2', { id: '2', type: 'ASSET', status: 'active' }],
      ['3', { id: '3', type: 'ASSET', status: 'active' }],
    ]);
    const pathKept = filterTreeForSearch(cashTree, 'cash');
    assert.equal(pathKept.length, 1);
    assert.equal(pathKept[0].children.length, 2);
    assert.equal(accountSelfMatchesFilters(pathKept[0], { search: 'cash', byId: map }), false);
    const matching = collectSelfMatchingAccounts(cashTree, { search: 'cash', byId: map });
    assert.deepEqual(matching.map((r) => r.id).sort(), ['2', '3']);
    assert.deepEqual(countLeafAndHeading(matching), { leaf: 2, heading: 0, total: 2 });
    assert.equal(collectMergedAccounts(pathKept, map).length, 3);
  });
});

describe('clampPageOffset', () => {
  it('clamps beyond last page and handles empty', () => {
    assert.equal(clampPageOffset(50, 30), 25);
    assert.equal(clampPageOffset(0, 0), 0);
    assert.equal(clampPageOffset(25, 26), 25);
    assert.equal(clampPageOffset(-5, 10), 0);
  });
});
