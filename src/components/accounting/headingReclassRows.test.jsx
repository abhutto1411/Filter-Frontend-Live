import { describe, it, expect } from 'vitest';
import { flattenVisibleTree } from '../../utils/coaTreeFilter';
import { buildHeadingReclassRows } from './headingReclassRows';

describe('buildHeadingReclassRows', () => {
    const tree = [
        {
            id: '1000',
            code: '1000',
            name: 'Assets',
            isHeading: true,
            children: [
                {
                    id: '1010',
                    code: '1010',
                    name: 'Cash heading',
                    isHeading: true,
                    children: [
                        {
                            id: '1010-G',
                            code: '1010-G',
                            name: 'Cash general',
                            isHeading: false,
                            children: [],
                        },
                    ],
                },
            ],
        },
        {
            id: '6000',
            code: '6000',
            name: 'Expenses',
            isHeading: true,
            children: [
                {
                    id: '6100',
                    code: '6100',
                    name: 'OpEx',
                    isHeading: true,
                    children: [],
                },
            ],
        },
    ];
    const headingDirectIds = new Set(['1010', '6100']);

    it('headingReclassOnly shows nested headings while collapsed', () => {
        const rows = buildHeadingReclassRows(
            tree,
            headingDirectIds,
            flattenVisibleTree,
            {
                expandedIds: new Set(),
                searchActive: false,
                headingReclassOnly: true,
            },
        );
        const ids = rows.map((r) => String(r.id));
        expect(ids).toContain('1010');
        expect(ids).toContain('6100');
        expect(ids).not.toContain('1010-G');
        expect(ids).not.toContain('1000');
        expect(ids).not.toContain('6000');
    });

    it('collapsed without headingReclassOnly hides nested 1010', () => {
        const rows = buildHeadingReclassRows(
            tree,
            headingDirectIds,
            flattenVisibleTree,
            {
                expandedIds: new Set(),
                searchActive: false,
                headingReclassOnly: false,
            },
        );
        const ids = rows.map((r) => String(r.id));
        expect(ids).toContain('1000');
        expect(ids).toContain('6000');
        expect(ids).not.toContain('1010');
        expect(ids).not.toContain('6100');
    });
});
