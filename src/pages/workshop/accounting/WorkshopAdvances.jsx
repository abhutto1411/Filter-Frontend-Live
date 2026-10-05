import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import {
    BookOpen,
    ChevronDown,
    Clock,
    DollarSign,
    FileDown,
    Plus,
    Users,
    Wallet,
    RefreshCw,
    Building2,
} from 'lucide-react';
import {
    bulkCreateWorkshopAdvances,
    createWorkshopAdvance,
    getWorkshopAdvancesList,
    getWorkshopAdvancesOverview,
    getWorkshopAdvancesStats,
} from '../../../services/advancesApi';
import { listCashBankAccounts } from '../../../services/workshopAccountingApi';
import {
    getAllWorkshopEmployees,
    indexWorkshopStaffBySelectValue,
    parseWorkshopStaffSelectValue,
    unwrapWorkshopEmployeesList,
    workshopStaffSelectValue,
} from '../../../services/workshopStaffApi';
import { accT } from '../../../utils/accountingI18n';
import WsSearchSuggest from '../../../components/workshop/WsSearchSuggest';
import WsTablePagination from '../../../components/workshop/WsTablePagination';
import usePagedSearch, { WS_PAGE_SIZES } from '../../../components/workshop/usePagedSearch';
import WorkshopSalaryTab from './WorkshopSalaryTab';
import WorkshopEmployeeLedgerTab from './WorkshopEmployeeLedgerTab';
import { AdvanceBulkPage, AdvancePayPage } from './WorkshopAdvancePayPages';
import { exportAdvancesExcel, exportAdvancesPdf } from './workshopAdvancesExport';
import '../../../styles/admin/AccountingPage.css';
import './WorkshopAdvancePayPages.css';

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
    recordType: '',
    userId: '',
    employeeName: '',
    amount: '',
    date: todayIso(),
    payFromAccountId: '',
    reason: '',
});

const ADV_TAB_IDS = new Set(ADV_TABS.map((tab) => tab.id));

const ADV_VIEWS = new Set(['pay', 'bulk']);

const emptyAdvanceForm = () => ({
    employeeSelectKey: '',
    employeeRecordId: '',
    recordType: '',
    userId: '',
    employeeName: '',
    amount: '',
    date: todayIso(),
    payFromAccountId: '',
    reason: '',
});

const overviewRowKey = (e) => `${e._branchKey}:${e.staffKey || e.employeeId}`;
const overviewRowName = (e) => e.name || '';
const overviewRowHay = (e) => [e.name, e.employeeType, e._branchName].filter(Boolean).join(' ');

const advanceRowKey = (a) => String(a.id);
const advanceRowName = (a) => a.employeeName || '';
const advanceRowHay = (a) =>
    [
        a.employeeName,
        a.branchName,
        a.reason,
        a.payFromAccountName,
        a.status,
        a.date ? String(a.date).slice(0, 10) : '',
        a.amount != null ? String(a.amount) : '',
    ]
        .filter(Boolean)
        .join(' ');

