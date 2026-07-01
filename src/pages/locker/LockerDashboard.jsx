import React, { useCallback, useEffect, useState } from 'react';
import {
    Clock,
    DollarSign,
    AlertTriangle,
    History,
    RefreshCw,
    Send,
    Coins,
    Archive,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';

const fmtSar = (n) =>
    `SAR ${Number(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;

export default function LockerDashboard({ onTabChange, portalRole = 'supervisor' }) {
    const isCollector = portalRole === 'collector';
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dash, setDash] = useState(null);
    const [recent, setRecent] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [dashRes, historyRes] = await Promise.all([
                apiFetch(`/locker/dashboard${qs({ view: isCollector ? 'collector' : 'supervisor' })}`).catch((e) => {
                    throw new Error(e?.message || 'Failed to load dashboard');
                }),
                apiFetch(`/locker/financial/history${qs({ page: 1, limit: 5 })}`).catch(
                    () => ({ items: [] }),
                ),
            ]);
            setDash(dashRes);
            setRecent(historyRes?.items || historyRes?.rows || []);
        } catch (e) {
            setError(e?.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    }, [isCollector]);

    useEffect(() => {
        load();
    }, [load]);

    const sup = dash?.supervisor || {};
    const col = dash?.collector || {};
    const todayCount = dash?.todaysCollections?.requestCount ?? 0;

    const kpis = isCollector
        ? [
              {
                  label: 'My Assignments',
                  value: dash ? col.myOpenAssignments ?? 0 : '—',
                  sub: 'Awaiting collection',
                  icon: Clock,
                  c: 'ws-kpi-icon--yellow',
              },
              {
                  label: "Today's Collected",
                  value: dash ? todayCount : '—',
                  sub: 'collections today',
                  icon: DollarSign,
                  c: 'ws-kpi-icon--green',
              },
              {
                  label: 'Monthly Collected',
                  value: dash ? fmtSar(dash.monthlyCollected) : '—',
                  sub: 'This month (approved)',
                  icon: DollarSign,
                  c: 'ws-kpi-icon--blue',
              },
              {
                  label: 'Pending Variance',
                  value: dash ? dash.pendingApprovals ?? 0 : '—',
                  sub: 'Awaiting supervisor review',
                  icon: AlertTriangle,
                  c: 'ws-kpi-icon--red',
              },
          ]
        : [
              {
                  label: 'Pending Collections',
                  value: dash ? sup.pending : '—',
                  sub: `${sup.overdue || 0} overdue`,
                  icon: Clock,
                  c: 'ws-kpi-icon--red',
              },
              {
                  label: "Today's Collected",
                  value: dash ? todayCount : '—',
                  sub: 'collections today',
                  icon: DollarSign,
                  c: 'ws-kpi-icon--green',
              },
              {
                  label: 'Monthly Collected',
                  value: dash ? fmtSar(dash.monthlyCollected) : '—',
                  sub: 'This month (approved)',
                  icon: DollarSign,
                  c: 'ws-kpi-icon--blue',
              },
              {
                  label: 'Pending Approvals',
                  value: dash ? dash.pendingApprovals : '—',
                  sub: 'Variance reviews',
                  icon: AlertTriangle,
                  c: 'ws-kpi-icon--yellow',
              },
          ];

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">Locker Dashboard</h2>
                    <p className="ws-page-sub">Cash Collection & Locker Operations</p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={load}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {error ? (
                <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div>
            ) : null}

            <div className="ws-kpi-grid">
                {kpis.map((k) => (
                    <div key={k.label} className="ws-kpi-card">
                        <div>
                            <p className="ws-kpi-label">{k.label}</p>
                            <p className="ws-kpi-value">{k.value}</p>
                            <p className="ws-kpi-sub">{k.sub}</p>
                        </div>
                        <div className={`ws-kpi-icon ${k.c}`}>
                            <k.icon size={22} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="ws-quick-grid">
                {(isCollector
                    ? [
                          { l: 'Assigned Requests', t: 'assigned', i: Clock, s: 'Your pickups' },
                          { l: 'Record Collection', t: 'record', i: DollarSign, s: 'From cashier' },
                          { l: 'History', t: 'history', i: History, s: 'Past collections' },
                      ]
                    : [
                          { l: 'Pending Requests', t: 'pending', i: Clock, s: 'View pickups' },
                          { l: 'Record Collection', t: 'record', i: DollarSign, s: 'From cashier' },
                          { l: 'Approvals', t: 'approvals', i: AlertTriangle, s: 'Variances' },
                          { l: 'Deposit to Bank', t: 'deposit_to_bank', i: Send, s: 'Locker → bank' },
                          { l: 'Issue Petty Cash', t: 'issue_petty_cash', i: Coins, s: 'To cashier' },
                          { l: 'History', t: 'history', i: History, s: 'Past collections' },
                      ]
                ).map((a) => (
                    <div
                        key={a.t}
                        className="ws-quick-card"
                        onClick={() => onTabChange(a.t)}
                    >
                        <div className="ws-quick-icon">
                            <a.i size={22} />
                        </div>
                        <p className="ws-quick-label">{a.l}</p>
                        <p className="ws-quick-sub">{a.s}</p>
                    </div>
                ))}
            </div>

            <div className="ws-section">
                <div className="ws-section-header">
                    <span className="ws-section-title">Recent Collections</span>
                </div>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Request #</th>
                            <th>Branch</th>
                            <th>Date</th>
                            <th>Received</th>
                            <th>Difference</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recent.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    No collections yet
                                </td>
                            </tr>
                        ) : (
                            recent.slice(0, 5).map((c) => (
                                <tr key={c.id || c.collectionId}>
                                    <td>
                                        <strong style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {c.referenceCode || c.requestReference || c.id}
                                        </strong>
                                    </td>
                                    <td>{c.branchName || c.branch || '—'}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {c.collectedAt ? new Date(c.collectedAt).toLocaleString() : '—'}
                                    </td>
                                    <td>
                                        <strong>{fmtSar(c.receivedAmount)}</strong>
                                    </td>
                                    <td>
                                        <span
                                            style={{
                                                fontWeight: 700,
                                                color:
                                                    Number(c.difference) === 0
                                                        ? '#16A34A'
                                                        : Number(c.difference) < 0
                                                        ? '#DC2626'
                                                        : '#059669',
                                            }}
                                        >
                                            {Number(c.difference) === 0
                                                ? '—'
                                                : (Number(c.difference) > 0 ? '+' : '') + Number(c.difference).toFixed(2)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`ws-badge ws-badge--green`}>
                                            {c.status || 'collected'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
