import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { qs, branchScopeParams } from '../../services/workshopStaffApi';
import ForceCashierLogoutModal from '../../components/workshop/ForceCashierLogoutModal';
import ClosingReportDetailModal from '../../components/workshop/ClosingReportDetailModal';
import PosMonitoringKpiProofModal from '../../components/workshop/PosMonitoringKpiProofModal';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatShiftOpenedAt = (counter) => {
    const epoch = counter?.openedAtEpochMs ?? counter?.opened_at_epoch_ms;
    if (epoch != null && Number.isFinite(Number(epoch))) {
        return new Date(Number(epoch)).toLocaleString();
    }
    const raw = counter?.openedAt ?? counter?.opened_at ?? counter?.startTime ?? counter?.start_time;
    if (raw) return String(raw);
    return '—';
};

export default function WorkshopPosMonitoring({ selectedBranchId = 'all', branches = [] }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [forceLogoutCounter, setForceLogoutCounter] = useState(null);
    const [selectedClosingReport, setSelectedClosingReport] = useState(null);
    const [kpiProofModalId, setKpiProofModalId] = useState(null);

    const loadPosMonitoring = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiFetch(`/workshop-staff/pos-monitoring${qs(branchScopeParams(selectedBranchId))}`);
            if (!response?.success) {
                throw new Error('Invalid POS monitoring response.');
            }
            setData(response);
        } catch (err) {
            setError(err.message || 'Failed to load POS monitoring.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);

    const { liveCountersScoped, closingReportsScoped } = useMemo(() => {
        const rawLive = data?.liveCounters || [];
        const rawClose = data?.closingReports || [];
        if (!selectedBranchId || selectedBranchId === 'all') {
            return { liveCountersScoped: rawLive, closingReportsScoped: rawClose };
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

    const isAllBranches = !selectedBranchId || selectedBranchId === 'all';

    const liveCountersKpi = isAllBranches ? toNumber(data?.liveCountersCount) : liveCountersScoped.length;
    const openOrdersKpi = toNumber(data?.openOrdersCount);
    const todaySalesKpi = toNumber(data?.todaySales);

    const kpiCards = [
        { id: 'live_counters', label: 'Live Counters', value: String(liveCountersKpi), icon: 'POS', iconClass: 'ws-kpi-icon--blue' },
        { id: 'open_orders', label: 'Open Orders', value: String(openOrdersKpi), icon: 'ORD', iconClass: 'ws-kpi-icon--orange' },
        { id: 'today_sales', label: 'Today Sales', value: `SAR ${todaySalesKpi.toLocaleString()}`, icon: 'SAR', iconClass: 'ws-kpi-icon--green' },
    ];

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">POS Monitoring</h2>
                    <p className="ws-page-sub">
                        Live counters and recent closing reports · <strong>{branchLabel}</strong>
                    </p>
                </div>
                <button className="btn-portal" onClick={loadPosMonitoring} disabled={isLoading}>
                    <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
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
                        aria-label={`${k.label}: view breakdown`}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                    >
                        <div>
                            <p className="ws-kpi-label">{k.label}</p>
                            <p className="ws-kpi-value">{k.value}</p>
                            <p className="ws-kpi-proof-hint">Click for breakdown</p>
                        </div>
                        <div className={`ws-kpi-icon ${k.iconClass}`}>{k.icon}</div>
                    </button>
                ))}
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <p style={{ padding: '16px 16px 0', fontWeight: 700, margin: 0 }}>Live Counters</p>
                <WsTableScroll style={{ padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Cashier</th>
                                <th>Branch</th>
                                <th>Opened At</th>
                                <th>Status</th>
                                <th>Shift Sales</th>
                                <th>Open Orders</th>
                                <th>Elapsed</th>
                                <th style={{ width: 140 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {liveCountersScoped.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No live counters</td></tr>
                            ) : liveCountersScoped.map((counter) => (
                                <tr key={counter.posSessionId}>
                                    <td>{counter.cashierName || '—'}</td>
                                    <td>{counter.branchName || '—'}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatShiftOpenedAt(counter)}</td>
                                    <td><span className={`ws-badge ${String(counter.shiftStatus).toUpperCase() === 'OPEN' ? 'ws-badge--green' : 'ws-badge--gray'}`}>{counter.shiftStatus || '—'}</span></td>
                                    <td>SAR {toNumber(counter.shiftSales).toLocaleString()}</td>
                                    <td>{toNumber(counter.shiftOpenOrders)}</td>
                                    <td>{counter.shiftElapsedTime || '—'}</td>
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
                                            <LogOut size={12} /> Force logout
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </WsTableScroll>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <p style={{ padding: '16px 16px 0', fontWeight: 700, margin: 0 }}>
                    Recent Closing Reports
                    <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>Click a row for full details</span>
                </p>
                <WsTableScroll style={{ padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Cashier</th>
                                <th>Branch</th>
                                <th>Status</th>
                                <th>Closed At</th>
                                <th>System Total Sales</th>
                                <th>Physical Total</th>
                                <th>Total Difference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {closingReportsScoped.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No closing reports</td></tr>
                            ) : closingReportsScoped.map((report) => (
                                <tr
                                    key={report.posSessionId ?? report.closingId}
                                    onClick={() => setSelectedClosingReport(report)}
                                    style={{ cursor: 'pointer' }}
                                    className="ws-table-row--clickable"
                                    title="View closing details"
                                >
                                    <td>{report.cashierName || '—'}</td>
                                    <td>{report.branchName || '—'}</td>
                                    <td><span className={`ws-badge ${String(report.shiftStatus).toUpperCase() === 'CLOSED' ? 'ws-badge--blue' : 'ws-badge--gray'}`}>{report.shiftStatus || '—'}</span></td>
                                    <td>{report.closedAt ? new Date(report.closedAt).toLocaleString() : '—'}</td>
                                    <td>SAR {toNumber(report.systemTotalSales).toLocaleString()}</td>
                                    <td>SAR {toNumber(report.physicalTotal).toLocaleString()}</td>
                                    <td>SAR {toNumber(report.reconciliationTotalDifference).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </WsTableScroll>
            </div>

            {forceLogoutCounter && (
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
