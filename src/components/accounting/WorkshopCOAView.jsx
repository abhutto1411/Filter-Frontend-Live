import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    Folder,
    FolderOpen,
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
import { runWorkshopPeriodClose } from '../../services/workshopAccountingApi';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';
import {
    buildWorkshopCoaNavigationUrl,
    isWorkshopCoaLedgerClickable,
    isWorkshopPettyCashCoaControlAccount,
    WORKSHOP_COA_CONTROL_BADGES,
} from '../../pages/workshop/workshopCoaAccountRouting';
import {
    loadSaAccountingDateRange,
    startOfMonthISO,
    todayISO,
} from '../../pages/admin/saAccountingDateRange';
import { accT } from '../../utils/accountingI18n';

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
    { key: 'ASSET', color: '#3b82f6' },
    { key: 'LIABILITY', color: '#ef4444' },
    { key: 'EQUITY', color: '#8b5cf6' },
    { key: 'INCOME', color: '#16a34a' },
    { key: 'EXPENSE', color: '#f59e0b' },
];

const selectTypes = [
    { value: '', typeKey: 'all' },
    { value: 'ASSET', typeKey: 'ASSET' },
    { value: 'LIABILITY', typeKey: 'LIABILITY' },
    { value: 'EQUITY', typeKey: 'EQUITY' },
    { value: 'INCOME', typeKey: 'INCOME' },
    { value: 'EXPENSE', typeKey: 'EXPENSE' },
];

