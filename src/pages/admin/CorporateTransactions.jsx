import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Loader2, RefreshCw, FileText, Printer, X } from 'lucide-react';
import '../../styles/ui.css';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import AdminScreenShell from '../../components/admin/AdminScreenShell';
import CashierTaxInvoiceView from '../../components/pos/modern/CashierTaxInvoiceView';
import '../../components/pos/modern/CashierTaxInvoiceView.css';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
import {
    getSuperAdminInvoiceView,
    getWorkshopOptions,
    getBranches,
    getInvoices,
    getInvoice,
    getSuperAdminCorporateCompanies,
} from '../../services/superAdminApi';
import { ExportMenu } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';
import { ctT } from '../../utils/corporateTransactionsI18n';
import {
    loadSaAccountingDateRange,
    saveSaAccountingDateRange,
    startOfMonthISO,
    todayISO,
} from './saAccountingDateRange';

/** Calendar YYYY-MM-DD — same period as Corporate Billing. Never datetime-local. */
function periodDateParam(raw) {
    const m = String(raw || '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
}

// Upper bound for the one-shot "export everything matching the filters" fetch.
const EXPORT_LIMIT = 5000;
const round2 = (n) => Number(Number(n ?? 0).toFixed(2));

const num = (v, t) =>
    t('money.sar', {
        amount: Number(v ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }),
    });

function corporateCustomerName(r) {
    return (
        r?.corporateAccountName
        ?? r?.corporate?.companyName
        ?? r?.customerName
        ?? r?.customer?.name
        ?? '—'
    );
}

/**
 * Dates render in the business timezone. The API sends UTC instants, so an
 * invoice issued late on the 1st in Riyadh otherwise reads as the 31st on any
 * browser set west of it.
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

function formatDateTime(raw) {
    if (raw == null || raw === '') return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString(undefined, {
        timeZone: BUSINESS_TIMEZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

function formatStatusLabel(status) {
    if (status == null || String(status).trim() === '') return '—';
    return String(status)
        .trim()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function orderTypeLabel(source, t) {
    const src = String(source ?? '').toLowerCase();
    if (src === 'walk_in_corporate') return t('orderType.walkIn');
    if (src === 'corporate_app') return t('orderType.booking');
    return t('orderType.corporate');
}

/**
 * Collected and outstanding for a row.
 *
 * Prefer the server-computed REAL values, which exclude the placeholder
 * payments monthly billing writes; fall back to the raw fields so the page
 * still adds up against a backend that has not been redeployed yet.
 */
function realAmounts(r, data) {
    const total = Number(r?.totalAmount ?? r?.grandTotal ?? data?.totalAmount ?? 0);
    const balance = r?.realBalance != null
        ? Number(r.realBalance)
        : Number(r?.balance ?? data?.balance ?? 0);
    const paid = r?.realPaid != null
        ? Number(r.realPaid)
        : Math.max(0, total - balance);
    return { total, paid, balance };
}

/** Build {headers, rows} mirroring the on-screen table — used for PDF/Excel export. */
function buildCorporateExportRows(list, t) {
    const headers = [
        t('th.invoiceDate'), t('th.invoiceNo'), t('th.customer'), t('th.vehicle'), t('th.orderType'),
        t('filter.workshop'), t('filter.branch'), t('th.status'), t('th.invoiceAmount'), t('th.receiptAmount'), t('th.balance'),
    ];
    const rows = (list || []).map((r) => {
        const { total, paid, balance } = realAmounts(r);
        const realStatus = String(r.realPaymentStatus ?? r.paymentStatus ?? '').toLowerCase();
        const statusLabel = realStatus === 'paid' || balance <= 0.01
            ? t('status.paid')
            : realStatus === 'partial' || paid > 0.01 ? t('status.partial') : t('status.notPaid');
        return [
            formatDate(r.invoiceDate ?? r.invoice_date ?? r.createdAt),
            r.invoiceNo ?? r.invoice_no ?? '—',
            corporateCustomerName(r),
            r.plateNo ?? r.vehicle?.plateNo ?? r.vehicleNumber ?? '—',
            orderTypeLabel(r.orderSource, t),
            r.workshopName ?? r.workshop?.name ?? '—',
            r.branchName ?? r.branch?.name ?? '—',
            statusLabel,
            round2(total),
            round2(paid),
            round2(balance),
        ];
    });
    return { headers, rows };
}

