import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    FileText,
    Plus,
    Eye,
    Download,
    Calendar,
    Search,
    Zap,
    Pencil,
    Trash2,
    ChevronDown,
    Loader2,
    RotateCcw,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/AccountingPage.css';
import {
    createSupplierInvoice,
    deleteSupplierInvoice,
    getSupplierInvoice,
    getSupplierInventoryStockBalances,
    getSupplierSalesInvoiceCustomerBranches,
    listSupplierInvoices,
    listSupplierInvoiceReturns,
    createSupplierInvoiceReturn,
    listSupplierCashBankAccounts,
    patchSupplierInvoicePaymentStatus,
    updateSupplierInvoice,
} from '../../services/supplierApi';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';

/** Session key: JSON line preset (legacy / fallback). Primary path is router state `salesInvoiceFromAlert`. */
const SI_PRESET_LINE_KEY = 'supplier_sales_invoice_preset_line';

const SALES_INVOICE_FROM_ALERT_KEY = 'salesInvoiceFromAlert';

/** Map GET `/supplier/invoices/:id` → WorkshopPurchaseInvoiceView detail (same bilingual layout as workshop PI). */
function mapSupplierSalesInvoiceToWorkshopDetail(inv) {
    if (!inv || typeof inv !== 'object') return {};
    const meta =
        inv.salesInvoiceMeta != null && typeof inv.salesInvoiceMeta === 'object'
            ? inv.salesInvoiceMeta
            : {};
    const branchName = inv.branch?.name ?? inv.workshop?.name ?? '';
    const refLabel =
        inv.deliveryNoteUrl != null && String(inv.deliveryNoteUrl).trim() !== ''
            ? String(inv.deliveryNoteUrl).trim()
            : '';
    return {
        id: inv.id,
        invoiceNumber: inv.invoiceNo,
        invoiceNo: inv.invoiceNo,
        issueDate: inv.invoiceDate,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        status: inv.status,
        workshopName: branchName,
        branchName,
        branch: inv.branch,
        workshop: inv.workshop,
        vendorInvoiceRef: refLabel,
        vendorRef: refLabel,
        subtotalExVat: inv.subtotal,
        subtotal: inv.subtotal,
        vatAmount: inv.vatAmount,
        totalVat: inv.vatAmount,
        grandTotal: inv.grandTotal,
        total: inv.grandTotal,
        returnsTotal: Number(inv.returnsTotal ?? 0),
        amountPaid: inv.paid,
        paidAmount: inv.paid,
        balanceDue: inv.outstanding,
        balance: inv.outstanding,
        paymentStatus:
            Number(inv.paid) >= Number(inv.grandTotal) && Number(inv.grandTotal) > 0 ? 'paid' : 'unpaid',
        payments: Array.isArray(inv.payments) ? inv.payments : [],
        salesInvoiceMeta: inv.salesInvoiceMeta ?? null,
        cashBankAccount:
            typeof meta.cashBankAccount === 'string' ? meta.cashBankAccount.trim() : '',
        notes: inv.internalNotes ?? inv.internal_notes ?? inv.notes ?? '',
        description: refLabel,
        items: (inv.items || []).map((it) => ({
            id: it.id,
            productName: it.productName,
            product_name: it.productName,
            qty: it.qty,
            quantity: it.qty,
            qtyReturned: Number(it.qtyReturned ?? it.qty_returned ?? 0),
            unit: 'piece',
            uom: 'piece',
            unitPrice: it.unitPrice,
            unit_price: it.unitPrice,
            unitPriceExVat: it.unitPrice,
            vatRate: it.vatRate,
            vat_rate: it.vatRate,
            lineTotal: it.lineTotal,
            line_total: it.lineTotal,
        })),
    };
}

function mapSupplierSalesInvoiceToWorkshopListRow(inv) {
    if (!inv || typeof inv !== 'object') return {};
    return {
        id: inv.id,
        invoice_number: inv.invoiceNo,
        invoiceNo: inv.invoiceNo,
        date: inv.invoiceDate,
        status: inv.status,
        grand_total: inv.grandTotal,
    };
}

/** Server-side page size for GET /supplier/invoices (matches backend max 100). */
const SALES_INVOICE_PAGE_SIZE = 15;

/** Stored on `supplier_payments.method` when marking invoice paid from portal. */
const MARK_PAID_METHOD_OPTIONS = [
    { value: 'cash', label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank transfer' },
    { value: 'card', label: 'Card' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'other', label: 'Other' },
];

/** Align select value with balance (outstanding). */
function salesInvoicePaymentSelectValue(balance) {
    return Number(balance || 0) > 0 ? 'unpaid' : 'paid';
}

/** Display-only AR settlement state for list rows (no quick unpaid toggle here). */
function salesInvoiceArSettlementLabel(inv) {
    const bal = Number(inv?.balance ?? 0);
    const paid = Number(inv?.paid ?? 0);
    if (bal <= 0.005) return { text: 'Paid', tone: 'green' };
    if (paid > 0.005) return { text: 'Partial', tone: 'amber' };
    return { text: 'Unpaid', tone: 'amber' };
}

/** Backend `GET /supplier/cash-bank/accounts` uses `accountType` (cash | bank), not `type`. */
function extractSupplierAccountsPayload(res) {
    if (!res || typeof res !== 'object') return [];
    if (Array.isArray(res)) return res;
    for (const k of ['accounts', 'list', 'items', 'data']) {
        if (Array.isArray(res[k])) return res[k];
    }
    return [];
}

/** Same shaping as SupplierCashBank `mapAccountsFromApi` for stable labels / PATCH text. */
function mapSupplierCashBankAccountForPickers(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = raw.id ?? raw.accountId;
    if (id == null || id === '') return null;
    const rawType = String(raw.accountType ?? raw.type ?? 'bank').toLowerCase();
    const typeLabel = rawType === 'cash' ? 'Cash' : 'Bank';
    const nameBaseRaw = raw.name ?? raw.accountName;
    const nameBase =
        nameBaseRaw != null && String(nameBaseRaw).trim() !== ''
            ? String(nameBaseRaw).trim()
            : 'Account';
    const optionLabel = `${nameBase} (${typeLabel})`;
    return { id: String(id), nameBase, typeLabel, optionLabel, cashBankLabel: optionLabel, raw };
}

function mapSupplierInvoicesListFromResponse(invRes) {
    if (!invRes || !Array.isArray(invRes.invoices)) return [];
    return invRes.invoices.map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        branch: inv.branch?.name || '-',
        branchId: inv.branch?.id,
        workshopName: inv.workshop?.name || inv.branch?.workshopName || '',
        date: inv.invoiceDate,
        dueDate: inv.dueDate || '—',
        amount: Number(inv.grandTotal || 0),
        paid: Number(inv.paid || 0),
        balance: Number(inv.outstanding || 0),
        returnsTotal: Number(inv.returnsTotal ?? 0),
        returnCount: Number(inv.returnCount ?? 0),
        status: inv.status || 'pending_payment',
        paymentStatus: salesInvoicePaymentSelectValue(inv.outstanding),
        vendorRef: inv.deliveryNoteUrl || '—',
        productLabel: inv.productLabel ?? '—',
        quantityLabel: inv.quantityLabel ?? '—',
        unitLabel: inv.unitLabel ?? '—',
        cashBankAccount: inv.cashBankAccount || '',
        freightIn: Number(inv.freightIn ?? 0),
        invoiceDiscount: Number(inv.invoiceDiscount ?? 0),
    }));
}

/** Sum qty already returned per invoice line id (from GET .../returns payloads). */
function aggregateReturnedQtyByInvoiceLine(returns) {
    const m = new Map();
    for (const r of returns || []) {
        for (const line of r.lines || []) {
            const id = String(line.invoiceItemId);
            m.set(id, (m.get(id) || 0) + Number(line.qtyReturned || 0));
        }
    }
    return m;
}

const INVENTORY_ITEMS = [
    {
        id: 1,
        itemType: 'Product',
        name: 'Engine Oil — Full Synthetic 5W40',
        price: 45,
        unit: 'liter',
        lastPrice: 42,
    },
    {
        id: 2,
        itemType: 'Product',
        name: 'Oil Filter — Universal',
        price: 22,
        unit: 'pcs',
        lastPrice: 22,
    },
    {
        id: 3,
        itemType: 'Service',
        name: 'Car Wash Normal - Small',
        price: 20,
        unit: 'service',
        lastPrice: 18,
    },
    {
        id: 4,
        itemType: 'Product',
        name: 'Brake Fluid DOT4',
        price: 28,
        unit: 'liter',
        lastPrice: 28,
    },
];

const ACCOUNT_OPTIONS = [
    { code: '4100', name: 'Sales Revenue' },
    { code: '1410', name: 'Inventory Asset' },
];

const TAXES = [
    { id: 1, name: 'VAT 15%', percent: 15, code: 'VAT 15%', rate: 0.15 },
    { id: 2, name: 'VAT 5%', percent: 5, code: 'VAT 5%', rate: 0.05 },
    { id: 3, name: 'VAT 0%', percent: 0, code: 'VAT 0%', rate: 0 },
    { id: 4, name: 'Exempt', percent: 0, code: 'Exempt', rate: 0 },
];

const CASH_ACCOUNTS = ['Main Cash', 'Bank — Al Rajhi', 'Bank — SNB'];

const SEARCH_QUICK_PICK = 15;
const SEARCH_MAX_RESULTS = 50;

function roundMoney2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Derive ex-VAT line amount, VAT, and VAT-inclusive grand total from user inputs.
 * @param {'percent'|'fixed_sar'} discountMode — % applies to line extension before discount; fixed SAR subtracts from that extension (inclusive or exclusive per flag).
 */
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

