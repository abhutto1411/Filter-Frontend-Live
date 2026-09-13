import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    Building2,
    Scale,
    TrendingUp,
} from 'lucide-react';
import {
    deleteAccount,
    getAccounts,
    getAccountsBranches,
    getAccountsTree,
    getBalanceSheet,
    getPLReport,
    getTrialBalance,
} from '../../services/accountsApi';
import { runWorkshopPeriodClose } from '../../services/workshopAccountingApi';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';
import {
    buildWorkshopCoaAccountCreateUrl,
    buildWorkshopCoaAccountEditUrl,
    buildWorkshopCoaNavigationUrl,
    isWorkshopCoaLedgerClickable,
    isWorkshopPettyCashCoaControlAccount,
    WORKSHOP_COA_CONTROL_BADGES,
} from '../../pages/workshop/workshopCoaAccountRouting';
import {
    BALANCE_SHEET_TYPES,
    COA_STATEMENT_PARTS,
    INCOME_STATEMENT_TYPES,
    closingColumnsFromSigned,
    countGroupedAccounts,
    defaultTypeForStatementPart,
    filterTypeGroupsByChip,
    netProfitFromClosingBalances,
    partitionCoaTypeGroups,
    sumSignedClosingBalances,
} from '../../pages/workshop/workshopCoaStatementSplit';
import {
    vatBasisForCoaAccount,
    vatBasisHintKey,
    vatBasisI18nKey,
} from '../../pages/workshop/workshopCoaVatBasis';
import {
    loadSaAccountingDateRange,
    startOfMonthISO,
    todayISO,
} from '../../pages/admin/saAccountingDateRange';
import {
    defaultRiyadhReportRangeDatetimeLocal,
    fmtRiyadhRangeLabel,
    riyadhPlRangeToLedgerCalendarDates,
    workshopAdminRangeQueryParams,
    riyadhPlRangeToLedgerQueryParams,
    riyadhRangeToApiIso,
    BUSINESS_TIMEZONE,
} from '../../utils/riyadhBusinessRange';
import {
    loadWorkshopAdminDatetimeRange,
    saveWorkshopAdminDatetimeRange,
} from '../../pages/workshop/workshopAdminDatetimeRange';
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

const COA_TABS = [
    { id: 'Chart of Accounts', labelKey: 'tab.coa' },
    { id: 'Trial Balance', labelKey: 'tab.tb' },
    { id: 'P&L', labelKey: 'coa.tab.plShort' },
    { id: 'Balance Sheet', labelKey: 'tab.bs' },
];

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
        hasChildren: Boolean(raw.hasChildren || raw.isHeading),
        isHeading: Boolean(raw.isHeading || raw.hasChildren),
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

