import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, NavLink, useNavigate, Link } from 'react-router-dom';
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
import '../../styles/admin/AccountingPage.css';

/* ────────────────────────────────────────────────────────────────────────
 * Super Admin Accounting — cross-workshop / supplier monitor + HQ workshop clone.
 * ──────────────────────────────────────────────────────────────────────── */

const MONITOR_TABS = [
    { path: 'chart-of-accounts', label: 'Chart of Accounts' },
    { path: 'trial-balance', label: 'Trial Balance' },
    { path: 'pl', label: 'Profit & Loss' },
    { path: 'balance-sheet', label: 'Balance Sheet' },
    { path: 'ledger', label: 'Ledger' },
    { path: 'journal-entries', label: 'Journal Entries' },
    { path: 'payments', label: 'Payments' },
    { path: 'receipts', label: 'Receipts' },
    { path: 'activity', label: 'Activity Log' },
    { path: 'workshop-commissions', label: 'Workshop Commissions' },
    { path: 'salary-payroll', label: 'Salary & Payroll' },
    { path: 'employee-ledger', label: 'Employee Ledger' },
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
function ScopeBar({ scope, setScope, workshops, suppliers, hqWorkshopId, loading, onRefresh, onProvisionHq, provisioning }) {
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
                    <Building2 size={15} /> Workshop
                </button>
                <button
                    className={`sa-acc-scope-pill ${scope.type === 'supplier' ? 'active' : ''}`}
                    onClick={() => setType('supplier')}
                >
                    <Truck size={15} /> Supplier
                </button>
                <button
                    className={`sa-acc-scope-pill ${scope.type === 'hq' ? 'active' : ''}`}
                    onClick={() => setType('hq')}
                >
                    <Landmark size={15} /> HQ (My Books)
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
                            <option value="">Select workshop…</option>
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
                            <option value="">All branches</option>
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
                        <option value="">Select supplier…</option>
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
                            Platform HQ — your own books (full editing enabled).
                        </span>
                    ) : (
                        <button className="sa-acc-btn" onClick={onProvisionHq} disabled={provisioning}>
                            {provisioning ? 'Setting up…' : 'Set up HQ books'}
                        </button>
                    )
                )}

                <button className="sa-acc-icon-btn" onClick={onRefresh} title="Refresh" disabled={loading}>
                    <RefreshCw size={15} className={loading ? 'spin' : ''} />
                    </button>
            </div>

            <div className="sa-acc-readonly-flag">
                {scope.type === 'hq' && hqWorkshopId ? null : (
                    <span className="sa-acc-readonly-badge">
                        <Lock size={13} /> Read-only monitoring
                    </span>
                )}
            </div>
        </div>
    );
}

