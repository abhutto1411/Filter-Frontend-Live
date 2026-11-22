/**
 * B6: std approvals load-more offset after removals.
 * Run: npx vitest run src/pages/admin/approvalsPagingOffset.test.jsx
 */
import { describe, expect, it } from 'vitest';
import {
    approvalItemDedupeKey,
    compareApprovalsBySubmitted,
    countStdApprovalsInList,
    mergeApprovalsAppendDedupeSorted,
    nextStdApprovalsListOffset,
} from './approvalsPagingOffset.js';

function stdRow(id, day) {
    return {
        entityType: 'petty_cash',
        id: String(id),
        date: `2026-01-${String(day).padStart(2, '0')}T12:00:00Z`,
    };
}

describe('approvalsPagingOffset', () => {
    it('counts only std-queue entity types', () => {
        const items = [
            { entityType: 'hr_salary', id: '1' },
            { entityType: 'corporate_payment_approval', id: '9' },
            { entityType: 'inventory_adjustment', id: '2' },
        ];
        expect(countStdApprovalsInList(items)).toBe(2);
        expect(nextStdApprovalsListOffset(items)).toBe(2);
    });

    it('removed std row lowers next offset (no skip after item #3 removed)', () => {
        const loaded = Array.from({ length: 40 }, (_, i) =>
            stdRow(i + 1, 40 - i),
        );
        const afterRemoval = loaded.filter((r) => r.id !== '3');
        expect(nextStdApprovalsListOffset(loaded)).toBe(40);
        expect(nextStdApprovalsListOffset(afterRemoval)).toBe(39);
        expect(40 + 40).not.toBe(nextStdApprovalsListOffset(afterRemoval));
    });

    it('append at offset 39 after removal: no duplicate keys, no skipped id', () => {
        const page1 = Array.from({ length: 40 }, (_, i) => stdRow(i + 1, 40 - i));
        const afterRemoval = page1.filter((r) => r.id !== '3');
        const offset = nextStdApprovalsListOffset(afterRemoval);
        expect(offset).toBe(39);

        const incomingPage = [stdRow(41, 15), stdRow(42, 14)];
        const merged = mergeApprovalsAppendDedupeSorted(afterRemoval, incomingPage);

        const keys = merged.map(approvalItemDedupeKey);
        expect(keys.length).toBe(new Set(keys).size);
        expect(merged.some((r) => r.id === '41')).toBe(true);
        expect(merged.some((r) => r.id === '42')).toBe(true);
        expect(merged.some((r) => r.id === '3')).toBe(false);
        expect(countStdApprovalsInList(merged)).toBe(41);
    });

    it('append dedupes and re-sorts with compareApprovalsBySubmitted', () => {
        const existing = [
            { entityType: 'x', id: '10', date: '2026-02-01T00:00:00Z' },
            { entityType: 'x', id: '5', date: '2026-02-03T00:00:00Z' },
        ];
        const incoming = [
            { entityType: 'x', id: '5', date: '2026-02-03T00:00:00Z' },
            { entityType: 'x', id: '20', date: '2026-02-02T00:00:00Z' },
        ];
        const merged = mergeApprovalsAppendDedupeSorted(existing, incoming);
        expect(merged.map((r) => r.id)).toEqual(['5', '20', '10']);
        for (let i = 0; i < merged.length - 1; i += 1) {
            expect(compareApprovalsBySubmitted(merged[i], merged[i + 1])).toBeLessThanOrEqual(0);
        }
    });
});