/** Normalize backend invoice payload into the shape InvoiceDetailsModal expects. */
function normalizeInvoiceForModal(invoice) {
    if (!invoice || typeof invoice !== 'object') return invoice;
    const srcOrder = invoice.salesOrder || invoice.sales_order || {};
    const srcCustomer = srcOrder.customer || invoice.customer || {};
    const srcVehicle = srcOrder.vehicle || invoice.vehicle || {};
    const srcJobs = Array.isArray(srcOrder.jobs)
        ? srcOrder.jobs
        : Array.isArray(invoice.jobs)
            ? invoice.jobs
            : [];
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

export default function CorporateTransactions() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => ctT(locale, key, vars), [locale]);

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
    // Same calendar range as Corporate Billing (YYYY-MM-DD, Asia/Riyadh days).
    const [dateFrom, setDateFrom] = useState(
        () => periodDateParam(loadSaAccountingDateRange().dateFrom) || startOfMonthISO(),
    );
    const [dateTo, setDateTo] = useState(
        () => periodDateParam(loadSaAccountingDateRange().dateTo) || todayISO(),
    );
    const [exporting, setExporting] = useState(false);
    // Server-computed KPI totals across ALL pages (not just this page's rows).
    const [summary, setSummary] = useState(null);
    const [detailRow, setDetailRow] = useState(null);
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [invoice, setInvoice] = useState(null);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    // Error from the last invoice fetch (kept so we can surface it to the user
    // if the call fails — otherwise the View button used to spin forever
    // because openInvoice called setInvoiceErr() which was undefined →
    // ReferenceError thrown BEFORE the try/finally → loading state never reset).
    const [invoiceErr, setInvoiceErr] = useState('');

    // Debounce search so we query the server across ALL pages, not just the current slice.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Every filter is part of the reset key, so changing one goes back to the
    // first page during the same render: an offset past the new total returns
    // nothing, and the user would see an empty table.
    const resetKey = [
        selectedWorkshopId, selectedBranchId, selectedCompanyId, dateFrom, dateTo, debouncedSearch,
    ].join('|');
    const { page, pageSize, pagerFor } = useServerPaging({ resetKey });

    const listQuery = useMemo(() => ({
        workshopId: selectedWorkshopId || undefined,
        branchId: selectedBranchId || undefined,
        corporateAccountId: selectedCompanyId || undefined,
        startDate: periodDateParam(dateFrom) || undefined,
        endDate: periodDateParam(dateTo) || undefined,
        search: debouncedSearch || undefined,
        corporateOnly: true,
    }), [
        selectedWorkshopId, selectedBranchId, selectedCompanyId, dateFrom, dateTo, debouncedSearch,
    ]);

    // Server-side pagination. The server returns paid + unpaid + overdue +
    // partial in one payload; each row carries the status we render as a badge.
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getInvoices({
                ...listQuery,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            });
            const list = Array.isArray(res?.invoices)
                ? res.invoices
                : Array.isArray(res?.items) ? res.items
                : Array.isArray(res) ? res
                : [];
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

    useEffect(() => {
        void load();
    }, [load]);

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
                    : Array.isArray(res?.data?.workshops)
                        ? res.data.workshops
                        : Array.isArray(res)
                            ? res
                            : [];
                if (!cancelled) {
                    setWorkshopOptions(
                        list.map((w) => ({ id: String(w.id), name: String(w.name || '').trim() || t('fallback.workshop') })),
                    );
                }
            } catch {
                if (!cancelled) setWorkshopOptions([]);
            }
        })();
        return () => {
            cancelled = true;
        };
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
                    : Array.isArray(res?.data?.branches)
                        ? res.data.branches
                        : [];
                if (!cancelled) {
                    setBranchOptions(
                        list.map((b) => ({ id: String(b.id), name: String(b.name || '').trim() || t('fallback.branch') })),
                    );
                    setSelectedBranchId('');
                }
            } catch {
                if (!cancelled) {
                    setBranchOptions([]);
                    setSelectedBranchId('');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedWorkshopId, t]);

    // Export the FULL filtered set (not just the current page): one bounded
    // re-fetch with the active filters (including server-side search).
    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setError('');
        try {
            const res = await getInvoices({
                ...listQuery,
                limit: EXPORT_LIMIT,
                offset: 0,
            });
            const all = Array.isArray(res?.invoices) ? res.invoices
                : Array.isArray(res?.items) ? res.items
                : Array.isArray(res) ? res : [];
            const { headers, rows: outRows } = buildCorporateExportRows(all, t);
            const subtitle = t('export.rows', { n: outRows.length })
                + (dateFrom || dateTo ? ` · ${dateFrom || '…'} → ${dateTo || '…'}` : '');
            if (kind === 'pdf') {
                exportRowsToPdf({ title: t('export.title'), subtitle, headers, rows: outRows, filenameBase: 'corporate-transactions' });
            } else {
                exportRowsToExcel({ sheetName: t('export.sheet'), headers, rows: outRows, filenameBase: 'corporate-transactions' });
            }
        } catch (e) {
            setError(e?.message || t('err.export'));
        } finally {
            setExporting(false);
        }
    }, [listQuery, dateFrom, dateTo, t]);

    // KPI totals — server `summary` spans ALL pages for the active filters + search.
    const { totalBilled, totalCollected, totalOutstanding, kpiCount } = useMemo(() => {
        if (summary) {
            return {
                totalBilled: Number(summary.totalBilled ?? 0),
                totalCollected: Number(summary.totalCollected ?? 0),
                totalOutstanding: Number(summary.totalOutstanding ?? 0),
                kpiCount: Number(summary.count ?? 0),
            };
        }
        let billed = 0;
        let collected = 0;
        let outstanding = 0;
        for (const r of rows) {
            const { total, paid, balance } = realAmounts(r);
            billed += total;
            collected += paid;
            outstanding += balance;
        }
        return { totalBilled: billed, totalCollected: collected, totalOutstanding: outstanding, kpiCount: rows.length };
    }, [rows, summary]);

    const openDetails = useCallback(async (row) => {
        if (!row?.id) return;
        setDetailRow(row);
        setDetailLoading(true);
        setDetailError('');
        setDetailData(null);
        try {
            const res = await getInvoice(row.id);
            const payload =
                res && typeof res === 'object' && res.data && typeof res.data === 'object'
                    ? res.data
                    : res;
            setDetailData(payload && typeof payload === 'object' ? payload : null);
        } catch (e) {
            setDetailError(e?.message || t('err.detail'));
        } finally {
            setDetailLoading(false);
        }
    }, [t]);

    const closeDetails = useCallback(() => {
        setDetailRow(null);
        setDetailData(null);
        setDetailError('');
        setDetailLoading(false);
    }, []);

    const openTaxInvoice = async () => {
        const invoiceId = detailData?.id ?? detailRow?.id;
        if (!invoiceId) return;
        setInvoiceLoading(true);
        setInvoiceErr('');
        try {
            const raw = await getSuperAdminInvoiceView(invoiceId);
            const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
            setInvoice(normalizeInvoiceForModal(inv));
        } catch (e) {
            setInvoiceErr(e?.message || t('err.invoice'));
        } finally {
            setInvoiceLoading(false);
        }
    };

    if (invoice) {
        const invTitle = invoice.invoiceNo
            ? t('modal.titleWithNo', { no: invoice.invoiceNo })
            : t('btn.viewInvoice');
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
                {/* `ui-print-root` is what the Print button above actually
                    prints — without it window.print() took the whole screen,
                    sidebar and all. */}
                <div className="ui-sheet ui-print-root">
                    <CashierTaxInvoiceView invoice={invoice} />
                </div>
            </AdminScreenShell>
        );
    }

    if (detailRow) {
        return (
            <CorporateTransactionDetailsModal
                row={detailRow}
                data={detailData}
                loading={detailLoading}
                error={detailError}
                invoiceLoading={invoiceLoading}
                onClose={closeDetails}
                onViewInvoice={openTaxInvoice}
                t={t}
            />
        );
    }

    const periodLine = summary?.dateFrom || summary?.dateTo || dateFrom || dateTo
        ? t('kpi.period', {
            from: summary?.dateFrom || dateFrom || '…',
            to: summary?.dateTo || dateTo || '…',
        })
        : t('kpi.periodAll');

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-row">
                <div className="ui-head">
                    <h1>{t('page.title')}</h1>
                    <p>{periodLine}</p>
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
                        <RefreshCw size={14} className={loading ? 'ui-spin' : ''} /> {t('btn.refresh')}
                    </button>
                </div>
            </div>

            <div className="ui-kpis">
                {[
                    { key: 'invoices', label: t('kpi.invoices'), value: Number(kpiCount).toLocaleString() },
                    { key: 'billed', label: t('kpi.totalBilled'), value: num(totalBilled, t) },
                    { key: 'collected', label: t('kpi.collected'), value: num(totalCollected, t), tone: 'ok' },
                    {
                        key: 'outstanding',
                        label: t('kpi.outstanding'),
                        value: num(totalOutstanding, t),
                        tone: totalOutstanding > 0 ? 'dang' : 'ok',
                    },
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
                    <label htmlFor="ct-search">{t('filter.search')}</label>
                    <input
                        id="ct-search"
                        type="search"
                        className="ui-input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('search.placeholder')}
                    />
                </div>
                <div className="ui-field">
                    <label htmlFor="ct-workshop">{t('filter.workshop')}</label>
                    <select
                        id="ct-workshop"
                        className="ui-select"
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                    >
                        <option value="">{t('filter.allWorkshops')}</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="ct-branch">{t('filter.branch')}</label>
                    <select
                        id="ct-branch"
                        className="ui-select"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId}
                        title={selectedWorkshopId ? '' : t('filter.selectWorkshopFirst')}
                    >
                        <option value="">{t('filter.allBranches')}</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="ct-company">{t('filter.company')}</label>
                    <select
                        id="ct-company"
                        className="ui-select"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                    >
                        <option value="">{t('filter.allCompanies')}</option>
                        {companyOptions.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                {/* Calendar days, not datetime — the same period Corporate Billing uses. */}
                <div className="ui-field">
                    <label htmlFor="ct-from">{t('date.from')}</label>
                    <input
                        id="ct-from"
                        type="date"
                        className="ui-input"
                        value={periodDateParam(dateFrom)}
                        max={periodDateParam(dateTo) || undefined}
                        onChange={(e) => {
                            const v = periodDateParam(e.target.value);
                            setDateFrom(v);
                            saveSaAccountingDateRange({
                                dateFrom: v || startOfMonthISO(),
                                dateTo: periodDateParam(dateTo) || todayISO(),
                            });
                        }}
                    />
                </div>
                <div className="ui-field">
                    <label htmlFor="ct-to">{t('date.to')}</label>
                    <input
                        id="ct-to"
                        type="date"
                        className="ui-input"
                        value={periodDateParam(dateTo)}
                        min={periodDateParam(dateFrom) || undefined}
                        onChange={(e) => {
                            const v = periodDateParam(e.target.value);
                            setDateTo(v);
                            saveSaAccountingDateRange({
                                dateFrom: periodDateParam(dateFrom) || startOfMonthISO(),
                                dateTo: v || todayISO(),
                            });
                        }}
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
                    <span>{t('err.invoiceView', { msg: invoiceErr })}</span>
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
                <InvoicesTable
                    loading={loading}
                    filtered={rows}
                    detailLoadingId={detailLoading ? String(detailRow?.id ?? '') : ''}
                    onOpenDetails={openDetails}
                    t={t}
                />
                <UiPager {...pagerFor(total)} />
            </div>
        </div>
    );
}

