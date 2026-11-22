import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDocumentLang } from '../hooks/useDocumentLang';
import { TABLE_PAGE_SIZES } from '../hooks/usePagedRows';
import { pagerLabels } from '../utils/tableUiI18n';
import '../styles/ui.css';

/**
 * The design system's table pager — same props as `WsTablePagination`, so it is
 * a drop-in for any list already driven by `usePagedRows` / `useServerPaging`.
 * The difference is only the skin: this one is built from `ui.css` and sits as
 * the last child of `.ui-table-wrap` (or `.ui-rows`), below the rows it pages.
 */

/** First, last, and a window around the current page, with gaps as null. */
function pageWindow(page, pageCount) {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const pages = new Set([1, pageCount, page - 1, page, page + 1]);
    if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
    if (page >= pageCount - 2) {
        [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));
    }
    const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
    const out = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
        out.push(p);
    });
    return out;
}

export default function UiPager({
    page,
    pageCount,
    pageSize,
    pageSizes = TABLE_PAGE_SIZES,
    total,
    onPageChange,
    onPageSizeChange,
    labels: labelsProp,
    id = 'ui-per-page',
}) {
    const lang = useDocumentLang();
    const defaultLabels = useMemo(() => pagerLabels(lang), [lang]);
    const labels = labelsProp || defaultLabels;

    // One page of rows needs no controls — the row count is already on screen.
    if (!total || (pageCount <= 1 && total <= pageSizes[0])) return null;

    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return (
        <div className="ui-pager ui-tokens">
            <div className="ui-pager-left">
                <label htmlFor={id}>{labels.rowsPerPage}</label>
                <select
                    id={id}
                    className="ui-page-size"
                    value={pageSize}
                    onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
                >
                    {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>{labels.showing(from, to, total)}</span>
            </div>
            <div className="ui-pager-nav">
                <button
                    type="button"
                    className="ui-page-btn"
                    disabled={page <= 1}
                    onClick={() => onPageChange?.(page - 1)}
                    aria-label={labels.prev}
                >
                    <ChevronLeft size={14} />
                </button>
                {pageWindow(page, pageCount).map((n, i) => (
                    n === null ? (
                        <span key={`gap-${i}`} className="ui-pager-gap">…</span>
                    ) : (
                        <button
                            key={n}
                            type="button"
                            className="ui-page-btn"
                            aria-current={n === page ? 'page' : undefined}
                            aria-label={labels.page(n)}
                            onClick={() => onPageChange?.(n)}
                        >
                            {n}
                        </button>
                    )
                ))}
                <button
                    type="button"
                    className="ui-page-btn"
                    disabled={page >= pageCount}
                    onClick={() => onPageChange?.(page + 1)}
                    aria-label={labels.next}
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
