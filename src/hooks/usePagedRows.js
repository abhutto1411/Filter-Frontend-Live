import { useMemo, useState } from 'react';

export const TABLE_PAGE_SIZES = [25, 40, 55, 70, 85, 100];

function scrollToTop(scrollRef) {
    scrollRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Client-side paging for a table fed by an in-memory array. Spread `pagerProps` into
 * `WsTablePagination`. The page goes back to 1 whenever `resetKey` changes (pass the
 * active filters); a shrinking list just clamps to its last page.
 */
export function usePagedRows(rows, { resetKey = '', scrollRef = null, pageSizes = TABLE_PAGE_SIZES } = {}) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(pageSizes[0]);
    const [seenResetKey, setSeenResetKey] = useState(resetKey);
    if (seenResetKey !== resetKey) {
        setSeenResetKey(resetKey);
        setPage(1);
    }

    const total = Array.isArray(rows) ? rows.length : 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(page, pageCount);
    const rowOffset = (current - 1) * pageSize;
    const pagedRows = useMemo(
        () => (Array.isArray(rows) ? rows.slice(rowOffset, rowOffset + pageSize) : []),
        [rows, rowOffset, pageSize],
    );

    return {
        pagedRows,
        rowOffset,
        total,
        pagerProps: {
            page: current,
            pageCount,
            pageSize,
            pageSizes,
            total,
            onPageChange: (p) => {
                setPage(p);
                scrollToTop(scrollRef);
            },
            onPageSizeChange: (n) => {
                setPageSize(n);
                setPage(1);
            },
        },
    };
}

/**
 * Paging state for lists the API pages itself (`page` / `limit` in, `total` out).
 * Send `page` and `pageSize` with the request, then spread `pagerFor(total)` into
 * `WsTablePagination`. The page goes back to 1 whenever `resetKey` changes.
 */
export function useServerPaging({ resetKey = '', scrollRef = null, pageSizes = TABLE_PAGE_SIZES } = {}) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(pageSizes[0]);
    const [seenResetKey, setSeenResetKey] = useState(resetKey);
    if (seenResetKey !== resetKey) {
        setSeenResetKey(resetKey);
        setPage(1);
    }

    const pagerFor = (total) => {
        const count = Math.max(0, Number(total) || 0);
        const pageCount = Math.max(1, Math.ceil(count / pageSize));
        return {
            page: Math.min(page, pageCount),
            pageCount,
            pageSize,
            pageSizes,
            total: count,
            onPageChange: (p) => {
                setPage(p);
                scrollToTop(scrollRef);
            },
            onPageSizeChange: (n) => {
                setPageSize(n);
                setPage(1);
            },
        };
    };

    return { page, pageSize, setPage, pagerFor };
}