/* ───────── Invoices table (only corporate + sales-order status=invoiced) ── */

/** Three-state payment badge derived from collected vs outstanding:
 *    balance ≈ 0            → Paid
 *    paid > 0 & balance > 0 → Partially Paid
 *    paid ≈ 0               → Not Paid  */
function PaidStatusBadge({ paid = 0, balance = 0, t }) {
    const EPS = 0.01;
    const p = Number(paid) || 0;
    const b = Number(balance) || 0;
    const [tone, label] = b <= EPS
        ? ['ok', t('status.paid')]
        : p > EPS
            ? ['warn', t('status.partial')]
            : ['dang', t('status.notPaid')];
    return <span className={`ui-pill ui-pill--${tone}`}>{label}</span>;
}

/** Distinguish the two corporate-order origins by the SalesOrder.source field:
 *    - 'walk_in_corporate' → cashier created the order for a corporate
 *      customer directly at the POS (no prior booking).
 *    - 'corporate_app'     → the corporate user sent a booking request that
 *      the cashier accepted; it then became an order.
 *  This page is filtered server-side to corporate orders only, so any other
 *  source value falls back to a generic "Corporate" label as a defensive
 *  catch-all (shouldn't appear in normal use). */
function OrderTypeBadge({ row, t }) {
    const src = String(row.orderSource ?? '').toLowerCase();
    // The booking came through the app; a walk-in was rung up at the counter.
    const tone = src === 'corporate_app' ? 'info' : 'neutral';
    return <span className={`ui-pill ui-pill--${tone}`}>{orderTypeLabel(src, t)}</span>;
}

