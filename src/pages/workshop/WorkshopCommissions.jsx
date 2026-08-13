import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle, Users, Wallet, Calendar, AlertCircle } from 'lucide-react';
import Modal from '../../components/Modal';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import WorkshopCommissionRules from '../../components/commissions/WorkshopCommissionRules';
import { useAuth } from '../../context/AuthContext';
import { wcomT } from '../../utils/workshopCommissionsI18n';
import { riyadhDatetimeLocalToEpochMs } from '../../utils/riyadhBusinessRange';
import { loadWorkshopAdminDatetimeRange } from './workshopAdminDatetimeRange';

const COMMISSIONS_TABS = [
    { key: 'payouts', labelKey: 'tab.payouts', permission: 'workshop.commissions.ledger.view' },
    { key: 'commissions', labelKey: 'tab.commissions', permission: 'workshop.commissions.ledger.view' },
    { key: 'rules', labelKey: 'tab.rules', permission: 'workshop.commissions.rules.view' },
];
import {
    getWorkshopCommissionsSummary,
    getWorkshopCommissionsPendingByEmployee,
    getWorkshopCommissionsList,
    getWorkshopCommissionsEmployees,
    getWorkshopCommissionsPayoutAccounts,
    postWorkshopCommissionsPayout,
    workshopCommissionsScopeParams,
} from '../../services/workshopCommissionsApi';
import './Workshop.css';

const PAGE_SIZE = 25;

/** Convert datetime-local value to epoch ms for API date-time filters (Asia/Riyadh wall). */
function localDatetimeToEpochMs(local) {
    return riyadhDatetimeLocalToEpochMs(local);
}

function buildListParams(selectedBranchId, dateScope, filterStatus, filterEmployeeId, page, workshopId) {
    const base = workshopCommissionsScopeParams(selectedBranchId, {
        ...dateScope,
        ...(workshopId ? { workshopId } : {}),
    });
    return {
        ...base,
        ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
        ...(filterEmployeeId ? { employeeId: String(filterEmployeeId) } : {}),
        page,
        pageSize: PAGE_SIZE,
    };
}

/** Fetch every accrued line id + amount matching the current filters (all pages). */
async function fetchAllAccruedInScope(selectedBranchId, dateScope, filterEmployeeId, workshopId, options = {}) {
    const base = workshopCommissionsScopeParams(selectedBranchId, {
        ...dateScope,
        ...(workshopId ? { workshopId } : {}),
    });
    const batchSize = 200;
    const lines = new Map();
    let page = 1;
    let total = Infinity;

    while ((page - 1) * batchSize < total) {
        const res = await getWorkshopCommissionsList(
            {
                ...base,
                status: 'accrued',
                ...(filterEmployeeId ? { employeeId: String(filterEmployeeId) } : {}),
                page,
                pageSize: batchSize,
            },
            options,
        );
        const { items, total: listTotal } = parseCommissionList(res);
        total = listTotal;
        for (const raw of items) {
            const row = mapCommissionRow(raw);
            if (row.id && row.status === 'accrued') {
                lines.set(row.id, row.amount);
            }
        }
        if (items.length === 0) break;
        page += 1;
    }

    return lines;
}

const CHIP_PALETTE = [
    { color: '#E0E7FF', textColor: '#4338CA' },
    { color: '#DBEAFE', textColor: '#1D4ED8' },
    { color: '#F3E8FF', textColor: '#7E22CE' },
    { color: '#E0F2FE', textColor: '#0369A1' },
    { color: '#F0FDF4', textColor: '#15803D' },
    { color: '#FEF3C7', textColor: '#B45309' },
];

function chipColorsForKey(key) {
    let h = 0;
    const s = String(key || '');
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return CHIP_PALETTE[Math.abs(h) % CHIP_PALETTE.length];
}

function initialsFromName(name) {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase() || '?';
}

function normalizeSummary(res) {
    if (!res || typeof res !== 'object') {
        return { totalAccrued: 0, totalPaid: 0, pendingEmployeeCount: 0 };
    }
    return {
        totalAccrued: Number(res.total_accrued ?? res.totalAccrued ?? 0) || 0,
        totalPaid: Number(res.total_paid ?? res.totalPaid ?? 0) || 0,
        pendingEmployeeCount: Number(res.pending_employee_count ?? res.pendingEmployeeCount ?? 0) || 0,
    };
}

function parseCommissionList(res) {
    if (!res || typeof res !== 'object') return { items: [], total: 0 };
    const items = res.items ?? res.data?.items ?? [];
    const total = Number(res.total ?? res.data?.total ?? items.length) || 0;
    return { items: Array.isArray(items) ? items : [], total };
}

