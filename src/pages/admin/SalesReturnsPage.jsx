import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    AlertTriangle,
    Loader2,
    RefreshCw,
    FileText,
    RotateCcw,
    Eye,
    Printer,
    Search,
} from 'lucide-react';
import AdminModalAsScreen from '../../components/admin/AdminModalAsScreen';
import AdminScreenShell from '../../components/admin/AdminScreenShell';
import CashierTaxInvoiceView from '../../components/pos/modern/CashierTaxInvoiceView';
import '../../components/pos/modern/CashierTaxInvoiceView.css';
import CreditNotePrintView from '../../components/workshop/CreditNotePrintView';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import { BUSINESS_TIMEZONE } from '../../utils/riyadhBusinessRange';
import {
    getSuperAdminSalesReturns,
    getSuperAdminSalesReturn,
    getSuperAdminInvoiceView,
    getWorkshopOptions,
    getBranches,
    approveSuperAdminSalesReturn,
    rejectSuperAdminSalesReturn,
} from '../../services/superAdminApi';
import { useAuth } from '../../context/AuthContext';
import { ExportMenu } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';
import { retT } from '../../utils/salesReturnsI18n';
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
 * Rendered in the business timezone, with an explicit format.
 * `toLocaleString()` with no options follows the viewer's locale *and* zone, so
 * the same credit note read "01/11/2026, 00:30" in Riyadh and the 31st in UTC.
 */
