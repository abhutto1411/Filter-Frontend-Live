import React, { useCallback, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/**
 * 3-state column sorting for plain tables.
 *
 * Clicking a header cycles: ascending → descending → unsorted (original order).
 *
 * Usage:
 *   const { sortKey, sortDir, toggleSort, sortRows } = useColumnSort();
 *   const view = sortRows(rows, {
 *     name: (r) => r.name,
 *     qty: (r) => Number(r.qty),
 *   });
 *   <SortableTh label="Name" sortKey="name" sortKey={sortKey} ... />
 */
export function useColumnSort(initial = { key: null, dir: null }) {
    const [sort, setSort] = useState(initial);

    const toggleSort = useCallback((key) => {
        setSort((prev) => {
            if (prev.key !== key) return { key, dir: 'asc' };
            if (prev.dir === 'asc') return { key, dir: 'desc' };
            if (prev.dir === 'desc') return { key: null, dir: null };
            return { key, dir: 'asc' };
        });
    }, []);

    const sortRows = useCallback(
        (rows, accessors) => {
            if (!Array.isArray(rows)) return rows;
            if (!sort.key || !sort.dir) return rows;
            const accessor = accessors?.[sort.key];
            if (typeof accessor !== 'function') return rows;
            const copy = [...rows];
            copy.sort((a, b) => {
                const va = accessor(a);
                const vb = accessor(b);
                let cmp;
                if (typeof va === 'number' && typeof vb === 'number') {
                    cmp = (Number.isNaN(va) ? 0 : va) - (Number.isNaN(vb) ? 0 : vb);
                } else {
                    cmp = String(va ?? '').localeCompare(String(vb ?? ''), undefined, {
                        numeric: true,
                        sensitivity: 'base',
                    });
                }
                return sort.dir === 'asc' ? cmp : -cmp;
            });
            return copy;
        },
        [sort],
    );

    return { sortKey: sort.key, sortDir: sort.dir, toggleSort, sortRows };
}

/**
 * A sortable <th>. Pass the current sort state from useColumnSort and the
 * column's own `columnKey`. Renders a clickable header with a direction arrow.
 */
export function SortableTh({
    label,
    columnKey,
    sortKey,
    sortDir,
    onSort,
    children,
    style,
    align,
    ...thProps
}) {
    const active = sortKey === columnKey;
    return (
        <th
            {...thProps}
            onClick={() => onSort(columnKey)}
            style={{
                cursor: 'pointer',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                ...(align ? { textAlign: align } : {}),
                ...style,
            }}
            aria-sort={
                active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
            }
            title="Click to sort"
        >
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    ...(align === 'right' ? { flexDirection: 'row-reverse' } : {}),
                }}
            >
                {children ?? label}
                {active ? (
                    sortDir === 'asc' ? (
                        <ChevronUp size={14} />
                    ) : (
                        <ChevronDown size={14} />
                    )
                ) : (
                    <ChevronsUpDown size={14} style={{ opacity: 0.35 }} />
                )}
            </span>
        </th>
    );
}
