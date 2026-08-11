import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { qs, workshopStaffListScopeQuery } from '../../services/workshopStaffApi';
import ForceCashierLogoutModal from '../../components/workshop/ForceCashierLogoutModal';
import ClosingReportDetailModal from '../../components/workshop/ClosingReportDetailModal';
import PosMonitoringKpiProofModal from '../../components/workshop/PosMonitoringKpiProofModal';
import { wpmT } from '../../utils/workshopPosMonitoringI18n';
import { riyadhRangeToApiIso } from '../../utils/riyadhBusinessRange';

const CLOSING_PAGE_SIZE = 20;

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatShiftOpenedAt = (counter, emdash) => {
    const epoch = counter?.openedAtEpochMs ?? counter?.opened_at_epoch_ms;
    if (epoch != null && Number.isFinite(Number(epoch))) {
        return new Date(Number(epoch)).toLocaleString();
    }
    const raw = counter?.openedAt ?? counter?.opened_at ?? counter?.startTime ?? counter?.start_time;
    if (raw) return String(raw);
    return emdash;
};

const formatShiftStatus = (status, t) => {
    const raw = String(status || '').trim();
    if (!raw) return t('emdash');
    const upper = raw.toUpperCase();
    if (upper === 'OPEN') return t('status.open');
    if (upper === 'CLOSED') return t('status.closed');
    return raw;
};