const COA_TABS = [
    { id: 'Chart of Accounts', labelKey: 'tab.coa' },
    { id: 'Trial Balance', labelKey: 'tab.tb' },
    { id: 'P&L', labelKey: 'coa.tab.plShort' },
    { id: 'Balance Sheet', labelKey: 'tab.bs' },
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

function toLabel(value = '', t) {
    const key = String(value || '');
    if (t && key) {
        const subKey = `coa.sub.${key}`;
        const sub = t(subKey);
        if (sub !== subKey) return sub;
        const typeKey = `coa.type.${key}`;
        const typ = t(typeKey);
        if (typ !== typeKey) return typ;
    }
    return String(value)
        .toLowerCase()
        .split('_')
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ');
}

function getNormalBalance(type, t) {
    if (type === 'ASSET' || type === 'EXPENSE') return t('coa.normal.debit');
    return t('coa.normal.credit');
}

function getErrorMessage(error, t) {
    return error?.message || t('coa.err.generic');
}

function filterTreeForSearch(nodes = [], q = '') {
    if (!q) return nodes;
    return nodes
        .map((node) => {
            const children = filterTreeForSearch(node.children || [], q);
            const hay = `${node.code || ''} ${node.name || ''} ${node.description || ''}`.toLowerCase();
            if (hay.includes(q) || children.length) {
                return { ...node, children };
            }
            return null;
        })
        .filter(Boolean);
}

/** Visible rows for Manager-style folder COA (expand/collapse). */
function flattenVisibleTree(nodes = [], expandedIds, forceExpand = false, depth = 0, acc = []) {
    nodes.forEach((node) => {
        const children = Array.isArray(node.children) ? node.children : [];
        const hasChildren = children.length > 0;
        acc.push({ ...node, _depth: depth, _hasChildren: hasChildren });
        if (hasChildren && (forceExpand || expandedIds.has(String(node.id)))) {
            flattenVisibleTree(children, expandedIds, forceExpand, depth + 1, acc);
        }
    });
    return acc;
}

function collectExpandableIds(nodes = [], acc = []) {
    nodes.forEach((node) => {
        const children = node.children || [];
        if (children.length) {
            acc.push(String(node.id));
            collectExpandableIds(children, acc);
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

const fmtMoneyNum = (n) => Number(n || 0).toFixed(2);
const fmtMoney = (n, t) => t('money.sar', { n: fmtMoneyNum(n) });

/** Closing balance from posted journals (same basis as Trial Balance). */
function formatFinalBalance(acc, t) {
    const dr = Number(acc.closingDebit || 0);
    const cr = Number(acc.closingCredit || 0);
    if (dr >= 0.005) return { text: t('money.sarDr', { n: fmtMoneyNum(dr) }), color: '#1d4ed8' };
    if (cr >= 0.005) return { text: t('money.sarCr', { n: fmtMoneyNum(cr) }), color: '#b91c1c' };
    return { text: t('money.dash'), color: palette.textSecondary };
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
export default function WorkshopCOAView({ readOnly = false, locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [treeAccounts, setTreeAccounts] = useState([]);
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [expandInitForTree, setExpandInitForTree] = useState('');
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

    const [periodCloseOpen, setPeriodCloseOpen] = useState(false);
    const [periodCloseLabel, setPeriodCloseLabel] = useState('');
    const [periodCloseDate, setPeriodCloseDate] = useState(() => todayISO());
    const [periodCloseNotes, setPeriodCloseNotes] = useState('');
    const [periodCloseLoading, setPeriodCloseLoading] = useState(false);
    const [periodCloseError, setPeriodCloseError] = useState('');
    const [periodCloseDone, setPeriodCloseDone] = useState(null);

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
                const normalizedFlat = flat
                    .map(normalizeAccount)
                    .sort((a, b) => a.code.localeCompare(b.code));
                const normalizedTree = tree.map(normalizeAccount);
                setAccounts(normalizedFlat);
                setTreeAccounts(normalizedTree);
            } catch (err) {
                if (!cancelled) setError(getErrorMessage(err, t));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [reloadTick, selectedType, selectedBranch, t]);

    const accountById = useMemo(() => {
        const map = new Map();
        accounts.forEach((acc) => map.set(String(acc.id), acc));
        return map;
    }, [accounts]);

    useEffect(() => {
        const signature = treeAccounts.map((n) => n.id).join(',');
        if (!signature || signature === expandInitForTree) return;
        // Always start collapsed; user expands via "Expand folders" or folder chevron.
        setExpandedIds(new Set());
        setExpandInitForTree(signature);
    }, [treeAccounts, expandInitForTree]);

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

    const searchQ = search.trim().toLowerCase();
    const filteredTree = useMemo(
        () => filterTreeForSearch(treeAccounts, searchQ),
        [treeAccounts, searchQ],
    );

    const visibleTreeRows = useMemo(
        () => flattenVisibleTree(filteredTree, expandedIds, Boolean(searchQ)),
        [filteredTree, expandedIds, searchQ],
    );

    const grouped = useMemo(() => {
        const map = { ASSET: [], LIABILITY: [], EQUITY: [], INCOME: [], EXPENSE: [] };
        visibleTreeRows.forEach((row) => {
            const flat = accountById.get(String(row.id)) || {};
            const merged = {
                ...flat,
                ...row,
                closingDebit: flat.closingDebit ?? row.closingDebit,
                closingCredit: flat.closingCredit ?? row.closingCredit,
                hasChildren: row._hasChildren,
                isHeading: row._hasChildren,
            };
            if (map[merged.type]) map[merged.type].push(merged);
        });
        return map;
    }, [visibleTreeRows, accountById]);

    const toggleExpanded = useCallback((id, e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        const key = String(id);
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const expandAllFolders = useCallback(() => {
        setExpandedIds(new Set(collectExpandableIds(treeAccounts)));
    }, [treeAccounts]);

    const collapseAllFolders = useCallback(() => {
        setExpandedIds(new Set());
    }, []);

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
            setSubmitError(t('coa.err.required'));
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
            setSubmitError(getErrorMessage(err, t));
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
            setDeleteError(getErrorMessage(err, t));
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
                <option value="">{t('scope.allBranches')}</option>
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
                            {t('date.apply')}
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                printHtml(
                                    t('tb.printTitle'),
                                    `<h2>${t('tb.printTitle')}</h2><div>${fmtDateLabel(tbFilters.dateFrom)} - ${fmtDateLabel(tbFilters.dateTo)}</div>`,
                                )
                            }
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <Printer size={14} /> {t('btn.print')}
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
                            {tbData.isBalanced ? t('tb.balanced') : t('tb.unbalanced')}
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {[
                                        t('tb.th.code'),
                                        t('tb.th.name'),
                                        t('tb.th.type'),
                                        t('tb.th.debit'),
                                        t('tb.th.credit'),
                                    ].map(
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
                                            {tbLoading ? t('loading') : t('tb.empty')}
                                        </td>
                                    </tr>
                                ) : (
                                    (tbData.accounts || []).map((a) => (
                                        <tr key={`${a.code}-${a.name}`}>
                                            <td style={{ padding: 8 }}>{a.code}</td>
                                            <td style={{ padding: 8 }}>{a.name}</td>
                                            <td style={{ padding: 8 }}>{toLabel(a.type, t)}</td>
                                            <td style={{ padding: 8 }}>{fmtMoney(a.debitBalance, t)}</td>
                                            <td style={{ padding: 8 }}>{fmtMoney(a.creditBalance, t)}</td>
                                        </tr>
                                    ))
                                )}
                                <tr>
                                    <td colSpan={3} style={{ padding: 8, fontWeight: 700 }}>
                                        {t('tb.totals')}
                                    </td>
                                    <td style={{ padding: 8, fontWeight: 700 }}>{fmtMoney(tbData.totalDebits, t)}</td>
                                    <td style={{ padding: 8, fontWeight: 700 }}>{fmtMoney(tbData.totalCredits, t)}</td>
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
                            {t('date.apply')}
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                printHtml(
                                    t('pl.printTitle'),
                                    `<h2>${t('pl.printHeading')}</h2><div>${t('pl.period', { from: fmtDateLabel(plFilters.dateFrom), to: fmtDateLabel(plFilters.dateTo) })}</div>`,
                                )
                            }
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <Printer size={14} /> {t('btn.print')}
                        </button>
                    </div>
                    {plLoading ? (
                        <div style={{ color: palette.textSecondary }}>{t('loading')}</div>
                    ) : (
                        <>
                            <div style={sectionHeader}>{t('pl.revenue')}</div>
                            {d.revenue.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>{t('pl.noRevenue')}</div>
                            ) : (
                                d.revenue.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount, t)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#16a34a' }}>
                                <span>{t('pl.totalRevenue')}</span>
                                <span>{fmtMoney(d.totalRevenue, t)}</span>
                            </div>
                            <div style={sectionHeader}>{t('pl.cogs')}</div>
                            {d.costOfGoodsSold.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>{t('pl.noCogs')}</div>
                            ) : (
                                d.costOfGoodsSold.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount, t)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#dc2626' }}>
                                <span>{t('pl.totalCogs')}</span>
                                <span>{fmtMoney(d.totalCOGS, t)}</span>
                            </div>
                            <div style={{ ...rowStyle, fontWeight: 800, color: '#16a34a' }}>
                                <span>{t('pl.grossProfit')}</span>
                                <span>{fmtMoney(d.grossProfit, t)}</span>
                            </div>
                            <div style={sectionHeader}>{t('pl.opex')}</div>
                            {d.operatingExpenses.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>{t('pl.noOpex')}</div>
                            ) : (
                                d.operatingExpenses.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount, t)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#dc2626' }}>
                                <span>{t('pl.totalOpex')}</span>
                                <span>{fmtMoney(d.totalOperatingExpenses, t)}</span>
                            </div>
                            <div style={sectionHeader}>{t('pl.otherIncome')}</div>
                            {d.otherIncome.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>{t('pl.noOtherIncome')}</div>
                            ) : (
                                d.otherIncome.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount, t)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#16a34a' }}>
                                <span>{t('pl.totalOtherIncome')}</span>
                                <span>{fmtMoney(d.totalOtherIncome, t)}</span>
                            </div>
                            <div style={sectionHeader}>{t('pl.otherExpenses')}</div>
                            {d.otherExpenses.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>{t('pl.noOtherExpenses')}</div>
                            ) : (
                                d.otherExpenses.map((r) => (
                                    <div key={r.code} style={rowStyle}>
                                        <span>{r.name}</span>
                                        <span>{fmtMoney(r.amount, t)}</span>
                                    </div>
                                ))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#dc2626' }}>
                                <span>{t('pl.totalOtherExpenses')}</span>
                                <span>{fmtMoney(d.totalOtherExpenses, t)}</span>
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
                                <span>{t('pl.netIncome')}</span>
                                <span style={{ color: d.netIncome >= 0 ? '#22c55e' : '#ef4444' }}>{fmtMoney(d.netIncome, t)}</span>
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
                        {t('date.apply')}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            printHtml(t('bs.printTitle'), `<h2>${t('bs.printTitle')}</h2><div>${t('bs.asOf', { date: fmtDateLabel(bsFilters.asOf) })}</div>`)
                        }
                        style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <Printer size={14} /> {t('btn.print')}
                    </button>
                </div>
                {bsLoading ? (
                    <div style={{ color: palette.textSecondary }}>{t('loading')}</div>
                ) : (
                    <>
                        <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700 }}>{t('bs.assets')}</div>
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>{t('bs.currentAssets')}</span>
                            <span>{fmtMoney(b.assets.current.reduce((s, x) => s + x.amount, 0), t)}</span>
                        </div>
                        {b.assets.current.map((r) => (
                            <div key={`ac-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount, t)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>{t('bs.fixedAssets')}</span>
                            <span>{fmtMoney(b.assets.fixed.reduce((s, x) => s + x.amount, 0), t)}</span>
                        </div>
                        {b.assets.fixed.map((r) => (
                            <div key={`af-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount, t)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>{t('bs.otherAssets')}</span>
                            <span>{fmtMoney(b.assets.other.reduce((s, x) => s + x.amount, 0), t)}</span>
                        </div>
                        {b.assets.other.map((r) => (
                            <div key={`ao-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount, t)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 800 }}>
                            <span>{t('bs.totalAssets')}</span>
                            <span>{fmtMoney(b.assets.totalAssets, t)}</span>
                        </div>
                        <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700, marginTop: 12 }}>{t('bs.liabilities')}</div>
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>{t('bs.currentLiab')}</span>
                            <span>{fmtMoney(b.liabilities.current.reduce((s, x) => s + x.amount, 0), t)}</span>
                        </div>
                        {b.liabilities.current.map((r) => (
                            <div key={`lc-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount, t)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 700 }}>
                            <span>{t('bs.longTermLiab')}</span>
                            <span>{fmtMoney(b.liabilities.longTerm.reduce((s, x) => s + x.amount, 0), t)}</span>
                        </div>
                        {b.liabilities.longTerm.map((r) => (
                            <div key={`ll-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount, t)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 800 }}>
                            <span>{t('bs.totalLiab')}</span>
                            <span>{fmtMoney(b.liabilities.totalLiabilities, t)}</span>
                        </div>
                        <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700, marginTop: 12 }}>{t('bs.equity')}</div>
                        {b.equity.accounts.map((r) => (
                            <div key={`eq-${r.code}`} style={bsRow}>
                                <span>{r.name}</span>
                                <span>{fmtMoney(r.amount, t)}</span>
                            </div>
                        ))}
                        <div style={{ ...bsRow, fontWeight: 800 }}>
                            <span>{t('bs.totalEquity')}</span>
                            <span>{fmtMoney(b.equity.totalEquity, t)}</span>
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
                            <span>{t('bs.totalLiabEquity')}</span>
                            <span>{fmtMoney(b.totalLiabilitiesAndEquity, t)}</span>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const modalTitle = editingId ? t('coa.modal.edit') : t('coa.modal.new');

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
                        {t('coa.title')}
                    </h1>
                </div>
                <p style={{ margin: 0, color: palette.textSecondary, fontSize: '0.875rem' }}>
                    {t('coa.subtitle')}
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
                {COA_TABS.map((tab) => {
                    const active = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
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
                            {t(tab.labelKey)}
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
                                    {t(`coa.group.${group.key}`)}
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: group.color }}>
                                    {t('coa.accountsCount', { n: (grouped[group.key] || []).length })}
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
                                placeholder={t('coa.searchPh')}
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
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={expandAllFolders}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            Expand folders
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={collapseAllFolders}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            Collapse folders
                        </button>
                        {!readOnly ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setPeriodCloseError('');
                                    setPeriodCloseDone(null);
                                    setPeriodCloseLabel('');
                                    setPeriodCloseDate(todayISO());
                                    setPeriodCloseNotes('');
                                    setPeriodCloseOpen(true);
                                }}
                                style={{
                                    whiteSpace: 'nowrap',
                                    border: 'none',
                                    background: '#0F766E',
                                    color: '#fff',
                                    borderRadius: 8,
                                    padding: '8px 14px',
                                    fontWeight: 700,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                }}
                            >
                                Run Period Closing
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => navigate('/workshop/accounting/period-closings')}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            Period Closings
                        </button>
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
                                    <option key={item.typeKey} value={item.value}>
                                        {item.typeKey === 'all' ? t('coa.type.all') : t(`coa.type.${item.typeKey}`)}
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
                                {t('coa.newAccount')}
                            </button>
                        )}
                    </div>
                    <p className="sa-acc-coa-hint" style={{ margin: '0 0 12px' }}>
                        {t('coa.hint.ws')}
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
                            {t('coa.loading')}
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
                                {t('coa.retry')}
                            </button>
                        </div>
                    ) : (
                        <div style={{ border: `1px solid ${palette.border}`, borderRadius: 8, overflow: 'hidden' }}>
                            {typeGroups.map((group) => {
                                const rows = grouped[group.key] || [];
                                const groupLabel = t(`coa.group.${group.key}`);
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
                                            <strong style={{ color: palette.textPrimary }}>{groupLabel}</strong>
                                            <span style={{ color: palette.textSecondary, fontSize: 13 }}>
                                                {rows.length === 1
                                                    ? t('coa.accountCount', { n: rows.length })
                                                    : t('coa.accountsCount', { n: rows.length })}
                                            </span>
                                        </div>

                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    {[
                                                        t('coa.th.code'),
                                                        t('coa.th.name'),
                                                        t('coa.th.subtype'),
                                                        t('coa.th.branch'),
                                                        t('coa.th.normalBal'),
                                                        t('coa.th.finalBal'),
                                                        t('coa.th.status'),
                                                        t('coa.th.actions'),
                                                    ]
                                                        .filter((h) => !readOnly || h !== t('coa.th.actions'))
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
                                                            {t('coa.emptyType', { type: groupLabel })}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    rows.map((acc) => {
                                                        const parentName = acc.parentId
                                                            ? parentNameById.get(String(acc.parentId)) || t('money.dash')
                                                            : t('money.dash');
                                                        const branchName = acc.branchId
                                                            ? branchById.get(String(acc.branchId)) || t('money.dash')
                                                            : t('coa.shared');
                                                        const autoLinked = acc.isAutoSeed;
                                                        const controlBadge = WORKSHOP_COA_CONTROL_BADGES[String(acc.code)];
                                                        const depth = Number(acc._depth || 0);
                                                        const hasChildren = Boolean(acc._hasChildren || acc.hasChildren);
                                                        const isExpanded = expandedIds.has(String(acc.id)) || Boolean(searchQ);
                                                        const bal = formatFinalBalance(acc, t);
                                                        const ledgerClickable = isWorkshopCoaLedgerClickable(acc);
                                                        const statusKey = `coa.status.${acc.status || 'active'}`;
                                                        const statusLabel = t(statusKey) !== statusKey ? t(statusKey) : (acc.status || t('coa.status.active'));
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
                                                                    background: hasChildren ? '#fafafa' : '#fff',
                                                                    cursor: ledgerClickable ? 'pointer' : 'default',
                                                                }}
                                                                onMouseOver={ledgerClickable ? (e) => {
                                                                    e.currentTarget.style.background = '#f3f4f6';
                                                                } : undefined}
                                                                onMouseOut={ledgerClickable ? (e) => {
                                                                    e.currentTarget.style.background = hasChildren ? '#fafafa' : '#fff';
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
                                                                    <div
                                                                        style={{
                                                                            fontWeight: hasChildren ? 700 : 600,
                                                                            color: palette.textPrimary,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 6,
                                                                            paddingLeft: depth * 18,
                                                                        }}
                                                                    >
                                                                        {hasChildren ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => toggleExpanded(acc.id, e)}
                                                                                title={isExpanded ? 'Collapse' : 'Expand'}
                                                                                style={{
                                                                                    border: 'none',
                                                                                    background: 'transparent',
                                                                                    padding: 0,
                                                                                    display: 'inline-flex',
                                                                                    cursor: 'pointer',
                                                                                    color: palette.textSecondary,
                                                                                }}
                                                                            >
                                                                                {isExpanded ? (
                                                                                    <ChevronDown size={16} />
                                                                                ) : (
                                                                                    <ChevronRight size={16} />
                                                                                )}
                                                                            </button>
                                                                        ) : (
                                                                            <span style={{ width: 16, display: 'inline-block' }} />
                                                                        )}
                                                                        {hasChildren ? (
                                                                            isExpanded ? (
                                                                                <FolderOpen size={15} color={palette.primary} />
                                                                            ) : (
                                                                                <Folder size={15} color={palette.primary} />
                                                                            )
                                                                        ) : null}
                                                                        <span>{acc.name}</span>
                                                                        {hasChildren && !controlBadge ? (
                                                                            <span
                                                                                style={{
                                                                                    background: '#FEF3C7',
                                                                                    color: '#92400E',
                                                                                    padding: '2px 8px',
                                                                                    borderRadius: 4,
                                                                                    fontSize: '0.7rem',
                                                                                    fontWeight: 600,
                                                                                }}
                                                                            >
                                                                                Folder
                                                                            </span>
                                                                        ) : null}
                                                                        {autoLinked && (
                                                                            <span
                                                                                style={{
                                                                                    background: palette.autoBadgeBg,
                                                                                    color: palette.autoBadgeText,
                                                                                    padding: '2px 8px',
                                                                                    borderRadius: 4,
                                                                                    fontSize: '0.7rem',
                                                                                    fontWeight: 600,
                                                                                }}
                                                                            >
                                                                                {t('coa.autoLinked')}
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
                                                                                }}
                                                                            >
                                                                                {t('coa.badge.control')}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                    <div
                                                                        style={{
                                                                            color: palette.textSecondary,
                                                                            fontStyle: 'italic',
                                                                            fontSize: 12,
                                                                            marginTop: 2,
                                                                            paddingLeft: depth * 18 + 22,
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
                                                                                paddingLeft: depth * 18 + 22,
                                                                            }}
                                                                        >
                                                                            {t('coa.pettyHint')}
                                                                        </div>
                                                                    ) : null}
                                                                </td>
                                                                <td style={{ padding: '12px', color: palette.textSecondary }}>
                                                                    {toLabel(acc.subType, t)}
                                                                </td>
                                                                <td style={{ padding: '12px', color: palette.textSecondary }}>
                                                                    {branchName}
                                                                </td>
                                                                <td style={{ padding: '12px', color: palette.textSecondary }}>
                                                                    {getNormalBalance(acc.type, t)}
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
                                                                        {statusLabel}
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
                                                                                <span>{t('coa.confirmDelete')}</span>
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
                                                                                        ? t('coa.deleting')
                                                                                        : t('coa.yesDelete')}
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
                                                                                    {t('btn.cancel')}
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
                                                                                    title={t('coa.editTitle')}
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
                                                                                        title={t('coa.deleteTitle')}
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

            {periodCloseOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.45)',
                        zIndex: 80,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                    }}
                    onClick={() => !periodCloseLoading && setPeriodCloseOpen(false)}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 480,
                            background: '#fff',
                            borderRadius: 14,
                            padding: 22,
                            boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                            Run Period Closing
                        </h3>
                        <p style={{ margin: '8px 0 16px', fontSize: 13, color: '#64748B', lineHeight: 1.45 }}>
                            Creates a frozen COA backup, downloads it to your PC, zeros live Chart of Accounts balances,
                            and adds a link under Period Closings. Sales, purchases, inventory, and journal history stay in place.
                        </p>

                        {periodCloseDone ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div
                                    style={{
                                        padding: 12,
                                        borderRadius: 10,
                                        background: '#ECFDF5',
                                        border: '1px solid #A7F3D0',
                                        color: '#065F46',
                                        fontSize: 13,
                                    }}
                                >
                                    {periodCloseDone.message || 'Period closed successfully.'}
                                    {periodCloseDone.linkPath ? (
                                        <div style={{ marginTop: 8 }}>
                                            Link:{' '}
                                            <button
                                                type="button"
                                                onClick={() => navigate(periodCloseDone.linkPath)}
                                                style={{
                                                    border: 'none',
                                                    background: 'none',
                                                    color: '#0F766E',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    textDecoration: 'underline',
                                                }}
                                            >
                                                {periodCloseDone.linkPath}
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                    <button
                                        type="button"
                                        className="btn-portal-outline"
                                        onClick={() => navigate('/workshop/accounting/period-closings')}
                                    >
                                        Open Period Closings
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPeriodCloseOpen(false);
                                            setPeriodCloseDone(null);
                                            setReloadTick((t) => t + 1);
                                        }}
                                        style={{
                                            border: 'none',
                                            background: palette.primary,
                                            color: '#fff',
                                            borderRadius: 8,
                                            padding: '10px 18px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'grid', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                            Period end date
                                        </label>
                                        <input
                                            type="date"
                                            value={periodCloseDate}
                                            onChange={(e) => setPeriodCloseDate(e.target.value)}
                                            style={inputStyle}
                                            disabled={periodCloseLoading}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                            Label (optional)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. FY 2025 / July 2026 close"
                                            value={periodCloseLabel}
                                            onChange={(e) => setPeriodCloseLabel(e.target.value)}
                                            style={inputStyle}
                                            disabled={periodCloseLoading}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                            Notes (optional)
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={periodCloseNotes}
                                            onChange={(e) => setPeriodCloseNotes(e.target.value)}
                                            style={{ ...inputStyle, resize: 'vertical' }}
                                            disabled={periodCloseLoading}
                                        />
                                    </div>
                                </div>
                                {periodCloseError ? (
                                    <div style={{ marginTop: 12, color: palette.delete, fontSize: 13 }}>
                                        {periodCloseError}
                                    </div>
                                ) : null}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                                    <button
                                        type="button"
                                        className="btn-portal-outline"
                                        disabled={periodCloseLoading}
                                        onClick={() => setPeriodCloseOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={periodCloseLoading}
                                        onClick={async () => {
                                            setPeriodCloseLoading(true);
                                            setPeriodCloseError('');
                                            try {
                                                const res = await runWorkshopPeriodClose({
                                                    label: periodCloseLabel || undefined,
                                                    periodEndDate: periodCloseDate || undefined,
                                                    notes: periodCloseNotes || undefined,
                                                });
                                                const root =
                                                    res?.data && typeof res.data === 'object' ? res.data : res;
                                                const backup = root?.backup;
                                                if (backup?.csv) {
                                                    const blob = new Blob([backup.csv], {
                                                        type: 'text/csv;charset=utf-8',
                                                    });
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = backup.fileName || 'COA_PeriodClose.csv';
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    a.remove();
                                                    URL.revokeObjectURL(url);
                                                }
                                                if (backup?.json) {
                                                    const blob = new Blob(
                                                        [JSON.stringify(backup.json, null, 2)],
                                                        { type: 'application/json' },
                                                    );
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = String(
                                                        backup.fileName || 'COA_PeriodClose.csv',
                                                    ).replace(/\.csv$/i, '.json');
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    a.remove();
                                                    URL.revokeObjectURL(url);
                                                }
                                                setPeriodCloseDone({
                                                    message: root?.message,
                                                    linkPath:
                                                        root?.periodClose?.linkPath ||
                                                        (root?.periodClose?.id
                                                            ? `/workshop/accounting/period-closings/${root.periodClose.id}`
                                                            : null),
                                                });
                                                setReloadTick((t) => t + 1);
                                            } catch (e) {
                                                setPeriodCloseError(
                                                    e?.message || 'Period closing failed',
                                                );
                                            } finally {
                                                setPeriodCloseLoading(false);
                                            }
                                        }}
                                        style={{
                                            border: 'none',
                                            background: '#0F766E',
                                            color: '#fff',
                                            borderRadius: 8,
                                            padding: '10px 18px',
                                            fontWeight: 700,
                                            cursor: periodCloseLoading ? 'wait' : 'pointer',
                                            opacity: periodCloseLoading ? 0.7 : 1,
                                        }}
                                    >
                                        {periodCloseLoading ? 'Closing…' : 'Confirm & close period'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
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
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('coa.field.code')}</label>
                                <input
                                    maxLength={20}
                                    value={form.code}
                                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('coa.field.name')}</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('coa.field.type')}</label>
                                <select
                                    value={form.type}
                                    onChange={(e) => onTypeChange(e.target.value)}
                                    style={inputStyle}
                                >
                                    <option value="ASSET">{t('coa.type.ASSET')}</option>
                                    <option value="LIABILITY">{t('coa.type.LIABILITY')}</option>
                                    <option value="EQUITY">{t('coa.type.EQUITY')}</option>
                                    <option value="INCOME">{t('coa.type.INCOME')}</option>
                                    <option value="EXPENSE">{t('coa.type.EXPENSE')}</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('coa.field.subtype')}</label>
                                <select
                                    value={form.subType}
                                    onChange={(e) => setForm((p) => ({ ...p, subType: e.target.value }))}
                                    style={inputStyle}
                                >
                                    {subtypeOptions.map((sub) => (
                                        <option key={sub} value={sub}>
                                            {toLabel(sub, t)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>
                                    {t('coa.field.branch')}
                                </label>
                                <select
                                    value={form.branchId}
                                    onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">{t('coa.field.branchShared')}</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                                <div style={{ fontSize: 11, color: palette.textSecondary, marginTop: 4 }}>
                                    {t('coa.field.branchHelp')}
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('coa.field.normalBal')}</label>
                                <input
                                    value={getNormalBalance(form.type, t)}
                                    readOnly
                                    style={{ ...inputStyle, background: '#f9fafb' }}
                                />
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('coa.field.parent')}</label>
                                <input
                                    placeholder={t('coa.field.parentSearch')}
                                    value={parentSearch}
                                    onChange={(e) => setParentSearch(e.target.value)}
                                    style={{ ...inputStyle, marginBottom: 6 }}
                                />
                                <select
                                    value={form.parentId}
                                    onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="">{t('coa.field.parentNone')}</option>
                                    {parentOptions.map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.code} - {acc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('coa.field.status')}</label>
                                <select
                                    value={form.status}
                                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                                    style={inputStyle}
                                >
                                    <option value="active">{t('coa.status.active')}</option>
                                    <option value="inactive">{t('coa.status.inactive')}</option>
                                </select>
                            </div>
                            <div></div>

                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('coa.field.description')}</label>
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
                                    {t('btn.cancel')}
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
                                    {submitLoading ? t('coa.saving') : editingId ? t('coa.update') : t('coa.create')}
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
