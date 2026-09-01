import React from 'react';
import {
    Shimmer,
    ShimmerLine,
    ShimmerKpiGrid,
    ShimmerListRows,
    ShimmerTable,
} from '../../components/supplier/Shimmer';

/** Shimmer layouts for admin / standalone marketing tabs (imports supplier Shimmer.css). */

export function MarketingCardGridSkeleton({ cards = 6 }) {
    return (
        <div className="marketing-grid mk-shimmer-busy" role="status" aria-live="polite" aria-busy="true">
            {Array.from({ length: cards }).map((_, i) => (
                <div key={i} className="marketing-card" style={{ minHeight: 188 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <ShimmerLine height={16} width="72%" style={{ marginBottom: 8 }} />
                            <ShimmerLine height={11} width="38%" />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <Shimmer style={{ width: 56, height: 22, borderRadius: 999 }} />
                            <Shimmer style={{ width: 28, height: 28, borderRadius: 8 }} />
                            <Shimmer style={{ width: 28, height: 28, borderRadius: 8 }} />
                        </div>
                    </div>
                    <div
                        className="marketing-card-stats"
                        style={{ marginTop: 16, paddingTop: 20, borderTop: '1px solid #F3F4F6' }}
                    >
                        <div className="m-stat-item">
                            <ShimmerLine height={10} width="60%" style={{ marginBottom: 6 }} />
                            <ShimmerLine height={15} width="40%" />
                        </div>
                        <div className="m-stat-item">
                            <ShimmerLine height={10} width="55%" style={{ marginBottom: 6 }} />
                            <ShimmerLine height={15} width="45%" />
                        </div>
                    </div>
                    <ShimmerLine height={10} width="55%" style={{ marginTop: 16 }} />
                </div>
            ))}
        </div>
    );
}

export function MarketingDashboardSkeleton() {
    return (
        <div className="marketing-dashboard mk-shimmer-busy" role="status" aria-live="polite" aria-busy="true">
            <ShimmerKpiGrid cards={4} />
            <div className="marketing-dashboard-grid" style={{ marginTop: 0 }}>
                <div className="marketing-card">
                    <ShimmerLine width="48%" height={14} style={{ marginBottom: 16 }} />
                    <Shimmer style={{ width: '100%', height: 200, borderRadius: 12 }} />
                </div>
                <div className="marketing-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <ShimmerLine width="52%" height={14} />
                        <ShimmerLine width={72} height={12} rounded />
                    </div>
                    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #F3F4F6' }}>
                        <ShimmerListRows rows={5} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function MarketingCustomerInsightsSkeleton() {
    return (
        <div className="insights-view mk-shimmer-busy" role="status" aria-live="polite" aria-busy="true">
            <ShimmerKpiGrid cards={4} />
            <div className="marketing-card" style={{ marginBottom: 32 }}>
                <ShimmerLine width="62%" height={14} style={{ marginBottom: 16 }} />
                <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: 12 }}>
                            <ShimmerLine height={10} width="36%" style={{ marginBottom: 8 }} />
                            <ShimmerLine height={22} width="28%" style={{ marginBottom: 6 }} />
                            <ShimmerLine height={9} width="80%" />
                        </div>
                    ))}
                </div>
                <Shimmer style={{ width: '100%', height: 120, borderRadius: 12, marginTop: 8 }} />
            </div>
            <section className="premium-table">
                <ShimmerLine width={220} height={16} style={{ marginBottom: 16 }} />
                <ShimmerTable rows={8} columns={6} />
            </section>
        </div>
    );
}

export function MarketingLoyaltySkeleton() {
    return (
        <div className="loyalty-view mk-shimmer-busy" role="status" aria-live="polite" aria-busy="true">
            <ShimmerLine width={280} height={12} style={{ marginBottom: 16 }} />
            <div className="tier-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="tier-card tier-bronze" style={{ opacity: 0.85 }}>
                        <ShimmerLine height={22} width="50%" rounded style={{ margin: '0 auto 12px', opacity: 0.6 }} />
                        <ShimmerLine height={12} width="40%" rounded style={{ margin: '0 auto 24px', opacity: 0.5 }} />
                        <div style={{ background: 'rgba(255,255,255,0.12)', padding: 16, borderRadius: 12 }}>
                            <ShimmerLine height={10} width="55%" style={{ marginBottom: 10, opacity: 0.5 }} />
                            <ShimmerLine height={12} width="88%" rounded style={{ opacity: 0.45 }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function MarketingReferralManagementSkeleton() {
    return (
        <div className="referral-management-view mk-shimmer-busy" role="status" aria-live="polite" aria-busy="true">
            <ShimmerKpiGrid cards={4} />
            <MarketingCardGridSkeleton cards={3} />
            <ShimmerLine width={260} height={18} style={{ margin: '32px 0 20px' }} />
            <ShimmerTable rows={5} columns={4} />
            <ShimmerLine width={200} height={18} style={{ margin: '32px 0 20px' }} />
            <ShimmerTable rows={5} columns={4} />
        </div>
    );
}

export function MarketingReferralRulesSkeleton() {
    return (
        <div className="module-container mk-shimmer-busy" style={{ padding: '2rem' }} role="status" aria-live="polite" aria-busy="true">
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1rem' }}>
                <Shimmer style={{ height: 44, width: 180, borderRadius: 12 }} />
                <Shimmer style={{ height: 44, width: 180, borderRadius: 12 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <ShimmerLine width={280} height={22} style={{ marginBottom: 10 }} />
                    <ShimmerLine width={360} height={12} />
                </div>
                <Shimmer style={{ height: 44, width: 220, borderRadius: 12 }} />
            </div>
            <div
                className="rf-card"
                style={{ background: '#fff', borderRadius: 24, padding: '1.5rem', boxShadow: 'var(--shadow-premium)' }}
            >
                <ShimmerTable rows={6} columns={4} />
            </div>
        </div>
    );
}
