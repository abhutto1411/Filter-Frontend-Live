import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, NavLink, useNavigate, Link, useOutletContext } from 'react-router-dom';
import {
    Building2,
    Store,
    Truck,
    Landmark,
    Download,
    Printer,
    Lock,
    RefreshCw,
    AlertTriangle,
    Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    getWorkshops,
    getSuppliers,
    getPlatformHqInfo,
    ensurePlatformHq,
} from '../../services/superAdminApi';
import * as accountsApi from '../../services/accountsApi';
import * as wsAcc from '../../services/workshopAccountingApi';
import * as logsApi from '../../services/accountingLogsApi';
import * as supMon from '../../services/supplierAccountingMonitorApi';
import WorkshopAccountingPage from '../workshop/WorkshopAccountingPage';
import HqReferralCommissionsPanel from './HqReferralCommissionsPanel';
import WorkshopStaffAccountingTab from './WorkshopStaffAccountingTab';
import WorkshopCOAManager from '../../components/accounting/WorkshopCOAManager';
import WorkshopTransactionsLog from '../workshop/accounting/WorkshopTransactionsLog';
import { AccountingWorkshopScopeProvider } from '../../context/AccountingWorkshopScopeContext';
import {
    SA_ACCOUNTING_SCOPE_KEY,
    HQ_ACCOUNTING_TABS,
    HQ_WORKSHOP_PAGE_TABS,
    HQ_FINANCIAL_REPORT_TABS,
    loadSaAccountingScope,
} from './saAccountingScope';
import {
    buildMonitorLedgerUrl,
    dateParamsForApi,
    loadSaAccountingDateRange,
    saveSaAccountingDateRange,
    startOfMonthISO,
    todayISO,
} from './saAccountingDateRange';
import { buildHqCoaNavigationUrl } from './hqCoaAccountRouting';
import { isMonitorBooksScope, useMonitorAccountIndex } from './useMonitorAccountIndex';
import { accT, ACC_TAB_LABEL_KEYS } from '../../utils/accountingI18n';
import '../../styles/admin/AccountingPage.css';

/* ────────────────────────────────────────────────────────────────────────
 * Super Admin Accounting — cross-workshop / supplier monitor + HQ workshop clone.
 * ──────────────────────────────────────────────────────────────────────── */

const MONITOR_TABS = [
    { path: 'chart-of-accounts', labelKey: 'tab.coa' },
    { path: 'trial-balance', labelKey: 'tab.tb' },
    { path: 'pl', labelKey: 'tab.pl' },
    { path: 'balance-sheet', labelKey: 'tab.bs' },
    { path: 'ledger', labelKey: 'tab.ledger' },
    { path: 'journal-entries', labelKey: 'tab.journal' },
    { path: 'payments', labelKey: 'tab.payments' },
    { path: 'receipts', labelKey: 'tab.receipts' },
    { path: 'activity', labelKey: 'tab.activity' },
    { path: 'workshop-commissions', labelKey: 'tab.workshopCommissions' },
    { path: 'salary-payroll', labelKey: 'tab.salaryPayroll' },
    { path: 'employee-ledger', labelKey: 'tab.employeeLedger' },
];

const fmt = (n) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        Number(n || 0),
    );

const fmtDate = (d) => {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return String(d);
    }
};

function loadScope() {
    return loadSaAccountingScope();
}

function saveScope(scope) {
    try {
        sessionStorage.setItem(SA_ACCOUNTING_SCOPE_KEY, JSON.stringify(scope));
        window.dispatchEvent(new CustomEvent('sa-accounting-scope-changed', { detail: scope }));
    } catch {
        /* ignore */
    }
}

/** Build account-API params for the active scope. Returns null for supplier scope. */
function accountsParamsFor(scope, dateRange, { forBalanceSheet = false, hqBooks = false } = {}) {
    if (scope.type === 'supplier') return null;
    const p = {};
    if (scope.type === 'hq') {
        if (scope.hqWorkshopId) p.workshopId = scope.hqWorkshopId;
        if (hqBooks || scope.type === 'hq') p.hqBooks = 'true';
    } else {
        if (scope.workshopId) p.workshopId = scope.workshopId;
        if (scope.branchId) p.branchId = scope.branchId;
    }
    if (forBalanceSheet) {
        if (dateRange?.dateTo) p.asOf = dateRange.dateTo;
    } else if (dateRange) {
        Object.assign(p, dateParamsForApi(dateRange));
    }
    return p;
}

function supplierParamsFor(scope, dateRange, { forBalanceSheet = false } = {}) {
    const p = { supplierId: scope.supplierId };
    if (forBalanceSheet) {
        if (dateRange?.dateTo) p.asOf = dateRange.dateTo;
    } else if (dateRange) {
        Object.assign(p, dateParamsForApi(dateRange));
    }
    return p;
}

function monitorRowLink(scope, accountIndex, dateRange, row) {
    if (!isMonitorBooksScope(scope)) return { canOpen: false, url: null, account: null };
    const account = accountIndex.resolve(row);
    if (!account?.id) return { canOpen: false, url: null, account: null };
    return {
        canOpen: true,
        account,
        url: buildMonitorLedgerUrl(String(account.id), account, dateRange),
    };
}

function MonitorAccountName({ name, url, canOpen }) {
    if (!canOpen || !url) return name;
    return (
        <Link to={url} className="sa-acc-ledger-link" onClick={(e) => e.stopPropagation()}>
            {name}
        </Link>
    );
}

