import React from 'react';
import '../styles/components/PageLoadingFallback.css';

export function PageLoadingFallback() {
    return (
        <div className="page-loading-fallback">
            <div className="loading-skeleton">
                <div className="skeleton-header" />
                <div className="skeleton-content">
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                    <div className="skeleton-line" />
                    <div className="skeleton-line" />
                </div>
                <div className="skeleton-table">
                    <div className="skeleton-row">
                        <div className="skeleton-cell" />
                        <div className="skeleton-cell" />
                        <div className="skeleton-cell" />
                    </div>
                    <div className="skeleton-row">
                        <div className="skeleton-cell" />
                        <div className="skeleton-cell" />
                        <div className="skeleton-cell" />
                    </div>
                    <div className="skeleton-row">
                        <div className="skeleton-cell" />
                        <div className="skeleton-cell" />
                        <div className="skeleton-cell" />
                    </div>
                </div>
            </div>
        </div>
    );
}
