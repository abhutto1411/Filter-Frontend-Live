import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive,
    Banknote,
    UserCheck,
    AlertTriangle,
    Clock,
    CheckCircle,
    RefreshCw,
    ExternalLink,
    Inbox,
    Send,
    Coins,
    Activity,
    Info,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs } from '../../services/workshopStaffApi';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { wlockT } from '../../utils/workshopLockerI18n';
import './Workshop.css';

const num = (v) => Number(v ?? 0);

function formatMoney(value, t) {
    const n = num(value);
    const amount = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return t('money.sar', { amount });
}

function formatDate(iso, locale, t) {
    if (!iso) return t('emdash');
    try {
        return new Date(iso).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function StatCard({ icon: Icon, label, value, hint, tone = 'neutral' }) {
    const toneClass =
        {
            warn: 'wlk-stat--warn',
            danger: 'wlk-stat--danger',
            success: 'wlk-stat--success',
            info: 'wlk-stat--info',
        }[tone] || '';
    return (
        <div className={`wlk-stat ${toneClass}`}>
            <div className="wlk-stat-icon">
                <Icon size={18} />
            </div>
            <div className="wlk-stat-body">
                <div className="wlk-stat-label">{label}</div>
                <div className="wlk-stat-value">{value}</div>
                {hint ? <div className="wlk-stat-hint">{hint}</div> : null}
            </div>
        </div>
    );
}

function Section({ title, count, children, headerRight }) {
    return (
        <div className="wlk-section">
            <div className="wlk-section-header">
                <h3>
                    {title}
                    {typeof count === 'number' ? (
                        <span className="wlk-count">{count}</span>
                    ) : null}
                </h3>
                {headerRight}
            </div>
            <div className="wlk-section-body">
                <WsTableScroll>{children}</WsTableScroll>
            </div>
        </div>
    );
}

function LockerUsersTable({ users, emptyLabel, t }) {
    return (
        <table className="wlk-table">
            <thead>
                <tr>
                    <th>{t('th.name')}</th>
                    <th>{t('th.email')}</th>
                    <th>{t('th.mobile')}</th>
                    <th>{t('th.status')}</th>
                </tr>
            </thead>
            <tbody>
                {users.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="wlk-empty">
                            {emptyLabel}
                        </td>
                    </tr>
                ) : (
                    users.map((u) => (
                        <tr key={u.id}>
                            <td>{u.name || t('emdash')}</td>
                            <td>{u.email || t('emdash')}</td>
                            <td>{u.mobile || t('emdash')}</td>
                            <td>
                                {u.isActive ? (
                                    <StatusPill status="approved" t={t} />
                                ) : (
                                    <StatusPill status="rejected" t={t} />
                                )}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
}

function StatusPill({ status, t }) {
    const map = {
        pending: { label: t('status.pending'), cls: 'wlk-pill wlk-pill--warn' },
        assigned: { label: t('status.assigned'), cls: 'wlk-pill wlk-pill--info' },
        collected: { label: t('status.collected'), cls: 'wlk-pill wlk-pill--success' },
        pending_approval: { label: t('status.pendingApproval'), cls: 'wlk-pill wlk-pill--warn' },
        approved: { label: t('status.approved'), cls: 'wlk-pill wlk-pill--success' },
        rejected: { label: t('status.rejected'), cls: 'wlk-pill wlk-pill--danger' },
    };
    const cfg = map[status] || { label: status || t('emdash'), cls: 'wlk-pill' };
    return <span className={cfg.cls}>{cfg.label}</span>;
}

export default function WorkshopLockerManagement({ locale: localeProp }) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wlockT(locale, key, vars), [locale]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch(
                `/workshop-staff/locker-management/overview${qs({ _t: Date.now() })}`,
            );
            if (res?.success === false) {
                throw new Error(res?.message || t('err.load'));
            }
            setData(res);
        } catch (e) {
            setError(e?.message || t('err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        reload();
    }, [reload]);

    const kpis = data?.kpis;
    const supervisors = useMemo(
        () => (data?.lockerUsers || []).filter((u) => u.role === 'supervisor'),
        [data],
    );
    const collectors = useMemo(
        () => (data?.lockerUsers || []).filter((u) => u.role === 'collector'),
        [data],
    );
    const dash = t('emdash');

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">{t('page.title')}</h2>
                    <p className="wlk-subtitle">{t('page.subtitle')}</p>
                </div>
                <div className="wlk-topbar-actions">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={reload}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        {t('btn.refresh')}
                    </button>
                    <a
                        href="/locker"
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                    >
                        <ExternalLink size={16} /> {t('btn.openPortal')}
                    </a>
                </div>
            </div>

            {error ? <div className="wlk-error">{error}</div> : null}

            <div className="wlk-info">
                <Info size={16} />
                <span>
                    {t('info.before')}{' '}
                    <strong>{t('info.employees')}</strong> {t('info.mid')}{' '}
                    <code>locker_supervisor</code> {t('info.or')}{' '}
                    <code>locker_collector</code>
                    {t('info.afterRoles')} <code>/locker/login</code>.
                </span>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <StatCard
                    icon={Inbox}
                    label={t('kpi.pendingPickups')}
                    value={kpis ? kpis.pendingRequests : dash}
                    hint={t('kpi.pendingPickupsHint')}
                    tone="warn"
                />
                <StatCard
                    icon={UserCheck}
                    label={t('kpi.assigned')}
                    value={kpis ? kpis.assignedRequests : dash}
                    hint={t('kpi.assignedHint')}
                    tone="info"
                />
                <StatCard
                    icon={AlertTriangle}
                    label={t('kpi.overdue')}
                    value={kpis ? kpis.overdueRequests : dash}
                    hint={t('kpi.overdueHint')}
                    tone={kpis && kpis.overdueRequests > 0 ? 'danger' : 'neutral'}
                />
                <StatCard
                    icon={Clock}
                    label={t('kpi.pendingApprovals')}
                    value={kpis ? kpis.pendingApprovals : dash}
                    hint={t('kpi.pendingApprovalsHint')}
                    tone="warn"
                />
                <StatCard
                    icon={CheckCircle}
                    label={t('kpi.collectedToday')}
                    value={kpis ? kpis.collectionsToday : dash}
                />
                <StatCard
                    icon={Banknote}
                    label={t('kpi.monthlyCollected')}
                    value={kpis ? formatMoney(kpis.monthlyCollected, t) : dash}
                    tone="success"
                />
                <StatCard
                    icon={Activity}
                    label={t('kpi.openShiftVariance')}
                    value={kpis ? formatMoney(kpis.openShiftVariance, t) : dash}
                    hint={t('kpi.openShiftVarianceHint')}
                />
                <StatCard
                    icon={Archive}
                    label={t('kpi.vaultBalance')}
                    value={kpis ? formatMoney(kpis.lockerVaultBalance, t) : dash}
                    hint={t('kpi.vaultHint')}
                    tone="info"
                />
            </div>

            <div className="wlk-grid wlk-grid--two">
                <Section title={t('section.supervisors')} count={supervisors.length}>
                    <LockerUsersTable
                        users={supervisors}
                        emptyLabel={t('empty.supervisors')}
                        t={t}
                    />
                </Section>

                <Section title={t('section.collectors')} count={collectors.length}>
                    <LockerUsersTable
                        users={collectors}
                        emptyLabel={t('empty.collectors')}
                        t={t}
                    />
                </Section>
            </div>

            <Section
                title={t('section.recentRequests')}
                count={data?.recentRequests?.length || 0}
            >
                <table className="wlk-table">
                    <thead>
                        <tr>
                            <th>{t('th.reference')}</th>
                            <th>{t('th.branch')}</th>
                            <th>{t('th.cashier')}</th>
                            <th>{t('th.officer')}</th>
                            <th>{t('th.expected')}</th>
                            <th>{t('th.cashDiff')}</th>
                            <th>{t('th.status')}</th>
                            <th>{t('th.created')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data?.recentRequests || []).length === 0 ? (
                            <tr>
                                <td colSpan={8} className="wlk-empty">
                                    {t('empty.requests')}
                                </td>
                            </tr>
                        ) : (
                            data.recentRequests.map((r) => (
                                <tr key={r.id}>
                                    <td>
                                        <code>{r.referenceCode}</code>
                                    </td>
                                    <td>{r.branchName}</td>
                                    <td>{r.cashierName}</td>
                                    <td>{r.assignedOfficerName || dash}</td>
                                    <td>{formatMoney(r.expectedAmount, t)}</td>
                                    <td
                                        className={
                                            num(r.closingCashDiff) === 0
                                                ? ''
                                                : num(r.closingCashDiff) > 0
                                                  ? 'wlk-pos'
                                                  : 'wlk-neg'
                                        }
                                    >
                                        {formatMoney(r.closingCashDiff, t)}
                                    </td>
                                    <td>
                                        <StatusPill
                                            status={
                                                r.collection ? r.collection.status : r.status
                                            }
                                            t={t}
                                        />
                                    </td>
                                    <td>{formatDate(r.createdAt, locale, t)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Section>

            <Section
                title={t('section.recentCollections')}
                count={data?.recentCollections?.length || 0}
            >
                <table className="wlk-table">
                    <thead>
                        <tr>
                            <th>{t('th.reference')}</th>
                            <th>{t('th.branch')}</th>
                            <th>{t('th.cashier')}</th>
                            <th>{t('th.officer')}</th>
                            <th>{t('th.expected')}</th>
                            <th>{t('th.received')}</th>
                            <th>{t('th.difference')}</th>
                            <th>{t('th.status')}</th>
                            <th>{t('th.collected')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data?.recentCollections || []).length === 0 ? (
                            <tr>
                                <td colSpan={9} className="wlk-empty">
                                    {t('empty.collections')}
                                </td>
                            </tr>
                        ) : (
                            data.recentCollections.map((c) => (
                                <tr key={c.id}>
                                    <td>
                                        <code>{c.requestReference}</code>
                                    </td>
                                    <td>{c.branchName}</td>
                                    <td>{c.cashierName}</td>
                                    <td>{c.officerName}</td>
                                    <td>{formatMoney(c.expectedAmount, t)}</td>
                                    <td>{formatMoney(c.receivedAmount, t)}</td>
                                    <td
                                        className={
                                            num(c.difference) === 0
                                                ? ''
                                                : num(c.difference) > 0
                                                  ? 'wlk-pos'
                                                  : 'wlk-neg'
                                        }
                                    >
                                        {formatMoney(c.difference, t)}
                                    </td>
                                    <td>
                                        <StatusPill status={c.status} t={t} />
                                    </td>
                                    <td>{formatDate(c.collectedAt, locale, t)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Section>

            <div className="wlk-grid wlk-grid--two">
                <Section
                    title={t('section.bankDeposits')}
                    count={data?.recentBankDeposits?.length || 0}
                    headerRight={<Send size={14} />}
                >
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>{t('th.reference')}</th>
                                <th>{t('th.register')}</th>
                                <th>{t('th.branch')}</th>
                                <th>{t('th.amount')}</th>
                                <th>{t('th.date')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.recentBankDeposits || []).length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="wlk-empty">
                                        {t('empty.bankDeposits')}
                                    </td>
                                </tr>
                            ) : (
                                data.recentBankDeposits.map((d) => (
                                    <tr key={d.id}>
                                        <td>
                                            <code>{d.reference || dash}</code>
                                        </td>
                                        <td>{d.registerName || dash}</td>
                                        <td>{d.branchName || dash}</td>
                                        <td>{formatMoney(d.amount, t)}</td>
                                        <td>{formatDate(d.entryDate, locale, t)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Section>

                <Section
                    title={t('section.pettyCash')}
                    count={data?.recentPettyCashIssues?.length || 0}
                    headerRight={<Coins size={14} />}
                >
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>{t('th.cashier')}</th>
                                <th>{t('th.amount')}</th>
                                <th>{t('th.description')}</th>
                                <th>{t('th.date')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.recentPettyCashIssues || []).length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="wlk-empty">
                                        {t('empty.pettyCash')}
                                    </td>
                                </tr>
                            ) : (
                                data.recentPettyCashIssues.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.cashierName || dash}</td>
                                        <td>{formatMoney(p.amount, t)}</td>
                                        <td>{p.description || dash}</td>
                                        <td>{formatDate(p.createdAt, locale, t)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Section>
            </div>
        </div>
    );
}