/* ── Generic state helpers ──────────────────────────────────────────────── */
function useScopedData(loader, deps) {
    const [state, setState] = useState({ loading: true, error: '', data: null });
    const reload = useCallback(() => {
        let alive = true;
        setState((s) => ({ ...s, loading: true, error: '' }));
        Promise.resolve()
            .then(loader)
            .then((data) => alive && setState({ loading: false, error: '', data }))
            .catch((e) => alive && setState({ loading: false, error: e?.message || 'Failed to load', data: null }));
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    useEffect(() => reload(), [reload]);
    return { ...state, reload };
}

function ScopeEmpty({ scope }) {
    const need =
        scope.type === 'supplier'
            ? 'Select a supplier to view its books.'
            : scope.type === 'hq'
              ? 'The Platform HQ entity has not been set up yet (Phase 2).'
              : 'Select a workshop to view its books.';
    return (
        <div className="sa-acc-empty">
            <Search size={28} />
            <p>{need}</p>
        </div>
    );
}

function Loading() {
    return <div className="sa-acc-empty"><RefreshCw size={22} className="spin" /><p>Loading…</p></div>;
}
function ErrorBox({ msg }) {
    return (
        <div className="sa-acc-empty sa-acc-error">
            <AlertTriangle size={24} />
            <p>{msg}</p>
        </div>
    );
}

function ReportToolbar({ title, onCsv, onPrint }) {
    return (
        <div className="sa-acc-report-toolbar">
            <h3>{title}</h3>
            <div className="sa-acc-report-actions">
                <button className="sa-acc-btn" onClick={onCsv}>
                    <Download size={14} /> CSV
                </button>
                <button className="sa-acc-btn" onClick={onPrint}>
                    <Printer size={14} /> Print
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
}) {
    return (
        <div className="sa-acc-date-bar">
            <div className="sa-acc-date-fields">
                <label className="sa-acc-date-field">
                    <span>From</span>
                    <input type="date" value={draftFrom} onChange={(e) => onDraftFromChange(e.target.value)} />
                </label>
                <label className="sa-acc-date-field">
                    <span>To</span>
                    <input type="date" value={draftTo} onChange={(e) => onDraftToChange(e.target.value)} />
                </label>
                <button type="button" className="sa-acc-btn sa-acc-btn--primary" onClick={onApply}>
                    Apply
                                    </button>
                <button type="button" className="sa-acc-btn" onClick={onClear}>
                    Clear
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

function HqChartOfAccountsPanel({ scope, dateRange }) {
    const buildLedgerUrl = useCallback(
        (account) => buildHqCoaNavigationUrl(account, dateRange),
        [dateRange],
    );

    return (
        <div className="sa-acc-panel">
            <p className="sa-acc-coa-hint">
                Create and edit HQ accounts below. Click a detail (sub) account row to open its register or ledger.
                <strong> [1110]</strong> corporate AR control · <strong>[1300]</strong> BNPL settlement ·
                <strong> [1320]</strong> SoftPOS HQ settlement · <strong>[1330]</strong> marketing wallet ·
                <strong> [1250]</strong> salary advances · <strong>[2210]</strong> referral commissions ·
                cash/bank detail accounts open Cash &amp; Bank. Heading accounts show rolled-up child totals.
            </p>
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

function HqActivityLogPanel({ dateRange }) {
    return (
        <div className="sa-acc-panel" style={{ padding: 0 }}>
            <WorkshopTransactionsLog
                title="Activity Log"
                subtitle="Cash, bank, and petty cash movements on Platform HQ books."
                branches={[]}
                selectedBranchId="all"
                initialDateFrom={dateRange?.dateFrom || ''}
                initialDateTo={dateRange?.dateTo || ''}
            />
        </div>
    );
}

/* ── Chart of Accounts ──────────────────────────────────────────────────── */
function ChartOfAccountsTab({ scope, dateRange, accountIndex }) {
    const navigate = useNavigate();
    const isSupplier = scope.type === 'supplier';
    const isMonitorScope = isMonitorBooksScope(scope);
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);

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
    ]);

    if (!scopeReady) return <ScopeEmpty scope={scope} />;
    if (loading) return <Loading />;
    if (error) return <ErrorBox msg={error} />;

    const rows = Array.isArray(data) ? data : [];
    const csv = () =>
        downloadCsv(
            'chart-of-accounts.csv',
            ['Code', 'Name', 'Type', 'Sub Type', 'Closing Debit', 'Closing Credit'],
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
            <ReportToolbar title="Chart of Accounts" onCsv={csv} onPrint={() => printElement(ref.current, 'Chart of Accounts')} />
            {isMonitorScope ? (
                <p className="sa-acc-coa-hint">Click any account row to open its ledger statement.</p>
            ) : null}
            <div ref={ref}>
                <table className="sa-acc-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Sub Type</th>
                            <th className="num">Closing Debit</th>
                            <th className="num">Closing Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr><td colSpan={6} className="sa-acc-td-empty">No accounts found.</td></tr>
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
function TrialBalanceTab({ scope, dateRange, accountIndex }) {
    const navigate = useNavigate();
    const isSupplier = scope.type === 'supplier';
    const isMonitorScope = isMonitorBooksScope(scope);
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);

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
    ]);

    if (!scopeReady) return <ScopeEmpty scope={scope} />;
    if (loading) return <Loading />;
    if (error) return <ErrorBox msg={error} />;

    const rows = data?.accounts || [];
    const totalD = data?.totalDebits ?? rows.reduce((s, r) => s + Number(r.debitBalance || 0), 0);
    const totalC = data?.totalCredits ?? rows.reduce((s, r) => s + Number(r.creditBalance || 0), 0);
    const csv = () =>
        downloadCsv(
            'trial-balance.csv',
            ['Code', 'Name', 'Type', 'Debit', 'Credit'],
            [
                ...rows.map((r) => [r.code, r.name, r.type, fmt(r.debitBalance), fmt(r.creditBalance)]),
                ['', '', 'TOTAL', fmt(totalD), fmt(totalC)],
            ],
        );

    return (
        <div className="sa-acc-panel">
            <ReportToolbar title="Trial Balance" onCsv={csv} onPrint={() => printElement(ref.current, 'Trial Balance')} />
            {isMonitorScope ? (
                <p className="sa-acc-coa-hint">Click any account row to open its ledger statement for this period.</p>
            ) : null}
            <div ref={ref}>
                <table className="sa-acc-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th className="num">Debit</th>
                            <th className="num">Credit</th>
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
                            <td colSpan={3}>Total</td>
                            <td className="num">{fmt(totalD)}</td>
                            <td className="num">{fmt(totalC)}</td>
                                </tr>
                    </tbody>
                </table>
                {data && data.isBalanced === false && (
                    <p className="sa-acc-warn"><AlertTriangle size={13} /> Out of balance by {fmt(Math.abs(totalD - totalC))}</p>
                )}
                        </div>
        </div>
    );
}

/* ── Profit & Loss ──────────────────────────────────────────────────────── */
function PLTab({ scope, dateRange, accountIndex }) {
    const navigate = useNavigate();
    const isSupplier = scope.type === 'supplier';
    const isMonitorScope = isMonitorBooksScope(scope);
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);

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
    ]);

    if (!scopeReady) return <ScopeEmpty scope={scope} />;
    if (loading) return <Loading />;
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
            <tr className="sa-acc-subtotal"><td>Total {title}</td><td className="num">{fmt(total)}</td></tr>
        </>
    );

    const csv = () =>
        downloadCsv(
            'profit-and-loss.csv',
            ['Section', 'Account', 'Amount'],
            [
                ...(data?.revenue || []).map((i) => ['Revenue', i.name, fmt(i.amount)]),
                ...(data?.costOfGoodsSold || []).map((i) => ['COGS', i.name, fmt(i.amount)]),
                ...(data?.operatingExpenses || []).map((i) => ['Operating Expenses', i.name, fmt(i.amount)]),
                ...(data?.otherIncome || []).map((i) => ['Other Income', i.name, fmt(i.amount)]),
                ...(data?.otherExpenses || []).map((i) => ['Other Expenses', i.name, fmt(i.amount)]),
                ['', 'NET INCOME', fmt(data?.netIncome ?? 0)],
            ],
        );

    return (
        <div className="sa-acc-panel">
            <ReportToolbar title="Profit & Loss" onCsv={csv} onPrint={() => printElement(ref.current, 'Profit & Loss')} />
            {isMonitorScope ? (
                <p className="sa-acc-coa-hint">Click any account line to open its ledger statement for this period.</p>
            ) : null}
            <div ref={ref}>
                <table className="sa-acc-table">
                    <tbody>
                        {section('Revenue', data?.revenue, data?.totalRevenue)}
                        {section('Cost of Goods Sold', data?.costOfGoodsSold, data?.totalCOGS)}
                        <tr className="sa-acc-subtotal"><td>Gross Profit</td><td className="num">{fmt(data?.grossProfit)}</td></tr>
                        {section('Operating Expenses', data?.operatingExpenses, data?.totalOperatingExpenses)}
                        {section('Other Income', data?.otherIncome, data?.totalOtherIncome)}
                        {section('Other Expenses', data?.otherExpenses, data?.totalOtherExpenses)}
                        <tr className="tot"><td>Net Income</td><td className="num">{fmt(data?.netIncome)}</td></tr>
                    </tbody>
                </table>
                            </div>
                            </div>
    );
}

