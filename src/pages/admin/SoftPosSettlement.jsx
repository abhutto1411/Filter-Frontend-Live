import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import SearchSelect from '../../components/SearchSelect';
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
    Smartphone,
    Copy,
    KeyRound,
    Ban,
    Link2,
    AlertTriangle,
    ShieldCheck,
} from 'lucide-react';
import {
    assignSoftPosTransactionTerminal,
    createSoftPosDevice,
    createSoftPosRule,
    createSoftPosTerminal,
    deleteSoftPosDevice,
    deleteSoftPosRule,
    deleteSoftPosTerminal,
    getSoftPosAccess,
    getSoftPosOptions,
    getSoftPosStats,
    listSoftPosBatches,
    listSoftPosDevices,
    listSoftPosRules,
    listSoftPosTerminals,
    listSoftPosTransactions,
    refundSoftPosTransaction,
    regenerateSoftPosDeviceCode,
    revokeSoftPosDevice,
    setSoftPosBranchAccess,
    setSoftPosGlobalAccess,
    updateSoftPosDevice,
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
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';

const SAR = (n) => `SAR ${(Number(n) || 0).toFixed(2)}`;

const TABS = [
    { key: 'transactions', labelKey: 'tab.transactions', icon: Receipt,         permission: 'softpos-settlement.transactions.view' },
    { key: 'terminals',    labelKey: 'tab.terminals',    icon: CreditCard,      permission: 'softpos-settlement.terminals.view' },
    { key: 'devices',      labelKey: 'tab.devices',      icon: Smartphone,      permission: 'softpos-settlement.terminals.view' },
    { key: 'batches',      labelKey: 'tab.batches',      icon: ArrowDownToLine, permission: 'softpos-settlement.batches.view' },
    { key: 'hqsettlement', labelKey: 'tab.hqsettlement', icon: Banknote,        permission: 'softpos-settlement.batches.view' },
    { key: 'rules',        labelKey: 'tab.rules',        icon: Settings,        permission: 'softpos-settlement.rules.view' },
    { key: 'refunds',      labelKey: 'tab.refunds',      icon: RefreshCw,       permission: 'softpos-settlement.refunds.view' },
    // Parent page permission so Access appears without re-seeding role codes.
    { key: 'access',       labelKey: 'tab.access',       icon: ShieldCheck,     permission: 'softpos-settlement.view' },
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

const MODE_COLORS = {
    merchant_direct: { bg: '#e0e7ff', color: '#3730a3' },
    platform_collect: { bg: '#fef3c7', color: '#92400e' },
};

const DEVICE_STATUS_COLORS = {
    active: { bg: '#dcfce7', color: '#16a34a' },
    pending: { bg: '#fef3c7', color: '#92400e' },
    revoked: { bg: '#fee2e2', color: '#dc2626' },
};

const badge = (c) => ({
    background: c.bg,
    color: c.color,
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
});

function ModeBadge({ mode, t }) {
    if (!mode) return null;
    const c = MODE_COLORS[mode] || { bg: '#e5e7eb', color: '#374151' };
    return <span style={badge(c)}>{t(`mode.${mode}.short`)}</span>;
}

function FeeVatNote({ amount, t }) {
    if (!amount) return null;
    return (
        <div style={{ color: '#6b7280', fontSize: 11 }}>
            {t('tx.plusVat', { amount: SAR(amount) })}
        </div>
    );
}

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString(undefined, { timeZone: 'Asia/Riyadh' }) : '');

/** Dropdown data; branches / bank accounts / terminals load once a workshop is picked. */
function useSoftPosOptions(workshopId) {
    const key = workshopId || '';
    const [state, setState] = useState({
        key: null,
        workshops: [],
        branches: [],
        bankAccounts: [],
        terminals: [],
        deviceLabels: [],
    });
    useEffect(() => {
        let cancelled = false;
        getSoftPosOptions({ workshopId: key || undefined })
            .then((res) => {
                if (cancelled) return;
                setState({
                    key,
                    workshops: res?.workshops || [],
                    branches: res?.branches || [],
                    bankAccounts: res?.bankAccounts || [],
                    terminals: res?.terminals || [],
                    deviceLabels: res?.deviceLabels || [],
                });
            })
            .catch(() => {
                if (!cancelled) {
                    setState((p) => ({ ...p, key, branches: [], bankAccounts: [], terminals: [] }));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [key]);
    const loading = state.key !== key;
    return {
        workshops: state.workshops,
        branches: loading ? [] : state.branches,
        bankAccounts: loading ? [] : state.bankAccounts,
        terminals: loading ? [] : state.terminals,
        deviceLabels: loading ? [] : state.deviceLabels || [],
        loading,
    };
}

const terminalOptionLabel = (term) =>
    `${term.terminalCode}${term.label ? ` — ${term.label}` : ''}${term.status && term.status !== 'active' ? ` (${term.status})` : ''}`;

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
    const visibleTabs = useMemo(
        () => TABS.filter((tab) => hasPermission(tab.permission)),
        [hasPermission],
    );
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

            {!statsLoading && Number(stats?.unassignedTransactions) > 0 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        color: '#92400e',
                        padding: '8px 12px',
                        borderRadius: 8,
                        marginBottom: 12,
                        fontSize: 13,
                    }}
                >
                    <AlertTriangle size={16} />
                    {t('tx.unassignedBanner', { n: stats.unassignedTransactions })}
                </div>
            )}

            {!statsLoading && Number(stats?.notInvoicedTransactions) > 0 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1e40af',
                        padding: '8px 12px',
                        borderRadius: 8,
                        marginBottom: 12,
                        fontSize: 13,
                    }}
                >
                    <AlertTriangle size={16} />
                    {t('tx.notInvoicedBanner', { n: stats.notInvoicedTransactions })}
                </div>
            )}

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
            {activeTab === 'devices'      && hasPermission('softpos-settlement.terminals.view')    && <DevicesTab onError={setError} t={t} />}
            {activeTab === 'batches'      && hasPermission('softpos-settlement.batches.view')      && <BatchesTab onError={setError} t={t} />}
            {activeTab === 'hqsettlement' && hasPermission('softpos-settlement.batches.view')      && <HqSettlementTab onError={setError} t={t} />}
            {activeTab === 'rules'        && hasPermission('softpos-settlement.rules.view')        && <RulesTab onError={setError} t={t} />}
            {activeTab === 'refunds'      && hasPermission('softpos-settlement.refunds.view')      && <RefundsTab onError={setError} t={t} />}
            {activeTab === 'access'       && hasPermission('softpos-settlement.view')       && (
                <AccessTab
                    onError={setError}
                    t={t}
                    canEdit={
                        hasPermission('softpos-settlement.access.edit') ||
                        hasPermission('softpos-settlement.terminals.edit') ||
                        hasPermission('softpos-settlement.view')
                    }
                />
            )}
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
    const [totals, setTotals] = useState({ gross: 0, bankFee: 0, platformFee: 0, platformFeeVat: 0, netToMerchant: 0 });
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        workshopId: '',
        branchId: '',
        terminalId: '',
        unassigned: false,
        invoiced: '',
        status: '',
        fromDate: '',
        toDate: '',
        search: '',
    });
    const [reload, setReload] = useState(0);
    const hasRows = useRef(false);
    const [refundOpen, setRefundOpen] = useState(null);
    const [assignOpen, setAssignOpen] = useState(null);
    const options = useSoftPosOptions(filters.workshopId);
    const filterTerminals = options.terminals.filter(
        (term) => !filters.branchId || term.branchId === filters.branchId,
    );

    useEffect(() => {
        const id = window.setInterval(() => setReload((x) => x + 1), 15_000);
        return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!hasRows.current) setLoading(true);
            try {
                const res = await listSoftPosTransactions({
                    ...filters,
                    terminalId: filters.unassigned ? '' : filters.terminalId,
                    unassigned: filters.unassigned ? 'true' : '',
                    limit: 100,
                });
                if (cancelled) return;
                const next = pickArr(res, 'items');
                hasRows.current = next.length > 0;
                setRows(next);
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
        'th.device',
        'th.workshopBranch',
        'th.invoice',
        'th.card',
        'th.gross',
        'th.bankFee',
        'th.platform',
        'th.net',
        'th.status',
        'th.actions',
    ];

    if (assignOpen) {
        return (
            <AssignTerminalModal
                transaction={assignOpen}
                t={t}
                onClose={() => setAssignOpen(null)}
                onDone={() => {
                    setAssignOpen(null);
                    setReload((x) => x + 1);
                }}
            />
        );
    }

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
                    gridTemplateColumns: 'repeat(7, minmax(110px, 1fr)) auto auto',
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
                <select
                    value={filters.workshopId}
                    onChange={(e) =>
                        setFilters((p) => ({ ...p, workshopId: e.target.value, branchId: '', terminalId: '' }))
                    }
                    style={inputStyle}
                >
                    <option value="">{t('opt.allWorkshops')}</option>
                    {options.workshops.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                <select
                    value={filters.branchId}
                    onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value, terminalId: '' }))}
                    style={inputStyle}
                    disabled={!filters.workshopId}
                >
                    <option value="">{t('opt.allBranches')}</option>
                    {options.branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                <select
                    value={filters.terminalId}
                    onChange={(e) => setFilters((p) => ({ ...p, terminalId: e.target.value }))}
                    style={inputStyle}
                    disabled={!filters.workshopId || filters.unassigned}
                >
                    <option value="">{t('opt.allTerminals')}</option>
                    {filterTerminals.map((term) => (
                        <option key={term.id} value={term.id}>{terminalOptionLabel(term)}</option>
                    ))}
                </select>
                <select
                    value={filters.invoiced}
                    onChange={(e) => setFilters((p) => ({ ...p, invoiced: e.target.value }))}
                    style={inputStyle}
                >
                    <option value="">{t('opt.allInvoiceStates')}</option>
                    <option value="true">{t('opt.invoicedOnly')}</option>
                    <option value="false">{t('opt.notInvoicedOnly')}</option>
                </select>
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
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, whiteSpace: 'nowrap' }}>
                    <input
                        type="checkbox"
                        checked={filters.unassigned}
                        onChange={(e) => setFilters((p) => ({ ...p, unassigned: e.target.checked }))}
                    />
                    {t('tx.unassignedOnly')}
                </label>
                <button type="button" style={btnPrimary} onClick={() => setReload((x) => x + 1)}>
                    {t('common.apply')}
                </button>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
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
                    <strong>{t('tx.platformFeeVat')}</strong> {SAR(totals.platformFeeVat || 0)}
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
                                <td colSpan={headers.length} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={headers.length} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('tx.empty')}
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => {
                                const sc = STATUS_COLORS[r.status] || { bg: '#e5e7eb', color: '#374151' };
                                return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                            {r.capturedAt ? fmtDateTime(r.capturedAt) : t('common.emDash')}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            {r.terminalCode ? (
                                                <>
                                                    <div style={{ fontWeight: 600 }}>{r.terminalCode}</div>
                                                    {r.terminalLabel && (
                                                        <div style={{ color: '#6b7280', fontSize: 11 }}>{r.terminalLabel}</div>
                                                    )}
                                                </>
                                            ) : (
                                                <span style={badge({ bg: '#fef3c7', color: '#92400e' })}>
                                                    {t('tx.unassigned')}
                                                </span>
                                            )}
                                            {r.terminalId && (
                                                <div style={{ marginTop: 4 }}>
                                                    <ModeBadge mode={r.settlementMode} t={t} />
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            {r.deviceLabel || t('common.emDash')}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            <div>{r.workshopName || t('common.emDash')}</div>
                                            <div style={{ color: '#6b7280', fontSize: 11 }}>{r.branchName || t('common.emDash')}</div>
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            {r.invoiceNo || (
                                                <>
                                                    <span style={badge({ bg: '#dbeafe', color: '#1e40af' })}>
                                                        {t('tx.notInvoiced')}
                                                    </span>
                                                    {r.reference && (
                                                        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>
                                                            {r.reference}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                            {r.cardScheme || r.cardLast4 ? (
                                                <div>
                                                    {[r.cardScheme, r.cardLast4 ? `•••• ${r.cardLast4}` : null]
                                                        .filter(Boolean)
                                                        .join(' ')}
                                                </div>
                                            ) : null}
                                            {r.rrn && <div style={{ color: '#6b7280', fontSize: 11 }}>RRN {r.rrn}</div>}
                                            {!r.cardScheme && !r.cardLast4 && !r.rrn && t('common.emDash')}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>
                                            {SAR(r.gross)}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, color: '#dc2626' }}>
                                            {SAR(r.bankFee)}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13, color: '#16a34a' }}>
                                            {SAR(r.platformFee)}
                                            <FeeVatNote amount={r.platformFeeVat} t={t} />
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
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {!r.refundOfId && !r.journalId && (
                                                    <button
                                                        type="button"
                                                        style={{
                                                            ...btn,
                                                            fontSize: 12,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                            ...(r.needsTerminal ? { borderColor: '#fde68a', color: '#92400e' } : {}),
                                                        }}
                                                        onClick={() => setAssignOpen(r)}
                                                    >
                                                        <Link2 size={12} />
                                                        {r.needsTerminal ? t('tx.assign') : t('tx.reassign')}
                                                    </button>
                                                )}
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
                                            </div>
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
    const refundable = Math.max(
        0,
        Math.round((Number(transaction.gross || 0) - Number(transaction.refundedAmount || 0)) * 100) / 100,
    );
    const [amount, setAmount] = useState(refundable);
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
                        max={refundable}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        style={inputStyle}
                    />
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                        {t('refund.max', { amount: SAR(refundable) })}
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

function AssignTerminalModal({ transaction, onClose, onDone, t }) {
    const options = useSoftPosOptions(transaction.workshopId);
    const branchTerminals = options.terminals.filter((term) => term.branchId === transaction.branchId);
    const [terminalId, setTerminalId] = useState(transaction.terminalId || '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const submit = async () => {
        if (!terminalId) {
            setErr(t('err.terminalRequired'));
            return;
        }
        setSaving(true);
        setErr('');
        try {
            await assignSoftPosTransactionTerminal(transaction.id, terminalId);
            onDone();
        } catch (e) {
            setErr(e?.message || t('err.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminModalAsScreen
            title={t('assign.title', { ref: transaction.invoiceNo || transaction.reference || transaction.id })}
            onClose={onClose}
        >
            <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
                <div style={{ fontSize: 13, color: '#374151' }}>
                    {transaction.workshopName} · {transaction.branchName} · {SAR(transaction.gross)}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{t('assign.hint')}</div>
                <Field label={t('assign.terminal')} full>
                    <select
                        value={terminalId}
                        onChange={(e) => setTerminalId(e.target.value)}
                        style={inputStyle}
                        disabled={options.loading}
                    >
                        <option value="">{options.loading ? t('common.loading') : t('opt.selectTerminal')}</option>
                        {branchTerminals.map((term) => (
                            <option key={term.id} value={term.id}>{terminalOptionLabel(term)}</option>
                        ))}
                    </select>
                </Field>
                {!options.loading && branchTerminals.length === 0 && (
                    <div style={{ fontSize: 12, color: '#92400e' }}>{t('assign.noTerminals')}</div>
                )}
                {err && <div style={{ color: '#dc2626', fontSize: 13 }}>{err}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" style={btn} onClick={onClose} disabled={saving}>
                        {t('common.cancel')}
                    </button>
                    <button type="button" style={btnPrimary} onClick={submit} disabled={saving}>
                        {saving ? t('common.saving') : t('assign.submit')}
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
    const [lockingId, setLockingId] = useState('');

    const toggleTerminalLock = async (term) => {
        const nextLocked = term.deviceLocked === false;
        setLockingId(term.id);
        try {
            await updateSoftPosTerminal(term.id, { deviceLocked: nextLocked });
            setRows((prev) =>
                prev.map((row) => (row.id === term.id ? { ...row, deviceLocked: nextLocked } : row)),
            );
        } catch (err) {
            onError(err?.message || t('err.saveFailed'));
        } finally {
            setLockingId('');
        }
    };

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
        'th.mode',
        'th.nearpayId',
        'th.devices',
        'th.terminalLock',
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
                                <td colSpan={headers.length} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={headers.length} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
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
                                    <td style={{ padding: '8px 10px' }}>
                                        <ModeBadge mode={term.settlementMode} t={t} />
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                        {term.nearpayTerminalId || (
                                            <span style={{ color: '#6b7280' }}>{t('term.nearpayUsesTid')}</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{term.activeDevices ?? 0}</td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={term.deviceLocked !== false}
                                            aria-label={t('th.terminalLock')}
                                            title={t('term.lockHint')}
                                            disabled={lockingId === term.id}
                                            onClick={() => toggleTerminalLock(term)}
                                            style={{
                                                width: 42,
                                                height: 24,
                                                borderRadius: 999,
                                                border: 'none',
                                                padding: 0,
                                                background: term.deviceLocked !== false ? '#111827' : '#d1d5db',
                                                position: 'relative',
                                                cursor: lockingId === term.id ? 'wait' : 'pointer',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    top: 3,
                                                    left: term.deviceLocked !== false ? 21 : 3,
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: 999,
                                                    background: '#fff',
                                                    transition: 'left 0.15s ease',
                                                }}
                                            />
                                        </button>
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

function TerminalModal({ initial = {}, onClose, onDone, t }) {
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
        settlementMode: initial.settlementMode || 'merchant_direct',
        nearpayTerminalId: initial.nearpayTerminalId || '',
        nearpayClientUuid: initial.nearpayClientUuid || '',
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const options = useSoftPosOptions(form.workshopId);
    const bankAccounts = options.bankAccounts.filter(
        (a) => !a.branchId || !form.branchId || a.branchId === form.branchId,
    );

    const submit = async () => {
        if (!form.workshopId || !form.branchId) {
            setErr(t('err.workshopBranchRequired'));
            return;
        }
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
                const nextCode = String(form.terminalCode || '').trim();
                const previousCode = String(initial.terminalCode || '').trim();
                if (nextCode && nextCode !== previousCode) {
                    payload.overwriteTransactions = window.confirm(t('term.overwriteTx'));
                }
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
                <Field label={t('term.workshop')}>
                    <select
                        value={form.workshopId}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                workshopId: e.target.value,
                                branchId: '',
                                bankCashBankAccountId: '',
                            }))
                        }
                        style={inputStyle}
                        disabled={!!initial.id}
                    >
                        <option value="">{t('opt.selectWorkshop')}</option>
                        {initial.id && !options.workshops.some((w) => w.id === form.workshopId) && (
                            <option value={form.workshopId}>{initial.workshopName || form.workshopId}</option>
                        )}
                        {options.workshops.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </Field>
                <Field label={t('term.branch')}>
                    <select
                        value={form.branchId}
                        onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                        style={inputStyle}
                        disabled={!!initial.id || !form.workshopId}
                    >
                        <option value="">{t('opt.selectBranch')}</option>
                        {initial.id && !options.branches.some((b) => b.id === form.branchId) && (
                            <option value={form.branchId}>{initial.branchName || form.branchId}</option>
                        )}
                        {options.branches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </Field>
                <Field label={t('term.settlementMode')} full>
                    <select
                        value={form.settlementMode}
                        onChange={(e) => setForm((p) => ({ ...p, settlementMode: e.target.value }))}
                        style={inputStyle}
                    >
                        <option value="merchant_direct">{t('mode.merchant_direct')}</option>
                        <option value="platform_collect">{t('mode.platform_collect')}</option>
                    </select>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                        {t(`mode.${form.settlementMode}.hint`)}
                    </div>
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
                <Field label={t('term.nearpayTerminalId')}>
                    <input
                        value={form.nearpayTerminalId}
                        onChange={(e) => setForm((p) => ({ ...p, nearpayTerminalId: e.target.value }))}
                        style={inputStyle}
                        placeholder={t('term.ph.nearpayTerminalId')}
                    />
                </Field>
                <Field label={t('term.nearpayClientUuid')}>
                    <input
                        value={form.nearpayClientUuid}
                        onChange={(e) => setForm((p) => ({ ...p, nearpayClientUuid: e.target.value }))}
                        style={inputStyle}
                        placeholder={t('term.ph.nearpayClientUuid')}
                    />
                </Field>
                <Field label={t('term.label')} full>
                    <input
                        value={form.label}
                        onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                        style={inputStyle}
                    />
                </Field>
                <Field label={t('term.bankAccount')}>
                    <select
                        value={form.bankCashBankAccountId}
                        onChange={(e) =>
                            setForm((p) => ({ ...p, bankCashBankAccountId: e.target.value }))
                        }
                        style={inputStyle}
                        disabled={!form.workshopId}
                    >
                        <option value="">{t('opt.none')}</option>
                        {form.bankCashBankAccountId &&
                            !bankAccounts.some((a) => a.id === form.bankCashBankAccountId) && (
                                <option value={form.bankCashBankAccountId}>
                                    {initial.bankCashBankAccountName || form.bankCashBankAccountId}
                                </option>
                            )}
                        {bankAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}{a.bankName ? ` — ${a.bankName}` : ''}
                            </option>
                        ))}
                    </select>
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

// ===== Devices =====
function DevicesTab({ onError, t }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ workshopId: '', status: '' });
    const [reload, setReload] = useState(0);
    const [editing, setEditing] = useState(null);
    const [pairing, setPairing] = useState(null);
    const options = useSoftPosOptions('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await listSoftPosDevices(filters);
                if (!cancelled) setRows(pickArr(res));
            } catch (err) {
                if (!cancelled) onError(err?.message || t('err.loadDevices'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload]);

    const run = async (fn, confirmKey) => {
        if (confirmKey && !window.confirm(t(confirmKey))) return;
        try {
            await fn();
            setReload((x) => x + 1);
        } catch (e) {
            onError(e?.message || t('err.saveFailed'));
        }
    };

    const newCode = async (device) => {
        if (device.status === 'active' && !window.confirm(t('dev.confirmNewCode'))) return;
        try {
            const res = await regenerateSoftPosDeviceCode(device.id);
            setPairing(res);
            setReload((x) => x + 1);
        } catch (e) {
            onError(e?.message || t('err.saveFailed'));
        }
    };

    if (pairing) {
        return <PairingCodeScreen pairing={pairing} t={t} onClose={() => setPairing(null)} />;
    }

    if (editing) {
        return (
            <DeviceModal
                initial={editing.id ? editing : {}}
                t={t}
                onClose={() => setEditing(null)}
                onCreated={(res) => {
                    setEditing(null);
                    setPairing(res);
                    setReload((x) => x + 1);
                }}
                onDone={() => {
                    setEditing(null);
                    setReload((x) => x + 1);
                }}
            />
        );
    }

    const headers = ['th.device', 'th.terminal', 'th.workshopBranch', 'th.status', 'th.lastSeen', 'th.actions'];

    return (
        <div style={card}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>{t('dev.intro')}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <select
                    value={filters.workshopId}
                    onChange={(e) => setFilters((p) => ({ ...p, workshopId: e.target.value }))}
                    style={{ ...inputStyle, width: 240 }}
                >
                    <option value="">{t('opt.allWorkshops')}</option>
                    {options.workshops.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
                <select
                    value={filters.status}
                    onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                    style={{ ...inputStyle, width: 180 }}
                >
                    <option value="">{t('common.all')}</option>
                    <option value="pending">{t('devStatus.pending')}</option>
                    <option value="active">{t('devStatus.active')}</option>
                    <option value="revoked">{t('devStatus.revoked')}</option>
                </select>
                <button type="button" style={btn} onClick={() => setReload((x) => x + 1)}>
                    {t('common.apply')}
                </button>
                <div style={{ flex: 1 }} />
                <button
                    type="button"
                    style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setEditing({})}
                >
                    <Plus size={14} /> {t('dev.new')}
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
                                <td colSpan={headers.length} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={headers.length} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('dev.empty')}
                                </td>
                            </tr>
                        ) : (
                            rows.map((d) => {
                                const sc = DEVICE_STATUS_COLORS[d.status] || { bg: '#e5e7eb', color: '#374151' };
                                return (
                                    <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            <div style={{ fontWeight: 600 }}>{d.label}</div>
                                            {(d.deviceModel || d.appVersion) && (
                                                <div style={{ color: '#6b7280', fontSize: 11 }}>
                                                    {[d.deviceModel, d.appVersion ? `v${d.appVersion}` : null]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            {d.terminalCode ? (
                                                <>
                                                    <div style={{ fontWeight: 600 }}>{d.terminalCode}</div>
                                                    {d.terminalLabel && (
                                                        <div style={{ color: '#6b7280', fontSize: 11 }}>{d.terminalLabel}</div>
                                                    )}
                                                    {d.terminalStatus && d.terminalStatus !== 'active' && (
                                                        <div style={{ color: '#dc2626', fontSize: 11 }}>{statusLabel(t, d.terminalStatus)}</div>
                                                    )}
                                                </>
                                            ) : (
                                                <span style={badge({ bg: '#fef3c7', color: '#92400e' })}>{t('tx.unassigned')}</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                            <div>{d.workshopName || t('common.emDash')}</div>
                                            <div style={{ color: '#6b7280', fontSize: 11 }}>{d.branchName || t('common.emDash')}</div>
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <span style={badge(sc)}>{t(`devStatus.${d.status}`)}</span>
                                            {d.status === 'pending' && (
                                                <div style={{ fontSize: 11, marginTop: 4, color: d.pairingCodeExpired ? '#dc2626' : '#6b7280' }}>
                                                    {d.pairingCodeExpired
                                                        ? t('dev.codeExpired')
                                                        : t('dev.codeExpires', { at: fmtDateTime(d.pairingCodeExpiresAt) })}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontSize: 12 }}>
                                            {d.lastSeenAt ? fmtDateTime(d.lastSeenAt) : t('common.emDash')}
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <div style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                                                <button
                                                    type="button"
                                                    style={{ ...btn, border: 'none', padding: 0 }}
                                                    title={t('common.edit')}
                                                    onClick={() => setEditing(d)}
                                                >
                                                    <Pencil size={14} color="#6b7280" />
                                                </button>
                                                <button
                                                    type="button"
                                                    style={{ ...btn, border: 'none', padding: 0 }}
                                                    title={t('dev.newCode')}
                                                    onClick={() => newCode(d)}
                                                    disabled={!d.terminalId}
                                                >
                                                    <KeyRound size={14} color={d.terminalId ? '#1d4ed8' : '#cbd5e1'} />
                                                </button>
                                                {d.status !== 'revoked' && (
                                                    <button
                                                        type="button"
                                                        style={{ ...btn, border: 'none', padding: 0 }}
                                                        title={t('dev.revoke')}
                                                        onClick={() => run(() => revokeSoftPosDevice(d.id), 'dev.confirmRevoke')}
                                                    >
                                                        <Ban size={14} color="#b45309" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    style={{ ...btn, border: 'none', padding: 0 }}
                                                    title={t('common.delete')}
                                                    onClick={() => run(() => deleteSoftPosDevice(d.id), 'dev.confirmDelete')}
                                                >
                                                    <Trash2 size={14} color="#dc2626" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function DeviceModal({ initial = {}, onClose, onCreated, onDone, t }) {
    const [workshopId, setWorkshopId] = useState(initial.workshopId || '');
    const [terminalId, setTerminalId] = useState(initial.terminalId || '');
    const [label, setLabel] = useState(initial.label || '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const options = useSoftPosOptions(workshopId);
    const branchName = (id) => options.branches.find((b) => b.id === id)?.name || '';

    const submit = async () => {
        if (!label.trim()) {
            setErr(t('err.labelRequired'));
            return;
        }
        if (!terminalId) {
            setErr(t('err.terminalRequired'));
            return;
        }
        setSaving(true);
        setErr('');
        try {
            if (initial.id) {
                await updateSoftPosDevice(initial.id, { label: label.trim(), terminalId });
                onDone();
            } else {
                const res = await createSoftPosDevice({ label: label.trim(), terminalId });
                onCreated(res);
            }
        } catch (e) {
            setErr(e?.message || t('err.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminModalAsScreen title={initial.id ? t('dev.editTitle') : t('dev.newTitle')} onClose={onClose}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 720 }}>
                <Field label={t('dev.label')} full>
                    <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        style={inputStyle}
                        placeholder={t('dev.ph.label')}
                        maxLength={120}
                    />
                </Field>
                <Field label={t('term.workshop')}>
                    <select
                        value={workshopId}
                        onChange={(e) => {
                            setWorkshopId(e.target.value);
                            setTerminalId('');
                        }}
                        style={inputStyle}
                    >
                        <option value="">{t('opt.selectWorkshop')}</option>
                        {options.workshops.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </Field>
                <Field label={t('assign.terminal')}>
                    <select
                        value={terminalId}
                        onChange={(e) => setTerminalId(e.target.value)}
                        style={inputStyle}
                        disabled={!workshopId || options.loading}
                    >
                        <option value="">{t('opt.selectTerminal')}</option>
                        {options.terminals.map((term) => (
                            <option key={term.id} value={term.id}>
                                {terminalOptionLabel(term)}{branchName(term.branchId) ? ` · ${branchName(term.branchId)}` : ''}
                            </option>
                        ))}
                    </select>
                </Field>
                {workshopId && !options.loading && options.terminals.length === 0 && (
                    <div style={{ gridColumn: 'span 2', fontSize: 12, color: '#92400e' }}>{t('dev.noTerminals')}</div>
                )}
                {initial.id && initial.status === 'active' && (
                    <div style={{ gridColumn: 'span 2', fontSize: 12, color: '#6b7280' }}>{t('dev.reassignHint')}</div>
                )}
                {err && <div style={{ gridColumn: 'span 2', color: '#dc2626', fontSize: 13 }}>{err}</div>}
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" style={btn} onClick={onClose} disabled={saving}>
                        {t('common.cancel')}
                    </button>
                    <button type="button" style={btnPrimary} onClick={submit} disabled={saving}>
                        {saving ? t('common.saving') : initial.id ? t('common.update') : t('dev.createAndCode')}
                    </button>
                </div>
            </div>
        </AdminModalAsScreen>
    );
}

function PairingCodeScreen({ pairing, onClose, t }) {
    const [copied, setCopied] = useState(false);
    const code = pairing?.pairingCode || '';
    const device = pairing?.device || {};

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <AdminModalAsScreen title={t('pair.title', { label: device.label || '' })} onClose={onClose}>
            <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
                <div style={{ fontSize: 13, color: '#374151' }}>
                    {[device.terminalCode, device.workshopName, device.branchName].filter(Boolean).join(' · ')}
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        border: '2px dashed #D4A017',
                        borderRadius: 12,
                        padding: '18px 20px',
                        background: '#fffbeb',
                    }}
                >
                    <span
                        dir="ltr"
                        style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 34, fontWeight: 800, letterSpacing: 4 }}
                    >
                        {code}
                    </span>
                    <button
                        type="button"
                        style={{ ...btn, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={copy}
                    >
                        <Copy size={14} /> {copied ? t('pair.copied') : t('pair.copy')}
                    </button>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {t('pair.expires', { at: fmtDateTime(pairing?.expiresAt) })}
                </div>
                <ol style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, color: '#374151', display: 'grid', gap: 4 }}>
                    <li>{t('pair.step1')}</li>
                    <li>{t('pair.step2')}</li>
                    <li>{t('pair.step3')}</li>
                </ol>
                <div style={{ fontSize: 12, color: '#b45309' }}>{t('pair.onlyOnce')}</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" style={btnPrimary} onClick={onClose}>
                        {t('pair.done')}
                    </button>
                </div>
            </div>
        </AdminModalAsScreen>
    );
}

// ===== Batches =====
function batchKey(b) {
    return `${b.date}|${b.workshopId}|${b.branchId}|${b.terminalId || ''}|${b.deviceId || ''}|${b.settlementMode}`;
}

function BatchesTab({ onError, t }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [devices, setDevices] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');
    const [filters, setFilters] = useState({
        workshopId: '',
        branchId: '',
        deviceId: '',
        deviceLabel: '',
        deviceKey: '',
        fromDate: '',
        toDate: '',
    });
    const [reload, setReload] = useState(0);
    const options = useSoftPosOptions(filters.workshopId);

    useEffect(() => {
        let cancelled = false;
        listSoftPosDevices({
            ...(filters.workshopId ? { workshopId: filters.workshopId } : {}),
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
        })
            .then((res) => {
                if (!cancelled) setDevices(pickArr(res));
            })
            .catch(() => {
                if (!cancelled) setDevices([]);
            });
        return () => {
            cancelled = true;
        };
    }, [filters.workshopId, filters.branchId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await listSoftPosBatches({
                    workshopId: filters.workshopId,
                    branchId: filters.branchId,
                    deviceId: filters.deviceId,
                    deviceLabel: filters.deviceLabel,
                    fromDate: filters.fromDate,
                    toDate: filters.toDate,
                    settlement: statusFilter,
                });
                if (!cancelled) setRows(pickArr(res));
            } catch (err) {
                if (!cancelled) onError(err?.message || t('err.loadBatches'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [reload, statusFilter]);

    const workshopOptions = options.workshops.map((w) => ({ value: w.id, label: w.name, searchText: w.name }));
    const branchOptions = options.branches.map((b) => ({ value: b.id, label: b.name, searchText: b.name }));
    const deviceOptions = [
        ...devices.map((d) => ({
            value: `id:${d.id}`,
            label: d.label || d.id,
            hint: [d.deviceModel, d.branchName].filter(Boolean).join(' · '),
            searchText: `${d.label || ''} ${d.deviceModel || ''} ${d.terminalCode || ''} ${d.branchName || ''}`,
        })),
        ...(options.deviceLabels || [])
            .filter((label) => !devices.some((d) => d.label === label))
            .map((label) => ({ value: `label:${label}`, label, searchText: label })),
    ];

    const headers = [
        'th.date',
        'th.terminal',
        'th.device',
        'th.workshop',
        'th.branch',
        'th.count',
        'th.gross',
        'th.bankFee',
        'th.platform',
        'th.net',
        'th.status',
    ];

    return (
        <div style={card}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <SearchSelect
                    options={workshopOptions}
                    value={filters.workshopId}
                    onChange={(workshopId) =>
                        setFilters((p) => ({
                            ...p,
                            workshopId: workshopId || '',
                            branchId: '',
                            deviceId: '',
                            deviceLabel: '',
                            deviceKey: '',
                        }))
                    }
                    placeholder={t('opt.allWorkshops')}
                    ariaLabel={t('th.workshop')}
                    clearable
                    size="sm"
                    style={{ width: 220 }}
                    loading={options.loading && !options.workshops.length}
                />
                <SearchSelect
                    options={branchOptions}
                    value={filters.branchId}
                    onChange={(branchId) =>
                        setFilters((p) => ({
                            ...p,
                            branchId: branchId || '',
                            deviceId: '',
                            deviceLabel: '',
                            deviceKey: '',
                        }))
                    }
                    placeholder={filters.workshopId ? t('opt.allBranches') : t('batch.pickWorkshop')}
                    ariaLabel={t('th.branch')}
                    clearable
                    disabled={!filters.workshopId}
                    size="sm"
                    style={{ width: 220 }}
                    loading={!!filters.workshopId && options.loading}
                />
                <SearchSelect
                    options={deviceOptions}
                    value={filters.deviceKey}
                    onChange={(deviceKey) => {
                        const raw = deviceKey || '';
                        if (raw.startsWith('label:')) {
                            setFilters((p) => ({ ...p, deviceKey: raw, deviceId: '', deviceLabel: raw.slice(6) }));
                        } else if (raw.startsWith('id:')) {
                            setFilters((p) => ({ ...p, deviceKey: raw, deviceId: raw.slice(3), deviceLabel: '' }));
                        } else {
                            setFilters((p) => ({ ...p, deviceKey: '', deviceId: '', deviceLabel: '' }));
                        }
                    }}
                    placeholder={t('opt.allDevices')}
                    ariaLabel={t('th.device')}
                    clearable
                    size="sm"
                    style={{ width: 220 }}
                />
                <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))}
                    style={{ ...inputStyle, width: 150 }}
                />
                <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))}
                    style={{ ...inputStyle, width: 150 }}
                />
                {[
                    { id: '', label: t('common.all') },
                    { id: 'settled', label: t('status.settled') },
                    { id: 'unsettled', label: t('status.unsettled') },
                ].map((chip) => (
                    <button
                        key={chip.id || 'all'}
                        type="button"
                        onClick={() => setStatusFilter(chip.id)}
                        style={{
                            border: '1px solid',
                            borderColor: statusFilter === chip.id ? '#D4A017' : '#e5e7eb',
                            background: statusFilter === chip.id ? '#D4A017' : '#fff',
                            color: '#111827',
                            borderRadius: 999,
                            padding: '6px 12px',
                            fontSize: 13,
                            cursor: 'pointer',
                        }}
                    >
                        {chip.label}
                    </button>
                ))}
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
                                <td colSpan={headers.length} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('common.loading')}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={headers.length} style={{ padding: 16, textAlign: 'center', color: '#6b7280' }}>
                                    {t('batch.empty')}
                                </td>
                            </tr>
                        ) : (
                            rows.map((b) => (
                                <tr key={batchKey(b)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.date}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        <div>{b.terminalCode || t('tx.unassigned')}</div>
                                        {b.terminalId && (
                                            <div style={{ marginTop: 4 }}>
                                                <ModeBadge mode={b.settlementMode} t={t} />
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.deviceLabel || t('common.emDash')}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.workshopName}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.branchName}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{b.count}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{SAR(b.gross)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, color: '#dc2626' }}>{SAR(b.bankFee)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, color: '#16a34a' }}>
                                        {SAR(b.platformFee)}
                                        <FeeVatNote amount={b.platformFeeVat} t={t} />
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{SAR(b.netToMerchant)}</td>
                                    <td
                                        style={{
                                            padding: '8px 10px',
                                            fontSize: 13,
                                            fontWeight: 600,
                                            color:
                                                b.status === 'settled'
                                                    ? '#16a34a'
                                                    : b.status === 'partial'
                                                      ? '#d97706'
                                                      : '#6b7280',
                                        }}
                                    >
                                        {statusLabel(t, b.status)}
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

// ===== Rules =====
function formatRuleDate(value) {
    const ymd = String(value).slice(0, 10);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!match) return ymd;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)).toLocaleDateString();
}

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
                                        {r.effectiveFrom ? formatRuleDate(r.effectiveFrom) : t('common.emDash')}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {r.effectiveTo ? formatRuleDate(r.effectiveTo) : t('common.emDash')}
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
    const today = toRiyadhDateISO();
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
                                        {r.capturedAt ? fmtDateTime(r.capturedAt) : t('common.emDash')}
                                    </td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.reference || t('common.emDash')}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.refundOfId || t('common.emDash')}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.workshopName || t('common.emDash')}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{r.branchName || t('common.emDash')}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>{SAR(r.gross)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>{SAR(r.bankFee)}</td>
                                    <td style={{ padding: '8px 10px', fontSize: 13 }}>
                                        {SAR(r.platformFee)}
                                        <FeeVatNote amount={r.platformFeeVat} t={t} />
                                    </td>
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
    const options = useSoftPosOptions('');
    const workshopOptions = options.workshops.map((w) => ({ value: w.id, label: w.name, searchText: w.name }));
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const [form, setForm] = useState({
        workshopId: '',
        periodStart: firstOfMonth.toISOString().slice(0, 10),
        periodEnd: toRiyadhDateISO(),
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
                if (!cancelled) setStatements(pickArr(res));
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
                    <SearchSelect
                        options={workshopOptions}
                        value={form.workshopId}
                        onChange={(workshopId) => setForm((p) => ({ ...p, workshopId: workshopId || '' }))}
                        placeholder={t('batch.pickWorkshop')}
                        ariaLabel={t('th.workshop')}
                        clearable
                        size="sm"
                        style={{ width: 260 }}
                        loading={options.loading && !options.workshops.length}
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

function SoftPosToggle({ checked, disabled, onChange, ariaLabel }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            style={{
                width: 46,
                height: 26,
                borderRadius: 999,
                border: 'none',
                padding: 2,
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: checked ? '#D4A017' : '#d1d5db',
                opacity: disabled ? 0.55 : 1,
                transition: 'background 0.15s ease',
                flexShrink: 0,
            }}
        >
            <span
                style={{
                    display: 'block',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#fff',
                    transform: checked ? 'translateX(20px)' : 'translateX(0)',
                    transition: 'transform 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}
            />
        </button>
    );
}

const ACCESS_METHODS = [
    'softpos',
    'card',
    'cash',
    'bank_transfer',
    'tabby',
    'tamara',
    'monthly_billing',
];

const branchMethodOn = (b) => (b.enabled ?? b.softPosEnabled) !== false;

function AccessTab({ onError, t, canEdit }) {
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState('');
    const [method, setMethod] = useState('softpos');
    const [methodGlobals, setMethodGlobals] = useState({});
    const [branches, setBranches] = useState([]);
    const [workshopId, setWorkshopId] = useState('');
    const [workshops, setWorkshops] = useState([]);

    const methodName = t(`access.method.${method}`);
    const globalEnabled = methodGlobals[method] !== false;
    const loadSeq = useRef(0);

    const load = useCallback(async () => {
        const seq = ++loadSeq.current;
        setLoading(true);
        try {
            const [access, opts] = await Promise.all([
                getSoftPosAccess({ method, ...(workshopId ? { workshopId } : {}) }),
                getSoftPosOptions(),
            ]);
            // A newer method/workshop selection superseded this request.
            if (seq !== loadSeq.current) return;
            setMethodGlobals({
                ...Object.fromEntries(
                    (Array.isArray(access?.methods) ? access.methods : []).map((m) => [
                        m.code,
                        m.globalEnabled !== false,
                    ]),
                ),
                [method]: access?.globalEnabled !== false,
            });
            setBranches(Array.isArray(access?.branches) ? access.branches : []);
            setWorkshops(pickArr(opts, 'workshops'));
        } catch (err) {
            if (seq === loadSeq.current) onError?.(err?.message || t('access.loadError'));
        } finally {
            if (seq === loadSeq.current) setLoading(false);
        }
    }, [method, workshopId, onError, t]);

    useEffect(() => {
        load();
    }, [load]);

    const onToggleGlobal = async (next) => {
        if (!canEdit) return;
        setSavingKey('global');
        const prev = globalEnabled;
        setMethodGlobals((g) => ({ ...g, [method]: next }));
        try {
            await setSoftPosGlobalAccess(next, method);
        } catch (err) {
            setMethodGlobals((g) => ({ ...g, [method]: prev }));
            onError?.(err?.message || t('access.saveError'));
        } finally {
            setSavingKey('');
        }
    };

    const setBranchOn = (key, on) =>
        setBranches((rows) => rows.map((b) => (b.id === key ? { ...b, enabled: on, softPosEnabled: on } : b)));

    const onToggleBranch = async (branch, next) => {
        if (!canEdit) return;
        const key = branch.id;
        setSavingKey(key);
        setBranchOn(key, next);
        try {
            const res = await setSoftPosBranchAccess(key, next, method);
            // Prefer server boolean so a no-op/old API cannot leave a fake Disabled state.
            const saved =
                typeof res?.enabled === 'boolean'
                    ? res.enabled
                    : typeof res?.softPosEnabled === 'boolean'
                      ? res.softPosEnabled
                      : next;
            setBranchOn(key, saved);
        } catch (err) {
            setBranchOn(key, !next);
            onError?.(err?.message || t('access.saveError'));
        } finally {
            setSavingKey('');
        }
    };

    return (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t('access.title')}</div>
                <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>{t('access.subtitle')}</div>
                <div
                    role="tablist"
                    aria-label={t('access.methodsLabel')}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}
                >
                    {ACCESS_METHODS.map((code) => {
                        const active = code === method;
                        const off = methodGlobals[code] === false;
                        return (
                            <button
                                key={code}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                disabled={(loading || Boolean(savingKey)) && !active}
                                onClick={() => {
                                    if (active) return;
                                    setLoading(true);
                                    setMethod(code);
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '7px 14px',
                                    borderRadius: 999,
                                    border: `1px solid ${active ? '#d4a017' : '#e5e7eb'}`,
                                    background: active ? '#fef3c7' : '#fff',
                                    color: '#111827',
                                    fontWeight: active ? 700 : 600,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                }}
                            >
                                {t(`access.method.${code}`)}
                                {off ? (
                                    <span
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: '#dc2626',
                                            background: '#fee2e2',
                                            borderRadius: 999,
                                            padding: '1px 7px',
                                        }}
                                    >
                                        {t('access.globalOffShort')}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {t('access.methodTitle', { method: methodName })}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                    {method === 'softpos'
                        ? t('access.hint.softpos')
                        : t('access.hint.method', { method: methodName })}
                </div>
            </div>

            <div
                style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    background: globalEnabled ? '#fffbeb' : '#fef2f2',
                    borderBottom: '1px solid #e5e7eb',
                }}
            >
                <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{t('access.global')}</div>
                    <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                        {t('access.globalHint', { method: methodName })}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: globalEnabled ? '#16a34a' : '#dc2626' }}>
                        {globalEnabled ? t('access.enabled') : t('access.disabled')}
                    </span>
                    <SoftPosToggle
                        checked={globalEnabled}
                        disabled={!canEdit || savingKey === 'global' || loading}
                        onChange={onToggleGlobal}
                        ariaLabel={t('access.global')}
                    />
                </div>
            </div>

            <div
                style={{
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    borderBottom: '1px solid #e5e7eb',
                }}
            >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t('access.branches')}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                        value={workshopId}
                        disabled={Boolean(savingKey)}
                        onChange={(e) => {
                            setLoading(true);
                            setWorkshopId(e.target.value);
                        }}
                        style={{ ...inputStyle, width: 220, padding: '6px 10px' }}
                    >
                        <option value="">{t('access.workshopFilter')}</option>
                        {workshops.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.name}
                            </option>
                        ))}
                    </select>
                    <button type="button" style={btn} onClick={load} disabled={loading}>
                        {t('common.refresh')}
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>{t('common.loading')}</div>
            ) : branches.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>{t('access.empty')}</div>
            ) : (
                <div>
                    {branches.map((b) => {
                        const on = branchMethodOn(b);
                        const effective = globalEnabled && on;
                        return (
                            <div
                                key={b.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    padding: '12px 18px',
                                    borderBottom: '1px solid #f3f4f6',
                                }}
                            >
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{b.name}</div>
                                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                        {b.workshopName || t('common.emDash')}
                                        {!globalEnabled
                                            ? ` · ${t('access.effectiveOff')}`
                                            : !on
                                              ? ` · ${t('access.branchOff')}`
                                              : ''}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: effective ? '#16a34a' : '#dc2626',
                                        }}
                                    >
                                        {effective ? t('access.enabled') : t('access.disabled')}
                                    </span>
                                    <SoftPosToggle
                                        checked={on}
                                        disabled={!canEdit || savingKey === b.id || loading}
                                        onChange={(next) => onToggleBranch(b, next)}
                                        ariaLabel={`${b.name} ${methodName}`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

