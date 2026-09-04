import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '../styles/components/PaginationControls.css';

/**
 * Reusable pagination controls component
 * Usage: <PaginationControls total={100} limit={20} offset={0} onPageChange={handlePageChange} loading={false} />
 */
export function PaginationControls({ total, limit, offset, onPageChange, loading = false }) {
    if (!total || total === 0) return null;

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    const canGoBack = currentPage > 1;
    const canGoNext = currentPage < totalPages;

    const handlePrevPage = () => {
        if (canGoBack && !loading) {
            onPageChange(Math.max(0, offset - limit));
        }
    };

    const handleNextPage = () => {
        if (canGoNext && !loading) {
            onPageChange(offset + limit);
        }
    };

    const handlePageInput = (e) => {
        const page = parseInt(e.target.value, 10);
        if (page > 0 && page <= totalPages && !loading) {
            onPageChange((page - 1) * limit);
        }
    };

    const showFrom = offset + 1;
    const showTo = Math.min(offset + limit, total);

    return (
        <div className="pagination-controls">
            <div className="pagination-info">
                Showing {showFrom}-{showTo} of {total} records
            </div>
            <div className="pagination-nav">
                <button
                    className="pagination-btn pagination-btn--prev"
                    disabled={!canGoBack || loading}
                    onClick={handlePrevPage}
                    aria-label="Previous page"
                >
                    <ChevronLeft size={18} />
                    Previous
                </button>

                <div className="pagination-pages">
                    <span>Page</span>
                    <select
                        value={currentPage}
                        onChange={handlePageInput}
                        disabled={loading}
                        className="pagination-page-select"
                    >
                        {Array.from({ length: totalPages }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {i + 1}
                            </option>
                        ))}
                    </select>
                    <span>of {totalPages}</span>
                </div>

                <button
                    className="pagination-btn pagination-btn--next"
                    disabled={!canGoNext || loading}
                    onClick={handleNextPage}
                    aria-label="Next page"
                >
                    Next
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
