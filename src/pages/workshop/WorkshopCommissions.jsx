import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle, Users, Wallet, Calendar, AlertCircle } from 'lucide-react';
import Modal from '../../components/Modal';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import WorkshopCommissionRules from '../../components/commissions/WorkshopCommissionRules';
import { useAuth } from '../../context/AuthContext';

const COMMISSIONS_TABS = [
    { key: 'ledger', label: 'Ledger', permission: 'workshop.commissions.ledger.view' },
    { key: 'rules',  label: 'Rules',  permission: 'workshop.commissions.rules.view' },
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

const PAGE_SIZE = 20;

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
        rate: rateNum != null && !Number.isNaN(Number(rateNum)) ? `${Number(rateNum)}%` : '—',
        amount: Number(raw?.amount) || 0,
        status: String(raw?.status || '').toLowerCase(),
        jobCardRef: raw?.job_card_ref ?? raw?.jobCardRef ?? '',
        jobCardUrl: raw?.job_card_url ?? raw?.jobCardUrl ?? '',
        avatarUrl: raw?.avatar_url ?? raw?.avatarUrl ?? null,
    };
}

/** settled order: summary, pending-by-employee, employees, list */
function applyCommissionDashboardSettled(settled, setters) {
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
        errMsgs.push(sumRes.reason?.message || 'Summary failed');
    }
    if (pendRes.status === 'fulfilled') {
        const pendEmps = pendRes.value?.employees ?? pendRes.value?.data?.employees ?? [];
        setPendingByEmployee(Array.isArray(pendEmps) ? pendEmps : []);
    } else if (pendRes.reason?.name !== 'AbortError') {
        errMsgs.push(pendRes.reason?.message || 'Pending-by-employee failed');
    }
    if (empRes.status === 'fulfilled') {
        const emps = empRes.value?.employees ?? empRes.value?.data?.employees ?? [];
        setFilterEmployees(Array.isArray(emps) ? emps : []);
    } else if (empRes.reason?.name !== 'AbortError') {
        errMsgs.push(empRes.reason?.message || 'Employees filter failed');
    }
    if (listRes.status === 'fulfilled') {
        const { items, total } = parseCommissionList(listRes.value);
        setCommissionRows(items.map(mapCommissionRow));
        setListTotal(total);
    } else if (listRes.reason?.name !== 'AbortError') {
        errMsgs.push(listRes.reason?.message || 'Commission list failed');
    }

    return [...new Set(errMsgs)];
}

