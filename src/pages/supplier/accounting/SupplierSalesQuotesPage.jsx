import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, FileText, Plus, Trash2 } from 'lucide-react';
import {
    acceptSupplierSalesQuote,
    createSupplierSalesQuote,
    getSupplierSalesQuote,
    listSupplierSalesQuotes,
    rejectSupplierSalesQuote,
    sendSupplierSalesQuote,
} from '../../../services/supplierAccountingApi';
import QuoteStatusBadge from './QuoteStatusBadge';
import SupplierAccountingCombobox from './SupplierAccountingCombobox';
import {
    getSupplierInventoryStockBalances,
    getSupplierSalesInvoiceCustomerBranches,
} from '../../../services/supplierApi';
import { saccT } from '../../../utils/supplierAccountingI18n';
import InlineFormScreen from '../../../components/InlineFormScreen';
import WorkshopPurchaseInvoiceView from '../../../components/supplier/WorkshopPurchaseInvoiceView';
import '../../../styles/admin/AccountingPage.css';
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
} from './SupplierAccountingShared';
import { extractArray, unwrapPayload } from './SupplierManagerAccountingShared';

const SEARCH_QUICK_PICK = 15;
const SEARCH_MAX_RESULTS = 50;
const CATALOG_STOCK_BALANCES_LIMIT = 2000;
const CATALOG_REMOTE_SEARCH_MIN_CHARS = 2;
const CATALOG_REMOTE_SEARCH_DEBOUNCE_MS = 280;
const LINE_TAB_FIELDS = ['product', 'description', 'qty', 'unitPrice', 'taxCode'];

const TAXES = [
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
    { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0 },
    { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0 },
];

const SALES_INVOICE_FROM_QUOTE_KEY = 'salesInvoiceFromQuote';

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

