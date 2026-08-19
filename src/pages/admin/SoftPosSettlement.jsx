import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
    CreditCard,
    RefreshCw,
    Plus,
    Pencil,
    Trash2,
    X,
    DollarSign,
    Banknote,
    ArrowDownToLine,
    Receipt,
    Settings,
    Search,
} from 'lucide-react';
import {
    createSoftPosRule,
    createSoftPosTerminal,
    deleteSoftPosRule,
    deleteSoftPosTerminal,
    getSoftPosStats,
    listSoftPosBatches,
    listSoftPosRules,
    listSoftPosTerminals,
    listSoftPosTransactions,
    refundSoftPosTransaction,
    updateSoftPosRule,
    updateSoftPosTerminal,
} from '../../services/softPosApi';
import {
    previewSettlement,
    listSettlements,
    generateSettlement,
} from '../../services/settlementApi';
import { useAuth } from '../../context/AuthContext';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import { softPosT } from '../../utils/softPosSettlementI18n';

const SAR = (n) => `SAR ${(Number(n) || 0).toFixed(2)}`;

const TABS = [
    { key: 'transactions', labelKey: 'tab.transactions', icon: Receipt,         permission: 'softpos-settlement.transactions.view' },
    { key: 'terminals',    labelKey: 'tab.terminals',    icon: CreditCard,      permission: 'softpos-settlement.terminals.view' },
    { key: 'batches',      labelKey: 'tab.batches',      icon: ArrowDownToLine, permission: 'softpos-settlement.batches.view' },
    { key: 'hqsettlement', labelKey: 'tab.hqsettlement', icon: Banknote,        permission: 'softpos-settlement.batches.view' },
    { key: 'rules',        labelKey: 'tab.rules',        icon: Settings,        permission: 'softpos-settlement.rules.view' },
    { key: 'refunds',      labelKey: 'tab.refunds',      icon: RefreshCw,       permission: 'softpos-settlement.refunds.view' },
];

const card = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 16,
};

const inputStyle = {
    width: '100%',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
};

const btn = {
    border: '1px solid #e5e7eb',
    background: '#fff',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
    color: '#111827',
};

const btnPrimary = {
    ...btn,
    background: '#D4A017',
    color: '#fff',
    border: 'none',
    fontWeight: 600,
};

const STATUS_COLORS = {
    captured: { bg: '#dbeafe', color: '#1d4ed8' },
    settled: { bg: '#dcfce7', color: '#16a34a' },
    refund: { bg: '#fef3c7', color: '#92400e' },
    refunded: { bg: '#fee2e2', color: '#dc2626' },
    partial_refund: { bg: '#fef3c7', color: '#92400e' },
};

function pickArr(res, key = 'items') {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res[key])) return res[key];
    if (Array.isArray(res.data?.[key])) return res.data[key];
    if (Array.isArray(res.data)) return res.data;
    return [];
}

function statusLabel(t, status) {
    if (status == null || status === '') return t('common.emDash');
    const key = `status.${status}`;
    const translated = t(key);
    return translated === key ? status : translated;
}

