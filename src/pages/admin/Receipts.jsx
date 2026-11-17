import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Loader2, RefreshCw, FileText, ReceiptText, Search, Printer, X } from 'lucide-react';
import {
    getSuperAdminReceipts,
    getSuperAdminInvoiceView,
    getWorkshopOptions,
    getBranches,
    getSuperAdminCorporateCompanies,
} from '../../services/superAdminApi';
import AdminScreenShell from '../../components/admin/AdminScreenShell';
import CashierTaxInvoiceView from '../../components/pos/modern/CashierTaxInvoiceView';
import '../../components/pos/modern/CashierTaxInvoiceView.css';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
import { ExportMenu } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';
import { rcT } from '../../utils/receiptsI18n';
import '../../styles/ui.css';

const EXPORT_LIMIT = 5000;
const round2 = (n) => Number(Number(n ?? 0).toFixed(2));

const num = (t, v) =>
    t('money.sar', {
        amount: Number(v ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }),
    });

/**
 * Rendered in the business timezone. The API sends UTC instants, so a payment
 * taken late in the Riyadh day otherwise reads as the day before on a browser
 * set west of it — and on a receipt the date is the point.
 */
function formatDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString(undefined, {
        timeZone: BUSINESS_TIMEZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/** Totals for a receipt row, with the fallbacks an older payload needs. */
function receiptAmounts(r) {
    const total = Number(r.totalAmount ?? 0);
    const paid = Number(r.amountPaid ?? total);
    const balance = r.balance != null ? Number(r.balance) : Math.max(0, total - paid);
    const isPartial = balance > 0.01 && String(r.paymentStatus).toLowerCase() !== 'paid';
    return { total, paid, balance, isPartial };
}

/** Normalize backend invoice payload into the shape InvoiceDetailsModal expects. */
function normalizeInvoiceForModal(invoice) {
    if (!invoice || typeof invoice !== 'object') return invoice;
    const srcOrder = invoice.salesOrder || invoice.sales_order || {};
    const srcCustomer = srcOrder.customer || invoice.customer || {};
    const srcVehicle = srcOrder.vehicle || invoice.vehicle || {};
    const srcJobs = Array.isArray(srcOrder.jobs)
        ? srcOrder.jobs
        : Array.isArray(invoice.jobs) ? invoice.jobs : [];
    return {
        ...invoice,
        order: { ...srcOrder, jobs: srcJobs },
        jobs: srcJobs,
        customer: srcCustomer,
        vehicle: srcVehicle,
        branch: invoice.branch || srcOrder.branch,
        workshop: invoice.workshop || srcOrder.workshop,
        paymentMethod: invoice.paymentMethod || invoice.payments?.[0]?.method,
    };
}

/** Build {headers, rows} mirroring the on-screen table — used for PDF/Excel export. */
function buildReceiptExportRows(list, t) {
    const headers = [
        t('th.receiptNo'), t('th.paymentDate'), t('th.invoiceNo'), t('th.customer'),
        t('th.workshop'), t('th.branch'), t('th.method'), t('th.total'), t('th.paid'), t('th.balance'), t('th.status'),
    ];
    const rows = (list || []).map((r) => {
        const { total, paid, balance, isPartial } = receiptAmounts(r);
        const method = (r.paymentMethod || '—').toString().replace(/_/g, ' ');
        const via = (r.deferredPaymentMethod || t('monthlyBilling')).toString().replace(/_/g, ' ');
        return [
            r.receiptNo ?? '—',
            formatDate(r.paymentDate ?? r.issuedAt ?? r.invoiceDate),
            r.invoiceNo ?? '—',
            r.corporateAccountName ?? r.customerName ?? '—',
            r.workshopName ?? '—',
            r.branchName ?? '—',
            t('methodVia', { method, via }),
            round2(total),
            round2(paid),
            round2(balance),
            isPartial ? t('status.partial') : t('status.paid'),
        ];
    });
    return { headers, rows };
}

/**
 * Admin → Sales → Receipts. Monthly-billing invoices that have actually been
 * settled (real, non-phantom payments cover the total). Newest settlement first.
 */
export default function Receipts() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => rcT(locale, key, vars), [locale]);

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [companyOptions, setCompanyOptions] = useState([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exporting, setExporting] = useState(false);
    const [summary, setSummary] = useState(null);
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
    const [invoiceErr, setInvoiceErr] = useState('');

    // Debounced so the server sees a settled term, not every keystroke.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    /**
     * The search goes to the server with everything else. It used to filter the
     * 50 rows already on screen, so a receipt on any other page simply could
     * not be found — and the KPI row had to fall back to the visible rows
     * whenever something was typed.
     */
    const listQuery = useMemo(() => ({
        workshopId: selectedWorkshopId || undefined,
        branchId: selectedBranchId || undefined,
        corporateAccountId: selectedCompanyId || undefined,
        search: debouncedSearch || undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
    }), [
        selectedWorkshopId, selectedBranchId, selectedCompanyId, debouncedSearch, dateFrom, dateTo,
    ]);

    const resetKey = [
        selectedWorkshopId, selectedBranchId, selectedCompanyId, dateFrom, dateTo, debouncedSearch,
    ].join('|');
    const { page, pageSize, pagerFor } = useServerPaging({ resetKey });

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getSuperAdminReceipts({
                ...listQuery,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            });
            const list = Array.isArray(res?.receipts)
                ? res.receipts
                : Array.isArray(res?.items) ? res.items
                : Array.isArray(res) ? res : [];
            setRows(list);
            setTotal(Number(res?.total) || list.length);
            setSummary(res?.summary ?? null);
        } catch (e) {
            setError(e?.message || t('err.load'));
            setRows([]);
            setTotal(0);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [listQuery, page, pageSize, t]);

    useEffect(() => { void load(); }, [load]);

    // Companies for the Company filter (scoped to the selected workshop).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getSuperAdminCorporateCompanies({ workshopId: selectedWorkshopId || undefined });
                const list = Array.isArray(res?.companies) ? res.companies : [];
                if (!cancelled) {
                    setCompanyOptions(list.map((c) => ({ id: String(c.id), name: String(c.companyName || '').trim() || t('fallback.company') })));
                    setSelectedCompanyId('');
                }
            } catch {
                if (!cancelled) { setCompanyOptions([]); setSelectedCompanyId(''); }
            }
        })();
        return () => { cancelled = true; };
    }, [selectedWorkshopId, t]);

    // Workshop options (load once).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getWorkshopOptions();
                const list = Array.isArray(res?.workshops)
                    ? res.workshops
                    : Array.isArray(res?.data?.workshops) ? res.data.workshops
                    : Array.isArray(res) ? res : [];
                if (!cancelled) {
                    setWorkshopOptions(list.map((w) => ({
                        id: String(w.id),
                        name: String(w.name || '').trim() || t('fallback.workshop'),
                    })));
                }
            } catch {
                if (!cancelled) setWorkshopOptions([]);
            }
        })();
        return () => { cancelled = true; };
    }, [t]);

    // Branches for the selected workshop.
    useEffect(() => {
        if (!selectedWorkshopId) {
            setBranchOptions([]);
            setSelectedBranchId('');
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await getBranches({ workshopId: selectedWorkshopId });
                const list = Array.isArray(res?.branches)
                    ? res.branches
                    : Array.isArray(res?.data?.branches) ? res.data.branches : [];
                if (!cancelled) {
                    setBranchOptions(list.map((b) => ({
                        id: String(b.id),
                        name: String(b.name || '').trim() || t('fallback.branch'),
                    })));
                    setSelectedBranchId('');
                }
            } catch {
                if (!cancelled) {
                    setBranchOptions([]);
                    setSelectedBranchId('');
                }
            }
        })();
        return () => { cancelled = true; };
    }, [selectedWorkshopId, t]);

    // Export the FULL filtered set: one bounded re-fetch with the same filters.
    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setError('');
        try {
            const res = await getSuperAdminReceipts({
                ...listQuery,
                limit: EXPORT_LIMIT,
                offset: 0,
            });
            const list = Array.isArray(res?.receipts) ? res.receipts
                : Array.isArray(res?.items) ? res.items
                : Array.isArray(res) ? res : [];
            const { headers, rows: outRows } = buildReceiptExportRows(list, t);
            const subtitle = (dateFrom || dateTo)
                ? t('export.subtitleRange', { n: outRows.length, from: dateFrom || '…', to: dateTo || '…' })
                : t('export.subtitle', { n: outRows.length });
            if (kind === 'pdf') {
                exportRowsToPdf({ title: t('export.title'), subtitle, headers, rows: outRows, filenameBase: 'receipts' });
            } else {
                exportRowsToExcel({ sheetName: t('export.sheet'), headers, rows: outRows, filenameBase: 'receipts' });
            }
        } catch (e) {
            setError(e?.message || t('err.export'));
        } finally {
            setExporting(false);
        }
    }, [listQuery, dateFrom, dateTo, t]);

    // The server `summary` spans every page for the active filters — search
    // included, now that the search is a filter the server knows about.
    const { totalBilled, totalCollected, kpiCount } = useMemo(() => {
        if (summary) {
            return {
                totalBilled: Number(summary.totalBilled ?? 0),
                totalCollected: Number(summary.totalCollected ?? 0),
                kpiCount: Number(summary.count ?? 0),
            };
        }
        let billed = 0;
        let collected = 0;
        for (const r of rows) {
            billed += Number(r.totalAmount ?? 0);
            collected += Number(r.amountPaid ?? r.totalAmount ?? 0);
        }
        return { totalBilled: billed, totalCollected: collected, kpiCount: rows.length };
    }, [rows, summary]);

    const openInvoice = async (invoiceId) => {
        if (!invoiceId) return;
        setInvoiceLoadingId(String(invoiceId));
        setInvoiceErr('');
        try {
            const raw = await getSuperAdminInvoiceView(invoiceId);
            const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
            setInvoice(normalizeInvoiceForModal(inv));
        } catch (e) {
            setInvoiceErr(e?.message || t('err.invoice'));
        } finally {
            setInvoiceLoadingId(null);
        }
    };

    if (invoice) {
        const invTitle = invoice.invoiceNo
            ? `${t('view')} · ${invoice.invoiceNo}`
            : t('view');
        return (
            <AdminScreenShell
                title={invTitle}
                onBack={() => setInvoice(null)}
                wide
                footer={(
                    <>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={() => window.print()}
                        >
                            <Printer size={14} /> {t('btn.print')}
                        </button>
                        {/* Was labelled "View" — the same key as the title. */}
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary"
                            onClick={() => setInvoice(null)}
                        >
                            {t('btn.close')}
                        </button>
                    </>
                )}
            >
                {/* `ui-print-root` is what the Print button prints — without it
                    window.print() took the whole screen, sidebar and all. */}
                <div className="ui-sheet ui-print-root">
                    <CashierTaxInvoiceView invoice={invoice} />
                </div>
            </AdminScreenShell>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-row">
                <div className="ui-head">
                    <h1>
                        <ReceiptText size={18} /> {t('title')}
                    </h1>
                    <p>{t('subtitle')}</p>
                </div>
                <div className="ui-toolbar-end">
                    <ExportMenu
                        onPdf={() => runExport('pdf')}
                        onExcel={() => runExport('excel')}
                        busy={exporting}
                        disabled={loading}
                        locale={locale}
                    />
                    <button
                        type="button"
                        className="ui-btn ui-btn--default"
                        onClick={() => load()}
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'ui-spin' : ''} /> {t('refresh')}
                    </button>
                </div>
            </div>

            <div className="ui-kpis">
                {[
                    { key: 'count', label: t('kpi.receipts'), value: Number(kpiCount).toLocaleString() },
                    { key: 'billed', label: t('kpi.billed'), value: num(t, totalBilled) },
                    { key: 'collected', label: t('kpi.collected'), value: num(t, totalCollected), tone: 'ok' },
                ].map((k) => (
                    <div key={k.key} className={`ui-metric${k.tone ? ` ui-metric--${k.tone}` : ''}`}>
                        <div className="ui-metric-label">{k.label}</div>
                        <div className="ui-metric-value">
                            {loading ? <span className="ui-sk ui-sk--title ui-sk--w70" /> : k.value}
                        </div>
                    </div>
                ))}
            </div>

            <div className="ui-row ui-row--fields">
                <div className="ui-field ui-field--grow">
                    <label htmlFor="rc-search">{t('label.search')}</label>
                    <div className="ui-search">
                        <Search size={15} />
                        <input
                            id="rc-search"
                            type="search"
                            className="ui-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('search.placeholder')}
                        />
                    </div>
                </div>
                <div className="ui-field">
                    <label htmlFor="rc-workshop">{t('label.workshop')}</label>
                    <select
                        id="rc-workshop"
                        className="ui-select"
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                    >
                        <option value="">{t('all.workshops')}</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="rc-branch">{t('label.branch')}</label>
                    <select
                        id="rc-branch"
                        className="ui-select"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId}
                        title={selectedWorkshopId ? '' : t('hint.selectWorkshop')}
                    >
                        <option value="">{t('all.branches')}</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="rc-company">{t('label.company')}</label>
                    <select
                        id="rc-company"
                        className="ui-select"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                        <option value="">{t('all.companies')}</option>
                        {companyOptions.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="rc-from">{t('label.from')}</label>
                    <input
                        id="rc-from"
                        type="datetime-local"
                        className="ui-input"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        step={60}
                    />
                </div>
                <div className="ui-field">
                    <label htmlFor="rc-to">{t('label.to')}</label>
                    <input
                        id="rc-to"
                        type="datetime-local"
                        className="ui-input"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        step={60}
                    />
                </div>
            </div>

            {error ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                </div>
            ) : null}

            {invoiceErr ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertTriangle size={14} />
                    <span>{t('invoiceFailed', { msg: invoiceErr })}</span>
                    <button
                        type="button"
                        className="ui-banner-x"
                        onClick={() => setInvoiceErr('')}
                        aria-label={t('btn.close')}
                    >
                        <X size={14} />
                    </button>
                </div>
            ) : null}

            <div className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('th.receiptNo')}</th>
                            <th>{t('th.paymentDate')}</th>
                            <th>{t('th.invoiceNo')}</th>
                            <th>{t('th.customer')}</th>
                            <th>{t('th.workshopBranch')}</th>
                            <th>{t('th.method')}</th>
                            <th>{t('th.total')}</th>
                            <th>{t('th.paid')}</th>
                            <th>{t('th.balance')}</th>
                            <th>{t('th.status')}</th>
                            <th>{t('th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={`sk-${i}`} className="ui-sk-row">
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                    <td><div className="ui-sk ui-sk--pill" /></td>
                                    <td><div className="ui-sk ui-sk--btn" /></td>
                                </tr>
                            ))
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={11}>
                                    <div className="ui-empty">
                                        <div className="ui-empty-icon"><ReceiptText size={18} /></div>
                                        <div className="ui-empty-title">{t('empty')}</div>
                                    </div>
                                </td>
                            </tr>
                        ) : rows.map((r) => {
                            const { total, paid, balance, isPartial } = receiptAmounts(r);
                            const viaRaw = (r.deferredPaymentMethod || t('monthlyBilling')).toString().replace(/_/g, ' ');
                            const busy = invoiceLoadingId === String(r.id);
                            return (
                                <tr key={r.id}>
                                    <td data-label={t('th.receiptNo')} className="ui-nowrap ui-strong">
                                        {r.receiptNo ?? '—'}
                                    </td>
                                    <td data-label={t('th.paymentDate')} className="ui-nowrap">
                                        {formatDate(r.paymentDate ?? r.issuedAt ?? r.invoiceDate)}
                                    </td>
                                    <td data-label={t('th.invoiceNo')} className="ui-strong">
                                        {r.invoiceNo ?? '—'}
                                    </td>
                                    <td data-label={t('th.customer')} className="ui-strong">
                                        {r.corporateAccountName ?? r.customerName ?? '—'}
                                    </td>
                                    <td data-label={t('th.workshopBranch')}>
                                        <div>{r.workshopName ?? '—'}</div>
                                        <div className="ui-meta">{r.branchName ?? '—'}</div>
                                    </td>
                                    <td data-label={t('th.method')}>
                                        <div>{(r.paymentMethod || '—').toString().replace(/_/g, ' ')}</div>
                                        <div className="ui-meta">{t('via', { method: viaRaw })}</div>
                                    </td>
                                    <td data-label={t('th.total')} className="ui-num">
                                        {num(t, total)}
                                    </td>
                                    <td data-label={t('th.paid')} className="ui-num ui-money ui-money--in">
                                        {num(t, paid)}
                                    </td>
                                    <td
                                        data-label={t('th.balance')}
                                        className={`ui-num ui-money${balance > 0 ? ' ui-money--out' : ''}`}
                                    >
                                        {num(t, balance)}
                                    </td>
                                    <td data-label={t('th.status')}>
                                        <span className={`ui-pill ui-pill--${isPartial ? 'warn' : 'ok'}`}>
                                            {isPartial ? t('status.partial') : t('status.paid')}
                                        </span>
                                    </td>
                                    <td data-label={t('th.actions')}>
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--default ui-btn--sm"
                                            onClick={() => openInvoice(r.id)}
                                            disabled={busy}
                                        >
                                            {busy
                                                ? <Loader2 size={12} className="ui-spin" />
                                                : <FileText size={12} />}
                                            {t('view')}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <UiPager {...pagerFor(total)} />
            </div>
        </div>
    );
}
