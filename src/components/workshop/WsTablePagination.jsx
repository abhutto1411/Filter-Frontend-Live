import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Page numbers to show: first, last, and a window around the current page, with gaps as null. */
function pageWindow(page, pageCount) {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const pages = new Set([1, pageCount, page - 1, page, page + 1]);
    if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
    if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));
    const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
        out.push(p);
    });
    return out;
}

const DEFAULT_LABELS = {
    prev: 'Previous page',
    next: 'Next page',
    rowsPerPage: 'Rows per page',
    showing: (from, to, total) => `Showing ${from}–${to} of ${total}`,
    page: (n) => `Page ${n}`,
};

/**
 * Centered footer for client-side paged tables: numbered pages plus a rows-per-page picker.
 * `labels`: { prev, next, rowsPerPage, showing(from, to, total), page(n) }.
 */
export default function WsTablePagination({
    page,
    pageCount,
    pageSize,
    pageSizes,
    total,
    onPageChange,
    onPageSizeChange,
    labels = DEFAULT_LABELS,
}) {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return (
        <nav className="ws-pager" aria-label={labels.page(page)}>
            <div className="ws-pager__info">{labels.showing(from, to, total)}</div>
            <div className="ws-pager__pages">
                <button
                    type="button"
                    className="ws-pager__btn"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    aria-label={labels.prev}
                    title={labels.prev}
                >
                    <ChevronLeft size={16} />
                </button>
                {pageWindow(page, pageCount).map((p, i) =>
                    p == null ? (
                        <span key={`gap-${i}`} className="ws-pager__gap">
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            type="button"
                            className={`ws-pager__btn${p === page ? ' is-current' : ''}`}
                            aria-current={p === page ? 'page' : undefined}
                            aria-label={labels.page(p)}
                            onClick={() => p !== page && onPageChange(p)}
                        >
                            {p}
                        </button>
                    ),
                )}
                <button
                    type="button"
                    className="ws-pager__btn"
                    disabled={page >= pageCount}
                    onClick={() => onPageChange(page + 1)}
                    aria-label={labels.next}
                    title={labels.next}
                >
                    <ChevronRight size={16} />
                </button>
            </div>
            <label className="ws-pager__size">
                <span>{labels.rowsPerPage}</span>
                <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
                    {pageSizes.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </label>
        </nav>
    );
}