export default function SoftPosSettlement() {
    const { hasPermission } = useAuth();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => softPosT(locale, key, vars), [locale]);
    const [searchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab') || '';
    const visibleTabs = TABS.filter((tab) => hasPermission(tab.permission));
    const [activeTab, setActiveTab] = useState(() => visibleTabs[0]?.key ?? 'transactions');
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState('');

    // Auto-snap to first allowed tab if current becomes hidden.
    useEffect(() => {
        if (visibleTabs.length === 0) return;
        if (!visibleTabs.some((tab) => tab.key === activeTab)) {
            setActiveTab(visibleTabs[0].key);
        }
    }, [visibleTabs, activeTab]);

    useEffect(() => {
        if (!tabFromUrl) return;
        if (visibleTabs.some((tab) => tab.key === tabFromUrl)) {
            setActiveTab(tabFromUrl);
        }
    }, [tabFromUrl, visibleTabs]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getSoftPosStats();
                if (!cancelled) setStats(res);
            } catch (err) {
                if (!cancelled) setError(err?.message || t('err.loadStats'));
            } finally {
                if (!cancelled) setStatsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeTab, t]);

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <CreditCard size={24} />
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                    {t('page.title')}
                </h1>
            </div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                {t('page.subtitle')}
            </p>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 12,
                    marginTop: 16,
                    marginBottom: 16,
                }}
            >
                <SummaryCard
                    label={t('kpi.activeTerminals')}
                    value={statsLoading ? '...' : (stats?.activeTerminals ?? 0)}
                    icon={<CreditCard size={18} color="#1d4ed8" />}
                    color="#1d4ed8"
                />
                <SummaryCard
                    label={t('kpi.capturedVolume')}
                    value={statsLoading ? '...' : SAR(stats?.gross || 0)}
                    icon={<DollarSign size={18} color="#16a34a" />}
                    color="#16a34a"
                />
                <SummaryCard
                    label={t('kpi.platformIncome')}
                    value={statsLoading ? '...' : SAR(stats?.platformIncome || 0)}
                    icon={<Banknote size={18} color="#D4A017" />}
                    color="#D4A017"
                />
                <SummaryCard
                    label={t('kpi.refunds')}
                    value={statsLoading ? '...' : `${stats?.refundsCount ?? 0} · ${SAR(stats?.refundsAmount || 0)}`}
                    icon={<RefreshCw size={18} color="#dc2626" />}
                    color="#dc2626"
                />
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: 16,
                    borderBottom: '1px solid #e5e7eb',
                    marginBottom: 16,
                    background: '#fff',
                    padding: '0 16px',
                    borderRadius: '10px 10px 0 0',
                    border: '1px solid #e5e7eb',
                    borderBottomColor: '#e5e7eb',
                }}
            >
                {visibleTabs.map((tab) => {
                    const active = tab.key === activeTab;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: active ? '#111827' : '#6b7280',
                                fontWeight: active ? 700 : 500,
                                padding: '12px 0',
                                cursor: 'pointer',
                                borderBottom: active ? '3px solid #D4A017' : '3px solid transparent',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <Icon size={16} />
                            {t(tab.labelKey)}
                        </button>
                    );
                })}
            </div>

            {error && (
                <div
                    style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        padding: '8px 12px',
                        borderRadius: 6,
                        marginBottom: 12,
                        fontSize: 13,
                    }}
                >
                    {error}
                </div>
            )}

            {activeTab === 'transactions' && hasPermission('softpos-settlement.transactions.view') && <TransactionsTab onError={setError} t={t} />}
            {activeTab === 'terminals'    && hasPermission('softpos-settlement.terminals.view')    && <TerminalsTab onError={setError} t={t} />}
            {activeTab === 'batches'      && hasPermission('softpos-settlement.batches.view')      && <BatchesTab onError={setError} t={t} />}
            {activeTab === 'hqsettlement' && hasPermission('softpos-settlement.batches.view')      && <HqSettlementTab onError={setError} t={t} />}
            {activeTab === 'rules'        && hasPermission('softpos-settlement.rules.view')        && <RulesTab onError={setError} t={t} />}
            {activeTab === 'refunds'      && hasPermission('softpos-settlement.refunds.view')      && <RefundsTab onError={setError} t={t} />}
            {visibleTabs.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                    {t('page.noPerm')}
                </div>
            )}
        </div>
    );
}

