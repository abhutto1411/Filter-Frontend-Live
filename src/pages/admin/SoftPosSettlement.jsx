import React, { useEffect, useMemo, useState } from 'react';
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
import { useAuth } from '../../context/AuthContext';

const SAR = (n) => `SAR ${(Number(n) || 0).toFixed(2)}`;

const TABS = [
    { key: 'transactions', label: 'Transactions',        icon: Receipt,         permission: 'softpos-settlement.transactions.view' },
    { key: 'terminals',    label: 'Terminals',           icon: CreditCard,      permission: 'softpos-settlement.terminals.view' },
    { key: 'batches',      label: 'Settlement Batches',  icon: ArrowDownToLine, permission: 'softpos-settlement.batches.view' },
    { key: 'rules',        label: 'Bank Rules',          icon: Settings,        permission: 'softpos-settlement.rules.view' },
    { key: 'refunds',      label: 'Refunds',             icon: RefreshCw,       permission: 'softpos-settlement.refunds.view' },
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

export default function SoftPosSettlement() {
    const { hasPermission } = useAuth();
    const visibleTabs = TABS.filter((t) => hasPermission(t.permission));
    const [activeTab, setActiveTab] = useState(() => visibleTabs[0]?.key ?? 'transactions');
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState('');

    // Auto-snap to first allowed tab if current becomes hidden.
    useEffect(() => {
        if (visibleTabs.length === 0) return;
        if (!visibleTabs.some((t) => t.key === activeTab)) {
            setActiveTab(visibleTabs[0].key);
        }
    }, [visibleTabs, activeTab]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getSoftPosStats();
                if (!cancelled) setStats(res);
            } catch (err) {
                if (!cancelled) setError(err?.message || 'Failed to load stats');
            } finally {
                if (!cancelled) setStatsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeTab]);

    return (
        <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <CreditCard size={24} />
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                    SoftPOS Tap-to-Pay Settlement
                </h1>
            </div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
                Monitor merchant terminals, bank fees, platform commission, and process refunds.
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
                    label="Active Terminals"
                    value={statsLoading ? '...' : (stats?.activeTerminals ?? 0)}
                    icon={<CreditCard size={18} color="#1d4ed8" />}
                    color="#1d4ed8"
                />
                <SummaryCard
                    label="Captured Volume"
                    value={statsLoading ? '...' : SAR(stats?.gross || 0)}
                    icon={<DollarSign size={18} color="#16a34a" />}
                    color="#16a34a"
                />
                <SummaryCard
                    label="Platform Income"
                    value={statsLoading ? '...' : SAR(stats?.platformIncome || 0)}
                    icon={<Banknote size={18} color="#D4A017" />}
                    color="#D4A017"
                />
                <SummaryCard
                    label="Refunds"
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
                {visibleTabs.map((t) => {
                    const active = t.key === activeTab;
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setActiveTab(t.key)}
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
                            {t.label}
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

            {activeTab === 'transactions' && hasPermission('softpos-settlement.transactions.view') && <TransactionsTab onError={setError} />}
            {activeTab === 'terminals'    && hasPermission('softpos-settlement.terminals.view')    && <TerminalsTab onError={setError} />}
            {activeTab === 'batches'      && hasPermission('softpos-settlement.batches.view')      && <BatchesTab onError={setError} />}
            {activeTab === 'rules'        && hasPermission('softpos-settlement.rules.view')        && <RulesTab onError={setError} />}
            {activeTab === 'refunds'      && hasPermission('softpos-settlement.refunds.view')      && <RefundsTab onError={setError} />}
            {visibleTabs.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
                    You don't have permission to view any SoftPOS Settlement sections.
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
function TransactionsTab({ onError }) {
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
                if (!cancelled) onError(err?.message || 'Failed to load transactions');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

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
                    placeholder="Search ref"
                    value={filters.search}
                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder="Workshop ID"
                    value={filters.workshopId}
                    onChange={(e) => setFilters((p) => ({ ...p, workshopId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder="Branch ID"
                    value={filters.branchId}
                    onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder="Terminal ID"
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
                    Apply
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
                    <strong>Gross:</strong> {SAR(totals.gross)}
                </div>
                <div>
                    <strong>Bank Fee:</strong> {SAR(totals.bankFee)}
                </div>
                <div>
                    <strong>Platform Fee:</strong> {SAR(totals.platformFee)}
                </div>
                <div>
                    <strong>Net to Merchants:</strong> {SAR(totals.netToMerchant)}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {['Captured', 'Terminal', 'Workshop / Branch', 'Invoice', 'Gross', 'Bank Fee', 'Platform', 'Net', 'Status', 'Actions'].map(
                                (h) => (
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
                                        {h}
                                    </th>
                                ),
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={10} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={10} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    No SoftPOS transactions for this filter.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => {
                                const sc = STATUS_COLORS[r.status] || { bg: '#e5e7eb', color: '#374151' };
                                return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                            {r.capturedAt ? new Date(r.capturedAt).toLocaleString() : '—'}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            <div style={{ fontWeight: 600 }}>{r.terminalCode || '—'}</div>
                                            {r.terminalLabel && (
                                                <div style={{ color: '#6b7280', fontSize: 11 }}>{r.terminalLabel}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            <div>{r.workshopName || '—'}</div>
                                            <div style={{ color: '#6b7280', fontSize: 11 }}>{r.branchName || '—'}</div>
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            {r.invoiceNo || r.reference || '—'}
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
                                                {r.status}
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
                                                    Refund
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
                Showing {rows.length} of {total}
            </div>

            {refundOpen && (
                <RefundModal
                    transaction={refundOpen}
                    onClose={() => setRefundOpen(null)}
                    onDone={() => {
                        setRefundOpen(null);
                        setReload((x) => x + 1);
                    }}
                />
            )}
        </div>
    );
}

function RefundModal({ transaction, onClose, onDone }) {
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
            setErr(e?.message || 'Refund failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ModalShell title={`Refund ${transaction.reference || transaction.id}`} onClose={onClose}>
            <div style={{ display: 'grid', gap: 10 }}>
                <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>Amount (SAR)</label>
                    <input
                        type="number"
                        step="0.01"
                        max={Number(transaction.gross)}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                        Max refundable: {SAR(transaction.gross)}
                    </div>
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4 }}>Reason</label>
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
                        Cancel
                    </button>
                    <button type="button" style={btnPrimary} onClick={submit} disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit Refund'}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

// ===== Terminals =====
function TerminalsTab({ onError }) {
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
                if (!cancelled) onError(err?.message || 'Failed to load terminals');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const onDelete = async (id) => {
        if (!window.confirm('Delete terminal?')) return;
        try {
            await deleteSoftPosTerminal(id);
            setReload((x) => x + 1);
        } catch (e) {
            onError(e?.message || 'Delete failed');
        }
    };

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
                        placeholder="Search terminal code / merchant / label"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') setReload((x) => x + 1);
                        }}
                        style={{ ...inputStyle, paddingLeft: 32 }}
                    />
                </div>
                <button type="button" style={btn} onClick={() => setReload((x) => x + 1)}>
                    Apply
                </button>
                <button
                    type="button"
                    style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setEditing({})}
                >
                    <Plus size={14} /> New Terminal
                </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {[
                                'Terminal Code',
                                'Merchant',
                                'Workshop / Branch',
                                'Bank A/C',
                                'Bank %',
                                'Platform %',
                                'Status',
                                'Actions',
                            ].map((h) => (
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
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    No terminals registered yet.
                                </td>
                            </tr>
                        ) : (
                            rows.map((t) => (
                                <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>
                                        {t.terminalCode}
                                        {t.label && (
                                            <div style={{ color: '#6b7280', fontSize: 11 }}>{t.label}</div>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{t.merchantCode}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        <div>{t.workshopName || '—'}</div>
                                        <div style={{ color: '#6b7280', fontSize: 11 }}>{t.branchName || '—'}</div>
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {t.bankCashBankAccountName || '—'}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {t.bankFeePercent != null ? `${t.bankFeePercent}%` : '—'}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {t.platformFeePercent != null ? `${t.platformFeePercent}%` : '—'}
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <span
                                            style={{
                                                background: t.status === 'active' ? '#dcfce7' : '#fee2e2',
                                                color: t.status === 'active' ? '#16a34a' : '#dc2626',
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {t.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <div style={{ display: 'inline-flex', gap: 12 }}>
                                            <button
                                                type="button"
                                                style={{ ...btn, border: 'none', padding: 0 }}
                                                title="Edit"
                                                onClick={() => setEditing(t)}
                                            >
                                                <Pencil size={14} color="#6b7280" />
                                            </button>
                                            <button
                                                type="button"
                                                style={{ ...btn, border: 'none', padding: 0 }}
                                                title="Delete"
                                                onClick={() => onDelete(t.id)}
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

            {editing && (
                <TerminalModal
                    initial={editing.id ? editing : {}}
                    onClose={() => setEditing(null)}
                    onDone={() => {
                        setEditing(null);
                        setReload((x) => x + 1);
                    }}
                    onError={onError}
                />
            )}
        </div>
    );
}

function TerminalModal({ initial = {}, onClose, onDone, onError }) {
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
            setErr(e?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title={initial.id ? 'Edit Terminal' : 'New Terminal'} onClose={onClose}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Workshop ID *">
                    <input
                        value={form.workshopId}
                        onChange={(e) => setForm((p) => ({ ...p, workshopId: e.target.value }))}
                        style={inputStyle}
                        disabled={!!initial.id}
                    />
                </Field>
                <Field label="Branch ID *">
                    <input
                        value={form.branchId}
                        onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                        style={inputStyle}
                        disabled={!!initial.id}
                    />
                </Field>
                <Field label="Merchant Code *">
                    <input
                        value={form.merchantCode}
                        onChange={(e) => setForm((p) => ({ ...p, merchantCode: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Terminal Code *">
                    <input
                        value={form.terminalCode}
                        onChange={(e) => setForm((p) => ({ ...p, terminalCode: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Label" full>
                    <input
                        value={form.label}
                        onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Bank CashBankAccount ID">
                    <input
                        value={form.bankCashBankAccountId}
                        onChange={(e) =>
                            setForm((p) => ({ ...p, bankCashBankAccountId: e.target.value }))
                        }
                        style={inputStyle}
                    />
                </Field>
                <Field label="Status">
                    <select
                        value={form.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                        style={inputStyle}
                    >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                    </select>
                </Field>
                <Field label="Bank Fee % (override)">
                    <input
                        type="number"
                        step="0.0001"
                        value={form.bankFeePercent}
                        onChange={(e) => setForm((p) => ({ ...p, bankFeePercent: e.target.value }))}
                        style={inputStyle}
                        placeholder="default rule"
                    />
                </Field>
                <Field label="Platform Fee % (override)">
                    <input
                        type="number"
                        step="0.0001"
                        value={form.platformFeePercent}
                        onChange={(e) =>
                            setForm((p) => ({ ...p, platformFeePercent: e.target.value }))
                        }
                        style={inputStyle}
                        placeholder="default rule"
                    />
                </Field>
                {err && <div style={{ gridColumn: 'span 2', color: '#dc2626', fontSize: 13 }}>{err}</div>}
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" style={btn} onClick={onClose} disabled={saving}>
                        Cancel
                    </button>
                    <button type="button" style={btnPrimary} onClick={submit} disabled={saving}>
                        {saving ? 'Saving...' : initial.id ? 'Update' : 'Create'}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

// ===== Batches =====
function BatchesTab({ onError }) {
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
                if (!cancelled) onError(err?.message || 'Failed to load batches');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    return (
        <div style={card}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <input
                    placeholder="Workshop ID"
                    value={filters.workshopId}
                    onChange={(e) => setFilters((p) => ({ ...p, workshopId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder="Branch ID"
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
                    Apply
                </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {['Date', 'Terminal', 'Workshop', 'Branch', 'Count', 'Gross', 'Bank Fee', 'Platform', 'Net'].map(
                                (h) => (
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
                                        {h}
                                    </th>
                                ),
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    No settlement batches yet.
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
function RulesTab({ onError }) {
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
                if (!cancelled) onError(err?.message || 'Failed to load rules');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const onDelete = async (id) => {
        if (!window.confirm('Delete rule?')) return;
        try {
            await deleteSoftPosRule(id);
            setReload((x) => x + 1);
        } catch (e) {
            onError(e?.message || 'Delete failed');
        }
    };

    return (
        <div style={card}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <input
                    placeholder="Terminal ID"
                    value={filters.terminalId}
                    onChange={(e) => setFilters((p) => ({ ...p, terminalId: e.target.value }))}
                    style={inputStyle}
                />
                <input
                    placeholder="Workshop ID"
                    value={filters.workshopId}
                    onChange={(e) => setFilters((p) => ({ ...p, workshopId: e.target.value }))}
                    style={inputStyle}
                />
                <select
                    value={filters.isActive}
                    onChange={(e) => setFilters((p) => ({ ...p, isActive: e.target.value }))}
                    style={{ ...inputStyle, width: 'auto' }}
                >
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>
                <button type="button" style={btn} onClick={() => setReload((x) => x + 1)}>
                    Apply
                </button>
                <button
                    type="button"
                    style={{ ...btnPrimary, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setEditing({})}
                >
                    <Plus size={14} /> New Rule
                </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {[
                                'Scope',
                                'Terminal / Workshop',
                                'Bank %',
                                'Platform %',
                                'From',
                                'To',
                                'Status',
                                'Actions',
                            ].map((h) => (
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
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    No settlement rules yet.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.scope}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {r.terminalCode || r.workshopName || 'Default (global)'}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.bankFeePercent}%</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.platformFeePercent}%</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleDateString() : '—'}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {r.effectiveTo ? new Date(r.effectiveTo).toLocaleDateString() : '—'}
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
                                            {r.isActive ? 'active' : 'inactive'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <div style={{ display: 'inline-flex', gap: 12 }}>
                                            <button type="button" style={{ ...btn, border: 'none', padding: 0 }} onClick={() => setEditing(r)}>
                                                <Pencil size={14} color="#6b7280" />
                                            </button>
                                            <button type="button" style={{ ...btn, border: 'none', padding: 0 }} onClick={() => onDelete(r.id)}>
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

            {editing && (
                <RuleModal
                    initial={editing.id ? editing : {}}
                    onClose={() => setEditing(null)}
                    onDone={() => {
                        setEditing(null);
                        setReload((x) => x + 1);
                    }}
                />
            )}
        </div>
    );
}

function RuleModal({ initial = {}, onClose, onDone }) {
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
            setErr(e?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title={initial.id ? 'Edit Rule' : 'New Rule'} onClose={onClose}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Terminal ID (optional)">
                    <input
                        value={form.terminalId}
                        onChange={(e) => setForm((p) => ({ ...p, terminalId: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Workshop ID (optional)">
                    <input
                        value={form.workshopId}
                        onChange={(e) => setForm((p) => ({ ...p, workshopId: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Bank Fee %">
                    <input
                        type="number"
                        step="0.0001"
                        value={form.bankFeePercent}
                        onChange={(e) => setForm((p) => ({ ...p, bankFeePercent: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Platform Fee %">
                    <input
                        type="number"
                        step="0.0001"
                        value={form.platformFeePercent}
                        onChange={(e) => setForm((p) => ({ ...p, platformFeePercent: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Effective From">
                    <input
                        type="date"
                        value={form.effectiveFrom}
                        onChange={(e) => setForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Effective To (optional)">
                    <input
                        type="date"
                        value={form.effectiveTo}
                        onChange={(e) => setForm((p) => ({ ...p, effectiveTo: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label="Active">
                    <select
                        value={form.isActive ? 'true' : 'false'}
                        onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value === 'true' }))}
                        style={inputStyle}
                    >
                        <option value="true">active</option>
                        <option value="false">inactive</option>
                    </select>
                </Field>
                <Field label="Notes" full>
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
                        Cancel
                    </button>
                    <button type="button" style={btnPrimary} onClick={submit} disabled={saving}>
                        {saving ? 'Saving...' : initial.id ? 'Update' : 'Create'}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
}

// ===== Refunds =====
function RefundsTab({ onError }) {
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
                if (!cancelled) onError(err?.message || 'Failed to load refunds');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    return (
        <div style={card}>
            <div style={{ marginBottom: 8 }}>
                <button type="button" style={btn} onClick={() => setReload((x) => x + 1)}>
                    Refresh
                </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa' }}>
                            {['When', 'Reference', 'Original Tx', 'Workshop', 'Branch', 'Amount', 'Bank Reversal', 'Platform Reversal', 'Net Reversal'].map((h) => (
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
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    No refunds.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                        {r.capturedAt ? new Date(r.capturedAt).toLocaleString() : '—'}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.reference || '—'}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.refundOfId || '—'}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.workshopName || '—'}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.branchName || '—'}</td>
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

function ModalShell({ title, onClose, children }) {
    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: 24,
                    width: '100%',
                    maxWidth: 640,
                    boxSizing: 'border-box',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>{title}</h3>
                    <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>
                {children}
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
