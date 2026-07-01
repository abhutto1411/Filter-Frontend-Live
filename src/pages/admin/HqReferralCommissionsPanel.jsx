import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BookOpen,
    CheckCircle,
    Clock,
    ExternalLink,
    RefreshCw,
    Users,
} from 'lucide-react';
import {
    marketingGetReferralCommissionsDashboard,
    marketingListReferralCommissions,
    marketingMatureReferralCommission,
    marketingPayReferralCommission,
} from '../../services/superAdminMarketingApi';
import '../../styles/admin/ReferralCommissionsPage.css';

const fmt = (n) =>
    new Intl.NumberFormat('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        Number(n || 0),
    );

const fmtDate = (d) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return String(d);
    }
};

function normalizeCommission(row) {
    return {
        id: String(row.id ?? ''),
        referralId: String(row.referralId ?? row.referrerId ?? ''),
        referrerName: row.referrerName ?? row.referrer_name ?? row.referrer ?? '—',
        status: String(row.status ?? 'pending').toLowerCase(),
        amount: Number(row.amount ?? 0),
        currencyCode: row.currencyCode ?? row.currency_code ?? 'SAR',
        description: row.description ?? '',
        maturedAt: row.maturedAt ?? row.matured_at ?? null,
        paidAt: row.paidAt ?? row.paid_at ?? null,
        createdAt: row.createdAt ?? row.created_at ?? null,
    };
}