function mapCommissionRow(raw) {
    const id = raw?.id != null ? String(raw.id) : '';
    const rateNum = raw?.rate_percent ?? raw?.ratePercent;
    return {
        id,
        branchId: raw?.branch_id != null ? String(raw.branch_id) : '',
        branchName: raw?.branch_name ?? raw?.branchName,
        employeeId: raw?.employee_id != null ? String(raw.employee_id) : '',
        employee: raw?.employee_name ?? raw?.employeeName ?? '',
        initials: raw?.initials || initialsFromName(raw?.employee_name ?? raw?.employeeName),
        service: raw?.service_name ?? raw?.serviceName ?? '',
        date: raw?.date ?? raw?.commission_date ?? '',
        rate: rateNum != null && !Number.isNaN(Number(rateNum)) ? `${Number(rateNum)}%` : null,
        amount: Number(raw?.amount) || 0,
        status: String(raw?.status || '').toLowerCase(),
        jobCardRef: raw?.job_card_ref ?? raw?.jobCardRef ?? '',
        jobCardUrl: raw?.job_card_url ?? raw?.jobCardUrl ?? '',
        avatarUrl: raw?.avatar_url ?? raw?.avatarUrl ?? null,
    };
}

/** settled order: summary, pending-by-employee, employees, list */
function applyCommissionDashboardSettled(settled, setters, t) {
    const errMsgs = [];
    const [sumRes, pendRes, empRes, listRes] = settled;
    const {
        setSummary,
        setPendingByEmployee,
        setFilterEmployees,
        setCommissionRows,
        setListTotal,
    } = setters;

    if (sumRes.status === 'fulfilled') {
        setSummary(normalizeSummary(sumRes.value));
    } else if (sumRes.reason?.name !== 'AbortError') {
        errMsgs.push(sumRes.reason?.message || t('err.summaryFailed'));
    }
    if (pendRes.status === 'fulfilled') {
        const pendEmps = pendRes.value?.employees ?? pendRes.value?.data?.employees ?? [];
        setPendingByEmployee(Array.isArray(pendEmps) ? pendEmps : []);
    } else if (pendRes.reason?.name !== 'AbortError') {
        errMsgs.push(pendRes.reason?.message || t('err.pendingFailed'));
    }
    if (empRes.status === 'fulfilled') {
        const emps = empRes.value?.employees ?? empRes.value?.data?.employees ?? [];
        setFilterEmployees(Array.isArray(emps) ? emps : []);
    } else if (empRes.reason?.name !== 'AbortError') {
        errMsgs.push(empRes.reason?.message || t('err.employeesFailed'));
    }
    if (listRes.status === 'fulfilled') {
        const { items, total } = parseCommissionList(listRes.value);
        setCommissionRows(items.map(mapCommissionRow));
        setListTotal(total);
    } else if (listRes.reason?.name !== 'AbortError') {
        errMsgs.push(listRes.reason?.message || t('err.listFailed'));
    }

    return [...new Set(errMsgs)];
}