function SummaryCard({ label, value, icon, color }) {
    return (
        <div style={{ ...card, borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 12 }}>
                {icon}
                {label}
            </div>
            <div style={{ marginTop: 6, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{value}</div>
        </div>
    );
}

// ===== Transactions =====
function TransactionsTab({ onError, t }) {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [totals, setTotals] = useState({ gross: 0, bankFee: 0, platformFee: 0, netToMerchant: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        workshopId: '',
        branchId: '',
        terminalId: '',
        status: '',
        fromDate: '',
        toDate: '',
        search: '',
    });
    const [reload, setReload] = useState(0);
    const [refundOpen, setRefundOpen] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await listSoftPosTransactions({ ...filters, limit: 100 });
                if (cancelled) return;
                setRows(pickArr(res, 'items'));
                setTotal(Number(res?.total || 0));
                setTotals(res?.totals || {});
            } catch (err) {
                if (!cancelled) onError(err?.message || t('err.loadTransactions'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const headers = [
        'th.captured',
        'th.terminal',
        'th.workshopBranch',
        'th.invoice',
        'th.gross',
        'th.bankFee',
        'th.platform',
        'th.net',
        'th.status',
        'th.actions',
    ];

    if (refundOpen) {
        return (
            <RefundModal
                transaction={refundOpen}
                t={t}
                onClose={() => setRefundOpen(null)}
                onDone={() => {
                    setRefundOpen(null);
                    setReload((x) => x + 1);
                }}
            />
        );
    }

    return (
        <div style={card}>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, minmax(120px, 1fr)) auto',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 12,
                }}
            >
                <input
                    placeholder={t('tx.ph.searchRef')}
                    value={filters.search}
                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder={t('tx.ph.workshopId')}
                    value={filters.workshopId}
                    onChange={(e) => setFilters((p) => ({ ...p, workshopId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder={t('tx.ph.branchId')}
                    value={filters.branchId}
                    onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder={t('tx.ph.terminalId')}
                    value={filters.terminalId}
                    onChange={(e) => setFilters((p) => ({ ...p, terminalId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))}
                    style={inputStyle}
                />
                <button type="button" style={btnPrimary} onClick={() => setReload((x) => x + 1)}>
                    {t('common.apply')}
                </button>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 8,
                    marginBottom: 12,
                    fontSize: 13,
                    color: '#374151',
                }}
            >
                <div>
                    <strong>{t('tx.gross')}</strong> {SAR(totals.gross)}
                </div>
                <div>
                    <strong>{t('tx.bankFee')}</strong> {SAR(totals.bankFee)}
                </div>
                <div>
                    <strong>{t('tx.platformFee')}</strong> {SAR(totals.platformFee)}
                </div>
                <div>
                    <strong>{t('tx.netToMerchants')}</strong> {SAR(totals.netToMerchant)}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {headers.map((h) => (
                                <th
                                    key={h}
                                    style={{
                                        textAlign: 'left',
                                        padding: '8px 10px',
                                        fontSize: 11,
                                        color: '#6b7280',
                                        borderBottom: '1px solid #e5e7eb',
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                    }}
                                >
                                    {t(h)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={10} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={10} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('tx.empty')}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => {
                                const sc = STATUS_COLORS[r.status] || { bg: '#e5e7eb', color: '#374151' };
                                return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                            {r.capturedAt ? new Date(r.capturedAt).toLocaleString() : t('common.emDash')}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            <div style={{ fontWeight: 600 }}>{r.terminalCode || t('common.emDash')}</div>
                                            {r.terminalLabel && (
                                                <div style={{ color: '#6b7280', fontSize: 11 }}>{r.terminalLabel}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            <div>{r.workshopName || t('common.emDash')}</div>
                                            <div style={{ color: '#6b7280', fontSize: 11 }}>{r.branchName || t('common.emDash')}</div>
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            {r.invoiceNo || r.reference || t('common.emDash')}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>
                                            {SAR(r.gross)}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, color: '#dc2626' }}>
                                            {SAR(r.bankFee)}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, color: '#16a34a' }}>
                                            {SAR(r.platformFee)}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>
                                            {SAR(r.netToMerchant)}
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <span
                                                style={{
                                                    background: sc.bg,
                                                    color: sc.color,
                                                    padding: '2px 8px',
                                                    borderRadius: 999,
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {statusLabel(t, r.status)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                            {r.status !== 'refund' && r.status !== 'refunded' && (
                                                <button
                                                    type="button"
                                                    style={{
                                                        ...btn,
                                                        color: '#dc2626',
                                                        borderColor: '#fee2e2',
                                                        fontSize: 12,
                                                    }}
                                                    onClick={() => setRefundOpen(r)}
                                                >
                                                    {t('tx.refund')}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>
                {t('tx.showing', { n: rows.length, total })}
            </div>
        </div>
    );
}

function RefundModal({ transaction, onClose, onDone, t }) {
    const [amount, setAmount] = useState(Number(transaction.gross || 0));
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        setSubmitting(true);
        setErr('');
        try {
            await refundSoftPosTransaction(transaction.id, {
                amount: Number(amount) || undefined,
                reason: reason?.trim() || undefined,
            });
            onDone();
        } catch (e) {
            setErr(e?.message || t('err.refundFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AdminModalAsScreen title={t('refund.title', { ref: transaction.reference || transaction.id })} onClose={onClose}>
            <div style={{ display: 'grid', gap: 10 }}>
                <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>{t('refund.amount')}</label>
                    <input
                        type="number"
                        step="0.01"
                        max={Number(transaction.gross)}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                        {t('refund.max', { amount: SAR(transaction.gross) })}
                    </div>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>{t('refund.reason')}</label>
                    <textarea
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        style={{ ...inputStyle, resize: 'vertical' }}
                    />
                </div>
                {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" style={btn} onClick={onClose} disabled={submitting}>
                        {t('common.cancel')}
                    </button>
                    <button type="button" style={btnPrimary} onClick={submit} disabled={submitting}>
                        {submitting ? t('common.submitting') : t('refund.submit')}
                    </button>
                </div>
            </div>
        </AdminModalAsScreen>
    );
}

// ===== Terminals =====
function TerminalsTab({ onError, t }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [reload, setReload] = useState(0);
    const [editing, setEditing] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await listSoftPosTerminals({ search });
                if (!cancelled) setRows(pickArr(res));
            } catch (err) {
                if (!cancelled) onError(err?.message || t('err.loadTerminals'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const onDelete = async (id) => {
        if (!window.confirm(t('term.confirmDelete'))) return;
        try {
            await deleteSoftPosTerminal(id);
            setReload((x) => x + 1);
        } catch (e) {
            onError(e?.message || t('err.deleteFailed'));
        }
    };

    const headers = [
        'th.terminalCode',
        'th.merchant',
        'th.workshopBranch',
        'th.bankAc',
        'th.bankPct',
        'th.platformPct',
        'th.status',
        'th.actions',
    ];

    if (editing) {
        return (
            <TerminalModal
                initial={editing.id ? editing : {}}
                t={t}
                onClose={() => setEditing(null)}
                onDone={() => {
                    setEditing(null);
                    setReload((x) => x + 1);
                }}
                onError={onError}
            />
        );
    }

    return (
        <div style={card}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <Search
                        size={14}
                        color="#6b7280"
                        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                        placeholder={t('term.ph.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') setReload((x) => x + 1);
                        }}
                        style={{ ...inputStyle, paddingLeft: 32 }}
                    />
                </div>
                <button type="button" style={btn} onClick={() => setReload((x) => x + 1)}>
                    {t('common.apply')}
                </button>
                <button
                    type="button"
                    style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setEditing({})}
                >
                    <Plus size={14} /> {t('term.new')}
                </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {headers.map((h) => (
                                <th
                                    key={h}
                                    style={{
                                        textAlign: 'left',
                                        padding: '8px 10px',
                                        fontSize: 11,
                                        color: '#6b7280',
                                        borderBottom: '1px solid #e5e7eb',
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                    }}
                                >
                                    {t(h)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('term.empty')}
                                </td>
                            </tr>
                        ) : (
                            rows.map((term) => (
                                <tr key={term.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>
                                        {term.terminalCode}
                                        {term.label && (
                                            <div style={{ color: '#6b7280', fontSize: 11 }}>{term.label}</div>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{term.merchantCode}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        <div>{term.workshopName || t('common.emDash')}</div>
                                        <div style={{ color: '#6b7280', fontSize: 11 }}>{term.branchName || t('common.emDash')}</div>
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {term.bankCashBankAccountName || t('common.emDash')}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {term.bankFeePercent != null ? `${term.bankFeePercent}%` : t('common.emDash')}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {term.platformFeePercent != null ? `${term.platformFeePercent}%` : t('common.emDash')}
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <span
                                            style={{
                                                background: term.status === 'active' ? '#dcfce7' : '#fee2e2',
                                                color: term.status === 'active' ? '#16a34a' : '#dc2626',
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {statusLabel(t, term.status)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <div style={{ display: 'inline-flex', gap: 12 }}>
                                            <button
                                                type="button"
                                                style={{ ...btn, border: 'none', padding: 0 }}
                                                title={t('common.edit')}
                                                onClick={() => setEditing(term)}
                                            >
                                                <Pencil size={14} color="#6b7280" />
                                            </button>
                                            <button
                                                type="button"
                                                style={{ ...btn, border: 'none', padding: 0 }}
                                                title={t('common.delete')}
                                                onClick={() => onDelete(term.id)}
                                            >
                                                <Trash2 size={14} color="#dc2626" />
                                            </button>
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

function TerminalModal({ initial = {}, onClose, onDone, onError, t }) {
    const [form, setForm] = useState({
        workshopId: initial.workshopId || '',
        branchId: initial.branchId || '',
        merchantCode: initial.merchantCode || '',
        terminalCode: initial.terminalCode || '',
        label: initial.label || '',
        bankCashBankAccountId: initial.bankCashBankAccountId || '',
        bankFeePercent: initial.bankFeePercent ?? '',
        platformFeePercent: initial.platformFeePercent ?? '',
        status: initial.status || 'active',
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        setSaving(true);
        setErr('');
        try {
            const payload = {
                ...form,
                bankCashBankAccountId: form.bankCashBankAccountId || null,
                bankFeePercent: form.bankFeePercent === '' ? null : Number(form.bankFeePercent),
                platformFeePercent:
                    form.platformFeePercent === '' ? null : Number(form.platformFeePercent),
            };
            if (initial.id) {
                await updateSoftPosTerminal(initial.id, payload);
            } else {
                await createSoftPosTerminal(payload);
            }
            onDone();
        } catch (e) {
            setErr(e?.message || t('err.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminModalAsScreen title={initial.id ? t('term.editTitle') : t('term.newTitle')} onClose={onClose}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label={t('term.workshopId')}>
                    <input
                        value={form.workshopId}
                        onChange={(e) => setForm((p) => ({ ...p, workshopId: e.target.value }))}
                        style={inputStyle}
                        disabled={!!initial.id}
                    />
                </Field>
                <Field label={t('term.branchId')}>
                    <input
                        value={form.branchId}
                        onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                        style={inputStyle}
                        disabled={!!initial.id}
                    />
                </Field>
                <Field label={t('term.merchantCode')}>
                    <input
                        value={form.merchantCode}
                        onChange={(e) => setForm((p) => ({ ...p, merchantCode: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('term.terminalCode')}>
                    <input
                        value={form.terminalCode}
                        onChange={(e) => setForm((p) => ({ ...p, terminalCode: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('term.label')} full>
                    <input
                        value={form.label}
                        onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('term.bankCashBankAccountId')}>
                    <input
                        value={form.bankCashBankAccountId}
                        onChange={(e) =>
                            setForm((p) => ({ ...p, bankCashBankAccountId: e.target.value }))
                        }
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('term.status')}>
                    <select
                        value={form.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                        style={inputStyle}
                    >
                        <option value="active">{t('status.active')}</option>
                        <option value="inactive">{t('status.inactive')}</option>
                    </select>
                </Field>
                <Field label={t('term.bankFeeOverride')}>
                    <input
                        type="number"
                        step="0.0001"
                        value={form.bankFeePercent}
                        onChange={(e) => setForm((p) => ({ ...p, bankFeePercent: e.target.value }))}
                        style={inputStyle}
                        placeholder={t('term.ph.defaultRule')}
                    />
                </Field>
                <Field label={t('term.platformFeeOverride')}>
                    <input
                        type="number"
                        step="0.0001"
                        value={form.platformFeePercent}
                        onChange={(e) =>
                            setForm((p) => ({ ...p, platformFeePercent: e.target.value }))
                        }
                        style={inputStyle}
                        placeholder={t('term.ph.defaultRule')}
                    />
                </Field>
                {err && <div style={{ gridColumn: 'span 2', color: '#dc2626', fontSize: 13 }}>{err}</div>}
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" style={btn} onClick={onClose} disabled={saving}>
                        {t('common.cancel')}
                    </button>
                    <button type="button" style={btnPrimary} onClick={submit} disabled={saving}>
                        {saving ? t('common.saving') : initial.id ? t('common.update') : t('common.create')}
                    </button>
                </div>
            </div>
        </AdminModalAsScreen>
    );
}

// ===== Batches =====
function BatchesTab({ onError, t }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ workshopId: '', branchId: '', fromDate: '', toDate: '' });
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await listSoftPosBatches(filters);
                if (!cancelled) setRows(Array.isArray(res) ? res : []);
            } catch (err) {
                if (!cancelled) onError(err?.message || t('err.loadBatches'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const headers = [
        'th.date',
        'th.terminal',
        'th.workshop',
        'th.branch',
        'th.count',
        'th.gross',
        'th.bankFee',
        'th.platform',
        'th.net',
    ];

    return (
        <div style={card}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <input
                    placeholder={t('tx.ph.workshopId')}
                    value={filters.workshopId}
                    onChange={(e) => setFilters((p) => ({ ...p, workshopId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder={t('tx.ph.branchId')}
                    value={filters.branchId}
                    onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))}
                    style={inputStyle}
                />
                <button type="button" style={btnPrimary} onClick={() => setReload((x) => x + 1)}>
                    {t('common.apply')}
                </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {headers.map((h) => (
                                <th
                                    key={h}
                                    style={{
                                        textAlign: 'left',
                                        padding: '8px 10px',
                                        fontSize: 11,
                                        color: '#6b7280',
                                        borderBottom: '1px solid #e5e7eb',
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                    }}
                                >
                                    {t(h)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('batch.empty')}
                                </td>
                            </tr>
                        ) : (
                            rows.map((b, idx) => (
                                <tr key={`${b.terminalId}-${b.date}-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.date}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.terminalCode}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.workshopName}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.branchName}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.count}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{SAR(b.gross)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, color: '#dc2626' }}>{SAR(b.bankFee)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, color: '#16a34a' }}>{SAR(b.platformFee)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{SAR(b.netToMerchant)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ===== Rules =====
function RulesTab({ onError, t }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ terminalId: '', workshopId: '', isActive: '' });
    const [reload, setReload] = useState(0);
    const [editing, setEditing] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await listSoftPosRules(filters);
                if (!cancelled) setRows(pickArr(res));
            } catch (err) {
                if (!cancelled) onError(err?.message || t('err.loadRules'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const onDelete = async (id) => {
        if (!window.confirm(t('rule.confirmDelete'))) return;
        try {
            await deleteSoftPosRule(id);
            setReload((x) => x + 1);
        } catch (e) {
            onError(e?.message || t('err.deleteFailed'));
        }
    };

    const headers = [
        'th.scope',
        'th.terminalWorkshop',
        'th.bankPct',
        'th.platformPct',
        'th.from',
        'th.to',
        'th.status',
        'th.actions',
    ];

    if (editing) {
        return (
            <RuleModal
                initial={editing.id ? editing : {}}
                t={t}
                onClose={() => setEditing(null)}
                onDone={() => {
                    setEditing(null);
                    setReload((x) => x + 1);
                }}
            />
        );
    }

    return (
        <div style={card}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <input
                    placeholder={t('tx.ph.terminalId')}
                    value={filters.terminalId}
                    onChange={(e) => setFilters((p) => ({ ...p, terminalId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder={t('tx.ph.workshopId')}
                    value={filters.workshopId}
                    onChange={(e) => setFilters((p) => ({ ...p, workshopId: e.target.value }))}
                    style={inputStyle}
                />
                <select
                    value={filters.isActive}
                    onChange={(e) => setFilters((p) => ({ ...p, isActive: e.target.value }))}
                    style={{ ...inputStyle, width: 'auto' }}
                >
                    <option value="">{t('common.all')}</option>
                    <option value="true">{t('common.active')}</option>
                    <option value="false">{t('common.inactive')}</option>
                </select>
                <button type="button" style={btn} onClick={() => setReload((x) => x + 1)}>
                    {t('common.apply')}
                </button>
                <button
                    type="button"
                    style={{ ...btnPrimary, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setEditing({})}
                >
                    <Plus size={14} /> {t('rule.new')}
                </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {headers.map((h) => (
                                <th
                                    key={h}
                                    style={{
                                        textAlign: 'left',
                                        padding: '8px 10px',
                                        fontSize: 11,
                                        color: '#6b7280',
                                        borderBottom: '1px solid #e5e7eb',
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                    }}
                                >
                                    {t(h)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('rule.empty')}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.scope}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {r.terminalCode || r.workshopName || t('rule.defaultGlobal')}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.bankFeePercent}%</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.platformFeePercent}%</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleDateString() : t('common.emDash')}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : t('common.emDash')}
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <span
                                            style={{
                                                background: r.isActive ? '#dcfce7' : '#fee2e2',
                                                color: r.isActive ? '#16a34a' : '#dc2626',
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {r.isActive ? t('status.active') : t('status.inactive')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <div style={{ display: 'inline-flex', gap: 12 }}>
                                            <button type="button" style={{ ...btn, border: 'none', padding: 0 }} title={t('common.edit')} onClick={() => setEditing(r)}>
                                                <Pencil size={14} color="#6b7280" />
                                            </button>
                                            <button type="button" style={{ ...btn, border: 'none', padding: 0 }} title={t('common.delete')} onClick={() => onDelete(r.id)}>
                                                <Trash2 size={14} color="#dc2626" />
                                            </button>
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

function RuleModal({ initial = {}, onClose, onDone, t }) {
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({
        terminalId: initial.terminalId || '',
        workshopId: initial.workshopId || '',
        bankFeePercent: initial.bankFeePercent ?? 0.2,
        platformFeePercent: initial.platformFeePercent ?? 0.5,
        effectiveFrom: initial.effectiveFrom ? String(initial.effectiveFrom).slice(0, 10) : today,
        effectiveTo: initial.effectiveTo ? String(initial.effectiveTo).slice(0, 10) : '',
        isActive: initial.isActive !== false,
        notes: initial.notes || '',
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        setSaving(true);
        setErr('');
        try {
            const payload = {
                terminalId: form.terminalId || null,
                workshopId: form.workshopId || null,
                bankFeePercent: Number(form.bankFeePercent),
                platformFeePercent: Number(form.platformFeePercent),
                effectiveFrom: form.effectiveFrom,
                effectiveTo: form.effectiveTo || null,
                isActive: Boolean(form.isActive),
                notes: form.notes,
            };
            if (initial.id) {
                await updateSoftPosRule(initial.id, payload);
            } else {
                await createSoftPosRule(payload);
            }
            onDone();
        } catch (e) {
            setErr(e?.message || t('err.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminModalAsScreen title={initial.id ? t('rule.editTitle') : t('rule.newTitle')} onClose={onClose}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label={t('rule.terminalIdOpt')}>
                    <input
                        value={form.terminalId}
                        onChange={(e) => setForm((p) => ({ ...p, terminalId: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('rule.workshopIdOpt')}>
                    <input
                        value={form.workshopId}
                        onChange={(e) => setForm((p) => ({ ...p, workshopId: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('rule.bankFeePct')}>
                    <input
                        type="number"
                        step="0.0001"
                        value={form.bankFeePercent}
                        onChange={(e) => setForm((p) => ({ ...p, bankFeePercent: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('rule.platformFeePct')}>
                    <input
                        type="number"
                        step="0.0001"
                        value={form.platformFeePercent}
                        onChange={(e) => setForm((p) => ({ ...p, platformFeePercent: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('rule.effectiveFrom')}>
                    <input
                        type="date"
                        value={form.effectiveFrom}
                        onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('rule.effectiveTo')}>
                    <input
                        type="date"
                        value={form.effectiveTo}
                        onChange={(e) => setForm((p) => ({ ...p, effectiveTo: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('rule.active')}>
                    <select
                        value={form.isActive ? 'true' : 'false'}
                        onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === 'true' }))}
                        style={inputStyle}
                    >
                        <option value="true">{t('status.active')}</option>
                        <option value="false">{t('status.inactive')}</option>
                    </select>
                </Field>
                <Field label={t('rule.notes')} full>
                    <textarea
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                        style={{ ...inputStyle, resize: 'vertical' }}
                    />
                </Field>
                {err && <div style={{ gridColumn: 'span 2', color: '#dc2626', fontSize: 13 }}>{err}</div>}
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" style={btn} onClick={onClose} disabled={saving}>
                        {t('common.cancel')}
                    </button>
                    <button type="button" style={btnPrimary} onClick={submit} disabled={saving}>
                        {saving ? t('common.saving') : initial.id ? t('common.update') : t('common.create')}
                    </button>
                </div>
            </div>
        </AdminModalAsScreen>
    );
}

// ===== Refunds =====
function RefundsTab({ onError, t }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await listSoftPosTransactions({ status: 'refund', limit: 200 });
                if (!cancelled) setRows(pickArr(res, 'items'));
            } catch (err) {
                if (!cancelled) onError(err?.message || t('err.loadRefunds'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const headers = [
        'th.when',
        'th.reference',
        'th.originalTx',
        'th.workshop',
        'th.branch',
        'th.amount',
        'th.bankReversal',
        'th.platformReversal',
        'th.netReversal',
    ];

    return (
        <div style={card}>
            <div style={{ marginBottom: 8 }}>
                <button type="button" style={btn} onClick={() => setReload((x) => x + 1)}>
                    {t('common.refresh')}
                </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {headers.map((h) => (
                                <th
                                    key={h}
                                    style={{
                                        textAlign: 'left',
                                        padding: '8px 10px',
                                        fontSize: 11,
                                        color: '#6b7280',
                                        borderBottom: '1px solid #e5e7eb',
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                    }}
                                >
                                    {t(h)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('refund.empty')}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                        {r.capturedAt ? new Date(r.capturedAt).toLocaleString() : t('common.emDash')}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.reference || t('common.emDash')}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.refundOfId || t('common.emDash')}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.workshopName || t('common.emDash')}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.branchName || t('common.emDash')}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{SAR(r.gross)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{SAR(r.bankFee)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{SAR(r.platformFee)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{SAR(r.netToMerchant)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ===== HQ Settlement (net HQ-owes vs workshop-owes → payout voucher) =====
function HqSettlementTab({ onError, t }) {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const [form, setForm] = useState({
        workshopId: '',
        periodStart: firstOfMonth.toISOString().slice(0, 10),
        periodEnd: new Date().toISOString().slice(0, 10),
    });
    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [statements, setStatements] = useState([]);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await listSettlements({ limit: 100 });
                if (!cancelled) setStatements(Array.isArray(res) ? res : []);
            } catch (err) {
                if (!cancelled) onError(err?.message || t('err.loadSettlements'));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const runPreview = async () => {
        if (!form.workshopId) {
            onError(t('err.workshopRequired'));
            return;
        }
        setLoadingPreview(true);
        setPreview(null);
        try {
            const res = await previewSettlement(form);
            setPreview(res);
        } catch (err) {
            onError(err?.message || t('err.previewFailed'));
        } finally {
            setLoadingPreview(false);
        }
    };

    const runGenerate = async () => {
        if (!form.workshopId) {
            onError(t('err.workshopRequired'));
            return;
        }
        if (!window.confirm(t('hq.confirmGenerate'))) return;
        setGenerating(true);
        try {
            await generateSettlement(form);
            setPreview(null);
            setReload((x) => x + 1);
        } catch (err) {
            onError(err?.message || t('err.generateFailed'));
        } finally {
            setGenerating(false);
        }
    };

    const entryHeaders = ['th.direction', 'th.source', 'th.description', 'th.amount'];
    const statementHeaders = [
        'th.voucher',
        'th.workshop',
        'th.period',
        'th.hqOwesCol',
        'th.wsOwesCol',
        'th.net',
        'th.status',
        'th.paid',
    ];

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div style={card}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{t('hq.title')}</div>
                <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: 13 }}>
                    {t('hq.subtitle')}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        placeholder={t('tx.ph.workshopId')}
                        value={form.workshopId}
                        onChange={(e) => setForm((p) => ({ ...p, workshopId: e.target.value }))}
                        style={{ ...inputStyle, width: 160 }}
                    />
                    <input
                        type="date"
                        value={form.periodStart}
                        onChange={(e) => setForm((p) => ({ ...p, periodStart: e.target.value }))}
                        style={{ ...inputStyle, width: 170 }}
                    />
                    <input
                        type="date"
                        value={form.periodEnd}
                        onChange={(e) => setForm((p) => ({ ...p, periodEnd: e.target.value }))}
                        style={{ ...inputStyle, width: 170 }}
                    />
                    <button type="button" style={btn} onClick={runPreview} disabled={loadingPreview}>
                        {loadingPreview ? t('common.loading') : t('hq.preview')}
                    </button>
                    <button type="button" style={btnPrimary} onClick={runGenerate} disabled={generating}>
                        {generating ? t('hq.posting') : t('hq.generate')}
                    </button>
                </div>

                {preview && (
                    <div style={{ marginTop: 16 }}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(3, 1fr)',
                                gap: 12,
                                marginBottom: 12,
                            }}
                        >
                            <SummaryCard
                                label={t('hq.hqOwes')}
                                value={SAR(preview.hqOwesWorkshop)}
                                icon={<ArrowDownToLine size={18} color="#16a34a" />}
                                color="#16a34a"
                            />
                            <SummaryCard
                                label={t('hq.wsOwes')}
                                value={SAR(preview.workshopOwesHq)}
                                icon={<ArrowDownToLine size={18} color="#dc2626" />}
                                color="#dc2626"
                            />
                            <SummaryCard
                                label={
                                    preview.netToWorkshop >= 0
                                        ? t('hq.netPayout')
                                        : t('hq.netCollect')
                                }
                                value={SAR(Math.abs(preview.netToWorkshop))}
                                icon={<Banknote size={18} color="#D4A017" />}
                                color="#D4A017"
                            />
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                            {t(preview.entryCount === 1 ? 'hq.openEntry' : 'hq.openEntries', {
                                n: preview.entryCount,
                            })}
                        </div>
                        {Array.isArray(preview.entries) && preview.entries.length > 0 && (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#fafafa' }}>
                                        {entryHeaders.map((h) => (
                                            <th
                                                key={h}
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '6px 8px',
                                                    fontSize: 11,
                                                    color: '#6b7280',
                                                    borderBottom: '1px solid #e5e7eb',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {t(h)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.entries.map((e) => (
                                        <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '6px 8px', fontSize: 12 }}>
                                                {e.direction === 'hq_owes_workshop' ? t('dir.hqToWs') : t('dir.wsToHq')}
                                            </td>
                                            <td style={{ padding: '6px 8px', fontSize: 12 }}>{e.source}</td>
                                            <td style={{ padding: '6px 8px', fontSize: 12 }}>{e.description || t('common.emDash')}</td>
                                            <td style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600 }}>{SAR(e.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontWeight: 700 }}>{t('hq.statements')}</div>
                    <button type="button" style={btn} onClick={() => setReload((x) => x + 1)}>
                        {t('common.refresh')}
                    </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#fafafa' }}>
                                {statementHeaders.map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            textAlign: 'left',
                                            padding: '8px 10px',
                                            fontSize: 11,
                                            color: '#6b7280',
                                            borderBottom: '1px solid #e5e7eb',
                                            textTransform: 'uppercase',
                                            letterSpacing: 1,
                                        }}
                                    >
                                        {t(h)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {statements.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                        {t('hq.statementsEmpty')}
                                    </td>
                                </tr>
                            ) : (
                                statements.map((s) => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{s.voucherNo || s.id}</td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>{s.workshopName || s.workshopId}</td>
                                        <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                            {s.periodStart} → {s.periodEnd}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, color: '#16a34a' }}>{SAR(s.hqOwesWorkshop)}</td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, color: '#dc2626' }}>{SAR(s.workshopOwesHq)}</td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{SAR(s.netToWorkshop)}</td>
                                        <td style={{ padding: '8px 10px', fontSize: 12 }}>{statusLabel(t, s.status)}</td>
                                        <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                            {s.paidAt ? new Date(s.paidAt).toLocaleDateString() : t('common.emDash')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function Field({ label, full, children }) {
    return (
        <div style={{ gridColumn: full ? 'span 2' : 'span 1' }}>
            <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>{label}</label>
            {children}
        </div>
    );
}
