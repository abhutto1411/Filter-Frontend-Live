import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Plus,
    Calendar,
    ShoppingCart,
    Search,
    Zap,
    Eye,
    Download,
    Building2,
    History,
    ChevronDown,
    Trash2,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import SupplierSuperSupplierPurchasesPanel from './SupplierSuperSupplierPurchasesPanel';
import '../../styles/admin/AccountingPage.css';
import {
    createSupplierSuperSupplierPurchase,
    downloadSupplierPayablePdf,
    getSupplierPayable,
    getSupplierInventoryStockBalances,
    getSupplierSuperSupplierPurchase,
    listSupplierPayables,
    listSupplierSuperSuppliers,
    createSupplierSuperSupplier,
    listSupplierSuperSupplierAudit,
    listSupplierSuperSupplierPurchases,
    updateSupplierSuperSupplierPurchase,
} from '../../services/supplierApi';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';

const ACCOUNT_OPTIONS = [
    { code: '5100', name: 'Cost of Goods Sold' },
    { code: '6100', name: 'Rent Expense' },
    { code: '6200', name: 'Utilities Expense' },
    { code: '6300', name: 'Salaries & Wages' },
    { code: '1410', name: 'Inventory Asset' },
    { code: '4100', name: 'Sales Revenue' },
];

const TAXES = [
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
    { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0 },
    { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0 },
];

function roundMoney2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

/** Same VAT / discount semantics as Supplier Sales Invoice (Warehouse → Workshop). */
function computeLineFinancials(line, amountsTaxInclusive) {
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    const unitInput = parseFloat(String(line.price).replace(',', '.')) || 0;
    const discRaw = parseFloat(String(line.discount ?? 0).replace(',', '.')) || 0;
    const discMode = line.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';
    const rate =
        TAXES.find((t) => t.code === line.taxCode)?.rate ?? TAXES[0]?.rate ?? 0;

    let lineEx = 0;
    let taxAmt = 0;
    let grandIncl = 0;

    if (amountsTaxInclusive) {
        const grossInclBeforeDisc = roundMoney2(qty * unitInput);
        let netIncl = grossInclBeforeDisc;
        if (discMode === 'percent') {
            const pct = Math.min(100, Math.max(0, discRaw));
            netIncl = roundMoney2(grossInclBeforeDisc * (1 - pct / 100));
        } else {
            netIncl = roundMoney2(Math.max(0, grossInclBeforeDisc - discRaw));
        }
        lineEx =
            netIncl > 0 && rate > 0
                ? roundMoney2(netIncl / (1 + rate))
                : roundMoney2(netIncl);
        grandIncl = netIncl;
        taxAmt = roundMoney2(Math.max(0, grandIncl - lineEx));
    } else {
        const grossExBeforeDisc = roundMoney2(qty * unitInput);
        let lineExAdj = grossExBeforeDisc;
        if (discMode === 'percent') {
            const pct = Math.min(100, Math.max(0, discRaw));
            lineExAdj = roundMoney2(grossExBeforeDisc * (1 - pct / 100));
        } else {
            lineExAdj = roundMoney2(Math.max(0, grossExBeforeDisc - discRaw));
        }
        lineEx = lineExAdj;
        taxAmt = roundMoney2(lineEx * rate);
        grandIncl = roundMoney2(lineEx + taxAmt);
    }

    return {
        lineEx,
        taxAmt,
        grandIncl,
        taxAmtStr: taxAmt.toFixed(2),
        grandInclStr: grandIncl.toFixed(2),
        lineExStr: lineEx.toFixed(2),
    };
}

function applyLineTotals(line, amountsTaxInclusive) {
    const f = computeLineFinancials(line, amountsTaxInclusive);
    return {
        ...line,
        taxAmt: f.taxAmtStr,
        totalFinal: f.grandInclStr,
    };
}

/**
 * API stores exclusive unit price *after* line discount. Rebuild the per-unit list price the form uses
 * (before discount) so totals match after edit when discount/description are restored.
 */
function reconstructSSPUnitPriceInput(it, amountsTaxInclusive, taxCode) {
    const rate =
        TAXES.find((t) => t.code === taxCode)?.rate ?? TAXES[0]?.rate ?? 0;
    const qty = Math.max(
        0.000001,
        parseFloat(String(it.qty ?? 1).replace(',', '.')) || 1,
    );
    const U_net = Number(it.unitPrice ?? 0);
    const discRaw = Number(it.lineDiscountValue ?? 0);
    const discMode =
        it.lineDiscountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';

    if (!(discRaw > 0)) {
        if (!amountsTaxInclusive) {
            return String(roundMoney2(U_net));
        }
        return String(roundMoney2(U_net * (1 + rate)));
    }

    if (!amountsTaxInclusive) {
        if (discMode === 'percent') {
            const pct = Math.min(100, Math.max(0, discRaw));
            const denom = 1 - pct / 100;
            if (denom <= 0 || denom >= 1) {
                return String(roundMoney2(U_net));
            }
            const U_list_ex = roundMoney2(U_net / denom);
            return String(U_list_ex);
        }
        const fixed = discRaw;
        const grossLineEx = roundMoney2(U_net * qty + fixed);
        return String(roundMoney2(grossLineEx / qty));
    }

    const netIncl = roundMoney2(U_net * qty * (1 + rate));
    if (discMode === 'percent') {
        const pct = Math.min(100, Math.max(0, discRaw));
        const denom = 1 - pct / 100;
        const grossInclBeforeDisc =
            denom <= 0 ? netIncl : roundMoney2(netIncl / denom);
        return String(roundMoney2(grossInclBeforeDisc / qty));
    }
    const fixed = discRaw;
    const grossInclBeforeDisc = roundMoney2(netIncl + fixed);
    return String(roundMoney2(grossInclBeforeDisc / qty));
}

function extractArray(res, keys) {
    if (!res || typeof res !== 'object') return [];
    if (Array.isArray(res)) return res;
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
    }
    return [];
}

function mapPayableToRow(p) {
    const statusRaw = (p.status ?? p.state ?? 'pending').toString();
    const status =
        statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1).toLowerCase();
    return {
        id: p.id,
        ref: p.vatNumber ?? p.reference ?? p.invoiceRef ?? '-',
        date: (p.openingBalanceDate ?? p.date ?? p.invoiceDate ?? '-').toString().slice(0, 10),
        description: p.companyName ?? p.vendorName ?? p.name ?? '-',
        amount: Number(p.openingBalance ?? p.amount ?? p.total ?? p.balance ?? 0),
        status,
    };
}

function nextLineId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Strip auto-appended due line from saved SSP notes (see handleCreateInvoice). */
function splitSuperSupplierPurchaseNotes(notes) {
    const s = String(notes ?? '').trim();
    if (!s) return { userNotes: '', dueIso: null };
    const m = s.match(/Due date:\s*(\d{4}-\d{2}-\d{2})/);
    const dueIso = m ? m[1] : null;
    const userNotes = s.replace(/\n*Due date:\s*\d{4}-\d{2}-\d{2}\s*/g, '').trim();
    return { userNotes, dueIso };
}

/** Rows from `/supplier/inventory/stock-balances` only — purchase picker must not mix full catalog / services. */
function mapStockBalanceToPurchasePickerRow(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const pid =
        raw.productId != null && raw.productId !== ''
            ? String(raw.productId)
            : raw.supplierProductId != null && raw.supplierProductId !== ''
              ? String(raw.supplierProductId)
              : '';
    if (!pid) return null;
    const qtyWh = Number(raw.currentBalanceWarehouse || 0);
    const unitCost = qtyWh > 0 ? Number(raw.valueWarehouseSar || 0) / qtyWh : 0;
    const price = Number.isFinite(unitCost) ? Math.max(0, unitCost) : 0;
    return {
        id: pid,
        sku: String(raw.sku ?? raw.barcode ?? '').trim(),
        name: raw.productName || 'Product',
        price,
        unit: raw.workshopUnit || raw.unitCode || raw.unit || 'pcs',
        type: 'Stock',
        stockHint:
            qtyWh > 0
                ? `Warehouse stock: ${qtyWh}`
                : 'No warehouse qty — edit unit price if needed',
    };
}

const SEARCH_QUICK_PICK_PI = 12;
const SEARCH_MAX_RESULTS_PI = 40;
/** Max purchases to load line detail for in super-supplier history modal (avoids huge parallel GET bursts). */
const SSP_HISTORY_DETAIL_CAP = 50;

/** Hydrated when navigating from Stock Inventory → Adjust via Purchase */
const PI_PRESET_FROM_STOCK_FLAG = 'supplier_pi_open_from_stock';
const PI_PRESET_STOCK_LINE = 'supplier_pi_preset_stock_line';

/** @typedef {'payables'|'super_suppliers'|'ssp_invoices'} ApTabId */

function statusBadgeClass(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('paid') || s.includes('approved') || s.includes('closed')) return 'status-completed';
    if (s.includes('overdue') || s.includes('cancel')) return 'status-badge'; // use red style if exists
    return 'status-completed';
}