function StatCard({ label, value, icon: Icon, tone }) {
    const tones = {
        amber: { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
        green: { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
        indigo: { bg: '#EEF2FF', color: '#4F46E5', border: '#C7D2FE' },
    };
    const t = tones[tone] || tones.indigo;
    return (
        <div
            className="stat-card"
            style={{ borderColor: t.border, background: '#fff' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: t.bg,
                        color: t.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Icon size={22} />
                </div>
                <div>
                    <span className="stat-label">{label}</span>
                    <span className="stat-value">SAR {fmt(value)}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * HQ accounting — referrer / referral commissions wired to super-admin marketing APIs
 * and HQ GL (Referral Commission Expense / Payable).
 */
export default function HqReferralCommissionsPanel({ hqWorkshopId }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [summary, setSummary] = useState({
        pendingCommission: 0,
        availableCommission: 0,
        paidCommission: 0,
        totalReferrals: 0,
    });
    const [rows, setRows] = useState([]);
    const [actionId, setActionId] = useState('');

    const reload = useCallback(async () => {
        if (!hqWorkshopId) {
            setLoading(false);
            setRows([]);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const [dashRes, listRes] = await Promise.all([
                marketingGetReferralCommissionsDashboard({
                    workshopId: hqWorkshopId,
                    tableLimit: 200,
                }),
                marketingListReferralCommissions({
                    workshopId: hqWorkshopId,
                    limit: 200,
                    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
                }),
            ]);

            const dashSummary = dashRes?.summary ?? dashRes?.data?.summary ?? {};
            const payable = dashRes?.payableSummary ?? dashRes?.rows ?? [];
            setSummary({
                pendingCommission: Number(
                    dashSummary.pendingCommission ?? dashSummary.pending ?? 0,
                ),
                availableCommission: Number(
                    dashSummary.availableCommission ??
                        dashSummary.totalPayable ??
                        dashSummary.available ??
                        0,
                ),
                paidCommission: Number(
                    dashSummary.paidCommission ?? dashSummary.totalPaid ?? 0,
                ),
                totalReferrals: Array.isArray(payable) ? payable.length : 0,
            });

            const list =
                listRes?.commissions ??
                listRes?.data?.commissions ??
                listRes?.items ??
                [];
            setRows(Array.isArray(list) ? list.map(normalizeCommission) : []);
        } catch (e) {
            setError(e?.message || 'Failed to load referral commissions');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [hqWorkshopId, statusFilter]);

    useEffect(() => {
        reload();
    }, [reload]);

    const filteredRows = useMemo(() => {
        if (statusFilter === 'all') return rows;
        return rows.filter((r) => r.status === statusFilter);
    }, [rows, statusFilter]);

    const handleMature = async (id) => {
        setActionId(id);
        setError('');
        try {
            await marketingMatureReferralCommission(id);
            await reload();
        } catch (e) {
            setError(e?.message || 'Could not mature commission');
        } finally {
            setActionId('');
        }
    };

    const handlePay = async (id) => {
        setActionId(id);
        setError('');
        try {
            await marketingPayReferralCommission(id, { payFrom: 'cash' });
            await reload();
        } catch (e) {
            setError(e?.message || 'Could not pay commission');
        } finally {
            setActionId('');
        }
    };

    const canMature = (status) =>
        !['paid', 'matured', 'approved', 'available'].includes(status);
    const canPay = (status) =>
        ['matured', 'approved', 'available'].includes(status);

    return (
        <div className="commissions-page">
            <header className="commissions-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h2 className="commissions-title">Referral Commission</h2>
                        <p className="commissions-subtitle">
                            Platform HQ referrer payouts — posts to Chart of Accounts (
                            <strong>6610 Referral Commission Expense</strong> /{' '}
                            <strong>2210 Referral Commission Payable</strong>). Aligned with Referrer
                            Portal APIs for future self-service.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Link
                            to="/admin/referrer-management"
                            className="btn-portal-outline"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <Users size={14} /> Referrer Management
                        </Link>
                        <Link
                            to="/referral-management"
                            className="btn-portal-outline"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <ExternalLink size={14} /> Referral Portal
                        </Link>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={reload}
                            disabled={loading}
                        >
                            <RefreshCw size={14} style={{ marginRight: 6 }} /> Refresh
                        </button>
                    </div>
                </div>
            </header>

            <div
                style={{
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    marginBottom: 16,
                }}
            >
                <BookOpen size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 13, color: '#1E40AF', lineHeight: 1.5 }}>
                    Mature pending commissions to accrue expense & payable on HQ books. Pay clears
                    payable against HQ cash/bank. Same records power the Referrer Portal when launched.
                </p>
            </div>

            {error ? (
                <p style={{ color: '#B45309', marginBottom: 12 }}>{error}</p>
            ) : null}

            <div className="commissions-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <StatCard
                    label="Pending"
                    value={summary.pendingCommission}
                    icon={Clock}
                    tone="amber"
                />
                <StatCard
                    label="Available to pay"
                    value={summary.availableCommission}
                    icon={CheckCircle}
                    tone="green"
                />
                <StatCard
                    label="Paid"
                    value={summary.paidCommission}
                    icon={BookOpen}
                    tone="indigo"
                />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <select
                    className="form-input-field"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ minWidth: 160 }}
                >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="matured">Matured / available</option>
                    <option value="paid">Paid</option>
                </select>
            </div>

            <div className="commissions-table-container">
                <table className="commissions-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Referrer</th>
                            <th>Description</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                                    Loading…
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>
                                    No referral commission records yet.
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map((row) => (
                                <tr key={row.id}>
                                    <td>{fmtDate(row.createdAt)}</td>
                                    <td style={{ fontWeight: 600 }}>{row.referrerName}</td>
                                    <td>{row.description || '—'}</td>
                                    <td style={{ fontWeight: 700 }}>
                                        {row.currencyCode} {fmt(row.amount)}
                                    </td>
                                    <td>
                                        <span
                                            className={`status-badge ${row.status === 'paid' ? 'paid' : 'accrued'}`}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {canMature(row.status) ? (
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    disabled={actionId === row.id}
                                                    onClick={() => handleMature(row.id)}
                                                >
                                                    Mature
                                                </button>
                                            ) : null}
                                            {canPay(row.status) ? (
                                                <button
                                                    type="button"
                                                    className="btn-submit btn-dark"
                                                    disabled={actionId === row.id}
                                                    onClick={() => handlePay(row.id)}
                                                >
                                                    Pay
                                                </button>
                                            ) : null}
                                        </div>
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
