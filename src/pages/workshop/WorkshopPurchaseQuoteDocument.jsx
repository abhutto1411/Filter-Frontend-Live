import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import {
    acceptWorkshopPurchaseQuote,
    createWorkshopPurchaseQuote,
    getWorkshopPurchaseQuote,
    listWorkshopPurchaseQuoteCatalog,
    listWorkshopPurchaseQuotes,
    rejectWorkshopPurchaseQuote,
    sendWorkshopPurchaseQuote,
    updateWorkshopPurchaseQuote,
} from '../../services/workshopPurchaseQuotesApi';
import { listAffiliatedSuppliers } from '../../services/workshopSuppliersApi';
import SupplierAccountingCombobox from '../supplier/accounting/SupplierAccountingCombobox';
import QuoteStatusBadge from '../supplier/accounting/QuoteStatusBadge';
import { saccT } from '../../utils/supplierAccountingI18n';
import { wsDashT } from '../../utils/workshopDashboardI18n';
import InlineFormScreen from '../../components/InlineFormScreen';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';
import '../../styles/admin/AccountingPage.css';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    fmtDate,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    todayISO,
} from '../supplier/accounting/SupplierAccountingShared';
import { extractArray, unwrapPayload } from '../supplier/accounting/SupplierManagerAccountingShared';

const SEARCH_MAX_RESULTS = 50;
const LINE_TAB_FIELDS = ['product', 'description', 'qty', 'unitPrice', 'taxCode'];
const CATALOG_REMOTE_SEARCH_MIN_CHARS = 2;
const CATALOG_REMOTE_SEARCH_DEBOUNCE_MS = 280;

const TAXES = [
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
    { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0 },
    { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0 },
];