export default function WorkshopCommissions({
    selectedBranchId = 'all',
    branches = [],
    adminMode = false,
    workshopId = '',
    locale: localeProp,
}) {
    const locale = localeProp || (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) || 'en';
    const t = useCallback((key, vars) => wcomT(locale, key, vars), [locale]);
    const { hasPermission } = useAuth();
    const visibleCommissionTabs = adminMode
        ? COMMISSIONS_TABS
        : COMMISSIONS_TABS.filter((tab) => hasPermission(tab.permission));
    const [activeTab, setActiveTab] = useState(() => visibleCommissionTabs[0]?.key ?? 'payouts');
    useEffect(() => {
        if (visibleCommissionTabs.length === 0) return;
        if (!visibleCommissionTabs.some((tab) => tab.key === activeTab)) {
            setActiveTab(visibleCommissionTabs[0].key);
        }
    }, [visibleCommissionTabs, activeTab]);
    const [summary, setSummary] = useState({ totalAccrued: 0, totalPaid: 0, pendingEmployeeCount: 0 });
    const [pendingByEmployee, setPendingByEmployee] = useState([]);
    const [commissionRows, setCommissionRows] = useState([]);
    const [listTotal, setListTotal] = useState(0);
    const [filterEmployees, setFilterEmployees] = useState([]);
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterEmployeeId, setFilterEmployeeId] = useState('');
    const [employeeFilterText, setEmployeeFilterText] = useState('');
    const [startDateTime, setStartDateTime] = useState(
        () => loadWorkshopAdminDatetimeRange()?.dateFrom || '',
    );
    const [endDateTime, setEndDateTime] = useState(
        () => loadWorkshopAdminDatetimeRange()?.dateTo || '',
    );
    const [page, setPage] = useState(1);
    const [accruedTotalInScope, setAccruedTotalInScope] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [selectAllLoading, setSelectAllLoading] = useState(false);

    const [selectedLines, setSelectedLines] = useState(() => new Map());
    const [payoutModalOpen, setPayoutModalOpen] = useState(false);
    const [payoutAccounts, setPayoutAccounts] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [payoutNotes, setPayoutNotes] = useState('');
    const [payoutError, setPayoutError] = useState('');
    const [payoutSubmitting, setPayoutSubmitting] = useState(false);
    const [employeePayoutLoadingId, setEmployeePayoutLoadingId] = useState('');
    const [selectedEmployeePayoutIds, setSelectedEmployeePayoutIds] = useState(() => new Set());

    const filterScopeKeyRef = useRef('');

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return t('branch.all');
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || t('branch.fallback');
    }, [branches, selectedBranchId, t]);

    const dateScope = useMemo(() => {
        const o = {};
        const startMs = localDatetimeToEpochMs(startDateTime);
        const endMs = localDatetimeToEpochMs(endDateTime);
        if (startMs) o.startAt = startMs;
        if (endMs) o.endAt = endMs;
        return o;
    }, [startDateTime, endDateTime]);

    const employeeComboboxOptions = useMemo(
        () =>
            filterEmployees.map((e) => {
                const id = e.employee_id ?? e.employeeId;
                const nm = e.name ?? '';
                const lc = e.line_count ?? e.lineCount;
                return {
                    id: String(id),
                    label: nm || t('employee.fallback'),
                    subtitle: lc != null ? t('employee.entries', { count: lc }) : '',
                };
            }),
        [filterEmployees, t],
    );

    const displayedPendingEmployees = useMemo(() => {
        if (!filterEmployeeId) return pendingByEmployee;
        return pendingByEmployee.filter(
            (emp) =>
                String(emp.employee_id ?? emp.employeeId ?? '') ===
                String(filterEmployeeId),
        );
    }, [pendingByEmployee, filterEmployeeId]);

    const filterScopeKey = useMemo(
        () =>
            [
                workshopId,
                selectedBranchId,
                startDateTime,
                endDateTime,
                filterStatus,
                filterEmployeeId,
            ].join('\u0001'),
        [workshopId, selectedBranchId, startDateTime, endDateTime, filterStatus, filterEmployeeId],
    );

    const scopeExtra = useMemo(() => {
        const o = { ...dateScope };
        if (workshopId) o.workshopId = workshopId;
        return o;
    }, [dateScope, workshopId]);

    useEffect(() => {
        const ac = new AbortController();
        const opt = { signal: ac.signal };
        let cancelled = false;

        const scopeChanged = filterScopeKeyRef.current !== filterScopeKey;
        if (scopeChanged) {
            filterScopeKeyRef.current = filterScopeKey;
            setSelectedLines(new Map());
            setSelectedEmployeePayoutIds(new Set());
            if (page !== 1) {
                setPage(1);
                return () => ac.abort();
            }
        }

        if (adminMode && !workshopId) {
            setIsLoading(false);
            return () => ac.abort();
        }

        setLoadError('');
        setIsLoading(true);
        (async () => {
            try {
                const base = workshopCommissionsScopeParams(selectedBranchId, scopeExtra);
                const listParams = buildListParams(
                    selectedBranchId,
                    scopeExtra,
                    filterStatus,
                    filterEmployeeId,
                    page,
                    workshopId,
                );
                const accruedCountParams = {
                    ...base,
                    status: 'accrued',
                    ...(filterEmployeeId ? { employeeId: String(filterEmployeeId) } : {}),
                    page: 1,
                    pageSize: 1,
                };

                const settled = await Promise.allSettled([
                    getWorkshopCommissionsSummary(base, opt),
                    getWorkshopCommissionsPendingByEmployee(base, opt),
                    getWorkshopCommissionsEmployees(base, opt),
                    getWorkshopCommissionsList(listParams, opt),
                    filterStatus === 'accrued'
                        ? Promise.resolve(null)
                        : getWorkshopCommissionsList(accruedCountParams, opt),
                ]);

                if (cancelled) return;

                const deduped = applyCommissionDashboardSettled(settled.slice(0, 4), {
                    setSummary,
                    setPendingByEmployee,
                    setFilterEmployees,
                    setCommissionRows,
                    setListTotal,
                }, t);
                if (!cancelled) {
                    const listRes = settled[3];
                    if (listRes.status === 'fulfilled') {
                        const { total: listCount } = parseCommissionList(listRes.value);
                        if (filterStatus === 'accrued') {
                            setAccruedTotalInScope(listCount);
                        }
                    }
                    if (filterStatus !== 'accrued' && settled[4]?.status === 'fulfilled') {
                        const { total } = parseCommissionList(settled[4].value);
                        setAccruedTotalInScope(total);
                    }
                }
                if (!cancelled && deduped.length) {
                    setLoadError(
                        deduped.length === 1
                            ? deduped[0]
                            : t('err.requestsFailed', {
                                count: deduped.length,
                                details: deduped.join('\n'),
                            }),
                    );
                }
            } catch (e) {
                if (e?.name === 'AbortError') return;
                if (!cancelled) setLoadError(e?.message || t('err.loadCommissions'));
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [selectedBranchId, scopeExtra, filterStatus, filterEmployeeId, page, filterScopeKey, adminMode, workshopId, t]);

    useEffect(() => {
        if (!payoutModalOpen) return undefined;
        const ac = new AbortController();
        let cancelled = false;
        setAccountsLoading(true);
        setPayoutError('');
        (async () => {
            try {
                const base = workshopCommissionsScopeParams(selectedBranchId, scopeExtra);
                const res = await getWorkshopCommissionsPayoutAccounts(base, { signal: ac.signal });
                if (cancelled) return;
                const acc = res?.accounts ?? res?.data?.accounts ?? [];
                setPayoutAccounts(Array.isArray(acc) ? acc : []);
            } catch (e) {
                if (e?.name === 'AbortError') return;
                if (!cancelled) setPayoutError(e?.message || t('err.loadAccounts'));
            } finally {
                if (!cancelled) setAccountsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [payoutModalOpen, selectedBranchId, scopeExtra, t]);

    const selectedCount = selectedLines.size;

    const selectedTotal = useMemo(() => {
        let sum = 0;
        for (const amt of selectedLines.values()) sum += amt;
        return sum;
    }, [selectedLines]);

    const toggleSelect = (row) => {
        if (row.status !== 'accrued') return;
        setSelectedLines((prev) => {
            const next = new Map(prev);
            if (next.has(row.id)) next.delete(row.id);
            else next.set(row.id, row.amount);
            return next;
        });
    };

    const accruedOnPage = commissionRows.filter((c) => c.status === 'accrued');
    const allAccruedInScopeSelected =
        accruedTotalInScope > 0 && selectedCount >= accruedTotalInScope;

    const toggleSelectAllAccrued = async () => {
        if (allAccruedInScopeSelected && selectedCount > 0) {
            setSelectedLines(new Map());
            return;
        }
        setSelectAllLoading(true);
        setLoadError('');
        try {
            const lines = await fetchAllAccruedInScope(
                selectedBranchId,
                scopeExtra,
                filterEmployeeId,
                workshopId,
            );
            setSelectedLines(lines);
        } catch (e) {
            setLoadError(e?.message || t('err.selectAll'));
        } finally {
            setSelectAllLoading(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));

    const confirmPayout = async () => {
        if (!selectedAccountId || selectedCount === 0) return;
        setPayoutError('');
        setPayoutSubmitting(true);
        try {
            await postWorkshopCommissionsPayout({
                commissionLineIds: Array.from(selectedLines.keys()),
                payoutAccountId: selectedAccountId,
                ...(payoutNotes.trim() ? { notes: payoutNotes.trim() } : {}),
                ...(workshopId ? { workshopId } : {}),
            });
            setSelectedLines(new Map());
            setSelectedEmployeePayoutIds(new Set());
            setPayoutModalOpen(false);
            setSelectedAccountId('');
            setPayoutNotes('');
            setIsLoading(true);
            const base = workshopCommissionsScopeParams(selectedBranchId, scopeExtra);
            const listParams = buildListParams(
                selectedBranchId,
                scopeExtra,
                filterStatus,
                filterEmployeeId,
                page,
                workshopId,
            );
            const settled = await Promise.allSettled([
                getWorkshopCommissionsSummary(base),
                getWorkshopCommissionsPendingByEmployee(base),
                getWorkshopCommissionsEmployees(base),
                getWorkshopCommissionsList(listParams),
            ]);
            const refreshErrs = applyCommissionDashboardSettled(settled, {
                setSummary,
                setPendingByEmployee,
                setFilterEmployees,
                setCommissionRows,
                setListTotal,
            }, t);
            if (refreshErrs.length) {
                setLoadError(
                    refreshErrs.length === 1
                        ? refreshErrs[0]
                        : t('err.requestsFailedAfterPayout', {
                            count: refreshErrs.length,
                            details: refreshErrs.join('\n'),
                        }),
                );
            }
        } catch (e) {
            setPayoutError(e?.message || t('err.payoutFailed'));
        } finally {
            setPayoutSubmitting(false);
            setIsLoading(false);
        }
    };

    const renderJobLink = (row) => {
        const label = row.jobCardRef || t('job.view');
        const url = row.jobCardUrl;
        if (!url) {
            return <span className="ws-text-dim">{row.jobCardRef || t('emDash')}</span>;
        }
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return (
                <a href={url} className="ws-link" target="_blank" rel="noopener noreferrer">
                    {label}
                </a>
            );
        }
        return (
            <Link to={url} className="ws-link" title={t('job.viewTitle')}>
                {label}
            </Link>
        );
    };

    const openIndividualPayout = (row) => {
        setSelectedLines(new Map([[row.id, row.amount]]));
        setPayoutModalOpen(true);
    };

    const openEmployeePayout = async (emp) => {
        const empId = String(emp.employee_id ?? emp.employeeId ?? '');
        if (!empId) return;
        setEmployeePayoutLoadingId(empId);
        setLoadError('');
        try {
            const lines = await fetchAllAccruedInScope(
                selectedBranchId,
                scopeExtra,
                empId,
                workshopId,
            );
            if (lines.size === 0) {
                setLoadError(t('err.noAccruedEmployee'));
                return;
            }
            setSelectedLines(lines);
            setPayoutModalOpen(true);
        } catch (e) {
            setLoadError(e?.message || t('err.loadForPayout'));
        } finally {
            setEmployeePayoutLoadingId('');
        }
    };

    const toggleEmployeePayoutSelect = (empId) => {
        const key = String(empId ?? '').trim();
        if (!key) return;
        setSelectedEmployeePayoutIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const allDisplayedEmployeesSelected =
        displayedPendingEmployees.length > 0 &&
        displayedPendingEmployees.every((emp) =>
            selectedEmployeePayoutIds.has(
                String(emp.employee_id ?? emp.employeeId ?? ''),
            ),
        );

    const toggleSelectAllDisplayedEmployees = () => {
        if (allDisplayedEmployeesSelected) {
            setSelectedEmployeePayoutIds(new Set());
            return;
        }
        setSelectedEmployeePayoutIds(
            new Set(
                displayedPendingEmployees.map((emp) =>
                    String(emp.employee_id ?? emp.employeeId ?? ''),
                ),
            ),
        );
    };

    const openBulkEmployeePayout = async () => {
        if (selectedEmployeePayoutIds.size === 0) return;
        setEmployeePayoutLoadingId('bulk');
        setLoadError('');
        try {
            const merged = new Map();
            for (const empId of selectedEmployeePayoutIds) {
                const lines = await fetchAllAccruedInScope(
                    selectedBranchId,
                    scopeExtra,
                    empId,
                    workshopId,
                );
                for (const [id, amt] of lines.entries()) {
                    merged.set(id, amt);
                }
            }
            if (merged.size === 0) {
                setLoadError(t('err.noAccruedSelected'));
                return;
            }
            setSelectedLines(merged);
            setPayoutModalOpen(true);
        } catch (e) {
            setLoadError(e?.message || t('err.loadBulkPayout'));
        } finally {
            setEmployeePayoutLoadingId('');
        }
    };

    const selectedEmployeePayoutTotal = useMemo(() => {
        let sum = 0;
        for (const emp of displayedPendingEmployees) {
            const key = String(emp.employee_id ?? emp.employeeId ?? '');
            if (!selectedEmployeePayoutIds.has(key)) continue;
            sum += Number(emp.pending_amount ?? emp.pendingAmount ?? 0) || 0;
        }
        return sum;
    }, [displayedPendingEmployees, selectedEmployeePayoutIds]);

    const filterByEmployee = (emp) => {
        const key = String(emp.employee_id ?? emp.employeeId ?? '');
        const name = emp.name ?? emp.employee_name ?? '';
        setFilterEmployeeId((prev) => {
            if (String(prev) === key) {
                setEmployeeFilterText('');
                return '';
            }
            setEmployeeFilterText(name);
            return key;
        });
        setFilterStatus('accrued');
        setActiveTab('commissions');
    };

    const closePayoutScreen = () => {
        if (payoutSubmitting) return;
        setPayoutModalOpen(false);
        setPayoutError('');
    };

    const money = (amount) => t('money.sar', { amount: Number(amount).toLocaleString() });
    const statusLabel = (status) => {
        if (status === 'accrued') return t('status.accrued');
        if (status === 'paid') return t('status.paid');
        return status;
    };

    if (payoutModalOpen) {
        const payoutSubtitle =
            selectedCount === 1
                ? t('payout.subtitleOne', { count: selectedCount, amount: money(selectedTotal) })
                : t('payout.subtitleMany', { count: selectedCount, amount: money(selectedTotal) });
        return (
            <WorkshopSubScreen
                title={t('payout.title')}
                subtitle={payoutSubtitle}
                backLabel={t('payout.back')}
                onBack={closePayoutScreen}
                backDisabled={payoutSubmitting}
                size="form"
                maxWidth="560px"
                footer={(
                    <div className="ws-modal-footer" style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button
                            type="button"
                            className="ws-btn-secondary"
                            disabled={payoutSubmitting}
                            onClick={closePayoutScreen}
                        >
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ws-btn-confirm"
                            onClick={confirmPayout}
                            disabled={!selectedAccountId || payoutSubmitting || accountsLoading}
                        >
                            {t('payout.confirm', { amount: money(selectedTotal) })}
                        </button>
                    </div>
                )}
            >
                <div className="ws-section ws-payout-modal-content" style={{ padding: 20 }}>
                    {payoutError && (
                        <div className="ws-alert-banner" style={{ marginBottom: 12 }}>
                            <AlertCircle size={18} className="text-orange" />
                            <p style={{ margin: 0 }}>{payoutError}</p>
                        </div>
                    )}
                    <div className="ws-summary-box">
                        <div className="ws-summary-line">
                            <span className="ws-text-dim">{t('payout.commissionsSelected')}</span>
                            <span className="ws-font-bold">{selectedCount}</span>
                        </div>
                        <div className="ws-summary-line">
                            <span className="ws-text-dim">{t('payout.totalAmount')}</span>
                            <h4 className="text-green">{money(selectedTotal)}</h4>
                        </div>
                    </div>

                    <div className="ws-form-group">
                        <label className="ws-form-label">{t('payout.selectAccount')}</label>
                        <select
                            className="ws-form-select"
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            disabled={accountsLoading}
                        >
                            <option value="">{accountsLoading ? t('payout.loading') : t('payout.chooseAccount')}</option>
                            {payoutAccounts.map((a) => {
                                const id = a.id != null ? String(a.id) : '';
                                const label = a.label ?? a.name ?? id;
                                return (
                                    <option key={id} value={id}>
                                        {label}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="ws-form-group">
                        <label className="ws-form-label">{t('payout.notes')}</label>
                        <textarea
                            className="ws-form-select"
                            style={{ minHeight: 72, resize: 'vertical' }}
                            value={payoutNotes}
                            onChange={(e) => setPayoutNotes(e.target.value)}
                            placeholder={t('payout.notesPlaceholder')}
                            rows={3}
                        />
                    </div>

                    <div className="ws-alert-banner">
                        <AlertCircle size={18} className="text-orange" />
                        <p style={{ margin: 0 }}>
                            {t('payout.journalHint')}
                        </p>
                    </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    return (
        <div className="ws-commissions">
            <div
                style={{
                    display: 'flex',
                    gap: 16,
                    borderBottom: '1px solid #e5e7eb',
                    marginBottom: 14,
                    paddingBottom: 0,
                }}
            >
                {visibleCommissionTabs.map((tab) => {
                    const active = activeTab === tab.key;
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
                                padding: '8px 0',
                                cursor: 'pointer',
                                borderBottom: active ? '3px solid #D4A017' : '3px solid transparent',
                            }}
                        >
                            {t(tab.labelKey)}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'rules' ? (
                <WorkshopCommissionRules locale={locale} />
            ) : (
            <>
            <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {t('scope.prefix')} <strong>{branchLabel}</strong>
            </p>

            {loadError && (
                <div className="ws-alert-banner" style={{ marginBottom: 12 }}>
                    <AlertCircle size={18} className="text-orange" />
                    <p style={{ margin: 0 }}>{loadError}</p>
                </div>
            )}

            <div className="ws-commissions-stats">
                <div className="ws-stat-card border-orange">
                    <p className="ws-stat-label">{t('stat.totalAccrued')}</p>
                    <h3 className="ws-stat-value text-orange">{money(summary.totalAccrued)}</h3>
                </div>
                <div className="ws-stat-card border-green">
                    <p className="ws-stat-label">{t('stat.totalPaid')}</p>
                    <h3 className="ws-stat-value text-green">{money(summary.totalPaid)}</h3>
                </div>
                <div className="ws-stat-card border-blue">
                    <p className="ws-stat-label">{t('stat.pendingEmployees')}</p>
                    <h3 className="ws-stat-value text-blue">{summary.pendingEmployeeCount}</h3>
                </div>
                <div className="ws-stat-card border-purple">
                    <p className="ws-stat-label">{t('stat.selectedForPayout')}</p>
                    <h3 className="ws-stat-value text-purple">{money(selectedTotal)}</h3>
                </div>
            </div>

            {activeTab === 'payouts' ? (
            <div className="ws-commissions-section">
                <header
                    className="ws-section-header"
                    style={{
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Users size={18} className="text-blue" />
                        <h4>{t('section.pendingByEmployee')}</h4>
                    </div>
                    {selectedEmployeePayoutIds.size > 0 ? (
                        <button
                            type="button"
                            className="ws-btn-payout active"
                            disabled={employeePayoutLoadingId === 'bulk'}
                            onClick={openBulkEmployeePayout}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                            <Wallet size={16} />
                            {employeePayoutLoadingId === 'bulk'
                                ? t('btn.loading')
                                : t('btn.payoutSelected', {
                                    count: selectedEmployeePayoutIds.size,
                                    amount: money(selectedEmployeePayoutTotal),
                                })}
                        </button>
                    ) : null}
                </header>
                <div className="ws-commissions-table-wrapper ws-employee-summary-table">
                    <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>
                                        <input
                                            type="checkbox"
                                            checked={allDisplayedEmployeesSelected}
                                            ref={(el) => {
                                                if (el) {
                                                    el.indeterminate =
                                                        selectedEmployeePayoutIds.size > 0 &&
                                                        !allDisplayedEmployeesSelected;
                                                }
                                            }}
                                            onChange={toggleSelectAllDisplayedEmployees}
                                            disabled={displayedPendingEmployees.length === 0}
                                            aria-label={t('aria.selectAllEmployees')}
                                        />
                                    </th>
                                    <th>{t('th.employee')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.entries')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('th.totalAmount')}</th>
                                    <th style={{ width: 120, textAlign: 'right' }}>{t('th.action')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && displayedPendingEmployees.length === 0 ? (
                                    <ShimmerTableBodyRows rows={4} columns={5} />
                                ) : displayedPendingEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="ws-text-dim" style={{ padding: 20, textAlign: 'center' }}>
                                            {filterEmployeeId
                                                ? t('empty.pendingFiltered')
                                                : t('empty.pending')}
                                        </td>
                                    </tr>
                                ) : (
                                    displayedPendingEmployees.map((emp) => {
                                        const name = emp.name ?? emp.employee_name ?? '';
                                        const key = String(emp.employee_id ?? emp.employeeId ?? name);
                                        const initials = emp.initials || initialsFromName(name);
                                        const entryCount = emp.entry_count ?? emp.entryCount ?? 0;
                                        const amount =
                                            Number(emp.pending_amount ?? emp.pendingAmount ?? 0) || 0;
                                        const avatarUrl = emp.avatar_url ?? emp.avatarUrl;
                                        const { color, textColor } = chipColorsForKey(key);
                                        const isActive = String(filterEmployeeId) === key;
                                        const payoutLoading = employeePayoutLoadingId === key;
                                        const bulkSelected = selectedEmployeePayoutIds.has(key);
                                        return (
                                            <tr
                                                key={key}
                                                className={isActive || bulkSelected ? 'selected' : ''}
                                            >
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={bulkSelected}
                                                        onChange={() => toggleEmployeePayoutSelect(key)}
                                                        disabled={amount <= 0}
                                                        aria-label={t('aria.selectEmployee', { name })}
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="ws-employee-summary-name"
                                                        onClick={() => filterByEmployee(emp)}
                                                        title={t('title.filterEmployee')}
                                                    >
                                                        <div
                                                            className="ws-table-avatar"
                                                            style={{
                                                                backgroundColor: color,
                                                                color: textColor,
                                                                overflow: 'hidden',
                                                            }}
                                                        >
                                                            {avatarUrl ? (
                                                                <img
                                                                    src={avatarUrl}
                                                                    alt=""
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'cover',
                                                                    }}
                                                                />
                                                            ) : (
                                                                initials
                                                            )}
                                                        </div>
                                                        <span>{name}</span>
                                                    </button>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <span className="ws-text-dim">{entryCount}</span>
                                                </td>
                                                <td style={{ textAlign: 'right' }} className="ws-font-bold">
                                                    {money(amount)}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEmployeePayout(emp)}
                                                        disabled={
                                                            payoutLoading ||
                                                            employeePayoutLoadingId === 'bulk' ||
                                                            amount <= 0
                                                        }
                                                        style={{
                                                            border: '1px solid #16a34a',
                                                            background: '#fff',
                                                            color: '#16a34a',
                                                            borderRadius: 6,
                                                            padding: '6px 12px',
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            cursor:
                                                                payoutLoading || amount <= 0
                                                                    ? 'not-allowed'
                                                                    : 'pointer',
                                                            opacity:
                                                                payoutLoading || amount <= 0 ? 0.55 : 1,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                        }}
                                                    >
                                                        <Wallet size={12} />
                                                        {payoutLoading ? t('btn.loading') : t('btn.payout')}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </WsTableScroll>
                </div>
            </div>
            ) : (
            <>
            <div className="ws-commissions-filters">
                <div className="ws-filter-group">
                    <select
                        className="ws-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">{t('filter.allStatus')}</option>
                        <option value="accrued">{t('filter.accrued')}</option>
                        <option value="paid">{t('filter.paid')}</option>
                    </select>
                    <SearchableEntityCombobox
                        className="ws-filter-combobox"
                        options={employeeComboboxOptions}
                        value={filterEmployeeId}
                        displayText={employeeFilterText}
                        entityLabel={t('filter.employeeLabel')}
                        placeholder={t('filter.employeePlaceholder')}
                        emptyHint={t('filter.employeeEmpty')}
                        onDisplayTextChange={(text) => {
                            setEmployeeFilterText(text);
                            if (!text.trim()) {
                                setFilterEmployeeId('');
                            }
                        }}
                        onSelect={(opt) => {
                            setFilterEmployeeId(String(opt.id));
                            setEmployeeFilterText(opt.label || '');
                        }}
                    />
                    <div className="ws-datetime-range" aria-label={t('filter.dateTimeRange')}>
                        <span className="ws-datetime-range-label">{t('filter.dateTime')}</span>
                        <div className="ws-date-picker ws-datetime-picker">
                            <input
                                type="datetime-local"
                                value={startDateTime}
                                onChange={(e) => setStartDateTime(e.target.value)}
                                aria-label={t('filter.from')}
                            />
                            <Calendar size={14} />
                        </div>
                        <span className="ws-datetime-range-sep">{t('filter.toSep')}</span>
                        <div className="ws-date-picker ws-datetime-picker">
                            <input
                                type="datetime-local"
                                value={endDateTime}
                                onChange={(e) => setEndDateTime(e.target.value)}
                                aria-label={t('filter.to')}
                            />
                            <Calendar size={14} />
                        </div>
                    </div>
                </div>
                <div className="ws-filter-actions">
                    {selectedCount > 0 && (
                        <button type="button" className="ws-btn-clear" onClick={() => setSelectedLines(new Map())}>
                            {t('btn.clear', { count: selectedCount })}
                        </button>
                    )}
                    <button
                        type="button"
                        className={`ws-btn-payout ${selectedCount > 0 ? 'active' : ''}`}
                        disabled={selectAllLoading}
                        onClick={() =>
                            selectedCount > 0 ? setPayoutModalOpen(true) : toggleSelectAllAccrued()
                        }
                    >
                        {selectAllLoading ? (
                            t('btn.selecting')
                        ) : selectedCount > 0 ? (
                            <>
                                <Wallet size={16} /> {t('btn.processPayout', { amount: money(selectedTotal) })}
                            </>
                        ) : accruedTotalInScope > 0 ? (
                            t('btn.selectAllAccruedCount', { count: accruedTotalInScope })
                        ) : (
                            t('btn.selectAllAccrued')
                        )}
                    </button>
                </div>
            </div>

            <div className="ws-commissions-table-wrapper">
                <WsTableScroll>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>
                                <input
                                    type="checkbox"
                                    checked={allAccruedInScopeSelected}
                                    ref={(el) => {
                                        if (el) {
                                            el.indeterminate =
                                                selectedCount > 0 && !allAccruedInScopeSelected;
                                        }
                                    }}
                                    onChange={toggleSelectAllAccrued}
                                    disabled={accruedOnPage.length === 0 || selectAllLoading}
                                />
                            </th>
                            <th>{t('th.employee')}</th>
                            <th>{t('th.service')}</th>
                            <th>{t('th.jobCard')}</th>
                            <th>{t('th.date')}</th>
                            <th>{t('th.rate')}</th>
                            <th>{t('th.amount')}</th>
                            <th>{t('th.status')}</th>
                            <th>{t('th.action')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && commissionRows.length === 0 ? (
                            <ShimmerTableBodyRows rows={6} columns={9} />
                        ) : commissionRows.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="ws-text-dim" style={{ padding: 24, textAlign: 'center' }}>
                                    {t('empty.lines')}
                                </td>
                            </tr>
                        ) : (
                            commissionRows.map((c) => (
                                <tr key={c.id} className={selectedLines.has(c.id) ? 'selected' : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedLines.has(c.id)}
                                            onChange={() => toggleSelect(c)}
                                            disabled={c.status !== 'accrued'}
                                        />
                                    </td>
                                    <td>
                                        <div className="ws-table-emp">
                                            <div className="ws-table-avatar">{c.initials}</div>
                                            <span>{c.employee}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="ws-text-dim">{c.service}</span>
                                    </td>
                                    <td>{renderJobLink(c)}</td>
                                    <td>
                                        <span className="ws-text-dim">{c.date}</span>
                                    </td>
                                    <td>
                                        <span className="ws-text-dim">{c.rate ?? t('emDash')}</span>
                                    </td>
                                    <td className="ws-font-bold">{money(c.amount)}</td>
                                    <td>
                                        <span
                                            className={`ws-badge ${
                                                c.status === 'accrued'
                                                    ? 'bg-orange-light text-orange'
                                                    : 'bg-green-light text-green'
                                            }`}
                                        >
                                            {c.status === 'accrued' ? <Clock size={12} /> : <CheckCircle size={12} />}
                                            {statusLabel(c.status)}
                                        </span>
                                    </td>
                                    <td>
                                        {c.status === 'accrued' ? (
                                            <button
                                                type="button"
                                                onClick={() => openIndividualPayout(c)}
                                                style={{
                                                    border: '1px solid #16a34a',
                                                    background: '#fff',
                                                    color: '#16a34a',
                                                    borderRadius: 6,
                                                    padding: '4px 10px',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                            >
                                                <Wallet size={12} /> {t('btn.pay')}
                                            </button>
                                        ) : (
                                            <span className="ws-text-dim" style={{ fontSize: 12 }}>{t('emDash')}</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
            </div>

            {listTotal > PAGE_SIZE && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 12,
                        marginTop: 12,
                    }}
                >
                    <span className="ws-text-dim" style={{ fontSize: '0.8125rem' }}>
                        {t('page.info', { page, totalPages, total: listTotal })}
                    </span>
                    <button
                        type="button"
                        className="ws-btn-secondary"
                        disabled={page <= 1 || isLoading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        {t('btn.previous')}
                    </button>
                    <button
                        type="button"
                        className="ws-btn-secondary"
                        disabled={page >= totalPages || isLoading}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        {t('btn.next')}
                    </button>
                </div>
            )}

            </>
            )}

            </>
            )}
        </div>
    );
}