function customerBillingAddress(customer) {
    if (!customer) return '';
    return (
        customer.billingAddress ||
        customer.address ||
        customer.street ||
        customer.subtitle ||
        ''
    );
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

function matchesCatalogSearchQuery(item, queryLower) {
    if (!queryLower) return true;
    const name = String(item?.name ?? '').toLowerCase();
    const sku = String(item?.sku ?? '').toLowerCase();
    return name.includes(queryLower) || (sku && sku.includes(queryLower));
}

function mergeCatalogLists(primary, extra) {
    const map = new Map();
    (primary || []).forEach((row) => {
        if (!row?.id) return;
        map.set(String(row.id), row);
    });
    (extra || []).forEach((row) => {
        if (!row?.id) return;
        if (!map.has(String(row.id))) map.set(String(row.id), row);
    });
    return Array.from(map.values());
}

function normalizeQuoteCatalogRow(item) {
    const supplierStockProductId =
        item.productId != null && item.productId !== ''
            ? String(item.productId).trim()
            : '';
    const catalogId =
        supplierStockProductId ||
        (item.supplierProductId != null && item.supplierProductId !== ''
            ? String(item.supplierProductId).trim()
            : '');
    const salePrice = Number(item.salePrice ?? item.sellingPrice ?? 0);
    const suggested = Number(item.suggestedSaleUnitPriceWorkshop ?? item.unitPrice ?? 0);
    const price = salePrice > 0 ? salePrice : suggested > 0 ? suggested : 0;
    const unit = item.warehouseUnit || item.unitCode || item.unit || 'pcs';
    return {
        id: catalogId || `row-${item.productName}-${item.sku || ''}`,
        name: item.productName || item.name || '',
        sku: String(item.sku ?? item.barcode ?? '').trim(),
        price,
        unit,
        stockHint:
            item.currentBalanceWarehouse != null
                ? `${Number(item.currentBalanceWarehouse || 0)} ${unit}`
                : '',
    };
}

function customerLabelForQuote(quote, customers) {
    if (!quote) return '';
    const list = customers || [];
    if (quote.externalPartyId) {
        const hit = list.find(
            (c) => String(c.externalPartyId || '') === String(quote.externalPartyId),
        );
        if (hit?.label) return hit.label;
    }
    if (quote.branchId) {
        const hit = list.find((c) => String(c.branchId || '') === String(quote.branchId));
        if (hit?.label) return hit.label;
    }
    if (quote.workshopId) {
        const hit = list.find((c) => String(c.workshopId || '') === String(quote.workshopId));
        if (hit?.label) return hit.label;
    }
    return '';
}

function mapQuoteToWorkshopDetail(quote, customers) {
    if (!quote || typeof quote !== 'object') return {};
    const customerLabel = customerLabelForQuote(quote, customers);
    return {
        id: quote.id,
        invoiceNumber: quote.quoteNo,
        invoiceNo: quote.quoteNo,
        issueDate: quote.quoteDate,
        invoiceDate: quote.quoteDate,
        dueDate: quote.validUntil,
        status: quote.status,
        workshopName: customerLabel,
        branchName: customerLabel,
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

export default function SupplierSalesQuotesPage({ locale = 'en' }) {
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [quotes, setQuotes] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [catalogItems, setCatalogItems] = useState([]);
    const [catalogSearchRemote, setCatalogSearchRemote] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [saving, setSaving] = useState(false);
    const [copyingId, setCopyingId] = useState('');
    const [actingId, setActingId] = useState('');
    const [form, setForm] = useState({
        quoteDate: todayISO(),
        validForDays: '30',
        refNo: '',
        refAuto: true,
        customerKey: '',
        billingAddress: '',
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
    const pickerLineIdRef = useRef(null);
    const pickerInputRef = useRef('');
    const lineFieldRefs = useRef({});
    const pendingFocusRef = useRef(null);

    const [viewQuoteId, setViewQuoteId] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewQuote, setViewQuote] = useState(null);
    const [viewError, setViewError] = useState('');
    const [printAfterOpen, setPrintAfterOpen] = useState(false);
    const viewRef = useRef(null);
    const pdfRef = useRef(null);
    const [pdfExport, setPdfExport] = useState(null);
    const [pdfBusy, setPdfBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [q, c, stockRes] = await Promise.all([
                listSupplierSalesQuotes(),
                getSupplierSalesInvoiceCustomerBranches().catch(() => ({})),
                getSupplierInventoryStockBalances({ limit: CATALOG_STOCK_BALANCES_LIMIT }).catch(
                    () => ({}),
                ),
            ]);
            setQuotes(extractArray(unwrapPayload(q), ['items']));
            setCustomers(extractArray(c, ['customers']));
            const stockItems = Array.isArray(stockRes?.items)
                ? stockRes.items.map(normalizeQuoteCatalogRow).filter((row) => row.name)
                : [];
            setCatalogItems(stockItems);
        } catch (e) {
            setErr(e?.message || t('logs.err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    const selectedCustomer = useMemo(
        () => customers.find((c) => String(c.key) === String(form.customerKey)),
        [customers, form.customerKey],
    );

    const customerComboOptions = useMemo(
        () =>
            (customers || [])
                .filter((c) => !c.disabled)
                .map((c) => ({
                    id: String(c.key),
                    label: c.label,
                    searchText: `${c.label || ''} ${c.subtitle || ''} ${c.group || ''}`,
                })),
        [customers],
    );

    const computedValidUntil = useMemo(
        () => addDaysIso(form.quoteDate, form.validForDays),
        [form.quoteDate, form.validForDays],
    );

    const nextQuotePreview = useMemo(() => previewNextQuoteNo(quotes), [quotes]);

    const catalogPool = useMemo(
        () => mergeCatalogLists(catalogItems, catalogSearchRemote),
        [catalogItems, catalogSearchRemote],
    );

    const getSearchSuggestions = useCallback(
        (query) => {
            const items = [...catalogPool].sort((a, b) =>
                String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                    sensitivity: 'base',
                }),
            );
            const q = String(query || '').trim().toLowerCase();
            if (!q) return items.slice(0, SEARCH_QUICK_PICK);
            return items.filter((i) => matchesCatalogSearchQuery(i, q)).slice(0, SEARCH_MAX_RESULTS);
        },
        [catalogPool],
    );

    const pickerRows = useMemo(
        () => getSearchSuggestions(pickerFilter),
        [getSearchSuggestions, pickerFilter],
    );

    const summary = useMemo(() => {
        let subtotal = 0;
        let vat = 0;
        form.items.forEach((l) => {
            const m = lineMoney(l);
            subtotal += m.total;
            vat += m.taxAmt;
        });
        return {
            subtotal: Math.round(subtotal * 100) / 100,
            vat: Math.round(vat * 100) / 100,
            grand: Math.round((subtotal + vat) * 100) / 100,
        };
    }, [form.items]);

    const focusLineField = useCallback((lineId, fieldName) => {
        requestAnimationFrame(() => {
            lineFieldRefs.current[`${lineId}:${fieldName}`]?.focus?.();
        });
    }, []);

    useEffect(() => {
        const pending = pendingFocusRef.current;
        if (!pending) return;
        pendingFocusRef.current = null;
        focusLineField(pending.lineId, pending.fieldName);
    }, [form.items.length, focusLineField]);

    useEffect(() => {
        pickerLineIdRef.current = pickerLineId;
    }, [pickerLineId]);

    useEffect(() => {
        pickerInputRef.current = pickerInput;
    }, [pickerInput]);

    useEffect(() => {
        const q = String(pickerFilter || '').trim();
        if (pickerLineId == null || !pickerMenuOpen || q.length < CATALOG_REMOTE_SEARCH_MIN_CHARS) {
            setCatalogSearchRemote([]);
            return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const stockRes = await getSupplierInventoryStockBalances({
                    limit: SEARCH_MAX_RESULTS,
                    search: q,
                });
                if (cancelled) return;
                const rows = Array.isArray(stockRes?.items)
                    ? stockRes.items.map(normalizeQuoteCatalogRow).filter((row) => row.name)
                    : [];
                setCatalogSearchRemote(rows);
            } catch {
                if (!cancelled) setCatalogSearchRemote([]);
            }
        }, CATALOG_REMOTE_SEARCH_DEBOUNCE_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [pickerFilter, pickerLineId, pickerMenuOpen]);

    const commitPickerText = useCallback((lineId) => {
        const text = String(pickerInputRef.current ?? '').trim();
        if (!lineId) return;
        setForm((f) => ({
            ...f,
            items: f.items.map((l) => {
                if (l.id !== lineId) return l;
                if (!text && l.supplierProductId) return l;
                if (text === String(l.productName ?? '').trim()) return l;
                return { ...l, productName: text };
            }),
        }));
    }, []);

    const closePicker = useCallback(
        (lineId = pickerLineIdRef.current) => {
            commitPickerText(lineId);
            setPickerLineId(null);
            setPickerInput('');
            setPickerFilter('');
            setPickerMenuOpen(false);
        },
        [commitPickerText],
    );

    useEffect(() => {
        if (pickerLineId == null || !pickerMenuOpen) return undefined;
        const openId = pickerLineId;
        const onDocMouseDown = (e) => {
            const el = pickerWrapRef.current;
            if (el && !el.contains(e.target)) closePicker(openId);
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [pickerLineId, pickerMenuOpen, closePicker]);

    useEffect(() => {
        if (pickerLineId == null || !pickerMenuOpen || !pickerListRef.current) return;
        const el = pickerListRef.current.querySelector(`[data-pick-idx="${pickerIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
    }, [pickerLineId, pickerMenuOpen, pickerIndex]);

    function updateLine(lineId, patch) {
        setForm((f) => ({
            ...f,
            items: f.items.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
        }));
    }

    function applyCatalogToLine(lineId, catalogItem) {
        updateLine(lineId, {
            supplierProductId: catalogItem.id || '',
            productName: catalogItem.name || '',
            unitPrice:
                catalogItem.price != null && catalogItem.price !== ''
                    ? String(catalogItem.price)
                    : '',
            unit: catalogItem.unit || 'pcs',
        });
        setPickerLineId(null);
        setPickerInput('');
        setPickerFilter('');
        setPickerMenuOpen(false);
        focusLineField(lineId, 'description');
    }

    function activateProductField(line, { openMenu } = {}) {
        const prevId = pickerLineIdRef.current;
        if (prevId != null && prevId !== line.id) commitPickerText(prevId);
        const linked = Boolean(line.supplierProductId);
        const hasLabel = Boolean(String(line.productName ?? '').trim());
        const shouldOpen =
            openMenu === true ? true : openMenu === false ? false : !linked && !hasLabel;
        setPickerLineId(line.id);
        setPickerInput(String(line.productName ?? ''));
        setPickerFilter(shouldOpen ? '' : String(line.productName ?? ''));
        setPickerIndex(0);
        setPickerMenuOpen(shouldOpen);
    }

    function addEmptyLine() {
        const line = emptyLine();
        setForm((f) => ({ ...f, items: [...f.items, line] }));
        pendingFocusRef.current = { lineId: line.id, fieldName: 'product' };
        return line.id;
    }

    function handleLineFieldTab(e, lineId, fieldName, lineIndex) {
        if (e.key !== 'Tab' || e.shiftKey) return;
        const fieldIdx = LINE_TAB_FIELDS.indexOf(fieldName);
        if (fieldIdx < 0 || fieldIdx !== LINE_TAB_FIELDS.length - 1) return;
        e.preventDefault();
        const nextLine = form.items[lineIndex + 1];
        if (nextLine) {
            focusLineField(nextLine.id, 'product');
            return;
        }
        addEmptyLine();
    }

    function handleProductKeyDown(e, line, lineIndex) {
        if (pickerLineId === line.id) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!pickerMenuOpen) setPickerMenuOpen(true);
                setPickerIndex((i) => Math.min(i + 1, Math.max(0, pickerRows.length - 1)));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!pickerMenuOpen) setPickerMenuOpen(true);
                setPickerIndex((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (pickerMenuOpen && pickerRows[pickerIndex]) {
                    applyCatalogToLine(line.id, pickerRows[pickerIndex]);
                    return;
                }
                closePicker(line.id);
                focusLineField(line.id, 'description');
                return;
            }
            if (e.key === 'Tab' && !e.shiftKey) {
                closePicker(line.id);
            }
        }
        handleLineFieldTab(e, line.id, 'product', lineIndex);
    }

    async function submit(e) {
        e.preventDefault();
        setErr('');
        if (!selectedCustomer) {
            setErr(t('hub.err.rows'));
            return;
        }
        const items = form.items
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
        if (!items.length) {
            setErr(t('hub.err.rows'));
            return;
        }
        setSaving(true);
        try {
            const nonAff =
                selectedCustomer.customerType === 'non_affiliated' ||
                selectedCustomer.customerType === 'external_party' ||
                selectedCustomer.externalPartyId;
            await createSupplierSalesQuote({
                quoteDate: form.quoteDate,
                validUntil: computedValidUntil || undefined,
                ...(form.refAuto ? {} : { quoteNo: form.refNo.trim() || undefined }),
                customerType: nonAff ? 'non_affiliated' : 'affiliated',
                branchId: selectedCustomer.branchId || undefined,
                workshopId: selectedCustomer.workshopId || undefined,
                externalPartyId: selectedCustomer.externalPartyId || undefined,
                notes: form.notes.trim() || undefined,
                billingAddress: form.billingAddress.trim() || undefined,
                items,
            });
            setForm((f) => ({
                ...f,
                notes: '',
                billingAddress: '',
                refNo: '',
                items: [emptyLine()],
            }));
            await load();
        } catch (ex) {
            setErr(ex?.message || t('hub.err.save'));
        } finally {
            setSaving(false);
        }
    }

    function copyToInvoice(id) {
        setCopyingId(id);
        navigate('/supplier/sales_invoices', {
            state: { [SALES_INVOICE_FROM_QUOTE_KEY]: { quoteId: String(id) } },
        });
    }

    async function runQuoteAction(id, action) {
        setActingId(`${id}:${action}`);
        setErr('');
        try {
            if (action === 'send') await sendSupplierSalesQuote(id);
            else if (action === 'accept') await acceptSupplierSalesQuote(id);
            else if (action === 'reject') await rejectSupplierSalesQuote(id);
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
        const fetched = unwrapQuote(await getSupplierSalesQuote(row.id));
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
                                {t('mgr.qt.title')} ›{' '}
                                <span className="pi-b-active">
                                    {viewQuote?.quoteNo || t('mgr.qt.viewFallback')}
                                </span>
                            </span>
                            <div className="pi-title-main">
                                <FileText size={24} />
                                <span>{t('mgr.qt.title')}</span>
                            </div>
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
                                detail={mapQuoteToWorkshopDetail(viewQuote, customers)}
                                listRow={mapQuoteToWorkshopListRow(viewQuote)}
                            />
                        </div>
                    ) : (
                        <p style={{ margin: 0 }}>{t('mgr.qt.empty')}</p>
                    )}
                </InlineFormScreen>
            </div>
        );
    }

    return (
        <div className="module-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AcctCard title={t('mgr.qt.title')} style={{ order: 2 }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>{t('mgr.qt.hint')}</p>
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading locale={locale} />
                ) : quotes.length === 0 ? (
                    <AcctEmpty message={t('mgr.qt.empty')} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('logs.th.date')}</th>
                                    <th>{t('logs.detail.ref')}</th>
                                    <th>{t('mgr.qt.status')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('page.th.grandTotal')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {quotes.map((q) => (
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
                                                {q.status === 'draft' ? (
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
                                                {q.origin === 'workshop' && q.status === 'sent' ? (
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
                                                {q.origin === 'workshop' &&
                                                (q.status === 'sent' || q.status === 'accepted') ? (
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
                                                {q.status === 'sent' || q.status === 'accepted' ? (
                                                    <button
                                                        type="button"
                                                        style={outlineBtnStyle}
                                                        disabled={copyingId === q.id}
                                                        onClick={() => copyToInvoice(q.id)}
                                                    >
                                                        {copyingId === q.id
                                                            ? t('mgr.qt.copying')
                                                            : t('mgr.qt.copy')}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AcctCard>

            <AcctCard title={t('mgr.qt.new')} style={{ order: 1 }}>
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
                                value={form.refAuto ? nextQuotePreview : form.refNo}
                                readOnly={form.refAuto}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, refAuto: false, refNo: e.target.value }))
                                }
                            />
                            <label
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginTop: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#64748B',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={form.refAuto}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, refAuto: e.target.checked }))
                                    }
                                />
                                {t('mgr.qt.refAuto')}
                            </label>
                        </Field>
                        <Field label={t('mgr.qt.customer')} required>
                            <SupplierAccountingCombobox
                                options={customerComboOptions}
                                value={form.customerKey}
                                onChange={(key) => {
                                    const next = customers.find((c) => String(c.key) === String(key));
                                    setForm((f) => ({
                                        ...f,
                                        customerKey: key || '',
                                        billingAddress: next
                                            ? customerBillingAddress(next) || f.billingAddress
                                            : f.billingAddress,
                                    }));
                                }}
                                placeholder={t('mgr.qt.ph.customer')}
                                entityLabel={t('mgr.qt.customer')}
                                emptyHint={t('select.dash')}
                                menuMinWidth={280}
                            />
                        </Field>
                    </div>
                    <Field label={t('mgr.qt.billing')}>
                        <textarea
                            style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                            value={form.billingAddress}
                            onChange={(e) =>
                                setForm((f) => ({ ...f, billingAddress: e.target.value }))
                            }
                        />
                    </Field>
                    <Field label={t('mgr.qt.description')}>
                        <input
                            style={inputStyle}
                            value={form.notes}
                            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        />
                    </Field>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%', minWidth: 980 }}>
                            <thead>
                                <tr>
                                    <th>{t('mgr.qt.product')}</th>
                                    <th>{t('mgr.qt.lineDesc')}</th>
                                    <th style={{ width: 80 }}>{t('mgr.qt.qty')}</th>
                                    <th style={{ width: 110 }}>{t('mgr.qt.price')}</th>
                                    <th style={{ width: 100 }}>{t('mgr.qt.lineTotal')}</th>
                                    <th style={{ width: 120 }}>{t('mgr.qt.taxCode')}</th>
                                    <th style={{ width: 100 }}>{t('mgr.qt.taxAmt')}</th>
                                    <th style={{ width: 110 }}>{t('mgr.qt.lineGrand')}</th>
                                    <th style={{ width: 44 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {form.items.map((l, idx) => (
                                    <tr key={l.id}>
                                        <td>
                                            <div
                                                ref={pickerLineId === l.id ? pickerWrapRef : null}
                                                style={{ position: 'relative', width: '100%' }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: 4,
                                                        width: '100%',
                                                    }}
                                                >
                                                    <input
                                                        style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                                                        ref={(el) => {
                                                            lineFieldRefs.current[`${l.id}:product`] = el;
                                                        }}
                                                        value={
                                                            pickerLineId === l.id
                                                                ? pickerInput
                                                                : l.productName
                                                        }
                                                        placeholder={t('mgr.qt.ph.product')}
                                                        onFocus={() => activateProductField(l)}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            const prevId = pickerLineIdRef.current;
                                                            if (prevId != null && prevId !== l.id) {
                                                                commitPickerText(prevId);
                                                            }
                                                            setPickerLineId(l.id);
                                                            setPickerInput(v);
                                                            setPickerFilter(v);
                                                            setPickerIndex(0);
                                                            setPickerMenuOpen(true);
                                                        }}
                                                        onKeyDown={(e) => handleProductKeyDown(e, l, idx)}
                                                    />
                                                    <button
                                                        type="button"
                                                        title={t('mgr.qt.ph.product')}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => {
                                                            if (pickerLineId === l.id && pickerMenuOpen) {
                                                                closePicker(l.id);
                                                            } else {
                                                                activateProductField(l, { openMenu: true });
                                                                focusLineField(l.id, 'product');
                                                            }
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
                                                                    data-pick-idx={i}
                                                                    className={`pi-result-item ${
                                                                        pickerIndex === i ? 'selected' : ''
                                                                    }`}
                                                                    onMouseDown={(ev) => {
                                                                        ev.preventDefault();
                                                                        applyCatalogToLine(l.id, invItem);
                                                                    }}
                                                                    onMouseEnter={() => setPickerIndex(i)}
                                                                >
                                                                    <div className="pi-result-info">
                                                                        <div className="pi-item-name">
                                                                            {invItem.name}
                                                                        </div>
                                                                        <div className="pi-item-meta">
                                                                            {invItem.sku ? (
                                                                                <span>{invItem.sku}</span>
                                                                            ) : null}
                                                                            {invItem.unit ? (
                                                                                <span>
                                                                                    {invItem.sku ? ' · ' : ''}
                                                                                    {invItem.unit}
                                                                                </span>
                                                                            ) : null}
                                                                            {invItem.stockHint ? (
                                                                                <span
                                                                                    style={{
                                                                                        display: 'block',
                                                                                        fontSize: 11,
                                                                                        color: '#64748b',
                                                                                    }}
                                                                                >
                                                                                    {invItem.stockHint}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                    <div className="pi-item-price">
                                                                        <div className="pi-price-val">
                                                                            {money(invItem.price, 'SAR', {
                                                                                locale,
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div
                                                                style={{
                                                                    padding: 14,
                                                                    fontSize: 13,
                                                                    color: '#64748b',
                                                                }}
                                                            >
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
                                                onKeyDown={(e) =>
                                                    handleLineFieldTab(e, l.id, 'qty', idx)
                                                }
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
                                                onKeyDown={(e) =>
                                                    handleLineFieldTab(e, l.id, 'taxCode', idx)
                                                }
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
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" style={outlineBtnStyle} onClick={addEmptyLine}>
                                <Plus size={14} /> {t('mgr.qt.addLine')}
                            </button>
                            <button type="submit" style={primaryBtnStyle} disabled={saving}>
                                {saving ? t('hub.btn.saving') : t('mgr.qt.save')}
                            </button>
                        </div>
                        <div className="pi-summary-card" style={{ minWidth: 260, flex: '0 0 280px' }}>
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
                </form>
            </AcctCard>

            {pdfExport ? (
                <div aria-hidden className="sales-invoice-pdf-export-mount">
                    <WorkshopPurchaseInvoiceView
                        ref={pdfRef}
                        compact
                        variant="supplier_sales_quote"
                        detail={mapQuoteToWorkshopDetail(pdfExport, customers)}
                        listRow={mapQuoteToWorkshopListRow(pdfExport)}
                    />
                </div>
            ) : null}
        </div>
    );
}
