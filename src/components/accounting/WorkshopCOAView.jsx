import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen,
    ChevronDown,
    CheckCircle2,
    Pencil,
    Printer,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    X,
    Building2,
} from 'lucide-react';
import {
    createAccount,
    deleteAccount,
    getAccounts,
    getAccountsBranches,
    getAccountsTree,
    getBalanceSheet,
    getPLReport,
    getTrialBalance,
    updateAccount,
} from '../../services/accountsApi';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';
import {
    buildWorkshopCoaNavigationUrl,
    filterWorkshopPettyCashCoaList,
    isWorkshopCoaLedgerClickable,
    isWorkshopPettyCashCoaControlAccount,
    pruneWorkshopPettyCashCoaTree,
    WORKSHOP_COA_CONTROL_BADGES,
} from '../../pages/workshop/workshopCoaAccountRouting';
import {
    loadSaAccountingDateRange,
    startOfMonthISO,
    todayISO,
} from '../../pages/admin/saAccountingDateRange';

const parseArr = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.list)) return res.list;
    if (res && Array.isArray(res.entries)) return res.entries;
    if (res && Array.isArray(res.items)) return res.items;
    return [];
};

const palette = {
    primary: '#D4A017',
    primaryHover: '#B8860B',
    pageBg: '#f5f5f5',
    cardBg: '#ffffff',
    sectionHeaderBg: '#fafafa',
    textPrimary: '#1a1a1a',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    activeBadgeBg: '#dcfce7',
    activeBadgeText: '#16a34a',
    autoBadgeBg: '#fef3c7',
    autoBadgeText: '#d97706',
    delete: '#ef4444',
    edit: '#6b7280',
};

const typeGroups = [
    { key: 'ASSET', label: 'Assets', color: '#3b82f6' },
    { key: 'LIABILITY', label: 'Liabilities', color: '#ef4444' },
    { key: 'EQUITY', label: 'Equity', color: '#8b5cf6' },
    { key: 'INCOME', label: 'Revenue', color: '#16a34a' },
    { key: 'EXPENSE', label: 'Expenses', color: '#f59e0b' },
];

const selectTypes = [
    { value: '', label: 'All Types' },
    { value: 'ASSET', label: 'Asset' },
    { value: 'LIABILITY', label: 'Liability' },
    { value: 'EQUITY', label: 'Equity' },
    { value: 'INCOME', label: 'Income' },
    { value: 'EXPENSE', label: 'Expense' },
];

const subtypeByType = {
    ASSET: ['CURRENT', 'FIXED', 'OTHER'],
    LIABILITY: ['CURRENT', 'LONG_TERM', 'OTHER'],
    EQUITY: ['OWNERS_EQUITY', 'RETAINED_EARNINGS', 'OTHER_EQUITY'],
    INCOME: ['OPERATING_REVENUE', 'OTHER_INCOME'],
    EXPENSE: ['COST_OF_GOODS_SOLD', 'OPERATING_EXPENSE', 'OTHER_EXPENSE'],
};

function normalizeAccount(raw) {
    return {
        ...raw,
        id: String(raw.id),
        parentId: raw.parentId ? String(raw.parentId) : null,
        branchId: raw.branchId ? String(raw.branchId) : null,
        name: raw.name || '',
        code: raw.code || '',
        type: raw.type || '',
        subType: raw.subType || '',
        description: raw.description || '',
        isAutoSeed: Boolean(raw.isAutoSeed || raw.isAutoLinked),
        closingDebit: Number(raw.closingDebit || 0),
        closingCredit: Number(raw.closingCredit || 0),
    };
}

function toLabel(value = '') {
    return String(value)
        .toLowerCase()
        .split('_')
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ');
}

function getNormalBalance(type) {
    if (type === 'ASSET' || type === 'EXPENSE') return 'Debit';
    return 'Credit';
}

function getErrorMessage(error) {
    return error?.message || 'Something went wrong. Please try again.';
}

function flattenTree(nodes = [], depth = 0, acc = []) {
    nodes.forEach((node, idx) => {
        const marker =
            depth === 0
                ? ''
                : `${'  '.repeat(Math.max(depth - 1, 0))}${
                      idx === nodes.length - 1 ? '└ ' : '├ '
                  }`;
        acc.push({ ...node, _depth: depth, _marker: marker });
        if (Array.isArray(node.children) && node.children.length) {
            flattenTree(node.children, depth + 1, acc);
        }
    });
    return acc;
}

const baseForm = {
    name: '',
    code: '',
    type: 'ASSET',
    subType: 'CURRENT',
    parentId: '',
    branchId: '',
    description: '',
    status: 'active',
};

const reportCard = {
    border: `1px solid ${palette.border}`,
    borderRadius: 10,
    padding: 16,
    background: '#fff',
};

const fmtMoney = (n) => `SAR ${Number(n || 0).toFixed(2)}`;

/** Closing balance from posted journals (same basis as Trial Balance). */
function formatFinalBalance(acc) {
    const dr = Number(acc.closingDebit || 0);
    const cr = Number(acc.closingCredit || 0);
    if (dr >= 0.005) return { text: `${fmtMoney(dr)} Dr`, color: '#1d4ed8' };
    if (cr >= 0.005) return { text: `${fmtMoney(cr)} Cr`, color: '#b91c1c' };
    return { text: '—', color: palette.textSecondary };
}