function downloadCsv(filename, headers, rows) {
    const escape = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.map(escape).join(',')];
    for (const row of rows) lines.push(row.map(escape).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function printElement(node, title) {
    if (!node) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>${title || 'Report'}</title>
        <style>
            body{font-family:Inter,system-ui,sans-serif;padding:32px;color:#111827;}
            h2{margin:0 0 4px;}
            .muted{color:#6b7280;font-size:12px;margin-bottom:20px;}
            table{width:100%;border-collapse:collapse;margin-bottom:18px;}
            th{text-align:left;font-size:11px;text-transform:uppercase;color:#9ca3af;padding:8px;border-bottom:1px solid #e5e7eb;}
            td{padding:8px;font-size:13px;border-bottom:1px solid #f3f4f6;}
            .num{text-align:right;font-variant-numeric:tabular-nums;}
            .tot td{font-weight:800;border-top:2px solid #111827;}
        </style></head><body>${node.innerHTML}
        <script>window.onload=function(){window.print();}</script></body></html>`);
    win.document.close();
}

/* ── Scope selector bar ─────────────────────────────────────────────────── */
function ScopeBar({
    scope,
    setScope,
    workshops,
    suppliers,
    hqWorkshopId,
    loading,
    onRefresh,
    onProvisionHq,
    provisioning,
    t,
}) {
    const branches = useMemo(() => {
        const w = workshops.find((x) => String(x.id) === String(scope.workshopId));
        return w?.branches || [];
    }, [workshops, scope.workshopId]);

    const setType = (type) => {
        setScope((s) => {
            const next = { ...s, type };
            if (type === 'hq') {
                if (hqWorkshopId) {
                    next.hqWorkshopId = String(hqWorkshopId);
                }
                next.workshopId = '';
                next.branchId = '';
            }
            if (type === 'workshop') {
                next.supplierId = '';
            }
            if (type === 'supplier') {
                next.workshopId = '';
                next.branchId = '';
                next.hqWorkshopId = '';
            }
            return next;
        });
    };

    return (
        <div className="sa-acc-scopebar">
            <div className="sa-acc-scope-types">
                <button
                    className={`sa-acc-scope-pill ${scope.type === 'workshop' ? 'active' : ''}`}
                    onClick={() => setType('workshop')}
                >
                    <Building2 size={15} /> {t('scope.workshop')}
                </button>
                <button
                    className={`sa-acc-scope-pill ${scope.type === 'supplier' ? 'active' : ''}`}
                    onClick={() => setType('supplier')}
                >
                    <Truck size={15} /> {t('scope.supplier')}
                </button>
                <button
                    className={`sa-acc-scope-pill ${scope.type === 'hq' ? 'active' : ''}`}
                    onClick={() => setType('hq')}
                >
                    <Landmark size={15} /> {t('scope.hq')}
                </button>
            </div>

            <div className="sa-acc-scope-selects">
                {scope.type === 'workshop' && (
                    <>
                        <select
                            className="sa-acc-select"
                            value={scope.workshopId || ''}
                            onChange={(e) =>
                                setScope((s) => ({ ...s, workshopId: e.target.value, branchId: '' }))
                            }
                        >
                            <option value="">{t('scope.selectWorkshop')}</option>
                            {workshops
                                .filter((w) => !w.isPlatformHq)
                                .map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.name}
                                    </option>
                                ))}
                                            </select>
                        <select
                            className="sa-acc-select"
                            value={scope.branchId || ''}
                            onChange={(e) => setScope((s) => ({ ...s, branchId: e.target.value }))}
                            disabled={!scope.workshopId}
                        >
                            <option value="">{t('scope.allBranches')}</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                                                </select>
                                </>
                            )}

                {scope.type === 'supplier' && (
                    <select
                        className="sa-acc-select"
                        value={scope.supplierId || ''}
                        onChange={(e) => setScope((s) => ({ ...s, supplierId: e.target.value }))}
                    >
                        <option value="">{t('scope.selectSupplier')}</option>
                        {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                    </select>
                )}

                {scope.type === 'hq' && (
                    hqWorkshopId ? (
                        <span className="sa-acc-hq-note">
                            {t('scope.hqNote')}
                        </span>
                    ) : (
                        <button className="sa-acc-btn" onClick={onProvisionHq} disabled={provisioning}>
                            {provisioning ? t('scope.settingUp') : t('scope.setupHq')}
                        </button>
                    )
                )}

                <button className="sa-acc-icon-btn" onClick={onRefresh} title={t('scope.refresh')} disabled={loading}>
                    <RefreshCw size={15} className={loading ? 'spin' : ''} />
                    </button>
            </div>

            <div className="sa-acc-readonly-flag">
                {scope.type === 'hq' && hqWorkshopId ? null : (
                    <span className="sa-acc-readonly-badge">
                        <Lock size={13} /> {t('scope.readonly')}
                    </span>
                )}
            </div>
        </div>
    );
}

/* ── Generic state helpers ──────────────────────────────────────────────── */
function useScopedData(loader, deps, failMsg = 'Failed to load') {
    const [state, setState] = useState({ loading: true, error: '', data: null });
    const reload = useCallback(() => {
        let alive = true;
        setState((s) => ({ ...s, loading: true, error: '' }));
        Promise.resolve()
            .then(loader)
            .then((data) => alive && setState({ loading: false, error: '', data }))
            .catch((e) => alive && setState({ loading: false, error: e?.message || failMsg, data: null }));
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    useEffect(() => reload(), [reload]);
    return { ...state, reload };
}

function ScopeEmpty({ scope, t }) {
    const need =
        scope.type === 'supplier'
            ? t('empty.selectSupplier')
            : scope.type === 'hq'
              ? t('empty.hqNotSetup')
              : t('empty.selectWorkshop');
    return (
        <div className="sa-acc-empty">
            <Search size={28} />
            <p>{need}</p>
        </div>
    );
}

function Loading({ t }) {
    return <div className="sa-acc-empty"><RefreshCw size={22} className="spin" /><p>{t('loading')}</p></div>;
}
function ErrorBox({ msg }) {
    return (
        <div className="sa-acc-empty sa-acc-error">
            <AlertTriangle size={24} />
            <p>{msg}</p>
        </div>
    );
}

function ReportToolbar({ title, onCsv, onPrint, t }) {
    return (
        <div className="sa-acc-report-toolbar">
            <h3>{title}</h3>
            <div className="sa-acc-report-actions">
                <button className="sa-acc-btn" onClick={onCsv}>
                    <Download size={14} /> {t('btn.csv')}
                </button>
                <button className="sa-acc-btn" onClick={onPrint}>
                    <Printer size={14} /> {t('btn.print')}
                        </button>
                </div>
                        </div>
    );
}

function MonitorDateRangeBar({
    draftFrom,
    draftTo,
    onDraftFromChange,
    onDraftToChange,
    onApply,
    onClear,
    hint = '',
    t,
}) {
    return (
        <div className="sa-acc-date-bar">
            <div className="sa-acc-date-fields">
                <label className="sa-acc-date-field">
                    <span>{t('date.from')}</span>
                    <input type="date" value={draftFrom} onChange={(e) => onDraftFromChange(e.target.value)} />
                </label>
                <label className="sa-acc-date-field">
                    <span>{t('date.to')}</span>
                    <input type="date" value={draftTo} onChange={(e) => onDraftToChange(e.target.value)} />
                </label>
                <button type="button" className="sa-acc-btn sa-acc-btn--primary" onClick={onApply}>
                    {t('date.apply')}
                                    </button>
                <button type="button" className="sa-acc-btn" onClick={onClear}>
                    {t('date.clear')}
                </button>
            </div>
            {hint ? <p className="sa-acc-date-hint">{hint}</p> : null}
        </div>
    );
}

function clickableRowProps(canOpen, url, navigate) {
    if (!canOpen || !url) return {};
    return {
        className: 'sa-acc-row-clickable',
        onClick: () => navigate(url),
        onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(url);
            }
        },
        tabIndex: 0,
        role: 'link',
    };
}

function HqChartOfAccountsPanel({ scope, dateRange, t }) {
    const buildLedgerUrl = useCallback(
        (account) => buildHqCoaNavigationUrl(account, dateRange),
        [dateRange],
    );

    return (
        <div className="sa-acc-panel">
            <p className="sa-acc-coa-hint">{t('coa.hint')}</p>
            <WorkshopCOAManager
                readOnly={false}
                dateRange={dateRange}
                enableLedgerLinks
                buildLedgerUrl={buildLedgerUrl}
            />
        </div>
    );
}

function HqWorkshopBooksPanel({ hqWorkshopId }) {
    return (
        <AccountingWorkshopScopeProvider workshopId={hqWorkshopId} hqBooks>
            <WorkshopAccountingPage branches={[]} selectedBranchId="all" />
        </AccountingWorkshopScopeProvider>
    );
}

function HqActivityLogPanel({ dateRange, t }) {
    return (
        <div className="sa-acc-panel" style={{ padding: 0 }}>
            <WorkshopTransactionsLog
                title={t('report.activity')}
                subtitle={t('report.activitySub')}
                branches={[]}
                selectedBranchId="all"
                initialDateFrom={dateRange?.dateFrom || ''}
                initialDateTo={dateRange?.dateTo || ''}
            />
        </div>
    );
}

/* ── Chart of Accounts ──────────────────────────────────────────────────── */
function ChartOfAccountsTab({ scope, dateRange, accountIndex, t }) {
    const navigate = useNavigate();
    const isSupplier = scope.type === 'supplier';
    const isMonitorScope = isMonitorBooksScope(scope);
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);
    const failMsg = t('empty.failed');

    const { loading, error, data } = useScopedData(async () => {
        if (!scopeReady) return [];
        if (isSupplier) {
            const res = await supMon.monitorSupplierAccounts(
                scope.supplierId,
                dateParamsForApi(dateRange),
            );
            return res?.accounts || res?.data || res || [];
        }
        return accountsApi.getAccounts(accountsParamsFor(scope, dateRange));
    }, [
        scope.type,
        scope.workshopId,
        scope.branchId,
        scope.supplierId,
        scope.hqWorkshopId,
        dateRange?.dateFrom,
        dateRange?.dateTo,
        failMsg,
    ], failMsg);

    if (!scopeReady) return <ScopeEmpty scope={scope} t={t} />;
    if (loading) return <Loading t={t} />;
    if (error) return <ErrorBox msg={error} />;

    const rows = Array.isArray(data) ? data : [];
    const csv = () =>
        downloadCsv(
            'chart-of-accounts.csv',
            [t('th.code'), t('th.name'), t('th.type'), t('th.subType'), t('th.closingDebit'), t('th.closingCredit')],
            rows.map((r) => [
                r.code,
                r.name,
                r.type,
                r.subType || r.subtype || '',
                fmt(r.closingDebit ?? 0),
                fmt(r.closingCredit ?? 0),
            ]),
        );

    return (
        <div className="sa-acc-panel">
            <ReportToolbar title={t('report.coa')} onCsv={csv} onPrint={() => printElement(ref.current, t('report.coa'))} t={t} />
            {isMonitorScope ? (
                <p className="sa-acc-coa-hint">{t('coa.clickRow')}</p>
            ) : null}
            <div ref={ref}>
                <table className="sa-acc-table">
                    <thead>
                        <tr>
                            <th>{t('th.code')}</th>
                            <th>{t('th.name')}</th>
                            <th>{t('th.type')}</th>
                            <th>{t('th.subType')}</th>
                            <th className="num">{t('th.closingDebit')}</th>
                            <th className="num">{t('th.closingCredit')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={6} className="sa-acc-td-empty">{t('empty.noAccounts')}</td></tr>
                        )}
                        {rows.map((r) => {
                            const link = monitorRowLink(scope, accountIndex, dateRange, r);
                            return (
                                <tr
                                    key={r.id || r.code}
                                    {...clickableRowProps(link.canOpen, link.url, navigate)}
                                >
                                    <td>{r.code}</td>
                                    <td>
                                        <MonitorAccountName
                                            name={r.name}
                                            url={link.url}
                                            canOpen={link.canOpen}
                                        />
                                    </td>
                                    <td>{r.type}</td>
                                    <td>{r.subType || r.subtype || '—'}</td>
                                    <td className="num">{fmt(r.closingDebit ?? 0)}</td>
                                    <td className="num">{fmt(r.closingCredit ?? 0)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                                </div>
                            </div>
    );
}

/* ── Trial Balance ──────────────────────────────────────────────────────── */
function TrialBalanceTab({ scope, dateRange, accountIndex, t }) {
    const navigate = useNavigate();
    const isSupplier = scope.type === 'supplier';
    const isMonitorScope = isMonitorBooksScope(scope);
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);
    const failMsg = t('empty.failed');

    const { loading, error, data } = useScopedData(async () => {
        if (!scopeReady) return null;
        if (isSupplier) return supMon.monitorSupplierTrialBalance(supplierParamsFor(scope, dateRange));
        return accountsApi.getTrialBalance(accountsParamsFor(scope, dateRange));
    }, [
        scope.type,
        scope.workshopId,
        scope.branchId,
        scope.supplierId,
        scope.hqWorkshopId,
        dateRange?.dateFrom,
        dateRange?.dateTo,
        failMsg,
    ], failMsg);

    if (!scopeReady) return <ScopeEmpty scope={scope} t={t} />;
    if (loading) return <Loading t={t} />;
    if (error) return <ErrorBox msg={error} />;

    const rows = data?.accounts || [];
    const totalD = data?.totalDebits ?? rows.reduce((s, r) => s + Number(r.debitBalance || 0), 0);
    const totalC = data?.totalCredits ?? rows.reduce((s, r) => s + Number(r.creditBalance || 0), 0);
    const csv = () =>
        downloadCsv(
            'trial-balance.csv',
            [t('th.code'), t('th.name'), t('th.type'), t('th.debit'), t('th.credit')],
            [
                ...rows.map((r) => [r.code, r.name, r.type, fmt(r.debitBalance), fmt(r.creditBalance)]),
                ['', '', t('total'), fmt(totalD), fmt(totalC)],
            ],
        );

    return (
        <div className="sa-acc-panel">
            <ReportToolbar title={t('report.tb')} onCsv={csv} onPrint={() => printElement(ref.current, t('report.tb'))} t={t} />
            {isMonitorScope ? (
                <p className="sa-acc-coa-hint">{t('coa.clickRowPeriod')}</p>
            ) : null}
            <div ref={ref}>
                <table className="sa-acc-table">
                    <thead>
                        <tr>
                            <th>{t('th.code')}</th>
                            <th>{t('th.name')}</th>
                            <th>{t('th.type')}</th>
                            <th className="num">{t('th.debit')}</th>
                            <th className="num">{t('th.credit')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => {
                            const link = monitorRowLink(scope, accountIndex, dateRange, r);
                            return (
                                <tr
                                    key={r.code || r.id || r.accountId}
                                    {...clickableRowProps(link.canOpen, link.url, navigate)}
                                >
                                    <td>{r.code}</td>
                                    <td>
                                        <MonitorAccountName
                                            name={r.name}
                                            url={link.url}
                                            canOpen={link.canOpen}
                                        />
                                    </td>
                                    <td>{r.type}</td>
                                    <td className="num">{Number(r.debitBalance) ? fmt(r.debitBalance) : '—'}</td>
                                    <td className="num">{Number(r.creditBalance) ? fmt(r.creditBalance) : '—'}</td>
                            </tr>
                            );
                        })}
                        <tr className="tot">
                            <td colSpan={3}>{t('totalLabel')}</td>
                            <td className="num">{fmt(totalD)}</td>
                            <td className="num">{fmt(totalC)}</td>
                                </tr>
                    </tbody>
                </table>
                {data && data.isBalanced === false && (
                    <p className="sa-acc-warn"><AlertTriangle size={13} /> {t('empty.outOfBalance', { amount: fmt(Math.abs(totalD - totalC)) })}</p>
                )}
                        </div>
        </div>
    );
}

/* ── Profit & Loss ──────────────────────────────────────────────────────── */
function PLTab({ scope, dateRange, accountIndex, t }) {
    const navigate = useNavigate();
    const isSupplier = scope.type === 'supplier';
    const isMonitorScope = isMonitorBooksScope(scope);
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);
    const failMsg = t('empty.failed');

    const { loading, error, data } = useScopedData(async () => {
        if (!scopeReady) return null;
        if (isSupplier) return supMon.monitorSupplierPL(supplierParamsFor(scope, dateRange));
        return accountsApi.getPLReport(accountsParamsFor(scope, dateRange));
    }, [
        scope.type,
        scope.workshopId,
        scope.branchId,
        scope.supplierId,
        scope.hqWorkshopId,
        dateRange?.dateFrom,
        dateRange?.dateTo,
        failMsg,
    ], failMsg);

    if (!scopeReady) return <ScopeEmpty scope={scope} t={t} />;
    if (loading) return <Loading t={t} />;
    if (error) return <ErrorBox msg={error} />;

    const section = (title, items, total) => (
        <>
            <tr className="sa-acc-section-row"><td colSpan={2}>{title}</td></tr>
            {(items || []).map((i) => {
                const link = monitorRowLink(scope, accountIndex, dateRange, i);
                return (
                    <tr
                        key={title + (i.id || i.code)}
                        {...clickableRowProps(link.canOpen, link.url, navigate)}
                    >
                        <td>
                            <MonitorAccountName
                                name={i.name}
                                url={link.url}
                                canOpen={link.canOpen}
                            />
                        </td>
                        <td className="num">{fmt(i.amount)}</td>
                    </tr>
                );
            })}
            <tr className="sa-acc-subtotal"><td>{t('totalSection', { title })}</td><td className="num">{fmt(total)}</td></tr>
        </>
    );

    const csv = () =>
        downloadCsv(
            'profit-and-loss.csv',
            [t('th.section'), t('th.account'), t('th.amount')],
            [
                ...(data?.revenue || []).map((i) => [t('csv.revenue'), i.name, fmt(i.amount)]),
                ...(data?.costOfGoodsSold || []).map((i) => [t('csv.cogs'), i.name, fmt(i.amount)]),
                ...(data?.operatingExpenses || []).map((i) => [t('csv.opex'), i.name, fmt(i.amount)]),
                ...(data?.otherIncome || []).map((i) => [t('csv.otherIncome'), i.name, fmt(i.amount)]),
                ...(data?.otherExpenses || []).map((i) => [t('csv.otherExpenses'), i.name, fmt(i.amount)]),
                ['', t('netIncome'), fmt(data?.netIncome ?? 0)],
            ],
        );

    return (
        <div className="sa-acc-panel">
            <ReportToolbar title={t('report.pl')} onCsv={csv} onPrint={() => printElement(ref.current, t('report.pl'))} t={t} />
            {isMonitorScope ? (
                <p className="sa-acc-coa-hint">{t('coa.clickLinePeriod')}</p>
            ) : null}
            <div ref={ref}>
                <table className="sa-acc-table">
                    <tbody>
                        {section(t('section.revenue'), data?.revenue, data?.totalRevenue)}
                        {section(t('section.cogs'), data?.costOfGoodsSold, data?.totalCOGS)}
                        <tr className="sa-acc-subtotal"><td>{t('section.grossProfit')}</td><td className="num">{fmt(data?.grossProfit)}</td></tr>
                        {section(t('section.opex'), data?.operatingExpenses, data?.totalOperatingExpenses)}
                        {section(t('section.otherIncome'), data?.otherIncome, data?.totalOtherIncome)}
                        {section(t('section.otherExpenses'), data?.otherExpenses, data?.totalOtherExpenses)}
                        <tr className="tot"><td>{t('section.netIncome')}</td><td className="num">{fmt(data?.netIncome)}</td></tr>
                    </tbody>
                </table>
                            </div>
                            </div>
    );
}

/* ── Balance Sheet ──────────────────────────────────────────────────────── */
function BalanceSheetTab({ scope, dateRange, accountIndex, t }) {
    const navigate = useNavigate();
    const isSupplier = scope.type === 'supplier';
    const isMonitorScope = isMonitorBooksScope(scope);
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);
    const failMsg = t('empty.failed');

    const { loading, error, data } = useScopedData(async () => {
        if (!scopeReady) return null;
        if (isSupplier) return supMon.monitorSupplierBalanceSheet(supplierParamsFor(scope, dateRange, { forBalanceSheet: true }));
        return accountsApi.getBalanceSheet(accountsParamsFor(scope, dateRange, { forBalanceSheet: true }));
    }, [
        scope.type,
        scope.workshopId,
        scope.branchId,
        scope.supplierId,
        scope.hqWorkshopId,
        dateRange?.dateTo,
        failMsg,
    ], failMsg);

    if (!scopeReady) return <ScopeEmpty scope={scope} t={t} />;
    if (loading) return <Loading t={t} />;
    if (error) return <ErrorBox msg={error} />;

    const a = data?.assets || {};
    const l = data?.liabilities || {};
    const eq = data?.equity || {};
    const group = (label, items) => (
        <>
            {(items || []).map((i) => {
                const link = monitorRowLink(scope, accountIndex, dateRange, i);
                return (
                    <tr
                        key={label + (i.id || i.code)}
                        {...clickableRowProps(link.canOpen, link.url, navigate)}
                    >
                        <td>
                            <MonitorAccountName
                                name={i.name}
                                url={link.url}
                                canOpen={link.canOpen}
                            />
                        </td>
                        <td className="num">{fmt(i.amount)}</td>
                    </tr>
                );
            })}
        </>
    );

    return (
        <div className="sa-acc-panel">
            <ReportToolbar
                title={t('report.bs')}
                onCsv={() =>
                    downloadCsv(
                        'balance-sheet.csv',
                        [t('th.section'), t('th.account'), t('th.amount')],
                        [
                            ...[...(a.current || []), ...(a.fixed || []), ...(a.other || [])].map((i) => [t('section.assets'), i.name, fmt(i.amount)]),
                            ...[...(l.current || []), ...(l.longTerm || []), ...(l.other || [])].map((i) => [t('section.liabilities'), i.name, fmt(i.amount)]),
                            ...(eq.accounts || []).map((i) => [t('section.equity'), i.name, fmt(i.amount)]),
                        ],
                    )
                }
                onPrint={() => printElement(ref.current, t('report.bs'))}
                t={t}
            />
            {isMonitorScope ? (
                <p className="sa-acc-coa-hint">{t('bs.clickHint')}</p>
            ) : null}
            <div ref={ref} className="sa-acc-bs-grid">
                <table className="sa-acc-table">
                    <thead><tr><th>{t('section.assets')}</th><th className="num">{t('th.amount')}</th></tr></thead>
                    <tbody>
                        {group('cur', a.current)}
                        {group('fix', a.fixed)}
                        {group('oth', a.other)}
                        <tr className="tot"><td>{t('section.totalAssets')}</td><td className="num">{fmt(a.totalAssets)}</td></tr>
                    </tbody>
                </table>
                <table className="sa-acc-table">
                    <thead><tr><th>{t('section.liabEquity')}</th><th className="num">{t('th.amount')}</th></tr></thead>
                    <tbody>
                        {group('lc', l.current)}
                        {group('ll', l.longTerm)}
                        {group('lo', l.other)}
                        <tr className="sa-acc-subtotal"><td>{t('section.totalLiabilities')}</td><td className="num">{fmt(l.totalLiabilities)}</td></tr>
                        {group('eq', eq.accounts)}
                        <tr className="sa-acc-subtotal"><td>{t('section.totalEquity')}</td><td className="num">{fmt(eq.totalEquity)}</td></tr>
                        <tr className="tot"><td>{t('section.totalLiabEquity')}</td><td className="num">{fmt(data?.totalLiabilitiesAndEquity)}</td></tr>
                    </tbody>
                </table>
                            </div>
        </div>
    );
}

/* ── Ledger ─────────────────────────────────────────────────────────────── */
function LedgerTab({ scope, dateRange, t }) {
    const isSupplier = scope.type === 'supplier';
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const [accountId, setAccountId] = useState('');
    const ref = useRef(null);
    const failMsg = t('empty.failed');

    const accountsState = useScopedData(async () => {
        if (!scopeReady) return [];
        if (isSupplier) {
            const res = await supMon.monitorSupplierAccounts(
                scope.supplierId,
                dateParamsForApi(dateRange),
            );
            return res?.accounts || res || [];
        }
        return accountsApi.getAccounts(accountsParamsFor(scope, dateRange));
    }, [
        scope.type,
        scope.workshopId,
        scope.branchId,
        scope.supplierId,
        scope.hqWorkshopId,
        dateRange?.dateFrom,
        dateRange?.dateTo,
        failMsg,
    ], failMsg);

    const ledgerParams = useMemo(() => {
        if (isSupplier) {
            return { ...dateParamsForApi(dateRange), limit: 10000 };
        }
        return { ...accountsParamsFor(scope, dateRange), limit: 10000 };
    }, [isSupplier, scope, dateRange?.dateFrom, dateRange?.dateTo]);

    const ledgerState = useScopedData(async () => {
        if (!scopeReady || !accountId) return null;
        if (isSupplier) {
            return supMon.monitorSupplierAccountLedger(scope.supplierId, accountId, ledgerParams);
        }
        return accountsApi.getAccountLedger(accountId, ledgerParams);
    }, [
        scope.type,
        scope.workshopId,
        scope.branchId,
        scope.supplierId,
        scope.hqWorkshopId,
        accountId,
        ledgerParams,
        failMsg,
    ], failMsg);

    if (!scopeReady) return <ScopeEmpty scope={scope} t={t} />;

    const accounts = Array.isArray(accountsState.data) ? accountsState.data : [];
    const led = ledgerState.data || {};
    const lines = led.rows?.length ? led.rows : (led.lines || led.entries || []);
    const openingBalance = led.openingBalance ?? null;

    return (
        <div className="sa-acc-panel">
            <div className="sa-acc-report-toolbar">
                <select className="sa-acc-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    <option value="">{t('empty.selectAccount')}</option>
                    {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                    ))}
                </select>
                {accountId && (
                    <div className="sa-acc-report-actions">
                        <button
                            className="sa-acc-btn"
                            onClick={() =>
                                downloadCsv(
                                    'ledger.csv',
                                    [t('th.date'), t('th.entry'), t('th.description'), t('th.debit'), t('th.credit'), t('th.balance')],
                                    lines.map((x) => [
                                        fmtDate(x.date),
                                        x.entryNumber || x.reference || '',
                                        x.description || '',
                                        fmt(x.debit),
                                        fmt(x.credit),
                                        fmt(x.runningBalance ?? x.balance ?? 0),
                                    ]),
                                )
                            }
                        >
                            <Download size={14} /> {t('btn.csv')}
                        </button>
                        <button className="sa-acc-btn" onClick={() => printElement(ref.current, t('report.ledger'))}>
                            <Printer size={14} /> {t('btn.print')}
                        </button>
                        </div>
                )}
                        </div>
            {!accountId ? (
                <div className="sa-acc-empty"><p>{t('empty.pickAccount')}</p></div>
            ) : ledgerState.loading ? (
                <Loading t={t} />
            ) : ledgerState.error ? (
                <ErrorBox msg={ledgerState.error} />
            ) : (
                <div ref={ref}>
                    <table className="sa-acc-table">
                        <thead>
                            <tr>
                                <th>{t('th.date')}</th><th>{t('th.entry')}</th><th>{t('th.description')}</th>
                                <th className="num">{t('th.debit')}</th><th className="num">{t('th.credit')}</th><th className="num">{t('th.balance')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {openingBalance != null && (
                                <tr className="sa-acc-ledger-opening">
                                    <td>—</td>
                                    <td>—</td>
                                    <td>{t('empty.openingBalance')}</td>
                                    <td className="num">—</td>
                                    <td className="num">—</td>
                                    <td className="num">{fmt(openingBalance)}</td>
                                </tr>
                            )}
                            {lines.length === 0 && (
                                <tr><td colSpan={6} className="sa-acc-td-empty">{t('empty.noLedgerLines')}</td></tr>
                            )}
                            {lines.map((x, i) => (
                                <tr key={x.id || i}>
                                    <td>{fmtDate(x.date)}</td>
                                    <td>{x.entryNumber || x.reference || '—'}</td>
                                    <td>{x.description || '—'}</td>
                                    <td className="num">{Number(x.debit) ? fmt(x.debit) : '—'}</td>
                                    <td className="num">{Number(x.credit) ? fmt(x.credit) : '—'}</td>
                                    <td className="num">{fmt(x.runningBalance ?? x.balance ?? 0)}</td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
            )}
        </div>
    );
}

/* ── HQ manual Journal Entry modal (HQ scope only) ──────────────────────── */
function HqJournalEntryModal({ scope, onClose, onPosted, t }) {
    const [accounts, setAccounts] = useState([]);
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [description, setDescription] = useState('');
    const [lines, setLines] = useState([
        { accountId: '', debit: '', credit: '' },
        { accountId: '', debit: '', credit: '' },
    ]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        accountsApi
            .getAccounts({
                workshopId: scope.hqWorkshopId,
                hqBooks: 'true',
                leafOnly: true,
            })
            .then((a) => setAccounts(Array.isArray(a) ? a : []))
            .catch(() => setAccounts([]));
    }, [scope.hqWorkshopId]);

    const setLine = (i, patch) =>
        setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    const addLine = () => setLines((ls) => [...ls, { accountId: '', debit: '', credit: '' }]);
    const removeLine = (i) => setLines((ls) => (ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls));

    const totalDr = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCr = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    const balanced = Math.abs(totalDr - totalCr) < 0.0001 && totalDr > 0;

    const submit = async () => {
        setErr('');
        if (!balanced) {
            setErr(t('je.balanced'));
            return;
        }
        setSaving(true);
        try {
            await wsAcc.createJournalEntry({
                workshopId: scope.hqWorkshopId,
                date,
                description,
                lines: lines
                    .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
                    .map((l) => ({
                        accountId: l.accountId,
                        debit: Number(l.debit || 0),
                        credit: Number(l.credit || 0),
                    })),
            });
            onPosted?.();
            onClose();
        } catch (e) {
            setErr(e?.message || t('je.failed'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="sa-acc-modal-overlay" onClick={onClose}>
            <div className="sa-acc-modal" onClick={(e) => e.stopPropagation()}>
                <h3>{t('je.newHq')}</h3>
                <div className="sa-acc-modal-row">
                    <label>{t('th.date')}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                    <label className="grow">{t('je.description')}<input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('je.memo')} /></label>
                                </div>
                <table className="sa-acc-table">
                    <thead><tr><th>{t('th.account')}</th><th className="num">{t('th.debit')}</th><th className="num">{t('th.credit')}</th><th /></tr></thead>
                    <tbody>
                        {lines.map((l, i) => (
                            <tr key={i}>
                                <td>
                                    <select value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })}>
                                        <option value="">{t('je.select')}</option>
                                        {accounts.map((a) => (
                                            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                                        ))}
                                    </select>
                            </td>
                                <td className="num"><input type="number" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })} /></td>
                                <td className="num"><input type="number" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })} /></td>
                                <td><button className="sa-acc-btn" onClick={() => removeLine(i)}>×</button></td>
                        </tr>
                        ))}
                        <tr className="tot"><td>{t('je.totals')}</td><td className="num">{fmt(totalDr)}</td><td className="num">{fmt(totalCr)}</td><td /></tr>
                    </tbody>
                </table>
                <button className="sa-acc-btn" onClick={addLine}>{t('je.addLine')}</button>
                {err && <p className="sa-acc-warn"><AlertTriangle size={13} /> {err}</p>}
                <div className="sa-acc-modal-actions">
                    <button className="sa-acc-btn" onClick={onClose}>{t('btn.cancel')}</button>
                    <button className="sa-acc-btn sa-acc-btn--primary" disabled={!balanced || saving} onClick={submit}>
                        {saving ? t('btn.posting') : t('btn.post')}
                                </button>
                            </div>
                                </div>
                                </div>
    );
}

/* ── Journal Entries ────────────────────────────────────────────────────── */
function JournalEntriesTab({ scope, dateRange, t }) {
    const isSupplier = scope.type === 'supplier';
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const canEdit = scope.type === 'hq' && !!scope.hqWorkshopId;
    const [modalOpen, setModalOpen] = useState(false);
    const ref = useRef(null);
    const failMsg = t('empty.failed');

    const { loading, error, data, reload } = useScopedData(async () => {
        if (!scopeReady) return null;
        const dateParams = dateParamsForApi(dateRange);
        if (isSupplier) {
            return supMon.monitorSupplierAllJournals(scope.supplierId, { limit: 200, ...dateParams });
        }
        return wsAcc.listJournalEntries({ ...accountsParamsFor(scope), ...dateParams, limit: 200 });
    }, [
        scope.type,
        scope.workshopId,
        scope.branchId,
        scope.supplierId,
        scope.hqWorkshopId,
        dateRange?.dateFrom,
        dateRange?.dateTo,
        failMsg,
    ], failMsg);

    if (!scopeReady) return <ScopeEmpty scope={scope} t={t} />;
    if (loading) return <Loading t={t} />;
    if (error) return <ErrorBox msg={error} />;

    const rows = data?.entries || data?.journals || data?.items || [];
    return (
        <div className="sa-acc-panel">
            {canEdit && (
                <div className="sa-acc-hq-edit-bar">
                    <button className="sa-acc-btn sa-acc-btn--primary" onClick={() => setModalOpen(true)}>{t('je.newBtn')}</button>
                </div>
            )}
            {modalOpen && (
                <HqJournalEntryModal scope={scope} onClose={() => setModalOpen(false)} onPosted={reload} t={t} />
            )}
            <ReportToolbar
                title={t('report.journal')}
                onCsv={() =>
                    downloadCsv(
                        'journal-entries.csv',
                        [t('th.date'), t('th.entryNo'), t('th.type'), t('th.description'), t('th.debit'), t('th.credit')],
                        rows.map((r) => [
                            fmtDate(r.date),
                            r.entryNumber || r.number || '',
                            r.type || '',
                            r.description || '',
                            fmt(r.totalDebit ?? r.totalDr ?? 0),
                            fmt(r.totalCredit ?? r.totalCr ?? 0),
                        ]),
                    )
                }
                onPrint={() => printElement(ref.current, t('report.journal'))}
                t={t}
            />
            <div ref={ref}>
                <table className="sa-acc-table">
                                        <thead>
                        <tr><th>{t('th.date')}</th><th>{t('th.entryNo')}</th><th>{t('th.type')}</th><th>{t('th.description')}</th><th className="num">{t('th.debit')}</th><th className="num">{t('th.credit')}</th></tr>
                                        </thead>
                                        <tbody>
                        {rows.length === 0 && <tr><td colSpan={6} className="sa-acc-td-empty">{t('empty.noJournal')}</td></tr>}
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td>{fmtDate(r.date)}</td>
                                <td>{r.entryNumber || r.number || '—'}</td>
                                <td>{r.type || '—'}</td>
                                <td>{r.description || '—'}</td>
                                <td className="num">{fmt(r.totalDebit ?? r.totalDr ?? 0)}</td>
                                <td className="num">{fmt(r.totalCredit ?? r.totalCr ?? 0)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
        </div>
    );
}

/* ── Payments / Receipts ────────────────────────────────────────────────── */
function TransactionsTab({ scope, kind, dateRange, t }) {
    const isSupplier = scope.type === 'supplier';
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);
    const failMsg = t('empty.failed');

    const { loading, error, data } = useScopedData(async () => {
        if (!scopeReady) return null;
        const dateParams = dateParamsForApi(dateRange);
        if (isSupplier) {
            return kind === 'payment'
                ? supMon.monitorSupplierPayments(scope.supplierId, { limit: 200, ...dateParams })
                : supMon.monitorSupplierReceipts(scope.supplierId, { limit: 200, ...dateParams });
        }
        const params = { ...accountsParamsFor(scope), ...dateParams };
        return kind === 'payment' ? wsAcc.listPayments(params) : wsAcc.listReceipts(params);
    }, [
        scope.type,
        scope.workshopId,
        scope.branchId,
        scope.supplierId,
        scope.hqWorkshopId,
        kind,
        dateRange?.dateFrom,
        dateRange?.dateTo,
        failMsg,
    ], failMsg);

    if (!scopeReady) return <ScopeEmpty scope={scope} t={t} />;
    if (loading) return <Loading t={t} />;
    if (error) return <ErrorBox msg={error} />;

    const rows = data?.rows || data?.items || data?.entries || [];
    const title = kind === 'payment' ? t('report.payments') : t('report.receipts');
    const emptyMsg = kind === 'payment' ? t('empty.noPayments') : t('empty.noReceipts');
    return (
        <div className="sa-acc-panel">
            <ReportToolbar
                title={title}
                onCsv={() =>
                    downloadCsv(
                        `${kind}s.csv`,
                        [t('th.date'), t('th.voucher'), t('th.payee'), t('th.account'), t('th.amount'), t('th.status')],
                        rows.map((r) => [
                            fmtDate(r.date),
                            r.voucherNumber || r.voucher || r.number || '',
                            r.payeeName || r.payee || '',
                            r.account?.name || r.accountName || '',
                            fmt(r.amount),
                            r.status || '',
                        ]),
                    )
                }
                onPrint={() => printElement(ref.current, title)}
                t={t}
            />
            <div ref={ref}>
                <table className="sa-acc-table">
                    <thead>
                        <tr><th>{t('th.date')}</th><th>{t('th.voucher')}</th><th>{t('th.payee')}</th><th>{t('th.account')}</th><th className="num">{t('th.amount')}</th><th>{t('th.status')}</th></tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <tr><td colSpan={6} className="sa-acc-td-empty">{emptyMsg}</td></tr>}
                        {rows.map((r, i) => (
                            <tr key={r.id || i}>
                                <td>{fmtDate(r.date)}</td>
                                <td>{r.voucherNumber || r.voucher || r.number || '—'}</td>
                                <td>{r.payeeName || r.payee || '—'}</td>
                                <td>{r.account?.name || r.accountName || '—'}</td>
                                <td className="num">{fmt(r.amount)}</td>
                                <td><span className={`sa-acc-status sa-acc-status--${(r.status || '').toLowerCase()}`}>{r.status || '—'}</span></td>
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ── Activity Log (cash/bank feed) ──────────────────────────────────────── */
function ActivityTab({ scope, dateRange, t }) {
    const isSupplier = scope.type === 'supplier';
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);
    const failMsg = t('empty.failed');

    const { loading, error, data } = useScopedData(async () => {
        if (!scopeReady) return null;
        const dateParams = dateParamsForApi(dateRange);
        if (isSupplier) {
            return supMon.monitorSupplierAllJournals(scope.supplierId, { limit: 200, ...dateParams });
        }
        return logsApi.listCashBankTransactionsLog({
            ...accountsParamsFor(scope),
            ...dateParams,
            limit: 200,
        });
    }, [
        scope.type,
        scope.workshopId,
        scope.branchId,
        scope.supplierId,
        scope.hqWorkshopId,
        dateRange?.dateFrom,
        dateRange?.dateTo,
        failMsg,
    ], failMsg);

    if (!scopeReady) return <ScopeEmpty scope={scope} t={t} />;
    if (loading) return <Loading t={t} />;
    if (error) return <ErrorBox msg={error} />;

    if (isSupplier) {
        const rows = data?.entries || data?.journals || data?.items || [];
    return (
            <div className="sa-acc-panel">
                <ReportToolbar title={t('report.activity')} onCsv={() => downloadCsv('activity.csv', [t('th.date'), t('th.entry'), t('th.description')], rows.map((r) => [fmtDate(r.date), r.entryNumber || '', r.description || '']))} onPrint={() => printElement(ref.current, t('report.activity'))} t={t} />
                <div ref={ref}>
                    <table className="sa-acc-table">
                        <thead><tr><th>{t('th.date')}</th><th>{t('th.entry')}</th><th>{t('th.description')}</th></tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id}><td>{fmtDate(r.date)}</td><td>{r.entryNumber || '—'}</td><td>{r.description || '—'}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    const rows = data?.items || [];
    return (
        <div className="sa-acc-panel">
            <ReportToolbar
                title={t('report.activity')}
                onCsv={() =>
                    downloadCsv(
                        'activity.csv',
                        [t('th.date'), t('th.direction'), t('th.account'), t('th.branch'), t('th.description'), t('th.amount')],
                        rows.map((r) => [
                            fmtDate(r.entryDate || r.createdAt),
                            r.direction,
                            r.account?.name || '',
                            r.account?.branchName || '',
                            r.description || '',
                            fmt(r.amount),
                        ]),
                    )
                }
                onPrint={() => printElement(ref.current, t('report.activity'))}
                t={t}
            />
            <div ref={ref}>
                <table className="sa-acc-table">
                        <thead>
                        <tr><th>{t('th.date')}</th><th>{t('th.dir')}</th><th>{t('th.account')}</th><th>{t('th.branch')}</th><th>{t('th.description')}</th><th className="num">{t('th.amount')}</th></tr>
                        </thead>
                        <tbody>
                        {rows.length === 0 && <tr><td colSpan={6} className="sa-acc-td-empty">{t('empty.noActivity')}</td></tr>}
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td>{fmtDate(r.entryDate || r.createdAt)}</td>
                                <td>
                                    <span className={`sa-acc-dir sa-acc-dir--${r.direction}`}>
                                        {r.direction === 'in' ? t('dir.in') : t('dir.out')}
                                    </span>
                                        </td>
                                <td>{r.account?.name || '—'}</td>
                                <td>{r.account?.branchName || '—'}</td>
                                <td>{r.description || '—'}</td>
                                <td className="num">{fmt(r.amount)}</td>
                                    </tr>
                        ))}
                        </tbody>
                    </table>
                            </div>
                            </div>
    );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function AccountingPage() {
    const { subTab } = useParams();
    const navigate = useNavigate();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => accT(locale, key, vars), [locale]);
    const activeSub = subTab || 'chart-of-accounts';

    const [scope, setScopeState] = useState(loadScope);
    const [workshops, setWorkshops] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [hqWorkshopId, setHqWorkshopId] = useState('');
    const [loadingLists, setLoadingLists] = useState(false);

    const setScope = useCallback((updater) => {
        setScopeState((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            saveScope(next);
            return next;
        });
    }, []);

    const [provisioning, setProvisioning] = useState(false);

    const initialDateRange = useMemo(() => loadSaAccountingDateRange(), []);
    const [dateRange, setDateRange] = useState(initialDateRange);
    const [draftFrom, setDraftFrom] = useState(initialDateRange.dateFrom);
    const [draftTo, setDraftTo] = useState(initialDateRange.dateTo);

    const applyDateRange = useCallback(() => {
        const next = { dateFrom: draftFrom, dateTo: draftTo };
        setDateRange(next);
        saveSaAccountingDateRange(next);
    }, [draftFrom, draftTo]);

    const clearDateRange = useCallback(() => {
        const next = { dateFrom: startOfMonthISO(), dateTo: todayISO() };
        setDraftFrom(next.dateFrom);
        setDraftTo(next.dateTo);
        setDateRange(next);
        saveSaAccountingDateRange(next);
    }, []);

    const loadLists = useCallback(async () => {
        setLoadingLists(true);
        try {
            const [wRes, sRes, hqRes] = await Promise.all([
                getWorkshops({ limit: 100 }).catch(() => ({ workshops: [] })),
                getSuppliers().catch(() => ({ suppliers: [] })),
                getPlatformHqInfo().catch(() => ({ exists: false, workshopId: null })),
            ]);
            const ws = wRes?.workshops || wRes || [];
            setWorkshops(ws);
            const hqId =
                hqRes?.workshopId || (ws.find((w) => w.isPlatformHq)?.id ?? '');
            const canonicalHq = hqId ? String(hqId) : '';
            setHqWorkshopId(canonicalHq);
            if (canonicalHq) {
                setScopeState((prev) => {
                    if (prev.type !== 'hq') return prev;
                    const next = { ...prev, hqWorkshopId: canonicalHq };
                    saveScope(next);
                    return next;
                });
            }
            setSuppliers(sRes?.suppliers || sRes || []);
        } finally {
            setLoadingLists(false);
        }
    }, []);

    const handleProvisionHq = useCallback(async () => {
        setProvisioning(true);
        try {
            const res = await ensurePlatformHq();
            if (res?.workshopId) setHqWorkshopId(String(res.workshopId));
            await loadLists();
        } catch (e) {
            // eslint-disable-next-line no-alert
            alert(e?.message || t('err.setupHq'));
        } finally {
            setProvisioning(false);
        }
    }, [loadLists, t]);

    useEffect(() => {
        loadLists();
    }, [loadLists]);

    useEffect(() => {
        if (!hqWorkshopId || scope.type !== 'hq') return;
        if (scope.hqWorkshopId === hqWorkshopId) return;
        setScope((prev) => ({ ...prev, hqWorkshopId }));
    }, [hqWorkshopId, scope.type, scope.hqWorkshopId, setScope]);

    // Keep hqWorkshopId on the scope so children can build params.
    const resolvedHqId = hqWorkshopId || scope.hqWorkshopId || '';
    const effectiveScope = useMemo(
        () => ({ ...scope, hqWorkshopId: resolvedHqId }),
        [scope, resolvedHqId],
    );
    const isHqMode = effectiveScope.type === 'hq';

    const navTabs = isHqMode ? HQ_ACCOUNTING_TABS : MONITOR_TABS;
    const accountIndex = useMonitorAccountIndex(effectiveScope);
    const showDateBar =
        [
            'chart-of-accounts',
            'trial-balance',
            'pl',
            'balance-sheet',
            'ledger',
            'journal-entries',
            'payments',
            'receipts',
            'activity',
        ].includes(activeSub);
    const dateBarHint =
        activeSub === 'balance-sheet'
            ? t('hint.bs')
            : activeSub === 'pl'
              ? t('hint.pl')
              : activeSub === 'chart-of-accounts' || activeSub === 'trial-balance'
                ? t('hint.coaTb')
                : t('hint.lists');

    const renderTab = () => {
        if (isHqMode && !resolvedHqId) {
            return (
                <div className="sa-acc-empty">
                    <AlertTriangle size={32} />
                    <p>{t('empty.setupHqFull')}</p>
                            </div>
            );
        }

        if (isHqMode && resolvedHqId) {
            if (activeSub === 'chart-of-accounts') {
                return (
                    <AccountingWorkshopScopeProvider workshopId={resolvedHqId} hqBooks>
                        <HqChartOfAccountsPanel
                            scope={effectiveScope}
                            dateRange={dateRange}
                            t={t}
                        />
                    </AccountingWorkshopScopeProvider>
                );
            }
            if (HQ_WORKSHOP_PAGE_TABS.has(activeSub)) {
                return (
                    <HqWorkshopBooksPanel hqWorkshopId={resolvedHqId} />
                );
            }
            if (HQ_FINANCIAL_REPORT_TABS.has(activeSub)) {
                return (
                    <AccountingWorkshopScopeProvider workshopId={resolvedHqId} hqBooks>
                        {activeSub === 'trial-balance' ? (
                            <TrialBalanceTab
                                scope={effectiveScope}
                                dateRange={dateRange}
                                accountIndex={accountIndex}
                                t={t}
                            />
                        ) : null}
                        {activeSub === 'pl' ? (
                            <PLTab
                                scope={effectiveScope}
                                dateRange={dateRange}
                                accountIndex={accountIndex}
                                t={t}
                            />
                        ) : null}
                        {activeSub === 'balance-sheet' ? (
                            <BalanceSheetTab
                                scope={effectiveScope}
                                dateRange={dateRange}
                                accountIndex={accountIndex}
                                t={t}
                            />
                        ) : null}
                        {activeSub === 'activity' ? (
                            <HqActivityLogPanel dateRange={dateRange} t={t} />
                        ) : null}
                    </AccountingWorkshopScopeProvider>
                );
            }
            if (activeSub === 'commissions' || activeSub === 'referral-commissions-rm') {
                return (
                    <AccountingWorkshopScopeProvider workshopId={resolvedHqId} hqBooks>
                        <div className="commissions-page">
                            <HqReferralCommissionsPanel hqWorkshopId={resolvedHqId} />
                                </div>
                    </AccountingWorkshopScopeProvider>
                );
            }
        }

        if (isHqMode && activeSub === 'chart-of-accounts') {
            return (
                <div className="sa-acc-empty">
                    <AlertTriangle size={32} />
                    <p>{t('empty.loadingHq')}</p>
                                    </div>
            );
        }

        switch (activeSub) {
            case 'chart-of-accounts':
                return (
                    <ChartOfAccountsTab
                        scope={effectiveScope}
                        dateRange={dateRange}
                        accountIndex={accountIndex}
                        t={t}
                    />
                );
            case 'trial-balance':
                return (
                    <TrialBalanceTab
                        scope={effectiveScope}
                        dateRange={dateRange}
                        accountIndex={accountIndex}
                        t={t}
                    />
                );
            case 'pl':
                return <PLTab scope={effectiveScope} dateRange={dateRange} accountIndex={accountIndex} t={t} />;
            case 'balance-sheet':
                return (
                    <BalanceSheetTab
                        scope={effectiveScope}
                        dateRange={dateRange}
                        accountIndex={accountIndex}
                        t={t}
                    />
                );
            case 'ledger':
                return <LedgerTab scope={effectiveScope} dateRange={dateRange} t={t} />;
            case 'journal-entries':
                return <JournalEntriesTab scope={effectiveScope} dateRange={dateRange} t={t} />;
            case 'payments':
                return <TransactionsTab scope={effectiveScope} kind="payment" dateRange={dateRange} t={t} />;
            case 'receipts':
                return <TransactionsTab scope={effectiveScope} kind="receipt" dateRange={dateRange} t={t} />;
            case 'activity':
                return <ActivityTab scope={effectiveScope} dateRange={dateRange} t={t} />;
            case 'commissions':
            case 'referral-commissions-rm':
                if (effectiveScope.type === 'hq' && resolvedHqId) {
                    return (
                        <AccountingWorkshopScopeProvider workshopId={resolvedHqId} hqBooks>
                            <div className="commissions-page">
                                <HqReferralCommissionsPanel hqWorkshopId={resolvedHqId} />
                                </div>
                        </AccountingWorkshopScopeProvider>
                    );
                }
                return (
                    <div className="sa-acc-empty">
                        <AlertTriangle size={28} />
                        <p>{t('err.commissionsHqOnly')}</p>
        </div>
    );
            case 'workshop-commissions':
            case 'salary-payroll':
            case 'employee-ledger':
                return (
                    <WorkshopStaffAccountingTab
                        tabPath={activeSub}
                        scope={effectiveScope}
                        workshops={workshops}
                    />
                );
            default:
                return (
                    <ChartOfAccountsTab
                        scope={effectiveScope}
                        dateRange={dateRange}
                        accountIndex={accountIndex}
                        t={t}
                    />
                );
        }
    };

    const showScopeBar =
        activeSub !== 'commissions' && activeSub !== 'referral-commissions-rm';

    return (
        <div className="accounting-page module-container">
            <div className="accounting-sub-nav">
                {navTabs.map((tab) => (
                    <NavLink
                        key={tab.path}
                        to={`/admin/accounting/${tab.path}`}
                        className={({ isActive }) => `accounting-sub-tab ${isActive ? 'active' : ''}`}
                    >
                        {t(tab.labelKey || ACC_TAB_LABEL_KEYS[tab.path])}
                    </NavLink>
                ))}
            </div>

            {showScopeBar && (
                <ScopeBar
                    scope={effectiveScope}
                    setScope={setScope}
                    workshops={workshops}
                    suppliers={suppliers}
                    hqWorkshopId={hqWorkshopId}
                    loading={loadingLists}
                    onRefresh={loadLists}
                    onProvisionHq={handleProvisionHq}
                    provisioning={provisioning}
                    t={t}
                />
            )}

            {showDateBar ? (
                <MonitorDateRangeBar
                    draftFrom={draftFrom}
                    draftTo={draftTo}
                    onDraftFromChange={setDraftFrom}
                    onDraftToChange={setDraftTo}
                    onApply={applyDateRange}
                    onClear={clearDateRange}
                    hint={dateBarHint}
                    t={t}
                />
            ) : null}

            {renderTab()}
        </div>
    );
}
