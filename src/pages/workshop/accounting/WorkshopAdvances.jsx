import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
    ArrowLeftRight,
    BookOpen,
    Calendar,
    ChevronDown,
    Clock,
    DollarSign,
    FileDown,
    Plus,
    Search,
    Users,
    Wallet,
    X,
    RefreshCw,
    Building2,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../../components/Modal';
import {
    bulkCreateWorkshopAdvances,
    createWorkshopAdvance,
    getWorkshopAdvancesList,
    getWorkshopAdvancesOverview,
    getWorkshopAdvancesStats,
} from '../../../services/advancesApi';
import { listCashBankAccounts } from '../../../services/workshopAccountingApi';
import {
    getWorkshopEmployees,
    indexWorkshopStaffBySelectValue,
    parseWorkshopStaffSelectValue,
    unwrapWorkshopEmployeesList,
    workshopStaffSelectValue,
} from '../../../services/workshopStaffApi';
import { accT } from '../../../utils/accountingI18n';
import WorkshopSalaryTab from './WorkshopSalaryTab';
import WorkshopEmployeeLedgerTab from './WorkshopEmployeeLedgerTab';
import { exportAdvancesExcel, exportAdvancesPdf } from './workshopAdvancesExport';
import '../../../styles/admin/AccountingPage.css';

const fmt = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0.00';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const ADV_TABS = [
    { id: 'By Employee', labelKey: 'adv.tab.byEmployee' },
    { id: 'Advances', labelKey: 'adv.tab.advances' },
    { id: 'Salary', labelKey: 'adv.tab.salary' },
    { id: 'Employee Ledger', labelKey: 'adv.tab.employeeLedger' },
];

const ADV_FILTERS = [
    { id: 'All', labelKey: 'adv.filter.all' },
    { id: 'Pending', labelKey: 'adv.filter.pending' },
    { id: 'Approved', labelKey: 'adv.filter.approved' },
    { id: 'Repaid', labelKey: 'adv.filter.repaid' },
    { id: 'Rejected', labelKey: 'adv.filter.rejected' },
];

const makeAdvanceRow = () => ({
    id: Date.now() + Math.random(),
    employeeSelectKey: '',
    employeeRecordId: '',
    recordType: 'employee',
    userId: '',
    employeeName: '',
    amount: '',
    date: todayIso(),
    payFromAccountId: '',
    reason: '',
});

const ADV_TAB_IDS = new Set(ADV_TABS.map((tab) => tab.id));

