import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
    AlertTriangle,
    Banknote,
    Clock,
    FileDown,
    Plus,
    RefreshCw,
    Users,
    Wallet,
} from 'lucide-react';
import {
    bulkCreateWorkshopAdvances,
    createWorkshopAdvance,
    getAdvancePaymentSheet,
    getWorkshopAdvancesList,
    getWorkshopAdvancesOverview,
    getWorkshopAdvancesRegister,
    getWorkshopAdvancesStats,
} from '../../../services/advancesApi';
import RiyalIcon from '../../../components/RiyalIcon';
import PayrollSheetDownloadDialog, {
    isAdvanceSheetReady,
} from './PayrollSheetDownloadDialog';
import {
    exportAdvancePaymentExcel,
    exportAdvancePaymentPdf,
} from './payrollSheetExport';
import { payrollErrorI18nKey } from '../../../utils/payrollRunDisplay';
import { listCashBankAccounts } from '../../../services/workshopAccountingApi';
import {
    getAllWorkshopEmployees,
    indexWorkshopStaffBySelectValue,
    parseWorkshopStaffSelectValue,
    unwrapWorkshopEmployeesList,
    workshopStaffSelectValue,
} from '../../../services/workshopStaffApi';
import {
    approveExpenseRequest,
    listWorkshopExpenseRequests,
    rejectExpenseRequest,
} from '../../../services/employeeExpenseApi';
import PettyCashPayFromDialog from '../../../components/workshop/PettyCashPayFromDialog';
import { accT } from '../../../utils/accountingI18n';
import {
    PAYROLL_ADVANCES_PAGE_SIZE,
    currentMonthYmd,
    filterOverviewRows,
    formatLastAdvanceLabel,
    formatSarLatn,
    isWalletTooLow,
    mapLegacyAdvancesTab,
    mapOverviewRows,
    mapPayrollSummaryCards,
    mapPosExpenseToRegister,
    mapRegisterItems,
    slicePage,
    sourceBadgeKey,
} from '../../../utils/payrollAdvancesDisplay';
import { PaginationControls } from '../../../components/PaginationControls';
import WsTableScroll from '../../../components/workshop/WsTableScroll';
import { useAuth } from '../../../context/AuthContext';
import WorkshopSalaryTab from './WorkshopSalaryTab';
import WorkshopEmployeeLedgerTab from './WorkshopEmployeeLedgerTab';
import WorkshopPayrollRunPage from './WorkshopPayrollRunPage';
import WorkshopPayslipPage from './WorkshopPayslipPage';
import { AdvanceBulkPage, AdvancePayPage } from './WorkshopAdvancePayPages';
import { parsePayrollPath, currentPeriodYmd } from '../../../utils/payrollRunDisplay';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import '../../../styles/admin/AccountingPage.css';
import './WorkshopAdvancePayPages.css';

const PAGE_TABS = [
    { id: 'overview', labelKey: 'adv.tab.overview' },
    { id: 'register', labelKey: 'adv.tab.register' },
    { id: 'payroll', labelKey: 'adv.tab.payroll' },
    { id: 'statement', labelKey: 'adv.tab.statement' },
];

const ADV_VIEWS = new Set(['pay', 'bulk', 'new']);

const CARD_META = {
    outstanding: { labelKey: 'adv.stat.outstanding', Icon: Wallet, tone: 'red' },
    givenMonth: { labelKey: 'adv.stat.givenMonth', Icon: Banknote, tone: 'blue' },
    recoveredMonth: { labelKey: 'adv.stat.recoveredMonth', Icon: RiyalIcon, tone: 'green' },
    salariesPayable: { labelKey: 'adv.stat.salariesPayable', Icon: Banknote, tone: 'amber' },
    commissionPayable: { labelKey: 'adv.stat.commissionPayable', Icon: RiyalIcon, tone: 'amber' },
    paidMonth: { labelKey: 'adv.stat.paidMonth', Icon: RiyalIcon, tone: 'blue' },
    empWithAdvance: { labelKey: 'adv.stat.empWithAdvance', Icon: Users, tone: 'orange' },
};

const emptyAdvanceForm = () => ({
    employeeSelectKey: '',
    employeeRecordId: '',
    recordType: '',
    userId: '',
    employeeName: '',
    amount: '',
    date: toRiyadhDateISO(),
    payFromAccountId: '',
    reason: '',
});

const makeAdvanceRow = () => ({
    id: Date.now() + Math.random(),
    employeeSelectKey: '',
    employeeRecordId: '',
    recordType: '',
    userId: '',
    employeeName: '',
    amount: '',
    date: toRiyadhDateISO(),
    payFromAccountId: '',
    reason: '',
});

const fieldWrap = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 };
const labelStyle = { fontSize: '0.75rem', fontWeight: 600, color: '#64748B' };
const inputStyle = {
    borderRadius: 8,
    border: '1px solid #CBD5E1',
    padding: '0 10px',
    fontSize: '0.875rem',
    background: '#fff',
};

function moneyOrDash(v, t) {
    if (v == null || v === '') return t('adv.emdash');
    return t('adv.money.sar', { n: formatSarLatn(v) });
}

function StatusChip({ status, t }) {
    const s = String(status || '').toLowerCase();
    let bg = '#F1F5F9';
    let color = '#475569';
    if (s === 'approved' || s === 'partial' || s === 'settled' || s === 'repaid') {
        bg = '#DCFCE7';
        color = '#166534';
    } else if (s === 'pending') {
        bg = '#FEF3C7';
        color = '#92400E';
    } else if (s === 'rejected' || s === 'void') {
        bg = '#FEE2E2';
        color = '#991B1B';
    }
    const label =
        s === 'settled' || s === 'repaid'
            ? t('adv.filter.repaid')
            : s === 'pending'
              ? t('adv.filter.pending')
              : s === 'approved' || s === 'partial'
                ? t('adv.filter.approved')
                : s === 'rejected'
                  ? t('adv.filter.rejected')
                  : status || t('adv.emdash');
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 6,
                fontSize: '0.72rem',
                fontWeight: 700,
                background: bg,
                color,
            }}
        >
            {label}
        </span>
    );
}