/* ── Balance Sheet ──────────────────────────────────────────────────────── */
function BalanceSheetTab({ scope, dateRange, accountIndex }) {
    const navigate = useNavigate();
    const isSupplier = scope.type === 'supplier';
    const isMonitorScope = isMonitorBooksScope(scope);
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);

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
    ]);

    if (!scopeReady) return <ScopeEmpty scope={scope} />;
    if (loading) return <Loading />;
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
                title="Balance Sheet"
                onCsv={() =>
                    downloadCsv(
                        'balance-sheet.csv',
                        ['Section', 'Account', 'Amount'],
                        [
                            ...[...(a.current || []), ...(a.fixed || []), ...(a.other || [])].map((i) => ['Assets', i.name, fmt(i.amount)]),
                            ...[...(l.current || []), ...(l.longTerm || []), ...(l.other || [])].map((i) => ['Liabilities', i.name, fmt(i.amount)]),
                            ...(eq.accounts || []).map((i) => ['Equity', i.name, fmt(i.amount)]),
                        ],
                    )
                }
                onPrint={() => printElement(ref.current, 'Balance Sheet')}
            />
            {isMonitorScope ? (
                <p className="sa-acc-coa-hint">
                    Click any account line to open its ledger statement. Balance sheet uses the &quot;To&quot; date as as-of.
                </p>
            ) : null}
            <div ref={ref} className="sa-acc-bs-grid">
                <table className="sa-acc-table">
                    <thead><tr><th>Assets</th><th className="num">Amount</th></tr></thead>
                    <tbody>
                        {group('cur', a.current)}
                        {group('fix', a.fixed)}
                        {group('oth', a.other)}
                        <tr className="tot"><td>Total Assets</td><td className="num">{fmt(a.totalAssets)}</td></tr>
                    </tbody>
                </table>
                <table className="sa-acc-table">
                    <thead><tr><th>Liabilities & Equity</th><th className="num">Amount</th></tr></thead>
                    <tbody>
                        {group('lc', l.current)}
                        {group('ll', l.longTerm)}
                        {group('lo', l.other)}
                        <tr className="sa-acc-subtotal"><td>Total Liabilities</td><td className="num">{fmt(l.totalLiabilities)}</td></tr>
                        {group('eq', eq.accounts)}
                        <tr className="sa-acc-subtotal"><td>Total Equity</td><td className="num">{fmt(eq.totalEquity)}</td></tr>
                        <tr className="tot"><td>Total Liab. & Equity</td><td className="num">{fmt(data?.totalLiabilitiesAndEquity)}</td></tr>
                    </tbody>
                </table>
                            </div>
        </div>
    );
}

