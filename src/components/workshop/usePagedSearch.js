import { useCallback, useMemo, useState } from 'react';

export const WS_PAGE_SIZES = [25, 50, 75, 100];

/**
 * Client-side search + pagination over the full row list.
 * Typing filters every row (every word must match; names starting with the query first);
 * picking a suggestion narrows the table to that one row, wherever it sat in the pages.
 * `resetKey` changes (branch, status filter…) send the table back to page 1.
 */
export default function usePagedSearch({
    rows,
    getKey,
    getName,
    getHay,
    resetKey,
    rankByName = true,
    defaultPageSize = WS_PAGE_SIZES[0],
}) {
    const [query, setQueryState] = useState('');
    const [pickedKey, setPickedKey] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSizeState] = useState(defaultPageSize);

    const index = useMemo(
        () =>
            rows.map((row) => ({
                row,
                key: getKey(row),
                name: String(getName(row) || '').toLowerCase(),
                hay: String(getHay(row) || '').toLowerCase(),
            })),
        [rows, getKey, getName, getHay],
    );

    const { matches, ranked } = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return { matches: [], ranked: [] };
        const words = q.split(/\s+/).filter(Boolean);
        const hits = index.filter((x) => words.every((w) => x.hay.includes(w)));
        const rank = (x) => (x.name.startsWith(q) ? 0 : x.name.includes(q) ? 1 : 2);
        return {
            matches: hits.map((x) => x.row),
            ranked: [...hits].sort((a, b) => rank(a) - rank(b)).map((x) => x.row),
        };
    }, [index, query]);

    const visible = useMemo(() => {
        if (pickedKey != null) {
            const hit = index.filter((x) => x.key === pickedKey).map((x) => x.row);
            if (hit.length) return hit;
        }
        if (!query.trim()) return rows;
        return rankByName ? ranked : matches;
    }, [pickedKey, index, query, matches, ranked, rankByName, rows]);

    const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const paged = useMemo(
        () => visible.slice((currentPage - 1) * pageSize, currentPage * pageSize),
        [visible, currentPage, pageSize],
    );

    const [lastResetKey, setLastResetKey] = useState(resetKey);
    if (lastResetKey !== resetKey) {
        setLastResetKey(resetKey);
        setPage(1);
    }

    const setQuery = useCallback((text) => {
        setQueryState(text);
        setPickedKey(null);
        setPage(1);
    }, []);

    const pick = useCallback(
        (row) => {
            setQueryState(String(getName(row) || ''));
            setPickedKey(getKey(row));
            setPage(1);
        },
        [getKey, getName],
    );

    const clear = useCallback(() => {
        setQueryState('');
        setPickedKey(null);
        setPage(1);
    }, []);

    const setPageSize = useCallback((n) => {
        setPageSizeState(n);
        setPage(1);
    }, []);

    return {
        query,
        setQuery,
        pick,
        clear,
        picked: pickedKey != null,
        suggestions: pickedKey != null ? [] : ranked,
        visible,
        paged,
        page: currentPage,
        pageCount,
        pageSize,
        setPage,
        setPageSize,
        total: visible.length,
    };
}
