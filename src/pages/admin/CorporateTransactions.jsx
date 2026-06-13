import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, FileText, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import '../../styles/admin/SalesOrders.css';
import Modal from '../../components/Modal';
import { ShimmerTextBlock } from '../../components/supplier/Shimmer';

const PAGE_SIZE = 50;
import {
    getSuperAdminInvoiceView,
    getWorkshopOptions,
    getBranches,
    getInvoices,
    getInvoice,
    getSuperAdminCorporateCompanies,
} from '../../services/superAdminApi';
import InvoiceDetailsModal from '../../components/pos/modern/InvoiceDetailsModal';
import { ExportMenu, DateTimeRange } from '../../components/admin/SalesExportControls';
import { exportRowsToPdf, exportRowsToExcel } from '../../utils/tableExport';

// Upper bound for the one-shot "export everything matching the filters" fetch.
const EXPORT_LIMIT = 5000;
const round2 = (n) => Number(Number(n ?? 0).toFixed(2));

const num = (v) =>
    `SAR ${Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function formatDate(raw) {
    if (!raw) return '—';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString(undefined, {
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

function orderTypeLabel(source) {
    const src = String(source ?? '').toLowerCase();
    if (src === 'walk_in_corporate') return 'Walk-in Corporate';
    if (src === 'corporate_app') return 'Corporate Booking';
    return 'Corporate';
}

/** Build {headers, rows} mirroring the on-screen table — used for PDF/Excel export. */
function buildCorporateExportRows(list) {
    const headers = [
        'Invoice Date', 'Invoice No', 'Customer', 'Order Type',
        'Workshop', 'Branch', 'Status', 'Invoice Amount', 'Receipt Amount', 'Balance',
    ];
    const rows = (list || []).map((r) => {
        const total = Number(r.totalAmount ?? r.grandTotal ?? 0);
        const realPaid = r.realPaid != null
            ? Number(r.realPaid)
            : Math.max(0, total - Number(r.balance ?? 0));
        const realBalance = r.realBalance != null ? Number(r.realBalance) : Number(r.balance ?? 0);
        const realStatus = String(r.realPaymentStatus ?? r.paymentStatus ?? '').toLowerCase();
        const statusLabel = realStatus === 'paid' || realBalance <= 0.01
            ? 'Paid'
            : realStatus === 'partial' || realPaid > 0.01 ? 'Partially Paid' : 'Not Paid';
        const src = String(r.orderSource ?? '').toLowerCase();
        const orderType = src === 'walk_in_corporate'
            ? 'Walk-in Corporate'
            : src === 'corporate_app' ? 'Corporate Booking' : 'Corporate';
        return [
            formatDate(r.invoiceDate ?? r.invoice_date ?? r.createdAt),
            r.invoiceNo ?? r.invoice_no ?? '—',
            r.corporateAccountName ?? r.corporate?.companyName ?? '—',
            orderType,
            r.workshopName ?? r.workshop?.name ?? '—',
            r.branchName ?? r.branch?.name ?? '—',
            statusLabel,
            round2(total),
            round2(realPaid),
            round2(realBalance),
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
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1); // 1-indexed for display convenience
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
    // Date+time range → passed as startDate/endDate to getInvoices (backend
    // honours full ISO datetimes, so this filters to the minute).
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
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

    // Server-side pagination — 50 per page. Page changes refetch.
    // Server returns paid + unpaid + overdue + partial in one payload;
    // each row carries its own `paymentStatus` we render as a badge.
    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await getInvoices({
                workshopId: selectedWorkshopId || undefined,
                branchId:   selectedBranchId   || undefined,
                corporateAccountId: selectedCompanyId || undefined,
                startDate: dateFrom || undefined,
                endDate:   dateTo   || undefined,
                search: debouncedSearch || undefined,
                limit: PAGE_SIZE,
                offset: (page - 1) * PAGE_SIZE,
                corporateOnly: true,     // only corporate invoices
                orderStatus: 'invoiced', // only orders that have been invoiced (paid or unpaid both shown)
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
            setError(e?.message || 'Could not load invoices');
            setRows([]);
            setTotal(0);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [selectedWorkshopId, selectedBranchId, selectedCompanyId, dateFrom, dateTo, debouncedSearch, page]);

    useEffect(() => {
        void load();
    }, [load]);

    // Snap back to page 1 when filters change — otherwise an offset higher
    // than the new total returns nothing and the user sees an empty table.
    useEffect(() => {
        setPage(1);
    }, [selectedWorkshopId, selectedBranchId, selectedCompanyId, dateFrom, dateTo, debouncedSearch]);

    // Companies for the Company filter (scoped to the selected workshop).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getSuperAdminCorporateCompanies({ workshopId: selectedWorkshopId || undefined });
                const list = Array.isArray(res?.companies) ? res.companies : [];
                if (!cancelled) {
                    setCompanyOptions(list.map((c) => ({ id: String(c.id), name: String(c.companyName || '').trim() || 'Company' })));
                    setSelectedCompanyId('');
                }
            } catch {
                if (!cancelled) { setCompanyOptions([]); setSelectedCompanyId(''); }
            }
        })();
        return () => { cancelled = true; };
    }, [selectedWorkshopId]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
                        list.map((w) => ({ id: String(w.id), name: String(w.name || '').trim() || 'Workshop' })),
                    );
                }
            } catch {
                if (!cancelled) setWorkshopOptions([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

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
                        list.map((b) => ({ id: String(b.id), name: String(b.name || '').trim() || 'Branch' })),
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
    }, [selectedWorkshopId]);

    // Export the FULL filtered set (not just the current page): one bounded
    // re-fetch with the active filters (including server-side search).
    const runExport = useCallback(async (kind) => {
        setExporting(true);
        setError('');
        try {
            const res = await getInvoices({
                workshopId: selectedWorkshopId || undefined,
                branchId:   selectedBranchId   || undefined,
                corporateAccountId: selectedCompanyId || undefined,
                startDate: dateFrom || undefined,
                endDate:   dateTo   || undefined,
                search: debouncedSearch || undefined,
                limit: EXPORT_LIMIT,
                offset: 0,
                corporateOnly: true,
                orderStatus: 'invoiced',
            });
            const all = Array.isArray(res?.invoices) ? res.invoices
                : Array.isArray(res?.items) ? res.items
                : Array.isArray(res) ? res : [];
            const { headers, rows: outRows } = buildCorporateExportRows(all);
            const subtitle = `${outRows.length} row(s)`
                + (dateFrom || dateTo ? ` · ${dateFrom || '…'} → ${dateTo || '…'}` : '');
            if (kind === 'pdf') {
                exportRowsToPdf({ title: 'Corporate Transactions', subtitle, headers, rows: outRows, filenameBase: 'corporate-transactions' });
            } else {
                exportRowsToExcel({ sheetName: 'Corporate Transactions', headers, rows: outRows, filenameBase: 'corporate-transactions' });
            }
        } catch (e) {
            setError(e?.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    }, [selectedWorkshopId, selectedBranchId, selectedCompanyId, dateFrom, dateTo, debouncedSearch]);

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
            const total = Number(r.totalAmount ?? r.grandTotal ?? 0);
            const paid = r.realPaid != null
                ? Number(r.realPaid)
                : Math.max(0, total - Number(r.realBalance ?? r.balance ?? 0));
            const bal = r.realBalance != null
                ? Number(r.realBalance)
                : Number(r.balance ?? 0);
            billed += total;
            collected += paid;
            outstanding += bal;
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
            setDetailError(e?.message || 'Could not load transaction details');
        } finally {
            setDetailLoading(false);
        }
    }, []);

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
            setInvoiceErr(e?.message || 'Could not load invoice');
        } finally {
            setInvoiceLoading(false);
        }
    };

    const cellTh = {
        padding: '10px 12px',
        textAlign: 'left',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#475569',
        textTransform: 'uppercase',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
    };
    const cellTd = { padding: '12px', verticalAlign: 'middle', fontSize: '0.8125rem' };

    return (
        <div style={{ padding: 20 }}>
            <header style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                        Corporate Transactions
                    </h1>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        All invoices across workshops — paid, unpaid, partial, and overdue. Filter by workshop / branch.
                    </p>
                </div>
                <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExportMenu
                        onPdf={() => runExport('pdf')}
                        onExcel={() => runExport('excel')}
                        busy={exporting}
                        disabled={loading}
                    />
                    <button
                        type="button"
                        onClick={() => load()}
                        disabled={loading}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            cursor: loading ? 'wait' : 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                        }}
                    >
                        <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                <KpiCard label="Invoices" value={loading ? '—' : Number(kpiCount).toLocaleString()} accent="#0f172a" />
                <KpiCard label="Total Billed" value={loading ? '—' : num(totalBilled)} accent="#0f172a" />
                <KpiCard label="Collected" value={loading ? '—' : num(totalCollected)} accent="#15803d" />
                <KpiCard label="Outstanding" value={loading ? '—' : num(totalOutstanding)} accent={totalOutstanding > 0 ? '#b91c1c' : '#15803d'} />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Workshop</label>
                    <select
                        value={selectedWorkshopId}
                        onChange={(e) => setSelectedWorkshopId(e.target.value)}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            background: '#fff',
                            minWidth: 200,
                        }}
                    >
                        <option value="">All workshops</option>
                        {workshopOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Branch</label>
                    <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        disabled={!selectedWorkshopId}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            background: '#fff',
                            minWidth: 200,
                            opacity: selectedWorkshopId ? 1 : 0.6,
                        }}
                        title={selectedWorkshopId ? '' : 'Select a workshop first'}
                    >
                        <option value="">All branches</option>
                        {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Company</label>
                    <select
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            background: '#fff',
                            minWidth: 200,
                        }}
                    >
                        <option value="">All companies</option>
                        {companyOptions.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <DateTimeRange
                    from={dateFrom}
                    to={dateTo}
                    onFrom={setDateFrom}
                    onTo={setDateTo}
                    onClear={() => { setDateFrom(''); setDateTo(''); }}
                />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search company, invoice no, method, amount…"
                    style={{
                        flex: 1,
                        minWidth: 240,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.875rem',
                    }}
                />
            </div>

            {error ? (
                <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, marginBottom: 12 }}>
                    {error}
                </div>
            ) : null}

            {invoiceErr ? (
                <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Invoice view failed: {invoiceErr}</span>
                    <button type="button" onClick={() => setInvoiceErr('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#991b1b', fontWeight: 700 }}>×</button>
                </div>
            ) : null}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'auto' }}>
                <InvoicesTable
                    loading={loading}
                    filtered={rows}
                    cellTh={cellTh}
                    cellTd={cellTd}
                    detailLoadingId={detailLoading ? String(detailRow?.id ?? '') : ''}
                    onOpenDetails={openDetails}
                />
                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    pageSize={PAGE_SIZE}
                    rowsThisPage={rows.length}
                    onChange={(next) => setPage(Math.max(1, Math.min(totalPages, next)))}
                    disabled={loading}
                />
            </div>

            {detailRow ? (
                <CorporateTransactionDetailsModal
                    row={detailRow}
                    data={detailData}
                    loading={detailLoading}
                    error={detailError}
                    invoiceLoading={invoiceLoading}
                    onClose={closeDetails}
                    onViewInvoice={openTaxInvoice}
                />
            ) : null}

            <InvoiceDetailsModal
                invoice={invoice}
                isOpen={!!invoice}
                footerVariant="corporate"
                onClose={() => setInvoice(null)}
            />
        </div>
    );
}

/* ───────── KPI summary card ───────── */

function KpiCard({ label, value, accent = '#0f172a' }) {
    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
        }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
            </span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums' }}>
                {value}
            </span>
        </div>
    );
}

/* ───────── Invoices table (only corporate + sales-order status=invoiced) ── */

/** Three-state payment badge derived from collected vs outstanding:
 *    balance ≈ 0            → Paid (green)
 *    paid > 0 & balance > 0 → Partially Paid (amber)
 *    paid ≈ 0               → Not Paid (red)  */
function PaidStatusBadge({ paid = 0, balance = 0 }) {
    const EPS = 0.01;
    const p = Number(paid) || 0;
    const b = Number(balance) || 0;
    let label;
    let style;
    if (b <= EPS) {
        label = 'Paid';
        style = { bg: '#dcfce7', fg: '#166534' };          // green
    } else if (p > EPS) {
        label = 'Partially Paid';
        style = { bg: '#fef3c7', fg: '#92400e' };          // amber
    } else {
        label = 'Not Paid';
        style = { bg: '#fef2f2', fg: '#991b1b' };          // red
    }
    return (
        <span style={{
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: '0.7rem',
            fontWeight: 700,
            background: style.bg,
            color: style.fg,
            display: 'inline-block',
            whiteSpace: 'nowrap',
        }}>
            {label}
        </span>
    );
}

/** Distinguish the two corporate-order origins by the SalesOrder.source field:
 *    - 'walk_in_corporate' → cashier created the order for a corporate
 *      customer directly at the POS (no prior booking).
 *    - 'corporate_app'     → the corporate user sent a booking request that
 *      the cashier accepted; it then became an order.
 *  This page is filtered server-side to corporate orders only, so any other
 *  source value falls back to a generic "Corporate" label as a defensive
 *  catch-all (shouldn't appear in normal use). */
function OrderTypeBadge({ row }) {
    const src = String(row.orderSource ?? '').toLowerCase();

    let label = 'Corporate';
    let style = { bg: '#ecfeff', fg: '#155e75' }; // cyan default

    if (src === 'walk_in_corporate') {
        label = 'Walk-in Corporate';
        style = { bg: '#ecfeff', fg: '#155e75' }; // cyan
    } else if (src === 'corporate_app') {
        label = 'Corporate Booking';
        style = { bg: '#f5f3ff', fg: '#6b21a8' }; // purple
    }

    return (
        <span style={{
            padding: '3px 9px',
            borderRadius: 999,
            fontSize: '0.7rem',
            fontWeight: 700,
            background: style.bg,
            color: style.fg,
            display: 'inline-block',
        }}>
            {label}
        </span>
    );
}

function InvoicesTable({ loading, filtered, cellTh, cellTd, detailLoadingId, onOpenDetails }) {
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
                <tr>
                    <th style={cellTh}>Invoice Date</th>
                    <th style={cellTh}>Invoice No</th>
                    <th style={cellTh}>Customer</th>
                    <th style={cellTh}>Order Type</th>
                    <th style={cellTh}>Workshop / Branch</th>
                    <th style={cellTh}>Status</th>
                    <th style={{ ...cellTh, textAlign: 'right' }}>Invoice amount</th>
                    <th style={{ ...cellTh, textAlign: 'right' }}>Receipt Amount</th>
                    <th style={{ ...cellTh, textAlign: 'right' }}>Balance</th>
                    <th style={{ ...cellTh, textAlign: 'right' }}>Actions</th>
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                        <Loader2 size={18} className="spin" /> Loading…
                    </td></tr>
                ) : filtered.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                        No invoiced corporate orders for the selected filters.
                    </td></tr>
                ) : filtered.map((r) => {
                    const total = Number(r.totalAmount ?? r.grandTotal ?? 0);
                    // Prefer server-computed REAL values (exclude phantom monthly
                    // billing placeholder payments). Fall back to raw fields if
                    // older backend hasn't been redeployed yet.
                    const realPaid = r.realPaid != null
                        ? Number(r.realPaid)
                        : Math.max(0, total - Number(r.balance ?? 0));
                    const realBalance = r.realBalance != null
                        ? Number(r.realBalance)
                        : Number(r.balance ?? 0);
                    return (
                        <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={cellTd}>{formatDate(r.invoiceDate ?? r.invoice_date ?? r.createdAt)}</td>
                            <td style={cellTd}><span style={{ fontWeight: 700, color: '#2563eb' }}>{r.invoiceNo ?? r.invoice_no ?? '—'}</span></td>
                            <td style={cellTd}>
                                <div style={{ fontWeight: 700 }}>
                                    {r.corporateAccountName
                                        ?? r.corporate?.companyName
                                        ?? '—'}
                                </div>
                            </td>
                            <td style={cellTd}><OrderTypeBadge row={r} /></td>
                            <td style={cellTd}>
                                <div>{r.workshopName ?? r.workshop?.name ?? '—'}</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.branchName ?? r.branch?.name ?? '—'}</div>
                            </td>
                            <td style={cellTd}><PaidStatusBadge paid={realPaid} balance={realBalance} /></td>
                            <td style={{ ...cellTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{num(total)}</td>
                            <td style={{ ...cellTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#15803d' }}>{num(realPaid)}</td>
                            <td style={{ ...cellTd, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: realBalance > 0 ? '#b91c1c' : '#94a3b8' }}>{num(realBalance)}</td>
                            <td style={{ ...cellTd, textAlign: 'right' }}>
                                <button
                                    type="button"
                                    onClick={() => onOpenDetails(r)}
                                    disabled={detailLoadingId === String(r.id)}
                                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: detailLoadingId === String(r.id) ? 'wait' : 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                >
                                    {detailLoadingId === String(r.id) ? <Loader2 size={12} className="spin" /> : <FileText size={12} />} View
                                </button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
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
}) {
    const total = Number(row?.totalAmount ?? data?.totalAmount ?? 0);
    const realPaid = row?.realPaid != null
        ? Number(row.realPaid)
        : Math.max(0, total - Number(row?.realBalance ?? data?.balance ?? 0));
    const realBalance = row?.realBalance != null
        ? Number(row.realBalance)
        : Number(row?.balance ?? 0);

    return (
        <Modal
            title={`Corporate transaction${data?.invoiceNo || row?.invoiceNo ? ` — ${data?.invoiceNo ?? row?.invoiceNo}` : ''}`}
            onClose={onClose}
            width="min(1100px, 98vw)"
            contentClassName="ws-modal-order-details"
        >
            {loading ? (
                <ShimmerTextBlock lines={8} />
            ) : error ? (
                <div style={{ color: '#B91C1C' }}>{error}</div>
            ) : data ? (
                <div className="ws-order-details-modal-body">
                    <div className="ws-report-table-wrapper">
                        <table className="ws-table">
                            <tbody>
                                <tr><th>INVOICE NO</th><td>{data.invoiceNo ?? row?.invoiceNo ?? '—'}</td></tr>
                                <tr>
                                    <th>INVOICE DATE</th>
                                    <td>{formatDateTime(data.issuedAt ?? data.invoiceDate ?? row?.invoiceDate)}</td>
                                </tr>
                                <tr>
                                    <th>CORPORATE ACCOUNT</th>
                                    <td>{row?.corporateAccountName ?? data.customer?.name ?? '—'}</td>
                                </tr>
                                <tr>
                                    <th>ORDER TYPE</th>
                                    <td>{orderTypeLabel(data.salesOrder?.source ?? row?.orderSource)}</td>
                                </tr>
                                <tr><th>WORKSHOP</th><td>{data.workshopName ?? row?.workshopName ?? '—'}</td></tr>
                                <tr><th>BRANCH</th><td>{data.branchName ?? row?.branchName ?? '—'}</td></tr>
                                <tr><th>ORDER #</th><td>{data.salesOrder?.id ?? row?.salesOrderId ?? '—'}</td></tr>
                                <tr><th>ORDER STATUS</th><td>{formatStatusLabel(data.salesOrder?.status ?? row?.orderStatus)}</td></tr>
                                <tr>
                                    <th>ORDER CREATED</th>
                                    <td>{formatDateTime(data.salesOrder?.createdAt)}</td>
                                </tr>
                                <tr><th>CUSTOMER</th><td>{data.customer?.name ?? '—'}</td></tr>
                                <tr><th>PHONE</th><td>{data.customer?.mobile ?? row?.customerMobile ?? '—'}</td></tr>
                                <tr>
                                    <th>VEHICLE</th>
                                    <td>
                                        {data.vehicle?.plateNo ?? row?.plateNo ?? '—'}
                                        {data.vehicle && (data.vehicle.make || data.vehicle.model || data.vehicle.year)
                                            ? ` · ${[data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(' ')}`
                                            : ''}
                                    </td>
                                </tr>
                                <tr><th>SUBTOTAL</th><td>SAR {toNumber(data.subtotal).toLocaleString()}</td></tr>
                                <tr><th>VAT</th><td>SAR {toNumber(data.vatAmount).toLocaleString()}</td></tr>
                                <tr><th>DISCOUNT</th><td>SAR {toNumber(data.discountAmount).toLocaleString()}</td></tr>
                                <tr>
                                    <th>TOTAL</th>
                                    <td className="ws-font-bold">SAR {toNumber(data.totalAmount).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <th>COLLECTED</th>
                                    <td style={{ color: '#15803d', fontWeight: 700 }}>SAR {realPaid.toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <th>BALANCE</th>
                                    <td style={{ color: realBalance > 0 ? '#b91c1c' : '#64748b', fontWeight: 700 }}>
                                        SAR {realBalance.toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <th>PAYMENT STATUS</th>
                                    <td><PaidStatusBadge paid={realPaid} balance={realBalance} /></td>
                                </tr>
                                <tr>
                                    <th>PAYMENT METHOD</th>
                                    <td>{(data.deferredPaymentMethod ?? row?.deferredPaymentMethod ?? '—').toString().replace(/_/g, ' ')}</td>
                                </tr>
                                {data.createdBy ? (
                                    <tr>
                                        <th>CREATED BY</th>
                                        <td>
                                            {data.createdBy.name ?? data.createdBy.email ?? '—'}
                                            {data.createdBy.userType ? ` · ${formatStatusLabel(data.createdBy.userType)}` : ''}
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>

                    {Array.isArray(data.lineItems) && data.lineItems.length > 0 ? (
                        <div className="ws-report-table-wrapper" style={{ marginTop: 16 }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Line items</p>
                            <div className="ws-order-details-table-scroll">
                                <table className="ws-table">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Department</th>
                                            <th>Qty</th>
                                            <th>Unit price</th>
                                            <th>Line total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.lineItems.map((item) => (
                                            <tr key={item.id}>
                                                <td>{item.itemName ?? '—'}</td>
                                                <td>{item.departmentName ?? '—'}</td>
                                                <td>{toNumber(item.qty)}</td>
                                                <td>{toNumber(item.unitPrice).toLocaleString()}</td>
                                                <td className="ws-font-bold">{toNumber(item.lineTotal).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}

                    {Array.isArray(data.payments) && data.payments.length > 0 ? (
                        <div className="ws-report-table-wrapper" style={{ marginTop: 16 }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.875rem' }}>Payments</p>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>Method</th>
                                        <th>Amount (SAR)</th>
                                        <th>Paid at</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.payments.map((p) => (
                                        <tr key={p.id}>
                                            <td>{p.method ?? '—'}</td>
                                            <td className="ws-font-bold">{toNumber(p.amount).toLocaleString()}</td>
                                            <td>{formatDateTime(p.paidAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : null}

                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 10,
                        justifyContent: 'flex-end',
                        marginTop: 20,
                        paddingTop: 16,
                        borderTop: '1px solid #e2e8f0',
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '8px 14px',
                                borderRadius: 10,
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                            }}
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            onClick={onViewInvoice}
                            disabled={invoiceLoading}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 14px',
                                borderRadius: 10,
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                cursor: invoiceLoading ? 'wait' : 'pointer',
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                            }}
                        >
                            {invoiceLoading ? <Loader2 size={14} className="spin" /> : <Printer size={14} />}
                            View invoice
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ color: '#64748b' }}>No details available.</div>
            )}
        </Modal>
    );
}

/** Bottom-of-table pagination: Prev / page indicator / Next + summary. */
function PaginationBar({ page, totalPages, total, pageSize, rowsThisPage, onChange, disabled }) {
    if (total === 0) return null;
    const firstRow = (page - 1) * pageSize + 1;
    const lastRow  = (page - 1) * pageSize + rowsThisPage;
    const btn = (active) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid #cbd5e1',
        background: active ? '#fff' : '#f8fafc',
        color: active ? '#0f172a' : '#94a3b8',
        cursor: active ? 'pointer' : 'not-allowed',
        fontSize: '0.75rem',
        fontWeight: 700,
    });
    return (
        <div style={{
            padding: '12px 14px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
        }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Showing <strong>{firstRow}–{lastRow}</strong> of <strong>{total}</strong>
                {' '}· page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </div>
            <div style={{ display: 'inline-flex', gap: 6 }}>
                <button
                    type="button"
                    onClick={() => onChange(1)}
                    disabled={disabled || page === 1}
                    style={btn(!(disabled || page === 1))}
                >
                    « First
                </button>
                <button
                    type="button"
                    onClick={() => onChange(page - 1)}
                    disabled={disabled || page === 1}
                    style={btn(!(disabled || page === 1))}
                >
                    <ChevronLeft size={12} /> Prev
                </button>
                <button
                    type="button"
                    onClick={() => onChange(page + 1)}
                    disabled={disabled || page >= totalPages}
                    style={btn(!(disabled || page >= totalPages))}
                >
                    Next <ChevronRight size={12} />
                </button>
                <button
                    type="button"
                    onClick={() => onChange(totalPages)}
                    disabled={disabled || page >= totalPages}
                    style={btn(!(disabled || page >= totalPages))}
                >
                    Last »
                </button>
            </div>
        </div>
    );
}