/** Stored `unitPrice` is exclusive per unit after line discount — rebuild list price for the form. */
function reconstructSalesInvoiceUnitPriceInput(it, amountsTaxInclusive, taxCode) {
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

function mergeInventoryLists(stockRows, fallback) {
    const map = new Map();
    (stockRows || []).forEach((entry) => {
        if (entry?.id == null || entry.id === '') return;
        map.set(String(entry.id), entry);
    });
    (fallback || []).forEach((inv) => {
        if (inv?.id == null || inv.id === '') return;
        const k = String(inv.id);
        if (!map.has(k)) map.set(k, inv);
    });
    return Array.from(map.values());
}

function normalizeStockCatalogRow(item) {
    const qtyWh = Number(item.currentBalanceWarehouse || 0);
    const unitCost =
        qtyWh > 0 ? Number(item.valueWarehouseSar || 0) / qtyWh : 0;
    const suggested = Number(item.suggestedSaleUnitPriceWorkshop ?? NaN);
    const price =
        Number.isFinite(suggested) && suggested > 0
            ? suggested
            : Number.isFinite(unitCost)
              ? Math.max(0, unitCost)
              : 0;
    const uom = item.workshopUnit || item.unitCode || item.unit || 'pcs';
    const costHint =
        qtyWh > 0
            ? `Warehouse stock: ${qtyWh} • Unit cost SAR ${unitCost.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
            : 'No warehouse stock — you can still enter qty/price; save may be blocked if over stock.';
    const listHint =
        Number.isFinite(suggested) && suggested > 0
            ? `Suggested list SAR ${suggested.toFixed(2)} / ${uom} (invoice line default)`
            : '';
    const stockHint = [listHint, costHint].filter(Boolean).join(' · ');

/** `stock-balances` row `productId` is supplier_products.id — POST as supplierProductId for workshop catalog resolution. */
const supplierStockProductId =
    item.productId != null && item.productId !== ''
        ? String(item.productId).trim()
        : '';

/** Used for picker/display */
const catalogId =
    supplierStockProductId ||
    (item.supplierProductId != null && item.supplierProductId !== ''
        ? String(item.supplierProductId).trim()
        : undefined);

const lastSaleRaw =
    item && typeof item.lastSale === 'object' && item.lastSale != null
        ? item.lastSale
        : null;

const hasPreviousSale = !!(
    lastSaleRaw &&
    String(lastSaleRaw.invoiceDate || '').trim() !== ''
);

const lastSalePriceNum = hasPreviousSale
    ? Number(lastSaleRaw.unitPrice ?? 0)
    : 0;

const saleDateRaw = String(lastSaleRaw?.invoiceDate || '').trim();

const buyerWorkshop = String(lastSaleRaw?.buyerWorkshopName || '').trim();

const buyerBranch = String(lastSaleRaw?.buyerBranchName || '').trim();

const buyerLabel =
    buyerWorkshop && buyerBranch
        ? `${buyerWorkshop} — ${buyerBranch}`
        : buyerWorkshop || buyerBranch || '';

const lastSaleMeta =
    hasPreviousSale && (saleDateRaw || buyerLabel)
        ? [saleDateRaw, buyerLabel].filter(Boolean).join(' • ')
        : '';

/** Workshop-side sellable qty cap (aligned with supplier stock-balances payload). */
    const stockQtyWorkshop = Number(item.currentBalanceWorkshop ?? NaN);
    const conversionFactor = Number(item.conversionFactor) || 1;

    return {
    id: catalogId ?? `row-${item.productName}-${item.sku || ''}`,
    name: item.productName || 'Product',
    sku: String(item.sku ?? item.barcode ?? '').trim(),
    price,
    unit: uom,

        /** Aggregate warehouse bucket qty (supplier stock units before workshop conversion). */
        warehouseStockQty: Number(item.currentBalanceWarehouse ?? 0),
        conversionFactor,

        stockQtyWorkshop:
            Number.isFinite(stockQtyWorkshop) && stockQtyWorkshop >= 0
                ? stockQtyWorkshop
                : null,

    lastPrice: lastSalePriceNum,
    lastSaleMeta,
    hasPreviousSale,

    itemType: 'Product',
    stockHint,

    supplierStockProductId: supplierStockProductId || null,

    catalogProductResolved: Boolean(supplierStockProductId),
};
}

function salesLineStockKey(line) {
    const a = String(line?.supplierStockProductId ?? '').trim();
    if (a) return a;
    return String(line?.supplierProductId ?? '').trim();
}

function findInventoryCapsRow(line, inventoryItems) {
    const sid = String(line?.supplierStockProductId ?? '').trim();
    const pid = String(line?.supplierProductId ?? '').trim();
    if (!sid && !pid) return null;
    return (
        inventoryItems.find((inv) => {
            const iss =
                inv.supplierStockProductId != null
                    ? String(inv.supplierStockProductId)
                    : '';
            const iid = String(inv.id);
            return (sid && (iss === sid || iid === sid)) || (pid && iid === pid);
        }) ?? null
    );
}

/** Max qty in workshop/stock-balances units for this row (respects sibling lines for same SKU). */
function maxSellableQtyWorkshopForLine(line, lines, inventoryItems) {
    const inv = findInventoryCapsRow(line, inventoryItems);
    if (!inv || inv.stockQtyWorkshop == null || !Number.isFinite(inv.stockQtyWorkshop)) {
        return null;
    }
    const cap = Number(inv.stockQtyWorkshop);
    const key = salesLineStockKey(line);
    if (!key) return null;
    let otherSum = 0;
    for (const ln of lines) {
        if (ln.id === line.id) continue;
        if (salesLineStockKey(ln) !== key) continue;
        otherSum += parseFloat(String(ln.qty).replace(',', '.')) || 0;
    }
    return Math.max(0, roundMoney2(cap - otherSum));
}

function nextLineId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function SupplierSalesInvoices() {
    const [invoices, setInvoices] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [invoiceModalMode, setInvoiceModalMode] = useState('create');
    const [editingInvoiceId, setEditingInvoiceId] = useState(null);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [invoiceListPage, setInvoiceListPage] = useState(1);
    const [invoiceListTotal, setInvoiceListTotal] = useState(0);
    const [saveError, setSaveError] = useState('');
    const [saving, setSaving] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewPayload, setViewPayload] = useState(null);
    /** Off-screen `WorkshopPurchaseInvoiceView` for row-download PDF (same template as View modal). */
    const salesInvoicePdfRef = useRef(null);
    const [salesInvoicePdfExport, setSalesInvoicePdfExport] = useState(null);
    const [salesInvoicePdfBusy, setSalesInvoicePdfBusy] = useState(false);
    const [paymentStatusSavingId, setPaymentStatusSavingId] = useState(null);
    const [markPaidModalRow, setMarkPaidModalRow] = useState(null);
    const [markPaidMethod, setMarkPaidMethod] = useState('bank_transfer');
    const [markPaidAccountChoice, setMarkPaidAccountChoice] = useState('');
    const [markPaidCustomAccount, setMarkPaidCustomAccount] = useState('');
    const [markPaidAccounts, setMarkPaidAccounts] = useState([]);
    const [markPaidModalBusy, setMarkPaidModalBusy] = useState(false);
    const [markPaidModalErr, setMarkPaidModalErr] = useState('');
    const [returnModalRow, setReturnModalRow] = useState(null);
    const [returnModalLoading, setReturnModalLoading] = useState(false);
    const [returnModalErr, setReturnModalErr] = useState('');
    const [returnInvoiceDetail, setReturnInvoiceDetail] = useState(null);
    const [returnHistory, setReturnHistory] = useState([]);
    const [returnLineQty, setReturnLineQty] = useState({});
    const [returnLineReason, setReturnLineReason] = useState({});
    const [returnNotes, setReturnNotes] = useState('');
    const [returnSubmitting, setReturnSubmitting] = useState(false);
    const [editInvoiceLoading, setEditInvoiceLoading] = useState(false);

    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [refNo, setRefNo] = useState('');
    const [branch, setBranch] = useState('');
    const [cashAccount, setCashAccount] = useState('');
    const [description, setDescription] = useState('');
    const [internalNotes, setInternalNotes] = useState('');

    const [showLineNum, setShowLineNum] = useState(false);
    const [showDesc, setShowDesc] = useState(false);
    const [showDiscount, setShowDiscount] = useState(false);
    const [amountsTaxInclusive, setAmountsTaxInclusive] = useState(false);
    const amountsTaxInclusiveRef = useRef(amountsTaxInclusive);
    amountsTaxInclusiveRef.current = amountsTaxInclusive;
    const [freightCharges, setFreightCharges] = useState('0');
    const [invoiceDiscountValue, setInvoiceDiscountValue] = useState('0');
    const [invoiceDiscountMode, setInvoiceDiscountMode] = useState('fixed_sar');

    const [lineItems, setLineItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [inventoryItems, setInventoryItems] = useState(INVENTORY_ITEMS);
    const [inventoryInitialLoadDone, setInventoryInitialLoadDone] =
        useState(false);
    /** True while stock-balances (last-sale hints) refetch runs for the open invoice modal. */
    const [lastSaleStockRefreshing, setLastSaleStockRefreshing] =
        useState(false);
    const [branches, setBranches] = useState([]);
    /** Set when GET /supplier/invoices/customer-branches fails (network, auth, server). */
    const [customerBranchesLoadError, setCustomerBranchesLoadError] =
        useState('');
    const invoiceLineSearchWrapRef = useRef(null);
    const lineItemPickerWrapRef = useRef(null);
    /** Current text in the line item field while picker is open — saved to the line on close. */
    const itemPickerInputRef = useRef('');
    const [itemPickerLineId, setItemPickerLineId] = useState(null);
    const [itemPickerInput, setItemPickerInput] = useState('');
    /** Filter passed to getSearchSuggestions — empty on open so list matches “Search product to add” with no query. */
    const [itemPickerFilter, setItemPickerFilter] = useState('');

    const location = useLocation();
    const navigate = useNavigate();
    /** Line preset from Workshop Alerts; applied after inventory load (avoids session + Strict Mode races). */
    const salesInvoiceAlertLinePresetRef = useRef(null);

    const getSearchSuggestions = (query) => {
        const items = [...inventoryItems].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                sensitivity: 'base',
            }),
        );
        const q = query.trim().toLowerCase();
        if (!q) return items.slice(0, SEARCH_QUICK_PICK);
        return items
            .filter((i) => String(i.name || '').toLowerCase().includes(q))
            .slice(0, SEARCH_MAX_RESULTS);
    };

    const applySearchQuery = (value) => {
        setSearchQuery(value);
        const results = getSearchSuggestions(value);
        setSearchResults(results);
        setShowDropdown(true);
        setSelectedIndex(results.length ? 0 : -1);
    };

    const openInvoiceLineSearch = () => {
        const results = getSearchSuggestions(searchQuery);
        setSearchResults(results);
        setShowDropdown(true);
        setSelectedIndex(results.length ? 0 : -1);
    };

    const updateLineItem = useCallback(
        (id, field, value) => {
            const recalc = new Set(['qty', 'price', 'taxCode', 'discount', 'discountMode']);
            setLineItems((prev) =>
                prev.map((line) => {
                    if (line.id !== id) return line;
                    let nextVal = value;
                    if (field === 'qty') {
                        const maxW = maxSellableQtyWorkshopForLine(line, prev, inventoryItems);
                        if (
                            maxW != null &&
                            Number.isFinite(maxW) &&
                            maxW > 0
                        ) {
                            const q = parseFloat(String(value).replace(',', '.'));
                            if (!Number.isNaN(q) && q > maxW + 1e-9) {
                                nextVal = Number.isInteger(maxW) ? String(maxW) : String(roundMoney2(maxW));
                            }
                        }
                    }
                    const updated = { ...line, [field]: nextVal };
                    return recalc.has(field)
                        ? applyLineTotals(updated, amountsTaxInclusive)
                        : updated;
                }),
            );
        },
        [amountsTaxInclusive, inventoryItems],
    );

    useEffect(() => {
        setLineItems((prev) =>
            prev.length
                ? prev.map((line) => applyLineTotals(line, amountsTaxInclusive))
                : prev,
        );
    }, [amountsTaxInclusive]);

    /** When balances refresh while the modal is open, clamp catalog lines down to availability. */
    useEffect(() => {
        if (!modalOpen || !inventoryInitialLoadDone) return;
        setLineItems((prev) =>
            prev.map((line) => {
                const maxW = maxSellableQtyWorkshopForLine(line, prev, inventoryItems);
                if (maxW == null || !Number.isFinite(maxW) || maxW <= 0) return line;
                const q = parseFloat(String(line.qty).replace(',', '.')) || 0;
                if (q <= maxW + 1e-9) return line;
                const capped = Number.isInteger(maxW) ? String(maxW) : String(roundMoney2(maxW));
                return applyLineTotals({ ...line, qty: capped }, amountsTaxInclusive);
            }),
        );
    }, [modalOpen, inventoryInitialLoadDone, inventoryItems, amountsTaxInclusive]);

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

    const addItemToLines = useCallback((item) => {
        const unitPrice = Number(item.price) || 0;
        const hasPrev = !!item.hasPreviousSale;
        const lastSaleAmt = hasPrev ? Number(item.lastPrice ?? 0) : 0;
        const catId =
            item.catalogProductResolved && item.id != null && String(item.id).trim() !== ''
                ? String(item.id)
                : '';
        const rawLine = {
            id: nextLineId(),
            sku: item.sku || '',
            item: item.name,
            account: '4100 - Sales Revenue',
            description: '',
            uom: item.unit,
            qty: 1,
            price: unitPrice,
            discount: 0,
            discountMode: 'percent',
            taxCode: 'VAT 15%',
            taxAmt: '0.00',
            totalFinal: '0.00',
            supplierStockProductId: item.supplierStockProductId ?? null,
            supplierProductId: catId,
            hasPreviousSale: hasPrev,
            lastSalePrice: lastSaleAmt,
            lastSaleMeta: hasPrev ? String(item.lastSaleMeta || '').trim() : '',
        };
        const newLine = applyLineTotals(rawLine, amountsTaxInclusive);
        setLineItems((prev) => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
    }, [amountsTaxInclusive]);

    const removeLineItem = (lineId) => {
        setLineItems((prev) => prev.filter((l) => l.id !== lineId));
    };

    const addEmptyLine = () => {
        const rawLine = {
            id: nextLineId(),
            sku: '',
            item: '',
            account: '4100 - Sales Revenue',
            description: '',
            uom: 'pcs',
            qty: 1,
            price: 0,
            discount: 0,
            discountMode: 'percent',
            taxCode: 'VAT 15%',
            taxAmt: '0.00',
            totalFinal: '0.00',
            supplierProductId: '',
            hasPreviousSale: false,
            lastSalePrice: 0,
            lastSaleMeta: '',
        };
        const newLine = applyLineTotals(rawLine, amountsTaxInclusive);
        setLineItems((prev) => [...prev, newLine]);
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;
        if (e.key === 'ArrowDown') {
            setSelectedIndex((i) => (i < searchResults.length - 1 ? i + 1 : i));
        } else if (e.key === 'ArrowUp') {
            setSelectedIndex((i) => (i > 0 ? i - 1 : i));
        } else if (e.key === 'Enter' && selectedIndex >= 0 && searchResults[selectedIndex]) {
            addItemToLines(searchResults[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str || !/^[\d\s+\-*/.()]+$/.test(str)) return str;
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            // eslint-disable-next-line no-new-func
            const result = Function('return (' + str + ')')();
            if (typeof result === 'number' && isFinite(result)) {
                return parseFloat(result.toFixed(6)).toString();
            }
        } catch {
            // ignore
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
        if (field === 'qty') {
            updateLineItem(lineId, field, evaluated);
            return;
        }
        if (evaluated !== e.target.value) {
            updateLineItem(lineId, field, evaluated);
        }
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';
        let due = new Date(issue);
        if (dueDateType === 'Net') {
            due.setDate(issue.getDate() + parseInt(netDays || 0, 10));
        } else if (dueDateType === 'Custom') {
            return customDueDate || '—';
        } else if (dueDateType === 'EOM') {
            due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        }
        return due.toISOString().slice(0, 10);
    };
    const calculatedDueDate = calculateDueDate();

    const getGridColumns = () => {
        const cols = [];
        if (showLineNum) cols.push('40px');
        cols.push('2fr', '1.5fr'); // Item, Account
        if (showDesc) cols.push('2fr');
        cols.push('0.8fr', '0.8fr', '1fr'); // UOM, Qty, Price
        if (showDiscount) cols.push('minmax(140px, 1.35fr)');
        cols.push('1fr', '1fr', '1fr', '1fr', '1fr'); // Total, TaxCode, TaxAmt, Total(final), Last Sale
        cols.push('48px'); // delete
        return cols.join(' ');
    };

    const resetInvoiceForm = () => {
        setIssueDate(new Date().toISOString().slice(0, 10));
        setDueDateType('Net');
        setNetDays(30);
        setCustomDueDate('');
        setRefNo('');
        setBranch('');
        setCashAccount('');
        setDescription('');
        setInternalNotes('');
        setLineItems([]);
        setSaveError('');
        setSearchQuery('');
        setSearchResults([]);
        setShowDropdown(false);
        setSelectedIndex(-1);
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
    };

    const openNewInvoiceModal = () => {
        setInvoiceModalMode('create');
        setEditingInvoiceId(null);
        setEditInvoiceLoading(false);
        resetInvoiceForm();
        setModalOpen(true);
    };

    const closeInvoiceModal = () => {
        setModalOpen(false);
        setInvoiceModalMode('create');
        setEditingInvoiceId(null);
        setEditInvoiceLoading(false);
        resetInvoiceForm();
    };

    const loadInvoiceList = async (opts = {}) => {
        const silent = opts.silent === true;
        let page = opts.page != null ? opts.page : invoiceListPage;
        if (!silent) {
            setListLoading(true);
            setListError('');
        }
        try {
            let offset = (page - 1) * SALES_INVOICE_PAGE_SIZE;
            let invRes = await listSupplierInvoices({
                limit: SALES_INVOICE_PAGE_SIZE,
                offset,
            });
            let total = Number(invRes?.total ?? 0);
            let rows = mapSupplierInvoicesListFromResponse(invRes);
            const maxPage = Math.max(1, Math.ceil(total / SALES_INVOICE_PAGE_SIZE) || 1);
            if (page > maxPage && total > 0) {
                page = maxPage;
                offset = (page - 1) * SALES_INVOICE_PAGE_SIZE;
                invRes = await listSupplierInvoices({
                    limit: SALES_INVOICE_PAGE_SIZE,
                    offset,
                });
                total = Number(invRes?.total ?? total);
                rows = mapSupplierInvoicesListFromResponse(invRes);
            }
            setInvoiceListTotal(total);
            setInvoiceListPage(page);
            setInvoices(rows);
        } catch (err) {
            console.error('List supplier invoices failed:', err);
            if (!silent) {
                setListError(err?.message || 'Failed to load invoices.');
                setInvoices([]);
                setInvoiceListTotal(0);
            } else {
                window.alert(err?.message || 'Failed to refresh invoices.');
            }
        } finally {
            if (!silent) setListLoading(false);
        }
    };

    const handleSaveInvoice = async () => {
        setSaveError('');
        if (!branch) {
            setSaveError('Select a workshop branch (customer).');
            return;
        }
        if (lineItems.length === 0) {
            setSaveError('Add at least one line item.');
            return;
        }
        const branchRef = branches.find(
            (b) => !b.noBranch && String(b.value || b.id) === String(branch),
        );
        if (!branchRef?.id) {
            setSaveError('Invalid branch selection. Refresh the page if branches are missing.');
            return;
        }
        const normalizedLines = lineItems.map((line, idx) => {
            const f = computeLineFinancials(line, amountsTaxInclusive);
            const qtyNum = parseFloat(String(line.qty).replace(',', '.')) || 0;
            const unitPriceExForApi =
                qtyNum > 0 ? roundMoney2(f.lineEx / qtyNum) : 0;
            return {
                index: idx,
                productName: String(line.item || '').trim(),
                qty: qtyNum,
                unitPrice: unitPriceExForApi,
                vatRate: Number(TAXES.find((t) => t.code === line.taxCode)?.percent || 0),
                unit: String(line.uom || 'pcs').trim() || 'pcs',
                sku: String(line.sku || '').trim(),
            };
        });
        const invalidLine = normalizedLines.find(
            (line) => !line.productName || !(line.qty > 0) || line.unitPrice < 0,
        );
        if (invalidLine) {
            setSaveError(
                `Line ${invalidLine.index + 1}: item name required, qty must be > 0, and price cannot be negative.`,
            );
            return;
        }
        for (let i = 0; i < lineItems.length; i++) {
            const row = lineItems[i];
            const maxWs = maxSellableQtyWorkshopForLine(row, lineItems, inventoryItems);
            if (maxWs == null || !Number.isFinite(maxWs)) continue;
            const qNum = normalizedLines[i].qty;
            if (qNum > maxWs + 1e-6) {
                setSaveError(
                    `Line ${i + 1}: quantity ${qNum} exceeds available supplier stock (${maxWs} ${normalizedLines[i].unit} max across this invoice).`,
                );
                return;
            }
        }
        setSaving(true);
        const due =
            calculatedDueDate === '—' ? issueDate : calculatedDueDate;
        const itemsPayload = normalizedLines.map((line, idx) => {
            const row = lineItems[idx];
            const discRaw =
                parseFloat(String(row?.discount ?? 0).replace(',', '.')) || 0;
    const body = {
        productName: line.productName,
        qty: line.qty,
        unitPrice: line.unitPrice,
        vatRate: line.vatRate,
        unit: line.unit,
        ...(line.sku ? { sku: line.sku } : {}),

        ...(String(row?.supplierStockProductId ?? '').trim()
            ? { supplierProductId: String(row.supplierStockProductId).trim() }
            : String(row?.supplierProductId ?? '').trim()
              ? { supplierProductId: String(row.supplierProductId).trim() }
              : {}),

        ...(row?.workshopCatalogProductId
            ? { productId: String(row.workshopCatalogProductId) }
            : {}),

        lineDiscount: discRaw,
        lineDiscountMode:
            row?.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent',
    };    
            const desc = String(row?.description ?? '').trim();
            if (desc) {
                body.lineDescription = desc;
            }
            return body;
        });
        const fin = getSummary();
        const salesInvoiceMeta = {
            ...(cashAccount.trim()
                ? { cashBankAccount: cashAccount.trim() }
                : {}),
            showLineNum,
            showDesc,
            showDiscount,
            amountsTaxInclusive,
            invoiceDiscountMode,
            invoiceDiscountInput:
                parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0,
        };
        try {
            if (invoiceModalMode === 'edit' && editingInvoiceId) {
                await updateSupplierInvoice(editingInvoiceId, {
                    invoiceDate: issueDate,
                    dueDate: due,
                    paymentTerms: dueDateType === 'Net' ? `Net ${netDays}` : dueDateType,
                    ...(description?.trim()
                        ? { deliveryNoteUrl: description.trim() }
                        : {}),
                    internalNotes: internalNotes.trim(),
                    freightIn: fin.freightIn,
                    invoiceDiscount: fin.invoiceDiscount,
                    salesInvoiceMeta,
                    items: itemsPayload,
                });
            } else {
                /**
                 * Default invoice number is short and matches the workshop PI
                 * prefix so every invoice in Filter starts with `WPI-SI-`.
                 * Base36 timestamp keeps it ~9 chars instead of 13-digit ms.
                 */
                const invoiceNo =
                    (refNo && String(refNo).trim()) ||
                    `WPI-SI-${Date.now().toString(36).toUpperCase()}`;
                await createSupplierInvoice({
                    invoiceNo,
                    invoiceDate: issueDate,
                    dueDate: due,
                    branchId: String(branchRef.id),
                    paymentTerms: dueDateType === 'Net' ? `Net ${netDays}` : dueDateType,
                    deliveryNoteUrl: description?.trim() || undefined,
                    ...(internalNotes.trim()
                        ? { internalNotes: internalNotes.trim() }
                        : {}),
                    freightIn: fin.freightIn,
                    invoiceDiscount: fin.invoiceDiscount,
                    salesInvoiceMeta,
                    items: itemsPayload,
                });
            }
            setModalOpen(false);
            setInvoiceModalMode('create');
            setEditingInvoiceId(null);
            resetInvoiceForm();
            await loadInvoiceList();
        } catch (err) {
            console.error('Save supplier invoice failed:', err);
            setSaveError(err?.message || 'Failed to save invoice.');
        } finally {
            setSaving(false);
        }
    };

    const openEditInvoice = async (row) => {
        setSaveError('');
        setInvoiceModalMode('edit');
        setEditingInvoiceId(row.id);
        setEditInvoiceLoading(true);
        setModalOpen(true);
        try {
            const res = await getSupplierInvoice(row.id);
            const inv = res?.invoice;
            if (!inv) {
                setSaveError('Invoice not found.');
                return;
            }
            setIssueDate(inv.invoiceDate || issueDate);
            setBranch(inv.branch?.id != null ? String(inv.branch.id) : '');
            setDescription(inv.deliveryNoteUrl || '');
            setInternalNotes(inv.internalNotes ?? inv.internal_notes ?? inv.notes ?? '');
            setRefNo(inv.invoiceNo || '');
            const due = inv.dueDate ? new Date(inv.dueDate) : new Date();
            const issue = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date();
            const diffDays = Math.round((due - issue) / (1000 * 60 * 60 * 24));
            if (!Number.isNaN(diffDays) && diffDays >= 0) {
                setDueDateType('Net');
                setNetDays(diffDays || 30);
            }

            const m =
                inv.salesInvoiceMeta != null && typeof inv.salesInvoiceMeta === 'object'
                    ? inv.salesInvoiceMeta
                    : {};
            const taxIncl = !!m.amountsTaxInclusive;
            setCashAccount(typeof m.cashBankAccount === 'string' ? m.cashBankAccount : '');
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
                    setInvoiceDiscountValue(String(Number(inv.invoiceDiscount ?? 0)));
                }
            }
            setFreightCharges(String(Number(inv.freightIn ?? 0)));

            setLineItems(
                (inv.items || []).map((it) => {
                    const taxCode =
                        TAXES.find(
                            (t) => Math.abs(t.percent - Number(it.vatRate)) < 0.01,
                        )?.code || 'VAT 15%';
                    const discVal = Number(it.lineDiscountValue ?? 0);
                    const discMode =
                        it.lineDiscountMode === 'fixed_sar' ? 'fixed_sar' : 'percent';
                    const priceStr = reconstructSalesInvoiceUnitPriceInput(
                        it,
                        taxIncl,
                        taxCode,
                    );
                    return applyLineTotals(
                        {
                            id: nextLineId(),
                            sku: String(it.sku ?? '').trim(),
                            item: it.productName,
                            account: '4100 - Sales Revenue',
                            description: String(it.lineDescription ?? '').trim(),
                            uom: it.unit || 'pcs',
                            qty: String(it.qty),
                            price: priceStr,
                            discount: discVal,
                            discountMode: discMode,
                            taxCode,
                            taxAmt: '0.00',
                            totalFinal: '0.00',
                            supplierStockProductId:
                                it.supplierProductId != null &&
                                String(it.supplierProductId).trim() !== ''
                                    ? String(it.supplierProductId).trim()
                                    : '',
                            supplierProductId:
                                it.supplierProductId != null &&
                                String(it.supplierProductId).trim() !== ''
                                    ? String(it.supplierProductId).trim()
                                    : '',
                            hasPreviousSale: false,
                            lastSalePrice: 0,
                            lastSaleMeta: '',
                        },
                        taxIncl,
                    );
                }),
            );
        } catch (err) {
            console.error('Load invoice for edit failed:', err);
            setSaveError(err?.message || 'Could not load invoice.');
        } finally {
            setEditInvoiceLoading(false);
        }
    };

    const handleViewInvoice = async (row) => {
        setViewOpen(true);
        setViewLoading(true);
        setViewPayload(null);
        try {
            const res = await getSupplierInvoice(row.id);
            setViewPayload(res);
        } catch (err) {
            console.error('View invoice failed:', err);
            setViewPayload({ error: err?.message || 'Failed to load invoice.' });
        } finally {
            setViewLoading(false);
        }
    };

    const handleDownloadInvoice = async (row) => {
        if (salesInvoicePdfBusy) return;
        setSalesInvoicePdfBusy(true);
        setListError('');
        try {
            const res = await getSupplierInvoice(row.id);
            const inv = res?.invoice;
            if (!inv) {
                throw new Error('Invoice not found.');
            }
            flushSync(() => setSalesInvoicePdfExport(inv));
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            await new Promise((r) => setTimeout(r, 180));
            const api = salesInvoicePdfRef.current;
            if (!api?.downloadPdf) {
                throw new Error('Could not initialize invoice PDF.');
            }
            await api.downloadPdf();
        } catch (err) {
            console.error('Download invoice failed:', err);
            setListError(err?.message || 'Could not download invoice PDF.');
        } finally {
            flushSync(() => setSalesInvoicePdfExport(null));
            setSalesInvoicePdfBusy(false);
        }
    };

    const handleDeleteInvoice = async (row) => {
        if (row.status !== 'pending_payment') {
            window.alert('Only invoices with status pending_payment (no payments) can be deleted.');
            return;
        }
        if (!window.confirm(`Delete invoice ${row.invoiceNo}?`)) return;
        try {
            await deleteSupplierInvoice(row.id);
            await loadInvoiceList();
        } catch (err) {
            console.error('Delete invoice failed:', err);
            window.alert(err?.message || 'Delete failed.');
        }
    };

    const applyPaymentPatch = async (row, payload, opts = {}) => {
        const { showAlert = true } = opts;
        setPaymentStatusSavingId(row.id);
        try {
            await patchSupplierInvoicePaymentStatus(row.id, payload);
            await loadInvoiceList({ silent: true });
        } catch (err) {
            console.error('Update payment status failed:', err);
            if (showAlert) {
                window.alert(err?.message || 'Could not update payment status.');
            }
            throw err;
        } finally {
            setPaymentStatusSavingId(null);
        }
    };

    const closeReturnModal = () => {
        if (returnSubmitting) return;
        setReturnModalRow(null);
        setReturnModalLoading(false);
        setReturnModalErr('');
        setReturnInvoiceDetail(null);
        setReturnHistory([]);
        setReturnLineQty({});
        setReturnLineReason({});
        setReturnNotes('');
    };

    const openReturnModal = async (row) => {
        setReturnModalRow(row);
        setReturnModalLoading(true);
        setReturnModalErr('');
        setReturnInvoiceDetail(null);
        setReturnHistory([]);
        try {
            const [invRes, retRes] = await Promise.all([
                getSupplierInvoice(row.id),
                listSupplierInvoiceReturns(row.id),
            ]);
            setReturnInvoiceDetail(invRes);
            setReturnHistory(Array.isArray(retRes?.returns) ? retRes.returns : []);
            const qty = {};
            const reasons = {};
            (invRes?.invoice?.items || []).forEach((it) => {
                const id = String(it.id);
                qty[id] = '';
                reasons[id] = '';
            });
            setReturnLineQty(qty);
            setReturnLineReason(reasons);
            setReturnNotes('');
        } catch (err) {
            console.error('Open return modal failed:', err);
            setReturnModalErr(err?.message || 'Could not load invoice for return.');
        } finally {
            setReturnModalLoading(false);
        }
    };

    const submitSalesInvoiceReturn = async () => {
        if (!returnModalRow || !returnInvoiceDetail?.invoice) return;
        const inv = returnInvoiceDetail.invoice;
        const items = inv.items || [];
        const returnedSoFar = aggregateReturnedQtyByInvoiceLine(returnHistory);
        const lines = [];
        for (const it of items) {
            const id = String(it.id);
            const raw = String(returnLineQty[id] ?? '').trim();
            if (!raw) continue;
            const q = Number(raw);
            if (!Number.isFinite(q) || q <= 0) {
                setReturnModalErr(`Invalid qty for ${it.productName || 'line'}.`);
                return;
            }
            const orig = Number(it.qty);
            const already = returnedSoFar.get(id) || 0;
            const remaining = Math.max(0, orig - already);
            if (q > remaining + 1e-6) {
                setReturnModalErr(
                    `Cannot return ${q} of "${it.productName}" — only ${remaining.toFixed(
                        4,
                    )} left on this invoice line.`,
                );
                return;
            }
            const rs = String(returnLineReason[id] ?? '').trim();
            lines.push({
                invoiceItemId: id,
                qtyReturned: q,
                ...(rs ? { reason: rs } : {}),
            });
        }
        if (!lines.length) {
            setReturnModalErr('Enter a return quantity on at least one line.');
            return;
        }
        setReturnSubmitting(true);
        setReturnModalErr('');
        try {
            await createSupplierInvoiceReturn(returnModalRow.id, {
                lines,
                ...(returnNotes.trim() ? { notes: returnNotes.trim() } : {}),
            });
            await loadInvoiceList({ silent: true });
            setReturnSubmitting(false);
            closeReturnModal();
        } catch (err) {
            console.error('Create return failed:', err);
            setReturnModalErr(err?.message || 'Could not save return.');
        } finally {
            setReturnSubmitting(false);
        }
    };

    const openMarkPaidModal = async (row) => {
        setMarkPaidModalRow(row);
        setMarkPaidMethod('bank_transfer');
        setMarkPaidModalErr('');
        setMarkPaidAccounts([]);
        const invoiceAcc = String(row.cashBankAccount || '').trim();
        let choice = '';
        let customAcc = '';
        try {
            const res = await listSupplierCashBankAccounts();
            const list = extractSupplierAccountsPayload(res)
                .map(mapSupplierCashBankAccountForPickers)
                .filter(Boolean);
            setMarkPaidAccounts(list);
            if (invoiceAcc) {
                const exact = list.find(
                    (a) =>
                        a.cashBankLabel === invoiceAcc ||
                        a.nameBase === invoiceAcc ||
                        String(a.raw?.name || '').trim() === invoiceAcc,
                );
                if (exact) {
                    choice = String(exact.id);
                } else {
                    const partial = list.find(
                        (a) =>
                            a.optionLabel.includes(invoiceAcc) ||
                            invoiceAcc.includes(a.nameBase) ||
                            String(a.raw?.name || '')
                                .trim()
                                .includes(invoiceAcc),
                    );
                    if (partial) choice = String(partial.id);
                }
            }
            if (!choice && list.length === 1) {
                choice = String(list[0].id);
            }
            if (list.length === 0) {
                choice = '__custom__';
                customAcc = invoiceAcc;
            }
        } catch {
            setMarkPaidAccounts([]);
            choice = '__custom__';
            customAcc = invoiceAcc;
        }
        setMarkPaidCustomAccount(customAcc);
        setMarkPaidAccountChoice(choice);
    };

    const closeMarkPaidModal = () => {
        if (markPaidModalBusy) return;
        setMarkPaidModalRow(null);
        setMarkPaidModalErr('');
    };

    const confirmMarkPaid = async () => {
        if (!markPaidModalRow) return;
        const methodTrim = String(markPaidMethod || '').trim();
        let accountLabel = '';
        if (markPaidAccountChoice === '__custom__') {
            accountLabel = markPaidCustomAccount.trim();
        } else if (markPaidAccountChoice) {
            const ac = markPaidAccounts.find((a) => String(a.id) === String(markPaidAccountChoice));
            accountLabel = String(ac?.cashBankLabel || ac?.optionLabel || ac?.nameBase || '').trim();
        }
        if (!methodTrim) {
            setMarkPaidModalErr('Select a payment method.');
            return;
        }
        if (!accountLabel) {
            setMarkPaidModalErr('Select receiving account or enter a custom account name.');
            return;
        }
        setMarkPaidModalBusy(true);
        setMarkPaidModalErr('');
        try {
            await applyPaymentPatch(
                markPaidModalRow,
                {
                    paymentStatus: 'paid',
                    paymentMethod: methodTrim,
                    cashBankAccount: accountLabel,
                },
                { showAlert: false },
            );
            setMarkPaidModalRow(null);
        } catch (err) {
            setMarkPaidModalErr(err?.message || 'Could not record payment.');
        } finally {
            setMarkPaidModalBusy(false);
        }
    };

    /** Stock-balances row wins once loaded so Last Sale shows date / buyer after inventory fetch (incl. edit). */
    const lastSaleHintForLine = useCallback(
        (line) => {
            if (line.supplierProductId) {
                const inv = inventoryItems.find(
                    (x) => String(x.id) === String(line.supplierProductId),
                );
                if (inv) {
                    return {
                        hasPrev: !!inv.hasPreviousSale,
                        price: Number(inv.lastPrice ?? 0),
                        meta: String(inv.lastSaleMeta || '').trim(),
                    };
                }
            }
            return {
                hasPrev: !!line.hasPreviousSale,
                price: Number(line.lastSalePrice ?? 0),
                meta: String(line.lastSaleMeta || '').trim(),
            };
        },
        [inventoryItems],
    );

    const list = invoices || [];
    const invoiceListTotalPages = Math.max(
        1,
        Math.ceil(invoiceListTotal / SALES_INVOICE_PAGE_SIZE) || 1,
    );
    const invoiceRangeStart =
        list.length === 0 ? 0 : (invoiceListPage - 1) * SALES_INVOICE_PAGE_SIZE + 1;
    const invoiceRangeEnd =
        list.length === 0
            ? 0
            : (invoiceListPage - 1) * SALES_INVOICE_PAGE_SIZE + list.length;

    useEffect(() => {
        if (!modalOpen || !showDropdown) return undefined;
        const onDocMouseDown = (e) => {
            const el = invoiceLineSearchWrapRef.current;
            if (el && !el.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
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

    const applyCatalogItemToLine = (lineId, catalogItem) => {
        const unitPrice = Number(catalogItem.price) || 0;
        const hasPrev = !!catalogItem.hasPreviousSale;
        const lastSaleAmt = hasPrev ? Number(catalogItem.lastPrice ?? 0) : 0;
        const catId =
            catalogItem.catalogProductResolved &&
            catalogItem.id != null &&
            String(catalogItem.id).trim() !== ''
                ? String(catalogItem.id)
                : '';
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;

                const raw = {
                    ...line,
                    sku: catalogItem.sku || '',
                    item: catalogItem.name,
                    uom: catalogItem.unit || line.uom || 'pcs',
                    price: unitPrice,

                    supplierStockProductId:
                        catalogItem.supplierStockProductId ??
                        line.supplierStockProductId ??
                        null,

                    supplierProductId:
                        catId || line.supplierProductId || '',

                    hasPreviousSale: hasPrev,

                    lastSalePrice: hasPrev
                        ? lastSaleAmt
                        : Number(line.lastSalePrice ?? 0),

                    lastSaleMeta: hasPrev
                        ? String(catalogItem.lastSaleMeta || '').trim()
                        : '',
                };

                return applyLineTotals(raw, amountsTaxInclusive);
            }),
        );

        setItemPickerLineId(null);
        setItemPickerInput('');
        setItemPickerFilter('');
    };

    useEffect(() => {
        let cancelled = false;
        const branchesErrDefault =
            'Could not load workshop branches. Check that the app points at your backend (see api.js BASE_URL) and you are logged in as a supplier user.';

        const load = async () => {
            setListLoading(true);
            setListError('');
            try {
                const [stockRes, branchesRes, invRes] = await Promise.all([
                    getSupplierInventoryStockBalances({ limit: 200 }),
                    getSupplierSalesInvoiceCustomerBranches().catch((be) => {
                        console.error('Supplier customer-branches failed:', be);
                        return { __error: be, branches: [] };
                    }),
                    listSupplierInvoices({
                        limit: SALES_INVOICE_PAGE_SIZE,
                        offset: 0,
                    }).catch((e) => {
                        console.error('List supplier invoices failed:', e);
                        return { __error: e };
                    }),
                ]);

                if (cancelled) return;

                const stockItems = Array.isArray(stockRes?.items)
                    ? stockRes.items.map((raw) => normalizeStockCatalogRow(raw))
                    : [];

                let branchesErr = '';
                let custBranches = [];
                if (branchesRes && branchesRes.__error) {
                    branchesErr =
                        branchesRes.__error?.message ||
                        (typeof branchesRes.__error === 'string'
                            ? branchesRes.__error
                            : branchesErrDefault);
                    custBranches = [];
                } else {
                    custBranches = Array.isArray(branchesRes?.branches) ? branchesRes.branches : [];
                }

                setCustomerBranchesLoadError(branchesErr);
                setInventoryItems(mergeInventoryLists(stockItems, INVENTORY_ITEMS));
                if (custBranches.length) {
                    setBranches(
                        custBranches.map((b) => {
                            const noBranch = !!b.noBranch;
                            const bid = b.branchId ?? b.branch_id ?? b.id;
                            const branchVal =
                                bid != null && bid !== '' ? String(bid) : '';
                            const workshopIdStr =
                                b.workshopId != null && b.workshopId !== ''
                                    ? String(b.workshopId)
                                    : '';
                            return {
                                /** Stable React key; real branch id when selectable */
                                id: noBranch
                                    ? `no-branch-${workshopIdStr || 'x'}`
                                    : branchVal,
                                value: noBranch ? '' : branchVal,
                                name: b.name,
                                label:
                                    b.label ||
                                    `${b.workshopName || ''} — ${b.name || ''}`.trim(),
                                noBranch,
                            };
                        }),
                    );
                } else {
                    setBranches([]);
                }

                if (invRes && invRes.__error) {
                    setListError(invRes.__error?.message || 'Failed to load invoices.');
                    setInvoices([]);
                    setInvoiceListTotal(0);
                    setInvoiceListPage(1);
                } else {
                    setListError('');
                    setInvoices(mapSupplierInvoicesListFromResponse(invRes));
                    setInvoiceListTotal(Number(invRes?.total ?? 0));
                    setInvoiceListPage(1);
                }
            } catch (err) {
                console.error('Supplier sales invoices bootstrap failed:', err);
                if (!cancelled) {
                    setListError(err?.message || 'Failed to load.');
                    setInvoices([]);
                    setInvoiceListTotal(0);
                    setInvoiceListPage(1);
                }
            } finally {
                if (!cancelled) {
                    setListLoading(false);
                    setInventoryInitialLoadDone(true);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    /** Fresh stock + last-sale hints when opening the invoice modal or changing customer branch (no full page reload). */
    useEffect(() => {
        if (!modalOpen || !inventoryInitialLoadDone) return undefined;
        let cancelled = false;
        const params = { limit: 200 };
        const bid = String(branch ?? '').trim();
        if (bid) {
            params.branchId = bid;
        }
        const run = async () => {
            setLastSaleStockRefreshing(true);
            try {
                const stockRes = await getSupplierInventoryStockBalances(params);
                if (cancelled) return;
                const normalized = Array.isArray(stockRes?.items)
                    ? stockRes.items.map((raw) => normalizeStockCatalogRow(raw))
                    : [];
                setInventoryItems((prev) => mergeInventoryLists(normalized, INVENTORY_ITEMS));
                setLineItems((prev) =>
                    prev.map((line) => {
                        if (!line.supplierProductId) return line;
                        const inv = normalized.find(
                            (x) => String(x.id) === String(line.supplierProductId),
                        );
                        if (!inv) return line;
                        const hasPrev = !!inv.hasPreviousSale;
                        return applyLineTotals(
                            {
                                ...line,
                                hasPreviousSale: hasPrev,
                                lastSalePrice: hasPrev ? Number(inv.lastPrice ?? 0) : 0,
                                lastSaleMeta: hasPrev
                                    ? String(inv.lastSaleMeta || '').trim()
                                    : '',
                            },
                            amountsTaxInclusiveRef.current,
                        );
                    }),
                );
            } catch (err) {
                if (!cancelled) {
                    console.error('Sales invoice last-sale refresh failed:', err);
                }
            } finally {
                if (!cancelled) {
                    setLastSaleStockRefreshing(false);
                }
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [modalOpen, inventoryInitialLoadDone, branch]);

    useEffect(() => {
        if (!modalOpen) {
            setLastSaleStockRefreshing(false);
        }
    }, [modalOpen]);

    useEffect(() => {
        const fromAlert = location.state?.[SALES_INVOICE_FROM_ALERT_KEY];
        if (fromAlert && typeof fromAlert === 'object') {
            navigate(location.pathname + location.search, { replace: true, state: {} });
            const line = fromAlert.line;
            salesInvoiceAlertLinePresetRef.current =
                line && typeof line === 'object' ? line : null;
            setInvoiceModalMode('create');
            setEditingInvoiceId(null);
            resetInvoiceForm();
            const bid = fromAlert.branchId;
            if (bid != null && String(bid).trim() !== '') {
                setBranch(String(bid));
            }
            setModalOpen(true);
            return;
        }
        try {
            if (sessionStorage.getItem('supplier_open_new_sales_invoice') === '1') {
                sessionStorage.removeItem('supplier_open_new_sales_invoice');
                const presetBranch = sessionStorage.getItem(
                    'supplier_sales_invoice_preset_branch_id',
                );
                if (presetBranch) {
                    sessionStorage.removeItem('supplier_sales_invoice_preset_branch_id');
                }
                let legacyLine = null;
                const rawLine = sessionStorage.getItem(SI_PRESET_LINE_KEY) || '';
                if (rawLine) {
                    sessionStorage.removeItem(SI_PRESET_LINE_KEY);
                    try {
                        legacyLine = JSON.parse(rawLine);
                    } catch {
                        legacyLine = null;
                    }
                }
                salesInvoiceAlertLinePresetRef.current =
                    legacyLine && typeof legacyLine === 'object' ? legacyLine : null;
                setInvoiceModalMode('create');
                setEditingInvoiceId(null);
                resetInvoiceForm();
                if (presetBranch) {
                    setBranch(String(presetBranch));
                }
                setModalOpen(true);
            }
        } catch {
            /* ignore */
        }
    }, [location.state, location.pathname, location.search, navigate]);

    useEffect(() => {
        if (!modalOpen || !inventoryInitialLoadDone) return;
        if (invoiceModalMode !== 'create' || editingInvoiceId != null) return;

        let preset = null;
        if (salesInvoiceAlertLinePresetRef.current) {
            preset = salesInvoiceAlertLinePresetRef.current;
            salesInvoiceAlertLinePresetRef.current = null;
        } else {
            let raw = '';
            try {
                raw = sessionStorage.getItem(SI_PRESET_LINE_KEY) || '';
            } catch {
                return;
            }
            if (!raw) return;
            try {
                preset = JSON.parse(raw);
            } catch {
                sessionStorage.removeItem(SI_PRESET_LINE_KEY);
                return;
            }
            sessionStorage.removeItem(SI_PRESET_LINE_KEY);
        }

        if (!preset || typeof preset !== 'object') return;
        const nameTrim = String(preset.productName ?? preset.name ?? '').trim();
        if (!nameTrim) return;

        const sid =
            preset.supplierProductId != null &&
            String(preset.supplierProductId).trim() !== ''
                ? String(preset.supplierProductId).trim()
                : '';
        let match = sid
            ? inventoryItems.find((i) => String(i.id) === sid)
            : null;
        if (!match) {
            const pname = nameTrim.toLowerCase();
            const skuNorm = String(preset.sku || '').trim().toLowerCase();
            match = inventoryItems.find(
                (i) =>
                    String(i.name || '').trim().toLowerCase() === pname &&
                    (!skuNorm ||
                        String(i.sku || '').trim().toLowerCase() === skuNorm),
            );
        }
        if (!match) {
            match = inventoryItems.find(
                (i) =>
                    String(i.name || '').trim().toLowerCase() ===
                    nameTrim.toLowerCase(),
            );
        }
        if (match) {
            addItemToLines(match);
        } else {
            addItemToLines({
                name: nameTrim,
                sku: String(preset.sku || '').trim(),
                unit: String(preset.unit || 'pcs').trim() || 'pcs',
                price: 0,
                lastPrice: 0,
            });
        }
    }, [
        modalOpen,
        inventoryInitialLoadDone,
        invoiceModalMode,
        editingInvoiceId,
        inventoryItems,
        addItemToLines,
    ]);

    return (
        <div>
            <div
                style={{
                    padding: 14,
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 12,
                    marginBottom: 20,
                    fontSize: '0.875rem',
                    color: '#1E40AF',
                }}
            >
                <strong>Sales Invoices</strong> — issued when warehouse/supplier sends products TO a workshop. This
                creates an <strong>Accounts Receivable</strong> for you and auto-creates a{' '}
                <strong>Purchase Invoice</strong> on the workshop side. Stock is updated on both ends.
            </div>
            <div
                style={{
                    margin: '0 0 12px',
                    padding: 10,
                    fontSize: '0.75rem',
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    color: '#065F46',
                    borderRadius: 8,
                    fontWeight: 600,
                }}
            >
                Auto-posted to the supplier <strong>General Ledger</strong> on save: AR/Sales/VAT plus moving-average
                COGS. View entries under Accounting → Journal Log or the per-account ledger.
            </div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Sales Invoices (AR)</h2>
                    <p className="ws-page-sub">Warehouse → Workshop invoices</p>
                </div>
                <button
                    className="btn-portal"
                    style={{ background: '#2563EB', color: '#fff', border: 'none' }}
                    onClick={openNewInvoiceModal}
                >
                    <Plus size={15} /> New Invoice
                </button>
            </div>
            {listError ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 12,
                        padding: 12,
                        fontSize: '0.8125rem',
                        color: '#B91C1C',
                        border: '1px solid #FECACA',
                        background: '#FEF2F2',
                    }}
                >
                    {listError}
                </div>
            ) : null}
            <div className="ws-section">
                <div style={{ overflowX: 'auto' }}>
                    {listLoading && list.length === 0 ? (
                        <ShimmerTable rows={8} columns={13} />
                    ) : (
                        <>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Workshop / Branch</th>
                                    <th>Date</th>
                                    <th>Due Date</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Balance</th>
                                    <th>Status</th>
                                    <th>AR</th>
                                    <th>Cash / Bank</th>
                                    <th>Freight</th>
                                    <th>Discount</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!listLoading && list.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={13}
                                            style={{
                                                textAlign: 'center',
                                                padding: 40,
                                                color: 'var(--color-text-muted)',
                                            }}
                                        >
                                            <FileText
                                                size={40}
                                                style={{
                                                    opacity: 0.25,
                                                    margin: '0 auto 12px',
                                                    display: 'block',
                                                }}
                                            />
                                            <div style={{ fontWeight: 600, marginBottom: 8 }}>
                                                No sales invoices yet
                                            </div>
                                            <div style={{ fontSize: '0.8125rem', marginBottom: 16 }}>
                                                Issue a warehouse → workshop invoice; it will appear in this table.
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-portal"
                                                style={{
                                                    background: '#2563EB',
                                                    color: '#fff',
                                                    border: 'none',
                                                }}
                                                onClick={openNewInvoiceModal}
                                            >
                                                <Plus size={15} /> Create first invoice
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    list.map((inv) => {
                                        const canMutate = inv.status === 'pending_payment';
                                        const statusLabel = String(inv.status || '')
                                            .replace(/_/g, ' ')
                                            .trim();
                                        const arSettle = salesInvoiceArSettlementLabel(inv);
                                        return (
                                            <tr key={inv.id}>
                                                <td>
                                                    <strong style={{ color: '#2563EB' }}>
                                                        {inv.invoiceNo || inv.id}
                                                    </strong>
                                                </td>
                                                <td
                                                    style={{
                                                        fontSize: '0.8125rem',
                                                        color: 'var(--color-text-muted)',
                                                        maxWidth: 220,
                                                    }}
                                                    title={
                                                        inv.workshopName
                                                            ? `${inv.workshopName} — ${inv.branch}`
                                                            : inv.branch
                                                    }
                                                >
                                                    {inv.workshopName
                                                        ? `${inv.workshopName} — ${inv.branch}`
                                                        : inv.branch || '—'}
                                                </td>
                                                <td style={{ fontSize: '0.8125rem' }}>{inv.date || '—'}</td>
                                                <td style={{ fontSize: '0.8125rem' }}>{inv.dueDate || '—'}</td>
                                                <td
                                                    style={{
                                                        fontWeight: 700,
                                                    }}
                                                >
                                                    SAR {(inv.amount || 0).toLocaleString()}
                                                </td>
                                                <td style={{ color: '#0f766e', fontWeight: 600 }}>
                                                    SAR {(inv.paid || 0).toLocaleString()}
                                                </td>
                                                <td style={{ color: '#b91c1c', fontWeight: 700 }}>
                                                    <span>
                                                        SAR {(inv.balance || 0).toLocaleString()}
                                                    </span>
                                                    {Number(inv.returnsTotal || 0) > 0 ? (
                                                        <div
                                                            style={{
                                                                fontSize: '0.65rem',
                                                                fontWeight: 600,
                                                                color: '#C2410C',
                                                                marginTop: 2,
                                                            }}
                                                        >
                                                            − SAR{' '}
                                                            {Number(inv.returnsTotal || 0).toLocaleString()} returns
                                                        </div>
                                                    ) : null}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`ws-badge ws-badge--${
                                                            inv.status === 'paid'
                                                                ? 'green'
                                                                : inv.status === 'overdue'
                                                                  ? 'red'
                                                                  : inv.status === 'partially_paid'
                                                                    ? 'yellow'
                                                                    : 'yellow'
                                                        }`}
                                                    >
                                                        {statusLabel || 'pending payment'}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.8125rem', minWidth: 120 }}>
                                                    <span
                                                        className={`ws-badge ws-badge--${
                                                            arSettle.tone === 'green' ? 'green' : 'yellow'
                                                        }`}
                                                    >
                                                        {arSettle.text}
                                                    </span>
                                                    {arSettle.text !== 'Paid' && canMutate ? (
                                                        <button
                                                            type="button"
                                                            className="btn-portal-outline"
                                                            style={{
                                                                display: 'block',
                                                                marginTop: 6,
                                                                fontSize: 11,
                                                                padding: '4px 8px',
                                                            }}
                                                            onClick={() => void openMarkPaidModal(inv)}
                                                        >
                                                            Record payment
                                                        </button>
                                                    ) : null}
                                                </td>
                                                <td
                                                    style={{
                                                        fontSize: '0.8125rem',
                                                        maxWidth: 140,
                                                        color: 'var(--color-text-body)',
                                                    }}
                                                    title={inv.cashBankAccount || ''}
                                                >
                                                    {inv.cashBankAccount ? (
                                                        <span
                                                            style={{
                                                                display: 'block',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {inv.cashBankAccount}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{ fontSize: '0.8125rem' }}>
                                                    SAR {(inv.freightIn || 0).toLocaleString()}
                                                </td>
                                                <td style={{ fontSize: '0.8125rem' }}>
                                                    SAR {(inv.invoiceDiscount || 0).toLocaleString()}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewInvoice(inv)}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: '#F3F4F6',
                                                                cursor: 'pointer',
                                                            }}
                                                            title="View"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={salesInvoicePdfBusy}
                                                            onClick={() => handleDownloadInvoice(inv)}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background:
                                                                    salesInvoicePdfBusy ? '#E5E7EB' : '#F3F4F6',
                                                                cursor:
                                                                    salesInvoicePdfBusy ? 'not-allowed' : 'pointer',
                                                            }}
                                                            title="Download PDF"
                                                        >
                                                            <Download size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openReturnModal(inv)}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: '#FFF7ED',
                                                                color: '#C2410C',
                                                                cursor: 'pointer',
                                                            }}
                                                            title="Record return / credit"
                                                        >
                                                            <RotateCcw size={14} />
                                                        </button>
                                                        {/* <button
                                                            type="button"
                                                            disabled={!canMutate}
                                                            onClick={() => openEditInvoice(inv)}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: canMutate ? '#E0E7FF' : '#F3F4F6',
                                                                color: canMutate ? '#4338CA' : '#94A3B8',
                                                                cursor: canMutate ? 'pointer' : 'not-allowed',
                                                                opacity: canMutate ? 1 : 0.6,
                                                            }}
                                                            title="Edit"
                                                        >
                                                            <Pencil size={14} />
                                                        </button> */}
                                                        {/* <button
                                                            type="button"
                                                            disabled={!canMutate}
                                                            onClick={() => handleDeleteInvoice(inv)}
                                                            style={{
                                                                padding: 6,
                                                                borderRadius: 6,
                                                                border: 'none',
                                                                background: canMutate ? '#FEE2E2' : '#F3F4F6',
                                                                color: canMutate ? '#DC2626' : '#94A3B8',
                                                                cursor: canMutate ? 'pointer' : 'not-allowed',
                                                                opacity: canMutate ? 1 : 0.6,
                                                            }}
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button> */}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        {!listLoading && invoiceListTotal > 0 && invoiceListTotalPages > 1 ? (
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 12,
                                    marginTop: 16,
                                    paddingBottom: 4,
                                }}
                            >
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={listLoading || invoiceListPage <= 1}
                                    onClick={() =>
                                        loadInvoiceList({ page: invoiceListPage - 1 })
                                    }
                                >
                                    Previous
                                </button>
                                <span
                                    style={{
                                        fontSize: '0.8125rem',
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                    Page {invoiceListPage} of {invoiceListTotalPages}
                                    {invoiceListTotal > 0
                                        ? ` · ${invoiceRangeStart}–${invoiceRangeEnd} of ${invoiceListTotal}`
                                        : ''}
                                </span>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={
                                        listLoading ||
                                        invoiceListPage >= invoiceListTotalPages
                                    }
                                    onClick={() =>
                                        loadInvoiceList({ page: invoiceListPage + 1 })
                                    }
                                >
                                    Next
                                </button>
                            </div>
                        ) : null}
                        </>
                    )}
                </div>
            </div>
            <AnimatePresence>
                {modalOpen && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">
                                    Sales Invoices ›{' '}
                                    <span className="pi-b-active">
                                        {invoiceModalMode === 'edit' ? 'Edit' : 'New'}
                                    </span>
                                </span>
                                <div className="pi-title-main">
                                    <FileText size={24} />
                                    <span>Sales Invoice (Warehouse — Workshop)</span>
                                </div>
                            </div>
                        }
                        onClose={closeInvoiceModal}
                        width="1350px"
                        contentClassName="modal-content-purchase"
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button
                                        className="btn-pi-cancel"
                                        onClick={closeInvoiceModal}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button
                                        className="btn-pi-create"
                                        onClick={handleSaveInvoice}
                                        disabled={
                                            saving ||
                                            editInvoiceLoading ||
                                            !branch ||
                                            lineItems.length === 0 ||
                                            (invoiceModalMode === 'create' &&
                                                !inventoryInitialLoadDone)
                                        }
                                    >
                                        {saving
                                            ? 'Saving…'
                                            : invoiceModalMode === 'edit'
                                              ? 'Update Invoice'
                                              : 'Issue Sales Invoice'}
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        <div className="pi-form-container">
                            {(invoiceModalMode === 'create' && !inventoryInitialLoadDone) ||
                            (invoiceModalMode === 'edit' && editInvoiceLoading) ? (
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
                                        {invoiceModalMode === 'edit'
                                            ? 'Loading invoice…'
                                            : 'Loading warehouse catalog and branches…'}
                                    </p>
                                </div>
                            ) : (
                                <>
                            {saveError ? (
                                <div
                                    style={{
                                        marginBottom: 12,
                                        padding: 10,
                                        borderRadius: 8,
                                        fontSize: '0.8125rem',
                                        color: '#B91C1C',
                                        border: '1px solid #FECACA',
                                        background: '#FEF2F2',
                                    }}
                                >
                                    {saveError}
                                </div>
                            ) : null}
                            <div
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    background: '#ECFEFF',
                                    border: '1px solid #A5F3FC',
                                    fontSize: '0.8125rem',
                                    color: '#0369A1',
                                    marginBottom: 16,
                                }}
                            >
                                This creates an <strong>Accounts Receivable</strong> for you (supplier). It will also
                                create a matching <strong>Purchase Invoice</strong> on the workshop side and update stock
                                levels on both ends.
                            </div>

                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Issue date</label>
                                    <div className="pi-input-with-icon">
                                        <input
                                            type="date"
                                            value={issueDate}
                                            onChange={(e) => setIssueDate(e.target.value)}
                                        />
                                        <Calendar size={16} />
                                    </div>
                                </div>
                                <div className="pi-field">
                                    <label>Due date</label>
                                    <div
                                        className={`pi-due-grid ${
                                            dueDateType === 'EOM' ? 'pi-due-eom' : ''
                                        }`}
                                    >
                                        <select
                                            value={dueDateType}
                                            onChange={(e) => setDueDateType(e.target.value)}
                                        >
                                            <option value="Net">Net</option>
                                            <option value="Custom">Custom</option>
                                            <option value="EOM">EOM</option>
                                        </select>
                                        {dueDateType === 'Net' && (
                                            <div className="pi-days-input">
                                                <input
                                                    type="number"
                                                    value={netDays}
                                                    onChange={(e) => setNetDays(e.target.value)}
                                                />
                                                <span>days</span>
                                            </div>
                                        )}
                                        {dueDateType === 'Custom' && (
                                            <div className="pi-date-input-small">
                                                <input
                                                    type="date"
                                                    value={customDueDate}
                                                    onChange={(e) => setCustomDueDate(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                                </div>
                                <div className="pi-field">
                                    <label>
                                        {invoiceModalMode === 'edit' ? 'Invoice #' : 'Ref # (Optional)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ref #"
                                        value={refNo}
                                        readOnly={invoiceModalMode === 'edit'}
                                        onChange={(e) => setRefNo(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="pi-header-grid">
                                <div className="pi-field">
                                    <label>Workshop Branch (Customer) *</label>
                                    <select
                                        value={branch}
                                        disabled={invoiceModalMode === 'edit'}
                                        onChange={(e) => setBranch(e.target.value)}
                                    >
                                        <option value="">Select workshop / branch</option>
                                        {(branches || []).map((b) => (
                                            <option
                                                key={b.id}
                                                value={b.noBranch ? '' : String(b.value ?? b.id)}
                                                disabled={!!b.noBranch}
                                            >
                                                {b.label || b.name}
                                            </option>
                                        ))}
                                    </select>
                                    {!listLoading && customerBranchesLoadError ? (
                                        <span
                                            className="pi-sub-label"
                                            style={{ color: '#B91C1C', marginTop: 6, display: 'block' }}
                                        >
                                            {customerBranchesLoadError}
                                        </span>
                                    ) : null}
                                    {!listLoading &&
                                    !customerBranchesLoadError &&
                                    branches.length === 0 ? (
                                        <span
                                            className="pi-sub-label"
                                            style={{ color: '#B45309', marginTop: 6, display: 'block' }}
                                        >
                                            No workshop branches returned. Ensure workshops exist and each has at least
                                            one branch that is not rejected. If this persists, check your connection and
                                            backend logs.
                                        </span>
                                    ) : null}
                                </div>
                                <div className="pi-field">
                                    <label>Cash / Bank Account</label>
                                    <select
                                        value={cashAccount}
                                        onChange={(e) => setCashAccount(e.target.value)}
                                    >
                                        <option value="">Select account</option>
                                        {CASH_ACCOUNTS.map((a) => (
                                            <option key={a} value={a}>
                                                {a}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pi-field pi-full-width">
                                <label>Description</label>
                                <input
                                    type="text"
                                    placeholder="Invoice description (optional)"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>

                            <div className="pi-lines-section">
                                <div
                                    className="pi-lines-header"
                                    style={{ gridTemplateColumns: getGridColumns() }}
                                >
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
                                    <div className="pi-col-total">Last Sale Price</div>
                                    <div aria-hidden />
                                </div>

                                {lineItems.map((line, idx) => {
                                    const maxQtyWs = maxSellableQtyWorkshopForLine(
                                        line,
                                        lineItems,
                                        inventoryItems,
                                    );
                                    return (
                                    <div
                                        key={line.id}
                                        className="pi-lines-header pi-line-data-row"
                                        style={{ gridTemplateColumns: getGridColumns() }}
                                    >
                                        {showLineNum && (
                                            <div className="pi-col-hash">{idx + 1}</div>
                                        )}
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
                                                            itemPickerLineId ===
                                                            line.id
                                                                ? itemPickerInput
                                                                : (line.item ??
                                                                  '')
                                                        }
                                                        placeholder="Select item…"
                                                        onFocus={() => {
                                                            setItemPickerLineId(
                                                                line.id,
                                                            );
                                                            setItemPickerInput(
                                                                String(
                                                                    line.item ??
                                                                        '',
                                                                ),
                                                            );
                                                            setItemPickerFilter(
                                                                '',
                                                            );
                                                        }}
                                                        onChange={(e) => {
                                                            const v =
                                                                e.target.value;
                                                            setItemPickerLineId(
                                                                line.id,
                                                            );
                                                            setItemPickerInput(
                                                                v,
                                                            );
                                                            setItemPickerFilter(
                                                                v,
                                                            );
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                    'Escape' ||
                                                                e.key === 'Enter'
                                                            ) {
                                                                e.preventDefault();
                                                                const text =
                                                                    String(
                                                                        itemPickerInputRef.current ??
                                                                            '',
                                                                    ).trim();
                                                                setLineItems(
                                                                    (prev) =>
                                                                        prev.map(
                                                                            (
                                                                                l,
                                                                            ) =>
                                                                                l.id ===
                                                                                line.id
                                                                                    ? {
                                                                                          ...l,
                                                                                          item: text,
                                                                                      }
                                                                                    : l,
                                                                        ),
                                                                );
                                                                setItemPickerLineId(
                                                                    null,
                                                                );
                                                                setItemPickerInput(
                                                                    '',
                                                                );
                                                                setItemPickerFilter(
                                                                    '',
                                                                );
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        title="Show item list"
                                                        aria-label="Open item list"
                                                        onMouseDown={(e) =>
                                                            e.preventDefault()
                                                        }
                                                        onClick={() => {
                                                            if (
                                                                itemPickerLineId ===
                                                                line.id
                                                            ) {
                                                                const text =
                                                                    String(
                                                                        itemPickerInputRef.current ??
                                                                            '',
                                                                    ).trim();
                                                                setLineItems(
                                                                    (prev) =>
                                                                        prev.map(
                                                                            (
                                                                                l,
                                                                            ) =>
                                                                                l.id ===
                                                                                line.id
                                                                                    ? {
                                                                                          ...l,
                                                                                          item: text,
                                                                                      }
                                                                                    : l,
                                                                        ),
                                                                );
                                                                setItemPickerLineId(
                                                                    null,
                                                                );
                                                                setItemPickerInput(
                                                                    '',
                                                                );
                                                                setItemPickerFilter(
                                                                    '',
                                                                );
                                                            } else {
                                                                setItemPickerLineId(
                                                                    line.id,
                                                                );
                                                                setItemPickerInput(
                                                                    String(
                                                                        line.item ??
                                                                            '',
                                                                    ),
                                                                );
                                                                setItemPickerFilter(
                                                                    '',
                                                                );
                                                            }
                                                        }}
                                                        style={{
                                                            flex: '0 0 auto',
                                                            display: 'flex',
                                                            alignItems:
                                                                'center',
                                                            justifyContent:
                                                                'center',
                                                            padding: '0 8px',
                                                            borderRadius: 8,
                                                            border: '1px solid #e2e8f0',
                                                            background:
                                                                '#f8fafc',
                                                            cursor: 'pointer',
                                                            color: '#475569',
                                                        }}
                                                    >
                                                        <ChevronDown
                                                            size={16}
                                                        />
                                                    </button>
                                                </div>
                                                {itemPickerLineId ===
                                                line.id ? (
                                                    <div
                                                        className="pi-search-results"
                                                        style={{
                                                            position:
                                                                'absolute',
                                                            left: 0,
                                                            right: 0,
                                                            top: 'calc(100% + 4px)',
                                                            zIndex: 50,
                                                            maxHeight: 240,
                                                            overflowY: 'auto',
                                                            boxShadow:
                                                                '0 10px 25px rgba(15,23,42,0.12)',
                                                        }}
                                                    >
                                                        {(() => {
                                                            const pickerRows =
                                                                getSearchSuggestions(
                                                                    itemPickerFilter,
                                                                );
                                                            return pickerRows.length ? (
                                                                pickerRows.map(
                                                                    (
                                                                        invItem,
                                                                        i,
                                                                    ) => (
                                                                        <div
                                                                            key={`${line.id}-${String(invItem.id)}-${i}`}
                                                                            className="pi-result-item"
                                                                            onMouseDown={(
                                                                                ev,
                                                                            ) => {
                                                                                ev.preventDefault();
                                                                                applyCatalogItemToLine(
                                                                                    line.id,
                                                                                    invItem,
                                                                                );
                                                                            }}
                                                                        >
                                                                            <div className="pi-result-info">
                                                                                <div className="pi-item-name">
                                                                                    {
                                                                                        invItem.name
                                                                                    }
                                                                                </div>
                                                                                <div
                                                                                    className="pi-item-meta"
                                                                                    style={{
                                                                                        flexDirection:
                                                                                            'column',
                                                                                        alignItems:
                                                                                            'flex-start',
                                                                                        gap: 4,
                                                                                    }}
                                                                                >
                                                                                    <span
                                                                                        style={{
                                                                                            display:
                                                                                                'flex',
                                                                                            gap: 8,
                                                                                            flexWrap:
                                                                                                'wrap',
                                                                                        }}
                                                                                    >
                                                                                        <span className="pi-item-type">
                                                                                            {invItem.itemType ||
                                                                                                'Product'}
                                                                                        </span>
                                                                                        {invItem.unit ? (
                                                                                            <span>
                                                                                                •{' '}
                                                                                                {
                                                                                                    invItem.unit
                                                                                                }
                                                                                            </span>
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
                                                                                            {
                                                                                                invItem.stockHint
                                                                                            }
                                                                                        </span>
                                                                                    ) : null}
                                                                                </div>
                                                                            </div>
                                                                            <div className="pi-item-price">
                                                                                <div className="pi-price-val">
                                                                                    SAR{' '}
                                                                                    {Number(
                                                                                        invItem.price ||
                                                                                            0,
                                                                                    ).toLocaleString()}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ),
                                                                )
                                                            ) : (
                                                                <div
                                                                    style={{
                                                                        padding: 14,
                                                                        fontSize: 13,
                                                                        color: '#64748b',
                                                                    }}
                                                                >
                                                                    {inventoryItems.length ===
                                                                    0
                                                                        ? 'No products loaded.'
                                                                        : 'No matching products.'}
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
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'account',
                                                        e.target.value
                                                    )
                                                }
                                            >
                                                {ACCOUNT_OPTIONS.map((opt) => (
                                                    <option
                                                        key={opt.code}
                                                        value={`${opt.code} - ${opt.name}`}
                                                    >
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
                                                aria-label={
                                                    maxQtyWs != null &&
                                                    Number.isFinite(maxQtyWs)
                                                        ? `Quantity. Maximum ${maxQtyWs} ${line.uom || 'pcs'} (supplier stock balance).`
                                                        : 'Quantity'
                                                }
                                                value={line.qty}
                                                title={
                                                    maxQtyWs != null &&
                                                    Number.isFinite(maxQtyWs)
                                                        ? `Max ${maxQtyWs} ${line.uom || 'pcs'} — supplier warehouse stock`
                                                        : undefined
                                                }
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'qty',
                                                        e.target.value,
                                                    )
                                                }
                                                onKeyDown={(e) =>
                                                    handleMathKeyDown(e, line.id, 'qty')
                                                }
                                                onBlur={(e) =>
                                                    handleMathBlur(e, line.id, 'qty')
                                                }
                                            />
                                        </div>
                                        <div className="pi-col-price">
                                            <input
                                                type="text"
                                                value={
                                                    line.price === undefined || line.price === null
                                                        ? ''
                                                        : String(line.price)
                                                }
                                                className="pi-row-input-num pi-math-input"
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'price',
                                                        e.target.value,
                                                    )
                                                }
                                                onKeyDown={(e) =>
                                                    handleMathKeyDown(
                                                        e,
                                                        line.id,
                                                        'price',
                                                    )
                                                }
                                                onBlur={(e) =>
                                                    handleMathBlur(e, line.id, 'price')
                                                }
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
                                                        line.discountMode ===
                                                        'fixed_sar'
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
                                                    <option value="percent">
                                                        %
                                                    </option>
                                                    <option value="fixed_sar">
                                                        SAR
                                                    </option>
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
                                            <select
                                                className="pi-row-input"
                                                value={line.taxCode}
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'taxCode',
                                                        e.target.value
                                                    )
                                                }
                                            >
                                                {TAXES.map((t) => (
                                                    <option
                                                        key={t.id}
                                                        value={t.code}
                                                    >
                                                        {t.code}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="pi-col-tamt">
                                            SAR {line.taxAmt}
                                        </div>
                                        <div className="pi-col-total">
                                            SAR {line.totalFinal}
                                        </div>
                                        <div
                                            className="pi-col-total"
                                            style={{
                                                background: '#FFFBEB',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {(() => {
                                                if (
                                                    lastSaleStockRefreshing &&
                                                    line.supplierProductId
                                                ) {
                                                    return (
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 8,
                                                                minHeight: 36,
                                                            }}
                                                        >
                                                            <Loader2
                                                                size={16}
                                                                className="supplier-sales-last-sale-spinner"
                                                                aria-hidden
                                                                style={{
                                                                    color: '#64748b',
                                                                    flexShrink: 0,
                                                                }}
                                                            />
                                                            <span
                                                                style={{
                                                                    fontSize: '0.75rem',
                                                                    color: '#64748b',
                                                                    fontWeight: 500,
                                                                }}
                                                            >
                                                                Loading…
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                                const ls = lastSaleHintForLine(line);
                                                const show =
                                                    ls.hasPrev &&
                                                    Number.isFinite(ls.price) &&
                                                    ls.price > 0;
                                                return show ? (
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: 2,
                                                            lineHeight: 1.2,
                                                        }}
                                                    >
                                                        <span>
                                                            SAR{' '}
                                                            {Number(ls.price).toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 4,
                                                            })}
                                                        </span>
                                                        {ls.meta ? (
                                                            <span
                                                                style={{
                                                                    fontSize: '0.675rem',
                                                                    color: '#475569',
                                                                    fontWeight: 500,
                                                                    whiteSpace: 'normal',
                                                                }}
                                                            >
                                                                {ls.meta}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <span
                                                        style={{
                                                            color: '#64748b',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        No previous sale in selected workshop
                                                    </span>
                                                );
                                            })()}
                                        </div>
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
                                                onClick={() =>
                                                    removeLineItem(line.id)
                                                }
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
                                    );
                                })}

                                <div className="pi-line-row">
                                    <div
                                        ref={invoiceLineSearchWrapRef}
                                        className="pi-search-box-wrapper"
                                        style={{ position: 'relative', flex: 1 }}
                                    >
                                        <div className="pi-search-box">
                                            <Search size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search product to add"
                                                value={searchQuery}
                                                onChange={(e) =>
                                                    applySearchQuery(e.target.value)
                                                }
                                                onKeyDown={handleKeyDown}
                                                onFocus={openInvoiceLineSearch}
                                            />
                                        </div>
                                        {showDropdown ? (
                                            <div className="pi-search-results">
                                                {searchResults.length > 0 ? (
                                                    searchResults.map((item, index) => (
                                                        <div
                                                            key={`${item.id}-${item.name}`}
                                                            className={`pi-result-item ${
                                                                selectedIndex === index
                                                                    ? 'selected'
                                                                    : ''
                                                            }`}
                                                            onClick={() =>
                                                                addItemToLines(item)
                                                            }
                                                            onMouseEnter={() =>
                                                                setSelectedIndex(index)
                                                            }
                                                        >
                                                            <div className="pi-result-info">
                                                                <div className="pi-item-name">
                                                                    {item.name}
                                                                </div>
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
                                                                            {item.itemType ||
                                                                                'Product'}
                                                                        </span>
                                                                        <span>
                                                                            {item.unit
                                                                                ? `• ${item.unit}`
                                                                                : null}
                                                                        </span>
                                                                    </span>
                                                                    {item.stockHint ? (
                                                                        <span
                                                                            style={{
                                                                                fontSize: 11,
                                                                                color: '#64748b',
                                                                                lineHeight: 1.35,
                                                                            }}
                                                                        >
                                                                            {item.stockHint}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                            <div className="pi-item-price">
                                                                <div className="pi-price-val">
                                                                    SAR{' '}
                                                                    {Number(
                                                                        item.price || 0,
                                                                    ).toLocaleString()}
                                                                </div>
                                                                <div className="pi-price-unit">
                                                                    {item.unit
                                                                        ? `per ${item.unit}`
                                                                        : ' '}
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
                                                        {inventoryItems.length === 0
                                                            ? 'No products loaded. Try again later or use “Add line” and type manually.'
                                                            : searchQuery.trim()
                                                              ? 'No matching products.'
                                                              : 'No products available.'}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-add-line"
                                        onClick={addEmptyLine}
                                    >
                                        <Plus size={16} /> Add line
                                    </button>
                                </div>
                                <div className="pi-hint">
                                    <Zap size={14} /> Tip: ↑ ↓ arrows, Enter to select from
                                    search. Price fields support math (e.g. 120*2).
                                </div>
                            </div>

                            <div className="pi-config-row">
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={showLineNum}
                                        onChange={(e) =>
                                            setShowLineNum(e.target.checked)
                                        }
                                    />{' '}
                                    <span>Column — Line number</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={showDesc}
                                        onChange={(e) =>
                                            setShowDesc(e.target.checked)
                                        }
                                    />{' '}
                                    <span>Column — Description</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={showDiscount}
                                        onChange={(e) =>
                                            setShowDiscount(e.target.checked)
                                        }
                                    />{' '}
                                    <span>Column — Discount</span>
                                </label>
                                <label className="pi-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={amountsTaxInclusive}
                                        onChange={(e) =>
                                            setAmountsTaxInclusive(
                                                e.target.checked,
                                            )
                                        }
                                    />{' '}
                                    <span>Amounts are tax inclusive</span>
                                </label>
                            </div>

                            <div className="pi-footer-grid">
                                <div className="pi-footer-column">
                                    <div className="pi-field-inline">
                                        <label>Freight / Other Charges (SAR)</label>
                                        <input
                                            type="text"
                                            value={freightCharges}
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
                                                <option value="percent">
                                                    %
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="pi-field pi-full-width">
                                        <label>Notes</label>
                                        <textarea
                                            placeholder="Internal notes (optional, printed on invoice)"
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
                                                <span>Freight / Other charges:</span>
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
                                    <div
                                        className="pi-ap-alert"
                                        style={{ marginTop: 12 }}
                                    >
                                        <span>
                                            Creates <strong>Accounts Receivable</strong> for
                                            this workshop branch. A linked{' '}
                                            <strong>Purchase Invoice</strong> will appear in
                                            the workshop&apos;s Accounting module.
                                        </span>
                                    </div>
                                </div>
                            </div>
                                </>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {markPaidModalRow && (
                    <Modal
                        title="Record payment"
                        width="min(440px, 96vw)"
                        disableClose={markPaidModalBusy}
                        onClose={closeMarkPaidModal}
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button
                                        type="button"
                                        className="btn-pi-cancel"
                                        onClick={closeMarkPaidModal}
                                        disabled={markPaidModalBusy}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        onClick={confirmMarkPaid}
                                        disabled={
                                            markPaidModalBusy ||
                                            paymentStatusSavingId === markPaidModalRow?.id
                                        }
                                    >
                                        {markPaidModalBusy ? 'Recording…' : 'Confirm paid'}
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        <p style={{ margin: '0 0 14px', fontSize: '0.875rem', color: '#475569' }}>
                            Invoice <strong>{markPaidModalRow.invoiceNo}</strong>
                            {' — '}
                            balance SAR{' '}
                            <strong>{Number(markPaidModalRow.balance || 0).toFixed(2)}</strong>
                        </p>
                        <div className="ws-form-grid">
                            <div className="ws-field">
                                <label htmlFor="mark-paid-method">Payment method *</label>
                                <select
                                    id="mark-paid-method"
                                    value={markPaidMethod}
                                    onChange={(e) => setMarkPaidMethod(e.target.value)}
                                    disabled={markPaidModalBusy}
                                >
                                    {MARK_PAID_METHOD_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label htmlFor="mark-paid-account">
                                    Receiving cash / bank account *
                                </label>
                                <select
                                    id="mark-paid-account"
                                    value={markPaidAccountChoice}
                                    onChange={(e) =>
                                        setMarkPaidAccountChoice(e.target.value)
                                    }
                                    disabled={markPaidModalBusy}
                                >
                                    {markPaidAccounts.length > 0 ? (
                                        <>
                                            <option value="">Select account</option>
                                            {markPaidAccounts.map((acc) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.optionLabel}
                                                </option>
                                            ))}
                                            <option value="__custom__">
                                                Other (enter name)…
                                            </option>
                                        </>
                                    ) : (
                                        <option value="__custom__">
                                            Enter account manually
                                        </option>
                                    )}
                                </select>
                            </div>
                            {markPaidAccountChoice === '__custom__' && (
                                <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                                    <label htmlFor="mark-paid-account-custom">
                                        Account name / details *
                                    </label>
                                    <input
                                        id="mark-paid-account-custom"
                                        type="text"
                                        value={markPaidCustomAccount}
                                        onChange={(e) =>
                                            setMarkPaidCustomAccount(e.target.value)
                                        }
                                        placeholder="e.g. Bank — Al Rajhi (current)"
                                        disabled={markPaidModalBusy}
                                        autoComplete="off"
                                    />
                                </div>
                            )}
                        </div>
                        {markPaidModalErr ? (
                            <p
                                style={{
                                    margin: '14px 0 0',
                                    fontSize: '0.8125rem',
                                    color: '#B91C1C',
                                }}
                            >
                                {markPaidModalErr}
                            </p>
                        ) : null}
                    </Modal>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {returnModalRow && (
                    <Modal
                        title={
                            <div className="pi-modal-title">
                                <span className="pi-breadcrumb">
                                    Sales Invoices ›{' '}
                                    <span className="pi-b-active">Return</span>
                                </span>
                                <div className="pi-title-main">
                                    <RotateCcw size={24} />
                                    <span>Sales Invoice Return</span>
                                </div>
                                <span className="pi-sub-label" style={{ display: 'block', marginTop: 6 }}>
                                    {returnModalRow.invoiceNo || returnModalRow.id}
                                </span>
                            </div>
                        }
                        width="min(1350px, 98vw)"
                        contentClassName="modal-content-purchase"
                        disableClose={returnSubmitting || returnModalLoading}
                        onClose={closeReturnModal}
                        footer={
                            <div className="pi-modal-footer">
                                <div className="pi-footer-left">
                                    <button
                                        type="button"
                                        className="btn-pi-cancel"
                                        onClick={closeReturnModal}
                                        disabled={returnSubmitting || returnModalLoading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        onClick={submitSalesInvoiceReturn}
                                        disabled={returnSubmitting || returnModalLoading}
                                    >
                                        {returnSubmitting ? (
                                            <span
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                }}
                                            >
                                                <Loader2
                                                    size={16}
                                                    className="supplier-sales-last-sale-spinner"
                                                    aria-hidden
                                                />
                                                Saving…
                                            </span>
                                        ) : (
                                            'Submit return'
                                        )}
                                    </button>
                                </div>
                            </div>
                        }
                    >
                        <div className="pi-form-container">
                            {returnModalLoading ? (
                                <div style={{ padding: '12px 0 24px' }}>
                                    <ShimmerTextBlock lines={5} />
                                    <div style={{ marginTop: 18 }}>
                                        <ShimmerTable rows={5} columns={6} />
                                    </div>
                                    <p
                                        style={{
                                            marginTop: 16,
                                            fontSize: '0.8125rem',
                                            color: '#64748B',
                                            textAlign: 'center',
                                        }}
                                    >
                                        Loading invoice &amp; return history…
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            background: '#ECFEFF',
                                            border: '1px solid #A5F3FC',
                                            fontSize: '0.8125rem',
                                            color: '#0369A1',
                                            marginBottom: 16,
                                        }}
                                    >
                                        Credits reduce the workshop&apos;s outstanding balance on this invoice (AR).
                                        Each return is saved with a reference number and logged in supplier
                                        transaction history — same as issuing an invoice, list totals update
                                        immediately after you submit.
                                    </div>

                                    {returnInvoiceDetail?.invoice ? (
                                        <>
                                            <div className="pi-header-grid">
                                                <div className="pi-field">
                                                    <label>Invoice #</label>
                                                    <input
                                                        readOnly
                                                        value={returnInvoiceDetail.invoice.invoiceNo || '—'}
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>Issue date</label>
                                                    <input
                                                        readOnly
                                                        value={
                                                            returnInvoiceDetail.invoice.invoiceDate?.slice(
                                                                0,
                                                                10,
                                                            ) || '—'
                                                        }
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>Due date</label>
                                                    <input
                                                        readOnly
                                                        value={
                                                            returnInvoiceDetail.invoice.dueDate?.slice(0, 10) ||
                                                            '—'
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="pi-header-grid">
                                                <div className="pi-field pi-full-width">
                                                    <label>Workshop / Branch (customer)</label>
                                                    <input
                                                        readOnly
                                                        value={
                                                            returnModalRow.workshopName &&
                                                            returnModalRow.branch &&
                                                            returnModalRow.branch !== '-'
                                                                ? `${returnModalRow.workshopName} — ${returnModalRow.branch}`
                                                                : String(returnModalRow.branch || '—')
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            <div className="pi-header-grid">
                                                <div className="pi-field">
                                                    <label>Grand total</label>
                                                    <input
                                                        readOnly
                                                        value={`SAR ${Number(
                                                            returnInvoiceDetail.invoice.grandTotal ?? 0,
                                                        ).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}`}
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>Paid</label>
                                                    <input
                                                        readOnly
                                                        value={`SAR ${Number(
                                                            returnInvoiceDetail.invoice.paid ?? 0,
                                                        ).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}`}
                                                    />
                                                </div>
                                                <div className="pi-field">
                                                    <label>Returns credited</label>
                                                    <input
                                                        readOnly
                                                        value={`SAR ${Number(
                                                            returnInvoiceDetail.invoice.returnsTotal ?? 0,
                                                        ).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}`}
                                                    />
                                                </div>
                                            </div>
                                            <div className="pi-header-grid">
                                                <div className="pi-field">
                                                    <label>Balance due (after returns)</label>
                                                    <input
                                                        readOnly
                                                        style={{ fontWeight: 700, color: '#b91c1c' }}
                                                        value={`SAR ${Number(
                                                            returnInvoiceDetail.invoice.outstanding ?? 0,
                                                        ).toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        })}`}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    ) : null}

                                    {returnHistory.length > 0 ? (
                                        <div
                                            className="pi-lines-section"
                                            style={{ marginBottom: 16 }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    color: '#334155',
                                                    marginBottom: 8,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.04em',
                                                }}
                                            >
                                                Previous returns ({returnHistory.length})
                                            </div>
                                            <div
                                                style={{
                                                    padding: '10px 12px',
                                                    background: '#F8FAFC',
                                                    borderRadius: 10,
                                                    border: '1px solid #E2E8F0',
                                                    fontSize: '0.8125rem',
                                                    maxHeight: 160,
                                                    overflowY: 'auto',
                                                }}
                                            >
                                                <ul style={{ margin: 0, paddingLeft: 18, color: '#64748B' }}>
                                                    {returnHistory.map((r) => (
                                                        <li key={r.id} style={{ marginBottom: 6 }}>
                                                            <strong>{r.returnNo}</strong> ·{' '}
                                                            {r.returnDate?.slice(0, 10) || '—'} · SAR{' '}
                                                            {Number(r.grandTotal || 0).toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            })}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    ) : null}

                                    <div className="pi-lines-section">
                                        <div
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: '#334155',
                                                marginBottom: 10,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            Lines to return
                                        </div>
                                        <div
                                            className="pi-lines-header"
                                            style={{
                                                gridTemplateColumns:
                                                    'minmax(140px,2fr) 88px 104px 96px 112px minmax(120px,1fr)',
                                                marginBottom: 8,
                                            }}
                                        >
                                            <div className="pi-col-item">Item</div>
                                            <div className="pi-col-qty">Invoiced</div>
                                            <div className="pi-col-qty">Returned</div>
                                            <div className="pi-col-qty">Left</div>
                                            <div className="pi-col-qty">Return qty</div>
                                            <div className="pi-col-item">Reason</div>
                                        </div>
                                        {(function renderReturnLines() {
                                            const returnedSoFar =
                                                aggregateReturnedQtyByInvoiceLine(returnHistory);
                                            const gridCols =
                                                'minmax(140px,2fr) 88px 104px 96px 112px minmax(120px,1fr)';
                                            return (returnInvoiceDetail?.invoice?.items || []).map((it) => {
                                                const id = String(it.id);
                                                const orig = Number(it.qty);
                                                const already = returnedSoFar.get(id) || 0;
                                                const remaining = Math.max(0, orig - already);
                                                return (
                                                    <div
                                                        key={id}
                                                        className="pi-lines-header pi-line-data-row"
                                                        style={{
                                                            gridTemplateColumns: gridCols,
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <div
                                                            className="pi-col-item"
                                                            style={{ minWidth: 0 }}
                                                        >
                                                            <span style={{ fontWeight: 600 }}>
                                                                {it.productName || '—'}
                                                            </span>
                                                        </div>
                                                        <div className="pi-col-qty">{orig}</div>
                                                        <div className="pi-col-qty">{already}</div>
                                                        <div
                                                            className="pi-col-qty"
                                                            style={{
                                                                fontWeight: remaining <= 0 ? 600 : 500,
                                                                color:
                                                                    remaining <= 0 ? '#94A3B8' : '#0f172a',
                                                            }}
                                                        >
                                                            {remaining}
                                                        </div>
                                                        <div className="pi-col-qty">
                                                            {remaining <= 0 ? (
                                                                <span style={{ color: '#94A3B8' }}>—</span>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    inputMode="decimal"
                                                                    className="pi-row-input"
                                                                    value={returnLineQty[id] ?? ''}
                                                                    onChange={(e) =>
                                                                        setReturnLineQty((prev) => ({
                                                                            ...prev,
                                                                            [id]: e.target.value,
                                                                        }))
                                                                    }
                                                                    placeholder="0"
                                                                    disabled={returnSubmitting}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="pi-col-item" style={{ minWidth: 0 }}>
                                                            <input
                                                                type="text"
                                                                className="pi-row-input"
                                                                value={returnLineReason[id] ?? ''}
                                                                onChange={(e) =>
                                                                    setReturnLineReason((prev) => ({
                                                                        ...prev,
                                                                        [id]: e.target.value,
                                                                    }))
                                                                }
                                                                placeholder="Optional"
                                                                disabled={
                                                                    returnSubmitting || remaining <= 0
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>

                                    <div className="pi-field pi-full-width">
                                        <label>Notes (optional)</label>
                                        <textarea
                                            rows={4}
                                            value={returnNotes}
                                            onChange={(e) => setReturnNotes(e.target.value)}
                                            disabled={returnSubmitting}
                                            placeholder="Internal note for this return"
                                        />
                                    </div>

                                    {returnModalErr ? (
                                        <div
                                            style={{
                                                marginTop: 12,
                                                padding: 10,
                                                borderRadius: 8,
                                                fontSize: '0.8125rem',
                                                color: '#B91C1C',
                                                border: '1px solid #FECACA',
                                                background: '#FEF2F2',
                                            }}
                                        >
                                            {returnModalErr}
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
            <AnimatePresence>
                {viewOpen && (
                    <Modal
                        title="Sales invoice"
                        width="min(980px, 99vw)"
                        contentClassName="wpi-invoice-preview-modal"
                        onClose={() => {
                            setViewOpen(false);
                            setViewPayload(null);
                        }}
                    >
                        {viewLoading ? (
                            <ShimmerTextBlock lines={8} />
                        ) : viewPayload?.error ? (
                            <p style={{ margin: 0, color: '#B91C1C' }}>{viewPayload.error}</p>
                        ) : viewPayload?.invoice ? (
                            <WorkshopPurchaseInvoiceView
                                compact
                                variant="supplier_sales"
                                detail={mapSupplierSalesInvoiceToWorkshopDetail(viewPayload.invoice)}
                                listRow={mapSupplierSalesInvoiceToWorkshopListRow(viewPayload.invoice)}
                            />
                        ) : (
                            <p style={{ margin: 0 }}>No data.</p>
                        )}
                    </Modal>
                )}
            </AnimatePresence>
            {salesInvoicePdfExport ? (
                <div
                    aria-hidden
                    className="sales-invoice-pdf-export-mount"
                    style={{
                        position: 'fixed',
                        left: '-12000px',
                        top: 0,
                        width: 'min(980px, 99vw)',
                        pointerEvents: 'none',
                        zIndex: -1,
                        overflow: 'hidden',
                    }}
                >
                    <WorkshopPurchaseInvoiceView
                        ref={salesInvoicePdfRef}
                        compact
                        variant="supplier_sales"
                        detail={mapSupplierSalesInvoiceToWorkshopDetail(salesInvoicePdfExport)}
                        listRow={mapSupplierSalesInvoiceToWorkshopListRow(salesInvoicePdfExport)}
                    />
                </div>
            ) : null}
        </div>
    );
}