/* ── Ledger ─────────────────────────────────────────────────────────────── */
function LedgerTab({ scope, dateRange }) {
    const isSupplier = scope.type === 'supplier';
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const [accountId, setAccountId] = useState('');
    const ref = useRef(null);

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
    ]);

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
    ]);

    if (!scopeReady) return <ScopeEmpty scope={scope} />;

    const accounts = Array.isArray(accountsState.data) ? accountsState.data : [];
    const led = ledgerState.data || {};
    const lines = led.rows?.length ? led.rows : (led.lines || led.entries || []);
    const openingBalance = led.openingBalance ?? null;

    return (
        <div className="sa-acc-panel">
            <div className="sa-acc-report-toolbar">
                <select className="sa-acc-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    <option value="">Select an account…</option>
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
                                    ['Date', 'Entry', 'Description', 'Debit', 'Credit', 'Balance'],
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
                            <Download size={14} /> CSV
                        </button>
                        <button className="sa-acc-btn" onClick={() => printElement(ref.current, 'Ledger')}>
                            <Printer size={14} /> Print
                        </button>
                        </div>
                )}
                        </div>
            {!accountId ? (
                <div className="sa-acc-empty"><p>Pick an account to view its ledger.</p></div>
            ) : ledgerState.loading ? (
                <Loading />
            ) : ledgerState.error ? (
                <ErrorBox msg={ledgerState.error} />
            ) : (
                <div ref={ref}>
                    <table className="sa-acc-table">
                        <thead>
                            <tr>
                                <th>Date</th><th>Entry</th><th>Description</th>
                                <th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {openingBalance != null && (
                                <tr className="sa-acc-ledger-opening">
                                    <td>—</td>
                                    <td>—</td>
                                    <td>Opening balance</td>
                                    <td className="num">—</td>
                                    <td className="num">—</td>
                                    <td className="num">{fmt(openingBalance)}</td>
                                </tr>
                            )}
                            {lines.length === 0 && (
                                <tr><td colSpan={6} className="sa-acc-td-empty">No ledger lines in this period.</td></tr>
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
function HqJournalEntryModal({ scope, onClose, onPosted }) {
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
            setErr('Entry must be balanced (debits = credits, > 0).');
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
            setErr(e?.message || 'Failed to post entry');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="sa-acc-modal-overlay" onClick={onClose}>
            <div className="sa-acc-modal" onClick={(e) => e.stopPropagation()}>
                <h3>New HQ Journal Entry</h3>
                <div className="sa-acc-modal-row">
                    <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                    <label className="grow">Description<input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Memo" /></label>
                                </div>
                <table className="sa-acc-table">
                    <thead><tr><th>Account</th><th className="num">Debit</th><th className="num">Credit</th><th /></tr></thead>
                    <tbody>
                        {lines.map((l, i) => (
                            <tr key={i}>
                                <td>
                                    <select value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })}>
                                        <option value="">Select…</option>
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
                        <tr className="tot"><td>Totals</td><td className="num">{fmt(totalDr)}</td><td className="num">{fmt(totalCr)}</td><td /></tr>
                    </tbody>
                </table>
                <button className="sa-acc-btn" onClick={addLine}>+ Add line</button>
                {err && <p className="sa-acc-warn"><AlertTriangle size={13} /> {err}</p>}
                <div className="sa-acc-modal-actions">
                    <button className="sa-acc-btn" onClick={onClose}>Cancel</button>
                    <button className="sa-acc-btn sa-acc-btn--primary" disabled={!balanced || saving} onClick={submit}>
                        {saving ? 'Posting…' : 'Post Entry'}
                                </button>
                            </div>
                                </div>
                                </div>
    );
}

/* ── Journal Entries ────────────────────────────────────────────────────── */
function JournalEntriesTab({ scope, dateRange }) {
    const isSupplier = scope.type === 'supplier';
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const canEdit = scope.type === 'hq' && !!scope.hqWorkshopId;
    const [modalOpen, setModalOpen] = useState(false);
    const ref = useRef(null);

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
    ]);

    if (!scopeReady) return <ScopeEmpty scope={scope} />;
    if (loading) return <Loading />;
    if (error) return <ErrorBox msg={error} />;

    const rows = data?.entries || data?.journals || data?.items || [];
    return (
        <div className="sa-acc-panel">
            {canEdit && (
                <div className="sa-acc-hq-edit-bar">
                    <button className="sa-acc-btn sa-acc-btn--primary" onClick={() => setModalOpen(true)}>+ New Journal Entry</button>
                </div>
            )}
            {modalOpen && (
                <HqJournalEntryModal scope={scope} onClose={() => setModalOpen(false)} onPosted={reload} />
            )}
            <ReportToolbar
                title="Journal Entries"
                onCsv={() =>
                    downloadCsv(
                        'journal-entries.csv',
                        ['Date', 'Entry #', 'Type', 'Description', 'Debit', 'Credit'],
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
                onPrint={() => printElement(ref.current, 'Journal Entries')}
            />
            <div ref={ref}>
                <table className="sa-acc-table">
                                        <thead>
                        <tr><th>Date</th><th>Entry #</th><th>Type</th><th>Description</th><th className="num">Debit</th><th className="num">Credit</th></tr>
                                        </thead>
                                        <tbody>
                        {rows.length === 0 && <tr><td colSpan={6} className="sa-acc-td-empty">No journal entries.</td></tr>}
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
function TransactionsTab({ scope, kind, dateRange }) {
    const isSupplier = scope.type === 'supplier';
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);

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
    ]);

    if (!scopeReady) return <ScopeEmpty scope={scope} />;
    if (loading) return <Loading />;
    if (error) return <ErrorBox msg={error} />;

    const rows = data?.rows || data?.items || data?.entries || [];
    const title = kind === 'payment' ? 'Payments' : 'Receipts';
    return (
        <div className="sa-acc-panel">
            <ReportToolbar
                title={title}
                onCsv={() =>
                    downloadCsv(
                        `${kind}s.csv`,
                        ['Date', 'Voucher', 'Payee', 'Account', 'Amount', 'Status'],
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
            />
            <div ref={ref}>
                <table className="sa-acc-table">
                    <thead>
                        <tr><th>Date</th><th>Voucher</th><th>Payee</th><th>Account</th><th className="num">Amount</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <tr><td colSpan={6} className="sa-acc-td-empty">No {title.toLowerCase()}.</td></tr>}
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
function ActivityTab({ scope, dateRange }) {
    const isSupplier = scope.type === 'supplier';
    const scopeReady = isSupplier ? !!scope.supplierId : scope.type === 'hq' ? !!scope.hqWorkshopId : !!scope.workshopId;
    const ref = useRef(null);

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
    ]);

    if (!scopeReady) return <ScopeEmpty scope={scope} />;
    if (loading) return <Loading />;
    if (error) return <ErrorBox msg={error} />;

    if (isSupplier) {
        const rows = data?.entries || data?.journals || data?.items || [];
    return (
            <div className="sa-acc-panel">
                <ReportToolbar title="Activity Log" onCsv={() => downloadCsv('activity.csv', ['Date', 'Entry', 'Description'], rows.map((r) => [fmtDate(r.date), r.entryNumber || '', r.description || '']))} onPrint={() => printElement(ref.current, 'Activity Log')} />
                <div ref={ref}>
                    <table className="sa-acc-table">
                        <thead><tr><th>Date</th><th>Entry</th><th>Description</th></tr></thead>
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
                title="Activity Log"
                onCsv={() =>
                    downloadCsv(
                        'activity.csv',
                        ['Date', 'Direction', 'Account', 'Branch', 'Description', 'Amount'],
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
                onPrint={() => printElement(ref.current, 'Activity Log')}
            />
            <div ref={ref}>
                <table className="sa-acc-table">
                        <thead>
                        <tr><th>Date</th><th>Dir</th><th>Account</th><th>Branch</th><th>Description</th><th className="num">Amount</th></tr>
                        </thead>
                        <tbody>
                        {rows.length === 0 && <tr><td colSpan={6} className="sa-acc-td-empty">No activity.</td></tr>}
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td>{fmtDate(r.entryDate || r.createdAt)}</td>
                                <td>
                                    <span className={`sa-acc-dir sa-acc-dir--${r.direction}`}>
                                        {r.direction === 'in' ? 'IN' : 'OUT'}
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
            alert(e?.message || 'Failed to set up HQ books');
        } finally {
            setProvisioning(false);
        }
    }, [loadLists]);

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
            ? 'Balance sheet uses the To date as the as-of date.'
            : activeSub === 'pl'
              ? 'Profit & Loss shows activity between From and To.'
              : activeSub === 'chart-of-accounts' || activeSub === 'trial-balance'
                ? 'COA and Trial Balance show balances as of the To date (including parent roll-ups). Ledger drill-down uses From–To for opening balance and period lines.'
                : 'Lists and ledgers are filtered to the From–To date range.';

    const renderTab = () => {
        if (isHqMode && !resolvedHqId) {
            return (
                <div className="sa-acc-empty">
                    <AlertTriangle size={32} />
                    <p>Set up Platform HQ books to use full accounting.</p>
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
                            />
                        ) : null}
                        {activeSub === 'pl' ? (
                            <PLTab
                                scope={effectiveScope}
                                dateRange={dateRange}
                                accountIndex={accountIndex}
                            />
                        ) : null}
                        {activeSub === 'balance-sheet' ? (
                            <BalanceSheetTab
                                scope={effectiveScope}
                                dateRange={dateRange}
                                accountIndex={accountIndex}
                            />
                        ) : null}
                        {activeSub === 'activity' ? (
                            <HqActivityLogPanel dateRange={dateRange} />
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
                    <p>Loading Platform HQ books…</p>
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
                    />
                );
            case 'trial-balance':
                return (
                    <TrialBalanceTab
                        scope={effectiveScope}
                        dateRange={dateRange}
                        accountIndex={accountIndex}
                    />
                );
            case 'pl':
                return <PLTab scope={effectiveScope} dateRange={dateRange} accountIndex={accountIndex} />;
            case 'balance-sheet':
                return (
                    <BalanceSheetTab
                        scope={effectiveScope}
                        dateRange={dateRange}
                        accountIndex={accountIndex}
                    />
                );
            case 'ledger':
                return <LedgerTab scope={effectiveScope} dateRange={dateRange} />;
            case 'journal-entries':
                return <JournalEntriesTab scope={effectiveScope} dateRange={dateRange} />;
            case 'payments':
                return <TransactionsTab scope={effectiveScope} kind="payment" dateRange={dateRange} />;
            case 'receipts':
                return <TransactionsTab scope={effectiveScope} kind="receipt" dateRange={dateRange} />;
            case 'activity':
                return <ActivityTab scope={effectiveScope} dateRange={dateRange} />;
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
                        <p>
                            Referral commissions are managed under HQ (My Books). Switch scope to HQ to
                            view referrer payouts.
                        </p>
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
                    />
                );
        }
    };

    const showScopeBar =
        activeSub !== 'commissions' && activeSub !== 'referral-commissions-rm';

    return (
        <div className="accounting-page module-container">
            <div className="accounting-sub-nav">
                {navTabs.map((t) => (
                    <NavLink
                        key={t.path}
                        to={`/admin/accounting/${t.path}`}
                        className={({ isActive }) => `accounting-sub-tab ${isActive ? 'active' : ''}`}
                    >
                        {t.label}
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
                />
            ) : null}

            {renderTab()}
        </div>
    );
}