export default function SupplierPurchaseInvoices() {
    const [invoices, setInvoices] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);
    const [amountsTaxInclusive, setAmountsTaxInclusive] = useState(false);
    const [freightCharges, setFreightCharges] = useState('0');
    const [invoiceDiscountValue, setInvoiceDiscountValue] = useState('0');
    const [invoiceDiscountMode, setInvoiceDiscountMode] = useState('fixed_sar');

    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [refNo, setRefNo] = useState('');
    /** Selected super-supplier ID (upstream vendor); required for purchase invoice. */
    const [superSupplierId, setSuperSupplierId] = useState('');
    const [description, setDescription] = useState('');
    const [internalNotes, setInternalNotes] = useState('');

    const [lineItems, setLineItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const piSearchWrapRef = useRef(null);
    const lineItemPickerWrapRef = useRef(null);
    const itemPickerInputRef = useRef('');
    const [itemPickerLineId, setItemPickerLineId] = useState(null);
    const [itemPickerInput, setItemPickerInput] = useState('');
    const [itemPickerFilter, setItemPickerFilter] = useState('');

    const [sspPanelKey, setSspPanelKey] = useState(0);
    /** @type {[ApTabId, React.Dispatch<React.SetStateAction<ApTabId>>]} */
    const [apTab, setApTab] = useState(
        /** @type {ApTabId} */ ('payables'),
    );

    const [catalogItems, setCatalogItems] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    const [viewOpen, setViewOpen] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewError, setViewError] = useState('');
    const [viewDetail, setViewDetail] = useState(null);

    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState('');
    /** Same modal as New Purchase Invoice — edit loads SSP purchase into identical fields */
    const [sspPurchaseModalMode, setSspPurchaseModalMode] = useState(
        /** @type {'create' | 'edit'} */ ('create'),
    );
    const [editingSspPurchaseId, setEditingSspPurchaseId] = useState(null);
    const [sspPurchaseEditLoading, setSspPurchaseEditLoading] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);

    const [superSuppliers, setSuperSuppliers] = useState([]);
    const [ssLoading, setSsLoading] = useState(true);
    const [addSsOpen, setAddSsOpen] = useState(false);
    const [ssForm, setSsForm] = useState({
        name: '',
        mobile: '',
        email: '',
        vatNumber: '',
        address: '',
        notes: '',
    });
    const [ssSaving, setSsSaving] = useState(false);
    const [ssErr, setSsErr] = useState('');
    const [createSspPurchaseForId, setCreateSspPurchaseForId] = useState(null);
    const [auditOpen, setAuditOpen] = useState(false);
    const [auditSsFilter, setAuditSsFilter] = useState('');
    const [auditItems, setAuditItems] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);

    const [ssHistoryOpen, setSsHistoryOpen] = useState(false);
    const [ssHistoryLoading, setSsHistoryLoading] = useState(false);
    const [ssHistoryError, setSsHistoryError] = useState('');
    const [ssHistoryInfo, setSsHistoryInfo] = useState('');
    const [ssHistorySupplierName, setSsHistorySupplierName] = useState('');
    const [ssHistoryLines, setSsHistoryLines] = useState([]);

    const loadPayables = useCallback(async () => {
        setListLoading(true);
        setListError('');
        try {
            const res = await listSupplierPayables({ limit: 200 });
            const raw = extractArray(res, ['payables', 'list', 'items', 'data']);
            const list = raw.map(mapPayableToRow).filter((row) => row.id != null);
            setInvoices(list);
        } catch (err) {
            console.error('Supplier purchase invoices API failed:', err);
            setInvoices([]);
            setListError(err?.message || 'Failed to load payables');
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPayables();
    }, [loadPayables]);

    const loadSuperSuppliers = useCallback(async () => {
        setSsLoading(true);
        try {
            const res = await listSupplierSuperSuppliers();
            const list = res?.superSuppliers ?? [];
            setSuperSuppliers(Array.isArray(list) ? list : []);
        } catch {
            setSuperSuppliers([]);
        } finally {
            setSsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSuperSuppliers();
    }, [loadSuperSuppliers]);

    const openAuditModal = async (superSupplierId = '') => {
        setAuditOpen(true);
        setAuditSsFilter(superSupplierId);
        setAuditLoading(true);
        try {
            const res = await listSupplierSuperSupplierAudit({
                ...(superSupplierId ? { superSupplierId } : {}),
                limit: 200,
            });
            setAuditItems(res?.items ?? []);
        } catch {
            setAuditItems([]);
        } finally {
            setAuditLoading(false);
        }
    };

    const openSuperSupplierPurchaseHistory = async (superSupplierId, supplierName = '') => {
        setSsHistoryOpen(true);
        setSsHistorySupplierName(supplierName || 'Super supplier');
        setSsHistoryLoading(true);
        setSsHistoryError('');
        setSsHistoryInfo('');
        setSsHistoryLines([]);
        try {
            const res = await listSupplierSuperSupplierPurchases({
                superSupplierId: String(superSupplierId),
                limit: 200,
                offset: 0,
            });
            const purchases = Array.isArray(res?.purchases) ? res.purchases : [];
            const capped = purchases.slice(0, SSP_HISTORY_DETAIL_CAP);
            const details = await Promise.all(
                capped.map(async (row) => {
                    try {
                        const d = await getSupplierSuperSupplierPurchase(row.id);
                        return { listRow: row, purchase: d?.purchase ?? d?.data ?? d };
                    } catch {
                        return { listRow: row, purchase: null };
                    }
                }),
            );
            const lines = [];
            for (const { listRow, purchase } of details) {
                const purchaseDate = (purchase?.purchaseDate ?? listRow?.purchaseDate ?? '')
                    .toString()
                    .slice(0, 10);
                const invoiceNo = purchase?.invoiceNo ?? listRow?.invoiceNo ?? `SSP-${listRow?.id}`;
                const items = Array.isArray(purchase?.items) ? purchase.items : [];
                if (items.length > 0) {
                    items.forEach((it, idx) => {
                        lines.push({
                            key: `${listRow.id}-${it.id ?? idx}`,
                            purchaseDate,
                            invoiceNo,
                            productName: it.productName || '—',
                            sku: it.sku || '—',
                            qty: Number(it.qty ?? 0),
                            unit: it.unit || 'pcs',
                            unitPrice: Number(it.unitPrice ?? 0),
                            lineTotal: Number(it.lineTotal ?? 0),
                        });
                    });
                } else {
                    const total = Number(purchase?.total ?? listRow?.total ?? 0);
                    lines.push({
                        key: `${listRow.id}-summary`,
                        purchaseDate,
                        invoiceNo,
                        productName:
                            (purchase?.description || listRow?.primaryProductName || '').trim() ||
                            'Purchase (no line detail)',
                        sku: '—',
                        qty: null,
                        unit: '—',
                        unitPrice: null,
                        lineTotal: total,
                    });
                }
            }
            setSsHistoryLines(lines);
            if (purchases.length > SSP_HISTORY_DETAIL_CAP) {
                setSsHistoryInfo(
                    `Line detail is shown for the ${SSP_HISTORY_DETAIL_CAP} most recent purchases (${purchases.length} total).`,
                );
            }
        } catch (e) {
            setSsHistoryError(e?.message || 'Could not load purchase history.');
            setSsHistoryLines([]);
        } finally {
            setSsHistoryLoading(false);
        }
    };

    const handleSaveSuperSupplier = async () => {
        if (!ssForm.name?.trim()) {
            setSsErr('Name is required');
            return;
        }
        setSsSaving(true);
        setSsErr('');
        try {
            await createSupplierSuperSupplier({
                name: ssForm.name.trim(),
                mobile: ssForm.mobile?.trim() || undefined,
                email: ssForm.email?.trim() || undefined,
                vatNumber: ssForm.vatNumber?.trim() || undefined,
                address: ssForm.address?.trim() || undefined,
                notes: ssForm.notes?.trim() || undefined,
            });
            setAddSsOpen(false);
            setSsForm({
                name: '',
                mobile: '',
                email: '',
                vatNumber: '',
                address: '',
                notes: '',
            });
            await loadSuperSuppliers();
        } catch (e) {
            setSsErr(e?.message || 'Could not save super supplier');
        } finally {
            setSsSaving(false);
        }
    };

    useEffect(() => {
        if (!modalOpen) return undefined;
        let cancelled = false;
        setCatalogLoading(true);
        getSupplierInventoryStockBalances({ limit: 500, offset: 0 })
            .then((res) => {
                const raw = Array.isArray(res?.items) ? res.items : [];
                const mapped = raw
                    .map((row) => mapStockBalanceToPurchasePickerRow(row))
                    .filter(Boolean);
                if (!cancelled) setCatalogItems(mapped);
            })
            .catch(() => {
                if (!cancelled) setCatalogItems([]);
            })
            .finally(() => {
                if (!cancelled) setCatalogLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [modalOpen]);

    const catalogForSearch = catalogItems.length ? catalogItems : [];

    const getSearchSuggestionsPi = (query) => {
        const items = [...catalogForSearch].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }),
        );
        const q = query.trim().toLowerCase();
        if (!q) return items.slice(0, SEARCH_QUICK_PICK_PI);
        return items
            .filter(
                (i) =>
                    String(i.name || '')
                        .toLowerCase()
                        .includes(q) ||
                    String(i.sku || '')
                        .toLowerCase()
                        .includes(q),
            )
            .slice(0, SEARCH_MAX_RESULTS_PI);
    };

    const applySearchQueryPi = (value) => {
        setSearchQuery(value);
        const results = getSearchSuggestionsPi(value);
        setSearchResults(results);
        setShowDropdown(true);
        setSelectedIndex(results.length ? 0 : -1);
    };

    const openPiLineSearch = () => {
        const results = getSearchSuggestionsPi(searchQuery);
        setSearchResults(results);
        setShowDropdown(true);
        setSelectedIndex(results.length ? 0 : -1);
    };

    useEffect(() => {
        if (!modalOpen || !showDropdown) return undefined;
        const close = (e) => {
            const el = piSearchWrapRef.current;
            if (el && !el.contains(e.target)) setShowDropdown(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [modalOpen, showDropdown]);

    useEffect(() => {
        itemPickerInputRef.current = itemPickerInput;
    }, [itemPickerInput]);

    useEffect(() => {
        if (!modalOpen || itemPickerLineId == null) return undefined;
        const openLineId = itemPickerLineId;
        const onDocMouseDown = (e) => {
            const el = lineItemPickerWrapRef.current;
            if (el && !el.contains(e.target)) {
                const text = String(itemPickerInputRef.current ?? '').trim();
                setLineItems((prev) =>
                    prev.map((l) =>
                        l.id === openLineId ? { ...l, item: text } : l,
                    ),
                );
                setItemPickerLineId(null);
                setItemPickerInput('');
                setItemPickerFilter('');
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [modalOpen, itemPickerLineId]);

    /** Apply stock row to an existing line — same source as “Search stock inventory”. */
    const applyCatalogPurchaseItemToLine = (lineId, catItem) => {
        const unitPrice = Number(catItem.price) || 0;
        const catalogId =
            catItem?.id != null && String(catItem.id).trim() !== ''
                ? String(catItem.id).trim()
                : undefined;
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;
                const raw = {
                    ...line,
                    sku: catItem.sku || '',
                    item: catItem.name,
                    supplierProductId: catalogId,
                    account:
                        catItem.type === 'Stock'
                            ? '1410 - Inventory Asset'
                            : '5100 - Cost of Goods Sold',
                    uom: catItem.unit || line.uom || 'pcs',
                    price: unitPrice,
                };
                return applyLineTotals(raw, amountsTaxInclusive);
            }),
        );
        setItemPickerLineId(null);
        setItemPickerInput('');
        setItemPickerFilter('');
    };

    const removePurchaseLine = (lineId) => {
        setLineItems((prev) => prev.filter((l) => l.id !== lineId));
        setItemPickerLineId((cur) => (cur === lineId ? null : cur));
    };

    const updateLineItem = (id, field, value) => {
        const recalc = new Set(['qty', 'price', 'taxCode', 'discount', 'discountMode']);
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                const updated = { ...line, [field]: value };
                return recalc.has(field)
                    ? applyLineTotals(updated, amountsTaxInclusive)
                    : updated;
            }),
        );
    };

    useEffect(() => {
        setLineItems((prev) =>
            prev.length
                ? prev.map((line) => applyLineTotals(line, amountsTaxInclusive))
                : prev,
        );
    }, [amountsTaxInclusive]);

    const getSummary = () => {
        let subtotalEx = 0;
        let totalTax = 0;
        let linesGrandSum = 0;
        for (const line of lineItems) {
            const f = computeLineFinancials(line, amountsTaxInclusive);
            subtotalEx += f.lineEx;
            totalTax += f.taxAmt;
            linesGrandSum += f.grandIncl;
        }
        subtotalEx = roundMoney2(subtotalEx);
        totalTax = roundMoney2(totalTax);
        const freightNum =
            parseFloat(String(freightCharges).replace(',', '.')) || 0;
        const grossBeforeInvDisc = roundMoney2(linesGrandSum + freightNum);

        let invDisc = 0;
        const invRaw =
            parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0;
        if (invoiceDiscountMode === 'percent') {
            invDisc = roundMoney2(
                (grossBeforeInvDisc * Math.min(100, Math.max(0, invRaw))) /
                    100,
            );
        } else {
            invDisc = roundMoney2(Math.min(invRaw, grossBeforeInvDisc));
        }
        const grandTotal = roundMoney2(Math.max(0, grossBeforeInvDisc - invDisc));

        const freightIn = roundMoney2(Math.max(0, freightNum));
        const invoiceDiscountSar = roundMoney2(Math.max(0, invDisc));
        const invPctDisplayed = Math.min(100, Math.max(0, invRaw));

        return {
            subtotal: subtotalEx.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            totalTax: totalTax.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            grandTotal: grandTotal.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            rawGrandTotal: grandTotal,
            freightIn,
            freightInFormatted: freightIn.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            showFreightRow: freightIn > 0,
            invoiceDiscount: invoiceDiscountSar,
            invoiceDiscountFormatted: invoiceDiscountSar.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }),
            showInvoiceDiscountRow: invoiceDiscountSar > 0,
            invoiceDiscountSummaryLabel:
                invoiceDiscountMode === 'percent'
                    ? `Invoice discount (${invPctDisplayed}%):`
                    : 'Invoice discount (fixed SAR):',
        };
    };
    const summary = getSummary();

    const addEmptyPurchaseLine = () => {
        const raw = {
            id: nextLineId(),
            item: '',
            sku: '',
            supplierProductId: undefined,
            account: '1410 - Inventory Asset',
            description: '',
            uom: 'pcs',
            qty: 1,
            price: 0,
            discount: 0,
            discountMode: 'percent',
            taxCode: 'VAT 15%',
            taxAmt: '0.00',
            totalFinal: '0.00',
        };
        const newLine = applyLineTotals(raw, amountsTaxInclusive);
        setLineItems((prev) => [...prev, newLine]);
    };

    const addItemToLines = (item) => {
        const unitPrice = Number(item.price) || 0;
        const catalogId =
            item?.id != null && String(item.id).trim() !== '' ? String(item.id).trim() : undefined;
        const raw = {
            id: nextLineId(),
            sku: item.sku || '',
            item: item.name,
            supplierProductId: catalogId,
            account: item.type === 'Stock' ? '1410 - Inventory Asset' : '5100 - Cost of Goods Sold',
            description: '',
            uom: item.unit,
            qty: 1,
            price: unitPrice,
            discount: 0,
            discountMode: 'percent',
            taxCode: 'VAT 15%',
            taxAmt: '0.00',
            totalFinal: '0.00',
        };
        const newLine = applyLineTotals(raw, amountsTaxInclusive);
        setLineItems((prev) => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;
        if (e.key === 'ArrowDown') setSelectedIndex((i) => (i < searchResults.length - 1 ? i + 1 : i));
        else if (e.key === 'ArrowUp') setSelectedIndex((i) => (i > 0 ? i - 1 : i));
        else if (e.key === 'Enter' && selectedIndex >= 0 && searchResults[selectedIndex]) {
            addItemToLines(searchResults[selectedIndex]);
        } else if (e.key === 'Escape') setShowDropdown(false);
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str || !/^[\d\s+*/().\-*]+$/.test(str)) return str;
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            const result = Function(`return (${str})`)();
            if (typeof result === 'number' && isFinite(result)) return parseFloat(result.toFixed(6)).toString();
        } catch {
            /* ignore */
        }
        return str;
    };
    const handleMathKeyDown = (e, lineId, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const evaluated = evalMath(e.target.value);
            updateLineItem(lineId, field, evaluated);
            e.target.value = evaluated;
        }
    };
    const handleMathBlur = (e, lineId, field) => {
        const evaluated = evalMath(e.target.value);
        if (evaluated !== e.target.value) updateLineItem(lineId, field, evaluated);
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';
        let due = new Date(issue);
        if (dueDateType === 'Net') due.setDate(issue.getDate() + parseInt(netDays || 0, 10));
        else if (dueDateType === 'Custom') return customDueDate || '—';
        else if (dueDateType === 'EOM') due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        return due.toISOString().slice(0, 10);
    };
    const calculatedDueDate = calculateDueDate();

    const getGridColumns = () => {
        const cols = [];
        if (showLineNum) cols.push('40px');
        cols.push('2fr', '1.5fr');
        if (showDesc) cols.push('2fr');
        cols.push('0.8fr', '0.8fr', '1fr');
        if (showDiscount) cols.push('minmax(140px, 1.35fr)');
        cols.push('1fr', '1fr', '1fr', '1fr');
        cols.push('48px');
        return cols.join(' ');
    };

    const resetCreateForm = () => {
        setLineItems([]);
        setRefNo('');
        setSuperSupplierId('');
        setDescription('');
        setInternalNotes('');
        setIssueDate(new Date().toISOString().slice(0, 10));
        setDueDateType('Net');
        setNetDays(30);
        setCustomDueDate('');
        setSearchQuery('');
        setCreateError('');
        setShowLineNum(false);
        setShowDesc(false);
        setShowDiscount(false);
        setAmountsTaxInclusive(false);
        setFreightCharges('0');
        setInvoiceDiscountValue('0');
        setInvoiceDiscountMode('fixed_sar');
        setItemPickerLineId(null);
        setItemPickerInput('');
        setItemPickerFilter('');
        setSspPurchaseModalMode('create');
        setEditingSspPurchaseId(null);
        setSspPurchaseEditLoading(false);
    };

    const openSuperSupplierPurchaseForEdit = async (purchaseId) => {
        setCreateError('');
        setSspPurchaseModalMode('edit');
        setEditingSspPurchaseId(String(purchaseId));
        setSspPurchaseEditLoading(true);
        setModalOpen(true);
        setApTab('ssp_invoices');
        try {
            const res = await getSupplierSuperSupplierPurchase(purchaseId);
            const p = res?.purchase ?? res?.data ?? res;
            if (!p?.id) {
                setCreateError('Could not load purchase for editing.');
                return;
            }
            setIssueDate((p.purchaseDate || '').toString().slice(0, 10));
            setSuperSupplierId(String(p.superSupplierId ?? ''));
            setRefNo(String(p.vendorRef ?? p.referenceNo ?? '').trim());
            setDescription(String(p.description ?? '').trim());
            const { userNotes, dueIso } = splitSuperSupplierPurchaseNotes(p.notes);
            setInternalNotes(userNotes);
            const issue = new Date((p.purchaseDate || '').toString().slice(0, 10));
            if (!Number.isNaN(issue.getTime()) && dueIso) {
                const due = new Date(dueIso);
                if (!Number.isNaN(due.getTime())) {
                    const diffDays = Math.round((due - issue) / (1000 * 60 * 60 * 24));
                    if (!Number.isNaN(diffDays) && diffDays >= 0) {
                        setDueDateType('Net');
                        setNetDays(diffDays || 30);
                    } else {
                        setDueDateType('Custom');
                        setCustomDueDate(dueIso);
                    }
                } else {
                    setDueDateType('Net');
                    setNetDays(30);
                }
            } else {
                setDueDateType('Net');
                setNetDays(30);
            }

            const m =
                p.purchaseFormMeta != null && typeof p.purchaseFormMeta === 'object'
                    ? p.purchaseFormMeta
                    : {};
            const taxIncl = !!m.amountsTaxInclusive;
            setShowLineNum(!!m.showLineNum);
            setShowDesc(!!m.showDesc);
            setShowDiscount(!!m.showDiscount);
            setAmountsTaxInclusive(taxIncl);
            if (m.invoiceDiscountMode === 'percent') {
                setInvoiceDiscountMode('percent');
                if (m.invoiceDiscountInput != null && Number.isFinite(Number(m.invoiceDiscountInput))) {
                    setInvoiceDiscountValue(String(m.invoiceDiscountInput));
                } else {
                    setInvoiceDiscountValue('0');
                }
            } else {
                setInvoiceDiscountMode('fixed_sar');
                if (m.invoiceDiscountInput != null && Number.isFinite(Number(m.invoiceDiscountInput))) {
                    setInvoiceDiscountValue(String(m.invoiceDiscountInput));
                } else {
                    setInvoiceDiscountValue(String(Number(p.invoiceDiscount ?? 0)));
                }
            }
            setFreightCharges(String(Number(p.freightIn ?? 0)));

            const linesFromApi = Array.isArray(p.items) && p.items.length ? p.items : [];
            setLineItems(
                linesFromApi.map((it) => {
                    const taxCode = 'VAT 15%';
                    const discVal = Number(it.lineDiscountValue ?? 0);
                    const discMode =
                        it.lineDiscountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';
                    const priceStr = reconstructSSPUnitPriceInput(it, taxIncl, taxCode);
                    return applyLineTotals(
                        {
                            id: nextLineId(),
                            sku: String(it.sku ?? '').trim(),
                            item: it.productName || '',
                            supplierProductId:
                                it.supplierProductId != null &&
                                String(it.supplierProductId).trim() !== ''
                                    ? String(it.supplierProductId).trim()
                                    : undefined,
                            account: '1410 - Inventory Asset',
                            description: String(it.lineDescription ?? '').trim(),
                            uom: it.unit || 'pcs',
                            qty: String(it.qty ?? 1),
                            price: priceStr,
                            discount: discVal,
                            discountMode: discMode,
                            taxCode,
                            taxAmt: '0.00',
                            totalFinal: '0.00',
                            lastSalePrice: Number(it.unitPrice ?? 0),
                        },
                        taxIncl,
                    );
                }),
            );
        } catch (e) {
            setCreateError(e?.message || 'Could not load purchase for editing.');
        } finally {
            setSspPurchaseEditLoading(false);
        }
    };

    useEffect(() => {
        try {
            if (sessionStorage.getItem(PI_PRESET_FROM_STOCK_FLAG) !== '1') {
                return undefined;
            }
            const raw = sessionStorage.getItem(PI_PRESET_STOCK_LINE);
            sessionStorage.removeItem(PI_PRESET_FROM_STOCK_FLAG);
            sessionStorage.removeItem(PI_PRESET_STOCK_LINE);

            resetCreateForm();
            setModalOpen(true);
            setApTab('payables');

            if (!raw) {
                return undefined;
            }
            const line = JSON.parse(raw);
            if (
                line == null ||
                typeof line !== 'object' ||
                String(line.supplierProductId ?? '').trim() === '' ||
                String(line.name ?? '').trim() === ''
            ) {
                return undefined;
            }

            window.setTimeout(() => {
                addItemToLines({
                    id: String(line.supplierProductId).trim(),
                    sku: String(line.sku || '').trim(),
                    name: String(line.name || '').trim(),
                    price: Number(line.price) || 0,
                    unit: String(line.unit || 'pcs').trim() || 'pcs',
                    type: 'Stock',
                });
            }, 0);
        } catch {
            sessionStorage.removeItem(PI_PRESET_FROM_STOCK_FLAG);
            sessionStorage.removeItem(PI_PRESET_STOCK_LINE);
        }
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when landing from Stock Inventory
    }, []);

    const handleCreateInvoice = async () => {
        setCreateError('');
        if (!superSupplierId) {
            setCreateError('Select a super supplier from the list.');
            return;
        }
        if (lineItems.length === 0) {
            setCreateError('Add at least one line item.');
            return;
        }
        const supplierRow = superSuppliers.find((s) => String(s.id) === String(superSupplierId));
        if (!supplierRow) {
            setCreateError('Invalid super supplier selection. Refresh the page.');
            return;
        }
        if (supplierRow.isActive === false) {
            setCreateError('Selected super supplier is inactive.');
            return;
        }

        const normalizedLines = lineItems.map((line, idx) => {
            const fin = computeLineFinancials(line, amountsTaxInclusive);
            const qtyNum = parseFloat(String(line.qty).replace(',', '.')) || 0;
            const unitPriceExForApi =
                qtyNum > 0 ? roundMoney2(fin.lineEx / qtyNum) : 0;
            return {
                idx,
                productName: String(line.item || '').trim(),
                sku: String(line.sku || '').trim() || undefined,
                supplierProductId:
                    line.supplierProductId != null &&
                    String(line.supplierProductId).trim() !== ''
                        ? String(line.supplierProductId).trim()
                        : undefined,
                qty: qtyNum,
                unit: String(line.uom || 'pcs').trim() || 'pcs',
                unitPrice: unitPriceExForApi,
                vatLine: fin.taxAmt,
            };
        });

        const bad = normalizedLines.find(
            (l) => !l.productName || !(l.qty > 0) || l.unitPrice < 0,
        );
        if (bad) {
            setCreateError(`Line ${bad.idx + 1}: product name required, qty > 0, and unit price cannot be negative.`);
            return;
        }

        const vatAmount = roundMoney2(
            normalizedLines.reduce((s, l) => s + l.vatLine, 0),
        );
        const subtotalExVat = roundMoney2(
            normalizedLines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
        );
        if (!(subtotalExVat + vatAmount > 0)) {
            setCreateError('Invoice total must be greater than zero (check quantities and unit prices).');
            return;
        }

        const totals = getSummary();

        const items = normalizedLines.map((l, idx) => {
            const row = lineItems[idx];
            const discRaw =
                parseFloat(String(row?.discount ?? 0).replace(',', '.')) || 0;
            const desc = String(row?.description ?? '').trim();
            const body = {
                ...(l.sku ? { sku: l.sku } : {}),
                ...(l.supplierProductId ? { supplierProductId: l.supplierProductId } : {}),
                productName: l.productName,
                qty: l.qty,
                unit: l.unit,
                unitPrice: Math.round(l.unitPrice * 1e6) / 1e6,
                lineDiscount: discRaw,
                lineDiscountMode:
                    row?.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent',
            };
            if (desc) {
                body.lineDescription = desc;
            }
            return body;
        });

        const due =
            calculatedDueDate === '—' ? '' : calculatedDueDate;
        const notesParts = [internalNotes.trim(), due ? `Due date: ${due}` : ''].filter(Boolean);

        const purchaseFormMeta = {
            showLineNum,
            showDesc,
            showDiscount,
            amountsTaxInclusive,
            invoiceDiscountMode,
            invoiceDiscountInput:
                parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0,
        };

        const payload = {
            superSupplierId: String(superSupplierId),
            purchaseDate: issueDate,
            vendorRef: refNo.trim() || undefined,
            referenceNo: refNo.trim() || undefined,
            description: description.trim() || undefined,
            notes: notesParts.length ? notesParts.join('\n') : undefined,
            vatAmount: Math.round(vatAmount * 100) / 100,
            items,
            freightIn: totals.freightIn,
            invoiceDiscount: totals.invoiceDiscount,
            purchaseFormMeta,
        };

        setCreateSubmitting(true);
        try {
            if (sspPurchaseModalMode === 'edit' && editingSspPurchaseId) {
                await updateSupplierSuperSupplierPurchase(editingSspPurchaseId, payload);
            } else {
                await createSupplierSuperSupplierPurchase(payload);
            }
            setModalOpen(false);
            resetCreateForm();
            setSspPanelKey((k) => k + 1);
            setApTab('ssp_invoices');
            await Promise.all([loadPayables(), loadSuperSuppliers()]);
        } catch (err) {
            console.error('Save super supplier purchase failed:', err);
            setCreateError(err?.message || 'Could not save purchase invoice');
        } finally {
            setCreateSubmitting(false);
        }
    };

    const openView = async (id) => {
        setViewOpen(true);
        setViewDetail(null);
        setViewError('');
        setViewLoading(true);
        try {
            const res = await getSupplierPayable(id);
            const detail = res?.payable ?? res?.data ?? res;
            setViewDetail(detail);
        } catch (err) {
            setViewError(err?.message || 'Could not load payable');
        } finally {
            setViewLoading(false);
        }
    };

    const triggerBlobDownload = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownload = async (id) => {
        setDownloadingId(id);
        try {
            const { blob, filename } = await downloadSupplierPayablePdf(id);
            triggerBlobDownload(blob, filename);
        } catch (pdfErr) {
            try {
                const res = await getSupplierPayable(id);
                const detail = res?.payable ?? res?.data ?? res;
                const text = typeof detail === 'object' ? JSON.stringify(detail, null, 2) : String(detail);
                const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
                triggerBlobDownload(blob, `payable-${id}.json`);
            } catch (err) {
                window.alert(err?.message || pdfErr?.message || 'Download failed');
            }
        } finally {
            setDownloadingId(null);
        }
    };

    const renderViewFields = (p) => {
        if (!p || typeof p !== 'object') return <p style={{ color: 'var(--color-text-muted)' }}>No detail returned.</p>;
        const rows = [
            ['ID', p.id],
            ['Vendor', p.companyName ?? p.vendorName],
            ['VAT / Ref', p.vatNumber ?? p.reference],
            ['Date', p.openingBalanceDate ?? p.date],
            ['Amount (SAR)', p.openingBalance ?? p.amount ?? p.total],
            ['Status', p.status ?? p.state],
            ['Contact', p.contactPerson],
            ['Phone', p.contactNumber],
            ['Notes', p.notes],
        ].filter(([, v]) => v !== undefined && v !== null && v !== '');
        return (
            <table className="ws-table" style={{ marginTop: 8 }}>
                <tbody>
                    {rows.map(([k, v]) => (
                        <tr key={k}>
                            <td style={{ fontWeight: 600, width: '35%', verticalAlign: 'top' }}>{k}</td>
                            <td>{String(v)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <div className="purchases-view">
            {listError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 12,
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    <strong>Could not load purchase invoices:</strong> {listError}
                </div>
            ) : null}

            <header className="purchases-header-row">
                <div className="pi-header-left">
                    <h2 className="cash-bank-title">Purchases</h2>
                    <p className="cash-bank-desc">Track payables, super suppliers, and upstream purchase invoices.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="btn-save-all"
                        onClick={() => {
                            setSsErr('');
                            setApTab('super_suppliers');
                            setAddSsOpen(true);
                        }}
                    >
                        <Building2 size={18} /> Add Super Supplier
                    </button>
                    <button
                        type="button"
                        className="btn-save-all"
                        onClick={() => {
                            setCreateError('');
                            resetCreateForm();
                            setModalOpen(true);
                        }}
                    >
                        <Plus size={18} /> New Purchase Invoice
                    </button>
                </div>
            </header>

            <div
                role="tablist"
                aria-label="Purchase sections"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    marginBottom: 16,
                    padding: 4,
                    background: '#F8FAFC',
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                }}
            >
                {[
                    { id: 'payables', label: 'Payables' },
                    { id: 'super_suppliers', label: 'Super suppliers' },
                    { id: 'ssp_invoices', label: 'Super supplier invoices' },
                ].map((t) => {
                    const active = apTab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            id={`ap-tab-${t.id}`}
                            aria-controls={`ap-panel-${t.id}`}
                            onClick={() => setApTab(/** @type {ApTabId} */ (t.id))}
                            style={{
                                padding: '10px 18px',
                                borderRadius: 10,
                                border: active ? '1px solid #CA8A04' : '1px solid transparent',
                                background: active ? '#FFF9E7' : 'transparent',
                                color: active ? '#854D0E' : '#475569',
                                fontWeight: active ? 800 : 600,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                transition: 'background 0.15s, color 0.15s',
                            }}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>

            <section
                id="ap-panel-payables"
                role="tabpanel"
                aria-labelledby="ap-tab-payables"
                hidden={apTab !== 'payables'}
                className="premium-table cash-bank-table"
                style={{ display: apTab === 'payables' ? undefined : 'none' }}
            >
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Date</th>
                            <th className="table-th">Reference</th>
                            <th className="table-th">Description</th>
                            <th className="table-th">Amount (SAR)</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {listLoading ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 0, verticalAlign: 'top' }}>
                                    <div style={{ padding: 16 }}>
                                        <ShimmerTable rows={8} columns={6} />
                                    </div>
                                </td>
                            </tr>
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="table-cell table-empty">
                                    {listError ? 'No data loaded.' : 'No purchase invoices found.'}
                                </td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={String(inv.id)} className="table-row">
                                    <td className="table-cell">{inv.date}</td>
                                    <td className="table-cell">{inv.ref}</td>
                                    <td className="table-cell">{inv.description}</td>
                                    <td className="table-cell">
                                        SAR {(inv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="table-cell">
                                        <span className={`status-badge ${statusBadgeClass(inv.status)}`}>{inv.status}</span>
                                    </td>
                                    <td className="table-cell">
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            <button
                                                type="button"
                                                className="btn-pi-cancel"
                                                style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                onClick={() => openView(inv.id)}
                                            >
                                                <Eye size={14} /> View
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-pi-cancel"
                                                style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                disabled={downloadingId === inv.id}
                                                onClick={() => handleDownload(inv.id)}
                                            >
                                                <Download size={14} /> {downloadingId === inv.id ? '…' : 'Download'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            <section
                id="ap-panel-super_suppliers"
                role="tabpanel"
                aria-labelledby="ap-tab-super_suppliers"
                hidden={apTab !== 'super_suppliers'}
                className="ws-section"
                style={{
                    marginTop: 0,
                    padding: 0,
                    overflow: 'hidden',
                    display: apTab === 'super_suppliers' ? undefined : 'none',
                }}
            >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-light)' }}>
                    <h3
                        style={{
                            margin: 0,
                            fontSize: '1rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <Building2 size={18} /> Super suppliers
                    </h3>
                    <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Vendors you buy inventory from. Record purchases here; all actions are stored in the audit log.
                    </p>
                    <div style={{ marginTop: 10 }}>
                        <button type="button" className="btn-pi-cancel" onClick={() => openAuditModal('')}>
                            <History size={14} /> View full audit log
                        </button>
                    </div>
                </div>
                <div className="premium-table cash-bank-table" style={{ border: 'none' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th">Name</th>
                                <th className="table-th">VAT / Contact</th>
                                <th className="table-th">Purchases</th>
                                <th className="table-th">Status</th>
                                <th className="table-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ssLoading ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: 0, verticalAlign: 'top' }}>
                                        <div style={{ padding: 16 }}>
                                            <ShimmerTable rows={6} columns={5} />
                                        </div>
                                    </td>
                                </tr>
                            ) : superSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="table-cell table-empty">
                                        No super suppliers yet. Use &quot;Add Super Supplier&quot; above.
                                    </td>
                                </tr>
                            ) : (
                                superSuppliers.map((ss) => (
                                    <tr key={String(ss.id)} className="table-row">
                                        <td className="table-cell">
                                            <button
                                                type="button"
                                                onClick={() => openSuperSupplierPurchaseHistory(String(ss.id), ss.name)}
                                                style={{
                                                    display: 'block',
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    margin: 0,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    font: 'inherit',
                                                }}
                                                title="View purchase history for this vendor"
                                            >
                                                <strong style={{ color: '#EA580C', textDecoration: 'underline' }}>{ss.name}</strong>
                                            </button>
                                            {ss.notes ? (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                                                    {ss.notes}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="table-cell">
                                            <div>{ss.vatNumber || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                {[ss.mobile, ss.email].filter(Boolean).join(' · ') || '—'}
                                            </div>
                                        </td>
                                        <td className="table-cell">{ss.purchaseCount ?? 0}</td>
                                        <td className="table-cell">
                                            <span className={`status-badge ${ss.isActive ? 'status-completed' : 'status-badge'}`}>
                                                {ss.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    className="btn-pi-cancel"
                                                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                    disabled={!ss.isActive}
                                                    onClick={() => {
                                                        setApTab('ssp_invoices');
                                                        setCreateSspPurchaseForId(String(ss.id));
                                                    }}
                                                >
                                                    <Plus size={14} /> Record purchase
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-pi-cancel"
                                                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                    onClick={() => openAuditModal(String(ss.id))}
                                                >
                                                    <History size={14} /> Audit
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <div
                id="ap-panel-ssp_invoices"
                role="tabpanel"
                aria-labelledby="ap-tab-ssp_invoices"
                hidden={apTab !== 'ssp_invoices'}
                style={{ display: apTab === 'ssp_invoices' ? 'block' : 'none' }}
            >
                <SupplierSuperSupplierPurchasesPanel
                    key={sspPanelKey}
                    superSuppliers={superSuppliers}
                    createIntentSupplierId={createSspPurchaseForId}
                    onConsumeCreateIntent={() => setCreateSspPurchaseForId(null)}
                    onPurchasesMutated={loadSuperSuppliers}
                    onEditPurchase={openSuperSupplierPurchaseForEdit}
                />
            </div>

            <AnimatePresence>
                {addSsOpen && (
                    <Modal
                        title={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Building2 size={20} /> Add Super Supplier
                            </span>
                        }
                        onClose={() => !ssSaving && setAddSsOpen(false)}
                        width="520px"
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button type="button" className="btn-portal-outline" disabled={ssSaving} onClick={() => setAddSsOpen(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="btn-pi-create" disabled={ssSaving} onClick={handleSaveSuperSupplier}>
                                    {ssSaving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        }
                    >
                        {ssErr ? (
                            <p style={{ margin: '0 0 12px', padding: 10, background: '#FEF2F2', borderRadius: 8, color: '#B91C1C', fontSize: '0.8125rem' }}>
                                {ssErr}
                            </p>
                        ) : null}
                        <div className="pi-field pi-full-width">
                            <label>Name *</label>
                            <input
                                type="text"
                                value={ssForm.name}
                                onChange={(e) => setSsForm((s) => ({ ...s, name: e.target.value }))}
                                placeholder="Company name"
                            />
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>VAT number</label>
                            <input
                                type="text"
                                value={ssForm.vatNumber}
                                onChange={(e) => setSsForm((s) => ({ ...s, vatNumber: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div className="pi-field">
                                <label>Mobile</label>
                                <input
                                    type="text"
                                    value={ssForm.mobile}
                                    onChange={(e) => setSsForm((s) => ({ ...s, mobile: e.target.value }))}
                                />
                            </div>
                            <div className="pi-field">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={ssForm.email}
                                    onChange={(e) => setSsForm((s) => ({ ...s, email: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>Address</label>
                            <input
                                type="text"
                                value={ssForm.address}
                                onChange={(e) => setSsForm((s) => ({ ...s, address: e.target.value }))}
                            />
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>Notes</label>
                            <textarea
                                rows={3}
                                value={ssForm.notes}
                                onChange={(e) => setSsForm((s) => ({ ...s, notes: e.target.value }))}
                            />
                        </div>
                    </Modal>
                )}

                {ssHistoryOpen && (
                    <Modal
                        title={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ShoppingCart size={20} /> Purchases from {ssHistorySupplierName}
                            </span>
                        }
                        onClose={() => {
                            setSsHistoryOpen(false);
                            setSsHistoryError('');
                            setSsHistoryInfo('');
                            setSsHistoryLines([]);
                        }}
                        width="900px"
                        footer={
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={() => {
                                    setSsHistoryOpen(false);
                                    setSsHistoryError('');
                                    setSsHistoryInfo('');
                                    setSsHistoryLines([]);
                                }}
                            >
                                Close
                            </button>
                        }
                    >
                        {ssHistoryLoading ? (
                            <ShimmerTextBlock lines={8} />
                        ) : ssHistoryError ? (
                            <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.875rem' }}>{ssHistoryError}</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {ssHistoryInfo ? (
                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                        {ssHistoryInfo}
                                    </p>
                                ) : null}
                                <div style={{ maxHeight: 460, overflow: 'auto' }}>
                                    <table className="ws-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Invoice</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Item</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>SKU</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Qty</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Unit</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Unit price</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Line total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ssHistoryLines.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} style={{ padding: 16, color: 'var(--color-text-muted)' }}>
                                                        No purchases recorded for this vendor yet.
                                                    </td>
                                                </tr>
                                            ) : (
                                                ssHistoryLines.map((ln) => (
                                                    <tr key={ln.key}>
                                                        <td style={{ padding: 8, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                            {ln.purchaseDate || '—'}
                                                        </td>
                                                        <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.invoiceNo}</td>
                                                        <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.productName}</td>
                                                        <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.sku}</td>
                                                        <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top' }}>
                                                            {ln.qty == null ? '—' : Number(ln.qty).toLocaleString()}
                                                        </td>
                                                        <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.unit}</td>
                                                        <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top' }}>
                                                            {ln.unitPrice == null
                                                                ? '—'
                                                                : `SAR ${Number(ln.unitPrice).toLocaleString(undefined, {
                                                                      minimumFractionDigits: 2,
                                                                  })}`}
                                                        </td>
                                                        <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top' }}>
                                                            <strong>
                                                                SAR{' '}
                                                                {Number(ln.lineTotal ?? 0).toLocaleString(undefined, {
                                                                    minimumFractionDigits: 2,
                                                                })}
                                                            </strong>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {ssHistoryLines.length > 0 ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            paddingTop: 8,
                                            borderTop: '1px solid #e2e8f0',
                                            fontSize: '0.9375rem',
                                            fontWeight: 700,
                                        }}
                                    >
                                        Sum of lines: SAR{' '}
                                        {ssHistoryLines
                                            .reduce((acc, ln) => acc + Number(ln.lineTotal ?? 0), 0)
                                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </Modal>
                )}

                {auditOpen && (
                    <Modal
                        title={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <History size={20} /> Super supplier audit {auditSsFilter ? '(filtered)' : ''}
                            </span>
                        }
                        onClose={() => setAuditOpen(false)}
                        width="720px"
                        footer={
                            <button type="button" className="btn-portal-outline" onClick={() => setAuditOpen(false)}>
                                Close
                            </button>
                        }
                    >
                        {auditLoading ? (
                            <ShimmerTextBlock lines={6} />
                        ) : (
                            <div style={{ maxHeight: 420, overflow: 'auto' }}>
                                <table className="ws-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: 8 }}>When</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Action</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Summary</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ padding: 16, color: 'var(--color-text-muted)' }}>
                                                    No audit entries yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            auditItems.map((a) => (
                                                <tr key={a.id}>
                                                    <td style={{ padding: 8, verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                                        {a.createdAt?.slice(0, 19)?.replace('T', ' ') ?? '—'}
                                                    </td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>{a.action}</td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>{a.summary || '—'}</td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>{a.actorName || '—'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Modal>
                )}

                {viewOpen && (
                    <Modal
                        title="Purchase invoice (payable)"
                        onClose={() => {
                            setViewOpen(false);
                            setViewDetail(null);
                            setViewError('');
                        }}
                        width="560px"
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-portal-outline" onClick={() => setViewOpen(false)}>
                                    Close
                                </button>
                            </div>
                        }
                    >
                        {viewLoading ? (
                            <ShimmerTextBlock lines={6} />
                        ) : viewError ? (
                            <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.875rem' }}>{viewError}</p>
                        ) : (
                            renderViewFields(viewDetail)
                        )}
                    </Modal>
                )}

                {modalOpen && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">
                                    Purchase Invoices ›{' '}
                                    <span className="pi-b-active">
                                        {sspPurchaseModalMode === 'edit' ? 'Edit' : 'New'}
                                    </span>
                                </span>
                                <div className="pi-title-main">
                                    <ShoppingCart className="pi-icon-orange" size={24} />
                                    <span>Purchase Invoice</span>
                                </div>
                            </div>
                        }
                        onClose={() => {
                            if (!createSubmitting && !sspPurchaseEditLoading) {
                                setModalOpen(false);
                                resetCreateForm();
                            }
                        }}
                        width="1350px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button
                                        type="button"
                                        className="btn-pi-cancel"
                                        disabled={createSubmitting || sspPurchaseEditLoading}
                                        onClick={() => {
                                            setModalOpen(false);
                                            resetCreateForm();
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        disabled={
                                            createSubmitting ||
                                            sspPurchaseEditLoading ||
                                            lineItems.length === 0 ||
                                            !superSupplierId ||
                                            (!ssLoading && superSuppliers.length === 0)
                                        }
                                        onClick={handleCreateInvoice}
                                    >
                                        {createSubmitting
                                            ? sspPurchaseModalMode === 'edit'
                                                ? 'Saving…'
                                                : 'Creating…'
                                            : sspPurchaseModalMode === 'edit'
                                              ? 'Save changes'
                                              : 'Create Purchase Invoice'}
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        {createError ? (
                            <p style={{ margin: '0 0 12px 0', padding: 10, background: '#FEF2F2', borderRadius: 8, color: '#B91C1C', fontSize: '0.8125rem' }}>
                                {createError}
                            </p>
                        ) : null}
                        {sspPurchaseEditLoading ? (
                            <div style={{ padding: '12px 0 24px' }}>
                                <ShimmerTextBlock lines={5} />
                                <div style={{ marginTop: 18 }}>
                                    <ShimmerTable rows={6} columns={8} />
                                </div>
                                <p
                                    style={{
                                        marginTop: 16,
                                        fontSize: '0.8125rem',
                                        color: '#64748B',
                                        textAlign: 'center',
                                    }}
                                >
                                    Loading purchase…
                                </p>
                            </div>
                        ) : (
                        <div className="pi-form-container">
                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date</label>
                                    <div className="pi-input-with-icon">
                                        <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Due date</label>
                                    <div className={`pi-due-grid ${dueDateType === 'EOM' ? 'pi-due-eom' : ''}`}>
                                        <select value={dueDateType} onChange={(e) => setDueDateType(e.target.value)}>
                                            <option value="Net">Net</option>
                                            <option value="Custom">Custom</option>
                                            <option value="EOM">EOM</option>
                                        </select>
                                        {dueDateType === 'Net' && (
                                            <div className="pi-days-input">
                                                <input type="number" value={netDays} onChange={(e) => setNetDays(e.target.value)} />
                                                <span>days</span>
                                            </div>
                                        )}
                                        {dueDateType === 'Custom' && (
                                            <div className="pi-date-input-small">
                                                <input type="date" value={customDueDate} onChange={(e) => setCustomDueDate(e.target.value)} />
                                            </div>
                                        )}
                                    </div>
                                    <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                                </div>
                                <div className="pi-field">
                                    <label>Ref # (Optional)</label>
                                    <input type="text" placeholder="Vendor inv #" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
                                </div>
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Super supplier *</label>
                                <select
                                    value={superSupplierId}
                                    disabled={sspPurchaseModalMode === 'edit'}
                                    onChange={(e) => setSuperSupplierId(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.9375rem',
                                        fontWeight: 600,
                                        background: '#f8fafc',
                                        color: '#1e293b',
                                    }}
                                >
                                    <option value="">
                                        {ssLoading ? 'Loading vendors…' : 'Select super supplier'}
                                    </option>
                                    {superSuppliers.map((ss) => (
                                        <option
                                            key={String(ss.id)}
                                            value={String(ss.id)}
                                            disabled={ss.isActive === false}
                                        >
                                            {ss.name}
                                            {ss.isActive === false ? ' (inactive)' : ''}
                                            {ss.vatNumber ? ` — VAT ${ss.vatNumber}` : ''}
                                        </option>
                                    ))}
                                </select>
                                {!ssLoading && superSuppliers.length === 0 ? (
                                    <span
                                        className="pi-sub-label"
                                        style={{ color: '#B45309', marginTop: 8, display: 'block' }}
                                    >
                                        Add a super supplier with &quot;Add Super Supplier&quot; before recording a purchase.
                                    </span>
                                ) : null}
                            </div>
                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input type="text" placeholder="Invoice description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>

                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0 0 8px 0' }}>
                                {catalogLoading
                                    ? 'Loading warehouse stock…'
                                    : catalogForSearch.length
                                      ? 'Search products that exist in Stock Inventory (warehouse) to add lines.'
                                      : 'No stock rows returned. Open Stock Inventory — only listed SKUs appear here.'}
                            </p>

                            <div className="pi-lines-section">
                                <div className="pi-lines-header" style={{ gridTemplateColumns: getGridColumns() }}>
                                    {showLineNum && <div className="pi-col-hash">#</div>}
                                    <div className="pi-col-item">Item</div>
                                    <div className="pi-col-acc">Account</div>
                                    {showDesc && <div className="pi-col-desc">Description</div>}
                                    <div className="pi-col-uom">UOM</div>
                                    <div className="pi-col-qty">Qty</div>
                                    <div className="pi-col-price">
                                        Unit price
                                        {amountsTaxInclusive ? (
                                            <span
                                                style={{
                                                    display: 'block',
                                                    fontWeight: 400,
                                                    fontSize: 11,
                                                    color: '#64748b',
                                                }}
                                            >
                                                (incl. VAT)
                                            </span>
                                        ) : null}
                                    </div>
                                    {showDiscount && <div className="pi-col-disc">Discount</div>}
                                    <div className="pi-col-total">Total</div>
                                    <div className="pi-col-tax">Tax Code</div>
                                    <div className="pi-col-tamt">Tax Amt</div>
                                    <div className="pi-col-total">Grand Total</div>
                                    <div aria-hidden />
                                </div>

                                {lineItems.map((line, idx) => (
                                    <div key={line.id} className="pi-lines-header pi-line-data-row" style={{ gridTemplateColumns: getGridColumns() }}>
                                        {showLineNum && <div className="pi-col-hash">{idx + 1}</div>}
                                        <div
                                            className="pi-col-item"
                                            style={{
                                                position: 'relative',
                                                minWidth: 0,
                                            }}
                                        >
                                            <div
                                                ref={
                                                    itemPickerLineId === line.id
                                                        ? lineItemPickerWrapRef
                                                        : null
                                                }
                                                style={{
                                                    position: 'relative',
                                                    width: '100%',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'stretch',
                                                        gap: 4,
                                                        width: '100%',
                                                    }}
                                                >
                                                    <input
                                                        type="text"
                                                        className="pi-row-input"
                                                        style={{
                                                            flex: 1,
                                                            minWidth: 0,
                                                        }}
                                                        value={
                                                            itemPickerLineId === line.id
                                                                ? itemPickerInput
                                                                : (line.item ?? '')
                                                        }
                                                        placeholder="Select from stock…"
                                                        onFocus={() => {
                                                            setItemPickerLineId(line.id);
                                                            setItemPickerInput(String(line.item ?? ''));
                                                            setItemPickerFilter('');
                                                        }}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setItemPickerLineId(line.id);
                                                            setItemPickerInput(v);
                                                            setItemPickerFilter(v);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key === 'Escape' ||
                                                                e.key === 'Enter'
                                                            ) {
                                                                e.preventDefault();
                                                                const text = String(
                                                                    itemPickerInputRef.current ?? '',
                                                                ).trim();
                                                                setLineItems((prev) =>
                                                                    prev.map((l) =>
                                                                        l.id === line.id ? { ...l, item: text } : l,
                                                                    ),
                                                                );
                                                                setItemPickerLineId(null);
                                                                setItemPickerInput('');
                                                                setItemPickerFilter('');
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        title="Show stock list"
                                                        aria-label="Open stock item list"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => {
                                                            if (itemPickerLineId === line.id) {
                                                                const text = String(
                                                                    itemPickerInputRef.current ?? '',
                                                                ).trim();
                                                                setLineItems((prev) =>
                                                                    prev.map((l) =>
                                                                        l.id === line.id ? { ...l, item: text } : l,
                                                                    ),
                                                                );
                                                                setItemPickerLineId(null);
                                                                setItemPickerInput('');
                                                                setItemPickerFilter('');
                                                            } else {
                                                                setItemPickerLineId(line.id);
                                                                setItemPickerInput(String(line.item ?? ''));
                                                                setItemPickerFilter('');
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
                                                        }}
                                                    >
                                                        <ChevronDown size={16} />
                                                    </button>
                                                </div>
                                                {itemPickerLineId === line.id ? (
                                                    <div
                                                        className="pi-search-results"
                                                        style={{
                                                            position: 'absolute',
                                                            left: 0,
                                                            right: 0,
                                                            top: 'calc(100% + 4px)',
                                                            zIndex: 50,
                                                            maxHeight: 240,
                                                            overflowY: 'auto',
                                                            boxShadow: '0 10px 25px rgba(15,23,42,0.12)',
                                                        }}
                                                    >
                                                        {(() => {
                                                            const pickerRows =
                                                                getSearchSuggestionsPi(itemPickerFilter);
                                                            return pickerRows.length ? (
                                                                pickerRows.map((invItem, i) => (
                                                                    <div
                                                                        key={`${line.id}-${String(invItem.id)}-${i}`}
                                                                        className="pi-result-item"
                                                                        onMouseDown={(ev) => {
                                                                            ev.preventDefault();
                                                                            applyCatalogPurchaseItemToLine(
                                                                                line.id,
                                                                                invItem,
                                                                            );
                                                                        }}
                                                                        role="presentation"
                                                                    >
                                                                        <div className="pi-result-info">
                                                                            <div className="pi-item-name">{invItem.name}</div>
                                                                            <div
                                                                                className="pi-item-meta"
                                                                                style={{
                                                                                    flexDirection: 'column',
                                                                                    alignItems: 'flex-start',
                                                                                    gap: 4,
                                                                                }}
                                                                            >
                                                                                <span
                                                                                    style={{
                                                                                        display: 'flex',
                                                                                        gap: 8,
                                                                                        flexWrap: 'wrap',
                                                                                    }}
                                                                                >
                                                                                    <span className="pi-item-type">
                                                                                        {invItem.type === 'Stock'
                                                                                            ? 'Stock'
                                                                                            : 'Product'}
                                                                                    </span>
                                                                                    {invItem.unit ? (
                                                                                        <span> • {invItem.unit}</span>
                                                                                    ) : null}
                                                                                    {invItem.sku ? (
                                                                                        <span>SKU {invItem.sku}</span>
                                                                                    ) : null}
                                                                                </span>
                                                                                {invItem.stockHint ? (
                                                                                    <span
                                                                                        style={{
                                                                                            fontSize: 11,
                                                                                            color: '#64748b',
                                                                                            lineHeight: 1.35,
                                                                                        }}
                                                                                    >
                                                                                        {invItem.stockHint}
                                                                                    </span>
                                                                                ) : null}
                                                                            </div>
                                                                        </div>
                                                                        <div className="pi-item-price">
                                                                            <div className="pi-price-val">
                                                                                SAR {Number(invItem.price || 0).toLocaleString()}
                                                                            </div>
                                                                            <div className="pi-price-unit">
                                                                                per {invItem.unit || 'unit'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div style={{ padding: 14, fontSize: 13, color: '#64748b' }}>
                                                                    {catalogForSearch.length === 0
                                                                        ? 'No stock inventory items loaded.'
                                                                        : 'No matching stock items.'}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="pi-col-acc">
                                            <select
                                                className="pi-row-input"
                                                value={line.account}
                                                onChange={(e) => updateLineItem(line.id, 'account', e.target.value)}
                                            >
                                                {ACCOUNT_OPTIONS.map((opt) => (
                                                    <option key={opt.code} value={`${opt.code} - ${opt.name}`}>
                                                        {opt.code} - {opt.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {showDesc && (
                                            <div className="pi-col-desc">
                                                <input
                                                    type="text"
                                                    value={line.description ?? ''}
                                                    className="pi-row-input"
                                                    placeholder="Description"
                                                    onChange={(e) =>
                                                        updateLineItem(
                                                            line.id,
                                                            'description',
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                        <div className="pi-col-uom">
                                            <input
                                                type="text"
                                                className="pi-row-input"
                                                placeholder="UOM"
                                                value={line.uom ?? ''}
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'uom',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="pi-col-qty">
                                            <input
                                                type="text"
                                                defaultValue={line.qty}
                                                key={`qty-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) => updateLineItem(line.id, 'qty', e.target.value)}
                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'qty')}
                                                onBlur={(e) => handleMathBlur(e, line.id, 'qty')}
                                            />
                                        </div>
                                        <div className="pi-col-price">
                                            <input
                                                type="text"
                                                defaultValue={line.price}
                                                key={`price-${line.id}`}
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) => updateLineItem(line.id, 'price', e.target.value)}
                                                onKeyDown={(e) => handleMathKeyDown(e, line.id, 'price')}
                                                onBlur={(e) => handleMathBlur(e, line.id, 'price')}
                                            />
                                        </div>
                                        {showDiscount && (
                                            <div
                                                className="pi-col-disc"
                                                style={{
                                                    display: 'flex',
                                                    gap: 6,
                                                    alignItems: 'center',
                                                    minWidth: 0,
                                                }}
                                            >
                                                <input
                                                    type="text"
                                                    className="pi-row-input-num pi-math-input"
                                                    style={{ flex: 1, minWidth: 0 }}
                                                    value={
                                                        line.discount === undefined ||
                                                        line.discount === null
                                                            ? ''
                                                            : String(line.discount)
                                                    }
                                                    onChange={(e) =>
                                                        updateLineItem(
                                                            line.id,
                                                            'discount',
                                                            e.target.value,
                                                        )
                                                    }
                                                    onKeyDown={(e) =>
                                                        handleMathKeyDown(
                                                            e,
                                                            line.id,
                                                            'discount',
                                                        )
                                                    }
                                                    onBlur={(e) =>
                                                        handleMathBlur(
                                                            e,
                                                            line.id,
                                                            'discount',
                                                        )
                                                    }
                                                />
                                                <select
                                                    className="pi-row-input"
                                                    style={{
                                                        flex: '0 0 auto',
                                                        maxWidth: 76,
                                                        padding: '6px 4px',
                                                        fontSize: 12,
                                                    }}
                                                    value={
                                                        line.discountMode === 'fixed_sar'
                                                            ? 'fixed_sar'
                                                            : 'percent'
                                                    }
                                                    onChange={(e) =>
                                                        updateLineItem(
                                                            line.id,
                                                            'discountMode',
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="percent">%</option>
                                                    <option value="fixed_sar">SAR</option>
                                                </select>
                                            </div>
                                        )}
                                        <div className="pi-col-total">
                                            SAR{' '}
                                            {
                                                computeLineFinancials(
                                                    line,
                                                    amountsTaxInclusive,
                                                ).lineExStr
                                            }
                                        </div>
                                        <div className="pi-col-tax">
                                            <select className="pi-row-input" value={line.taxCode} onChange={(e) => updateLineItem(line.id, 'taxCode', e.target.value)}>
                                                {TAXES.map((t) => (
                                                    <option key={t.id} value={t.code}>
                                                        {t.code}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="pi-col-tamt">SAR {line.taxAmt}</div>
                                        <div className="pi-col-total">SAR {line.totalFinal}</div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <button
                                                type="button"
                                                title="Remove line"
                                                aria-label="Remove line"
                                                onClick={() => removePurchaseLine(line.id)}
                                                style={{
                                                    padding: 6,
                                                    borderRadius: 8,
                                                    border: '1px solid #fecaca',
                                                    background: '#fff',
                                                    color: '#b91c1c',
                                                    cursor: 'pointer',
                                                    lineHeight: 0,
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <div className="pi-line-row">
                                    <div
                                        ref={piSearchWrapRef}
                                        className="pi-search-box-wrapper"
                                        style={{ position: 'relative', flex: 1 }}
                                    >
                                        <div className="pi-search-box">
                                            <Search size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search stock inventory (name or SKU)"
                                                value={searchQuery}
                                                onChange={(e) => applySearchQueryPi(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                onFocus={openPiLineSearch}
                                            />
                                        </div>
                                        {showDropdown ? (
                                            <div className="pi-search-results">
                                                {searchResults.length > 0 ? (
                                                    searchResults.map((item, index) => (
                                                        <div
                                                            key={String(item.id)}
                                                            className={`pi-result-item ${selectedIndex === index ? 'selected' : ''}`}
                                                            onClick={() => addItemToLines(item)}
                                                            onMouseEnter={() => setSelectedIndex(index)}
                                                            role="presentation"
                                                        >
                                                            <div className="pi-result-info">
                                                                <div className="pi-item-name">{item.name}</div>
                                                                <div className="pi-item-meta">
                                                                    <span className="pi-item-type">Product</span>
                                                                    <span>• {item.unit}</span>
                                                                    {item.sku ? (
                                                                        <span style={{ marginLeft: 6 }}>SKU {item.sku}</span>
                                                                    ) : null}
                                                                    {item.stockHint ? (
                                                                        <span style={{ marginLeft: 6, color: '#64748b' }}>
                                                                            · {item.stockHint}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                            <div className="pi-item-price">
                                                                <div className="pi-price-val">SAR {item.price}</div>
                                                                <div className="pi-price-unit">per {item.unit}</div>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ padding: 14, fontSize: 13, color: '#64748b' }}>
                                                        {catalogForSearch.length === 0
                                                            ? 'No stock inventory items loaded. Check Stock Inventory — this list matches warehouse stock only.'
                                                            : 'No matching stock items.'}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-add-line"
                                        onClick={addEmptyPurchaseLine}
                                    >
                                        <Plus size={16} /> Add line
                                    </button>
                                </div>
                                <div className="pi-hint">
                                    <Zap size={14} /> Tip: Type to search stock inventory, use ↑↓ arrows, Enter to select. Price fields support math (e.g. 12*5)
                                </div>
                            </div>

                            <div className="pi-config-row">
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showLineNum} onChange={(e) => setShowLineNum(e.target.checked)} /> <span>Column — Line number</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showDesc} onChange={(e) => setShowDesc(e.target.checked)} /> <span>Column — Description</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} /> <span>Column — Discount</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={amountsTaxInclusive}
                                        onChange={(e) =>
                                            setAmountsTaxInclusive(e.target.checked)
                                        }
                                    />{' '}
                                    <span>Amounts are tax inclusive</span>
                                </label>
                            </div>

                            <div className="pi-footer-grid">
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline">
                                        <label>Freight-in (SAR)</label>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            value={
                                                freightCharges != null
                                                    ? String(freightCharges)
                                                    : ''
                                            }
                                            onChange={(e) =>
                                                setFreightCharges(e.target.value)
                                            }
                                        />
                                    </div>
                                    <div className="pi-field-inline">
                                        <label>Invoice Discount</label>
                                        <div className="pi-discount-group">
                                            <input
                                                type="text"
                                                value={invoiceDiscountValue}
                                                onChange={(e) =>
                                                    setInvoiceDiscountValue(
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <select
                                                value={invoiceDiscountMode}
                                                onChange={(e) =>
                                                    setInvoiceDiscountMode(
                                                        e.target.value,
                                                    )
                                                }
                                            >
                                                <option value="fixed_sar">
                                                    Fixed (SAR)
                                                </option>
                                                <option value="percent">%</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pi-field pi-full-width">
                                        <label>Notes</label>
                                        <textarea
                                            placeholder="Internal notes (optional)"
                                            rows={4}
                                            value={internalNotes}
                                            onChange={(e) => setInternalNotes(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="pi-footer-column pi-summary-column">
                                    <div className="pi-summary-card">
                                        <div className="pi-summary-row">
                                            <span>Subtotal:</span>
                                            <span>SAR {summary.subtotal}</span>
                                        </div>
                                        {summary.showFreightRow ? (
                                            <div className="pi-summary-row">
                                                <span>Freight-in (SAR):</span>
                                                <span>SAR {summary.freightInFormatted}</span>
                                            </div>
                                        ) : null}
                                        {summary.showInvoiceDiscountRow ? (
                                            <div className="pi-summary-row">
                                                <span>{summary.invoiceDiscountSummaryLabel}</span>
                                                <span style={{ color: '#B91C1C' }}>
                                                    − SAR {summary.invoiceDiscountFormatted}
                                                </span>
                                            </div>
                                        ) : null}
                                        <div className="pi-summary-row">
                                            <span>Total Tax (VAT):</span>
                                            <span>SAR {summary.totalTax}</span>
                                        </div>
                                        <div className="pi-summary-row pi-grand-total">
                                            <span>Grand Total:</span>
                                            <span>SAR {summary.grandTotal}</span>
                                        </div>
                                    </div>
                                    <div className="pi-ap-alert">
                                        <span>
                                            Saves a <strong>super supplier purchase invoice</strong> with line items and VAT
                                            total. It appears in <strong>Super supplier purchase invoices</strong> below and
                                            updates your vendor purchase history.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
