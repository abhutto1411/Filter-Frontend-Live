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
import './Workshop.css';

const num = (v) => Number(v ?? 0);

function formatSar(value) {
    const n = num(value);
    return `SAR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('en-US', {
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

function LockerUsersTable({ users, emptyLabel }) {
    return (
        <table className="wlk-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Status</th>
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
                            <td>{u.name || '—'}</td>
                            <td>{u.email || '—'}</td>
                            <td>{u.mobile || '—'}</td>
                            <td>
                                {u.isActive ? (
                                    <StatusPill status="approved" />
                                ) : (
                                    <StatusPill status="rejected" />
                                )}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
}

function StatusPill({ status }) {
    const map = {
        pending: { label: 'Pending', cls: 'wlk-pill wlk-pill--warn' },
        assigned: { label: 'Assigned', cls: 'wlk-pill wlk-pill--info' },
        collected: { label: 'Collected', cls: 'wlk-pill wlk-pill--success' },
        pending_approval: { label: 'Awaiting Approval', cls: 'wlk-pill wlk-pill--warn' },
        approved: { label: 'Approved', cls: 'wlk-pill wlk-pill--success' },
        rejected: { label: 'Rejected', cls: 'wlk-pill wlk-pill--danger' },
    };
    const cfg = map[status] || { label: status || '—', cls: 'wlk-pill' };
    return <span className={cfg.cls}>{cfg.label}</span>;
}

export default function WorkshopLockerManagement() {
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
                throw new Error(res?.message || 'Failed to load locker overview');
            }
            setData(res);
        } catch (e) {
            setError(e?.message || 'Failed to load locker overview');
        } finally {
            setLoading(false);
        }
    }, []);

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

    return (
        <div className="wlk-page">
            <div className="wlk-topbar">
                <div>
                    <h2 className="wlk-title">Locker Management</h2>
                    <p className="wlk-subtitle">
                        Live view of the locker portal — cash collections from cashiers,
                        bank deposits, petty-cash float, and locker staff accounts.
                    </p>
                </div>
                <div className="wlk-topbar-actions">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={reload}
                        disabled={loading}
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                    <a
                        href="/locker"
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                    >
                        <ExternalLink size={16} /> Open Locker Portal
                    </a>
                </div>
            </div>

            {error ? <div className="wlk-error">{error}</div> : null}

            <div className="wlk-info">
                <Info size={16} />
                <span>
                    Locker supervisors and collectors are created from the{' '}
                    <strong>Employees</strong> page (set role to{' '}
                    <code>locker_supervisor</code> or <code>locker_collector</code>). They
                    appear here automatically and sign in at{' '}
                    <code>/locker/login</code>.
                </span>
            </div>

            <div className="wlk-grid wlk-grid--kpi">
                <StatCard
                    icon={Inbox}
                    label="Pending pickups"
                    value={kpis ? kpis.pendingRequests : '—'}
                    hint="Cashier closings awaiting an officer"
                    tone="warn"
                />
                <StatCard
                    icon={UserCheck}
                    label="Assigned to officer"
                    value={kpis ? kpis.assignedRequests : '—'}
                    hint="On-the-way collections"
                    tone="info"
                />
                <StatCard
                    icon={AlertTriangle}
                    label="Overdue (>24h)"
                    value={kpis ? kpis.overdueRequests : '—'}
                    hint="Open longer than 24h"
                    tone={kpis && kpis.overdueRequests > 0 ? 'danger' : 'neutral'}
                />
                <StatCard
                    icon={Clock}
                    label="Pending approvals"
                    value={kpis ? kpis.pendingApprovals : '—'}
                    hint="Variance awaiting supervisor"
                    tone="warn"
                />
                <StatCard
                    icon={CheckCircle}
                    label="Collected today"
                    value={kpis ? kpis.collectionsToday : '—'}
                />
                <StatCard
                    icon={Banknote}
                    label="Monthly collected"
                    value={kpis ? formatSar(kpis.monthlyCollected) : '—'}
                    tone="success"
                />
                <StatCard
                    icon={Activity}
                    label="Open-shift variance"
                    value={kpis ? formatSar(kpis.openShiftVariance) : '—'}
                    hint="Sum of |cashDiff| on open shifts"
                />
                <StatCard
                    icon={Archive}
                    label="Locker vault balance"
                    value={kpis ? formatSar(kpis.lockerVaultBalance) : '—'}
                    hint="1004 Cash in Transit — Locker"
                    tone="info"
                />
            </div>

            <div className="wlk-grid wlk-grid--two">
                <Section
                    title="Locker supervisors"
                    count={supervisors.length}
                >
                    <LockerUsersTable users={supervisors} emptyLabel="No supervisor created yet" />
                </Section>

                <Section title="Collection officers" count={collectors.length}>
                    <LockerUsersTable users={collectors} emptyLabel="No collectors created yet" />
                </Section>
            </div>

            <Section
                title="Recent collection requests"
                count={data?.recentRequests?.length || 0}
            >
                <table className="wlk-table">
                    <thead>
                        <tr>
                            <th>Reference</th>
                            <th>Branch</th>
                            <th>Cashier</th>
                            <th>Officer</th>
                            <th>Expected</th>
                            <th>Cash Diff (closing)</th>
                            <th>Status</th>
                            <th>Created</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data?.recentRequests || []).length === 0 ? (
                            <tr>
                                <td colSpan={8} className="wlk-empty">
                                    No collection requests yet
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
                                    <td>{r.assignedOfficerName || '—'}</td>
                                    <td>{formatSar(r.expectedAmount)}</td>
                                    <td
                                        className={
                                            num(r.closingCashDiff) === 0
                                                ? ''
                                                : num(r.closingCashDiff) > 0
                                                ? 'wlk-pos'
                                                : 'wlk-neg'
                                        }
                                    >
                                        {formatSar(r.closingCashDiff)}
                                    </td>
                                    <td>
                                        <StatusPill
                                            status={
                                                r.collection ? r.collection.status : r.status
                                            }
                                        />
                                    </td>
                                    <td>{formatDate(r.createdAt)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Section>

            <Section
                title="Recent collections (cashier → locker)"
                count={data?.recentCollections?.length || 0}
            >
                <table className="wlk-table">
                    <thead>
                        <tr>
                            <th>Reference</th>
                            <th>Branch</th>
                            <th>Cashier</th>
                            <th>Officer</th>
                            <th>Expected</th>
                            <th>Received</th>
                            <th>Difference</th>
                            <th>Status</th>
                            <th>Collected</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(data?.recentCollections || []).length === 0 ? (
                            <tr>
                                <td colSpan={9} className="wlk-empty">
                                    No collections recorded yet
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
                                    <td>{formatSar(c.expectedAmount)}</td>
                                    <td>{formatSar(c.receivedAmount)}</td>
                                    <td
                                        className={
                                            num(c.difference) === 0
                                                ? ''
                                                : num(c.difference) > 0
                                                ? 'wlk-pos'
                                                : 'wlk-neg'
                                        }
                                    >
                                        {formatSar(c.difference)}
                                    </td>
                                    <td>
                                        <StatusPill status={c.status} />
                                    </td>
                                    <td>{formatDate(c.collectedAt)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Section>

            <div className="wlk-grid wlk-grid--two">
                <Section
                    title="Bank deposits (locker → bank)"
                    count={data?.recentBankDeposits?.length || 0}
                    headerRight={<Send size={14} />}
                >
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>Reference</th>
                                <th>Register</th>
                                <th>Branch</th>
                                <th>Amount</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.recentBankDeposits || []).length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="wlk-empty">
                                        No bank deposits yet
                                    </td>
                                </tr>
                            ) : (
                                data.recentBankDeposits.map((d) => (
                                    <tr key={d.id}>
                                        <td>
                                            <code>{d.reference || '—'}</code>
                                        </td>
                                        <td>{d.registerName || '—'}</td>
                                        <td>{d.branchName || '—'}</td>
                                        <td>{formatSar(d.amount)}</td>
                                        <td>{formatDate(d.entryDate)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </Section>

                <Section
                    title="Petty cash issued from locker"
                    count={data?.recentPettyCashIssues?.length || 0}
                    headerRight={<Coins size={14} />}
                >
                    <table className="wlk-table">
                        <thead>
                            <tr>
                                <th>Cashier</th>
                                <th>Amount</th>
                                <th>Description</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(data?.recentPettyCashIssues || []).length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="wlk-empty">
                                        No petty cash float issued yet
                                    </td>
                                </tr>
                            ) : (
                                data.recentPettyCashIssues.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.cashierName || '—'}</td>
                                        <td>{formatSar(p.amount)}</td>
                                        <td>{p.description || '—'}</td>
                                        <td>{formatDate(p.createdAt)}</td>
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