const fmtDateLabel = (d) => {
    if (!d) return '-';
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return d;
    return x.toLocaleDateString('en-GB');
};

/**
 * Workshop-scoped Chart of Accounts view backed by the real `/accounts` API.
 *
 * Branches dropdown filters the COA list and the report endpoints. Branch field
 * on the New Account modal lets a branch-specific account live alongside shared
 * ones (cash registers, branch bank accounts, etc.).
 */
export default function WorkshopCOAView({ readOnly = false }) {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [treeAccounts, setTreeAccounts] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reloadTick, setReloadTick] = useState(0);

    const [search, setSearch] = useState('');
    const [selectedType, setSelectedType] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [form, setForm] = useState(baseForm);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [parentSearch, setParentSearch] = useState('');

    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [deleteLoadingId, setDeleteLoadingId] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [activeTab, setActiveTab] = useState('Chart of Accounts');

    const [tbFilters, setTbFilters] = useState({ dateFrom: '', dateTo: '', branchId: '' });
    const [tbData, setTbData] = useState({
        accounts: [],
        totalDebits: 0,
        totalCredits: 0,
        isBalanced: true,
    });
    const [tbLoading, setTbLoading] = useState(false);

    const [plFilters, setPlFilters] = useState({ dateFrom: '', dateTo: '', branchId: '' });
    const [plData, setPlData] = useState(null);
    const [plLoading, setPlLoading] = useState(false);

    const [bsFilters, setBsFilters] = useState({
        asOf: new Date().toISOString().slice(0, 10),
        branchId: '',
    });
    const [bsData, setBsData] = useState(null);
    const [bsLoading, setBsLoading] = useState(false);

    const openAccountLedger = useCallback(
        (acc) => {
            if (!isWorkshopCoaLedgerClickable(acc)) return;
            const storedRange = loadSaAccountingDateRange();
            navigate(
                buildWorkshopCoaNavigationUrl(acc, {
                    dateFrom: storedRange.dateFrom || startOfMonthISO(),
                    dateTo: storedRange.dateTo || todayISO(),
                    branchId: selectedBranch || acc.branchId || '',
                }),
            );
        },
        [navigate, selectedBranch],
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const list = await getAccountsBranches();
                if (cancelled) return;
                setBranches(filterPortalVisibleBranches(parseArr(list)));
            } catch {
                /* branches optional */
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const params = { _t: Date.now() };
                if (selectedType) params.type = selectedType;
                if (selectedBranch) params.branchId = selectedBranch;
                const treeParams = selectedBranch ? { branchId: selectedBranch } : {};
                const [flatRaw, treeRaw] = await Promise.all([
                    getAccounts(params),
                    getAccountsTree(treeParams),
                ]);
                if (cancelled) return;
                const flat = parseArr(flatRaw);
                const tree = parseArr(treeRaw);
                const normalizedFlat = filterWorkshopPettyCashCoaList(
                    flat.map(normalizeAccount),
                ).sort((a, b) => a.code.localeCompare(b.code));
                const normalizedTree = pruneWorkshopPettyCashCoaTree(tree.map(normalizeAccount));
                setAccounts(normalizedFlat);
                setTreeAccounts(normalizedTree);
            } catch (err) {
                if (!cancelled) setError(getErrorMessage(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [reloadTick, selectedType, selectedBranch]);

    const treeFlat = useMemo(() => flattenTree(treeAccounts), [treeAccounts]);

    const branchById = useMemo(() => {
        const m = new Map();
        branches.forEach((b) => m.set(String(b.id), b.name));
        return m;
    }, [branches]);

    const parentNameById = useMemo(() => {
        const map = new Map();
        accounts.forEach((acc) => map.set(String(acc.id), acc.name));
        return map;
    }, [accounts]);

    const filteredAccounts = useMemo(() => {
        const q = search.trim().toLowerCase();
        return accounts.filter((acc) => {
            const matchSearch = q
                ? `${acc.code} ${acc.name} ${acc.description || ''}`
                      .toLowerCase()
                      .includes(q)
                : true;
            return matchSearch;
        });
    }, [accounts, search]);

    const grouped = useMemo(() => {
        const map = { ASSET: [], LIABILITY: [], EQUITY: [], INCOME: [], EXPENSE: [] };
        filteredAccounts.forEach((acc) => {
            if (map[acc.type]) map[acc.type].push(acc);
        });
        Object.keys(map).forEach((k) => {
            map[k].sort((a, b) => a.code.localeCompare(b.code));
        });
        return map;
    }, [filteredAccounts]);

    const totalsByType = useMemo(() => {
        const result = { ASSET: 0, LIABILITY: 0, EQUITY: 0, INCOME: 0, EXPENSE: 0 };
        accounts.forEach((acc) => {
            const opening = Number(acc.openingBalance || 0);
            if (result[acc.type] !== undefined && Number.isFinite(opening)) {
                result[acc.type] += opening;
            }
        });
        return result;
    }, [accounts]);

    const parentOptions = useMemo(() => {
        const q = parentSearch.trim().toLowerCase();
        return accounts
            .filter((acc) => !editingId || String(acc.id) !== String(editingId))
            .filter((acc) =>
                q ? `${acc.code} ${acc.name}`.toLowerCase().includes(q) : true,
            );
    }, [accounts, editingId, parentSearch]);

    const subtypeOptions = subtypeByType[form.type] || [];

    const openCreate = () => {
        setEditingId('');
        setForm({ ...baseForm, branchId: selectedBranch || '' });
        setParentSearch('');
        setSubmitError('');
        setIsModalOpen(true);
    };

    const openEdit = (acc) => {
        setEditingId(String(acc.id));
        setForm({
            name: acc.name || '',
            code: acc.code || '',
            type: acc.type || 'ASSET',
            subType: acc.subType || subtypeByType[acc.type]?.[0] || 'CURRENT',
            parentId: acc.parentId || '',
            branchId: acc.branchId || '',
            description: acc.description || '',
            status: acc.status || 'active',
        });
        setParentSearch('');
        setSubmitError('');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (submitLoading) return;
        setIsModalOpen(false);
        setSubmitError('');
    };

    const onTypeChange = (type) => {
        setForm((prev) => ({
            ...prev,
            type,
            subType: subtypeByType[type]?.[0] || '',
        }));
    };

    const onSubmit = async () => {
        if (!form.name.trim() || !form.code.trim() || !form.type || !form.subType) {
            setSubmitError('Please fill all required fields.');
            return;
        }
        setSubmitLoading(true);
        setSubmitError('');
        try {
            const payload = {
                name: form.name.trim(),
                code: form.code.trim(),
                type: form.type,
                subType: form.subType,
                parentId: form.parentId || undefined,
                branchId: form.branchId || undefined,
                description: form.description?.trim() || undefined,
                status: form.status || undefined,
            };
            if (editingId) {
                await updateAccount(editingId, payload);
            } else {
                await createAccount(payload);
            }
            setIsModalOpen(false);
            setReloadTick((x) => x + 1);
        } catch (err) {
            setSubmitError(getErrorMessage(err));
        } finally {
            setSubmitLoading(false);
        }
    };

    const onConfirmDelete = async (id) => {
        setDeleteLoadingId(id);
        setDeleteError('');
        try {
            await deleteAccount(id);
            setPendingDeleteId('');
            setReloadTick((x) => x + 1);
        } catch (err) {
            setDeleteError(getErrorMessage(err));
        } finally {
            setDeleteLoadingId('');
        }
    };

    const printHtml = (title, html) => {
        const w = window.open('', '_blank', 'width=1000,height=800');
        if (!w) return;
        w.document.write(
            `<!doctype html><html><head><title>${title}</title><style>body{font-family: 'Poppins', sans-serif;margin:24px;color:#0f172a}h1,h2,h3{margin:0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px}.total{font-weight:700}</style></head><body>${html}</body></html>`,
        );
        w.document.close();
        w.focus();
        w.print();
    };

    const loadTrialBalance = async () => {
        setTbLoading(true);
        try {
            const res = await getTrialBalance(tbFilters);
            setTbData(res || { accounts: [], totalDebits: 0, totalCredits: 0, isBalanced: true });
        } finally {
            setTbLoading(false);
        }
    };

    const loadPL = async () => {
        setPlLoading(true);
        try {
            const res = await getPLReport(plFilters);
            setPlData(res || null);
        } finally {
            setPlLoading(false);
        }
    };

    const loadBalanceSheet = async () => {
        setBsLoading(true);
        try {
            const res = await getBalanceSheet(bsFilters);
            setBsData(res || null);
        } finally {
            setBsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'Trial Balance') loadTrialBalance();
        if (activeTab === 'P&L') loadPL();
        if (activeTab === 'Balance Sheet') loadBalanceSheet();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const branchSelectStyle = {
        appearance: 'none',
        border: `1px solid ${palette.border}`,
        borderRadius: 8,
        padding: '8px 34px 8px 36px',
        fontSize: 14,
        background: '#fff',
        color: palette.textPrimary,
    };

    const renderBranchPicker = (value, onChange) => (
        <div style={{ position: 'relative' }}>
            <Building2
                size={16}
                color={palette.textSecondary}
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
            <select value={value} onChange={(e) => onChange(e.target.value)} style={branchSelectStyle}>
                <option value="">All branches</option>
                {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                        {b.name}
                    </option>
                ))}
            </select>
            <ChevronDown
                size={16}
                color={palette.textSecondary}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
        </div>
    );

    const renderReportContent = () => {
        if (activeTab === 'Trial Balance') {
            return (
                <div style={reportCard}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                        <input
                            type="date"
                            value={tbFilters.dateFrom}
                            onChange={(e) => setTbFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                            style={inputStyle}
                        />
                        <input
                            type="date"
                            value={tbFilters.dateTo}
                            onChange={(e) => setTbFilters((p) => ({ ...p, dateTo: e.target.value }))}
                            style={inputStyle}
                        />
                        {renderBranchPicker(tbFilters.branchId, (v) => setTbFilters((p) => ({ ...p, branchId: v })))}
                        <button
                            type="button"
                            onClick={loadTrialBalance}
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
                        >
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                printHtml(
                                    'Trial Balance',
                                    `<h2>Trial Balance</h2><div>${fmtDateLabel(tbFilters.dateFrom)} - ${fmtDateLabel(tbFilters.dateTo)}</div>`,
                                )
                            }
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <Printer size={14} /> Print
                        </button>
                        <div
                            style={{
                                marginLeft: 'auto',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                color: tbData.isBalanced ? '#16a34a' : '#dc2626',
                                fontWeight: 700,
                            }}
                        >
                            {tbData.isBalanced ? <CheckCircle2 size={16} /> : null}
                            {tbData.isBalanced ? 'Balanced' : 'Unbalanced'}
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {['Account Code', 'Account Name', 'Type', 'Debit Balance', 'Credit Balance'].map(
                                        (h) => (
                                            <th
                                                key={h}
                                                style={{
                                                    textAlign: 'left',
                                                    borderBottom: `1px solid ${palette.border}`,
                                                    padding: 8,
                                                    fontSize: 12,
                                                    color: palette.textSecondary,
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {(tbData.accounts || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: 16, color: palette.textSecondary, textAlign: 'center' }}>
                                            {tbLoading ? 'Loading...' : 'No accounts for selected range'}
                                        </td>
                                    </tr>
                                ) : (
                                    (tbData.accounts || []).map((a) => (
                                        <tr key={`${a.code}-${a.name}`}>
                                            <td style={{ padding: 8 }}>{a.code}</td>
                                            <td style={{ padding: 8 }}>{a.name}</td>
                                            <td style={{ padding: 8 }}>{toLabel(a.type)}</td>
                                            <td style={{ padding: 8 }}>{fmtMoney(a.debitBalance)}</td>
                                            <td style={{ padding: 8 }}>{fmtMoney(a.creditBalance)}</td>
                                        </tr>
                                    ))
                                )}
                                <tr>
                                    <td colSpan={3} style={{ padding: 8, fontWeight: 700 }}>
                                        Totals
                                    </td>
                                    <td style={{ padding: 8, fontWeight: 700 }}>{fmtMoney(tbData.totalDebits)}</td>
                                    <td style={{ padding: 8, fontWeight: 700 }}>{fmtMoney(tbData.totalCredits)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        if (activeTab === 'P&L') {
            const d = plData || {
                revenue: [],
                totalRevenue: 0,
                costOfGoodsSold: [],
                totalCOGS: 0,
                grossProfit: 0,
                operatingExpenses: [],
                totalOperatingExpenses: 0,
                otherIncome: [],
                totalOtherIncome: 0,
                otherExpenses: [],
                totalOtherExpenses: 0,
                netIncome: 0,
            };
            const sectionHeader = { marginTop: 18, fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700 };
            const rowStyle = {
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: `1px solid ${palette.border}`,
            };
            return (
                <div style={reportCard}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                        <input type="date" value={plFilters.dateFrom} onChange={(e) => setPlFilters((p) => ({ ...p, dateFrom: e.target.value }))} style={inputStyle} />
                        <input type="date" value={plFilters.dateTo} onChange={(e) => setPlFilters((p) => ({ ...p, dateTo: e.target.value }))} style={inputStyle} />
                        {renderBranchPicker(plFilters.branchId, (v) => setPlFilters((p) => ({ ...p, branchId: v })))}
                        <button type="button" onClick={loadPL} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                            Apply
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                printHtml(
                                    'Profit and Loss',
                                    `<h2>Profit & Loss Statement</h2><div>Period: ${fmtDateLabel(plFilters.dateFrom)} — ${fmtDateLabel(plFilters.dateTo)}</div>`,
                                )
                            }
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <Printer size={14} /> Print
                        </button>
                    </div>
                    {plLoading ? (
                        <div style={{ color: palette.textSecondary }}>Loading...</div>
                    ) : (
                        <>
                            <div style={sectionHeader}>REVENUE</div>
                            {d.revenue.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>No revenue accounts</div>
                            ) : (
                                d.revenue.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#16a34a' }}>
                                <span>Total Revenue</span>
                                <span>{fmtMoney(d.totalRevenue)}</span>
                            </div>
                            <div style={sectionHeader}>COST OF GOODS SOLD</div>
                            {d.costOfGoodsSold.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>No COGS accounts</div>
                            ) : (
                                d.costOfGoodsSold.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#dc2626' }}>
                                <span>Total Cost of Goods Sold</span>
                                <span>{fmtMoney(d.totalCOGS)}</span>
                            </div>
                            <div style={{ ...rowStyle, fontWeight: 800, color: '#16a34a' }}>
                                <span>Gross Profit</span>
                                <span>{fmtMoney(d.grossProfit)}</span>
                            </div>
                            <div style={sectionHeader}>OPERATING EXPENSES</div>
                            {d.operatingExpenses.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>No operating expenses</div>
                            ) : (
                                d.operatingExpenses.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#dc2626' }}>
                                <span>Total Operating Expenses</span>
                                <span>{fmtMoney(d.totalOperatingExpenses)}</span>
                            </div>
                            <div style={sectionHeader}>OTHER INCOME</div>
                            {d.otherIncome.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>No other income</div>
                            ) : (
                                d.otherIncome.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#16a34a' }}>
                                <span>Total Other Income</span>
                                <span>{fmtMoney(d.totalOtherIncome)}</span>
                            </div>
                            <div style={sectionHeader}>OTHER EXPENSES</div>
                            {d.otherExpenses.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>No other expenses</div>
                            ) : (
                                d.otherExpenses.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#dc2626' }}>
                                <span>Total Other Expenses</span>
                                <span>{fmtMoney(d.totalOtherExpenses)}</span>
                            </div>
                            <div
                                style={{
                                    marginTop: 12,
                                    background: '#1e293b',
                                    color: '#fff',
                                    borderRadius: 8,
                                    padding: 12,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontWeight: 800,
                                }}
                            >
                                <span>Net Income / (Loss)</span>
                                <span style={{ color: d.netIncome >= 0 ? '#22c55e' : '#ef4444' }}>{fmtMoney(d.netIncome)}</span>
                            </div>
                        </>
                    )}
                </div>
            );
        }

        const b = bsData || {
            assets: { current: [], fixed: [], other: [], totalAssets: 0 },
            liabilities: { current: [], longTerm: [], other: [], totalLiabilities: 0 },
            equity: { accounts: [], totalEquity: 0 },
            totalLiabilitiesAndEquity: 0,
        };
        const bsRow = {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: `1px solid ${palette.border}`,
        };
        return (
            <div style={reportCard}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <input
                        type="date"
                        value={bsFilters.asOf}
                        onChange={(e) => setBsFilters((p) => ({ ...p, asOf: e.target.value }))}
                        style={inputStyle}
                    />
                    {renderBranchPicker(bsFilters.branchId, (v) => setBsFilters((p) => ({ ...p, branchId: v })))}
                    <button type="button" onClick={loadBalanceSheet} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                        Apply
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            printHtml('Balance Sheet', `<h2>Balance Sheet</h2><div>As of: ${fmtDateLabel(bsFilters.asOf)}</div>`)
                        }
                        style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <Printer size={14} /> Print
                    </button>
                </div>
                {bsLoading ? (
                    <div style={{ color: palette.textSecondary }}>Loading...</div>
                ) : (
                    <>
                        <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700 }}>ASSETS</div>
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>Current Assets</span>
                            <span>{fmtMoney(b.assets.current.reduce((s, x) => s + x.amount, 0))}</span>
                        </div>
                        {b.assets.current.map((r) => (
                            <div key={`ac-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>Fixed Assets</span>
                            <span>{fmtMoney(b.assets.fixed.reduce((s, x) => s + x.amount, 0))}</span>
                        </div>
                        {b.assets.fixed.map((r) => (
                            <div key={`af-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>Other Assets</span>
                            <span>{fmtMoney(b.assets.other.reduce((s, x) => s + x.amount, 0))}</span>
                        </div>
                        {b.assets.other.map((r) => (
                            <div key={`ao-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 800 }}>
                            <span>Total Assets</span>
                            <span>{fmtMoney(b.assets.totalAssets)}</span>
                        </div>
                        <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700, marginTop: 12 }}>LIABILITIES</div>
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>Current Liabilities</span>
                            <span>{fmtMoney(b.liabilities.current.reduce((s, x) => s + x.amount, 0))}</span>
                        </div>
                        {b.liabilities.current.map((r) => (
                            <div key={`lc-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>Long-term Liabilities</span>
                            <span>{fmtMoney(b.liabilities.longTerm.reduce((s, x) => s + x.amount, 0))}</span>
                        </div>
                        {b.liabilities.longTerm.map((r) => (
                            <div key={`ll-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 800 }}>
                            <span>Total Liabilities</span>
                            <span>{fmtMoney(b.liabilities.totalLiabilities)}</span>
                        </div>
                        <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700, marginTop: 12 }}>EQUITY</div>
                        {b.equity.accounts.map((r) => (
                            <div key={`eq-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 800 }}>
                            <span>Total Equity</span>
                            <span>{fmtMoney(b.equity.totalEquity)}</span>
                        </div>
                        <div
                            style={{
                                marginTop: 12,
                                background: '#1e293b',
                                color: '#fff',
                                borderRadius: 8,
                                padding: 12,
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontWeight: 800,
                            }}
                        >
                            <span>Total Liabilities + Equity</span>
                            <span>{fmtMoney(b.totalLiabilitiesAndEquity)}</span>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const modalTitle = editingId ? 'Edit Account' : 'New Account';

    return (
        <div
            style={{
                background: palette.pageBg,
                minHeight: '100%',
                borderRadius: 12,
                border: `1px solid ${palette.border}`,
                overflow: 'hidden',
            }}
        >
            <div style={{ padding: '24px 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <BookOpen size={24} color={palette.textPrimary} />
                    <h1
                        style={{
                            margin: 0,
                            fontSize: '1.5rem',
                            fontWeight: 700,
                            color: palette.textPrimary,
                        }}
                    >
                        Accounting
                    </h1>
                </div>
                <p style={{ margin: 0, color: palette.textSecondary, fontSize: '0.875rem' }}>
                    Workshop Chart of Accounts &amp; Financial Reports
                </p>
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: 20,
                    borderBottom: `1px solid ${palette.border}`,
                    padding: '16px 24px 0',
                    marginTop: 16,
                    background: palette.cardBg,
                }}
            >
                {['Chart of Accounts', 'Trial Balance', 'P&L', 'Balance Sheet'].map((tab) => {
                    const active = tab === activeTab;
                    return (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                color: active ? palette.textPrimary : palette.textSecondary,
                                fontWeight: active ? 600 : 500,
                                padding: '0 0 10px',
                                borderBottom: active ? `3px solid ${palette.primary}` : '3px solid transparent',
                                cursor: 'pointer',
                            }}
                        >
                            {tab}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'Chart of Accounts' ? (
                <div style={{ padding: 24, background: palette.cardBg }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                            gap: 12,
                            marginBottom: 16,
                        }}
                    >
                        {typeGroups.map((group) => (
                            <div
                                key={group.key}
                                style={{
                                    border: `1px solid ${palette.border}`,
                                    borderRadius: 8,
                                    padding: 16,
                                    background: palette.cardBg,
                                }}
                            >
                                <div style={{ fontSize: 14, color: palette.textSecondary, marginBottom: 6 }}>
                                    {group.label}
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: group.color }}>
                                    {(grouped[group.key] || []).length} accounts
                                </div>
                            </div>
                        ))}
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'center',
                            marginBottom: 16,
                            flexWrap: 'wrap',
                        }}
                    >
                        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                            <Search
                                size={16}
                                color={palette.textSecondary}
                                style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)' }}
                            />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search accounts..."
                                style={{
                                    width: '100%',
                                    border: `1px solid ${palette.border}`,
                                    borderRadius: 8,
                                    padding: '8px 12px 8px 36px',
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            />
                        </div>
                        {renderBranchPicker(selectedBranch, setSelectedBranch)}
                        <div style={{ position: 'relative' }}>
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                style={{
                                    appearance: 'none',
                                    border: `1px solid ${palette.border}`,
                                    borderRadius: 8,
                                    padding: '8px 34px 8px 12px',
                                    fontSize: 14,
                                    background: '#fff',
                                    color: palette.textPrimary,
                                }}
                            >
                                {selectTypes.map((item) => (
                                    <option key={item.label} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown
                                size={16}
                                color={palette.textSecondary}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}
                            />
                        </div>
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={openCreate}
                                style={{
                                    border: 'none',
                                    background: palette.primary,
                                    color: '#fff',
                                    borderRadius: 8,
                                    padding: '9px 14px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                <Plus size={16} />
                                New Account
                            </button>
                        )}
                    </div>
                    <p className="sa-acc-coa-hint" style={{ margin: '0 0 12px' }}>
                        Final balance is from posted journals (all dates). Click a detail account row to open its
                        ledger statement — same layout as Platform HQ. Petty cash controls{' '}
                        <strong>[1280]</strong> / <strong>[6100]</strong> and cash/bank detail accounts open
                        filtered register views.
                    </p>

                    {loading ? (
                        <div
                            style={{
                                border: `1px solid ${palette.border}`,
                                borderRadius: 8,
                                padding: 20,
                                color: palette.textSecondary,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <RefreshCw size={16} />
                            Loading accounts...
                        </div>
                    ) : error ? (
                        <div
                            style={{
                                border: `1px solid ${palette.border}`,
                                borderRadius: 8,
                                padding: 20,
                            }}
                        >
                            <div style={{ color: palette.delete, marginBottom: 10 }}>{error}</div>
                            <button
                                type="button"
                                onClick={() => setReloadTick((x) => x + 1)}
                                style={{
                                    border: 'none',
                                    background: palette.primary,
                                    color: '#fff',
                                    borderRadius: 6,
                                    padding: '8px 14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : (
                        <div style={{ border: `1px solid ${palette.border}`, borderRadius: 8, overflow: 'hidden' }}>
                            {typeGroups.map((group) => {
                                const rows = grouped[group.key] || [];
                                return (
                                    <div key={group.key} style={{ borderTop: `1px solid ${palette.border}` }}>
                                        <div
                                            style={{
                                                background: palette.sectionHeaderBg,
                                                padding: '10px 16px',
                                                borderBottom: `1px solid ${palette.border}`,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <strong style={{ color: palette.textPrimary }}>{group.label}</strong>
                                            <span style={{ color: palette.textSecondary, fontSize: 13 }}>
                                                {rows.length} {rows.length === 1 ? 'account' : 'accounts'}
                                            </span>
                                        </div>

                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    {[
                                                        'Code',
                                                        'Account Name',
                                                        'Subtype',
                                                        'Branch',
                                                        'Normal Bal.',
                                                        'Final balance',
                                                        'Status',
                                                        'Actions',
                                                    ]
                                                        .filter((h) => !readOnly || h !== 'Actions')
                                                        .map((header) => (
                                                            <th
                                                                key={header}
                                                                style={{
                                                                    textAlign: 'left',
                                                                    padding: '10px 12px',
                                                                    fontSize: 12,
                                                                    color: palette.textSecondary,
                                                                    borderBottom: `1px solid ${palette.border}`,
                                                                    background: '#fff',
                                                                }}
                                                            >
                                                                {header}
                                                            </th>
                                                        ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={readOnly ? 7 : 8}
                                                            style={{
                                                                textAlign: 'center',
                                                                color: palette.textSecondary,
                                                                fontStyle: 'italic',
                                                                padding: '14px 12px',
                                                            }}
                                                        >
                                                            No {group.label.toLowerCase()} accounts
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    rows.map((acc) => {
                                                        const parentName = acc.parentId
                                                            ? parentNameById.get(String(acc.parentId)) || '—'
                                                            : '—';
                                                        const branchName = acc.branchId
                                                            ? branchById.get(String(acc.branchId)) || '—'
                                                            : 'Shared';
                                                        const autoLinked = acc.isAutoSeed;
                                                        const controlBadge = WORKSHOP_COA_CONTROL_BADGES[String(acc.code)];
                                                        const marker =
                                                            (treeFlat.find((x) => String(x.id) === String(acc.id)) || {})._marker || '';
                                                        const bal = formatFinalBalance(acc);
                                                        const ledgerClickable = isWorkshopCoaLedgerClickable(acc);
                                                        return (
                                                            <tr
                                                                key={acc.id}
                                                                role={ledgerClickable ? 'button' : undefined}
                                                                tabIndex={ledgerClickable ? 0 : undefined}
                                                                onClick={ledgerClickable ? () => openAccountLedger(acc) : undefined}
                                                                onKeyDown={ledgerClickable ? (e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.preventDefault();
                                                                        openAccountLedger(acc);
                                                                    }
                                                                } : undefined}
                                                                className={ledgerClickable ? 'sa-acc-row-clickable' : undefined}
                                                                style={{
                                                                    borderBottom: '1px solid #f3f4f6',
                                                                    background: '#fff',
                                                                    cursor: ledgerClickable ? 'pointer' : 'default',
                                                                }}
                                                                onMouseOver={ledgerClickable ? (e) => {
                                                                    e.currentTarget.style.background = '#f3f4f6';
                                                                } : undefined}
                                                                onMouseOut={ledgerClickable ? (e) => {
                                                                    e.currentTarget.style.background = '#fff';
                                                                } : undefined}
                                                            >
                                                                <td
                                                                    style={{
                                                                        padding: '12px',
                                                                        color: palette.textSecondary,
                                                                        fontFamily:
                                                                            'ui-monospace, SFMono-Regular, Menlo, monospace',
                                                                        width: 110,
                                                                    }}
                                                                >
                                                                    {acc.code}
                                                                </td>
                                                                <td style={{ padding: '12px' }}>
                                                                    <div style={{ fontWeight: 600, color: palette.textPrimary }}>
                                                                        {marker}
                                                                        {acc.name}
                                                                        {autoLinked && (
                                                                            <span
                                                                                style={{
                                                                                    background: palette.autoBadgeBg,
                                                                                    color: palette.autoBadgeText,
                                                                                    padding: '2px 8px',
                                                                                    borderRadius: 4,
                                                                                    fontSize: '0.7rem',
                                                                                    fontWeight: 600,
                                                                                    marginLeft: 8,
                                                                                }}
                                                                            >
                                                                                Auto-linked
                                                                            </span>
                                                                        )}
                                                                        {controlBadge ? (
                                                                            <span
                                                                                style={{
                                                                                    background: controlBadge.background,
                                                                                    color: controlBadge.color,
                                                                                    padding: '2px 8px',
                                                                                    borderRadius: 4,
                                                                                    fontSize: '0.7rem',
                                                                                    fontWeight: 600,
                                                                                    marginLeft: 8,
                                                                                }}
                                                                            >
                                                                                {controlBadge.label}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            color: palette.textSecondary,
                                                                            fontStyle: 'italic',
                                                                            fontSize: 12,
                                                                            marginTop: 2,
                                                                        }}
                                                                    >
                                                                        {acc.description || parentName}
                                                                    </div>
                                                                    {isWorkshopPettyCashCoaControlAccount(acc) ? (
                                                                        <div
                                                                            style={{
                                                                                color: palette.textSecondary,
                                                                                fontSize: 11,
                                                                                marginTop: 4,
                                                                            }}
                                                                        >
                                                                            Branch & employee detail — open ledger and use filters.
                                                                        </div>
                                                                    ) : null}
                                                                </td>
                                                                <td style={{ padding: '12px', color: palette.textSecondary }}>
                                                                    {toLabel(acc.subType)}
                                                                </td>
                                                                <td style={{ padding: '12px', color: palette.textSecondary }}>
                                                                    {branchName}
                                                                </td>
                                                                <td style={{ padding: '12px', color: palette.textSecondary }}>
                                                                    {getNormalBalance(acc.type)}
                                                                </td>
                                                                <td
                                                                    style={{
                                                                        padding: '12px',
                                                                        fontWeight: 600,
                                                                        color: bal.color,
                                                                        fontVariantNumeric: 'tabular-nums',
                                                                        whiteSpace: 'nowrap',
                                                                    }}
                                                                >
                                                                    {bal.text}
                                                                </td>
                                                                <td style={{ padding: '12px' }}>
                                                                    <span
                                                                        style={{
                                                                            background: palette.activeBadgeBg,
                                                                            color: palette.activeBadgeText,
                                                                            padding: '2px 8px',
                                                                            borderRadius: 999,
                                                                            fontSize: 12,
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {acc.status || 'active'}
                                                                    </span>
                                                                </td>
                                                                {!readOnly && (
                                                                    <td
                                                                        style={{ padding: '12px' }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                    >
                                                                        {pendingDeleteId === acc.id ? (
                                                                            <div
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: 8,
                                                                                    flexWrap: 'wrap',
                                                                                    fontSize: 12,
                                                                                }}
                                                                            >
                                                                                <span>Are you sure?</span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => onConfirmDelete(acc.id)}
                                                                                    disabled={deleteLoadingId === acc.id}
                                                                                    style={{
                                                                                        border: `1px solid ${palette.delete}`,
                                                                                        background: '#fff',
                                                                                        color: palette.delete,
                                                                                        borderRadius: 6,
                                                                                        padding: '4px 8px',
                                                                                        cursor: 'pointer',
                                                                                    }}
                                                                                >
                                                                                    {deleteLoadingId === acc.id
                                                                                        ? 'Deleting...'
                                                                                        : 'Yes, Delete'}
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setPendingDeleteId('');
                                                                                        setDeleteError('');
                                                                                    }}
                                                                                    style={{
                                                                                        border: `1px solid ${palette.border}`,
                                                                                        background: '#fff',
                                                                                        color: palette.textPrimary,
                                                                                        borderRadius: 6,
                                                                                        padding: '4px 8px',
                                                                                        cursor: 'pointer',
                                                                                    }}
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <div style={{ display: 'flex', gap: 10 }}>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => openEdit(acc)}
                                                                                    style={{
                                                                                        border: 'none',
                                                                                        background: 'transparent',
                                                                                        color: palette.edit,
                                                                                        cursor: 'pointer',
                                                                                        padding: 0,
                                                                                    }}
                                                                                    title="Edit"
                                                                                >
                                                                                    <Pencil size={16} />
                                                                                </button>
                                                                                {!autoLinked && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setPendingDeleteId(acc.id);
                                                                                            setDeleteError('');
                                                                                        }}
                                                                                        style={{
                                                                                            border: 'none',
                                                                                            background: 'transparent',
                                                                                            color: palette.delete,
                                                                                            cursor: 'pointer',
                                                                                            padding: 0,
                                                                                        }}
                                                                                        title="Delete"
                                                                                    >
                                                                                        <Trash2 size={16} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {deleteError && <div style={{ color: palette.delete, marginTop: 10, fontSize: 13 }}>{deleteError}</div>}
                </div>
            ) : (
                <div style={{ padding: 24, background: palette.cardBg }}>{renderReportContent()}</div>
            )}

            {!readOnly && isModalOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: 16,
                    }}
                    onClick={closeModal}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 600,
                            background: '#fff',
                            borderRadius: 12,
                            padding: 32,
                            boxSizing: 'border-box',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 20,
                            }}
                        >
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: palette.textPrimary }}>
                                {modalTitle}
                            </h3>
                            <button
                                type="button"
                                onClick={closeModal}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: palette.textSecondary,
                                    cursor: 'pointer',
                                    padding: 2,
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>Account Code *</label>
                                <input
                                    maxLength={20}
                                    value={form.code}
                                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>Account Name *</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>Account Type *</label>
                                <select
                                    value={form.type}
                                    onChange={(e) => onTypeChange(e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="ASSET">Asset</option>
                                    <option value="LIABILITY">Liability</option>
                                    <option value="EQUITY">Equity</option>
                                    <option value="INCOME">Income</option>
                                    <option value="EXPENSE">Expense</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>Subtype</label>
                                <select
                                    value={form.subType}
                                    onChange={(e) => setForm((p) => ({ ...p, subType: e.target.value }))}
                                    style={inputStyle}
                                >
                                    {subtypeOptions.map((sub) => (
                                        <option key={sub} value={sub}>
                                            {toLabel(sub)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>
                                    Branch
                                </label>
                                <select
                                    value={form.branchId}
                                    onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">Shared (all branches)</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                                <div style={{ fontSize: 11, color: palette.textSecondary, marginTop: 4 }}>
                                    Tag the account to a branch (e.g. its bank/cash register), or leave shared so all branches post to it.
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>Normal Balance</label>
                                <input
                                    value={getNormalBalance(form.type)}
                                    readOnly
                                    style={{ ...inputStyle, background: '#f9fafb' }}
                                />
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>Parent Account</label>
                                <input
                                    placeholder="Search parent..."
                                    value={parentSearch}
                                    onChange={(e) => setParentSearch(e.target.value)}
                                    style={{ ...inputStyle, marginBottom: 6 }}
                                />
                                <select
                                    value={form.parentId}
                                    onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">None (top-level)</option>
                                    {parentOptions.map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.code} - {acc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>Status</label>
                                <select
                                    value={form.status}
                                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="active">active</option>
                                    <option value="inactive">inactive</option>
                                </select>
                            </div>
                            <div></div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>Description</label>
                                <textarea
                                    rows={3}
                                    value={form.description}
                                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                                />
                            </div>

                            {submitError && <div style={{ gridColumn: 'span 2', color: palette.delete, fontSize: 13 }}>{submitError}</div>}

                            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={submitLoading}
                                    style={{
                                        border: `1px solid ${palette.border}`,
                                        background: '#fff',
                                        padding: '10px 24px',
                                        borderRadius: 6,
                                        cursor: submitLoading ? 'not-allowed' : 'pointer',
                                        opacity: submitLoading ? 0.6 : 1,
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={onSubmit}
                                    disabled={submitLoading}
                                    style={{
                                        border: 'none',
                                        background: palette.primary,
                                        color: '#fff',
                                        padding: '10px 24px',
                                        borderRadius: 6,
                                        fontWeight: 600,
                                        cursor: submitLoading ? 'not-allowed' : 'pointer',
                                        opacity: submitLoading ? 0.6 : 1,
                                    }}
                                >
                                    {submitLoading ? 'Saving...' : editingId ? 'Update Account' : 'Create Account'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

const inputStyle = {
    width: '100%',
    border: `1px solid ${palette.border}`,
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    outline: 'none',
};