function InvoicesTable({ loading, filtered, detailLoadingId, onOpenDetails, t }) {
    return (
        <table className="ui-table">
            <thead>
                <tr>
                    <th>{t('th.invoiceDate')}</th>
                    <th>{t('th.invoiceNo')}</th>
                    <th>{t('th.customer')}</th>
                    <th>{t('th.vehicle')}</th>
                    <th>{t('th.orderType')}</th>
                    <th>{t('th.workshopBranch')}</th>
                    <th>{t('th.status')}</th>
                    <th>{t('th.invoiceAmount')}</th>
                    <th>{t('th.receiptAmount')}</th>
                    <th>{t('th.balance')}</th>
                    <th>{t('th.actions')}</th>
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <tr key={`sk-${i}`} className="ui-sk-row">
                            <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                            <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                            <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                            <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                            <td><div className="ui-sk ui-sk--pill" /></td>
                            <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                            <td><div className="ui-sk ui-sk--pill" /></td>
                            <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                            <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                            <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                            <td><div className="ui-sk ui-sk--btn" /></td>
                        </tr>
                    ))
                ) : filtered.length === 0 ? (
                    <tr>
                        <td colSpan={11}>
                            <div className="ui-empty">
                                <div className="ui-empty-icon"><FileText size={18} /></div>
                                <div className="ui-empty-title">{t('empty')}</div>
                            </div>
                        </td>
                    </tr>
                ) : filtered.map((r) => {
                    const { total, paid, balance } = realAmounts(r);
                    const busy = detailLoadingId === String(r.id);
                    return (
                        <tr key={r.id}>
                            <td data-label={t('th.invoiceDate')} className="ui-nowrap">
                                {formatDate(r.invoiceDate ?? r.invoice_date ?? r.createdAt)}
                            </td>
                            <td data-label={t('th.invoiceNo')} className="ui-strong">
                                {r.invoiceNo ?? r.invoice_no ?? '—'}
                            </td>
                            <td data-label={t('th.customer')} className="ui-strong">
                                {corporateCustomerName(r)}
                            </td>
                            <td data-label={t('th.vehicle')} className="ui-num">
                                {r.plateNo ?? r.vehicle?.plateNo ?? r.vehicleNumber ?? '—'}
                            </td>
                            <td data-label={t('th.orderType')}>
                                <OrderTypeBadge row={r} t={t} />
                            </td>
                            <td data-label={t('th.workshopBranch')}>
                                <div>{r.workshopName ?? r.workshop?.name ?? '—'}</div>
                                <div className="ui-meta">{r.branchName ?? r.branch?.name ?? '—'}</div>
                            </td>
                            <td data-label={t('th.status')}>
                                <PaidStatusBadge paid={paid} balance={balance} t={t} />
                            </td>
                            <td data-label={t('th.invoiceAmount')} className="ui-num">
                                {num(total, t)}
                            </td>
                            <td data-label={t('th.receiptAmount')} className="ui-num ui-money ui-money--in">
                                {num(paid, t)}
                            </td>
                            <td
                                data-label={t('th.balance')}
                                className={`ui-num ui-money${balance > 0 ? ' ui-money--out' : ''}`}
                            >
                                {num(balance, t)}
                            </td>
                            <td data-label={t('th.actions')}>
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--default ui-btn--sm"
                                    onClick={() => onOpenDetails(r)}
                                    disabled={busy}
                                >
                                    {busy
                                        ? <Loader2 size={12} className="ui-spin" />
                                        : <FileText size={12} />}
                                    {t('btn.view')}
                                </button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/** A labelled block of rows inside the details view. */
function DetailTable({ title, children }) {
    return (
        <section className="ui-panel">
            {title ? (
                <div className="ui-panel-head">
                    <span className="ui-panel-title">{title}</span>
                </div>
            ) : null}
            <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                <table className="ui-table">{children}</table>
            </div>
        </section>
    );
}

/** Summary + line items modal — tax invoice opens separately via "View invoice". */
function CorporateTransactionDetailsModal({
    row,
    data,
    loading,
    error,
    invoiceLoading,
    onClose,
    onViewInvoice,
    t,
}) {
    const { paid: realPaid, balance: realBalance } = realAmounts(row, data);

    const invNo = data?.invoiceNo || row?.invoiceNo;
    const modalTitle = invNo
        ? t('modal.titleWithNo', { no: invNo })
        : t('modal.title');

    return (
        <AdminModalAsScreen
            title={modalTitle}
            onClose={onClose}
            wide
            footer={data && !loading && !error ? (
                <>
                    <button type="button" className="ui-btn ui-btn--default" onClick={onClose}>
                        {t('btn.close')}
                    </button>
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        onClick={onViewInvoice}
                        disabled={invoiceLoading}
                    >
                        {invoiceLoading
                            ? <Loader2 size={14} className="ui-spin" />
                            : <Printer size={14} />}
                        {t('btn.viewInvoice')}
                    </button>
                </>
            ) : null}
        >
            {loading ? (
                <div className="ui-stack-sm" aria-busy="true">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={`sk-${i}`} className="ui-sk-row">
                            <div className="ui-sk ui-sk--text ui-sk--w90" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="ui-banner ui-banner--dang">
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                </div>
            ) : data ? (
                <div className="ui-stack">
                    <DetailTable>
                        <tbody>
                            <tr><th>{t('modal.invoiceNo')}</th><td>{data.invoiceNo ?? row?.invoiceNo ?? '—'}</td></tr>
                            <tr>
                                <th>{t('modal.invoiceDate')}</th>
                                <td>{formatDateTime(data.issuedAt ?? data.invoiceDate ?? row?.invoiceDate)}</td>
                            </tr>
                            <tr>
                                <th>{t('modal.corporateAccount')}</th>
                                <td>{corporateCustomerName(row) !== '—' ? corporateCustomerName(row) : (data.customer?.name ?? '—')}</td>
                            </tr>
                            <tr>
                                <th>{t('modal.orderType')}</th>
                                <td>{orderTypeLabel(data.salesOrder?.source ?? row?.orderSource, t)}</td>
                            </tr>
                            <tr><th>{t('modal.workshop')}</th><td>{data.workshopName ?? row?.workshopName ?? '—'}</td></tr>
                            <tr><th>{t('modal.branch')}</th><td>{data.branchName ?? row?.branchName ?? '—'}</td></tr>
                            <tr><th>{t('modal.orderNo')}</th><td>{data.salesOrder?.id ?? row?.salesOrderId ?? '—'}</td></tr>
                            <tr><th>{t('modal.orderStatus')}</th><td>{formatStatusLabel(data.salesOrder?.status ?? row?.orderStatus)}</td></tr>
                            <tr>
                                <th>{t('modal.orderCreated')}</th>
                                <td>{formatDateTime(data.salesOrder?.createdAt)}</td>
                            </tr>
                            <tr><th>{t('modal.customer')}</th><td>{data.customer?.name ?? '—'}</td></tr>
                            <tr><th>{t('modal.phone')}</th><td>{data.customer?.mobile ?? row?.customerMobile ?? '—'}</td></tr>
                            <tr>
                                <th>{t('modal.vehicle')}</th>
                                <td>
                                    {data.vehicle?.plateNo ?? row?.plateNo ?? '—'}
                                    {data.vehicle && (data.vehicle.make || data.vehicle.model || data.vehicle.year)
                                        ? ` · ${[data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(' ')}`
                                        : ''}
                                </td>
                            </tr>
                            <tr>
                                <th>{t('modal.subtotal')}</th>
                                <td className="ui-num">{t('money.sar', { amount: toNumber(data.subtotal).toLocaleString() })}</td>
                            </tr>
                            <tr>
                                <th>{t('modal.vat')}</th>
                                <td className="ui-num">{t('money.sar', { amount: toNumber(data.vatAmount).toLocaleString() })}</td>
                            </tr>
                            <tr>
                                <th>{t('modal.discount')}</th>
                                <td className="ui-num">{t('money.sar', { amount: toNumber(data.discountAmount).toLocaleString() })}</td>
                            </tr>
                            <tr>
                                <th>{t('modal.total')}</th>
                                <td className="ui-num ui-strong">{t('money.sar', { amount: toNumber(data.totalAmount).toLocaleString() })}</td>
                            </tr>
                            <tr>
                                <th>{t('modal.collected')}</th>
                                <td className="ui-num ui-money ui-money--in">
                                    {t('money.sar', { amount: realPaid.toLocaleString() })}
                                </td>
                            </tr>
                            <tr>
                                <th>{t('modal.balance')}</th>
                                <td className={`ui-num ui-money${realBalance > 0 ? ' ui-money--out' : ''}`}>
                                    {t('money.sar', { amount: realBalance.toLocaleString() })}
                                </td>
                            </tr>
                            <tr>
                                <th>{t('modal.paymentStatus')}</th>
                                <td><PaidStatusBadge paid={realPaid} balance={realBalance} t={t} /></td>
                            </tr>
                            <tr>
                                <th>{t('modal.paymentMethod')}</th>
                                <td>{(data.deferredPaymentMethod ?? row?.deferredPaymentMethod ?? '—').toString().replace(/_/g, ' ')}</td>
                            </tr>
                            {data.createdBy ? (
                                <tr>
                                    <th>{t('modal.createdBy')}</th>
                                    <td>
                                        {data.createdBy.name ?? data.createdBy.email ?? '—'}
                                        {data.createdBy.userType ? ` · ${formatStatusLabel(data.createdBy.userType)}` : ''}
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </DetailTable>

                    {Array.isArray(data.lineItems) && data.lineItems.length > 0 ? (
                        <DetailTable title={t('modal.lineItems')}>
                            <thead>
                                <tr>
                                    <th>{t('modal.th.item')}</th>
                                    <th>{t('modal.th.department')}</th>
                                    <th>{t('modal.th.qty')}</th>
                                    <th>{t('modal.th.unitPrice')}</th>
                                    <th>{t('modal.th.lineTotal')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.lineItems.map((item) => (
                                    <tr key={item.id}>
                                        <td>{item.itemName ?? '—'}</td>
                                        <td>{item.departmentName ?? '—'}</td>
                                        <td className="ui-num">{toNumber(item.qty)}</td>
                                        <td className="ui-num">{toNumber(item.unitPrice).toLocaleString()}</td>
                                        <td className="ui-num ui-strong">{toNumber(item.lineTotal).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </DetailTable>
                    ) : null}

                    {Array.isArray(data.payments) && data.payments.length > 0 ? (
                        <DetailTable title={t('modal.payments')}>
                            <thead>
                                <tr>
                                    <th>{t('modal.th.method')}</th>
                                    <th>{t('modal.th.amount')}</th>
                                    <th>{t('modal.th.paidAt')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.payments.map((p) => (
                                    <tr key={p.id}>
                                        <td>{p.method ?? '—'}</td>
                                        <td className="ui-num ui-strong">{toNumber(p.amount).toLocaleString()}</td>
                                        <td className="ui-nowrap">{formatDateTime(p.paidAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </DetailTable>
                    ) : null}
                </div>
            ) : (
                <div className="ui-empty">
                    <div className="ui-empty-icon"><FileText size={18} /></div>
                    <div className="ui-empty-title">{t('empty.details')}</div>
                </div>
            )}
        </AdminModalAsScreen>
    );
}