function addDaysIso(iso, days) {
    const base = String(iso || '').slice(0, 10);
    const d = new Date(`${base}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + (Number(days) || 0));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function taxRateFromCode(taxCode) {
    return TAXES.find((tx) => tx.code === taxCode)?.rate ?? 0.15;
}

function vatRateFromCode(taxCode) {
    return TAXES.find((tx) => tx.code === taxCode)?.percent ?? 15;
}

function taxCodeFromVatRate(vatRate) {
    const pct = Number(vatRate);
    const hit = TAXES.find((tx) => Math.abs(tx.percent - pct) < 0.01);
    return hit?.code || 'VAT 15%';
}

function lineMoney(line) {
    const qty = Number(line.qty) || 0;
    const price = Number(line.unitPrice) || 0;
    const rate = taxRateFromCode(line.taxCode || taxCodeFromVatRate(line.vatRate));
    const total = Math.round(qty * price * 100) / 100;
    const taxAmt = Math.round(total * rate * 100) / 100;
    return { total, taxAmt, grand: Math.round((total + taxAmt) * 100) / 100 };
}

function previewNextQuoteNo(quotes) {
    let max = 0;
    (quotes || []).forEach((q) => {
        const n = String(q.quoteNo || '').match(/(\d+)$/)?.[1];
        if (n) max = Math.max(max, Number(n));
    });
    return `QT-${String(max + 1).padStart(5, '0')}`;
}

function nextLineId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyLine() {
    return {
        id: nextLineId(),
        supplierProductId: '',
        productName: '',
        lineDescription: '',
        qty: '1',
        unitPrice: '',
        vatRate: '15',
        taxCode: 'VAT 15%',
        unit: 'pcs',
    };
}

function normalizeCatalogRow(item) {
    const id = String(item.id || item.supplierProductId || '');
    const price = Number(item.salePrice ?? item.unitPrice ?? 0);
    return {
        id,
        name: item.productName || item.name || '',
        sku: String(item.sku || '').trim(),
        price,
        unit: item.unit || 'pcs',
    };
}

function quoteToForm(quote) {
    const validUntil = quote.validUntil ? String(quote.validUntil).slice(0, 10) : '';
    let validForDays = '30';
    if (quote.quoteDate && validUntil) {
        const a = new Date(`${String(quote.quoteDate).slice(0, 10)}T00:00:00`);
        const b = new Date(`${validUntil}T00:00:00`);
        if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
            validForDays = String(Math.max(0, Math.round((b - a) / 86400000)));
        }
    }
    return {
        quoteDate: String(quote.quoteDate || todayISO()).slice(0, 10),
        validForDays,
        refNo: quote.quoteNo || '',
        refAuto: false,
        supplierId: quote.supplierId || '',
        notes: quote.notes || '',
        items: (quote.items || []).length
            ? quote.items.map((it) => ({
                id: nextLineId(),
                supplierProductId: it.supplierProductId || '',
                productName: it.productName || '',
                lineDescription: it.lineDescription || '',
                qty: String(it.qty ?? '1'),
                unitPrice: String(it.unitPrice ?? ''),
                vatRate: String(it.vatRate ?? 15),
                taxCode: taxCodeFromVatRate(it.vatRate),
                unit: it.unit || 'pcs',
            }))
            : [emptyLine()],
    };
}

function mapQuoteToWorkshopDetail(quote) {
    if (!quote || typeof quote !== 'object') return {};
    const party = quote.supplierName || '';
    return {
        id: quote.id,
        invoiceNumber: quote.quoteNo,
        invoiceNo: quote.quoteNo,
        issueDate: quote.quoteDate,
        invoiceDate: quote.quoteDate,
        dueDate: quote.validUntil,
        status: quote.status,
        workshopName: party,
        branchName: party,
        notes: quote.notes || '',
        description: quote.notes || '',
        subtotalExVat: quote.subtotal,
        subtotal: quote.subtotal,
        vatAmount: quote.vatAmount,
        totalVat: quote.vatAmount,
        grandTotal: quote.grandTotal,
        total: quote.grandTotal,
        amountPaid: 0,
        paidAmount: 0,
        balanceDue: 0,
        items: (quote.items || []).map((it) => ({
            id: it.id,
            productName: it.productName,
            product_name: it.productName,
            qty: it.qty,
            quantity: it.qty,
            unit: it.unit || 'pcs',
            uom: it.unit || 'pcs',
            unitPrice: it.unitPrice,
            unit_price: it.unitPrice,
            vatRate: it.vatRate,
            vat_rate: it.vatRate,
            lineTotal: it.lineTotal,
            line_total: it.lineTotal,
        })),
    };
}

function mapQuoteToWorkshopListRow(quote) {
    if (!quote || typeof quote !== 'object') return {};
    return {
        id: quote.id,
        invoice_number: quote.quoteNo,
        invoiceNo: quote.quoteNo,
        date: quote.quoteDate,
        status: quote.status,
        grand_total: quote.grandTotal,
    };
}

function unwrapQuote(res) {
    if (!res || typeof res !== 'object') return null;
    if (res.id && res.quoteNo) return res;
    if (res.data?.id) return res.data;
    return res;
}

function unwrapSuppliers(res) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    for (const k of ['suppliers', 'items', 'data']) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    return [];
}

function resolveBranchId(selectedBranchId, branches) {
    if (selectedBranchId && selectedBranchId !== 'all') return String(selectedBranchId);
    const first = (branches || []).find((b) => b?.id);
    return first ? String(first.id) : '';
}

export default function WorkshopPurchaseQuoteDocument({
    mode = 'quotes',
    selectedBranchId,
    branches = [],
    locale = 'en',
}) {
    const isOrders = mode === 'orders';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const wt = useCallback((key, vars) => wsDashT(locale, key, vars), [locale]);
    const [quotes, setQuotes] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [catalogItems, setCatalogItems] = useState([]);
    const [catalogSearchRemote, setCatalogSearchRemote] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [saving, setSaving] = useState(false);
    const [actingId, setActingId] = useState('');
    const [editingId, setEditingId] = useState('');
    const [form, setForm] = useState({
        quoteDate: todayISO(),
        validForDays: '30',
        refNo: '',
        refAuto: true,
        supplierId: '',
        notes: '',
        items: [emptyLine()],
    });

    const [pickerLineId, setPickerLineId] = useState(null);
    const [pickerInput, setPickerInput] = useState('');
    const [pickerFilter, setPickerFilter] = useState('');
    const [pickerMenuOpen, setPickerMenuOpen] = useState(false);
    const [pickerIndex, setPickerIndex] = useState(0);
    const pickerWrapRef = useRef(null);
    const pickerListRef = useRef(null);
    const lineFieldRefs = useRef({});

    const [viewQuoteId, setViewQuoteId] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewQuote, setViewQuote] = useState(null);
    const [viewError, setViewError] = useState('');
    const [printAfterOpen, setPrintAfterOpen] = useState(false);
    const viewRef = useRef(null);
    const pdfRef = useRef(null);
    const [pdfExport, setPdfExport] = useState(null);
    const [pdfBusy, setPdfBusy] = useState(false);

    const branchId = resolveBranchId(selectedBranchId, branches);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const params = {
                mode: isOrders ? 'orders' : 'quotes',
                ...(selectedBranchId && selectedBranchId !== 'all' ? { branchId: selectedBranchId } : {}),
            };
            const [q, s] = await Promise.all([
                listWorkshopPurchaseQuotes(params),
                isOrders
                    ? Promise.resolve({ suppliers: [] })
                    : listAffiliatedSuppliers({
                        isActive: true,
                        ...(selectedBranchId && selectedBranchId !== 'all'
                            ? { branchId: selectedBranchId }
                            : {}),
                    }).catch(() => ({})),
            ]);
            setQuotes(extractArray(unwrapPayload(q), ['items']));
            setSuppliers(
                unwrapSuppliers(s).filter((row) => row?.supplierId || row?.id),
            );
        } catch (e) {
            setErr(e?.message || t('logs.err.load'));
        } finally {
            setLoading(false);
        }
    }, [isOrders, selectedBranchId, t]);

    useEffect(() => {
        load();
    }, [load]);

    const supplierComboOptions = useMemo(
        () =>
            (suppliers || []).map((s) => ({
                id: String(s.supplierId || s.id),
                label: s.supplierName || s.name || String(s.supplierId || s.id),
                searchText: `${s.supplierName || s.name || ''} ${s.mobile || ''} ${s.email || ''}`,
            })),
        [suppliers],
    );

    const computedValidUntil = useMemo(
        () => addDaysIso(form.quoteDate, form.validForDays),
        [form.quoteDate, form.validForDays],
    );

    const nextQuotePreview = useMemo(() => previewNextQuoteNo(quotes), [quotes]);

    const catalogPool = useMemo(() => {
        const map = new Map();
        [...catalogItems, ...catalogSearchRemote].forEach((row) => {
            if (row?.id) map.set(String(row.id), row);
        });
        return Array.from(map.values());
    }, [catalogItems, catalogSearchRemote]);

    const loadCatalog = useCallback(
        async (supplierId, q) => {
            if (!supplierId) {
                setCatalogItems([]);
                return;
            }
            try {
                const res = await listWorkshopPurchaseQuoteCatalog({
                    supplierId,
                    ...(q ? { q } : {}),
                });
                const items = extractArray(unwrapPayload(res), ['items'])
                    .map(normalizeCatalogRow)
                    .filter((row) => row.name);
                if (q) setCatalogSearchRemote(items);
                else setCatalogItems(items);
            } catch {
                if (q) setCatalogSearchRemote([]);
                else setCatalogItems([]);
            }
        },
        [],
    );

    useEffect(() => {
        setCatalogSearchRemote([]);
        if (form.supplierId && !isOrders) loadCatalog(form.supplierId);
        else setCatalogItems([]);
    }, [form.supplierId, isOrders, loadCatalog]);

    useEffect(() => {
        if (isOrders || !form.supplierId) return undefined;
        const q = String(pickerFilter || '').trim();
        if (q.length < CATALOG_REMOTE_SEARCH_MIN_CHARS) {
            setCatalogSearchRemote([]);
            return undefined;
        }
        const timer = setTimeout(() => loadCatalog(form.supplierId, q), CATALOG_REMOTE_SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [form.supplierId, isOrders, loadCatalog, pickerFilter]);

    const pickerRows = useMemo(() => {
        const q = String(pickerFilter || '').toLowerCase();
        return catalogPool
            .filter((item) => {
                if (!q) return true;
                return (
                    String(item.name || '').toLowerCase().includes(q) ||
                    String(item.sku || '').toLowerCase().includes(q)
                );
            })
            .slice(0, SEARCH_MAX_RESULTS);
    }, [catalogPool, pickerFilter]);

    function closePicker() {
        setPickerLineId(null);
        setPickerMenuOpen(false);
        setPickerInput('');
        setPickerFilter('');
        setPickerIndex(0);
    }

    function applyCatalogToLine(lineId, item) {
        setForm((f) => ({
            ...f,
            items: f.items.map((row) =>
                row.id === lineId
                    ? {
                        ...row,
                        supplierProductId: item.id,
                        productName: item.name,
                        lineDescription: row.lineDescription || item.name,
                        unitPrice: String(item.price || 0),
                        unit: item.unit || row.unit || 'pcs',
                    }
                    : row,
            ),
        }));
        closePicker();
    }

    function updateLine(id, patch) {
        setForm((f) => ({
            ...f,
            items: f.items.map((row) => (row.id === id ? { ...row, ...patch } : row)),
        }));
    }

    function handleLineFieldTab(e, lineId, field, lineIndex) {
        if (e.key !== 'Tab' || e.shiftKey) return;
        const idx = LINE_TAB_FIELDS.indexOf(field);
        if (idx < 0 || idx < LINE_TAB_FIELDS.length - 1) return;
        e.preventDefault();
        const nextLine = form.items[lineIndex + 1];
        if (nextLine) {
            requestAnimationFrame(() => lineFieldRefs.current[`${nextLine.id}:product`]?.focus());
        } else {
            const created = emptyLine();
            setForm((f) => ({ ...f, items: [...f.items, created] }));
            requestAnimationFrame(() => lineFieldRefs.current[`${created.id}:product`]?.focus());
        }
    }

    const summary = useMemo(() => {
        return form.items.reduce(
            (acc, line) => {
                const m = lineMoney(line);
                acc.subtotal += m.total;
                acc.vat += m.taxAmt;
                acc.grand += m.grand;
                return acc;
            },
            { subtotal: 0, vat: 0, grand: 0 },
        );
    }, [form.items]);

    function resetForm() {
        setEditingId('');
        setForm({
            quoteDate: todayISO(),
            validForDays: '30',
            refNo: '',
            refAuto: true,
            supplierId: '',
            notes: '',
            items: [emptyLine()],
        });
    }

    function startEdit(quote) {
        setEditingId(String(quote.id));
        setForm(quoteToForm(quote));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function collectItems() {
        return form.items
            .filter((l) => l.productName && Number(l.qty) > 0)
            .map((l) => ({
                supplierProductId: l.supplierProductId || undefined,
                productName: l.productName,
                lineDescription: l.lineDescription || undefined,
                qty: Number(l.qty),
                unitPrice: Number(l.unitPrice || 0),
                vatRate: vatRateFromCode(l.taxCode || taxCodeFromVatRate(l.vatRate)),
                unit: l.unit || undefined,
            }));
    }

    async function submit(e) {
        e.preventDefault();
        setErr('');
        if (!form.supplierId) {
            setErr(t('mgr.qt.err.supplier'));
            return;
        }
        if (!branchId) {
            setErr(t('mgr.qt.err.branch'));
            return;
        }
        const items = collectItems();
        if (!items.length) {
            setErr(t('hub.err.rows'));
            return;
        }
        setSaving(true);
        try {
            const body = {
                quoteDate: form.quoteDate,
                validUntil: computedValidUntil || undefined,
                ...(form.refAuto ? {} : { quoteNo: form.refNo.trim() || undefined }),
                supplierId: form.supplierId,
                branchId,
                notes: form.notes.trim() || undefined,
                items,
            };
            if (editingId) await updateWorkshopPurchaseQuote(editingId, body);
            else await createWorkshopPurchaseQuote(body);
            resetForm();
            await load();
        } catch (ex) {
            setErr(ex?.message || t('hub.err.save'));
        } finally {
            setSaving(false);
        }
    }

    async function runQuoteAction(id, action) {
        setActingId(`${id}:${action}`);
        setErr('');
        try {
            if (action === 'send') await sendWorkshopPurchaseQuote(id);
            else if (action === 'accept') await acceptWorkshopPurchaseQuote(id);
            else if (action === 'reject') await rejectWorkshopPurchaseQuote(id);
            if (editingId && String(editingId) === String(id) && action !== 'send') {
                resetForm();
            }
            await load();
        } catch (ex) {
            setErr(ex?.message || t('mgr.qt.err.action'));
        } finally {
            setActingId('');
        }
    }

    async function resolveQuote(row) {
        const listed = quotes.find((q) => String(q.id) === String(row.id));
        if (listed?.items?.length) return listed;
        const fetched = unwrapQuote(await getWorkshopPurchaseQuote(row.id));
        return fetched || listed || null;
    }

    async function handleViewQuote(row, { print = false } = {}) {
        setViewQuoteId(String(row.id));
        setViewLoading(true);
        setViewError('');
        setViewQuote(null);
        setPrintAfterOpen(print);
        try {
            const quote = await resolveQuote(row);
            if (!quote) throw new Error(t('mgr.qt.err.view'));
            setViewQuote(quote);
        } catch (ex) {
            setViewError(ex?.message || t('mgr.qt.err.view'));
        } finally {
            setViewLoading(false);
        }
    }

    useEffect(() => {
        if (!printAfterOpen || viewLoading || !viewQuote) return undefined;
        const timer = setTimeout(() => {
            viewRef.current?.print?.();
            setPrintAfterOpen(false);
        }, 250);
        return () => clearTimeout(timer);
    }, [printAfterOpen, viewLoading, viewQuote]);

    async function handleDownloadQuote(row) {
        if (pdfBusy) return;
        setPdfBusy(true);
        setErr('');
        try {
            const quote = await resolveQuote(row);
            if (!quote) throw new Error(t('mgr.qt.err.view'));
            flushSync(() => setPdfExport(quote));
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise((r) => setTimeout(r, 180));
            const api = pdfRef.current;
            if (!api?.downloadPdf) throw new Error(t('mgr.qt.err.initPdf'));
            await api.downloadPdf();
        } catch (ex) {
            setErr(ex?.message || t('mgr.qt.err.pdf'));
        } finally {
            flushSync(() => setPdfExport(null));
            setPdfBusy(false);
        }
    }

    function closeView() {
        setViewQuoteId(null);
        setViewQuote(null);
        setViewError('');
        setPrintAfterOpen(false);
    }

    if (viewQuoteId) {
        return (
            <div className="module-container">
                <InlineFormScreen
                    title={
                        <div className="pi-modal-title">
                            <span className="pi-breadcrumb">
                                {wt(isOrders ? 'po.title' : 'pq.title')} ›{' '}
                                <span className="pi-b-active">
                                    {viewQuote?.quoteNo || t('mgr.qt.viewFallback')}
                                </span>
                            </span>
                        </div>
                    }
                    onBack={closeView}
                    backLabel={t('mgr.qt.back')}
                    bodyClassName="wpi-invoice-preview-modal"
                >
                    <div
                        className="quote-view-actions"
                        style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}
                    >
                        <button
                            type="button"
                            className="btn-pi-cancel"
                            disabled={viewLoading || !viewQuote}
                            onClick={() => viewRef.current?.print?.()}
                        >
                            {t('mgr.qt.print')}
                        </button>
                        <button
                            type="button"
                            className="btn-pi-cancel"
                            disabled={viewLoading || !viewQuote}
                            onClick={() => viewRef.current?.downloadPdf?.()}
                        >
                            {t('mgr.qt.downloadPdf')}
                        </button>
                    </div>
                    {viewLoading ? (
                        <AcctLoading locale={locale} />
                    ) : viewError ? (
                        <p style={{ margin: 0, color: '#B91C1C' }}>{viewError}</p>
                    ) : viewQuote ? (
                        <div className="quote-print-sheet">
                            <WorkshopPurchaseInvoiceView
                                ref={viewRef}
                                compact
                                variant="supplier_sales_quote"
                                detail={mapQuoteToWorkshopDetail(viewQuote)}
                                listRow={mapQuoteToWorkshopListRow(viewQuote)}
                            />
                        </div>
                    ) : (
                        <p style={{ margin: 0 }}>{wt(isOrders ? 'po.empty' : 'pq.empty')}</p>
                    )}
                </InlineFormScreen>
            </div>
        );
    }

    return (
        <div className="module-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AcctCard title={wt(isOrders ? 'po.title' : 'pq.title')} style={{ order: 2 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>
                    {wt(isOrders ? 'po.hint' : 'pq.hint')}
                </p>
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading locale={locale} />
                ) : quotes.length === 0 ? (
                    <AcctEmpty message={wt(isOrders ? 'po.empty' : 'pq.empty')} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('logs.th.date')}</th>
                                    <th>{t('logs.detail.ref')}</th>
                                    <th>{t('mgr.qt.supplier')}</th>
                                    <th>{t('mgr.qt.status')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('page.th.grandTotal')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {quotes.map((q) => {
                                    const canEdit = !isOrders && ['draft', 'sent'].includes(q.status);
                                    const canSend =
                                        !isOrders && (q.status === 'draft' || q.status === 'sent');
                                    const canAccept = !isOrders && q.status === 'sent' && q.origin === 'supplier';
                                    const canReject =
                                        !isOrders &&
                                        (q.status === 'sent' || q.status === 'accepted');
                                    return (
                                        <tr key={q.id}>
                                            <td>{fmtDate(q.quoteDate)}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="mgr-si-ref-link"
                                                    onClick={() => handleViewQuote(q)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        padding: 0,
                                                        color: '#1D4ED8',
                                                        cursor: 'pointer',
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    {q.quoteNo}
                                                </button>
                                            </td>
                                            <td>{q.supplierName || '—'}</td>
                                            <td>
                                                <QuoteStatusBadge
                                                    status={q.status}
                                                    label={t(`mgr.qt.status.${q.status || 'draft'}`)}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {money(q.grandTotal, 'SAR', { locale })}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        style={outlineBtnStyle}
                                                        onClick={() => handleViewQuote(q)}
                                                    >
                                                        {t('mgr.qt.view')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        style={outlineBtnStyle}
                                                        disabled={pdfBusy}
                                                        onClick={() => handleDownloadQuote(q)}
                                                    >
                                                        {t('mgr.qt.downloadPdf')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        style={outlineBtnStyle}
                                                        onClick={() => handleViewQuote(q, { print: true })}
                                                    >
                                                        {t('mgr.qt.print')}
                                                    </button>
                                                    {canEdit ? (
                                                        <button
                                                            type="button"
                                                            style={outlineBtnStyle}
                                                            onClick={() => startEdit(q)}
                                                        >
                                                            {t('mgr.qt.edit')}
                                                        </button>
                                                    ) : null}
                                                    {canSend ? (
                                                        <button
                                                            type="button"
                                                            style={outlineBtnStyle}
                                                            disabled={actingId === `${q.id}:send`}
                                                            onClick={() => runQuoteAction(q.id, 'send')}
                                                        >
                                                            {actingId === `${q.id}:send`
                                                                ? t('mgr.qt.sending')
                                                                : t('mgr.qt.send')}
                                                        </button>
                                                    ) : null}
                                                    {canAccept ? (
                                                        <button
                                                            type="button"
                                                            style={outlineBtnStyle}
                                                            disabled={actingId === `${q.id}:accept`}
                                                            onClick={() => runQuoteAction(q.id, 'accept')}
                                                        >
                                                            {actingId === `${q.id}:accept`
                                                                ? t('mgr.qt.accepting')
                                                                : t('mgr.qt.accept')}
                                                        </button>
                                                    ) : null}
                                                    {canReject ? (
                                                        <button
                                                            type="button"
                                                            style={outlineBtnStyle}
                                                            disabled={actingId === `${q.id}:reject`}
                                                            onClick={() => runQuoteAction(q.id, 'reject')}
                                                        >
                                                            {actingId === `${q.id}:reject`
                                                                ? t('mgr.qt.rejecting')
                                                                : t('mgr.qt.reject')}
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </AcctCard>

            {!isOrders ? (
                <AcctCard title={editingId ? t('mgr.qt.edit') : wt('pq.new')} style={{ order: 1 }}>
                    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: 12,
                            }}
                        >
                            <Field label={t('hub.field.date')} required>
                                <input
                                    type="date"
                                    style={inputStyle}
                                    value={form.quoteDate}
                                    onChange={(e) => setForm((f) => ({ ...f, quoteDate: e.target.value }))}
                                    required
                                />
                            </Field>
                            <Field label={t('mgr.qt.validFor')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        style={{ ...inputStyle, width: 80 }}
                                        value={form.validForDays}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, validForDays: e.target.value }))
                                        }
                                    />
                                    <span style={{ fontSize: 13, color: '#64748B' }}>{t('mgr.qt.days')}</span>
                                </div>
                                {computedValidUntil ? (
                                    <span className="pi-sub-label">{computedValidUntil}</span>
                                ) : null}
                            </Field>
                            <Field label={t('mgr.qt.ref')}>
                                <input
                                    style={{
                                        ...inputStyle,
                                        background: form.refAuto ? '#F1F5F9' : '#fff',
                                    }}
                                    placeholder={form.refAuto ? nextQuotePreview : t('mgr.qt.refOptional')}
                                    value={form.refAuto ? '' : form.refNo}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, refNo: e.target.value, refAuto: false }))
                                    }
                                    disabled={form.refAuto}
                                />
                                <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, fontSize: 12 }}>
                                    <input
                                        type="checkbox"
                                        checked={form.refAuto}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                refAuto: e.target.checked,
                                                refNo: e.target.checked ? '' : f.refNo,
                                            }))
                                        }
                                    />
                                    {t('mgr.qt.refAuto')}
                                </label>
                            </Field>
                            <Field label={t('mgr.qt.supplier')} required>
                                <SupplierAccountingCombobox
                                    options={supplierComboOptions}
                                    value={form.supplierId}
                                    onChange={(id) =>
                                        setForm((f) => ({
                                            ...f,
                                            supplierId: id,
                                            items: editingId ? f.items : [emptyLine()],
                                        }))
                                    }
                                    placeholder={t('mgr.qt.ph.supplier')}
                                    entityLabel={t('mgr.qt.supplier')}
                                    disabled={Boolean(editingId)}
                                />
                            </Field>
                        </div>
                        <Field label={t('mgr.qt.description')}>
                            <textarea
                                style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                                value={form.notes}
                                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                            />
                        </Field>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table pi-lines-table" style={{ width: '100%' }}>
                                <thead>
                                    <tr>
                                        <th>{t('mgr.qt.product')}</th>
                                        <th>{t('mgr.qt.lineDesc')}</th>
                                        <th>{t('mgr.qt.qty')}</th>
                                        <th>{t('mgr.qt.price')}</th>
                                        <th>{t('mgr.qt.lineTotal')}</th>
                                        <th>{t('mgr.qt.taxCode')}</th>
                                        <th>{t('mgr.qt.taxAmt')}</th>
                                        <th>{t('mgr.qt.lineGrand')}</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {form.items.map((l, idx) => (
                                        <tr key={l.id}>
                                            <td>
                                                <div ref={pickerLineId === l.id ? pickerWrapRef : null} style={{ position: 'relative' }}>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <input
                                                            style={inputStyle}
                                                            ref={(el) => {
                                                                lineFieldRefs.current[`${l.id}:product`] = el;
                                                            }}
                                                            value={pickerLineId === l.id ? pickerInput : l.productName}
                                                            placeholder={t('mgr.qt.ph.product')}
                                                            disabled={!form.supplierId}
                                                            onFocus={() => {
                                                                setPickerLineId(l.id);
                                                                setPickerInput(l.productName);
                                                                setPickerFilter(l.productName);
                                                                setPickerMenuOpen(true);
                                                                setPickerIndex(0);
                                                            }}
                                                            onChange={(e) => {
                                                                setPickerLineId(l.id);
                                                                setPickerInput(e.target.value);
                                                                setPickerFilter(e.target.value);
                                                                setPickerMenuOpen(true);
                                                                updateLine(l.id, {
                                                                    productName: e.target.value,
                                                                    supplierProductId: '',
                                                                });
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'ArrowDown') {
                                                                    e.preventDefault();
                                                                    setPickerIndex((i) =>
                                                                        Math.min(i + 1, Math.max(pickerRows.length - 1, 0)),
                                                                    );
                                                                } else if (e.key === 'ArrowUp') {
                                                                    e.preventDefault();
                                                                    setPickerIndex((i) => Math.max(i - 1, 0));
                                                                } else if (e.key === 'Enter' && pickerMenuOpen && pickerRows[pickerIndex]) {
                                                                    e.preventDefault();
                                                                    applyCatalogToLine(l.id, pickerRows[pickerIndex]);
                                                                } else {
                                                                    handleLineFieldTab(e, l.id, 'product', idx);
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            disabled={!form.supplierId}
                                                            onClick={() => {
                                                                setPickerLineId(l.id);
                                                                setPickerInput(l.productName);
                                                                setPickerFilter(l.productName);
                                                                setPickerMenuOpen((open) => pickerLineId !== l.id || !open);
                                                            }}
                                                            style={{
                                                                flex: '0 0 auto',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                padding: '0 8px',
                                                                borderRadius: 8,
                                                                border: '1px solid #e2e8f0',
                                                                background: '#f8fafc',
                                                                cursor: 'pointer',
                                                                color: '#475569',
                                                                minHeight: 36,
                                                            }}
                                                        >
                                                            <ChevronDown size={16} />
                                                        </button>
                                                    </div>
                                                    {pickerLineId === l.id && pickerMenuOpen ? (
                                                        <div
                                                            ref={pickerListRef}
                                                            className="pi-search-results pi-line-item-picker-results"
                                                            style={{ zIndex: 20 }}
                                                        >
                                                            {pickerRows.length ? (
                                                                pickerRows.map((invItem, i) => (
                                                                    <div
                                                                        key={`${l.id}-${String(invItem.id)}-${i}`}
                                                                        className={`pi-result-item ${pickerIndex === i ? 'selected' : ''}`}
                                                                        onMouseDown={(ev) => {
                                                                            ev.preventDefault();
                                                                            applyCatalogToLine(l.id, invItem);
                                                                        }}
                                                                        onMouseEnter={() => setPickerIndex(i)}
                                                                    >
                                                                        <div className="pi-result-info">
                                                                            <div className="pi-item-name">{invItem.name}</div>
                                                                            <div className="pi-item-meta">
                                                                                {invItem.sku ? <span>{invItem.sku}</span> : null}
                                                                                {invItem.unit ? (
                                                                                    <span>
                                                                                        {invItem.sku ? ' · ' : ''}
                                                                                        {invItem.unit}
                                                                                    </span>
                                                                                ) : null}
                                                                            </div>
                                                                        </div>
                                                                        <div className="pi-item-price">
                                                                            <div className="pi-price-val">
                                                                                {money(invItem.price, 'SAR', { locale })}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div style={{ padding: 14, fontSize: 13, color: '#64748b' }}>
                                                                    {catalogItems.length === 0
                                                                        ? t('mgr.qt.empty.noProductsLoaded')
                                                                        : t('mgr.qt.empty.noProducts')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td>
                                                <input
                                                    style={inputStyle}
                                                    ref={(el) => {
                                                        lineFieldRefs.current[`${l.id}:description`] = el;
                                                    }}
                                                    value={l.lineDescription}
                                                    onChange={(e) =>
                                                        updateLine(l.id, { lineDescription: e.target.value })
                                                    }
                                                    onKeyDown={(e) =>
                                                        handleLineFieldTab(e, l.id, 'description', idx)
                                                    }
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0.001"
                                                    step="0.001"
                                                    style={inputStyle}
                                                    ref={(el) => {
                                                        lineFieldRefs.current[`${l.id}:qty`] = el;
                                                    }}
                                                    value={l.qty}
                                                    onChange={(e) => updateLine(l.id, { qty: e.target.value })}
                                                    onKeyDown={(e) => handleLineFieldTab(e, l.id, 'qty', idx)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    style={inputStyle}
                                                    ref={(el) => {
                                                        lineFieldRefs.current[`${l.id}:unitPrice`] = el;
                                                    }}
                                                    value={l.unitPrice}
                                                    onChange={(e) =>
                                                        updateLine(l.id, { unitPrice: e.target.value })
                                                    }
                                                    onKeyDown={(e) =>
                                                        handleLineFieldTab(e, l.id, 'unitPrice', idx)
                                                    }
                                                />
                                            </td>
                                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                {money(lineMoney(l).total, 'SAR', { locale })}
                                            </td>
                                            <td>
                                                <select
                                                    style={inputStyle}
                                                    ref={(el) => {
                                                        lineFieldRefs.current[`${l.id}:taxCode`] = el;
                                                    }}
                                                    value={l.taxCode || taxCodeFromVatRate(l.vatRate)}
                                                    onChange={(e) =>
                                                        updateLine(l.id, {
                                                            taxCode: e.target.value,
                                                            vatRate: String(vatRateFromCode(e.target.value)),
                                                        })
                                                    }
                                                    onKeyDown={(e) => handleLineFieldTab(e, l.id, 'taxCode', idx)}
                                                >
                                                    {TAXES.map((tx) => (
                                                        <option key={tx.code} value={tx.code}>
                                                            {tx.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                {money(lineMoney(l).taxAmt, 'SAR', { locale })}
                                            </td>
                                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                {money(lineMoney(l).grand, 'SAR', { locale })}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    style={{ ...outlineBtnStyle, color: '#B91C1C' }}
                                                    disabled={form.items.length === 1}
                                                    onClick={() =>
                                                        setForm((f) => ({
                                                            ...f,
                                                            items: f.items.filter((row) => row.id !== l.id),
                                                        }))
                                                    }
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: 16,
                                flexWrap: 'wrap',
                            }}
                        >
                            <button
                                type="button"
                                style={outlineBtnStyle}
                                onClick={() =>
                                    setForm((f) => ({ ...f, items: [...f.items, emptyLine()] }))
                                }
                            >
                                <Plus size={14} /> {t('mgr.qt.addLine')}
                            </button>
                            <div className="pi-summary">
                                <div className="pi-summary-row">
                                    <span>{t('mgr.qt.summary.subtotal')}</span>
                                    <span>{money(summary.subtotal, 'SAR', { locale })}</span>
                                </div>
                                <div className="pi-summary-row">
                                    <span>{t('mgr.qt.summary.vat')}</span>
                                    <span>{money(summary.vat, 'SAR', { locale })}</span>
                                </div>
                                <div className="pi-summary-row pi-grand-total">
                                    <span>{t('mgr.qt.summary.grand')}</span>
                                    <span>{money(summary.grand, 'SAR', { locale })}</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="submit" style={primaryBtnStyle} disabled={saving}>
                                {saving
                                    ? t('hub.btn.saving')
                                    : editingId
                                      ? t('mgr.qt.saveUpdate')
                                      : t('mgr.qt.save')}
                            </button>
                            {editingId ? (
                                <button type="button" style={outlineBtnStyle} onClick={resetForm}>
                                    {t('mgr.qt.cancelEdit')}
                                </button>
                            ) : null}
                        </div>
                    </form>
                </AcctCard>
            ) : null}

            {pdfExport ? (
                <div aria-hidden className="sales-invoice-pdf-export-mount">
                    <WorkshopPurchaseInvoiceView
                        ref={pdfRef}
                        compact
                        variant="supplier_sales_quote"
                        detail={mapQuoteToWorkshopDetail(pdfExport)}
                        listRow={mapQuoteToWorkshopListRow(pdfExport)}
                    />
                </div>
            ) : null}
        </div>
    );
}