export default function WorkshopPosMonitoring({ selectedBranchId = 'all', branches = [], locale: localeProp }) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wpmT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const canForceLogout = hasPermission('workshop.pos-monitoring.force-logout');
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [forceLogoutCounter, setForceLogoutCounter] = useState(null);
    const [selectedClosingReport, setSelectedClosingReport] = useState(null);
    const [kpiProofModalId, setKpiProofModalId] = useState(null);

    const [draftRangeFrom, setDraftRangeFrom] = useState('');
    const [draftRangeTo, setDraftRangeTo] = useState('');
    const [appliedRangeFrom, setAppliedRangeFrom] = useState('');
    const [appliedRangeTo, setAppliedRangeTo] = useState('');
    const [rangeError, setRangeError] = useState('');
    const [closingPage, setClosingPage] = useState(1);

    const allowedBranchIdsKey = useMemo(
        () => branches.map((b) => String(b.id)).filter(Boolean).sort().join(','),
        [branches],
    );

    const rangeDirty =
        draftRangeFrom !== appliedRangeFrom || draftRangeTo !== appliedRangeTo;
    const hasAppliedRange = Boolean(appliedRangeFrom || appliedRangeTo);

    const loadPosMonitoring = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const allowedIds = allowedBranchIdsKey
                ? allowedBranchIdsKey.split(',')
                : [];
            const params = {
                ...workshopStaffListScopeQuery(selectedBranchId, allowedIds),
                closingPage,
                closingPageSize: CLOSING_PAGE_SIZE,
            };
            if (appliedRangeFrom && appliedRangeTo) {
                const iso = riyadhRangeToApiIso(appliedRangeFrom, appliedRangeTo);
                params.from = iso.startDate;
                params.to = iso.endDate;
            } else if (appliedRangeFrom) {
                params.from = riyadhRangeToApiIso(appliedRangeFrom, appliedRangeFrom).startDate;
            } else if (appliedRangeTo) {
                params.to = riyadhRangeToApiIso(appliedRangeTo, appliedRangeTo).endDate;
            }
            const response = await apiFetch(
                `/workshop-staff/pos-monitoring${qs(params)}`,
            );
            if (!response?.success) {
                throw new Error(t('err.invalid'));
            }
            setData(response);
        } catch (err) {
            setError(err.message || t('err.load'));
        } finally {
            setIsLoading(false);
        }
    }, [
        selectedBranchId,
        allowedBranchIdsKey,
        appliedRangeFrom,
        appliedRangeTo,
        closingPage,
        t,
    ]);

    const applyDateRange = useCallback(() => {
        setRangeError('');
        const from = String(draftRangeFrom || '').trim();
        const to = String(draftRangeTo || '').trim();
        if (!from && !to) {
            setAppliedRangeFrom('');
            setAppliedRangeTo('');
            setClosingPage(1);
            return;
        }
        if (!from || !to) {
            setRangeError(t('error.rangeBoth'));
            return;
        }
        try {
            riyadhRangeToApiIso(from, to);
        } catch (e) {
            setRangeError(e?.message || t('error.rangeInvalid'));
            return;
        }
        setAppliedRangeFrom(from);
        setAppliedRangeTo(to);
        setClosingPage(1);
    }, [draftRangeFrom, draftRangeTo, t]);

    const clearDateRange = useCallback(() => {
        setRangeError('');
        setDraftRangeFrom('');
        setDraftRangeTo('');
        setAppliedRangeFrom('');
        setAppliedRangeTo('');
        setClosingPage(1);
    }, []);

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return t('branch.all');
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || t('branch.fallback');
    }, [branches, selectedBranchId, t]);

    const { liveCountersScoped, closingReportsScoped } = useMemo(() => {
        const rawLive = data?.liveCounters || [];
        const rawClose = data?.closingReports || [];
        const allowedIds = new Set(branches.map((b) => String(b.id)));
        const inSidebarBranches = (row) => {
            const rid = row.branchId ?? row.branch_id;
            // If sidebar has no branches yet, don't hide rows.
            if (allowedIds.size === 0) return true;
            // Server already scoped; keep rows without branchId.
            if (rid == null) return true;
            return allowedIds.has(String(rid));
        };
        if (!selectedBranchId || selectedBranchId === 'all') {
            return {
                liveCountersScoped: rawLive.filter(inSidebarBranches),
                closingReportsScoped: rawClose.filter(inSidebarBranches),
            };
        }
        const bn = branches.find((b) => String(b.id) === String(selectedBranchId))?.name || '';
        const match = (row) => {
            const rid = row.branchId ?? row.branch_id;
            if (rid != null && String(rid) === String(selectedBranchId)) return true;
            if (bn && String(row.branchName ?? row.branch_name ?? '').trim() === bn) return true;
            return false;
        };
        return {
            liveCountersScoped: rawLive.filter(match),
            closingReportsScoped: rawClose.filter(match),
        };
    }, [data, selectedBranchId, branches]);

    useEffect(() => {
        loadPosMonitoring();
    }, [loadPosMonitoring]);

    useEffect(() => {
        setClosingPage(1);
    }, [selectedBranchId]);

    const liveCountersKpi = liveCountersScoped.length;
    const openOrdersKpi = toNumber(data?.openOrdersCount);
    const todaySalesKpi = toNumber(data?.todaySales);

    const closingPagination = data?.closingReportsPagination || {};
    const closingTotal = toNumber(closingPagination.total);
    const closingTotalPages = Math.max(1, toNumber(closingPagination.totalPages) || 1);
    const closingPageSize = toNumber(closingPagination.pageSize) || CLOSING_PAGE_SIZE;
    const rangeFrom = closingTotal === 0 ? 0 : (closingPage - 1) * closingPageSize + 1;
    const rangeTo = Math.min(closingPage * closingPageSize, closingTotal);

    const kpiCards = [
        { id: 'live_counters', label: t('kpi.liveCounters'), value: String(liveCountersKpi), icon: 'POS', iconClass: 'ws-kpi-icon--blue' },
        { id: 'open_orders', label: t('kpi.openOrders'), value: String(openOrdersKpi), icon: 'ORD', iconClass: 'ws-kpi-icon--orange' },
        { id: 'today_sales', label: t('kpi.todaySales'), value: t('money.sar', { amount: todaySalesKpi.toLocaleString() }), icon: 'SAR', iconClass: 'ws-kpi-icon--green' },
    ];

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">
                        {t('page.subtitleLead')} <strong>{branchLabel}</strong>
                    </p>
                </div>
                <button className="btn-portal" onClick={loadPosMonitoring} disabled={isLoading}>
                    <RefreshCw size={14} /> {isLoading ? t('btn.refreshing') : t('btn.refresh')}
                </button>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                {kpiCards.map((k) => (
                    <button
                        key={k.id}
                        type="button"
                        className="ws-kpi-card ws-kpi-card--clickable"
                        onClick={() => setKpiProofModalId(k.id)}
                        aria-label={t('kpi.ariaBreakdown', { label: k.label })}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                    >
                        <div>
                            <p className="ws-kpi-label">{k.label}</p>
                            <p className="ws-kpi-value">{k.value}</p>
                            <p className="ws-kpi-proof-hint">{t('kpi.clickBreakdown')}</p>
                        </div>
                        <div className={`ws-kpi-icon ${k.iconClass}`}>{k.icon}</div>
                    </button>
                ))}
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <p style={{ padding: '16px 16px 0', fontWeight: 700, margin: 0 }}>{t('section.liveCounters')}</p>
                <WsTableScroll style={{ padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>{t('th.cashier')}</th>
                                <th>{t('th.branch')}</th>
                                <th>{t('th.openedAt')}</th>
                                <th>{t('th.status')}</th>
                                <th>{t('th.shiftSales')}</th>
                                <th>{t('th.openOrders')}</th>
                                <th>{t('th.elapsed')}</th>
                                {canForceLogout ? (
                                <th style={{ width: 140 }}>{t('th.actions')}</th>
                                ) : null}
                            </tr>
                        </thead>
                        <tbody>
                            {liveCountersScoped.length === 0 ? (
                                <tr><td colSpan={canForceLogout ? 8 : 7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>{t('empty.liveCounters')}</td></tr>
                            ) : liveCountersScoped.map((counter) => (
                                <tr key={counter.posSessionId}>
                                    <td>{counter.cashierName || t('emdash')}</td>
                                    <td>{counter.branchName || t('emdash')}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatShiftOpenedAt(counter, t('emdash'))}</td>
                                    <td><span className={`ws-badge ${String(counter.shiftStatus).toUpperCase() === 'OPEN' ? 'ws-badge--green' : 'ws-badge--gray'}`}>{formatShiftStatus(counter.shiftStatus, t)}</span></td>
                                    <td>{t('money.sar', { amount: toNumber(counter.shiftSales).toLocaleString() })}</td>
                                    <td>{toNumber(counter.shiftOpenOrders)}</td>
                                    <td>{counter.shiftElapsedTime || t('emdash')}</td>
                                    {canForceLogout ? (
                                    <td>
                                        <button
                                            type="button"
                                            className="btn-portal"
                                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setForceLogoutCounter(counter);
                                            }}
                                        >
                                            <LogOut size={12} /> {t('btn.forceLogout')}
                                        </button>
                                    </td>
                                    ) : null}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </WsTableScroll>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <p style={{ padding: '16px 16px 0', fontWeight: 700, margin: 0 }}>
                    {t('section.closingReports')}
                    <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>{t('section.closingHint')}</span>
                </p>

                <div className="ws-reports-filters" style={{ padding: '12px 16px 0' }}>
                    <div className="ws-filter-group">
                        <div className="ws-date-input-group">
                            <input
                                type="datetime-local"
                                value={draftRangeFrom}
                                onChange={(e) => setDraftRangeFrom(e.target.value)}
                                step={60}
                                aria-label={t('label.fromDatetime')}
                                title="Asia/Riyadh"
                            />
                            <span className="ws-text-dim">{t('label.to')}</span>
                            <input
                                type="datetime-local"
                                value={draftRangeTo}
                                onChange={(e) => setDraftRangeTo(e.target.value)}
                                step={60}
                                aria-label={t('label.toDatetime')}
                                title="Asia/Riyadh"
                            />
                        </div>
                        {rangeDirty ? (
                            <button
                                type="button"
                                className="ws-btn-refresh"
                                onClick={applyDateRange}
                                disabled={isLoading}
                            >
                                {isLoading ? t('btn.loading') : t('btn.apply')}
                            </button>
                        ) : null}
                        {hasAppliedRange ? (
                            <button
                                type="button"
                                className="btn-portal"
                                onClick={clearDateRange}
                                disabled={isLoading}
                                style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                            >
                                {t('btn.clearRange')}
                            </button>
                        ) : null}
                    </div>
                    <div className="ws-text-dim" style={{ fontSize: '0.75rem', marginTop: 4 }}>
                        {t('hint.riyadhDatetime')}
                    </div>
                    {rangeError ? (
                        <div style={{ color: '#B91C1C', fontSize: 13, marginTop: 6 }}>{rangeError}</div>
                    ) : null}
                </div>

                <WsTableScroll style={{ padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>{t('th.cashier')}</th>
                                <th>{t('th.branch')}</th>
                                <th>{t('th.status')}</th>
                                <th>{t('th.closedAt')}</th>
                                <th>{t('th.systemTotalSales')}</th>
                                <th>{t('th.physicalTotal')}</th>
                                <th>{t('th.totalDifference')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {closingReportsScoped.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>{t('empty.closingReports')}</td></tr>
                            ) : closingReportsScoped.map((report) => (
                                <tr
                                    key={report.posSessionId ?? report.closingId}
                                    onClick={() => setSelectedClosingReport(report)}
                                    style={{ cursor: 'pointer' }}
                                    className="ws-table-row--clickable"
                                    title={t('row.viewClosing')}
                                >
                                    <td>{report.cashierName || t('emdash')}</td>
                                    <td>{report.branchName || t('emdash')}</td>
                                    <td><span className={`ws-badge ${String(report.shiftStatus).toUpperCase() === 'CLOSED' ? 'ws-badge--blue' : 'ws-badge--gray'}`}>{formatShiftStatus(report.shiftStatus, t)}</span></td>
                                    <td>{report.closedAt ? new Date(report.closedAt).toLocaleString() : t('emdash')}</td>
                                    <td>{t('money.sar', { amount: toNumber(report.systemTotalSales).toLocaleString() })}</td>
                                    <td>{t('money.sar', { amount: toNumber(report.physicalTotal).toLocaleString() })}</td>
                                    <td>{t('money.sar', { amount: toNumber(report.reconciliationTotalDifference).toLocaleString() })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </WsTableScroll>

                <div className="ws-report-pagination" style={{ padding: '0 16px 16px' }}>
                    <p className="ws-report-pagination__info">
                        {t('pagination.showing')} <strong>{rangeFrom}</strong>–<strong>{rangeTo}</strong> {t('pagination.of')} <strong>{closingTotal}</strong>
                        {isLoading ? <span>{t('pagination.loadingSuffix')}</span> : null}
                    </p>
                    <nav className="ws-report-pagination__nav" aria-label={t('label.closingPages')}>
                        <button
                            type="button"
                            className="ws-report-pagination__edge"
                            disabled={isLoading || closingPage <= 1}
                            onClick={() => setClosingPage((p) => Math.max(1, p - 1))}
                        >
                            {t('btn.previous')}
                        </button>
                        <div className="ws-report-pagination__pages" role="group" aria-label={t('label.pageNumbers')}>
                            {Array.from({ length: Math.min(closingTotalPages, 7) }, (_, i) => {
                                let n;
                                if (closingTotalPages <= 7) {
                                    n = i + 1;
                                } else if (closingPage <= 4) {
                                    n = i + 1;
                                } else if (closingPage >= closingTotalPages - 3) {
                                    n = closingTotalPages - 6 + i;
                                } else {
                                    n = closingPage - 3 + i;
                                }
                                return (
                                    <button
                                        key={n}
                                        type="button"
                                        className={`ws-report-pagination__page${n === closingPage ? ' ws-report-pagination__page--active' : ''}`}
                                        disabled={isLoading}
                                        onClick={() => setClosingPage(n)}
                                    >
                                        {n}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            className="ws-report-pagination__edge"
                            disabled={isLoading || closingPage >= closingTotalPages}
                            onClick={() => setClosingPage((p) => Math.min(closingTotalPages, p + 1))}
                        >
                            {t('btn.next')}
                        </button>
                    </nav>
                </div>
            </div>

            {canForceLogout && forceLogoutCounter && (
                <ForceCashierLogoutModal
                    counter={forceLogoutCounter}
                    onClose={() => setForceLogoutCounter(null)}
                    onCompleted={() => {
                        setForceLogoutCounter(null);
                        loadPosMonitoring();
                    }}
                />
            )}

            {selectedClosingReport && (
                <ClosingReportDetailModal
                    report={selectedClosingReport}
                    onClose={() => setSelectedClosingReport(null)}
                />
            )}

            {kpiProofModalId && (
                <PosMonitoringKpiProofModal
                    kpiId={kpiProofModalId}
                    data={data}
                    liveCounters={liveCountersScoped}
                    branchLabel={branchLabel}
                    onClose={() => setKpiProofModalId(null)}
                />
            )}
        </div>
    );
}
