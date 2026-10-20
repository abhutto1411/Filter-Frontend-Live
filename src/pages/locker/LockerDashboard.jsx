import React, { useCallback, useEffect, useState } from 'react';
import {
    Clock,
    DollarSign,
    AlertTriangle,
    History,
    RefreshCw,
    Send,
    Coins,
    Vault,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useLockerPortal } from './useLockerPortal';

export default function LockerDashboard({
    onTabChange,
    portalRole = 'supervisor',
    selectedBranchId = 'all',
}) {
    const { t, money, moneyWhole, dateTime, statusLabel, canOpenTab } = useLockerPortal();
    const isCollector = portalRole === 'collector';
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dash, setDash] = useState(null);
    const [recent, setRecent] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const branchQ =
                selectedBranchId && selectedBranchId !== 'all'
                    ? { branchId: selectedBranchId }
                    : {};
            const [dashRes, historyRes] = await Promise.all([
                apiFetch(`/locker/dashboard${qs({
                    view: isCollector ? 'collector' : 'supervisor',
                    ...branchQ,
                })}`).catch((e) => {
                    throw new Error(e?.message || t('dash.loadError'));
                }),
                apiFetch(`/locker/financial/history${qs({ page: 1, limit: 5, ...branchQ })}`).catch(
                    () => ({ items: [] }),
                ),
            ]);
            setDash(dashRes);
            setRecent(historyRes?.items || historyRes?.rows || []);
        } catch (e) {
            setError(e?.message || t('dash.loadError'));
        } finally {
            setLoading(false);
        }
    }, [isCollector, selectedBranchId, t]);

    useEffect(() => {
        load();
    }, [load]);

    const dashOrDash = (value) => (dash ? value : t('emdash'));
    const sup = dash?.supervisor || {};
    const col = dash?.collector || {};
    const todayCount = dash?.todaysCollections?.requestCount ?? 0;

    const kpis = isCollector
        ? [
              {
                  label: t('dash.myAssignments'),
                  value: dashOrDash(col.myOpenAssignments ?? 0),
                  sub: t('dash.awaitingCollection'),
                  icon: Clock,
                  c: 'ws-kpi-icon--yellow',
              },
              {
                  label: t('dash.todayCollected'),
                  value: dashOrDash(todayCount),
                  sub: t('dash.collectionsToday'),
                  icon: DollarSign,
                  c: 'ws-kpi-icon--green',
              },
              {
                  label: t('dash.monthlyCollected'),
                  value: dashOrDash(moneyWhole(dash?.monthlyCollected)),
                  sub: t('dash.monthlySub'),
                  icon: DollarSign,
                  c: 'ws-kpi-icon--blue',
              },
              {
                  label: t('dash.pendingVariance'),
                  value: dashOrDash(dash?.pendingApprovals ?? 0),
                  sub: t('dash.awaitingSupervisor'),
                  icon: AlertTriangle,
                  c: 'ws-kpi-icon--red',
              },
          ]
        : [
              {
                  label: t('dash.pendingCollections'),
                  value: dashOrDash(sup.pending),
                  sub: t('dash.overdueCount', { count: sup.overdue || 0 }),
                  icon: Clock,
                  c: 'ws-kpi-icon--red',
                  tab: 'pending',
              },
              {
                  label: t('dash.todayCollected'),
                  value: dashOrDash(todayCount),
                  sub: t('dash.collectionsToday'),
                  icon: DollarSign,
                  c: 'ws-kpi-icon--green',
                  tab: 'history',
              },
              {
                  label: t('dash.monthlyCollected'),
                  value: dashOrDash(moneyWhole(dash?.monthlyCollected)),
                  sub: t('dash.monthlySub'),
                  icon: DollarSign,
                  c: 'ws-kpi-icon--blue',
                  tab: 'history',
              },
              {
                  label: t('dash.pendingApprovals'),
                  value: dashOrDash(dash?.pendingApprovals),
                  sub: t('dash.varianceReviews'),
                  icon: AlertTriangle,
                  c: 'ws-kpi-icon--yellow',
                  tab: 'approvals',
              },
              {
                  label: t('dash.vaultBalance'),
                  value: dashOrDash(money(dash?.lockerVaultBalance)),
                  sub: t('dash.vaultBalanceSub'),
                  icon: Vault,
                  c: 'ws-kpi-icon--green',
                  tab: 'transaction_log',
              },
          ];

    const quickLinks = (isCollector
        ? [
              { l: t('nav.assigned'), t: 'assigned', i: Clock, s: t('quick.assignedSub') },
              { l: t('nav.record'), t: 'record', i: DollarSign, s: t('quick.recordSub') },
              { l: t('quick.history'), t: 'history', i: History, s: t('quick.historySub') },
          ]
        : [
              { l: t('nav.pending'), t: 'pending', i: Clock, s: t('quick.pendingSub') },
              { l: t('nav.record'), t: 'record', i: DollarSign, s: t('quick.recordSub') },
              { l: t('nav.approvals'), t: 'approvals', i: AlertTriangle, s: t('quick.approvalsSub') },
              { l: t('nav.deposit_to_bank'), t: 'deposit_to_bank', i: Send, s: t('quick.depositSub') },
              { l: t('nav.issue_petty_cash'), t: 'issue_petty_cash', i: Coins, s: t('quick.pettySub') },
              { l: t('quick.history'), t: 'history', i: History, s: t('quick.historySub') },
          ]
    ).filter((a) => canOpenTab(a.t));

    return (
        <div>
            <div className="ws-page-header" style={{ alignItems: 'center' }}>
                <div>
                    <h2 className="ws-page-title">{t('dash.title')}</h2>
                    <p className="ws-page-sub">{t('dash.sub')}</p>
                </div>
                <button
                    className="btn-secondary"
                    onClick={load}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('common.refresh')}
                </button>
            </div>

            {error ? (
                <div className="wlk-error" style={{ marginBottom: 12 }}>{error}</div>
            ) : null}

            <div className="ws-kpi-grid">
                {kpis.map((k) => {
                    const clickable = Boolean(k.tab && onTabChange && canOpenTab(k.tab));
                    return (
                        <div
                            key={k.label}
                            className={`ws-kpi-card${clickable ? ' wlk-kpi-clickable' : ''}`}
                            onClick={clickable ? () => onTabChange(k.tab) : undefined}
                            role={clickable ? 'button' : undefined}
                            tabIndex={clickable ? 0 : undefined}
                            onKeyDown={
                                clickable
                                    ? (e) => {
                                          if (e.key === 'Enter' || e.key === ' ') onTabChange(k.tab);
                                      }
                                    : undefined
                            }
                        >
                            <div>
                                <p className="ws-kpi-label">{k.label}</p>
                                <p className="ws-kpi-value">{k.value}</p>
                                <p className="ws-kpi-sub">{k.sub}</p>
                            </div>
                            <div className={`ws-kpi-icon ${k.c}`}>
                                <k.icon size={22} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {quickLinks.length ? (
                <div className="ws-quick-grid">
                    {quickLinks.map((a) => (
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
            ) : null}

            <div className="ws-section">
                <div className="ws-section-header">
                    <span className="ws-section-title">{t('dash.recent')}</span>
                </div>
                <WsTableScroll>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>{t('common.requestNo')}</th>
                            <th>{t('common.branch')}</th>
                            <th>{t('common.date')}</th>
                            <th>{t('common.received')}</th>
                            <th>{t('common.difference')}</th>
                            <th>{t('common.status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recent.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 18, color: '#9ca3af' }}>
                                    {t('dash.noCollections')}
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
                                    <td>{c.branchName || c.branch || t('emdash')}</td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {dateTime(c.collectedAt)}
                                    </td>
                                    <td>
                                        <strong>{moneyWhole(c.receivedAmount)}</strong>
                                    </td>
                                    <td>
                                        <span
                                            dir="ltr"
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
                                                ? t('emdash')
                                                : (Number(c.difference) > 0 ? '+' : '') + Number(c.difference).toFixed(2)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`ws-badge ws-badge--green`}>
                                            {statusLabel(c.status || 'collected')}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
            </div>
        </div>
    );
}