export default function WorkshopAdvances({
    branches = [],
    selectedBranchId = 'all',
    locale: localeProp,
    initialTab: initialTabProp,
}) {
    const outletCtx = useOutletContext() || {};
    const [searchParams, setSearchParams] = useSearchParams();
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);

    const statusLabel = useCallback((status) => {
        const s = String(status || '').toLowerCase();
        if (s === 'settled') return t('adv.status.repaid');
        if (s === 'pending' || s === 'approved' || s === 'repaid' || s === 'rejected' || s === 'partial') {
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

    const viewParam = String(searchParams.get('view') || '');
    const view = ADV_VIEWS.has(viewParam) ? viewParam : 'list';

    const openView = useCallback(
        (next) => {
            setError('');
            setSearchParams(
                (prev) => {
                    const p = new URLSearchParams(prev);
                    if (next === 'list') p.delete('view');
                    else p.set('view', next);
                    return p;
                },
                { replace: false },
            );
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        [setSearchParams],
    );

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

    const [advanceForm, setAdvanceForm] = useState(emptyAdvanceForm);
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
                getWorkshopAdvancesOverview(branchParams),
                getWorkshopAdvancesList({ ...branchParams, ...(filter !== 'All' ? { status: filter.toLowerCase() } : {}) }),
                getAllWorkshopEmployees(branchParams).catch(() => ({ employees: [] })),
                listCashBankAccounts(branchParams).catch(() => ({ accounts: [] })),
            ]);
            setStats(s || { totalAdvancesPaid: 0, outstandingBalance: 0, pendingCount: 0, controlAccount: null });
            setOverview(ov || { employees: [], branches: [] });
            setAdvances(Array.isArray(adv) ? adv : []);
            const empItems = unwrapWorkshopEmployeesList(emps).filter((e) => !e.transferPlaceholder);
            // Staff ids repeat across employees / cashiers / users: match on type + id only.
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
        } catch (e) {
            setError(e?.message || t('adv.err.load'));
        } finally {
            setLoading(false);
        }
    }, [branchParams, filter, t]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (selectedBranchId && selectedBranchId !== 'all') {
            setBranchFilter(String(selectedBranchId));
        }
    }, [selectedBranchId]);

    const overviewRows = useMemo(
        () =>
            (overview.branches ?? []).flatMap((b) =>
                (b.employees ?? []).map((e) => ({
                    ...e,
                    _branchKey: String(b.branchId ?? b.branchName ?? ''),
                    _branchName: b.branchName,
                })),
            ),
        [overview.branches],
    );

    const empPager = usePagedSearch({
        rows: overviewRows,
        getKey: overviewRowKey,
        getName: overviewRowName,
        getHay: overviewRowHay,
        resetKey: branchFilter,
        rankByName: false,
    });

    const advPager = usePagedSearch({
        rows: advances,
        getKey: advanceRowKey,
        getName: advanceRowName,
        getHay: advanceRowHay,
        resetKey: `${branchFilter}|${filter}`,
    });

    const filteredAdvances = advPager.visible;

    const empBranchTotals = useMemo(() => {
        const m = {};
        empPager.visible.forEach((e) => {
            m[e._branchKey] = (m[e._branchKey] || 0) + 1;
        });
        return m;
    }, [empPager.visible]);

    const empPageGroups = useMemo(() => {
        const groups = [];
        empPager.paged.forEach((e) => {
            let g = groups[groups.length - 1];
            if (!g || g.key !== e._branchKey) {
                g = { key: e._branchKey, name: e._branchName, rows: [] };
                groups.push(g);
            }
            g.rows.push(e);
        });
        return groups;
    }, [empPager.paged]);

    const tableTopRef = useRef(null);
    const pagerLabels = useMemo(
        () => ({
            prev: t('adv.pager.prev'),
            next: t('adv.pager.next'),
            rowsPerPage: t('adv.pager.rowsPerPage'),
            showing: (from, to, total) => t('adv.pager.showing', { from, to, total }),
            page: (n) => t('adv.pager.page', { n }),
        }),
        [t],
    );
    const goToPage = (pager) => (p) => {
        pager.setPage(p);
        tableTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const searchCountText = useCallback(
        (shown, n) => (n > shown ? t('adv.search.shownOf', { shown, n }) : t('adv.search.matches', { n })),
        [t],
    );

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
                search: advPager.query,
            };
            if (kind === 'pdf') await exportAdvancesPdf(payload);
            else exportAdvancesExcel(payload);
        } catch (e) {
            setError(e?.message || (kind === 'pdf' ? 'Could not export advances PDF.' : 'Could not export advances Excel.'));
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

    const controlAccount = stats.controlAccount;
    const controlCode = controlAccount?.code ?? '1250';

    if (view !== 'list') {
        if (loading && employees.length === 0) {
            return <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t('loading')}</div>;
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
        return view === 'pay' ? (
            <AdvancePayPage {...shared} form={advanceForm} setForm={setAdvanceForm} onSubmit={submitAdvance} />
        ) : (
            <AdvanceBulkPage
                {...shared}
                rows={bulkAdvanceRows}
                setRows={setBulkAdvanceRows}
                makeRow={makeAdvanceRow}
                onSubmit={submitBulkAdvances}
            />
        );
    }

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
                    <button type="button" className="btn-adv-action btn-bulk-advances" onClick={() => openView('bulk')}>
                        <Users size={16} /> {t('adv.bulk')}
                    </button>
                    <button type="button" className="btn-adv-action btn-pay-advance btn-primary-adv" onClick={() => openView('pay')}>
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
                {activeTab === 'By Employee' || activeTab === 'Advances' ? (
                    <div style={{ flex: '1 1 300px', maxWidth: 440 }}>
                        {activeTab === 'By Employee' ? (
                            <WsSearchSuggest
                                key="emp-search"
                                value={empPager.query}
                                onChange={empPager.setQuery}
                                matches={empPager.suggestions}
                                picked={empPager.picked}
                                getKey={overviewRowKey}
                                getLabel={overviewRowName}
                                getMeta={(e) =>
                                    [e.employeeType, e._branchName, `${t('adv.th.outstanding')}: SAR ${fmt(e.outstanding)}`]
                                        .filter(Boolean)
                                        .join(' · ')
                                }
                                onPick={empPager.pick}
                                onClear={empPager.clear}
                                placeholder={t('adv.search.empPh')}
                                emptyText={t('adv.search.noMatch')}
                                hint={t('adv.pick.hint')}
                                countText={searchCountText}
                            />
                        ) : (
                            <WsSearchSuggest
                                key="adv-search"
                                value={advPager.query}
                                onChange={advPager.setQuery}
                                matches={advPager.suggestions}
                                picked={advPager.picked}
                                getKey={advanceRowKey}
                                getLabel={advanceRowName}
                                getMeta={(a) =>
                                    [
                                        a.date ? new Date(a.date).toLocaleDateString() : '',
                                        `SAR ${fmt(a.amount)}`,
                                        a.branchName,
                                        a.reason,
                                        statusLabel(a.status),
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')
                                }
                                onPick={advPager.pick}
                                onClear={advPager.clear}
                                placeholder={t('adv.search.advPh')}
                                emptyText={t('adv.search.noMatch')}
                                hint={t('adv.pick.hint')}
                                countText={searchCountText}
                            />
                        )}
                    </div>
                ) : null}
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
                <>
                    {empPager.query.trim() ? (
                        <p className="adv-search-count">
                            {t('adv.search.resultCount', {
                                n: empPager.total,
                                total: overviewRows.length,
                                q: empPager.query.trim(),
                            })}
                        </p>
                    ) : null}
                    <section ref={tableTopRef} className="premium-table advances-table">
                        {empPager.total === 0 ? (
                            <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>
                                {empPager.query.trim() ? t('adv.noMatchSearch') : t('adv.noEmployees')}
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                                {empPageGroups.map((group) => {
                                    const n = empBranchTotals[group.key] || group.rows.length;
                                    return (
                                        <tbody key={group.key}>
                                            <tr>
                                                <td colSpan={6} style={{ padding: 0 }}>
                                                    <div className="adv-branch-head">
                                                        <Building2 size={16} />
                                                        {group.name}
                                                        <span>
                                                            {n === 1
                                                                ? t('adv.employeeCount', { n })
                                                                : t('adv.employeeCountPlural', { n })}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {group.rows.map((e) => (
                                                <tr key={overviewRowKey(e)} className="table-row">
                                                    <td className="table-cell" style={{ fontWeight: 700 }}>{e.name || '—'}</td>
                                                    <td className="table-cell">{e.employeeType || '—'}</td>
                                                    <td className="table-cell">{e.advanceCount}</td>
                                                    <td className="table-cell">SAR {fmt(e.totalPaid)}</td>
                                                    <td
                                                        className="table-cell"
                                                        style={{
                                                            color: e.outstanding > 0 ? '#DC2626' : '#64748B',
                                                            fontWeight: e.outstanding > 0 ? 700 : 400,
                                                        }}
                                                    >
                                                        SAR {fmt(e.outstanding)}
                                                    </td>
                                                    <td className="table-cell">{e.latestAdvanceDate || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    );
                                })}
                            </table>
                        )}
                        {empPager.total > 0 ? (
                            <WsTablePagination
                                page={empPager.page}
                                pageCount={empPager.pageCount}
                                pageSize={empPager.pageSize}
                                pageSizes={WS_PAGE_SIZES}
                                total={empPager.total}
                                onPageChange={goToPage(empPager)}
                                onPageSizeChange={empPager.setPageSize}
                                labels={pagerLabels}
                            />
                        ) : null}
                    </section>
                </>
            ) : (
                <>
                    {advPager.query.trim() ? (
                        <p className="adv-search-count">
                            {t('adv.search.resultCount', {
                                n: advPager.total,
                                total: advances.length,
                                q: advPager.query.trim(),
                            })}
                        </p>
                    ) : null}
                    <section ref={tableTopRef} className="premium-table advances-table">
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
                                {advPager.total === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="table-cell table-empty">
                                            {advPager.query.trim() ? t('adv.noMatchSearch') : t('adv.noAdvances')}
                                        </td>
                                    </tr>
                                ) : (
                                    advPager.paged.map((a) => (
                                        <tr key={a.id} className="table-row">
                                            <td className="table-cell">{new Date(a.date).toLocaleDateString()}</td>
                                            <td className="table-cell">{a.branchName || '—'}</td>
                                            <td className="table-cell" style={{ fontWeight: 700 }}>{a.employeeName}</td>
                                            <td className="table-cell">{a.reason || '—'}</td>
                                            <td className="table-cell">
                                                {a.payFromAccountName || (a.payFromAccountId ? '—' : t('adv.pettyCash'))}
                                            </td>
                                            <td className="table-cell" style={{ fontWeight: 700 }}>SAR {fmt(a.amount)}</td>
                                            <td className="table-cell">SAR {fmt(a.repaidAmount)}</td>
                                            <td className="table-cell">SAR {fmt(a.balance)}</td>
                                            <td className="table-cell">
                                                <span
                                                    className={`status-badge ${
                                                        ['approved', 'partial', 'settled', 'repaid'].includes((a.status || '').toLowerCase())
                                                            ? 'approved'
                                                            : 'pending'
                                                    }`}
                                                >
                                                    {statusLabel(a.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {advPager.total > 0 ? (
                            <WsTablePagination
                                page={advPager.page}
                                pageCount={advPager.pageCount}
                                pageSize={advPager.pageSize}
                                pageSizes={WS_PAGE_SIZES}
                                total={advPager.total}
                                onPageChange={goToPage(advPager)}
                                onPageSizeChange={advPager.setPageSize}
                                labels={pagerLabels}
                            />
                        ) : null}
                    </section>
                </>
            )}
        </div>
    );
}