export default function WorkshopAdvances({
    branches = [],
    selectedBranchId = 'all',
    locale: localeProp,
    initialTab: initialTabProp,
}) {
    const outletCtx = useOutletContext() || {};
    const [searchParams] = useSearchParams();
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    const statusLabel = useCallback((status) => {
        const s = String(status || '').toLowerCase();
        if (s === 'pending' || s === 'approved' || s === 'repaid' || s === 'rejected') {
            return t(`adv.status.${s}`);
        }
        return status || '—';
    }, [t]);

    const initialTab = (() => {
        if (initialTabProp && ADV_TAB_IDS.has(initialTabProp)) return initialTabProp;
        const fromQuery = String(searchParams.get('tab') || '').trim();
        if (ADV_TAB_IDS.has(fromQuery)) return fromQuery;
        return 'By Employee';
    })();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [filter, setFilter] = useState('All');
    const [branchFilter, setBranchFilter] = useState(
        selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : '',
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const [payAdvanceOpen, setPayAdvanceOpen] = useState(false);
    const [bulkAdvanceOpen, setBulkAdvanceOpen] = useState(false);

    const [stats, setStats] = useState({
        totalAdvancesPaid: 0,
        outstandingBalance: 0,
        pendingCount: 0,
        controlAccount: null,
    });
    const [overview, setOverview] = useState({ employees: [], branches: [] });
    const [advances, setAdvances] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [cashBankAccounts, setCashBankAccounts] = useState([]);

    const [advanceForm, setAdvanceForm] = useState({
        employeeSelectKey: '',
        employeeRecordId: '',
        recordType: 'employee',
        userId: '',
        employeeName: '',
        amount: '',
        date: todayIso(),
        payFromAccountId: '',
        reason: '',
    });
    const [bulkAdvanceRows, setBulkAdvanceRows] = useState([makeAdvanceRow()]);
    const [submitting, setSubmitting] = useState(false);

    const branchParams = useMemo(
        () => (branchFilter ? { branchId: branchFilter } : {}),
        [branchFilter],
    );

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
            const [s, ov, adv, emps, cb] = await Promise.all([
                getWorkshopAdvancesStats(branchParams),
                getWorkshopAdvancesOverview({ ...branchParams, search: search.trim() || undefined }),
                getWorkshopAdvancesList({ ...branchParams, ...(filter !== 'All' ? { status: filter.toLowerCase() } : {}) }),
                getWorkshopEmployees({ ...branchParams, limit: 200 }).catch(() => ({ employees: [] })),
                listCashBankAccounts(branchParams).catch(() => ({ accounts: [] })),
            ]);
            setStats(s || { totalAdvancesPaid: 0, outstandingBalance: 0, pendingCount: 0, controlAccount: null });
            setOverview(ov || { employees: [], branches: [] });
            setAdvances(Array.isArray(adv) ? adv : []);
            const empItems = unwrapWorkshopEmployeesList(emps);
            const ovById = Object.fromEntries((ov?.employees ?? []).map((e) => [String(e.employeeId), e]));
            setEmployees(
                empItems.map((e) => ({
                    ...e,
                    userId: ovById[String(e.id)]?.userId ?? e.userId ?? null,
                    canReceiveAdvance: ovById[String(e.id)]?.canReceiveAdvance ?? Boolean(e.userId),
                })),
            );
            setCashBankAccounts(cb?.accounts ?? cb?.items ?? []);
        } catch (e) {
            setError(e?.message || t('adv.err.load'));
        } finally {
            setLoading(false);
        }
    }, [branchParams, filter, search, t]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (selectedBranchId && selectedBranchId !== 'all') {
            setBranchFilter(String(selectedBranchId));
        }
    }, [selectedBranchId]);

    const filteredAdvances = useMemo(() => {
        const q = search.trim().toLowerCase();
        return advances.filter((a) => {
            const searchMatch =
                !q ||
                (a.employeeName || '').toLowerCase().includes(q) ||
                (a.branchName || '').toLowerCase().includes(q) ||
                (a.reason || '').toLowerCase().includes(q);
            return searchMatch;
        });
    }, [advances, search]);

    const advancesBranchName = useMemo(() => {
        if (!branchFilter) return 'All branches';
        const b = branches.find((x) => String(x.id) === String(branchFilter));
        return b?.name || 'All branches';
    }, [branchFilter, branches]);

    const advancesStatusLabel = useMemo(() => {
        const map = {
            All: 'All / الكل',
            Pending: 'Pending / قيد الانتظار',
            Approved: 'Approved / موافق عليه',
            Repaid: 'Settled / مسدد',
            Rejected: 'Rejected / مرفوض',
        };
        return map[filter] || 'All / الكل';
    }, [filter]);

    const exportAdvances = async (kind) => {
        if (!filteredAdvances.length) return;
        setError('');
        try {
            const payload = {
                rows: filteredAdvances,
                branchName: advancesBranchName,
                statusLabel: advancesStatusLabel,
                search,
            };
            if (kind === 'pdf') await exportAdvancesPdf(payload);
            else exportAdvancesExcel(payload);
        } catch (e) {
            setError(e?.message || (kind === 'pdf' ? 'Could not export advances PDF.' : 'Could not export advances Excel.'));
        }
    };

    const filteredOverviewBranches = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return overview.branches ?? [];
        return (overview.branches ?? [])
            .map((b) => ({
                ...b,
                employees: (b.employees ?? []).filter(
                    (e) =>
                        (e.name || '').toLowerCase().includes(q) ||
                        (b.branchName || '').toLowerCase().includes(q) ||
                        (e.employeeType || '').toLowerCase().includes(q),
                ),
            }))
            .filter((b) => b.employees.length > 0);
    }, [overview.branches, search]);

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
                employeeName: advanceForm.employeeName,
                amount: Number(advanceForm.amount || 0),
                date: advanceForm.date,
                payFromAccountId: advanceForm.payFromAccountId,
                reason: advanceForm.reason || undefined,
            });
            setPayAdvanceOpen(false);
            setAdvanceForm({
                employeeSelectKey: '',
                employeeRecordId: '',
                recordType: 'employee',
                userId: '',
                employeeName: '',
                amount: '',
                date: todayIso(),
                payFromAccountId: '',
                reason: '',
            });
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
                employeeName: r.employeeName || t('adv.defaultEmployee'),
                amount: Number(r.amount || 0),
                date: r.date,
                payFromAccountId: r.payFromAccountId,
                reason: r.reason || undefined,
            }));
        if (!rows.length) return;
        setSubmitting(true);
        setError('');
        try {
            await bulkCreateWorkshopAdvances({ rows });
            setBulkAdvanceOpen(false);
            setBulkAdvanceRows([makeAdvanceRow()]);
            await refresh();
        } catch (e) {
            setError(e?.message || t('adv.err.bulk'));
        } finally {
            setSubmitting(false);
        }
    };

    const controlAccount = stats.controlAccount;
    const controlCode = controlAccount?.code ?? '1250';

    return (
        <div className="advances-view">
            <header className="advances-header">
                <div className="adv-header-left">
                    <h2 className="adv-title">{t('adv.title')}</h2>
                    <p className="adv-desc">
                        {t('adv.descPrefix')}{' '}
                        <strong>{controlCode} {t('adv.controlName')}</strong>
                        {t('adv.descSuffix') ? ` ${t('adv.descSuffix')}` : ''}
                    </p>
                </div>
                <div className="adv-header-actions">
                    <button type="button" className="btn-adv-action btn-bulk-advances" onClick={() => setBulkAdvanceOpen(true)}>
                        <Users size={16} /> {t('adv.bulk')}
                    </button>
                    <button type="button" className="btn-adv-action btn-pay-advance btn-primary-adv" onClick={() => setPayAdvanceOpen(true)}>
                        <Plus size={16} /> {t('adv.pay')}
                    </button>
                    <button type="button" className="btn-portal-outline" onClick={refresh} disabled={loading}>
                        <RefreshCw size={14} style={{ marginRight: 6 }} /> {t('btn.refresh')}
                    </button>
                </div>
            </header>

            {controlAccount ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '14px 18px',
                        marginBottom: 16,
                        background: '#F0F9FF',
                        border: '1px solid #BAE6FD',
                        borderRadius: 12,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <BookOpen size={20} color="#0284C7" />
                        <div>
                            <div style={{ fontWeight: 700, color: '#0C4A6E' }}>
                                {controlAccount.code} — {controlAccount.name}
                                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: '#0369A1', background: '#E0F2FE', padding: '2px 8px', borderRadius: 999 }}>
                                    {t('adv.systemControl')}
                                </span>
                            </div>
                            <div style={{ fontSize: 13, color: '#64748B' }}>
                                {t('adv.controlPath')}
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{t('adv.controlBalance')}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#0C4A6E' }}>SAR {fmt(controlAccount.balance)}</div>
                        <Link to="/workshop/accounting/chart-of-accounts" style={{ fontSize: 12, color: '#0284C7' }}>
                            {t('adv.viewCoa')}
                        </Link>
                    </div>
                </div>
            ) : null}

            <div className="advances-stats">
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-blue"><Wallet size={20} /></div>
                    <div className="adv-stat-info">
                        <span className="adv-stat-label">{t('adv.stat.totalPaid')}</span>
                        <span className="adv-stat-value">SAR {fmt(stats.totalAdvancesPaid)}</span>
                    </div>
                </div>
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-red"><DollarSign size={20} /></div>
                    <div className="adv-stat-info">
                        <span className="adv-stat-label">{t('adv.stat.outstanding')}</span>
                        <span className="adv-stat-value text-red">SAR {fmt(stats.outstandingBalance)}</span>
                    </div>
                </div>
                <div className="adv-stat-card">
                    <div className="adv-stat-icon-wrapper icon-orange"><Clock size={20} /></div>
                    <div className="adv-stat-info">
                        <span className="adv-stat-label">{t('adv.stat.pending')}</span>
                        <span className="adv-stat-value">{stats.pendingCount || 0}</span>
                    </div>
                </div>
            </div>

            <div className="adv-tabs-row">
                <div className="adv-pills">
                    {ADV_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`adv-pill ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="adv-filters-bar">
                <div className="adv-search-wrapper">
                    <Search className="search-icon" size={16} />
                    <input
                        type="text"
                        placeholder={t('adv.searchPh')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {branches.length > 0 ? (
                    <div className="ps-select-wrapper" style={{ minWidth: 180 }}>
                        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                            <option value="">{t('adv.allBranches')}</option>
                            {branches.map((b) => (
                                <option key={String(b.id)} value={String(b.id)}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="ps-select-icon" />
                    </div>
                ) : null}
                {activeTab === 'Advances' ? (
                    <>
                        <div className="adv-status-filters">
                            {ADV_FILTERS.map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    className={`adv-status-btn ${filter === f.id ? 'active' : ''}`}
                                    onClick={() => setFilter(f.id)}
                                >
                                    {t(f.labelKey)}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={loading || filteredAdvances.length === 0}
                                onClick={() => exportAdvances('pdf')}
                            >
                                <FileDown size={14} style={{ marginRight: 6 }} />
                                PDF
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={loading || filteredAdvances.length === 0}
                                onClick={() => exportAdvances('excel')}
                            >
                                <FileDown size={14} style={{ marginRight: 6 }} />
                                Excel
                            </button>
                        </div>
                    </>
                ) : null}
            </div>

            {error ? (
                <div style={{ padding: 12, marginBottom: 12, color: '#B45309', background: '#FFFBEB', borderRadius: 8 }}>
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t('loading')}</div>
            ) : activeTab === 'Salary' ? (
                <WorkshopSalaryTab branchFilter={branchFilter} branches={branches} />
            ) : activeTab === 'Employee Ledger' ? (
                <WorkshopEmployeeLedgerTab
                    employees={employees}
                    employeeByRecordId={employeeByRecordId}
                    branchFilter={branchFilter}
                />
            ) : activeTab === 'By Employee' ? (
                <section className="premium-table advances-table">
                    {filteredOverviewBranches.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>{t('adv.noEmployees')}</div>
                    ) : (
                        filteredOverviewBranches.map((branch) => (
                            <div key={branch.branchId || branch.branchName} style={{ marginBottom: 24 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '10px 14px',
                                        background: '#F8FAFC',
                                        borderRadius: '12px 12px 0 0',
                                        border: '1px solid #E2E8F0',
                                        borderBottom: 'none',
                                        fontWeight: 700,
                                        color: '#334155',
                                    }}
                                >
                                    <Building2 size={16} />
                                    {branch.branchName}
                                    <span style={{ fontWeight: 500, color: '#64748B', fontSize: 13 }}>
                                        {branch.employees.length === 1
                                            ? t('adv.employeeCount', { n: branch.employees.length })
                                            : t('adv.employeeCountPlural', { n: branch.employees.length })}
                                    </span>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #E2E8F0', borderRadius: '0 0 12px 12px' }}>
                                    <thead>
                                        <tr className="table-header-row">
                                            <th className="table-th">{t('adv.th.employee')}</th>
                                            <th className="table-th">{t('adv.th.type')}</th>
                                            <th className="table-th">{t('adv.th.advances')}</th>
                                            <th className="table-th">{t('adv.th.totalPaid')}</th>
                                            <th className="table-th">{t('adv.th.outstanding')}</th>
                                            <th className="table-th">{t('adv.th.latest')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {branch.employees.map((e) => (
                                            <tr key={e.employeeId} className="table-row">
                                                <td className="table-cell" style={{ fontWeight: 700 }}>{e.name || '—'}</td>
                                                <td className="table-cell">{e.employeeType || '—'}</td>
                                                <td className="table-cell">{e.advanceCount}</td>
                                                <td className="table-cell">SAR {fmt(e.totalPaid)}</td>
                                                <td className="table-cell" style={{ color: e.outstanding > 0 ? '#DC2626' : '#64748B', fontWeight: e.outstanding > 0 ? 700 : 400 }}>
                                                    SAR {fmt(e.outstanding)}
                                                </td>
                                                <td className="table-cell">{e.latestAdvanceDate || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                    )}
                </section>
            ) : (
                <section className="premium-table advances-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th">{t('adv.th.date')}</th>
                                <th className="table-th">{t('adv.th.branch')}</th>
                                <th className="table-th">{t('adv.th.employee')}</th>
                                <th className="table-th">{t('adv.th.reason')}</th>
                                <th className="table-th">{t('adv.th.paidFrom')}</th>
                                <th className="table-th">{t('adv.th.amount')}</th>
                                <th className="table-th">{t('adv.th.repaid')}</th>
                                <th className="table-th">{t('adv.th.balance')}</th>
                                <th className="table-th">{t('adv.th.status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAdvances.length === 0 ? (
                                <tr><td colSpan={9} className="table-cell table-empty">{t('adv.noAdvances')}</td></tr>
                            ) : (
                                filteredAdvances.map((a) => (
                                    <tr key={a.id} className="table-row">
                                        <td className="table-cell">{new Date(a.date).toLocaleDateString()}</td>
                                        <td className="table-cell">{a.branchName || '—'}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>{a.employeeName}</td>
                                        <td className="table-cell">{a.reason || '—'}</td>
                                        <td className="table-cell">{a.payFromAccountName || (a.payFromAccountId ? '—' : t('adv.pettyCash'))}</td>
                                        <td className="table-cell" style={{ fontWeight: 700 }}>SAR {fmt(a.amount)}</td>
                                        <td className="table-cell">SAR {fmt(a.repaidAmount)}</td>
                                        <td className="table-cell">SAR {fmt(a.balance)}</td>
                                        <td className="table-cell">
                                            <span className={`status-badge ${(a.status || '').toLowerCase() === 'approved' ? 'approved' : 'pending'}`}>
                                                {statusLabel(a.status)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </section>
            )}

            <AnimatePresence>
                {payAdvanceOpen && (
                    <Modal
                        title={<div className="ps-modal-title"><ArrowLeftRight className="ps-title-icon" size={18} /><span>{t('adv.modal.payTitle')}</span></div>}
                        onClose={() => setPayAdvanceOpen(false)}
                        width="500px"
                        contentClassName="modal-content-advance"
                        footer={
                            <div className="ps-modal-footer">
                                <button type="button" className="btn-ps-cancel" onClick={() => setPayAdvanceOpen(false)}>{t('adv.modal.cancel')}</button>
                                <button type="button" className="btn-ps-pay" disabled={submitting} onClick={submitAdvance}>
                                    {t('adv.modal.payPost', { code: controlCode })}
                                </button>
                            </div>
                        }
                    >
                        <div className="ps-form">
                            <div className="ps-field">
                                <label>{t('adv.field.employee')}</label>
                                <div className="ps-select-wrapper">
                                    <select
                                        value={advanceForm.employeeSelectKey}
                                        onChange={(e) => {
                                            const picked = pickEmployee(e.target.value);
                                            setAdvanceForm((p) => ({ ...p, ...picked }));
                                        }}
                                    >
                                        <option value="">{t('adv.field.selectEmployee')}</option>
                                        {payableEmployees.map((e) => {
                                            const selectKey = workshopStaffSelectValue(e);
                                            return (
                                            <option key={selectKey} value={selectKey} disabled={!e.userId && !e.canReceiveAdvance}>
                                                {e.name}{e.branch?.name ? ` (${e.branch.name})` : ''}
                                            </option>
                                            );
                                        })}
                                    </select>
                                    <ChevronDown size={16} className="ps-select-icon" />
                                </div>
                            </div>
                            <div className="ps-row">
                                <div className="ps-field">
                                    <label>{t('adv.field.amount')}</label>
                                    <input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" />
                                </div>
                                <div className="ps-field">
                                    <label>{t('adv.field.date')}</label>
                                    <div className="ps-date-input">
                                        <input type="date" value={advanceForm.date} onChange={(e) => setAdvanceForm((p) => ({ ...p, date: e.target.value }))} />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                            </div>
                            <div className="ps-field">
                                <label>{t('adv.field.payFrom')}</label>
                                <div className="ps-select-wrapper">
                                    <select value={advanceForm.payFromAccountId} onChange={(e) => setAdvanceForm((p) => ({ ...p, payFromAccountId: e.target.value }))}>
                                        <option value="">{t('adv.field.selectAccount')}</option>
                                        {cashBankAccounts.map((a) => (
                                            <option key={String(a.id)} value={String(a.id)}>{a.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="ps-select-icon" />
                                </div>
                            </div>
                            <div className="ps-field">
                                <label>{t('adv.field.reason')}</label>
                                <textarea value={advanceForm.reason} onChange={(e) => setAdvanceForm((p) => ({ ...p, reason: e.target.value }))} placeholder={t('adv.field.reasonPh')} rows={3} />
                            </div>
                            <p className="form-help-text" style={{ fontSize: 12, color: '#64748B' }}>
                                {t('adv.help.post', { code: controlCode })}
                            </p>
                        </div>
                    </Modal>
                )}

                {bulkAdvanceOpen && (
                    <Modal
                        title={<div className="ps-modal-title"><Users className="ps-title-icon" size={18} /><span>{t('adv.modal.bulkTitle')}</span></div>}
                        onClose={() => setBulkAdvanceOpen(false)}
                        width="1100px"
                        contentClassName="modal-content-bulk"
                        footer={
                            <div className="ps-modal-footer">
                                <button type="button" className="btn-ps-cancel" onClick={() => setBulkAdvanceOpen(false)}>{t('adv.modal.cancel')}</button>
                                <button type="button" className="btn-ps-pay btn-gold" disabled={submitting} onClick={submitBulkAdvances}>
                                    {t('adv.modal.payN', { n: bulkAdvanceRows.length })}
                                </button>
                            </div>
                        }
                    >
                        <div className="bulk-form">
                            <div className="bulk-table-header">
                                <div className="bulk-col-emp">{t('adv.bulk.employee')}</div>
                                <div className="bulk-col-amt">{t('adv.bulk.amount')}</div>
                                <div className="bulk-col-date">{t('adv.bulk.date')}</div>
                                <div className="bulk-col-from">{t('adv.bulk.payFrom')}</div>
                                <div className="bulk-col-reason">{t('adv.bulk.reason')}</div>
                                <div className="bulk-col-actions" />
                            </div>
                            <div className="bulk-table-rows">
                                {bulkAdvanceRows.map((row, idx) => (
                                    <div className="bulk-row" key={row.id}>
                                        <div className="ps-select-wrapper bulk-col-emp">
                                            <select
                                                value={row.employeeSelectKey}
                                                onChange={(e) => {
                                                    const picked = pickEmployee(e.target.value);
                                                    const x = [...bulkAdvanceRows];
                                                    x[idx] = { ...x[idx], ...picked };
                                                    setBulkAdvanceRows(x);
                                                }}
                                            >
                                                <option value="">{t('adv.field.select')}</option>
                                                {payableEmployees.map((e) => {
                                                    const selectKey = workshopStaffSelectValue(e);
                                                    return (
                                                    <option key={selectKey} value={selectKey} disabled={!e.userId && !e.canReceiveAdvance}>
                                                        {e.name}
                                                    </option>
                                                    );
                                                })}
                                            </select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <div className="bulk-col-amt">
                                            <input type="number" value={row.amount} onChange={(e) => { const x = [...bulkAdvanceRows]; x[idx].amount = e.target.value; setBulkAdvanceRows(x); }} placeholder="0.00" />
                                        </div>
                                        <div className="bulk-col-date">
                                            <div className="ps-date-input">
                                                <input type="date" value={row.date} onChange={(e) => { const x = [...bulkAdvanceRows]; x[idx].date = e.target.value; setBulkAdvanceRows(x); }} />
                                                <Calendar size={14} />
                                            </div>
                                        </div>
                                        <div className="ps-select-wrapper bulk-col-from">
                                            <select value={row.payFromAccountId} onChange={(e) => { const x = [...bulkAdvanceRows]; x[idx].payFromAccountId = e.target.value; setBulkAdvanceRows(x); }}>
                                                <option value="">{t('adv.field.select')}</option>
                                                {cashBankAccounts.map((a) => (
                                                    <option key={String(a.id)} value={String(a.id)}>{a.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={14} className="ps-select-icon" />
                                        </div>
                                        <div className="bulk-col-reason">
                                            <input type="text" value={row.reason} onChange={(e) => { const x = [...bulkAdvanceRows]; x[idx].reason = e.target.value; setBulkAdvanceRows(x); }} placeholder={t('adv.field.reasonShortPh')} />
                                        </div>
                                        <div className="bulk-col-actions">
                                            <button type="button" className="btn-row-remove" onClick={() => setBulkAdvanceRows(bulkAdvanceRows.length > 1 ? bulkAdvanceRows.filter((r) => r.id !== row.id) : bulkAdvanceRows)}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="btn-add-row" onClick={() => setBulkAdvanceRows([...bulkAdvanceRows, makeAdvanceRow()])}>
                                <Plus size={14} /> {t('adv.bulk.addRow')}
                            </button>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