export default function WorkshopCommissions({ selectedBranchId = 'all', branches = [] }) {
    const { hasPermission } = useAuth();
    const visibleCommissionTabs = COMMISSIONS_TABS.filter((t) => hasPermission(t.permission));
    const [activeTab, setActiveTab] = useState(() => visibleCommissionTabs[0]?.key ?? 'ledger');
    useEffect(() => {
        if (visibleCommissionTabs.length === 0) return;
        if (!visibleCommissionTabs.some((t) => t.key === activeTab)) {
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
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [payoutModalOpen, setPayoutModalOpen] = useState(false);
    const [payoutAccounts, setPayoutAccounts] = useState([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [payoutNotes, setPayoutNotes] = useState('');
    const [payoutError, setPayoutError] = useState('');
    const [payoutSubmitting, setPayoutSubmitting] = useState(false);

    const filterScopeKeyRef = useRef('');

    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);

    const dateScope = useMemo(() => {
        const o = {};
        if (startDate) o.startDate = startDate;
        if (endDate) o.endDate = endDate;
        return o;
    }, [startDate, endDate]);

    useEffect(() => {
        const ac = new AbortController();
        const opt = { signal: ac.signal };
        let cancelled = false;

        const scopeKey = [selectedBranchId, startDate, endDate, filterStatus, filterEmployeeId].join('\u0001');
        const scopeChanged = filterScopeKeyRef.current !== scopeKey;

        if (scopeChanged && page !== 1) {
            filterScopeKeyRef.current = scopeKey;
            setPage(1);
            return () => ac.abort();
        }

        filterScopeKeyRef.current = scopeKey;

        setLoadError('');
        setIsLoading(true);
        (async () => {
            try {
                const base = workshopCommissionsScopeParams(selectedBranchId, dateScope);
                const listParams = {
                    ...base,
                    ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
                    ...(filterEmployeeId ? { employeeId: String(filterEmployeeId) } : {}),
                    limit: PAGE_SIZE,
                    offset: (page - 1) * PAGE_SIZE,
                };

                const settled = await Promise.allSettled([
                    getWorkshopCommissionsSummary(base, opt),
                    getWorkshopCommissionsPendingByEmployee(base, opt),
                    getWorkshopCommissionsEmployees(base, opt),
                    getWorkshopCommissionsList(listParams, opt),
                ]);

                if (cancelled) return;

                const deduped = applyCommissionDashboardSettled(settled, {
                    setSummary,
                    setPendingByEmployee,
                    setFilterEmployees,
                    setCommissionRows,
                    setListTotal,
                });
                if (!cancelled && deduped.length) {
                    setLoadError(
                        deduped.length === 1
                            ? deduped[0]
                            : `${deduped.length} requests failed:\n${deduped.join('\n')}`,
                    );
                }
            } catch (e) {
                if (e?.name === 'AbortError') return;
                if (!cancelled) setLoadError(e?.message || 'Failed to load commissions');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [selectedBranchId, dateScope, filterStatus, filterEmployeeId, page]);

    useEffect(() => {
        if (!payoutModalOpen) return undefined;
        const ac = new AbortController();
        let cancelled = false;
        setAccountsLoading(true);
        setPayoutError('');
        (async () => {
            try {
                const base = workshopCommissionsScopeParams(selectedBranchId, dateScope);
                const res = await getWorkshopCommissionsPayoutAccounts(base, { signal: ac.signal });
                if (cancelled) return;
                const acc = res?.accounts ?? res?.data?.accounts ?? [];
                setPayoutAccounts(Array.isArray(acc) ? acc : []);
            } catch (e) {
                if (e?.name === 'AbortError') return;
                if (!cancelled) setPayoutError(e?.message || 'Could not load payout accounts');
            } finally {
                if (!cancelled) setAccountsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
            ac.abort();
        };
    }, [payoutModalOpen, selectedBranchId, dateScope]);

    const selectedTotal = useMemo(() => {
        let sum = 0;
        for (const row of commissionRows) {
            if (selectedIds.has(row.id)) sum += row.amount;
        }
        return sum;
    }, [commissionRows, selectedIds]);

    const toggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            const sid = String(id);
            if (next.has(sid)) next.delete(sid);
            else next.add(sid);
            return next;
        });
    };

    const accruedOnPage = commissionRows.filter((c) => c.status === 'accrued');
    const allAccruedOnPageSelected =
        accruedOnPage.length > 0 && accruedOnPage.every((c) => selectedIds.has(c.id));

    const toggleSelectAllAccruedOnPage = () => {
        const accruedIds = accruedOnPage.map((c) => c.id);
        const allSelected = accruedIds.length > 0 && accruedIds.every((id) => selectedIds.has(id));
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(accruedIds));
    };

    const totalPages = Math.max(1, Math.ceil(listTotal / PAGE_SIZE));

    const confirmPayout = async () => {
        if (!selectedAccountId || selectedIds.size === 0) return;
        setPayoutError('');
        setPayoutSubmitting(true);
        try {
            await postWorkshopCommissionsPayout({
                commissionLineIds: Array.from(selectedIds),
                payoutAccountId: selectedAccountId,
                ...(payoutNotes.trim() ? { notes: payoutNotes.trim() } : {}),
            });
            setSelectedIds(new Set());
            setPayoutModalOpen(false);
            setSelectedAccountId('');
            setPayoutNotes('');
            setIsLoading(true);
            const base = workshopCommissionsScopeParams(selectedBranchId, dateScope);
            const listParams = {
                ...base,
                ...(filterStatus !== 'all' ? { status: filterStatus } : {}),
                ...(filterEmployeeId ? { employeeId: String(filterEmployeeId) } : {}),
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE,
            };
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
            });
            if (refreshErrs.length) {
                setLoadError(
                    refreshErrs.length === 1
                        ? refreshErrs[0]
                        : `${refreshErrs.length} requests failed after payout:\n${refreshErrs.join('\n')}`,
                );
            }
        } catch (e) {
            setPayoutError(e?.message || 'Payout failed');
        } finally {
            setPayoutSubmitting(false);
            setIsLoading(false);
        }
    };

    const renderJobLink = (row) => {
        const label = row.jobCardRef || 'View';
        const url = row.jobCardUrl;
        if (!url) {
            return <span className="ws-text-dim">{row.jobCardRef || '—'}</span>;
        }
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return (
                <a href={url} className="ws-link" target="_blank" rel="noopener noreferrer">
                    {label}
                </a>
            );
        }
        return (
            <Link to={url} className="ws-link">
                {label}
            </Link>
        );
    };

    const openIndividualPayout = (row) => {
        setSelectedIds(new Set([row.id]));
        setPayoutModalOpen(true);
    };

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
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'rules' ? (
                <WorkshopCommissionRules />
            ) : (
            <>
            <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Scope · <strong>{branchLabel}</strong>
            </p>

            {loadError && (
                <div className="ws-alert-banner" style={{ marginBottom: 12 }}>
                    <AlertCircle size={18} className="text-orange" />
                    <p style={{ margin: 0 }}>{loadError}</p>
                </div>
            )}

            <div className="ws-commissions-stats">
                <div className="ws-stat-card border-orange">
                    <p className="ws-stat-label">Total Accrued</p>
                    <h3 className="ws-stat-value text-orange">SAR {summary.totalAccrued.toLocaleString()}</h3>
                </div>
                <div className="ws-stat-card border-green">
                    <p className="ws-stat-label">Total Paid</p>
                    <h3 className="ws-stat-value text-green">SAR {summary.totalPaid.toLocaleString()}</h3>
                </div>
                <div className="ws-stat-card border-blue">
                    <p className="ws-stat-label">Pending Employees</p>
                    <h3 className="ws-stat-value text-blue">{summary.pendingEmployeeCount}</h3>
                </div>
                <div className="ws-stat-card border-purple">
                    <p className="ws-stat-label">Selected for Payout</p>
                    <h3 className="ws-stat-value text-purple">SAR {selectedTotal.toLocaleString()}</h3>
                </div>
            </div>

            <div className="ws-commissions-section">
                <header className="ws-section-header">
                    <Users size={18} className="text-blue" />
                    <h4>Pending Payout by Employee</h4>
                </header>
                <div className="ws-employee-chips">
                    {pendingByEmployee.length === 0 && !isLoading && (
                        <p className="ws-text-dim" style={{ margin: '8px 0', fontSize: '0.875rem' }}>
                            No pending accrued commissions in this scope.
                        </p>
                    )}
                    {pendingByEmployee.map((emp) => {
                        const name = emp.name ?? emp.employee_name ?? '';
                        const key = emp.employee_id ?? emp.employeeId ?? name;
                        const initials = emp.initials || initialsFromName(name);
                        const entryCount = emp.entry_count ?? emp.entryCount ?? 0;
                        const amount = Number(emp.pending_amount ?? emp.pendingAmount ?? 0) || 0;
                        const avatarUrl = emp.avatar_url ?? emp.avatarUrl;
                        const { color, textColor } = chipColorsForKey(String(key));
                        const isActive = String(filterEmployeeId) === String(key);
                        return (
                            <div
                                key={String(key)}
                                className="ws-emp-chip"
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                    setFilterEmployeeId((prev) =>
                                        String(prev) === String(key) ? '' : String(key),
                                    );
                                    setFilterStatus('accrued');
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setFilterEmployeeId((prev) =>
                                            String(prev) === String(key) ? '' : String(key),
                                        );
                                        setFilterStatus('accrued');
                                    }
                                }}
                                style={{
                                    cursor: 'pointer',
                                    outline: isActive ? '2px solid #D4A017' : 'none',
                                    outlineOffset: 2,
                                }}
                            >
                                <div
                                    className="ws-emp-avatar"
                                    style={{
                                        backgroundColor: color,
                                        color: textColor,
                                        overflow: 'hidden',
                                        padding: 0,
                                    }}
                                >
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        initials
                                    )}
                                </div>
                                <div className="ws-emp-details">
                                    <p className="ws-emp-name">{name}</p>
                                    <p className="ws-emp-summary">
                                        {entryCount} entries · SAR {amount.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="ws-commissions-filters">
                <div className="ws-filter-group">
                    <select
                        className="ws-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="accrued">Accrued</option>
                        <option value="paid">Paid</option>
                    </select>
                    <select
                        className="ws-select"
                        value={filterEmployeeId}
                        onChange={(e) => setFilterEmployeeId(e.target.value)}
                    >
                        <option value="">All Employees</option>
                        {filterEmployees.map((e) => {
                            const id = e.employee_id ?? e.employeeId;
                            const nm = e.name ?? '';
                            const lc = e.line_count ?? e.lineCount;
                            return (
                                <option key={String(id)} value={String(id)}>
                                    {nm}
                                    {lc != null ? ` (${lc})` : ''}
                                </option>
                            );
                        })}
                    </select>
                    <div className="ws-date-picker">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            aria-label="Start date"
                        />
                        <Calendar size={14} />
                    </div>
                    <div className="ws-date-picker">
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            aria-label="End date"
                        />
                        <Calendar size={14} />
                    </div>
                </div>
                <div className="ws-filter-actions">
                    {selectedIds.size > 0 && (
                        <button type="button" className="ws-btn-clear" onClick={() => setSelectedIds(new Set())}>
                            Clear ({selectedIds.size})
                        </button>
                    )}
                    <button
                        type="button"
                        className={`ws-btn-payout ${selectedIds.size > 0 ? 'active' : ''}`}
                        onClick={() =>
                            selectedIds.size > 0 ? setPayoutModalOpen(true) : toggleSelectAllAccruedOnPage()
                        }
                    >
                        {selectedIds.size > 0 ? (
                            <>
                                <Wallet size={16} /> Process Payout · SAR {selectedTotal.toLocaleString()}
                            </>
                        ) : (
                            'Select All Accrued'
                        )}
                    </button>
                </div>
            </div>

            <div className="ws-commissions-table-wrapper">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>
                                <input
                                    type="checkbox"
                                    checked={allAccruedOnPageSelected}
                                    onChange={toggleSelectAllAccruedOnPage}
                                    disabled={accruedOnPage.length === 0}
                                />
                            </th>
                            <th>EMPLOYEE</th>
                            <th>SERVICE</th>
                            <th>JOB CARD</th>
                            <th>DATE</th>
                            <th>RATE</th>
                            <th>AMOUNT</th>
                            <th>STATUS</th>
                            <th>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && commissionRows.length === 0 ? (
                            <ShimmerTableBodyRows rows={6} columns={9} />
                        ) : commissionRows.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="ws-text-dim" style={{ padding: 24, textAlign: 'center' }}>
                                    No commission lines match these filters.
                                </td>
                            </tr>
                        ) : (
                            commissionRows.map((c) => (
                                <tr key={c.id} className={selectedIds.has(c.id) ? 'selected' : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(c.id)}
                                            onChange={() => c.status === 'accrued' && toggleSelect(c.id)}
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
                                        <span className="ws-text-dim">{c.rate}</span>
                                    </td>
                                    <td className="ws-font-bold">SAR {c.amount.toLocaleString()}</td>
                                    <td>
                                        <span
                                            className={`ws-badge ${
                                                c.status === 'accrued'
                                                    ? 'bg-orange-light text-orange'
                                                    : 'bg-green-light text-green'
                                            }`}
                                        >
                                            {c.status === 'accrued' ? <Clock size={12} /> : <CheckCircle size={12} />}
                                            {c.status}
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
                                                <Wallet size={12} /> Pay
                                            </button>
                                        ) : (
                                            <span className="ws-text-dim" style={{ fontSize: 12 }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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
                        Page {page} of {totalPages} ({listTotal} lines)
                    </span>
                    <button
                        type="button"
                        className="ws-btn-secondary"
                        disabled={page <= 1 || isLoading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        Previous
                    </button>
                    <button
                        type="button"
                        className="ws-btn-secondary"
                        disabled={page >= totalPages || isLoading}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </button>
                </div>
            )}

            {payoutModalOpen && (
                <Modal
                    title={
                        <div className="ws-modal-title">
                            <div className="ws-modal-icon bg-green-light text-green">
                                <Wallet size={20} />
                            </div>
                            <span>Process Commission Payout</span>
                        </div>
                    }
                    onClose={() => !payoutSubmitting && setPayoutModalOpen(false)}
                    footer={
                        <div className="ws-modal-footer">
                            <button
                                type="button"
                                className="ws-btn-secondary"
                                disabled={payoutSubmitting}
                                onClick={() => setPayoutModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="ws-btn-confirm"
                                onClick={confirmPayout}
                                disabled={!selectedAccountId || payoutSubmitting || accountsLoading}
                            >
                                Confirm Payout · SAR {selectedTotal.toLocaleString()}
                            </button>
                        </div>
                    }
                >
                    <div className="ws-payout-modal-content">
                        {payoutError && (
                            <div className="ws-alert-banner" style={{ marginBottom: 12 }}>
                                <AlertCircle size={18} className="text-orange" />
                                <p style={{ margin: 0 }}>{payoutError}</p>
                            </div>
                        )}
                        <div className="ws-summary-box">
                            <div className="ws-summary-line">
                                <span className="ws-text-dim">Commissions selected</span>
                                <span className="ws-font-bold">{selectedIds.size}</span>
                            </div>
                            <div className="ws-summary-line">
                                <span className="ws-text-dim">Total payout amount</span>
                                <h4 className="text-green">SAR {selectedTotal.toLocaleString()}</h4>
                            </div>
                        </div>

                        <div className="ws-form-group">
                            <label className="ws-form-label">Select Cash / Bank Account</label>
                            <select
                                className="ws-form-select"
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                disabled={accountsLoading}
                            >
                                <option value="">{accountsLoading ? 'Loading…' : 'Choose account…'}</option>
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
                            <label className="ws-form-label">Notes (optional)</label>
                            <textarea
                                className="ws-form-select"
                                style={{ minHeight: 72, resize: 'vertical' }}
                                value={payoutNotes}
                                onChange={(e) => setPayoutNotes(e.target.value)}
                                placeholder="Payout notes"
                                rows={3}
                            />
                        </div>

                        <div className="ws-alert-banner">
                            <AlertCircle size={18} className="text-orange" />
                            <p style={{ margin: 0 }}>
                                Journal entry will be posted: Dr Commission Payable / Cr Cash/Bank
                            </p>
                        </div>
                    </div>
                </Modal>
            )}
            </>
            )}
        </div>
    );
}
