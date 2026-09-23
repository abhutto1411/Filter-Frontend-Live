import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildCoaTreeFromFlat,
    collectExpandableCoaIds,
    dedupeCoaFlatList,
    flattenVisibleCoaTree,
} from './coaFolderTree.js';

describe('dedupeCoaFlatList', () => {
    it('keeps one row per id and per account code', () => {
        const rows = [
            { id: '2', code: '1120', name: 'Al-Ghumas', parentId: '10', closingDebit: 10, closingCredit: 0 },
            { id: '2', code: '1120', name: 'Al-Ghumas dup id', parentId: '10', closingDebit: 4, closingCredit: 1 },
            { id: '3', code: '1120', name: 'Al-Ghumas orphan', parentId: null, closingDebit: 1, closingCredit: 0 },
        ];
        const out = dedupeCoaFlatList(rows);
        assert.equal(out.length, 1);
        assert.equal(out[0].id, '2');
        assert.equal(out[0].parentId, '10');
        assert.equal(out[0].closingDebit, 15);
        assert.equal(out[0].closingCredit, 1);
    });

    it('keeps one child per corporate-ar tag even when codes differ', () => {
        const out = dedupeCoaFlatList([
            { id: '8', code: '1118', name: 'Al-Birr', parentId: '10', description: 'corporate-ar:16 — per-customer' },
            { id: '9', code: '1118', name: 'Al-Birr', parentId: '10', description: 'corporate-ar:16 — per-customer' },
        ]);
        assert.equal(out.length, 1);
        assert.equal(out[0].id, '8');
    });
});

describe('buildCoaTreeFromFlat', () => {
    it('nests children once under the heading and never as a second root', () => {
        const tree = buildCoaTreeFromFlat([
            { id: '10', code: '1110', name: 'AR Corporate', parentId: null },
            { id: '21', code: '1111', name: 'Test Rinda', parentId: '10' },
            { id: '21', code: '1111', name: 'Test Rinda again', parentId: '10' },
            { id: '22', code: '1112', name: 'Al Jawad', parentId: '10' },
        ]);
        assert.equal(tree.length, 1);
        assert.equal(tree[0].code, '1110');
        assert.equal(tree[0].children.length, 2);
        assert.deepEqual(
            tree[0].children.map((c) => c.code),
            ['1111', '1112'],
        );
        assert.equal(tree[0].children[0].parentCode, '1110');
    });

    it('keeps 1110-VAR as an untagged sibling, not a customer subledger', () => {
        const tree = buildCoaTreeFromFlat([
            { id: '10', code: '1110', name: 'AR Corporate', parentId: null },
            {
                id: '21',
                code: '1111',
                name: 'FILTER — Free Wash',
                parentId: '10',
                description: 'corporate-ar:16 — per-customer',
            },
            {
                id: '99',
                code: '1110-VAR',
                name: 'Corporate AR — Closing Variance',
                parentId: '10',
                description: 'System leaf under 1110 — POS counter-closing corporate over/short (not a customer subledger).',
            },
        ]);
        assert.deepEqual(
            tree[0].children.map((c) => c.code),
            ['1110-VAR', '1111'],
        );
    });
});

describe('flattenVisibleCoaTree', () => {
    it('hides children until the folder is expanded', () => {
        const tree = buildCoaTreeFromFlat([
            { id: '10', code: '1110', name: 'AR Corporate', parentId: null },
            { id: '21', code: '1111', name: 'Test Rinda', parentId: '10' },
        ]);
        const collapsed = flattenVisibleCoaTree(tree, new Set());
        assert.deepEqual(collapsed.map((r) => r.code), ['1110']);
        const expanded = flattenVisibleCoaTree(tree, new Set(['10']));
        assert.deepEqual(expanded.map((r) => r.code), ['1110', '1111']);
        assert.equal(collectExpandableCoaIds(tree).join(','), '10');
    });
});