export default function WorkshopAdvances({
    branches = [],
    selectedBranchId = 'all',
    locale: localeProp,
    initialTab: initialTabProp,
}) {
    const outletCtx = useOutletContext() || {};
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { hasPermission } = useAuth();
    const payrollPath = useMemo(() => parsePayrollPath(location.pathname), [location.pathname]);
    const canCreate = hasPermission('workshop.accounting.advances.create');
    const canApprove =
        hasPermission('workshop.accounting.advances.approve') ||
        hasPermission('workshop.accounting.expenses.approve') ||
        hasPermission('workshop.approvals.view');

    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const isRtl = String(locale).toLowerCase().startsWith('ar');

    const activeTab = mapLegacyAdvancesTab(
        initialTabProp || searchParams.get('tab') || 'overview',
    );

    const viewParam = String(searchParams.get('view') || '');
    const view = ADV_VIEWS.has(viewParam) ? (viewParam === 'new' ? 'pay' : viewParam) : 'list';

    const [draft, setDraft] = useState(() => ({
        employeeQ: searchParams.get('q') || '',
        month: searchParams.get('month') || currentMonthYmd(),
        branchId:
            searchParams.get('branchId') ||
            (selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : 'all'),
        source: searchParams.get('source') || 'all',
        status: searchParams.get('status') || 'all',
        cashier: searchParams.get('cashier') || 'all',
        staffActive: searchParams.get('staffActive') || 'active',
    }));
    const [applied, setApplied] = useState(draft);
    const [page, setPage] = useState(Math.max(1, Number(searchParams.get('page')) || 1));

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({});
    const [overview, setOverview] = useState({ employees: [], branches: [] });
    const [registerPayload, setRegisterPayload] = useState(null);
    const [registerFallback, setRegisterFallback] = useState([]);
    const [registerApiMissing, setRegisterApiMissing] = useState(false);
    const [posPending, setPosPending] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [cashBankAccounts, setCashBankAccounts] = useState([]);
    const [advanceForm, setAdvanceForm] = useState(emptyAdvanceForm);
    const [bulkAdvanceRows, setBulkAdvanceRows] = useState([makeAdvanceRow()]);
    const [submitting, setSubmitting] = useState(false);
    const [inlineAction, setInlineAction] = useState(null); // { type, id, reason }
    const [advSheetOpen, setAdvSheetOpen] = useState(false);
    const [advSheetBusy, setAdvSheetBusy] = useState(false);
    const [advSheetError, setAdvSheetError] = useState('');
    const [advSheetPreset, setAdvSheetPreset] = useState({ batchId: '', advanceId: '' });

    const downloadAdvanceSheet = async ({ branchId, month, from, to, format, language }) => {
        setAdvSheetBusy(true);
        setAdvSheetError('');
        try {
            const sheet = await getAdvancePaymentSheet({
                ...(branchId ? { branchId } : {}),
                ...(month ? { month } : {}),
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
                ...(advSheetPreset.batchId ? { batchId: advSheetPreset.batchId } : {}),
                ...(advSheetPreset.advanceId ? { advanceId: advSheetPreset.advanceId } : {}),
                format: format === 'xlsx' ? 'xlsx' : 'pdf',
                language: language || 'en+ar',
            });
            if (format === 'xlsx') exportAdvancePaymentExcel(sheet);
            else await exportAdvancePaymentPdf(sheet);
            setAdvSheetOpen(false);
        } catch (e) {
            const mapped = payrollErrorI18nKey(e);
            setAdvSheetError(mapped ? t(mapped) : t('pr.sheet.err.advTotals'));
        } finally {
            setAdvSheetBusy(false);
        }
    };

    const setTab = useCallback(
        (next) => {
            setSearchParams(
                (prev) => {
                    const p = new URLSearchParams(prev);
                    p.set('tab', next);
                    p.delete('view');
                    if (next !== 'statement') p.delete('employee');
                    return p;
                },
                { replace: false },
            );
            setPage(1);
        },
        [setSearchParams],
    );

    const openView = useCallback(
        (next) => {
            setError('');
            setSearchParams(
                (prev) => {
                    const p = new URLSearchParams(prev);
                    if (next === 'list') p.delete('view');
                    else p.set('view', next === 'pay' ? 'new' : next);
                    return p;
                },
                { replace: false },
            );
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [setSearchParams],
    );

    useEffect(() => {
        if (selectedBranchId && selectedBranchId !== 'all') {
            const b = String(selectedBranchId);
            setDraft((d) => (d.branchId === b ? d : { ...d, branchId: b }));
            setApplied((d) => (d.branchId === b ? d : { ...d, branchId: b }));
        }
    }, [selectedBranchId]);

    const branchParams = useMemo(() => {
        if (applied.branchId && applied.branchId !== 'all') {
            return { branchId: applied.branchId };
        }
        return {};
    }, [applied.branchId]);

    const payableEmployees = useMemo(
        () => employees.filter((e) => e.userId || e.canReceiveAdvance),
        [employees],
    );

    const employeeByRecordId = useMemo(
        () => indexWorkshopStaffBySelectValue(employees),
        [employees],
    );

    const refresh = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const month = applied.month || currentMonthYmd();
            const [y, m] = String(month).split('-');
            const from = y && m ? `${y}-${m}-01` : undefined;
            const to =
                y && m
                    ? `${y}-${m}-${String(new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate()).padStart(2, '0')}`
                    : undefined;

            const sourceApi =
                applied.source === 'pos'
                    ? 'petty_cash_salary_advance'
                    : applied.source === 'admin'
                      ? 'admin'
                      : applied.source === 'staff'
                        ? 'staff_app'
                        : applied.source === 'transactions'
                          ? undefined
                          : applied.source !== 'all'
                            ? applied.source
                            : undefined;

            const [s, ov, emps, cb, regResult, listFallback, expRes] = await Promise.all([
                getWorkshopAdvancesStats(branchParams).catch((e) => {
                    throw e;
                }),
                getWorkshopAdvancesOverview(branchParams).catch(() => ({ employees: [], branches: [] })),
                getAllWorkshopEmployees(branchParams).catch(() => ({ employees: [] })),
                listCashBankAccounts(branchParams).catch(() => ({ accounts: [] })),
                getWorkshopAdvancesRegister({
                    ...branchParams,
                    page: String(page),
                    ...(sourceApi ? { source: sourceApi } : {}),
                    ...(applied.status && applied.status !== 'all' && applied.status !== 'pending_approved'
                        ? { status: applied.status }
                        : {}),
                    ...(from ? { from } : {}),
                    ...(to ? { to } : {}),
                }).then(
                    (res) => ({ ok: true, res }),
                    (err) => {
                        const status = err?.status || err?.response?.status;
                        if (status === 404 || status === 403) return { ok: false, missing: true, err };
                        return { ok: false, missing: false, err };
                    },
                ),
                getWorkshopAdvancesList(branchParams).catch(() => []),
                applied.source === 'pos' || activeTab === 'register'
                    ? listWorkshopExpenseRequests({
                          ...branchParams,
                          status: 'pending',
                      }).catch(() => ({ list: [] }))
                    : Promise.resolve({ list: [] }),
            ]);

            setStats(s || {});
            setOverview(ov || { employees: [], branches: [] });
            const empItems = unwrapWorkshopEmployeesList(emps).filter((e) => !e.transferPlaceholder);
            const ovByKey = Object.fromEntries(
                (ov?.employees ?? []).map((e) => [
                    String(e.staffKey || `${e.recordType || 'employee'}:${e.employeeId}`),
                    e,
                ]),
            );
            setEmployees(
                empItems.map((e) => {
                    const ovRow = ovByKey[workshopStaffSelectValue(e)];
                    return {
                        ...e,
                        userId: e.userId ?? ovRow?.userId ?? null,
                        canReceiveAdvance: ovRow?.canReceiveAdvance ?? Boolean(e.userId),
                    };
                }),
            );
            setCashBankAccounts(cb?.accounts ?? cb?.items ?? []);

            if (regResult.ok) {
                setRegisterPayload(regResult.res);
                setRegisterApiMissing(false);
            } else {
                setRegisterPayload(null);
                setRegisterApiMissing(Boolean(regResult.missing));
                if (!regResult.missing && regResult.err) {
                    setError(regResult.err?.message || t('adv.err.load'));
                }
            }
            setRegisterFallback(Array.isArray(listFallback) ? listFallback : []);

            const expList = Array.isArray(expRes?.list)
                ? expRes.list
                : Array.isArray(expRes?.items)
                  ? expRes.items
                  : Array.isArray(expRes)
                    ? expRes
                    : [];
            setPosPending(mapPosExpenseToRegister(expList));
        } catch (e) {
            setError(e?.message || t('adv.err.load'));
        } finally {
            setLoading(false);
        }
    }, [activeTab, applied, branchParams, page, t]);

    useEffect(() => {
        if (view !== 'list') return undefined;
        refresh();
        return undefined;
    }, [refresh, view]);

    const overviewRowsAll = useMemo(() => mapOverviewRows(overview), [overview]);

    const overviewFiltered = useMemo(
        () =>
            filterOverviewRows(overviewRowsAll, {
                employeeQ: applied.employeeQ,
                branchId: applied.branchId,
                source: applied.source,
                status: applied.status,
                staffActive: applied.staffActive,
            }),
        [overviewRowsAll, applied],
    );

    const overviewPage = useMemo(
        () => slicePage(overviewFiltered, page, PAYROLL_ADVANCES_PAGE_SIZE),
        [overviewFiltered, page],
    );

    const summaryCards = useMemo(() => {
        const withCount = {
            ...stats,
            employeesWithAdvance:
                stats.employeesWithAdvance ??
                overviewRowsAll.filter((r) => Number(r.outstanding) > 0.0001).length,
        };
        return mapPayrollSummaryCards(withCount);
    }, [stats, overviewRowsAll]);

    const outstandingSum = useMemo(() => {
        if (stats.outstandingBalance != null) return stats.outstandingBalance;
        return null;
    }, [stats]);

    const payableSum = useMemo(() => {
        if (stats.salariesPayable != null) return stats.salariesPayable;
        const hasAny = overviewFiltered.some((r) => r.salaryPayable != null);
        if (!hasAny) return null;
        return null; // do not sum client-side money
    }, [stats, overviewFiltered]);
    const commissionSum = useMemo(() => {
        if (stats.commissionPayable != null) return stats.commissionPayable;
        return null;
    }, [stats]);

    const registerRows = useMemo(() => {
        let rows = registerPayload
            ? mapRegisterItems(registerPayload)
            : mapRegisterItems({ items: registerFallback });

        if (applied.source === 'pos' || applied.source === 'all') {
            const pendingIds = new Set(posPending.map((p) => String(p.expenseRequestId)));
            const merged = [
                ...posPending,
                ...rows.filter((r) => !pendingIds.has(String(r.expenseRequestId || r.sourceId))),
            ];
            rows = merged;
        }

        const q = String(applied.employeeQ || '').trim().toLowerCase();
        if (q) {
            rows = rows.filter((r) =>
                [r.employeeName, r.ref, r.cashierName, r.id]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                    .includes(q),
            );
        }
        if (applied.source && applied.source !== 'all') {
            rows = rows.filter((r) => sourceBadgeKey(r.source) === applied.source);
        }
        if (applied.cashier && applied.cashier !== 'all') {
            rows = rows.filter((r) => String(r.cashierName || '') === String(applied.cashier));
        }
        if (applied.status === 'pending_approved') {
            rows = rows.filter((r) => {
                const s = String(r.status || '').toLowerCase();
                return s === 'pending' || s === 'approved' || s === 'partial';
            });
        } else if (applied.status && applied.status !== 'all') {
            rows = rows.filter((r) => String(r.status || '').toLowerCase() === applied.status);
        }
        if (applied.month) {
            const prefix = String(applied.month).slice(0, 7);
            rows = rows.filter((r) => !r.date || r.date === '—' || String(r.date).startsWith(prefix));
        }
        return rows;
    }, [registerPayload, registerFallback, posPending, applied]);

    const registerPage = useMemo(() => {
        if (registerPayload && !registerApiMissing && applied.source !== 'pos') {
            // Server paging when register API is used without client-side POS merge filters.
            return {
                page: Number(registerPayload.page) || page,
                pageSize: Number(registerPayload.pageSize) || PAYROLL_ADVANCES_PAGE_SIZE,
                total: Number(registerPayload.total) || registerRows.length,
                items: mapRegisterItems(registerPayload),
                from:
                    ((Number(registerPayload.page) || 1) - 1) *
                        (Number(registerPayload.pageSize) || PAYROLL_ADVANCES_PAGE_SIZE) +
                    1,
                to: Math.min(
                    Number(registerPayload.total) || 0,
                    (Number(registerPayload.page) || 1) *
                        (Number(registerPayload.pageSize) || PAYROLL_ADVANCES_PAGE_SIZE),
                ),
            };
        }
        return slicePage(registerRows, page, PAYROLL_ADVANCES_PAGE_SIZE);
    }, [registerPayload, registerApiMissing, registerRows, page, applied.source]);

    const posCards = useMemo(() => {
        const pending = registerRows.filter((r) => String(r.status).toLowerCase() === 'pending');
        const approved = registerRows.filter((r) => {
            const s = String(r.status).toLowerCase();
            return s === 'approved' || s === 'partial';
        });
        const sum = (arr) =>
            arr.reduce((acc, r) => {
                const n = Number(r.amount);
                return Number.isFinite(n) ? acc + Math.round(n * 100) : acc;
            }, 0) / 100;
        return {
            pendingCount: pending.length,
            pendingSar: sum(pending),
            approvedCount: approved.length,
            approvedSar: sum(approved),
            fromWallets: sum(approved),
        };
    }, [registerRows]);

    const cashierOptions = useMemo(() => {
        const names = new Set();
        registerRows.forEach((r) => {
            if (r.cashierName) names.add(r.cashierName);
        });
        return [...names].sort();
    }, [registerRows]);

    const applyFilters = () => {
        setApplied({ ...draft });
        setPage(1);
        setSearchParams(
            (prev) => {
                const p = new URLSearchParams(prev);
                p.set('tab', activeTab);
                if (draft.employeeQ) p.set('q', draft.employeeQ);
                else p.delete('q');
                if (draft.month) p.set('month', draft.month);
                else p.delete('month');
                if (draft.branchId && draft.branchId !== 'all') p.set('branchId', draft.branchId);
                else p.delete('branchId');
                if (draft.source && draft.source !== 'all') p.set('source', draft.source);
                else p.delete('source');
                if (draft.status && draft.status !== 'all') p.set('status', draft.status);
                else p.delete('status');
                if (draft.cashier && draft.cashier !== 'all') p.set('cashier', draft.cashier);
                else p.delete('cashier');
                p.delete('page');
                return p;
            },
            { replace: true },
        );
    };

    const showAll = () => {
        const cleared = {
            employeeQ: '',
            month: currentMonthYmd(),
            branchId: selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : 'all',
            source: 'all',
            status: 'all',
            cashier: 'all',
            staffActive: 'active',
        };
        setDraft(cleared);
        setApplied(cleared);
        setPage(1);
        setSearchParams(
            (prev) => {
                const p = new URLSearchParams(prev);
                p.set('tab', activeTab);
                ['q', 'month', 'branchId', 'source', 'status', 'cashier', 'page'].forEach((k) =>
                    p.delete(k),
                );
                return p;
            },
            { replace: true },
        );
    };

    const onFilterKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyFilters();
        }
        if (e.key === 'Escape' && inlineAction) {
            setInlineAction(null);
        }
    };

    const pickEmployee = (selectKey) => {
        const emp = employeeByRecordId[String(selectKey)];
        const parsed = parseWorkshopStaffSelectValue(selectKey);
        return {
            employeeRecordId: parsed.id,
            employeeSelectKey: selectKey,
            recordType: parsed.recordType,
            userId: emp?.userId || '',
            employeeName: emp?.name || '',
        };
    };

    const submitAdvance = async () => {
        if (!advanceForm.userId || !advanceForm.payFromAccountId || !advanceForm.amount) {
            setError(t('adv.err.required'));
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await createWorkshopAdvance({
                employeeId: String(advanceForm.userId),
                employeeRecordId: advanceForm.employeeRecordId || undefined,
                recordType: advanceForm.recordType || undefined,
                employeeName: advanceForm.employeeName,
                amount: Number(advanceForm.amount || 0),
                date: advanceForm.date,
                payFromAccountId: advanceForm.payFromAccountId,
                reason: advanceForm.reason || undefined,
            });
            setAdvanceForm(emptyAdvanceForm());
            openView('list');
            setTab('register');
            await refresh();
        } catch (e) {
            setError(e?.message || t('adv.err.pay'));
        } finally {
            setSubmitting(false);
        }
    };

    const submitBulkAdvances = async () => {
        const rows = bulkAdvanceRows
            .filter((r) => r.userId && Number(r.amount) > 0 && r.payFromAccountId)
            .map((r) => ({
                employeeId: String(r.userId),
                employeeRecordId: r.employeeRecordId || undefined,
                recordType: r.recordType || undefined,
                employeeName: r.employeeName || t('adv.defaultEmployee'),
                amount: Number(r.amount || 0),
                date: r.date,
                payFromAccountId: r.payFromAccountId,
                reason: r.reason || undefined,
            }));
        if (!rows.length) {
            setError(t('adv.err.required'));
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await bulkCreateWorkshopAdvances({ rows });
            setBulkAdvanceRows([makeAdvanceRow()]);
            openView('list');
            await refresh();
        } catch (e) {
            setError(e?.message || t('adv.err.bulk'));
        } finally {
            setSubmitting(false);
        }
    };

    const goStatement = (row) => {
        setSearchParams(
            (prev) => {
                const p = new URLSearchParams(prev);
                p.set('tab', 'statement');
                if (row.userId) p.set('employee', String(row.userId));
                else if (row.staffKey) p.set('employee', String(row.staffKey));
                else if (row.employeeRecordId) p.set('employee', String(row.employeeRecordId));
                else if (row.employeeId) p.set('employee', String(row.employeeId));
                if (row.employeeRecordId) p.set('employeeRecordId', String(row.employeeRecordId));
                return p;
            },
            { replace: false },
        );
    };

    const [payFromDialog, setPayFromDialog] = useState(null);
    const [payFromBusy, setPayFromBusy] = useState(false);
    const [payFromError, setPayFromError] = useState('');

    const doApprove = async (row) => {
        if (!row.expenseRequestId) return;
        setPayFromError('');
        setPayFromDialog({
            id: row.expenseRequestId,
            amount: row.amount,
            payToType: 'salary_advance',
            isExpense: true,
            description: row.employeeName || row.name,
        });
    };

    const confirmPayFromAdvance = async (body) => {
        if (!payFromDialog) return;
        setPayFromBusy(true);
        setSubmitting(true);
        setError('');
        try {
            await approveExpenseRequest(payFromDialog.id, body);
            setPayFromDialog(null);
            setInlineAction(null);
            await refresh();
        } catch (e) {
            setPayFromError(e?.message || t('adv.err.load'));
        } finally {
            setPayFromBusy(false);
            setSubmitting(false);
        }
    };

    const doReject = async (row, reason) => {
        if (!row.expenseRequestId) return;
        setSubmitting(true);
        setError('');
        try {
            await rejectExpenseRequest(row.expenseRequestId, { reason: reason || undefined });
            setInlineAction(null);
            await refresh();
        } catch (e) {
            setError(e?.message || t('adv.err.load'));
        } finally {
            setSubmitting(false);
        }
    };

    const controlCode = stats.controlAccount?.code ?? '1250';
    const isPosRegister = activeTab === 'register' && applied.source === 'pos';

    if (payrollPath.kind === 'slip') {
        return (
            <WorkshopPayslipPage
                slipId={payrollPath.slipId}
                locale={locale}
            />
        );
    }
    if (payrollPath.kind === 'run') {
        return (
            <WorkshopPayrollRunPage
                period={payrollPath.period}
                branches={branches}
                selectedBranchId={selectedBranchId}
                locale={locale}
                employees={employees}
            />
        );
    }

    if (view !== 'list') {
        if (loading && employees.length === 0) {
            return (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t('loading')}</div>
            );
        }
        const shared = {
            t,
            controlCode,
            employees: payableEmployees,
            accounts: cashBankAccounts,
            pickEmployee,
            submitting,
            error,
            onBack: () => openView('list'),
        };
        return view === 'bulk' ? (
            <AdvanceBulkPage
                {...shared}
                rows={bulkAdvanceRows}
                setRows={setBulkAdvanceRows}
                makeRow={makeAdvanceRow}
                onSubmit={submitBulkAdvances}
            />
        ) : (
            <AdvancePayPage {...shared} form={advanceForm} setForm={setAdvanceForm} onSubmit={submitAdvance} />
        );
    }

    return (
        <div className="advances-view" dir={isRtl ? 'rtl' : 'ltr'}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>
                {isPosRegister ? t('adv.crumbPos') : t('adv.crumb')}
                </div>
            <header
                className="advances-header"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 16,
                }}
            >
                <h2 className="adv-title" style={{ margin: 0 }}>
                    {isPosRegister ? t('adv.posTitle') : t('adv.title')}
                </h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {canCreate ? (
                        <button
                            type="button"
                            className="btn-submit btn-dark"
                            onClick={() => openView('new')}
                        >
                            <Plus size={16} style={{ marginInlineEnd: 6 }} />
                            {t('adv.newAdvance')}
                    </button>
                    ) : null}
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => {
                            const month = applied.month || currentMonthYmd() || currentPeriodYmd();
                            navigate(
                                `/workshop/accounting/advances/payroll/${encodeURIComponent(month)}`,
                            );
                        }}
                    >
                        {t('adv.runPayroll')}
                    </button>
                    <button type="button" className="btn-portal-outline" onClick={refresh} disabled={loading}>
                        <RefreshCw size={14} style={{ marginInlineEnd: 6 }} />
                        {t('btn.refresh')}
                    </button>
                </div>
            </header>

            {!isPosRegister ? (
                <div className="acct-kpi-grid">
                    {summaryCards.map((c) => {
                        const meta = CARD_META[c.id] || CARD_META.outstanding;
                        const Icon = meta.Icon;
                        const isCount = c.id === 'empWithAdvance';
                        const shown = isCount ? String(c.value) : moneyOrDash(c.value, t);
                        return (
                            <div key={c.id} className="acct-kpi-card acct-kpi-card--with-icon">
                                <div className="acct-kpi-icon">
                                    <Icon size={18} />
                                </div>
                                <div className="acct-kpi-body">
                                    <div className="acct-kpi-label" title={t(meta.labelKey)}>
                                        {t(meta.labelKey)}
                                    </div>
                                    <div className="acct-kpi-value" title={shown}>
                                        {shown}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="acct-kpi-grid">
                    <div className="acct-kpi-card acct-kpi-card--with-icon">
                        <div className="acct-kpi-icon"><Clock size={18} /></div>
                        <div className="acct-kpi-body">
                            <div className="acct-kpi-label">{t('adv.stat.pendingApproval')}</div>
                            <div
                                className="acct-kpi-value"
                                title={t('adv.countSar', {
                                    count: posCards.pendingCount,
                                    n: formatSarLatn(posCards.pendingSar),
                                })}
                            >
                                {t('adv.countSar', {
                                    count: posCards.pendingCount,
                                    n: formatSarLatn(posCards.pendingSar),
                                })}
                            </div>
                            </div>
                        </div>
                    <div className="acct-kpi-card acct-kpi-card--with-icon">
                        <div className="acct-kpi-icon"><RiyalIcon size={18} /></div>
                        <div className="acct-kpi-body">
                            <div className="acct-kpi-label">{t('adv.stat.approvedMonth')}</div>
                            <div
                                className="acct-kpi-value"
                                title={t('adv.countSar', {
                                    count: posCards.approvedCount,
                                    n: formatSarLatn(posCards.approvedSar),
                                })}
                            >
                                {t('adv.countSar', {
                                    count: posCards.approvedCount,
                                    n: formatSarLatn(posCards.approvedSar),
                                })}
                    </div>
                    </div>
                </div>
                    <div className="acct-kpi-card acct-kpi-card--with-icon">
                        <div className="acct-kpi-icon"><Wallet size={18} /></div>
                        <div className="acct-kpi-body">
                            <div className="acct-kpi-label">{t('adv.stat.fromWallets')}</div>
                            <div className="acct-kpi-value" title={moneyOrDash(posCards.fromWallets, t)}>
                                {moneyOrDash(posCards.fromWallets, t)}
                    </div>
                </div>
                    </div>
                    <div className="acct-kpi-card acct-kpi-card--with-icon">
                        <div className="acct-kpi-icon"><AlertTriangle size={18} /></div>
                        <div className="acct-kpi-body">
                            <div className="acct-kpi-label">{t('adv.stat.tillImpact')}</div>
                            <div className="acct-kpi-value">{t('adv.stat.tillNone')}</div>
                </div>
                    </div>
                </div>
            )}

            <div
                role="tablist"
                style={{
                    display: 'flex',
                    gap: 4,
                    borderBottom: '1px solid #E2E8F0',
                    marginBottom: 16,
                    flexWrap: 'wrap',
                }}
            >
                {PAGE_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={activeTab === tab.id ? 'btn-submit btn-dark' : 'btn-portal-outline'}
                        style={{
                            borderRadius: '8px 8px 0 0',
                            borderBottom: activeTab === tab.id ? '2px solid #FCC245' : '2px solid transparent',
                        }}
                        onClick={() => setTab(tab.id)}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
            </div>

            {(activeTab === 'overview' || activeTab === 'register') && (
                <div className="acct-filter-bar" onKeyDown={onFilterKeyDown}>
                    <div style={{ ...fieldWrap, minWidth: 200, flex: '1 1 200px' }}>
                        <label style={labelStyle} htmlFor="adv-emp-q">
                            {t('adv.filter.employee')}
                        </label>
                        <input
                            id="adv-emp-q"
                            style={inputStyle}
                            value={draft.employeeQ}
                            onChange={(e) => setDraft((d) => ({ ...d, employeeQ: e.target.value }))}
                            placeholder={t('adv.filter.employeePh')}
                        />
                    </div>
                    <div style={fieldWrap}>
                        <label style={labelStyle} htmlFor="adv-month">
                            {t('adv.filter.month')}
                        </label>
                        <input
                            id="adv-month"
                            type="month"
                            style={inputStyle}
                            value={draft.month}
                            onChange={(e) => setDraft((d) => ({ ...d, month: e.target.value }))}
                        />
                    </div>
                    {branches.length > 0 && !isPosRegister ? (
                        <div style={fieldWrap}>
                            <label style={labelStyle} htmlFor="adv-branch">
                                {t('adv.filter.branch')}
                            </label>
                            <select
                                id="adv-branch"
                                style={inputStyle}
                                value={draft.branchId}
                                onChange={(e) => setDraft((d) => ({ ...d, branchId: e.target.value }))}
                            >
                                <option value="all">{t('adv.allBranches')}</option>
                            {branches.map((b) => (
                                <option key={String(b.id)} value={String(b.id)}>
                                    {b.name}
                                </option>
                            ))}
                            </select>
                    </div>
                ) : null}
                    <div style={fieldWrap}>
                        <label style={labelStyle} htmlFor="adv-source">
                            {t('adv.filter.source')}
                        </label>
                        <select
                            id="adv-source"
                            style={inputStyle}
                            value={draft.source}
                            onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                        >
                            <option value="all">{t('adv.filter.allSources')}</option>
                            <option value="admin">{t('adv.filter.source.admin')}</option>
                            <option value="pos">{t('adv.filter.source.pos')}</option>
                            <option value="staff">{t('adv.filter.source.staff')}</option>
                            <option value="transactions">{t('adv.filter.source.transactions')}</option>
                        </select>
                    </div>
                    {isPosRegister ? (
                        <div style={fieldWrap}>
                            <label style={labelStyle} htmlFor="adv-cashier">
                                {t('adv.filter.cashier')}
                            </label>
                            <select
                                id="adv-cashier"
                                style={inputStyle}
                                value={draft.cashier}
                                onChange={(e) => setDraft((d) => ({ ...d, cashier: e.target.value }))}
                            >
                                <option value="all">{t('adv.filter.allCashiers')}</option>
                                {cashierOptions.map((n) => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : null}
                    {activeTab === 'overview' ? (
                        <div style={fieldWrap}>
                            <label style={labelStyle} htmlFor="adv-staff-active">
                                {t('adv.filter.staffActive')}
                            </label>
                            <select
                                id="adv-staff-active"
                                style={inputStyle}
                                value={draft.staffActive || 'active'}
                                onChange={(e) =>
                                    setDraft((d) => ({ ...d, staffActive: e.target.value }))
                                }
                            >
                                <option value="active">{t('adv.filter.staffActive.active')}</option>
                                <option value="inactive">{t('adv.filter.staffActive.inactive')}</option>
                                <option value="all">{t('adv.filter.staffActive.all')}</option>
                            </select>
                        </div>
                    ) : null}
                    <div style={fieldWrap}>
                        <label style={labelStyle} htmlFor="adv-status">
                            {t('adv.filter.status')}
                        </label>
                        <select
                            id="adv-status"
                            style={inputStyle}
                            value={draft.status}
                            onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                        >
                            {isPosRegister ? (
                                <>
                                    <option value="pending_approved">
                                        {t('adv.filter.status.pendingApproved')}
                                    </option>
                                    <option value="pending">{t('adv.filter.pending')}</option>
                                    <option value="approved">{t('adv.filter.approved')}</option>
                                    <option value="all">{t('adv.filter.allStatus')}</option>
                                </>
                            ) : (
                                <>
                                    <option value="all">{t('adv.filter.allStatus')}</option>
                                    <option value="outstanding">{t('adv.filter.status.outstanding')}</option>
                                    <option value="cleared">{t('adv.filter.status.cleared')}</option>
                                    <option value="pending">{t('adv.filter.pending')}</option>
                                    <option value="approved">{t('adv.filter.approved')}</option>
                                </>
                            )}
                        </select>
                    </div>
                    <button type="button" className="btn-submit btn-dark" onClick={applyFilters}>
                        {t('adv.filter.apply')}
                            </button>
                    <button type="button" className="btn-portal-outline" onClick={showAll}>
                        {t('adv.filter.showAll')}
                            </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => {
                            setAdvSheetPreset({ batchId: '', advanceId: '' });
                            setAdvSheetError('');
                            setAdvSheetOpen(true);
                        }}
                    >
                        <FileDown size={14} style={{ marginInlineEnd: 6 }} />
                        {t('pr.sheet.advDownload')}
                    </button>
                        </div>
            )}

            {error ? (
                <div
                    role="alert"
                    style={{
                        padding: 12,
                        marginBottom: 12,
                        color: '#B45309',
                        background: '#FFFBEB',
                        borderRadius: 8,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    <span>{error}</span>
                    <button type="button" className="btn-portal-outline" onClick={refresh}>
                        {t('adv.err.retry')}
                    </button>
                </div>
            ) : null}

            {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t('loading')}</div>
            ) : activeTab === 'payroll' ? (
                <WorkshopSalaryTab
                    branchFilter={applied.branchId === 'all' ? '' : applied.branchId}
                    branches={branches}
                />
            ) : activeTab === 'statement' ? (
                <WorkshopEmployeeLedgerTab
                    employees={employees}
                    employeeByRecordId={employeeByRecordId}
                    branchFilter={applied.branchId === 'all' ? '' : applied.branchId}
                    locale={locale}
                    initialEmployeeKey={
                        (() => {
                            const emp = searchParams.get('employee');
                            if (!emp) return '';
                            const match = employees.find(
                                (e) =>
                                    String(e.id) === String(emp) ||
                                    String(e.userId) === String(emp) ||
                                    workshopStaffSelectValue(e) === String(emp),
                            );
                            return match ? workshopStaffSelectValue(match) : emp;
                        })()
                    }
                />
            ) : activeTab === 'register' ? (
                <>
                    {registerApiMissing ? (
                        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>
                            {t('adv.register.fallbackNote')}
                        </p>
                    ) : null}
                    <WsTableScroll>
                        <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr className="table-header-row">
                                    <th className="table-th">{t('adv.th.date')}</th>
                                    <th className="table-th">{t('adv.th.ref')}</th>
                                    {isPosRegister ? (
                                        <th className="table-th">{t('adv.th.cashierWallet')}</th>
                                    ) : null}
                                        <th className="table-th">{t('adv.th.employee')}</th>
                                    <th className="table-th" style={{ textAlign: 'end' }}>
                                        {t('adv.th.amount')}
                                    </th>
                                    <th className="table-th">{t('adv.th.status')}</th>
                                    {isPosRegister ? (
                                        <th className="table-th">{t('adv.th.journal')}</th>
                                    ) : (
                                        <th className="table-th">{t('adv.filter.source')}</th>
                                    )}
                                    <th className="table-th">{t('adv.th.action')}</th>
                                    </tr>
                                </thead>
                            <tbody>
                                {(isPosRegister ? registerPage.items : registerPage.items).length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={isPosRegister ? 8 : 7}
                                            className="table-cell table-empty"
                                            style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}
                                        >
                                            {t('adv.noAdvances')}
                                        </td>
                                    </tr>
                                ) : (
                                    (isPosRegister ? registerPage.items : registerPage.items).map((a) => {
                                        const pending = String(a.status).toLowerCase() === 'pending';
                                        const walletLow = isWalletTooLow(a.walletBalance, a.amount);
                                        const showInline =
                                            inlineAction &&
                                            String(inlineAction.id) === String(a.id);
                                        return (
                                            <React.Fragment key={a.id}>
                                                <tr className="table-row">
                                                    <td className="table-cell">{a.date}</td>
                                                    <td className="table-cell">{a.ref}</td>
                                                    {isPosRegister ? (
                                                        <td className="table-cell">
                                                            {a.cashierName
                                                                ? t('adv.cashierWalletLine', {
                                                                      name: a.cashierName,
                                                                      n: formatSarLatn(
                                                                          a.walletBalance ?? 0,
                                                                      ),
                                                                  })
                                                                : t('adv.emdash')}
                                                        </td>
                                                    ) : null}
                                                    <td className="table-cell" style={{ fontWeight: 700 }}>
                                                        {a.employeeName}
                                                    </td>
                                                    <td className="table-cell" style={{ textAlign: 'end' }}>
                                                        {formatSarLatn(a.amount)}
                                                    </td>
                                                    <td className="table-cell">
                                                        <StatusChip status={a.status} t={t} />
                                                    </td>
                                                    {isPosRegister ? (
                                                        <td className="table-cell">
                                                            {a.journalLabel ||
                                                                (pending
                                                                    ? t('adv.emdash')
                                                                    : t('adv.journal.drCrWallet'))}
                                                        </td>
                                                    ) : (
                                                        <td className="table-cell">
                                                            {t(
                                                                `adv.filter.source.${sourceBadgeKey(a.source)}`,
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="table-cell">
                                                            {isPosRegister && pending && canApprove && a.expenseRequestId ? (
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        gap: 6,
                                                                        flexWrap: 'wrap',
                                                                        alignItems: 'center',
                                                                    }}
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className="btn-submit btn-dark"
                                                                        disabled={walletLow || submitting}
                                                                        title={
                                                                            walletLow
                                                                                ? t('adv.action.walletLow')
                                                                                : undefined
                                                                        }
                                                                        onClick={() =>
                                                                            setInlineAction({
                                                                                type: 'approve',
                                                                                id: a.id,
                                                                                row: a,
                                                                            })
                                                                        }
                                                                    >
                                                                        {t('adv.action.approve')}
                                                                    </button>
                                                                    {walletLow ? (
                                                                        <span
                                                                            style={{
                                                                                fontSize: 11,
                                                                                color: '#B45309',
                                                                                fontWeight: 600,
                                                                            }}
                                                                        >
                                                                            {t('adv.action.walletLow')}
                                                        </span>
                                                                    ) : null}
                                                                    <button
                                                                        type="button"
                                                                        className="btn-portal-outline"
                                                                        disabled={submitting}
                                                                        onClick={() =>
                                                                            setInlineAction({
                                                                                type: 'reject',
                                                                                id: a.id,
                                                                                row: a,
                                                                                reason: '',
                                                                            })
                                                                        }
                                                                    >
                                                                        {t('adv.action.reject')}
                                                                    </button>
                                                    </div>
                                                            ) : isAdvanceSheetReady(a) ||
                                                              String(a.status).toLowerCase() === 'approved' ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                    onClick={() => {
                                                                        setAdvSheetPreset({
                                                                            batchId: a.sourceId || '',
                                                                            advanceId: a.sourceId ? '' : String(a.id),
                                                                        });
                                                                        setAdvSheetError('');
                                                                        setAdvSheetOpen(true);
                                                                    }}
                                                                >
                                                                    <FileDown size={14} style={{ marginInlineEnd: 6 }} />
                                                                    {t('pr.sheet.advDownload')}
                                                                </button>
                                                            ) : (
                                                                t('adv.emdash')
                                                            )}
                                                </td>
                                            </tr>
                                                {showInline ? (
                                                    <tr>
                                                        <td
                                                            colSpan={isPosRegister ? 8 : 7}
                                                        style={{
                                                                background: '#FFFBEB',
                                                                padding: 12,
                                                            }}
                                                        >
                                                            {inlineAction.type === 'approve' ? (
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        gap: 8,
                                                                        alignItems: 'center',
                                                                        flexWrap: 'wrap',
                                                                    }}
                                                                >
                                                                    <span>{t('adv.confirm.approve')}</span>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-submit btn-dark"
                                                                        disabled={submitting}
                                                                        onClick={() => doApprove(a)}
                                                                    >
                                                                        {t('adv.confirm.yes')}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-portal-outline"
                                                                        onClick={() => setInlineAction(null)}
                                                                    >
                                                                        {t('adv.confirm.no')}
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    style={{
                                                                        display: 'flex',
                                                                        gap: 8,
                                                                        alignItems: 'flex-end',
                                                                        flexWrap: 'wrap',
                                                                    }}
                                                                >
                                                                    <div style={fieldWrap}>
                                                                        <label
                                                                            style={labelStyle}
                                                                            htmlFor="adv-reject-reason"
                                                                        >
                                                                            {t('adv.reject.reason')}
                                                                        </label>
                                                                        <input
                                                                            id="adv-reject-reason"
                                                                            style={inputStyle}
                                                                            value={inlineAction.reason || ''}
                                                                            onChange={(e) =>
                                                                                setInlineAction((x) => ({
                                                                                    ...x,
                                                                                    reason: e.target.value,
                                                                                }))
                                                                            }
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-submit btn-dark"
                                                                        disabled={submitting}
                                                                        onClick={() =>
                                                                            doReject(
                                                                                a,
                                                                                inlineAction.reason,
                                                                            )
                                                                        }
                                                                    >
                                                                        {t('adv.reject.confirm')}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-portal-outline"
                                                                        onClick={() => setInlineAction(null)}
                                                                    >
                                                                        {t('adv.reject.cancel')}
                                                                    </button>
                                                                </div>
                                                            )}
                                                    </td>
                                                </tr>
                                                ) : null}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </WsTableScroll>
                    <PaginationControls
                        total={registerPage.total}
                        limit={registerPage.pageSize}
                        offset={(registerPage.page - 1) * registerPage.pageSize}
                        onPageChange={(offset) => {
                            const next = Math.floor(offset / registerPage.pageSize) + 1;
                            setPage(next);
                        }}
                        loading={loading}
                    />
                    {isPosRegister ? (
                        <p style={{ fontSize: 12, color: '#64748B', marginTop: 12 }}>{t('adv.pos.note')}</p>
                        ) : null}
                </>
            ) : (
                <>
                    <p style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
                        {t('adv.summary.lineFull', {
                            n: overviewFiltered.length,
                            out:
                                outstandingSum != null
                                    ? formatSarLatn(outstandingSum)
                                    : t('adv.summary.payableNa'),
                            pay:
                                payableSum != null
                                    ? formatSarLatn(payableSum)
                                    : t('adv.summary.payableNa'),
                            comm:
                                commissionSum != null
                                    ? formatSarLatn(commissionSum)
                                    : t('adv.summary.payableNa'),
                            })}
                        </p>
                    {overviewFiltered.some((r) => r.commissionPayableSource === '2200') ? (
                        <p style={{ fontSize: 12, color: '#92400E', marginBottom: 10 }}>
                            {t('adv.commissionOnHeading')}
                        </p>
                    ) : null}
                    <WsTableScroll>
                        <table className="ws-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">{t('adv.th.employee')}</th>
                                    <th className="table-th">{t('adv.th.staffStatus')}</th>
                                    <th className="table-th">{t('adv.th.role')}</th>
                                    <th className="table-th">{t('adv.th.branch')}</th>
                                    <th className="table-th" style={{ textAlign: 'end' }}>
                                        {t('adv.th.outstanding')}
                                    </th>
                                    <th className="table-th">{t('adv.th.lastAdvance')}</th>
                                    <th className="table-th">{t('adv.th.lastRecovery')}</th>
                                    <th className="table-th" style={{ textAlign: 'end' }}>
                                        {t('adv.th.salaryPayable')}
                                    </th>
                                    <th className="table-th" style={{ textAlign: 'end' }}>
                                        {t('adv.th.commissionPayable')}
                                    </th>
                                    <th className="table-th">{t('adv.th.action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overviewPage.items.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={10}
                                            className="table-cell table-empty"
                                            style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}
                                        >
                                            {t('adv.noEmployees')}
                                        </td>
                                    </tr>
                                ) : (
                                    overviewPage.items.map((e) => (
                                        <tr key={e.key} className="table-row">
                                            <td className="table-cell" style={{ fontWeight: 700 }}>
                                                {e.displayName || e.name}
                                            </td>
                                            <td className="table-cell">
                                                {e.inactive
                                                    ? t('adv.filter.staffActive.inactive')
                                                    : t('adv.filter.staffActive.active')}
                                            </td>
                                            <td className="table-cell">{e.role}</td>
                                            <td className="table-cell">{e.branchName}</td>
                                            <td
                                                className="table-cell"
                                                style={{
                                                    textAlign: 'end',
                                                    color:
                                                        Number(e.outstanding) > 0 ? '#DC2626' : undefined,
                                                    fontWeight:
                                                        Number(e.outstanding) > 0 ? 700 : 400,
                                                }}
                                            >
                                                {formatSarLatn(e.outstanding ?? 0)}
                                            </td>
                                            <td className="table-cell">
                                                {formatLastAdvanceLabel(e, locale)}
                                            </td>
                                            <td className="table-cell">
                                                {e.lastRecovery
                                                    ? String(e.lastRecovery).slice(0, 10)
                                                    : t('adv.emdash')}
                                            </td>
                                            <td className="table-cell" style={{ textAlign: 'end' }}>
                                                {e.salaryPayable != null
                                                    ? formatSarLatn(e.salaryPayable)
                                                    : t('adv.emdash')}
                                            </td>
                                            <td className="table-cell" style={{ textAlign: 'end' }}>
                                                {e.commissionPayable != null
                                                    ? formatSarLatn(e.commissionPayable)
                                                    : t('adv.emdash')}
                                            </td>
                                            <td className="table-cell">
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline"
                                                    onClick={() => goStatement(e)}
                                                >
                                                    {t('adv.action.statement')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </WsTableScroll>
                    <PaginationControls
                        total={overviewPage.total}
                        limit={overviewPage.pageSize}
                        offset={(overviewPage.page - 1) * overviewPage.pageSize}
                        onPageChange={(offset) => {
                            setPage(Math.floor(offset / overviewPage.pageSize) + 1);
                        }}
                        loading={loading}
                    />
                </>
            )}
            <PayrollSheetDownloadDialog
                open={advSheetOpen}
                title={t('pr.sheet.advTitle')}
                t={t}
                branches={branches}
                defaultBranchId={applied.branchId}
                defaultMonth={applied.month}
                showDateRange
                busy={advSheetBusy}
                error={advSheetError}
                onClose={() => setAdvSheetOpen(false)}
                onDownload={downloadAdvanceSheet}
            />
            <PettyCashPayFromDialog
                open={Boolean(payFromDialog)}
                request={payFromDialog}
                locale={locale}
                busy={payFromBusy}
                error={payFromError}
                onCancel={() => {
                    if (payFromBusy) return;
                    setPayFromDialog(null);
                    setPayFromError('');
                }}
                onConfirm={(body) => void confirmPayFromAdvance(body)}
            />
        </div>
    );
}