function CoaVatBasisBadge({ account, t }) {
    const basis = vatBasisForCoaAccount(account);
    return (
        <span
            className={`coa-vat-badge coa-vat-badge--${basis}`}
            title={t(vatBasisHintKey(basis))}
        >
            {t(vatBasisI18nKey(basis))}
        </span>
    );
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
 * New Account opens a full-page form. Branch tagging lets a branch-specific
 * account live alongside shared ones (cash registers, branch bank accounts).
 */
function plBranchFromLayout(selectedBranchId) {
    if (selectedBranchId == null || selectedBranchId === '' || selectedBranchId === 'all') return '';
    return String(selectedBranchId);
}

export default function WorkshopCOAView({
    readOnly = false,
    locale: localeProp,
    selectedBranchId = 'all',
}) {
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
    const initialCoaRange = (() => {
        const shared = loadWorkshopAdminDatetimeRange();
        if (shared?.dateFrom && shared?.dateTo) return shared;
        const r = defaultRiyadhReportRangeDatetimeLocal();
        return { dateFrom: r.start, dateTo: r.end };
    })();
    const initialCoaBranch = plBranchFromLayout(selectedBranchId);
    const [draftBranch, setDraftBranch] = useState(initialCoaBranch);
    const [draftDateFrom, setDraftDateFrom] = useState(initialCoaRange.dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(initialCoaRange.dateTo);
    const [appliedBranch, setAppliedBranch] = useState(initialCoaBranch);
    const [appliedDateFrom, setAppliedDateFrom] = useState(initialCoaRange.dateFrom);
    const [appliedDateTo, setAppliedDateTo] = useState(initialCoaRange.dateTo);
    const [coaRangeError, setCoaRangeError] = useState('');
    const [coaPart, setCoaPart] = useState(COA_STATEMENT_PARTS.BOTH);
    const [bsTypeFilter, setBsTypeFilter] = useState('');
    const [plTypeFilter, setPlTypeFilter] = useState('');

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

    const [plFilters, setPlFilters] = useState(() => {
        const shared = loadWorkshopAdminDatetimeRange();
        const branchId = plBranchFromLayout(selectedBranchId);
        if (shared?.dateFrom && shared?.dateTo) {
            return { dateFrom: shared.dateFrom, dateTo: shared.dateTo, branchId };
        }
        const r = defaultRiyadhReportRangeDatetimeLocal();
        return { dateFrom: r.start, dateTo: r.end, branchId };
    });
    const [plData, setPlData] = useState(null);
    const [plLoading, setPlLoading] = useState(false);
    const [plRangeError, setPlRangeError] = useState('');
    const plFetchGen = useRef(0);

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
                    branchId: appliedBranch || acc.branchId || '',
                }),
            );
        },
        [navigate, appliedBranch],
    );

    /** P&L line → account ledger for the same period / branch (proof of the total). */
    const openPlAccountProof = useCallback(
        (row, accountType) => {
            if (!row?.id) return;
            const shared = loadWorkshopAdminDatetimeRange();
            const rangeFrom = appliedDateFrom || plFilters.dateFrom || shared?.dateFrom || '';
            const rangeTo = appliedDateTo || plFilters.dateTo || shared?.dateTo || '';
            let dateFrom = rangeFrom;
            let dateTo = rangeTo;
            let startDate;
            let endDate;
            try {
                const q = riyadhPlRangeToLedgerQueryParams(rangeFrom, rangeTo);
                dateFrom = q.dateFrom;
                dateTo = q.dateTo;
            } catch {
                /* keep wall-clock locals if conversion fails */
            }
            try {
                if (rangeFrom && rangeTo) {
                    const iso = riyadhRangeToApiIso(rangeFrom, rangeTo);
                    startDate = iso.dateFrom;
                    endDate = iso.dateTo;
                }
            } catch {
                /* ISO optional — datetime-local still sent */
            }
            navigate(
                buildWorkshopCoaNavigationUrl(
                    {
                        id: row.id,
                        code: row.code,
                        name: row.name,
                        type: accountType,
                    },
                    {
                        dateFrom: dateFrom || undefined,
                        dateTo: dateTo || undefined,
                        startDate,
                        endDate,
                        proof: 'pl',
                        branchId: appliedBranch || plFilters.branchId || '',
                    },
                ),
            );
        },
        [navigate, appliedDateFrom, appliedDateTo, appliedBranch, plFilters.dateFrom, plFilters.dateTo, plFilters.branchId],
    );

    const openSalesReturnsProof = useCallback(() => {
        if (plFilters.dateFrom && plFilters.dateTo) {
            saveWorkshopAdminDatetimeRange({
                dateFrom: plFilters.dateFrom,
                dateTo: plFilters.dateTo,
            });
        }
        navigate('/workshop/sales-returns');
    }, [navigate, plFilters.dateFrom, plFilters.dateTo]);

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
        const next = plBranchFromLayout(selectedBranchId);
        setDraftBranch((prev) => (prev === next ? prev : next));
    }, [selectedBranchId]);

    const applyCoaFilters = useCallback(() => {
        if (!draftDateFrom || !draftDateTo) {
            setCoaRangeError(t('coa.err.rangeRequired'));
            return;
        }
        try {
            workshopAdminRangeQueryParams(draftDateFrom, draftDateTo);
        } catch (err) {
            setCoaRangeError(err?.message || t('coa.err.range'));
            return;
        }
        setCoaRangeError('');
        saveWorkshopAdminDatetimeRange({
            dateFrom: draftDateFrom,
            dateTo: draftDateTo,
        });
        setAppliedDateFrom(draftDateFrom);
        setAppliedDateTo(draftDateTo);
        setAppliedBranch(draftBranch);
        setPlFilters({
            dateFrom: draftDateFrom,
            dateTo: draftDateTo,
            branchId: draftBranch,
        });
        setReloadTick((x) => x + 1);
    }, [draftDateFrom, draftDateTo, draftBranch, t]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const params = { _t: Date.now() };
                if (appliedBranch) params.branchId = appliedBranch;
                if (appliedDateFrom && appliedDateTo) {
                    try {
                        const rangeParams = workshopAdminRangeQueryParams(appliedDateFrom, appliedDateTo);
                        params.dateFrom = rangeParams.dateFrom;
                        params.dateTo = rangeParams.dateTo;
                    } catch (rangeErr) {
                        if (!cancelled) setCoaRangeError(rangeErr?.message || t('coa.err.range'));
                    }
                }
                const treeParams = appliedBranch ? { branchId: appliedBranch } : {};
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
        void load();
        return () => {
            cancelled = true;
        };
    }, [reloadTick, appliedBranch, appliedDateFrom, appliedDateTo, t]);

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

    const statementTypeGroups = useMemo(() => partitionCoaTypeGroups(typeGroups), []);
    const bsGroupsVisible = useMemo(
        () => filterTypeGroupsByChip(statementTypeGroups.balanceSheet, bsTypeFilter),
        [statementTypeGroups, bsTypeFilter],
    );
    const plGroupsVisible = useMemo(
        () => filterTypeGroupsByChip(statementTypeGroups.incomeStatement, plTypeFilter),
        [statementTypeGroups, plTypeFilter],
    );
    const bsAccountCount = countGroupedAccounts(grouped, BALANCE_SHEET_TYPES);
    const plAccountCount = countGroupedAccounts(grouped, INCOME_STATEMENT_TYPES);

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

    const kpiTotals = useMemo(() => ({
        ASSET: sumSignedClosingBalances(accounts, 'ASSET'),
        LIABILITY: sumSignedClosingBalances(accounts, 'LIABILITY'),
        EQUITY: sumSignedClosingBalances(accounts, 'EQUITY'),
        INCOME: sumSignedClosingBalances(accounts, 'INCOME'),
        EXPENSE: sumSignedClosingBalances(accounts, 'EXPENSE'),
        netProfit: netProfitFromClosingBalances(accounts),
    }), [accounts]);

    const formatKpiAmount = (type, signed) => {
        const cols = closingColumnsFromSigned(type, signed);
        return formatFinalBalance({ closingDebit: cols.closingDebit, closingCredit: cols.closingCredit }, t);
    };

    const openCreate = (defaultType = 'ASSET') => {
        const type = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].includes(defaultType)
            ? defaultType
            : 'ASSET';
        const statement = INCOME_STATEMENT_TYPES.includes(type) ? 'pl' : 'bs';
        const branchId = appliedBranch || (selectedBranchId !== 'all' ? selectedBranchId : '');
        navigate(buildWorkshopCoaAccountCreateUrl({ type, statement, branchId }));
    };

    const openEdit = (acc) => {
        if (!acc?.id) return;
        navigate(buildWorkshopCoaAccountEditUrl(acc.id));
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

    const loadPL = async (overrideFilters) => {
        // Guard: leftover `<button onClick={loadPL}>` would pass a MouseEvent.
        const filters =
            overrideFilters
            && typeof overrideFilters === 'object'
            && ('dateFrom' in overrideFilters || 'dateTo' in overrideFilters)
                ? overrideFilters
                : {
                    dateFrom: appliedDateFrom,
                    dateTo: appliedDateTo,
                    branchId: appliedBranch,
                };
        const gen = ++plFetchGen.current;
        setPlLoading(true);
        setPlRangeError('');
        try {
            const rangeParams = workshopAdminRangeQueryParams(filters.dateFrom, filters.dateTo);
            if (filters.dateFrom && filters.dateTo) {
                saveWorkshopAdminDatetimeRange({
                    dateFrom: filters.dateFrom,
                    dateTo: filters.dateTo,
                });
            }
            const res = await getPLReport({
                ...rangeParams,
                branchId: filters.branchId || undefined,
            });
            if (gen !== plFetchGen.current) return;
            setPlData(res || null);
        } catch (err) {
            if (gen !== plFetchGen.current) return;
            setPlRangeError(err?.message || t('coa.err.generic'));
            setPlData(null);
        } finally {
            if (gen === plFetchGen.current) setPlLoading(false);
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
        if (activeTab === 'Trial Balance') {
            loadTrialBalance();
            return;
        }
        if (activeTab === 'Balance Sheet') {
            loadBalanceSheet();
            return;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Same applied From/To/branch as Chart of Accounts. Load only after Apply
    // (or when opening this tab with an already-applied range).
    useEffect(() => {
        if (activeTab !== 'P&L') return;
        if (!appliedDateFrom || !appliedDateTo) return;
        void loadPL({
            dateFrom: appliedDateFrom,
            dateTo: appliedDateTo,
            branchId: appliedBranch,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, appliedDateFrom, appliedDateTo, appliedBranch]);

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
                salesReturns: { amount: 0 },
                outputVat: { amount: 0 },
                salesAreInclVat: false,
                netSalesInclVat: 0,
                netRevenue: 0,
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
            const salesReturnsAmount = Number(d.salesReturns?.amount ?? 0);
            const outputVatAmount = Number(d.outputVat?.amount ?? 0);
            const salesAreInclVat = Boolean(d.salesAreInclVat);
            const netSalesInclVat = Number(
                d.netSalesInclVat != null
                    ? d.netSalesInclVat
                    : Number(d.totalRevenue || 0) - salesReturnsAmount,
            );
            const netSales = Number(
                d.netRevenue != null
                    ? d.netRevenue
                    : Number((netSalesInclVat - outputVatAmount).toFixed(2)),
            );
            const sectionHeader = { marginTop: 18, fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700 };
            const rowStyle = {
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: `1px solid ${palette.border}`,
            };
            const clickableRowStyle = {
                ...rowStyle,
                cursor: 'pointer',
                borderRadius: 4,
                margin: '0 -4px',
                paddingLeft: 4,
                paddingRight: 4,
            };
            const renderPlAccountRow = (r, accountType) => (
                <div
                    key={r.id || r.code}
                    role="button"
                    tabIndex={0}
                    title={t('pl.clickForProof', { name: r.name })}
                    style={clickableRowStyle}
                    onClick={() => openPlAccountProof(r, accountType)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openPlAccountProof(r, accountType);
                        }
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                    }}
                >
                    <span style={{ color: '#2563eb', fontWeight: 600 }}>{r.name}</span>
                    <span style={{ color: '#2563eb', fontWeight: 600 }}>{fmtMoney(r.amount, t)}</span>
                </div>
            );
            return (
                <div style={reportCard}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        <label className="coa-range-field">
                            <span>{t('coa.range.from')}</span>
                            <input
                                type="datetime-local"
                                value={draftDateFrom}
                                onChange={(e) => setDraftDateFrom(e.target.value)}
                                style={{ ...inputStyle, minWidth: 190 }}
                                title="Asia/Riyadh"
                            />
                        </label>
                        <label className="coa-range-field">
                            <span>{t('coa.range.to')}</span>
                            <input
                                type="datetime-local"
                                value={draftDateTo}
                                onChange={(e) => setDraftDateTo(e.target.value)}
                                style={{ ...inputStyle, minWidth: 190 }}
                                title="Asia/Riyadh"
                            />
                        </label>
                        {renderBranchPicker(draftBranch, setDraftBranch)}
                        <button
                            type="button"
                            className="btn-portal-dark"
                            onClick={applyCoaFilters}
                            disabled={plLoading}
                            style={{ whiteSpace: 'nowrap', height: 38 }}
                        >
                            {t('date.apply')}
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                printHtml(
                                    t('pl.printTitle'),
                                    `<h2>${t('pl.printHeading')}</h2><div>${t('pl.period', { from: fmtRiyadhRangeLabel(appliedDateFrom), to: fmtRiyadhRangeLabel(appliedDateTo) })}</div>`,
                                )
                            }
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <Printer size={14} /> {t('btn.print')}
                        </button>
                    </div>
                    <div style={{ fontSize: 12, color: palette.textSecondary, marginBottom: 6 }}>
                        {t('pl.riyadhHint')}
                    </div>
                    <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 10, fontWeight: 600 }}>
                        {t('pl.clickHint')}
                    </div>
                    {plRangeError ? (
                        <div style={{ color: '#B91C1C', marginBottom: 10, fontSize: 13 }}>{plRangeError}</div>
                    ) : null}
                    {plLoading ? (
                        <div style={{ color: palette.textSecondary }}>{t('loading')}</div>
                    ) : (
                        <>
                            <div style={sectionHeader}>{t('pl.revenue')}</div>
                            {d.revenue.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>{t('pl.noRevenue')}</div>
                            ) : (
                                d.revenue.map((r) => renderPlAccountRow(r, 'INCOME'))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#16a34a' }}>
                                <span>{t('pl.totalRevenue')}</span>
                                <span>{fmtMoney(d.totalRevenue, t)}</span>
                            </div>
                            {salesAreInclVat ? (
                                <>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        title={t('pl.clickSalesReturns')}
                                        style={clickableRowStyle}
                                        onClick={openSalesReturnsProof}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                openSalesReturnsProof();
                                            }
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#f1f5f9';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{t('pl.salesReturns')}</span>
                                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{fmtMoney(salesReturnsAmount, t)}</span>
                                    </div>
                                    <div style={{ ...rowStyle, fontWeight: 800, color: '#16a34a' }}>
                                        <span>{t('pl.netSales')}</span>
                                        <span>{fmtMoney(netSalesInclVat, t)}</span>
                                    </div>
                                    <div style={{ ...rowStyle, fontWeight: 600, color: '#dc2626' }}>
                                        <span>{t('pl.outputVat')}</span>
                                        <span>{fmtMoney(outputVatAmount, t)}</span>
                                    </div>
                                    <div style={{ ...rowStyle, fontWeight: 800, color: '#16a34a' }}>
                                        <span>{t('pl.netRevenueExVat')}</span>
                                        <span>{fmtMoney(netSales, t)}</span>
                                    </div>
                                </>
                            ) : null}
                            <div style={sectionHeader}>{t('pl.cogs')}</div>
                            {d.costOfGoodsSold.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>{t('pl.noCogs')}</div>
                            ) : (
                                d.costOfGoodsSold.map((r) => renderPlAccountRow(r, 'EXPENSE'))
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
                                d.operatingExpenses.map((r) => renderPlAccountRow(r, 'EXPENSE'))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#dc2626' }}>
                                <span>{t('pl.totalOpex')}</span>
                                <span>{fmtMoney(d.totalOperatingExpenses, t)}</span>
                            </div>
                            <div style={sectionHeader}>{t('pl.otherIncome')}</div>
                            {d.otherIncome.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>{t('pl.noOtherIncome')}</div>
                            ) : (
                                d.otherIncome.map((r) => renderPlAccountRow(r, 'INCOME'))
                            )}
                            <div style={{ ...rowStyle, fontWeight: 700, color: '#16a34a' }}>
                                <span>{t('pl.totalOtherIncome')}</span>
                                <span>{fmtMoney(d.totalOtherIncome, t)}</span>
                            </div>
                            <div style={sectionHeader}>{t('pl.otherExpenses')}</div>
                            {d.otherExpenses.length === 0 ? (
                                <div style={{ color: palette.textSecondary, fontSize: 13 }}>{t('pl.noOtherExpenses')}</div>
                            ) : (
                                d.otherExpenses.map((r) => renderPlAccountRow(r, 'EXPENSE'))
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

    const renderCoaGroupTables = (groups) => (
        <div className="coa-statement-table-wrap">
            {groups.map((group) => {
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
                        <table>
                            <thead>
                                <tr>
                                    {[
                                        t('coa.th.code'),
                                        t('coa.th.name'),
                                        t('coa.th.finalBal'),
                                        !readOnly ? t('coa.th.actions') : null,
                                    ]
                                        .filter(Boolean)
                                        .map((header) => (
                                            <th
                                                key={header}
                                                style={{
                                                    textAlign: header === t('coa.th.finalBal') ? 'right' : 'left',
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
                                            colSpan={readOnly ? 3 : 4}
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
                                        const autoLinked = acc.isAutoSeed;
                                        const controlBadge = WORKSHOP_COA_CONTROL_BADGES[String(acc.code)];
                                        const depth = Number(acc._depth || 0);
                                        const hasChildren = Boolean(acc._hasChildren || acc.hasChildren);
                                        const isExpanded = expandedIds.has(String(acc.id)) || Boolean(searchQ);
                                        const bal = formatFinalBalance(acc, t);
                                        const ledgerClickable = isWorkshopCoaLedgerClickable(acc);
                                        const inactive = String(acc.status || 'active').toLowerCase() === 'inactive';
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
                                            >
                                                <td
                                                    style={{
                                                        padding: '10px 12px',
                                                        color: palette.textSecondary,
                                                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                                                        width: 88,
                                                        fontSize: 12,
                                                    }}
                                                >
                                                    {acc.code}
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <div
                                                        style={{
                                                            fontWeight: hasChildren ? 700 : 600,
                                                            color: palette.textPrimary,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            paddingLeft: depth * 16,
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
                                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                            </button>
                                                        ) : (
                                                            <span style={{ width: 16, display: 'inline-block' }} />
                                                        )}
                                                        {hasChildren ? (
                                                            isExpanded
                                                                ? <FolderOpen size={15} color={palette.primary} />
                                                                : <Folder size={15} color={palette.primary} />
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
                                                        {autoLinked ? (
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
                                                        ) : null}
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
                                                        {inactive ? (
                                                            <span
                                                                style={{
                                                                    background: '#FEE2E2',
                                                                    color: '#991B1B',
                                                                    padding: '2px 8px',
                                                                    borderRadius: 4,
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                {t('coa.status.inactive')}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <div
                                                        style={{
                                                            color: palette.textSecondary,
                                                            fontStyle: 'italic',
                                                            fontSize: 12,
                                                            marginTop: 2,
                                                            paddingLeft: depth * 16 + 22,
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
                                                                paddingLeft: depth * 16 + 22,
                                                            }}
                                                        >
                                                            {t('coa.pettyHint')}
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td
                                                    style={{
                                                        padding: '10px 12px',
                                                        fontWeight: 600,
                                                        color: bal.color,
                                                        fontVariantNumeric: 'tabular-nums',
                                                        whiteSpace: 'nowrap',
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    <div className="coa-vat-balance">
                                                        <span>{bal.text}</span>
                                                        <CoaVatBasisBadge account={acc} t={t} />
                                                    </div>
                                                </td>
                                                {!readOnly ? (
                                                    <td
                                                        style={{ padding: '10px 12px', width: 72 }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => e.stopPropagation()}
                                                    >
                                                        {pendingDeleteId === acc.id ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
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
                                                                    {deleteLoadingId === acc.id ? t('coa.deleting') : t('coa.yesDelete')}
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
                                                                        borderRadius: 6,
                                                                        padding: '4px 8px',
                                                                        cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    {t('btn.cancel')}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', gap: 8 }}>
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
                                                                {!autoLinked ? (
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
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </td>
                                                ) : null}
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
    );

    const renderStatementPanel = (part) => {
        const isBs = part === COA_STATEMENT_PARTS.BALANCE_SHEET;
        const groups = isBs ? bsGroupsVisible : plGroupsVisible;
        const chipTypes = isBs ? BALANCE_SHEET_TYPES : INCOME_STATEMENT_TYPES;
        const chipValue = isBs ? bsTypeFilter : plTypeFilter;
        const setChip = isBs ? setBsTypeFilter : setPlTypeFilter;
        const count = isBs ? bsAccountCount : plAccountCount;
        return (
            <section
                className={`coa-statement-panel ${isBs ? 'coa-statement-panel--bs' : 'coa-statement-panel--pl'}`}
                data-testid={isBs ? 'coa-balance-sheet' : 'coa-income-statement'}
            >
                <header className="coa-statement-panel-head">
                    <div>
                        <p className="coa-statement-panel-kicker">{isBs ? t('tab.bs') : t('coa.tab.plShort')}</p>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isBs ? <Scale size={20} color="#1d4ed8" /> : <TrendingUp size={20} color="#b45309" />}
                            {isBs ? t('coa.part.bs') : t('coa.part.pl')}
                        </h2>
                        <p>{isBs ? t('coa.part.bsHint') : t('coa.part.plHint')}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ color: palette.textSecondary, fontSize: 13, fontWeight: 600 }}>
                            {count === 1 ? t('coa.accountCount', { n: count }) : t('coa.accountsCount', { n: count })}
                        </span>
                        {!readOnly ? (
                            <button
                                type="button"
                                onClick={() => openCreate(defaultTypeForStatementPart(part))}
                                title={isBs ? t('coa.part.bsNew') : t('coa.part.plNew')}
                                style={{
                                    border: 'none',
                                    background: palette.primary,
                                    color: '#fff',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontWeight: 700,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                }}
                            >
                                <Plus size={15} />
                                {t('coa.newAccount')}
                            </button>
                        ) : null}
                    </div>
                </header>
                <div className="coa-statement-chips">
                    <button
                        type="button"
                        className={`coa-statement-chip${!chipValue ? ' is-active' : ''}`}
                        onClick={() => setChip('')}
                    >
                        {t('coa.part.filterAll')}
                    </button>
                    {chipTypes.map((typeKey) => (
                        <button
                            key={typeKey}
                            type="button"
                            className={`coa-statement-chip${chipValue === typeKey ? ' is-active' : ''}`}
                            onClick={() => setChip(typeKey)}
                        >
                            {t(`coa.group.${typeKey}`)}
                            <span style={{ marginLeft: 6, color: '#94a3b8' }}>
                                {(grouped[typeKey] || []).length}
                            </span>
                        </button>
                    ))}
                </div>
                <div className={`coa-statement-panel-kpis${isBs ? '' : ' is-pl'}`}>
                    {(isBs ? statementTypeGroups.balanceSheet : statementTypeGroups.incomeStatement).map((group) => {
                        const signed = kpiTotals[group.key] || 0;
                        const shown = formatKpiAmount(group.key, signed);
                        return (
                            <div
                                key={group.key}
                                className="coa-statement-kpi"
                                data-testid={`coa-kpi-${group.key.toLowerCase()}`}
                            >
                                <span>{t(`coa.group.${group.key}`)}</span>
                                <strong style={{ color: shown.color }}>{shown.text}</strong>
                            </div>
                        );
                    })}
                    {!isBs ? (
                        <div
                            className={`coa-statement-kpi coa-statement-kpi--net ${kpiTotals.netProfit < -0.005 ? 'is-loss' : 'is-profit'}`}
                            data-testid="coa-kpi-net-profit"
                        >
                            <span>
                                {kpiTotals.netProfit < -0.005 ? t('coa.kpi.netLoss') : t('coa.kpi.netProfit')}
                            </span>
                            <strong>
                                {fmtMoney(Math.abs(kpiTotals.netProfit), t)}
                            </strong>
                            <em>{t('coa.kpi.netHint')}</em>
                        </div>
                    ) : null}
                </div>
                {renderCoaGroupTables(groups)}
            </section>
        );
    };

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
                        <div className="coa-statement-switch" role="tablist" aria-label={t('coa.title')}>
                            {[
                                { id: COA_STATEMENT_PARTS.BOTH, label: t('coa.part.both') },
                                { id: COA_STATEMENT_PARTS.BALANCE_SHEET, label: t('coa.part.bs') },
                                { id: COA_STATEMENT_PARTS.INCOME_STATEMENT, label: t('coa.part.pl') },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={coaPart === item.id}
                                    className={coaPart === item.id ? 'is-active' : ''}
                                    onClick={() => setCoaPart(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
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
                    </div>
                    <div className="coa-filter-row">
                        <label className="coa-range-field">
                            <span>{t('coa.range.from')}</span>
                            <input
                                type="datetime-local"
                                value={draftDateFrom}
                                onChange={(e) => setDraftDateFrom(e.target.value)}
                                title="Asia/Riyadh"
                            />
                        </label>
                        <label className="coa-range-field">
                            <span>{t('coa.range.to')}</span>
                            <input
                                type="datetime-local"
                                value={draftDateTo}
                                onChange={(e) => setDraftDateTo(e.target.value)}
                                title="Asia/Riyadh"
                            />
                        </label>
                        {renderBranchPicker(draftBranch, setDraftBranch)}
                        <button
                            type="button"
                            className="btn-portal-dark"
                            onClick={applyCoaFilters}
                            disabled={loading}
                            style={{ whiteSpace: 'nowrap', height: 38 }}
                        >
                            {t('date.apply')}
                        </button>
                    </div>
                    {coaRangeError ? (
                        <p className="coa-filter-error" role="alert">{coaRangeError}</p>
                    ) : null}
                    <p className="sa-acc-coa-hint" style={{ margin: '0 0 12px' }}>
                        {t('coa.hint.ws')}
                    </p>
                    <p className="coa-vat-legend">{t('coa.vat.legend')}</p>

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
                        <div
                            className={`coa-statement-split${coaPart !== COA_STATEMENT_PARTS.BOTH ? ' is-single' : ''}`}
                            data-testid="coa-statement-split"
                        >
                            {coaPart !== COA_STATEMENT_PARTS.INCOME_STATEMENT
                                ? renderStatementPanel(COA_STATEMENT_PARTS.BALANCE_SHEET)
                                : null}
                            {coaPart !== COA_STATEMENT_PARTS.BALANCE_SHEET
                                ? renderStatementPanel(COA_STATEMENT_PARTS.INCOME_STATEMENT)
                                : null}
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