function formatDateTime(raw) {
    if (!raw) return '—';
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

function statusPill(status, t) {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') return { label: t('status.approved'), tone: 'ok' };
    if (s === 'pending') return { label: t('status.pending'), tone: 'warn' };
    if (s === 'rejected') return { label: t('status.rejected'), tone: 'dang' };
    return { label: s || '—', tone: 'neutral' };
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
function buildSalesReturnExportRows(list, t) {
    const headers = [
        t('th.datetime'), t('th.creditNote'), t('th.invoice'), t('th.customer'), t('th.phone'),
        t('th.vehicle'), t('th.cashier'), t('th.workshop'), t('th.branch'), t('th.type'), t('th.amount'), t('th.status'),
    ];
    const rows = (list || []).map((r) => [
        formatDateTime(r.returnDate ?? r.createdAt),
        r.creditNoteNo ?? r.returnNo ?? '—',
        r.invoice?.invoiceNo ?? '—',
        r.customerName || '—',
        r.customerPhone || '',
        r.vehicleNumber || '—',
        r.cashier?.name || r.createdBy?.name || '—',
        r.workshop?.name ?? '—',
        r.branch?.name ?? '—',
        (r.returnScope || '—').toString().toUpperCase(),
        round2(r.totalAmount),
        statusPill(r.status, t).label,
    ]);
    return { headers, rows };
}

/**
 * Super-admin overview of sales returns originated from the cashier portal.
 * Workshop + Branch filters cascade. Rich columns (customer, vehicle, cashier,
 * credit note, return type); each row opens a detail modal with line items +
 * printable credit note, and can drill into the underlying invoice.
 */
export default function SalesReturnsPage() {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => retT(locale, key, vars), [locale]);

    const { hasPermission } = useAuth();
    const canApprove = hasPermission('sales.sales-returns.approve') || hasPermission('approvals.sales-return.approve');
    const canReject = hasPermission('sales.sales-returns.reject') || hasPermission('approvals.sales-return.reject');

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    // What the query actually uses. The search here is deliberately not live:
    // it is committed on Apply / Refresh / Enter. Keeping it separate from the
    // input is what lets the paging reset when it changes and not before.
    const [appliedSearch, setAppliedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('completed');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [workshopOptions, setWorkshopOptions] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('');
    const [summary, setSummary] = useState(null);
    const [exporting, setExporting] = useState(false);

    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [printOpen, setPrintOpen] = useState(false);
    const printRef = useRef(null);

    const [invoice, setInvoice] = useState(null);
    const [invoiceLoadingId, setInvoiceLoadingId] = useState(null);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [rejectRow, setRejectRow] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    const listQuery = useMemo(() => ({
        workshopId: selectedWorkshopId || undefined,
        branchId: selectedBranchId || undefined,
        status: statusFilter || undefined,
        search: appliedSearch || undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
    }), [selectedWorkshopId, selectedBranchId, statusFilter, appliedSearch, dateFrom, dateTo]);

    const resetKey = [
        selectedWorkshopId, selectedBranchId, statusFilter, appliedSearch, dateFrom, dateTo,
    ].join('|');
    const { page, pageSize, pagerFor } = useServerPaging({ resetKey });

    /**
     * One page at a time. This used to ask for `limit: 200, offset: 0` and show
     * a note when `total` was higher — so a return past the 200th could not be
     * reached, approved or rejected from this screen at all.
     */
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getSuperAdminSalesReturns({
                ...listQuery,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            });
            setRows(Array.isArray(res?.items) ? res.items : []);
            setTotal(Number(res?.total) || 0);
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

    /** Commit the typed search. Re-runs the query even when it has not changed. */
    const applyNow = useCallback(() => {
        const next = search.trim();
        if (next === appliedSearch) void load();
        else setAppliedSearch(next);
    }, [search, appliedSearch, load]);

    // Export the FULL filtered set (one bounded re-fetch with the active filters,
    // including the same server-side search/status/date window).
    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setError('');
        try {
            const res = await getSuperAdminSalesReturns({
                ...listQuery,
                limit: EXPORT_LIMIT,
                offset: 0,
            });
            const list = Array.isArray(res?.items) ? res.items : [];
            const { headers, rows: outRows } = buildSalesReturnExportRows(list, t);
            const subtitle = t('export.subtitle', { n: outRows.length })
                + (dateFrom || dateTo ? ` · ${dateFrom || '…'} → ${dateTo || '…'}` : '')
                + (statusFilter ? ` · ${t('export.status', { status: statusFilter })}` : '');
            if (kind === 'pdf') {
                exportRowsToPdf({ title: t('export.title'), subtitle, headers, rows: outRows, filenameBase: 'sales-returns' });
            } else {
                exportRowsToExcel({ sheetName: t('export.sheet'), headers, rows: outRows, filenameBase: 'sales-returns' });
            }
        } catch (e) {
            setError(e?.message || t('err.export'));
        } finally {
            setExporting(false);
        }
    }, [listQuery, statusFilter, dateFrom, dateTo, t]);

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

    // KPI count + total across the FULL filtered set (server `summary`), with a
    // fallback to the loaded rows when summary isn't present.
    const kpiCount = summary ? Number(summary.count ?? 0) : rows.length;
    const totalAmount = useMemo(
        () => (summary ? Number(summary.totalReturned ?? 0) : rows.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0)),
        [rows, summary],
    );

    const openDetail = async (row) => {
        setDetail(row);
        setDetailLoading(true);
        try {
            const res = await getSuperAdminSalesReturn(row.id);
            if (res?.salesReturn) setDetail(res.salesReturn);
        } catch {
            /* keep the list row as a fallback */
        } finally {
            setDetailLoading(false);
        }
    };

    // Approve / reject / invoice failures land in the page banner. They used to
    // call alert(), which a browser can suppress and which loses the message
    // the moment it is dismissed.
    const handleApprove = async (row) => {
        if (row.status !== 'pending' || !canApprove) return;
        setActionLoadingId(`approve-${row.id}`);
        setError('');
        try {
            await approveSuperAdminSalesReturn(row.id);
            await load();
        } catch (e) {
            setError(e?.message || t('err.approve'));
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRejectSubmit = async () => {
        if (!rejectRow || !rejectReason.trim() || !canReject) return;
        setActionLoadingId(`reject-${rejectRow.id}`);
        setError('');
        try {
            await rejectSuperAdminSalesReturn(rejectRow.id, rejectReason.trim());
            setRejectRow(null);
            setRejectReason('');
            await load();
        } catch (e) {
            setError(e?.message || t('err.reject'));
        } finally {
            setActionLoadingId(null);
        }
    };

    const openInvoice = async (invoiceId) => {
        if (!invoiceId) return;
        setInvoiceLoadingId(String(invoiceId));
        setError('');
        try {
            const raw = await getSuperAdminInvoiceView(invoiceId);
            const inv = raw?.invoice ?? raw?.data?.invoice ?? raw?.data ?? raw;
            setInvoice(normalizeInvoiceForModal(inv));
        } catch (e) {
            setError(e?.message || t('err.invoice'));
        } finally {
            setInvoiceLoadingId(null);
        }
    };

    const handlePrint = () => {
        if (!printRef.current) return;
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<!DOCTYPE html><html><head><title>${t('print.windowTitle')}</title></head><body>${printRef.current.innerHTML}</body></html>`);
        w.document.close();
        w.focus();
        w.print();
    };

    const closeDetail = () => {
        setDetail(null);
        setPrintOpen(false);
    };

    if (invoice) {
        const invTitle = invoice.invoiceNo
            ? `${t('btn.viewInvoice')} · ${invoice.invoiceNo}`
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
                {/* `ui-print-root` is what the Print button prints — without it
                    window.print() took the whole screen, sidebar and all. */}
                <div className="ui-sheet ui-print-root">
                    <CashierTaxInvoiceView invoice={invoice} />
                </div>
            </AdminScreenShell>
        );
    }

    if (printOpen && detail) {
        return (
            <AdminModalAsScreen
                title={t('print.title')}
                onClose={() => setPrintOpen(false)}
                wide
                footer={(
                    <>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={() => setPrintOpen(false)}
                        >
                            {t('btn.close')}
                        </button>
                        <button type="button" className="ui-btn ui-btn--primary" onClick={handlePrint}>
                            <Printer size={16} /> {t('btn.print')}
                        </button>
                    </>
                )}
            >
                <CreditNotePrintView ref={printRef} data={detail} />
            </AdminModalAsScreen>
        );
    }

    if (rejectRow) {
        return (
            <AdminModalAsScreen
                title={t('reject.title')}
                onClose={() => { setRejectRow(null); setRejectReason(''); }}
                footer={(
                    <>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={() => { setRejectRow(null); setRejectReason(''); }}
                        >
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--danger"
                            onClick={handleRejectSubmit}
                            disabled={!rejectReason.trim() || actionLoadingId === `reject-${rejectRow.id}`}
                        >
                            {t('btn.reject')}
                        </button>
                    </>
                )}
            >
                <div className="ui-stack-sm">
                    <p className="ui-meta">
                        {rejectRow.returnNo} · {rejectRow.invoice?.invoiceNo ?? t('fallback.invoice')}
                    </p>
                    <div className="ui-field">
                        <label htmlFor="sr-reject-reason">{t('reject.title')}</label>
                        <textarea
                            id="sr-reject-reason"
                            className="ui-textarea"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder={t('reject.placeholder')}
                            rows={4}
                        />
                    </div>
                </div>
            </AdminModalAsScreen>
        );
    }

    if (detail) {
        return (
            <AdminModalAsScreen
                title={t('detail.title')}
                onClose={closeDetail}
                footer={!detailLoading ? (
                    <>
                        {(detail.invoice?.id || detail.invoiceId) ? (
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                onClick={() => openInvoice(detail.invoice?.id || detail.invoiceId)}
                                disabled={invoiceLoadingId != null}
                            >
                                {invoiceLoadingId != null
                                    ? <Loader2 size={14} className="ui-spin" />
                                    : <FileText size={14} />}
                                {t('btn.viewInvoice')}
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary"
                            onClick={() => setPrintOpen(true)}
                        >
                            <Printer size={16} /> {t('btn.viewCreditNote')}
                        </button>
                    </>
                ) : null}
            >
                {detailLoading ? (
                    <div className="ui-stack-sm" aria-busy="true">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={`sk-${i}`} className="ui-sk-row">
                                <div className="ui-sk ui-sk--text ui-sk--w90" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="ui-stack">
                        <div className="ui-fields">
                            {[
                                [t('detail.creditNote'), detail.creditNoteNo || detail.returnNo || '—'],
                                [t('detail.invoice'), detail.invoiceNo || detail.invoice?.invoiceNo || '—'],
                                [t('detail.customer'), `${detail.customerName || '—'} · ${detail.customerPhone || '—'}`],
                                [t('detail.vehicle'), detail.vehicleNumber || '—'],
                                [t('detail.cashier'), detail.cashier?.name || detail.createdBy?.name || '—'],
                                [
                                    t('detail.workshopBranch'),
                                    `${detail.workshopName || detail.workshop?.name || '—'} · ${detail.branchName || detail.branch?.name || '—'}`,
                                ],
                                [
                                    t('detail.returnType'),
                                    detail.returnScope === 'full'
                                        ? t('detail.fullReturn')
                                        : detail.returnScope === 'partial' ? t('detail.partialReturn') : '—',
                                ],
                                [t('detail.date'), formatDateTime(detail.returnDate || detail.createdAt)],
                            ].map(([label, value]) => (
                                <div key={label} className="ui-fieldro">
                                    <span className="ui-fieldro-label">{label}</span>
                                    <span className="ui-fieldro-value">{value}</span>
                                </div>
                            ))}
                        </div>

                        <section className="ui-panel">
                            <div className="ui-panel-head">
                                <span className="ui-panel-title">{t('detail.th.product')}</span>
                            </div>
                            <div className="ui-table-wrap ui-table-wrap--scroll ui-table-wrap--bare">
                                <table className="ui-table">
                                    <thead>
                                        <tr>
                                            <th>{t('detail.th.product')}</th>
                                            <th>{t('detail.th.returnQty')}</th>
                                            <th>{t('detail.th.unitPrice')}</th>
                                            <th>{t('detail.th.lineTotal')}</th>
                                            <th>{t('detail.th.reason')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(detail.items || []).length === 0 ? (
                                            <tr>
                                                <td colSpan={5}>
                                                    <div className="ui-empty">
                                                        <div className="ui-empty-title">{t('detail.noItems')}</div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (detail.items || []).map((it) => (
                                            <tr key={it.id}>
                                                <td>{it.name || '—'}</td>
                                                <td className="ui-num">
                                                    {it.qty}{it.originalQty != null ? ` / ${it.originalQty}` : ''}
                                                </td>
                                                <td className="ui-num">{num(t, it.unitPrice || 0)}</td>
                                                <td className="ui-num ui-strong">{num(t, it.lineTotal || 0)}</td>
                                                <td>{it.reason || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                )}
            </AdminModalAsScreen>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-row">
                <div className="ui-head">
                    <h1>
                        <RotateCcw size={18} /> {t('page.title')}
                    </h1>
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
                        onClick={applyNow}
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'ui-spin' : ''} /> {t('btn.refresh')}
                    </button>
                </div>
            </div>

            <div className="ui-kpis">
                <div className="ui-metric ui-metric--dang">
                    <div className="ui-metric-label">{t('kpi.returns')}</div>
                    <div className="ui-metric-value">
                        {loading
                            ? <span className="ui-sk ui-sk--title ui-sk--w70" />
                            : Number(kpiCount).toLocaleString()}
                    </div>
                </div>
                <div className="ui-metric ui-metric--dang">
                    <div className="ui-metric-label">{t('kpi.totalReturned')}</div>
                    <div className="ui-metric-value">
                        {loading
                            ? <span className="ui-sk ui-sk--title ui-sk--w70" />
                            : num(t, totalAmount)}
                    </div>
                </div>
            </div>

            <div className="ui-row ui-row--fields">
                <div className="ui-field ui-field--grow">
                    <label htmlFor="sr-search">{t('label.search')}</label>
                    <div className="ui-search">
                        <Search size={15} />
                        <input
                            id="sr-search"
                            type="search"
                            className="ui-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') applyNow(); }}
                            placeholder={t('search.placeholder')}
                        />
                    </div>
                </div>
                <div className="ui-field">
                    <label htmlFor="sr-workshop">{t('label.workshop')}</label>
                    <select
                        id="sr-workshop"
                        className="ui-select"
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                    >
                        <option value="">{t('opt.allWorkshops')}</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="sr-branch">{t('label.branch')}</label>
                    <select
                        id="sr-branch"
                        className="ui-select"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId}
                        title={selectedWorkshopId ? '' : t('opt.selectWorkshopFirst')}
                    >
                        <option value="">{t('opt.allBranches')}</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="sr-status">{t('label.status')}</label>
                    <select
                        id="sr-status"
                        className="ui-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="completed">{t('opt.approved')}</option>
                        <option value="pending">{t('opt.pending')}</option>
                        <option value="rejected">{t('opt.rejected')}</option>
                        <option value="">{t('opt.all')}</option>
                    </select>
                </div>
                <div className="ui-field">
                    <label htmlFor="sr-from">{t('label.from')}</label>
                    <input
                        id="sr-from"
                        type="datetime-local"
                        className="ui-input"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        step={60}
                    />
                </div>
                <div className="ui-field">
                    <label htmlFor="sr-to">{t('label.to')}</label>
                    <input
                        id="sr-to"
                        type="datetime-local"
                        className="ui-input"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        step={60}
                    />
                </div>
                <div className="ui-toolbar-end">
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        onClick={applyNow}
                        disabled={loading}
                    >
                        {loading ? t('btn.loading') : t('btn.apply')}
                    </button>
                </div>
            </div>

            {error ? (
                <div className="ui-banner ui-banner--dang" role="alert">
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                </div>
            ) : null}

            <div className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('th.datetime')}</th>
                            <th>{t('th.creditNote')}</th>
                            <th>{t('th.invoice')}</th>
                            <th>{t('th.customer')}</th>
                            <th>{t('th.vehicle')}</th>
                            <th>{t('th.cashier')}</th>
                            <th>{t('th.workshopBranch')}</th>
                            <th>{t('th.type')}</th>
                            <th>{t('th.amount')}</th>
                            <th>{t('th.status')}</th>
                            <th>{t('th.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={`sk-${i}`} className="ui-sk-row">
                                    <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--strong ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                    <td><div className="ui-sk ui-sk--pill" /></td>
                                    <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                    <td><div className="ui-sk ui-sk--pill" /></td>
                                    <td><div className="ui-sk ui-sk--btn" /></td>
                                </tr>
                            ))
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={11}>
                                    <div className="ui-empty">
                                        <div className="ui-empty-icon"><RotateCcw size={18} /></div>
                                        <div className="ui-empty-title">{t('empty')}</div>
                                    </div>
                                </td>
                            </tr>
                        ) : rows.map((r) => {
                            const st = statusPill(r.status, t);
                            return (
                                <tr key={r.id}>
                                    <td data-label={t('th.datetime')} className="ui-nowrap">
                                        {formatDateTime(r.returnDate ?? r.createdAt)}
                                    </td>
                                    <td data-label={t('th.creditNote')} className="ui-strong">
                                        {r.creditNoteNo ?? r.returnNo ?? '—'}
                                    </td>
                                    <td data-label={t('th.invoice')} className="ui-strong">
                                        {r.invoice?.invoiceNo ?? '—'}
                                    </td>
                                    <td data-label={t('th.customer')}>
                                        <div className="ui-strong">{r.customerName || '—'}</div>
                                        {r.customerPhone ? <div className="ui-meta">{r.customerPhone}</div> : null}
                                    </td>
                                    <td data-label={t('th.vehicle')}>{r.vehicleNumber || '—'}</td>
                                    <td data-label={t('th.cashier')}>
                                        {r.cashier?.name || r.createdBy?.name || '—'}
                                    </td>
                                    <td data-label={t('th.workshopBranch')}>
                                        <div>{r.workshop?.name ?? '—'}</div>
                                        <div className="ui-meta">{r.branch?.name ?? '—'}</div>
                                    </td>
                                    <td data-label={t('th.type')}>
                                        <span className="ui-pill ui-pill--info">
                                            {(r.returnScope || '—').toString().toUpperCase()}
                                        </span>
                                    </td>
                                    <td data-label={t('th.amount')} className="ui-num ui-money ui-money--out">
                                        {num(t, r.totalAmount)}
                                    </td>
                                    <td data-label={t('th.status')}>
                                        <span className={`ui-pill ui-pill--${st.tone}`}>{st.label}</span>
                                    </td>
                                    <td data-label={t('th.actions')}>
                                        <div className="ui-rowacts">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                onClick={() => openDetail(r)}
                                            >
                                                <Eye size={14} /> {t('btn.view')}
                                            </button>
                                            {r.status === 'pending' && canApprove ? (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                    onClick={() => handleApprove(r)}
                                                    disabled={actionLoadingId === `approve-${r.id}`}
                                                >
                                                    {actionLoadingId === `approve-${r.id}`
                                                        ? <Loader2 size={12} className="ui-spin" />
                                                        : null}
                                                    {t('btn.approve')}
                                                </button>
                                            ) : null}
                                            {r.status === 'pending' && canReject ? (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--danger ui-btn--sm"
                                                    onClick={() => { setRejectRow(r); setRejectReason(''); }}
                                                    disabled={actionLoadingId === `reject-${r.id}`}
                                                >
                                                    {t('btn.reject')}
                                                </button>
                                            ) : null}
                                            {r.invoice?.id ? (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                    onClick={() => openInvoice(r.invoice.id)}
                                                    disabled={invoiceLoadingId === String(r.invoice.id)}
                                                >
                                                    {invoiceLoadingId === String(r.invoice.id)
                                                        ? <Loader2 size={12} className="ui-spin" />
                                                        : <FileText size={12} />}
                                                    {t('btn.invoice')}
                                                </button>
                                            ) : null}
                                        </div>
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
