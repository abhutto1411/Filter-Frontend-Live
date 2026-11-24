import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    BookOpen,
    ChevronDown,
    ChevronRight,
    Pencil,
    Printer,
    Plus,
    SlidersHorizontal,
    RefreshCw,
    Search,
    Trash2,
} from 'lucide-react';
import RiyalIcon from '../RiyalIcon';
import {
    deleteAccount,
    getAccounts,
    getAccountsBranches,
    getAccountsTree,
    getBalanceSheet,
    getPLReport,
    getTrialBalance,
} from '../../services/accountsApi';
import {
    listCoaAccounts,
    adjustWorkshopCoaAccount,
    getHeadingDirectBalances,
    reclassHeadingAccount,
} from '../../services/workshopAccountingApi';
import { getAccountingSettings } from '../../services/accountingSettingsApi';
import WorkshopCoaAdjustModal from './WorkshopCoaAdjustModal';
import WorkshopCoaHeadingReclassModal, {
    mapReclassError,
} from './WorkshopCoaHeadingReclassModal';
import { useAuth } from '../../context/AuthContext';
import { isPlatformSuperAdmin } from '../../utils/allowNegativeBalance';
import { toRiyadhDateISO } from '../../utils/riyadhBusinessRange';
import { defaultHeadingReclassDate } from '../../utils/headingReclassDate';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';
import {
    buildWorkshopCoaAccountCreateUrl,
    buildWorkshopCoaAccountEditUrl,
    buildWorkshopCoaNavigationUrl,
    isWorkshopCoaLedgerClickable,
    WORKSHOP_COA_CONTROL_BADGES,
} from '../../pages/workshop/workshopCoaAccountRouting';
import { INCOME_STATEMENT_TYPES } from '../../pages/workshop/workshopCoaStatementSplit';
import {
    vatBasisForCoaAccount,
    vatBasisHintKey,
    vatBasisI18nKey,
} from '../../pages/workshop/workshopCoaVatBasis';
import {
    defaultInclusiveCoaCalendarRange,
    defaultTbBsReportDates,
    fmtRiyadhRangeLabel,
    toInclusiveCalendarRange,
    inclusiveCalendarRangeToDatetimeLocal,
    riyadhPlRangeToLedgerQueryParams,
    riyadhRangeToApiIso,
} from '../../utils/riyadhBusinessRange';
import {
    loadWorkshopAdminDatetimeRange,
    saveWorkshopAdminDatetimeRange,
} from '../../pages/workshop/workshopAdminDatetimeRange';
import { accT } from '../../utils/accountingI18n';
import { formatCashGuardMessage } from '../../utils/cashGuardMessage';

export function workshopCoaCashGuardLang(locale) {
    return String(locale || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}
import {
    BS_WARNING_BANNER_STYLE,
    balanceSheetBadge,
    bsLineDisplayAmount,
    bsWarningMessages,
    countLeafAndHeading,
    escapeHtml,
    isLegacyHeadingDirectRow,
    isReportRangeInvalidError,
    plMarginPercent,
    plRevenueReconciliation,
    printReportHtml,
    slicePage,
    sumOwnAmounts,
    trialBalanceBadge,
    trialBalanceHasPeriodColumns,
    trialBalanceColumnTotals,
    TB_PERIOD_TOTAL_FIELDS,
} from '../../utils/accountingReportDisplay';
import { reportShowsLegacy } from '../../utils/accountingSettingsDisplay';
import {
    COA_DEFAULT_STATUS,
    COA_PAGE_SIZE,
    clampPageOffset,
    collectSelfMatchingAccounts,
    filterTreeByTypeStatus,
    filterTreeForSearch,
    flattenVisibleTree,
    isCoaHeadingRow,
    mergeCoaRow,
} from '../../utils/coaTreeFilter';
import SelectCombo from '../SelectCombo';
import { PaginationControls } from '../PaginationControls';
import CoaAccountSearchCombobox from './CoaAccountSearchCombobox';
import SystemAccountConflictDialog from './SystemAccountConflictDialog';
import { listSystemAccountConflicts } from '../../services/accountsApi';
import { canResolveSystemAccountConflict } from '../../utils/systemAccountConflict';
import ReportSummaryCards from './reports/ReportSummaryCards';
import { buildHeadingReclassRows } from './headingReclassRows';

const REPORT_MODE_TAB = {
    'trial-balance': 'Trial Balance',
    'profit-loss': 'P&L',
    'balance-sheet': 'Balance Sheet',
};
const REPORT_PAGE_SIZE = 25;

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

function getErrorMessage(error, t) {
    return error?.message || t('coa.err.generic');
}

function stampTreeBalances(nodes, byId) {
    return (nodes || []).map((node) => {
        const flat = byId.get(String(node.id)) || {};
        return {
            ...node,
            id: String(node.id),
            parentId: node.parentId != null && node.parentId !== '' ? String(node.parentId) : null,
            closingDebit: Number(flat.closingDebit ?? 0),
            closingCredit: Number(flat.closingCredit ?? 0),
            children: stampTreeBalances(node.children, byId),
        };
    });
}

function ReportLegacyBanner({ report, t }) {
    if (!reportShowsLegacy(report)) return null;
    return (
        <div
            role="status"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 10,
                paddingBlock: 4,
                paddingInline: 10,
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
            }}
        >
            {t('accSettings.reportLegacyBadge')}
            {report?.legacyBefore ? ` (${report.legacyBefore})` : ''}
        </div>
    );
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
    if (!basis) return null;
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
    /** Standalone report routes: 'trial-balance' | 'profit-loss' | 'balance-sheet' */
    reportMode = null,
    /** Super Admin admin-accounting scope: force API workshopId */
    workshopId: workshopIdProp = null,
    /** Limit list to headings with a direct balance + Reclassify modal */
    headingReclassOnly = false,
}) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const { user, hasPermission: hasPermCoa } = useAuth();
    /** GET /accounts/system-accounts/conflicts → banner + resolve dialog. */
    const [sysConflicts, setSysConflicts] = useState([]);
    const [sysConflictOpen, setSysConflictOpen] = useState(null);
    const loadSysConflicts = useCallback(async () => {
        try {
            const res = await listSystemAccountConflicts();
            const rows = Array.isArray(res) ? res : res?.conflicts || [];
            setSysConflicts(rows);
        } catch {
            setSysConflicts([]);
        }
    }, []);
    const isSuperAdmin = isPlatformSuperAdmin(user);
    const scopeParams = useMemo(() => {
        const id =
            workshopIdProp != null && String(workshopIdProp).trim() !== ''
                ? String(workshopIdProp).trim()
                : '';
        return id ? { workshopId: id } : {};
    }, [workshopIdProp]);
    const isReportOnly = Boolean(reportMode && REPORT_MODE_TAB[reportMode]);
    useEffect(() => {
        if (!isReportOnly) void loadSysConflicts();
    }, [isReportOnly, loadSysConflicts]);
    const [accounts, setAccounts] = useState([]);
    const [treeAccounts, setTreeAccounts] = useState([]);
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [expandInitForTree, setExpandInitForTree] = useState('');
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reloadTick, setReloadTick] = useState(0);
    const [headingBuckets, setHeadingBuckets] = useState([]);
    const [headingReclassOpen, setHeadingReclassOpen] = useState(false);
    const [reclassTarget, setReclassTarget] = useState(null);
    const [reclassError, setReclassError] = useState('');
    const [reclassSubmitting, setReclassSubmitting] = useState(false);
    const [reclassSuccess, setReclassSuccess] = useState(null);
    const [reclassDefaultDate, setReclassDefaultDate] = useState(() => toRiyadhDateISO());
    const headingDirectIds = useMemo(
        () => new Set((headingBuckets || []).map((b) => String(b.headingId))),
        [headingBuckets],
    );

    // COA list filters (mockup 03): drafts are applied only on Apply / Show all.
    const [draftSearch, setDraftSearch] = useState('');
    const [draftType, setDraftType] = useState('');
    const [draftStatus, setDraftStatus] = useState(COA_DEFAULT_STATUS);
    const [appliedSearch, setAppliedSearch] = useState('');
    const [appliedType, setAppliedType] = useState('');
    const [appliedStatus, setAppliedStatus] = useState(COA_DEFAULT_STATUS);
    const [coaPageOffset, setCoaPageOffset] = useState(0);
    // Report-only date range (P&L Apply / TB / BS fallbacks). Not shown on the COA list.
    const initialCoaRange = (() => {
        const shared = loadWorkshopAdminDatetimeRange();
        if (shared?.dateFrom && shared?.dateTo) {
            return toInclusiveCalendarRange(shared.dateFrom, shared.dateTo);
        }
        return defaultInclusiveCoaCalendarRange();
    })();
    const initialCoaBranch = plBranchFromLayout(selectedBranchId);
    const [draftBranch, setDraftBranch] = useState(initialCoaBranch);
    const [draftDateFrom, setDraftDateFrom] = useState(initialCoaRange.dateFrom);
    const [draftDateTo, setDraftDateTo] = useState(initialCoaRange.dateTo);
    const [appliedBranch, setAppliedBranch] = useState(initialCoaBranch);
    const [appliedDateFrom, setAppliedDateFrom] = useState(initialCoaRange.dateFrom);
    const [appliedDateTo, setAppliedDateTo] = useState(initialCoaRange.dateTo);

    const [adjustTarget, setAdjustTarget] = useState(null);
    const [adjustAccounts, setAdjustAccounts] = useState([]);
    const [adjustError, setAdjustError] = useState('');
    const [adjustSubmitting, setAdjustSubmitting] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState('');
    const [deleteLoadingId, setDeleteLoadingId] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [activeTab, setActiveTab] = useState(
        () => REPORT_MODE_TAB[reportMode] || 'Chart of Accounts',
    );
    const [tbPageOffset, setTbPageOffset] = useState(0);
    const [tbFilters, setTbFilters] = useState(() => {
        const d = defaultTbBsReportDates();
        return {
            dateFrom: d.tb.dateFrom,
            dateTo: d.tb.dateTo,
            branchId: plBranchFromLayout(selectedBranchId),
        };
    });
    const [tbAccountId, setTbAccountId] = useState('');
    const [tbData, setTbData] = useState({
        accounts: [],
        totalDebits: 0,
        totalCredits: 0,
        isBalanced: true,
    });
    const [tbLoading, setTbLoading] = useState(false);
    const [tbError, setTbError] = useState('');

    const [plFilters, setPlFilters] = useState(() => {
        const shared = loadWorkshopAdminDatetimeRange();
        const branchId = plBranchFromLayout(selectedBranchId);
        if (shared?.dateFrom && shared?.dateTo) {
            const cal = toInclusiveCalendarRange(shared.dateFrom, shared.dateTo);
            return { dateFrom: cal.dateFrom, dateTo: cal.dateTo, branchId };
        }
        const r = defaultInclusiveCoaCalendarRange();
        return { dateFrom: r.dateFrom, dateTo: r.dateTo, branchId };
    });
    const [plData, setPlData] = useState(null);
    const [plLoading, setPlLoading] = useState(false);
    const [plRangeError, setPlRangeError] = useState('');
    const plFetchGen = useRef(0);

    const [bsFilters, setBsFilters] = useState(() => {
        const d = defaultTbBsReportDates();
        return {
            asOf: d.bs.asOf,
            branchId: plBranchFromLayout(selectedBranchId),
        };
    });
    const [bsData, setBsData] = useState(null);
    const [bsLoading, setBsLoading] = useState(false);
    const [bsError, setBsError] = useState('');

    /** COA list shows current closing balances, so the ledger opens without a date filter. */
    const openAccountLedger = useCallback(
        (acc) => {
            if (!isWorkshopCoaLedgerClickable(acc)) return;
            navigate(
                buildWorkshopCoaNavigationUrl(acc, {
                    branchId: appliedBranch || acc.branchId || '',
                }),
            );
        },
        [navigate, appliedBranch],
    );

    /** Report line → account ledger for the chosen period / branch (works for all account types). */
    const openReportAccountLedger = useCallback(
        (row, accountType, opts = {}) => {
            if (!row?.id || isLegacyHeadingDirectRow(row)) return;
            const shared = loadWorkshopAdminDatetimeRange();
            const rangeFrom =
                opts.dateFrom
                || appliedDateFrom
                || plFilters.dateFrom
                || tbFilters.dateFrom
                || shared?.dateFrom
                || '';
            const rangeTo =
                opts.dateTo
                || appliedDateTo
                || plFilters.dateTo
                || tbFilters.dateTo
                || bsFilters.asOf
                || shared?.dateTo
                || '';
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
            const type = String(accountType || row.type || '').toUpperCase() || undefined;
            navigate(
                buildWorkshopCoaNavigationUrl(
                    {
                        id: row.id,
                        code: row.code,
                        name: row.name,
                        type,
                    },
                    {
                        dateFrom: dateFrom || undefined,
                        dateTo: dateTo || undefined,
                        startDate,
                        endDate,
                        proof: opts.proof || undefined,
                        branchId:
                            opts.branchId
                            || appliedBranch
                            || plFilters.branchId
                            || tbFilters.branchId
                            || bsFilters.branchId
                            || '',
                    },
                ),
            );
        },
        [
            navigate,
            appliedDateFrom,
            appliedDateTo,
            appliedBranch,
            plFilters.dateFrom,
            plFilters.dateTo,
            plFilters.branchId,
            tbFilters.dateFrom,
            tbFilters.dateTo,
            tbFilters.branchId,
            bsFilters.asOf,
            bsFilters.branchId,
        ],
    );

    const openPlAccountProof = useCallback(
        (row, accountType) => openReportAccountLedger(row, accountType, { proof: 'pl' }),
        [openReportAccountLedger],
    );

    const openSalesReturnsProof = useCallback(() => {
        if (plFilters.dateFrom && plFilters.dateTo) {
            const cal = toInclusiveCalendarRange(plFilters.dateFrom, plFilters.dateTo);
            saveWorkshopAdminDatetimeRange(
                inclusiveCalendarRangeToDatetimeLocal(cal.dateFrom, cal.dateTo),
            );
        }
        navigate('/workshop/sales-returns');
    }, [navigate, plFilters.dateFrom, plFilters.dateTo]);

    useEffect(() => {
        if (!appliedDateFrom || !appliedDateTo) return;
        const cal = toInclusiveCalendarRange(appliedDateFrom, appliedDateTo);
        if (!cal.dateFrom || !cal.dateTo) return;
        if (cal.dateFrom === appliedDateFrom && cal.dateTo === appliedDateTo) return;
        setAppliedDateFrom(cal.dateFrom);
        setAppliedDateTo(cal.dateTo);
        setDraftDateFrom(cal.dateFrom);
        setDraftDateTo(cal.dateTo);
    }, [appliedDateFrom, appliedDateTo]);

    useEffect(() => {
        if (appliedDateFrom && appliedDateTo) {
            const cal = toInclusiveCalendarRange(appliedDateFrom, appliedDateTo);
            saveWorkshopAdminDatetimeRange(
                inclusiveCalendarRangeToDatetimeLocal(cal.dateFrom, cal.dateTo),
            );
        }
    }, [appliedDateFrom, appliedDateTo]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const list = await getAccountsBranches(scopeParams);
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
    }, [scopeParams]);

    useEffect(() => {
        const next = plBranchFromLayout(selectedBranchId);
        setDraftBranch((prev) => (prev === next ? prev : next));
        setAppliedBranch((prev) => (prev === next ? prev : next));
        setPlFilters((p) => (p.branchId === next ? p : { ...p, branchId: next }));
        setTbFilters((p) => (p.branchId === next ? p : { ...p, branchId: next }));
        setBsFilters((p) => (p.branchId === next ? p : { ...p, branchId: next }));
    }, [selectedBranchId]);

    /** P&L report Apply: draft From/To/branch → applied range (loaded by the P&L effect). */
    const applyPlRangeFilters = useCallback(() => {
        const cal = toInclusiveCalendarRange(draftDateFrom, draftDateTo);
        if (!cal.dateFrom || !cal.dateTo) {
            setPlRangeError(t('coa.err.rangeRequired'));
            return;
        }
        if (cal.dateFrom > cal.dateTo) {
            setPlRangeError(t('coa.err.range'));
            return;
        }
        setPlRangeError('');
        setDraftDateFrom(cal.dateFrom);
        setDraftDateTo(cal.dateTo);
        saveWorkshopAdminDatetimeRange(
            inclusiveCalendarRangeToDatetimeLocal(cal.dateFrom, cal.dateTo),
        );
        setAppliedDateFrom(cal.dateFrom);
        setAppliedDateTo(cal.dateTo);
        setAppliedBranch(draftBranch);
        setPlFilters({
            dateFrom: cal.dateFrom,
            dateTo: cal.dateTo,
            branchId: draftBranch,
        });
    }, [draftDateFrom, draftDateTo, draftBranch, t]);

    // Chart of Accounts list: current closing balances (no date range), branch from layout.
    useEffect(() => {
        if (isReportOnly) {
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const params = { _t: Date.now() };
                if (appliedBranch) params.branchId = appliedBranch;
                const treeParams = {
                    ...(appliedBranch ? { branchId: appliedBranch } : {}),
                    ...scopeParams,
                };
                Object.assign(params, scopeParams);
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
                const byId = new Map(normalizedFlat.map((acc) => [String(acc.id), acc]));
                const stampedTree = stampTreeBalances(tree, byId);
                setAccounts(normalizedFlat);
                setTreeAccounts(stampedTree);
                if (isSuperAdmin) {
                    try {
                        const [hb, settings] = await Promise.all([
                            getHeadingDirectBalances({ ...scopeParams }),
                            getAccountingSettings({ ...scopeParams }),
                        ]);
                        if (!cancelled) {
                            setHeadingBuckets(Array.isArray(hb?.buckets) ? hb.buckets : []);
                            setHeadingReclassOpen(
                                Boolean(
                                    hb?.effectiveOpen ??
                                        settings?.headingReclassEffectiveOpen,
                                ),
                            );
                            setReclassDefaultDate(
                                defaultHeadingReclassDate({
                                    startDate: settings?.startDate || null,
                                    lockedUpTo: settings?.lockedUpTo || null,
                                    todayYmd: toRiyadhDateISO(),
                                }),
                            );
                        }
                    } catch {
                        if (!cancelled) {
                            setHeadingBuckets([]);
                            setHeadingReclassOpen(false);
                        }
                    }
                } else if (!cancelled) {
                    setHeadingBuckets([]);
                    setHeadingReclassOpen(false);
                }
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
    }, [reloadTick, appliedBranch, isReportOnly, isSuperAdmin, scopeParams, t]);

    const accountById = useMemo(() => {
        const map = new Map();
        accounts.forEach((acc) => map.set(String(acc.id), acc));
        return map;
    }, [accounts]);

    useEffect(() => {
        const signature = treeAccounts.map((n) => n.id).join(',');
        if (!signature || signature === expandInitForTree) return;
        // Always start collapsed; user expands via the per-row chevron.
        setExpandedIds(new Set());
        setExpandInitForTree(signature);
    }, [treeAccounts, expandInitForTree]);

    const searchQ = appliedSearch.trim().toLowerCase();
    const filteredTree = useMemo(
        () =>
            filterTreeForSearch(
                filterTreeByTypeStatus(treeAccounts, {
                    type: appliedType,
                    status: appliedStatus,
                    byId: accountById,
                }),
                searchQ,
            ),
        [treeAccounts, appliedType, appliedStatus, searchQ, accountById],
    );

    /** Summary cards: only accounts that self-match Search/Type/Status (not path-only parents). */
    const filteredAccounts = useMemo(() => {
        const matched = collectSelfMatchingAccounts(treeAccounts, {
            search: appliedSearch,
            type: appliedType,
            status: appliedStatus,
            byId: accountById,
        });
        if (!headingReclassOnly) return matched;
        return matched.filter((acc) => headingDirectIds.has(String(acc.id)));
    }, [
        treeAccounts,
        appliedSearch,
        appliedType,
        appliedStatus,
        accountById,
        headingReclassOnly,
        headingDirectIds,
    ]);
    const coaCounts = useMemo(() => countLeafAndHeading(filteredAccounts), [filteredAccounts]);

    const visibleRows = useMemo(
        () =>
            buildHeadingReclassRows(
                filteredTree,
                headingDirectIds,
                flattenVisibleTree,
                {
                    expandedIds,
                    searchActive: Boolean(searchQ),
                    headingReclassOnly,
                    mergeRow: (row) =>
                        mergeCoaRow(row, accountById.get(String(row.id)) || {}),
                },
            ),
        [
            filteredTree,
            expandedIds,
            searchQ,
            accountById,
            headingReclassOnly,
            headingDirectIds,
        ],
    );
    const coaOffset = clampPageOffset(coaPageOffset, visibleRows.length, COA_PAGE_SIZE);
    const coaPage = useMemo(
        () => slicePage(visibleRows, coaOffset, COA_PAGE_SIZE),
        [visibleRows, coaOffset],
    );

    const applyCoaListFilters = useCallback(() => {
        setAppliedSearch(draftSearch.trim());
        setAppliedType(draftType);
        setAppliedStatus(draftStatus);
        setCoaPageOffset(0);
    }, [draftSearch, draftType, draftStatus]);

    const showAllCoaAccounts = useCallback(() => {
        setDraftSearch('');
        setDraftType('');
        setDraftStatus('');
        setAppliedSearch('');
        setAppliedType('');
        setAppliedStatus('');
        setCoaPageOffset(0);
    }, []);

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

    const openCreate = (defaultType) => {
        // Main "New account": no statement lock — form shows all 5 types.
        // Per-section "+" may still pass a preset type (selected, not locked).
        if (!defaultType) {
            navigate(buildWorkshopCoaAccountCreateUrl({ branchId: '' }));
            return;
        }
        const type = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].includes(defaultType)
            ? defaultType
            : 'ASSET';
        navigate(buildWorkshopCoaAccountCreateUrl({ type, branchId: '' }));
    };

    const openEdit = (acc) => {
        if (!acc?.id) return;
        navigate(buildWorkshopCoaAccountEditUrl(acc.id));
    };

    const signedCoaBalance = (acc) => {
        const type = String(acc?.type || '').toUpperCase();
        const dr = Number(acc?.closingDebit || 0);
        const cr = Number(acc?.closingCredit || 0);
        return type === 'LIABILITY' || type === 'EQUITY' || type === 'INCOME'
            ? cr - dr
            : dr - cr;
    };

    const openAdjust = async (acc) => {
        if (!acc?.id || acc.hasChildren || acc._hasChildren) return;
        setAdjustError('');
        const branchBalance = signedCoaBalance(acc);
        const isVault =
            String(acc?.code || '').trim() === '1004' ||
            String(acc?.code || '').startsWith('1004-') ||
            /locker vault cash/i.test(String(acc?.name || ''));
        let glBalance = branchBalance;
        if (isVault && appliedBranch) {
            try {
                const glRes = await listCoaAccounts('all', { ...scopeParams });
                const glList = Array.isArray(glRes?.accounts) ? glRes.accounts : [];
                const glAcc = glList.find((a) => String(a.id) === String(acc.id));
                if (glAcc) glBalance = signedCoaBalance(glAcc);
            } catch {
                /* keep branch figure */
            }
        }
        setAdjustTarget({
            ...acc,
            currentBalance: branchBalance,
            glBalance,
            isVault,
            hasBranchFilter: Boolean(appliedBranch),
        });
        try {
            const res = await listCoaAccounts('all', {
                ...(appliedBranch ? { branchId: appliedBranch } : {}),
                ...scopeParams,
            });
            const list = Array.isArray(res?.accounts) ? res.accounts : [];
            setAdjustAccounts(list);
        } catch {
            setAdjustAccounts([]);
        }
    };

    const openHeadingReclass = (acc) => {
        if (!acc?.id || !isSuperAdmin || !headingReclassOpen) return;
        if (!headingDirectIds.has(String(acc.id))) return;
        setReclassError('');
        setReclassSuccess(null);
        setReclassTarget({
            id: acc.id,
            code: acc.code,
            name: acc.name,
        });
    };

    const handleHeadingReclass = async ({
        targetLeafId,
        amount,
        branchId,
        entryDate,
        reason,
        clientRequestId,
    }) => {
        if (!reclassTarget?.id) return;
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            setReclassError(t('err.HEADING_RECLASS_BAD_AMOUNT'));
            return;
        }
        if (!targetLeafId) {
            setReclassError(t('err.HEADING_RECLASS_BAD_TARGET'));
            return;
        }
        if (String(reason || '').trim().length < 5) {
            setReclassError(t('coa.reclass.reason'));
            return;
        }
        setReclassSubmitting(true);
        setReclassError('');
        try {
            const res = await reclassHeadingAccount(reclassTarget.id, {
                targetLeafId,
                amount: amt,
                branchId: branchId == null || branchId === '' ? null : branchId,
                entryDate,
                reason: String(reason).trim(),
                clientRequestId,
                ...scopeParams,
            });
            setReclassSuccess({
                journalId: res?.journalId ? String(res.journalId) : '',
                entryNumber: res?.entryNumber || '',
            });
            setReloadTick((n) => n + 1);
        } catch (e) {
            setReclassError(mapReclassError(e, t));
        } finally {
            setReclassSubmitting(false);
        }
    };

    const handleAdjust = async ({ amount, entryDate, contraAccountId, reason }) => {
        if (!adjustTarget?.id) return;
        const delta = Number(amount);
        if (!Number.isFinite(delta) || delta === 0) {
            setAdjustError(t('coa.adjust.err.amount'));
            return;
        }
        if (!contraAccountId) {
            setAdjustError(t('coa.adjust.err.contra'));
            return;
        }
        if (!String(reason || '').trim()) {
            setAdjustError(t('coa.adjust.err.reason'));
            return;
        }
        setAdjustSubmitting(true);
        setAdjustError('');
        try {
            await adjustWorkshopCoaAccount(adjustTarget.id, {
                amount: delta,
                contraAccountId,
                entryDate,
                reason: String(reason).trim(),
                branchId: appliedBranch || undefined,
            });
            setAdjustTarget(null);
            setReloadTick((x) => x + 1);
        } catch (e) {
            setAdjustError(
                formatCashGuardMessage(e, workshopCoaCashGuardLang(locale)) ||
                    e?.message ||
                    t('coa.adjust.err.failed'),
            );
        } finally {
            setAdjustSubmitting(false);
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
        printReportHtml(title, html);
    };

    const loadTrialBalance = async (overrideFilters) => {
        const hasOverride =
            overrideFilters
            && typeof overrideFilters === 'object'
            && ('dateFrom' in overrideFilters || 'dateTo' in overrideFilters || 'branchId' in overrideFilters);
        const filters = hasOverride ? overrideFilters : tbFilters;
        const defaults = defaultTbBsReportDates();
        setTbLoading(true);
        setTbError('');
        try {
            // Own TB state only — never fall back to the P&L applied range.
            const dateFrom = String(filters.dateFrom || defaults.tb.dateFrom || '').slice(0, 10);
            const dateTo = String(filters.dateTo || defaults.tb.dateTo || '').slice(0, 10);
            const res = await getTrialBalance({
                ...filters,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                branchId: filters.branchId || undefined,
            });
            setTbData(res || { accounts: [], totalDebits: 0, totalCredits: 0, isBalanced: true });
        } catch (err) {
            setTbError(
                isReportRangeInvalidError(err)
                    ? t('pl.rangeInvalid')
                    : err?.message || t('tb.err.load'),
            );
            setTbData({ accounts: [], totalDebits: 0, totalCredits: 0, isBalanced: true });
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
            const cal = toInclusiveCalendarRange(filters.dateFrom, filters.dateTo);
            if (!cal.dateFrom || !cal.dateTo) {
                throw new Error(t('coa.err.rangeRequired'));
            }
            if (cal.dateFrom > cal.dateTo) {
                throw new Error(t('coa.err.range'));
            }
            saveWorkshopAdminDatetimeRange(
                inclusiveCalendarRangeToDatetimeLocal(cal.dateFrom, cal.dateTo),
            );
            const res = await getPLReport({
                dateFrom: cal.dateFrom,
                dateTo: cal.dateTo,
                branchId: filters.branchId || undefined,
            });
            if (gen !== plFetchGen.current) return;
            setPlData(res || null);
        } catch (err) {
            if (gen !== plFetchGen.current) return;
            setPlRangeError(
                isReportRangeInvalidError(err)
                    ? t('pl.rangeInvalid')
                    : err?.message || t('coa.err.generic'),
            );
            setPlData(null);
        } finally {
            if (gen === plFetchGen.current) setPlLoading(false);
        }
    };

    const loadBalanceSheet = async (overrideFilters) => {
        const hasOverride =
            overrideFilters
            && typeof overrideFilters === 'object'
            && ('asOf' in overrideFilters || 'branchId' in overrideFilters);
        const filters = hasOverride ? overrideFilters : bsFilters;
        const defaults = defaultTbBsReportDates();
        setBsLoading(true);
        setBsError('');
        try {
            // Own BS state only — never fall back to the P&L applied range.
            const asOf = String(filters.asOf || defaults.bs.asOf || '').slice(0, 10);
            const res = await getBalanceSheet({
                ...filters,
                asOf,
                branchId: filters.branchId || undefined,
            });
            setBsData(res || null);
        } catch (err) {
            setBsError(
                isReportRangeInvalidError(err)
                    ? t('pl.rangeInvalid')
                    : err?.message || t('bs.err.load'),
            );
            setBsData(null);
        } finally {
            setBsLoading(false);
        }
    };

    useEffect(() => {
        if (reportMode && REPORT_MODE_TAB[reportMode]) {
            setActiveTab(REPORT_MODE_TAB[reportMode]);
        }
    }, [reportMode]);

    useEffect(() => {
        if (activeTab === 'Trial Balance') {
            setTbPageOffset(0);
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

    const renderBranchPicker = (value, onChange) => (
        <SelectCombo
            size="sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={t('scope.allBranches')}
            style={{ minWidth: 200 }}
        >
                <option value="">{t('scope.allBranches')}</option>
                {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                        {b.name}
                    </option>
                ))}
        </SelectCombo>
    );

    const renderReportContent = () => {
        if (activeTab === 'Trial Balance') {
            const tbBadge = trialBalanceBadge(tbData);
            const allTbRows = tbData.accounts || [];
            const leafCount = countLeafAndHeading(allTbRows).leaf;
            const filteredTbRows = tbAccountId
                ? allTbRows.filter((a) => String(a.id) === String(tbAccountId))
                : allTbRows;
            const page = slicePage(filteredTbRows, tbPageOffset, REPORT_PAGE_SIZE);
            const hasPeriodCols = trialBalanceHasPeriodColumns(allTbRows);
            const tbColTotals = trialBalanceColumnTotals(tbData);
            const tbThStyle = {
                textAlign: 'start',
                borderBottom: `1px solid ${palette.border}`,
                padding: 8,
                fontSize: 12,
                color: palette.textSecondary,
            };
            const tbGroupThStyle = { ...tbThStyle, textAlign: 'center', borderBottom: 'none', paddingBottom: 2 };
            const fmtTbTotal = (v) => (v == null ? t('money.dash') : fmtMoney(v, t));
            const diffVal = Number(tbData.totalDebits || 0) - Number(tbData.totalCredits || 0);
            // Difference card uses API isBalanced/totals — show API difference if present.
            const apiDiff =
                tbData.difference != null && tbData.difference !== ''
                    ? Number(tbData.difference)
                    : diffVal;
            return (
                <div style={reportCard}>
                    <ReportLegacyBanner report={tbData} t={t} />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 220, flex: '1 1 220px' }}>
                            <CoaAccountSearchCombobox
                                accounts={allTbRows}
                                value={tbAccountId}
                                onChange={(id) => {
                                    setTbAccountId(id || '');
                                    setTbPageOffset(0);
                                }}
                                placeholder={t('coa.searchPh')}
                            />
                        </div>
                        <label className="coa-range-field">
                            <span>{t('coa.range.from')}</span>
                            <input
                                type="date"
                                value={String(tbFilters.dateFrom || '').slice(0, 10)}
                                onChange={(e) => setTbFilters((p) => ({ ...p, dateFrom: e.target.value.slice(0, 10) }))}
                                style={inputStyle}
                                aria-label={t('tb.riyadhLabel')}
                            />
                        </label>
                        <label className="coa-range-field">
                            <span>{t('coa.range.to')}</span>
                            <input
                                type="date"
                                value={String(tbFilters.dateTo || '').slice(0, 10)}
                                onChange={(e) => setTbFilters((p) => ({ ...p, dateTo: e.target.value.slice(0, 10) }))}
                                style={inputStyle}
                                aria-label={t('tb.riyadhLabel')}
                            />
                        </label>
                        {renderBranchPicker(tbFilters.branchId, (v) => setTbFilters((p) => ({ ...p, branchId: v })))}
                        <button
                            type="button"
                            onClick={() => {
                                setTbPageOffset(0);
                                loadTrialBalance();
                            }}
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
                        >
                            {t('date.apply')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const d = defaultTbBsReportDates();
                                const cleared = {
                                    dateFrom: d.tb.dateFrom,
                                    dateTo: d.tb.dateTo,
                                    branchId: plBranchFromLayout(selectedBranchId),
                                };
                                setTbFilters(cleared);
                                setTbAccountId('');
                                setTbPageOffset(0);
                                void loadTrialBalance(cleared);
                            }}
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
                        >
                            {t('periodClos.filter.showAll')}
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                printHtml(
                                    t('tb.printTitle'),
                                    `<h2>${escapeHtml(t('tb.printTitle'))}</h2><div>${escapeHtml(fmtDateLabel(tbFilters.dateFrom))} - ${escapeHtml(fmtDateLabel(tbFilters.dateTo))}</div>`,
                                )
                            }
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <Printer size={14} /> {t('btn.print')}
                        </button>
                    </div>
                    <ReportSummaryCards
                        items={[
                            {
                                key: 'leaf',
                                label: t('report.tb.card.leaf'),
                                value: String(leafCount),
                            },
                            {
                                key: 'debit',
                                label: t('report.tb.card.debit'),
                                value: fmtMoney(tbData.totalDebits, t),
                            },
                            {
                                key: 'credit',
                                label: t('report.tb.card.credit'),
                                value: fmtMoney(tbData.totalCredits, t),
                            },
                            {
                                key: 'diff',
                                label: t('report.tb.card.diff'),
                                tone: tbBadge.kind === 'balanced' ? 'ok' : 'bad',
                                value:
                                    tbBadge.kind === 'balanced'
                                        ? t('report.tb.diffOk')
                                        : fmtMoney(apiDiff, t),
                            },
                        ]}
                    />
                    <div style={{ fontSize: 12, color: palette.textSecondary, marginBottom: 8 }}>
                        {t('tb.riyadhLabel')}
                    </div>
                    {tbError ? (
                        <div role="alert" style={{ color: '#B91C1C', marginBottom: 10, fontSize: 13 }}>
                            {tbError}{' '}
                            <button type="button" onClick={loadTrialBalance} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                                {t('tb.retry')}
                            </button>
                        </div>
                    ) : null}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                {hasPeriodCols ? (
                                    <>
                                        <tr>
                                            <th rowSpan={2} style={tbThStyle}>{t('tb.th.code')}</th>
                                            <th rowSpan={2} style={tbThStyle}>{t('tb.th.name')}</th>
                                            <th colSpan={2} style={tbGroupThStyle}>{t('tb.th.opening')}</th>
                                            <th colSpan={2} style={tbGroupThStyle}>{t('tb.th.period')}</th>
                                            <th colSpan={2} style={tbGroupThStyle}>{t('tb.th.closing')}</th>
                                        </tr>
                                        <tr>
                                            {[
                                                t('tb.th.dr'),
                                                t('tb.th.cr'),
                                                t('tb.th.periodDebit'),
                                                t('tb.th.periodCredit'),
                                                t('tb.th.dr'),
                                                t('tb.th.cr'),
                                            ].map((h, i) => (
                                                <th key={`${h}-${i}`} style={{ ...tbThStyle, textAlign: 'end' }}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </>
                                ) : (
                                    <tr>
                                        {[
                                            t('tb.th.code'),
                                            t('tb.th.name'),
                                            t('tb.th.debit'),
                                            t('tb.th.credit'),
                                        ].map((h) => (
                                            <th key={h} style={tbThStyle}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {tbLoading ? (
                                    <tr>
                                        <td colSpan={hasPeriodCols ? 8 : 4} style={{ padding: 16, color: palette.textSecondary, textAlign: 'center' }}>
                                            {t('loading')}
                                        </td>
                                    </tr>
                                ) : page.total === 0 ? (
                                    <tr>
                                        <td colSpan={hasPeriodCols ? 8 : 4} style={{ padding: 16, color: palette.textSecondary, textAlign: 'center' }}>
                                            {t('tb.empty')}
                                            <div style={{ marginTop: 6, fontSize: 12 }}>{t('tb.emptyHint')}</div>
                                        </td>
                                    </tr>
                                ) : (
                                    page.rows.map((a) => {
                                        const legacy = isLegacyHeadingDirectRow(a);
                                        const heading = Boolean(a.isHeading);
                                        const canOpen = !heading && !legacy && a.id;
                                        return (
                                            <tr
                                                key={a.id || `${a.code}-${a.name}`}
                                                role={canOpen ? 'button' : undefined}
                                                tabIndex={canOpen ? 0 : undefined}
                                                onClick={canOpen ? () => openReportAccountLedger(a, a.type) : undefined}
                                                onKeyDown={canOpen ? (e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        openReportAccountLedger(a, a.type);
                                                    }
                                                } : undefined}
                                                style={{
                                                    background: heading ? '#f8fafc' : undefined,
                                                    color: heading ? '#64748b' : undefined,
                                                    fontStyle: legacy ? 'italic' : undefined,
                                                    cursor: canOpen ? 'pointer' : undefined,
                                                }}
                                            >
                                                <td style={{ padding: 8, paddingInlineStart: heading || legacy ? 20 : 8 }}>
                                                    {a.code}
                                                </td>
                                                <td style={{ padding: 8 }}>
                                                    <span style={{ fontWeight: heading ? 700 : 400, color: canOpen ? '#2563eb' : undefined }}>{a.name}</span>
                                                    {heading ? (
                                                        <span style={{ marginInlineStart: 8, fontSize: 11, color: '#94a3b8' }}>
                                                            {t('tb.headingLabel')}
                                                        </span>
                                                    ) : null}
                                                    {a.hasDirectPostings && heading ? (
                                                        <span
                                                            title={t('tb.directPostingsWarn')}
                                                            style={{ marginInlineStart: 6, color: '#d97706', verticalAlign: 'middle' }}
                                                        >
                                                            <AlertTriangle size={14} aria-label={t('tb.directPostingsWarn')} />
                                                        </span>
                                                    ) : null}
                                                    {legacy ? (
                                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{t('tb.legacyNote')}</div>
                                                    ) : null}
                                                </td>
                                                {hasPeriodCols ? (
                                                    <>
                                                        <td style={{ padding: 8, textAlign: 'end' }}>{fmtMoney(a.openingDebit, t)}</td>
                                                        <td style={{ padding: 8, textAlign: 'end' }}>{fmtMoney(a.openingCredit, t)}</td>
                                                        <td style={{ padding: 8, textAlign: 'end' }}>{fmtMoney(a.periodDebit, t)}</td>
                                                        <td style={{ padding: 8, textAlign: 'end' }}>{fmtMoney(a.periodCredit, t)}</td>
                                                        <td style={{ padding: 8, textAlign: 'end' }}>{fmtMoney(a.closingDebit, t)}</td>
                                                        <td style={{ padding: 8, textAlign: 'end' }}>{fmtMoney(a.closingCredit, t)}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td style={{ padding: 8, textAlign: 'end' }}>{fmtMoney(a.debitBalance, t)}</td>
                                                        <td style={{ padding: 8, textAlign: 'end' }}>{fmtMoney(a.creditBalance, t)}</td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                                {hasPeriodCols ? (
                                    <tr>
                                        <td colSpan={2} style={{ padding: 8, fontWeight: 700 }}>
                                            {t('tb.totals')}
                                        </td>
                                        {TB_PERIOD_TOTAL_FIELDS.map((k) => (
                                            <td key={k} style={{ padding: 8, fontWeight: 700, textAlign: 'end' }}>
                                                {fmtTbTotal(tbColTotals[k])}
                                            </td>
                                        ))}
                                    </tr>
                                ) : (
                                    <tr>
                                        <td colSpan={2} style={{ padding: 8, fontWeight: 700 }}>
                                            {t('tb.totals')}
                                        </td>
                                        <td style={{ padding: 8, fontWeight: 700, textAlign: 'end' }}>{fmtMoney(tbData.totalDebits, t)}</td>
                                        <td style={{ padding: 8, fontWeight: 700, textAlign: 'end' }}>{fmtMoney(tbData.totalCredits, t)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls
                        total={page.total}
                        limit={REPORT_PAGE_SIZE}
                        offset={tbPageOffset}
                        onPageChange={setTbPageOffset}
                        loading={tbLoading}
                    />
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
            const recon = plRevenueReconciliation(d);
            const salesReturnsAmount = recon.salesReturns;
            const discountsAmount = recon.discounts;
            const returnsVatAmount = recon.returnsVat;
            const outputVatAmount = Number(d.outputVat?.amount ?? 0);
            const grossSales = recon.grossSales;
            const netSales = recon.netRevenue;
            const revenueAfterReturns = recon.revenueAfterReturns;
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
                    <ReportLegacyBanner report={plData} t={t} />
                    <div className="acct-filter-bar">
                        <label className="coa-range-field">
                            <span>{t('coa.range.from')}</span>
                        <input
                                type="date"
                                value={String(draftDateFrom || '').slice(0, 10)}
                                onChange={(e) => setDraftDateFrom(e.target.value)}
                            style={{ ...inputStyle, minWidth: 190 }}
                            title="Asia/Riyadh"
                        />
                        </label>
                        <label className="coa-range-field">
                            <span>{t('coa.range.to')}</span>
                        <input
                                type="date"
                                value={String(draftDateTo || '').slice(0, 10)}
                                onChange={(e) => setDraftDateTo(e.target.value)}
                            style={{ ...inputStyle, minWidth: 190 }}
                            title="Asia/Riyadh"
                        />
                        </label>
                        {renderBranchPicker(draftBranch, setDraftBranch)}
                        <button
                            type="button"
                            className="btn-portal-dark"
                            onClick={applyPlRangeFilters}
                            disabled={plLoading}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {t('date.apply')}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => {
                                // Reset dates + portal-header branch; P&L effect loads once.
                                const r = defaultInclusiveCoaCalendarRange();
                                const branchId = plBranchFromLayout(selectedBranchId);
                                setDraftDateFrom(r.dateFrom);
                                setDraftDateTo(r.dateTo);
                                setDraftBranch(branchId);
                                setAppliedDateFrom(r.dateFrom);
                                setAppliedDateTo(r.dateTo);
                                setAppliedBranch(branchId);
                                setPlFilters({
                                    dateFrom: r.dateFrom,
                                    dateTo: r.dateTo,
                                    branchId,
                                });
                                setPlRangeError('');
                            }}
                            disabled={plLoading}
                            style={{ width: 'auto', cursor: 'pointer' }}
                        >
                            {t('periodClos.filter.showAll')}
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                printHtml(
                                    t('pl.printTitle'),
                                    `<h2>${escapeHtml(t('pl.printHeading'))}</h2><div>${escapeHtml(t('pl.period', { from: fmtRiyadhRangeLabel(appliedDateFrom), to: fmtRiyadhRangeLabel(appliedDateTo) }))}</div>`,
                                )
                            }
                            style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <Printer size={14} /> {t('btn.print')}
                        </button>
                    </div>
                    {(() => {
                        const incomeCard = Number(d.netRevenue ?? d.totalRevenue ?? 0);
                        const expenseCard = Number(
                            (Number(d.totalCOGS || 0) +
                                Number(d.totalOperatingExpenses || 0) +
                                Number(d.totalOtherExpenses || 0)).toFixed(2),
                        );
                        const cashCard = Number(d.cashOverShort?.net ?? 0);
                        const netCard = Number(d.netIncome || 0);
                        const margin = plMarginPercent(netCard, incomeCard);
                        return (
                            <ReportSummaryCards
                                items={[
                                    {
                                        key: 'income',
                                        label: t('report.pl.card.income'),
                                        value: fmtMoney(incomeCard, t),
                                    },
                                    {
                                        key: 'expenses',
                                        label: t('report.pl.card.expenses'),
                                        value: fmtMoney(expenseCard, t),
                                    },
                                    ...(d.cashOverShort
                                        ? [
                                              {
                                                  key: 'cashOverShort',
                                                  label: t('report.pl.row.cashCountDiff'),
                                                  value: fmtMoney(cashCard, t),
                                              },
                                          ]
                                        : []),
                                    {
                                        key: 'net',
                                        label: t('report.pl.card.net'),
                                        tone: netCard >= 0 ? 'ok' : 'bad',
                                        value: fmtMoney(netCard, t),
                                    },
                                    {
                                        key: 'margin',
                                        label: t('report.pl.card.margin'),
                                        value:
                                            margin == null
                                                ? t('report.emDash')
                                                : `${margin.toFixed(1)}%`,
                                    },
                                ]}
                            />
                        );
                    })()}
                    <div style={{ fontSize: 12, color: palette.textSecondary, marginBottom: 6 }}>
                        {t('pl.riyadhHint')}
                    </div>
                    <div style={{ fontSize: 12, color: '#2563eb', marginBottom: 10, fontWeight: 600 }}>
                        {t('pl.clickHint')}
                    </div>
                    {plRangeError ? (
                        <div role="alert" style={{ color: '#B91C1C', marginBottom: 10, fontSize: 13 }}>{plRangeError}</div>
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
                                <span>{t('pl.revenueAfterReturns')}</span>
                                <span>{fmtMoney(revenueAfterReturns, t)}</span>
                            </div>
                            <div style={{ ...sectionHeader, marginTop: 12 }}>{t('pl.reconHeading')}</div>
                            <div style={{ ...rowStyle, fontWeight: 600 }}>
                                <span>{t('pl.revenueAfterReturns')}</span>
                                <span>{fmtMoney(revenueAfterReturns, t)}</span>
                            </div>
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
                                <span style={{ color: '#2563eb', fontWeight: 600 }}>{t('pl.addBackSalesReturns')}</span>
                                <span style={{ color: '#2563eb', fontWeight: 600 }}>{fmtMoney(salesReturnsAmount, t)}</span>
                            </div>
                            <div style={{ ...rowStyle, fontWeight: 800, color: '#16a34a' }}>
                                <span>{t('pl.grossSales')}</span>
                                <span>{fmtMoney(grossSales, t)}</span>
                            </div>
                            <div style={{ ...rowStyle, fontWeight: 600, color: '#dc2626' }}>
                                <span>{t('pl.salesReturns')}</span>
                                <span>{fmtMoney(salesReturnsAmount, t)}</span>
                            </div>
                            <div style={{ ...rowStyle, fontWeight: 600, color: '#dc2626' }}>
                                <span>{t('pl.discounts')}</span>
                                <span>{fmtMoney(discountsAmount, t)}</span>
                            </div>
                            <div style={{ ...rowStyle, fontWeight: 800, color: '#16a34a' }}>
                                <span>{t('pl.netRevenue')}</span>
                                <span>{fmtMoney(netSales, t)}</span>
                            </div>
                            {returnsVatAmount ? (
                                <div style={{ ...rowStyle, fontWeight: 500, color: '#64748b', fontSize: 13 }}>
                                    <span>{t('pl.returnsVat')}</span>
                                    <span>{fmtMoney(returnsVatAmount, t)}</span>
                                </div>
                            ) : null}
                            {outputVatAmount ? (
                                <div style={{ ...rowStyle, fontWeight: 500, color: '#94a3b8', fontSize: 12 }}>
                                    <span>{t('pl.outputVat')}</span>
                                    <span>{fmtMoney(outputVatAmount, t)}</span>
                                </div>
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
                            {d.cashOverShort ? (
                                <div style={{ ...rowStyle, fontWeight: 700 }}>
                                    <span>{t('report.pl.row.cashCountDiff')}</span>
                                    <span>{fmtMoney(d.cashOverShort.net, t)}</span>
                                </div>
                            ) : null}
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
            isBalanced: true,
            difference: 0,
        };
        const bsBadge = balanceSheetBadge(b, {
            isBranchScoped: Boolean(bsFilters.branchId || appliedBranch),
        });
        const bsRow = {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: `1px solid ${palette.border}`,
        };
        const renderBsLine = (r, keyPrefix) => {
            const display = bsLineDisplayAmount(r);
            const heading = Boolean(r.isHeading);
            const synthetic =
                !r.id
                || String(r.id).includes('earnings')
                || isLegacyHeadingDirectRow(r);
            const canOpen = !heading && !synthetic;
            const asOf = String(bsFilters.asOf || defaultTbBsReportDates().bs.asOf || '').slice(0, 10);
            return (
                <div
                    key={`${keyPrefix}-${r.id || r.code}`}
                    role={canOpen ? 'button' : undefined}
                    tabIndex={canOpen ? 0 : undefined}
                    onClick={
                        canOpen
                            ? () =>
                                openReportAccountLedger(r, r.type, {
                                    dateFrom: asOf || undefined,
                                    dateTo: asOf || undefined,
                                    branchId: bsFilters.branchId || appliedBranch || '',
                                })
                            : undefined
                    }
                    onKeyDown={
                        canOpen
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openReportAccountLedger(r, r.type, {
                                        dateFrom: asOf || undefined,
                                        dateTo: asOf || undefined,
                                        branchId: bsFilters.branchId || appliedBranch || '',
                                    });
                                }
                            }
                            : undefined
                    }
                    style={{
                        ...bsRow,
                        color: heading ? '#64748b' : canOpen ? '#2563eb' : undefined,
                        fontWeight: heading ? 700 : 400,
                        cursor: canOpen ? 'pointer' : undefined,
                    }}
                >
                    <span>
                        {r.name}
                        {heading ? (
                            <span style={{ marginInlineStart: 8, fontSize: 11, color: '#94a3b8' }}>
                                {t('bs.heading')}
                            </span>
                        ) : null}
                    </span>
                    <span style={{ textAlign: 'end' }}>{fmtMoney(display, t)}</span>
                </div>
            );
        };
        return (
            <div style={reportCard}>
                <ReportLegacyBanner report={bsData} t={t} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label className="coa-range-field">
                        <span>{t('bs.riyadhLabel')}</span>
                        <input
                            type="date"
                            value={String(bsFilters.asOf || '').slice(0, 10)}
                            onChange={(e) => setBsFilters((p) => ({ ...p, asOf: e.target.value.slice(0, 10) }))}
                            style={inputStyle}
                            aria-label={t('bs.riyadhLabel')}
                        />
                    </label>
                    {renderBranchPicker(bsFilters.branchId, (v) => setBsFilters((p) => ({ ...p, branchId: v })))}
                    <button
                        type="button"
                        onClick={() => {
                            loadBalanceSheet();
                        }}
                        style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
                    >
                        {t('date.apply')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const d = defaultTbBsReportDates();
                            const cleared = {
                                asOf: d.bs.asOf,
                                branchId: plBranchFromLayout(selectedBranchId),
                            };
                            setBsFilters(cleared);
                            void loadBalanceSheet(cleared);
                        }}
                        style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
                    >
                        {t('periodClos.filter.showAll')}
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            printHtml(
                                t('bs.printTitle'),
                                `<h2>${escapeHtml(t('bs.printTitle'))}</h2><div>${escapeHtml(t('bs.asOf', { date: fmtDateLabel(bsFilters.asOf) }))}</div>`,
                            )
                        }
                        style={{ ...inputStyle, width: 'auto', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        <Printer size={14} /> {t('btn.print')}
                    </button>
                </div>
                {bsWarningMessages(b).map((w) => (
                    <p key={w.key} role="status" style={BS_WARNING_BANNER_STYLE}>
                        {t(w.key, w.vars)}
                    </p>
                ))}
                <ReportSummaryCards
                    items={[
                        {
                            key: 'assets',
                            label: t('report.bs.card.assets'),
                            value: fmtMoney(b.assets.totalAssets, t),
                        },
                        {
                            key: 'liab',
                            label: t('report.bs.card.liabilities'),
                            value: fmtMoney(b.liabilities.totalLiabilities, t),
                        },
                        {
                            key: 'equity',
                            label: t('report.bs.card.equity'),
                            value: fmtMoney(b.equity.totalEquity, t),
                        },
                        {
                            key: 'check',
                            label: t('report.bs.card.check'),
                            tone:
                                bsBadge.kind === 'balanced'
                                    ? 'ok'
                                    : bsBadge.kind === 'branchNote'
                                      ? 'muted'
                                      : 'bad',
                            value: (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                    {t(bsBadge.textKey, bsBadge.vars)}
                                    {bsBadge.vars?.n != null ? <RiyalIcon size={12} /> : null}
                                </span>
                            ),
                        },
                    ]}
                />
                {bsError ? (
                    <div role="alert" style={{ color: '#B91C1C', marginBottom: 10, fontSize: 13 }}>
                        {bsError}{' '}
                        <button type="button" onClick={loadBalanceSheet} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                            {t('bs.retry')}
                        </button>
                    </div>
                ) : null}
                {bsLoading ? (
                    <div style={{ color: palette.textSecondary }}>{t('loading')}</div>
                ) : !bsData ? (
                    <div style={{ color: palette.textSecondary }}>
                        {t('bs.emptyHint')}
                    </div>
                ) : (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                            gap: 16,
                        }}
                    >
                        <div>
                            <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700 }}>{t('bs.assets')}</div>
                            <div style={{ ...bsRow, fontWeight: 700 }}>
                                <span>{t('bs.currentAssets')}</span>
                                <span>{fmtMoney(sumOwnAmounts(b.assets.current), t)}</span>
                            </div>
                            {b.assets.current.map((r) => renderBsLine(r, 'ac'))}
                            <div style={{ ...bsRow, fontWeight: 700 }}>
                                <span>{t('bs.fixedAssets')}</span>
                                <span>{fmtMoney(sumOwnAmounts(b.assets.fixed), t)}</span>
                            </div>
                            {b.assets.fixed.map((r) => renderBsLine(r, 'af'))}
                            <div style={{ ...bsRow, fontWeight: 700 }}>
                                <span>{t('bs.otherAssets')}</span>
                                <span>{fmtMoney(sumOwnAmounts(b.assets.other), t)}</span>
                            </div>
                            {b.assets.other.map((r) => renderBsLine(r, 'ao'))}
                            <div style={{ ...bsRow, fontWeight: 800 }}>
                                <span>{t('bs.totalAssets')}</span>
                                <span>{fmtMoney(b.assets.totalAssets, t)}</span>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700 }}>{t('report.bs.liabEquity')}</div>
                            <div style={{ ...bsRow, fontWeight: 700 }}>
                                <span>{t('bs.currentLiab')}</span>
                                <span>{fmtMoney(sumOwnAmounts(b.liabilities.current), t)}</span>
                            </div>
                            {b.liabilities.current.map((r) => renderBsLine(r, 'lc'))}
                            <div style={{ ...bsRow, fontWeight: 700 }}>
                                <span>{t('bs.longTermLiab')}</span>
                                <span>{fmtMoney(sumOwnAmounts(b.liabilities.longTerm), t)}</span>
                            </div>
                            {b.liabilities.longTerm.map((r) => renderBsLine(r, 'll'))}
                            {(b.liabilities.other || []).length ? (
                                <>
                                    {(b.liabilities.other || []).map((r) => renderBsLine(r, 'lo'))}
                                </>
                            ) : null}
                            <div style={{ ...bsRow, fontWeight: 800 }}>
                                <span>{t('bs.totalLiab')}</span>
                                <span>{fmtMoney(b.liabilities.totalLiabilities, t)}</span>
                            </div>
                            <div style={{ fontSize: 11, letterSpacing: 1, color: '#6b7280', fontWeight: 700, marginTop: 12 }}>{t('bs.equity')}</div>
                            {b.equity.accounts.map((r) => renderBsLine(r, 'eq'))}
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
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const iconButtonStyle = {
        border: 'none',
        background: 'transparent',
        color: palette.edit,
        cursor: 'pointer',
        padding: 0,
        display: 'inline-flex',
    };
    const coaBadgeStyle = {
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: '0.7rem',
        fontWeight: 600,
    };

    /** Mockup 03: ONE table — Code · Account · Kind · Type · Balance · Actions. */
    const renderCoaTable = () => {
        const colCount = readOnly ? 5 : 6;
        const headers = [
            { key: 'code', label: t('coa.th.code') },
            { key: 'account', label: t('coa.th.account') },
            { key: 'kind', label: t('coa.th.kind') },
            { key: 'type', label: t('coa.th.type') },
            { key: 'balance', label: t('coa.th.balance'), end: true },
            ...(!readOnly ? [{ key: 'actions', label: t('coa.th.actions') }] : []),
        ];
        return (
            <div
                data-testid="coa-table"
                style={{ border: `1px solid ${palette.border}`, borderRadius: 8, overflow: 'hidden' }}
            >
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {headers.map((h) => (
                                    <th
                                        key={h.key}
                                        style={{
                                            textAlign: h.end ? 'end' : 'start',
                                            padding: '10px 12px',
                                            fontSize: 12,
                                            color: palette.textSecondary,
                                            borderBottom: `1px solid ${palette.border}`,
                                            background: palette.sectionHeaderBg,
                                        }}
                                    >
                                        {h.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {coaPage.total === 0 ? (
                                <tr>
                                    <td
                                        colSpan={colCount}
                                        style={{
                                            textAlign: 'center',
                                            color: palette.textSecondary,
                                            padding: '24px 12px',
                                        }}
                                    >
                                        {t('coa.empty.noMatch')}
                                    </td>
                                </tr>
                            ) : (
                                coaPage.rows.map((acc) => {
                                    const autoLinked = acc.isAutoSeed;
                                    const controlBadge = WORKSHOP_COA_CONTROL_BADGES[String(acc.code)];
                                    const vaultWorkshopBadge =
                                        Boolean(appliedBranch) &&
                                        (String(acc.code || '').trim() === '1004' ||
                                            String(acc.code || '').startsWith('1004-'));
                                    const depth = Number(acc._depth || 0);
                                    const hasChildren = Boolean(acc._hasChildren);
                                    const heading = isCoaHeadingRow(acc);
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
                                                background: heading ? '#fafafa' : '#fff',
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
                                                {vaultWorkshopBadge ? (
                                                    <span
                                                        title={
                                                            t('coa.vault.workshopLevel') ||
                                                            'Workshop-level vault — see All branches for the postable balance'
                                                        }
                                                        style={{
                                                            display: 'block',
                                                            marginTop: 4,
                                                            fontSize: 10,
                                                            color: '#92400E',
                                                            fontFamily: 'inherit',
                                                            whiteSpace: 'normal',
                                                            lineHeight: 1.2,
                                                        }}
                                                    >
                                                        {t('coa.vault.workshopLevelShort') ||
                                                            'Workshop vault'}
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <div
                                                    style={{
                                                        fontWeight: heading ? 700 : 600,
                                                        color: palette.textPrimary,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        paddingInlineStart: depth * 16,
                                                    }}
                                                >
                                                    {hasChildren ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => toggleExpanded(acc.id, e)}
                                                            title={isExpanded ? t('coa.row.collapse') : t('coa.row.expand')}
                                                            aria-label={isExpanded ? t('coa.row.collapse') : t('coa.row.expand')}
                                                            aria-expanded={isExpanded}
                                                            style={{ ...iconButtonStyle, color: palette.textSecondary }}
                                                        >
                                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        </button>
                                                    ) : (
                                                        <span style={{ width: 16, display: 'inline-block' }} />
                                                    )}
                                                    <span>{acc.name}</span>
                                                    {autoLinked ? (
                                                        <span
                                                            style={{
                                                                ...coaBadgeStyle,
                                                                background: palette.autoBadgeBg,
                                                                color: palette.autoBadgeText,
                                                            }}
                                                        >
                                                            {t('coa.autoLinked')}
                                                        </span>
                                                    ) : null}
                                                    {controlBadge ? (
                                                        <span
                                                            style={{
                                                                ...coaBadgeStyle,
                                                                background: controlBadge.background,
                                                                color: controlBadge.color,
                                                            }}
                                                        >
                                                            {t('coa.badge.control')}
                                                        </span>
                                                    ) : null}
                                                    {inactive ? (
                                                        <span
                                                            style={{
                                                                ...coaBadgeStyle,
                                                                background: '#FEE2E2',
                                                                color: '#991B1B',
                                                            }}
                                                        >
                                                            {t('coa.status.inactive')}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span
                                                    data-kind={heading ? 'heading' : 'leaf'}
                                                    style={{
                                                        ...coaBadgeStyle,
                                                        background: heading ? '#EEF2FF' : '#F1F5F9',
                                                        color: heading ? '#3730A3' : '#475569',
                                                    }}
                                                >
                                                    {heading ? t('coa.kind.heading') : t('coa.kind.leaf')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px', fontSize: 13, color: palette.textPrimary }}>
                                                {acc.type ? t(`coa.type.${acc.type}`) : t('money.dash')}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    fontWeight: 600,
                                                    color: bal.color,
                                                    fontVariantNumeric: 'tabular-nums',
                                                    whiteSpace: 'nowrap',
                                                    textAlign: 'end',
                                                }}
                                            >
                                                <div className="coa-vat-balance">
                                                    <span>{bal.text}</span>
                                                    <CoaVatBasisBadge account={acc} t={t} />
                                                </div>
                                            </td>
                                            {!readOnly ? (
                                                <td
                                                    style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}
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
                                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEdit(acc)}
                                                                style={iconButtonStyle}
                                                                title={t('coa.editTitle')}
                                                                aria-label={t('coa.editTitle')}
                                                            >
                                                                <Pencil size={16} />
                                                            </button>
                                                            {!heading ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openAdjust(acc)}
                                                                    style={iconButtonStyle}
                                                                    title={t('coa.adjust.title')}
                                                                    aria-label={t('coa.adjust.title')}
                                                                >
                                                                    <SlidersHorizontal size={16} />
                                                                </button>
                                                            ) : null}
                                                            {heading &&
                                                            isSuperAdmin &&
                                                            headingReclassOpen &&
                                                            headingDirectIds.has(String(acc.id)) ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openHeadingReclass(acc)}
                                                                    style={iconButtonStyle}
                                                                    title={t('coa.reclass.action')}
                                                                    aria-label={t('coa.reclass.action')}
                                                                >
                                                                    {t('coa.reclass.action')}
                                                                </button>
                                                            ) : null}
                                                            {!autoLinked ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPendingDeleteId(acc.id);
                                                                        setDeleteError('');
                                                                    }}
                                                                    style={{ ...iconButtonStyle, color: palette.delete }}
                                                                    title={t('coa.deleteTitle')}
                                                                    aria-label={t('coa.deleteTitle')}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            ) : null}
                                                            {ledgerClickable ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openAccountLedger(acc)}
                                                                    style={iconButtonStyle}
                                                                    title={t('coa.openLedger')}
                                                                    aria-label={t('coa.openLedger')}
                                                                >
                                                                    <BookOpen size={16} />
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
                <PaginationControls
                    total={coaPage.total}
                    limit={COA_PAGE_SIZE}
                    offset={coaOffset}
                    onPageChange={setCoaPageOffset}
                />
            </div>
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
                {!isReportOnly ? (
                    <p
                        data-testid="coa-breadcrumb"
                        style={{ margin: '0 0 6px', color: palette.textSecondary, fontSize: '0.8125rem' }}
                    >
                        {t('coa.title')} / {t('coa.pageTitle')}
                    </p>
                ) : null}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginBottom: 4,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <BookOpen size={24} color={palette.textPrimary} />
                        <h1
                            style={{
                                margin: 0,
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: palette.textPrimary,
                            }}
                        >
                            {isReportOnly && activeTab === 'P&L'
                                ? t('report.pl.title')
                                : isReportOnly && activeTab === 'Balance Sheet'
                                  ? t('report.bs.title')
                                  : isReportOnly && activeTab === 'Trial Balance'
                                    ? t('report.tb.title')
                                    : t('coa.pageTitle')}
                        </h1>
                    </div>
                    {!isReportOnly && !readOnly ? (
                        <button
                            type="button"
                            className="btn-portal-dark"
                            onClick={() => openCreate()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                        >
                            <Plus size={16} />
                            {t('coa.newAccount')}
                        </button>
                    ) : null}
                </div>
                {!isReportOnly && sysConflicts.length > 0 ? (
                    <div
                        role="status"
                        data-testid="coa-sys-conflict-banner"
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 12,
                            margin: '0 0 12px',
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1px solid #F59E0B',
                            background: '#FFFBEB',
                            color: '#92400E',
                        }}
                    >
                        <strong>{t('sysAcct.banner', { n: String(sysConflicts.length) })}</strong>
                        <span style={{ flex: '1 1 240px', fontSize: '0.85rem' }}>{t('sysAcct.banner.hint')}</span>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={() => setSysConflictOpen(sysConflicts[0])}
                        >
                            {t('sysAcct.banner.resolve')}
                        </button>
                    </div>
                ) : null}
                <SystemAccountConflictDialog
                    open={Boolean(sysConflictOpen)}
                    conflict={sysConflictOpen}
                    locale={locale}
                    canWriteCoa={canResolveSystemAccountConflict({ hasPermission: hasPermCoa, user })}
                    onClose={() => setSysConflictOpen(null)}
                    onResolved={() => {
                        setSysConflictOpen(null);
                        void loadSysConflicts();
                    }}
                />
                {isReportOnly ? (
                    <p style={{ margin: 0, color: palette.textSecondary, fontSize: '0.875rem' }}>
                        {activeTab === 'P&L' ? (
                            <span>
                                {t('report.breadcrumb')} / {t('report.pl.title')}
                            </span>
                        ) : (
                            t('coa.subtitle')
                        )}
                    </p>
                ) : null}
            </div>

            {!isReportOnly ? (
                <div
                    style={{
                        padding: '12px 24px 0',
                        marginTop: 8,
                        background: palette.cardBg,
                        fontSize: 13,
                        color: palette.textSecondary,
                    }}
                >
                    {t('coa.reportsLine')}{' '}
                    <Link to="/workshop/accounting/profit-loss" style={{ color: '#2563eb' }}>
                        {t('report.pl.title')}
                    </Link>
                    {' · '}
                    <Link to="/workshop/accounting/balance-sheet" style={{ color: '#2563eb' }}>
                        {t('report.bs.title')}
                    </Link>
                    {' · '}
                    <Link to="/workshop/accounting/trial-balance" style={{ color: '#2563eb' }}>
                        {t('report.tb.title')}
                    </Link>
                </div>
            ) : null}

            {activeTab === 'Chart of Accounts' ? (
                <div style={{ padding: 24, background: palette.cardBg }}>
                    <div
                        data-testid="coa-filter-bar"
                        className="acct-filter-bar"
                    >
                        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                            <Search
                                size={16}
                                color={palette.textSecondary}
                                style={{ position: 'absolute', top: '50%', insetInlineStart: 12, transform: 'translateY(-50%)' }}
                            />
                            <input
                                value={draftSearch}
                                onChange={(e) => setDraftSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') applyCoaListFilters();
                                }}
                                placeholder={t('coa.search.codeName')}
                                aria-label={t('coa.search.codeName')}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    border: `1px solid ${palette.border}`,
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    paddingInlineStart: 36,
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <SelectCombo
                            size="sm"
                            value={draftType}
                            onChange={(e) => setDraftType(e.target.value)}
                            aria-label={t('coa.filter.type')}
                            style={{ minWidth: 140 }}
                        >
                            <option value="">{t('coa.filter.allTypes')}</option>
                            {typeGroups.map((g) => (
                                <option key={g.key} value={g.key}>
                                    {t(`coa.type.${g.key}`)}
                                </option>
                            ))}
                        </SelectCombo>
                        <SelectCombo
                            size="sm"
                            value={draftStatus}
                            onChange={(e) => setDraftStatus(e.target.value)}
                            aria-label={t('coa.filter.status')}
                            style={{ minWidth: 120 }}
                        >
                            <option value="active">{t('coa.filter.active')}</option>
                            <option value="inactive">{t('coa.filter.inactive')}</option>
                            <option value="">{t('coa.filter.all')}</option>
                        </SelectCombo>
                        <button
                            type="button"
                            className="btn-portal-dark"
                            onClick={applyCoaListFilters}
                            disabled={loading}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {t('date.apply')}
                        </button>
                        <button
                            type="button"
                            className="btn-portal-outline"
                            onClick={showAllCoaAccounts}
                            disabled={loading}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {t('periodClos.filter.showAll')}
                        </button>
                    </div>

                    <ReportSummaryCards
                        items={[
                            {
                                key: 'all',
                                label: t('coa.card.accounts'),
                                value: String(coaCounts.total),
                            },
                            {
                                key: 'leaf',
                                label: t('coa.card.leaf'),
                                value: String(coaCounts.leaf),
                            },
                            {
                                key: 'head',
                                label: t('coa.card.headings'),
                                value: String(coaCounts.heading),
                            },
                        ]}
                    />

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
                        renderCoaTable()
                    )}

                    {deleteError && <div style={{ color: palette.delete, marginTop: 10, fontSize: 13 }}>{deleteError}</div>}
                </div>
            ) : (
                <div style={{ padding: 24, background: palette.cardBg }}>{renderReportContent()}</div>
            )}

            {reclassTarget ? (
                <WorkshopCoaHeadingReclassModal
                    heading={reclassTarget}
                    buckets={headingBuckets}
                    defaultEntryDate={reclassDefaultDate}
                    t={t}
                    submitting={reclassSubmitting}
                    error={reclassError}
                    success={reclassSuccess}
                    onClose={() => {
                        if (reclassSubmitting) return;
                        setReclassTarget(null);
                        setReclassError('');
                        setReclassSuccess(null);
                    }}
                    onSubmit={handleHeadingReclass}
                />
            ) : null}
            {adjustTarget ? (
                <WorkshopCoaAdjustModal
                    title={`${t('coa.adjust.title')} — ${adjustTarget.code} ${adjustTarget.name}`}
                    currentBalance={adjustTarget.currentBalance}
                    glBalance={adjustTarget.glBalance}
                    isVault={adjustTarget.isVault}
                    hasBranchFilter={adjustTarget.hasBranchFilter}
                    accounts={adjustAccounts}
                    excludeAccountId={adjustTarget.id}
                    t={t}
                    submitting={adjustSubmitting}
                    error={adjustError}
                    onClose={() => {
                        if (adjustSubmitting) return;
                        setAdjustTarget(null);
                        setAdjustError('');
                    }}
                    onSubmit={handleAdjust}
                />
            ) : null}

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
