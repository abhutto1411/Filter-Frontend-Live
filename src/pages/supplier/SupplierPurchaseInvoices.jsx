import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Plus,
    Calendar,
    ShoppingCart,
    Search,
    Zap,
    Building2,
    History,
    ChevronDown,
    Trash2,
    BookOpen,
    Edit,
    Package,
    Loader2,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import SupplierSuperSupplierPurchasesPanel from './SupplierSuperSupplierPurchasesPanel';
import '../../styles/admin/AccountingPage.css';
import {
    createSupplierSuperSupplierPurchase,
    getSuperSupplierApLedger,
    getSuperSupplierPurchaseProducts,
    getSupplierInventoryStockBalances,
    getSupplierSuperSupplierPurchase,
    listSupplierSuperSuppliers,
    createSupplierSuperSupplier,
    updateSupplierSuperSupplier,
    deleteSupplierSuperSupplier,
    listSupplierSuperSupplierAudit,
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
    const conversionFactor = Number(raw.conversionFactor) || 1;
    const warehouseUnit =
        raw.warehouseUnit || raw.unitCode || raw.unit || 'Box';
    const workshopUnit = raw.workshopUnit || 'pcs';
    const unitCostWh =
        qtyWh > 0 ? Number(raw.valueWarehouseSar || 0) / qtyWh : 0;
    const lastPurchaseRaw =
        raw && typeof raw.lastPurchase === 'object' && raw.lastPurchase != null
            ? raw.lastPurchase
            : null;
    const hasPreviousPurchase = !!(
        lastPurchaseRaw &&
        String(lastPurchaseRaw.purchaseDate || '').trim() !== ''
    );
    const lastPurchasePriceNum = hasPreviousPurchase
        ? Number(lastPurchaseRaw.unitPrice ?? raw.lastPurchasePrice ?? 0)
        : 0;
    const purchaseDateRaw = String(lastPurchaseRaw?.purchaseDate || '').trim();
    const supplierLabel = String(
        lastPurchaseRaw?.superSupplierName ||
            raw.lastPurchaseSupplierLabel ||
            '',
    ).trim();
    const lastPurchaseMeta =
        hasPreviousPurchase && (purchaseDateRaw || supplierLabel)
            ? [purchaseDateRaw, supplierLabel].filter(Boolean).join(' • ')
            : '';
    const price = Number.isFinite(unitCostWh) ? Math.max(0, unitCostWh) : 0;
    const uom = warehouseUnit;
    return {
        id: pid,
        sku: String(raw.sku ?? raw.barcode ?? '').trim(),
        name: raw.productName || 'Product',
        price,
        unit: uom,
        warehouseUnit,
        workshopUnit,
        conversionFactor,
        warehouseStockQty: qtyWh,
        stockQtyWorkshop: Number(raw.currentBalanceWorkshop ?? 0),
        type: 'Stock',
        stockHint:
            qtyWh >= 0
                ? `Warehouse stock: ${qtyWh} ${warehouseUnit}${conversionFactor > 1 ? ` (= ${qtyWh * conversionFactor} ${workshopUnit})` : ''}`
                : 'Enter qty in warehouse or workshop UOM; stock-in converts to warehouse units.',
        hasPreviousPurchase,
        lastPrice: lastPurchasePriceNum,
        lastPurchaseMeta,
    };
}

function normPiUomLabel(u) {
    return String(u ?? '').trim().toLowerCase();
}

function isPiWarehouseUomLine(line, inv) {
    const wu = normPiUomLabel(inv?.warehouseUnit);
    const u = normPiUomLabel(line?.uom);
    return !!wu && !!u && u === wu;
}

function findPiCapsRow(line, inventoryItems) {
    const pid = String(line?.supplierProductId ?? '').trim();
    if (!pid) return null;
    return inventoryItems.find((inv) => String(inv.id) === pid) ?? null;
}

function linePiUomOptions(line, inv) {
    const wu = String(inv?.warehouseUnit ?? '').trim();
    const wsu = String(inv?.workshopUnit ?? '').trim();
    if (wu) return [wu];
    if (wsu) return [wsu];
    return [String(line?.uom ?? 'Box').trim() || 'Box'];
}

/** Purchase invoices always stock-in in warehouse units (Box), never workshop (Liter). */
function resolvePiLineUnitForApi(line, inv) {
    const wu = String(inv?.warehouseUnit ?? line?.warehouseUnit ?? '').trim();
    if (wu) return wu;
    const wsu = String(inv?.workshopUnit ?? line?.workshopUnitCatalog ?? '').trim();
    if (wsu) return wsu;
    return String(line?.uom ?? 'Box').trim() || 'Box';
}

function formatPiUomConversionPreview(line, inv) {
    if (!inv) return '';
    const cf = Number(inv.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu = inv.warehouseUnit || 'Box';
    const wsu = inv.workshopUnit || 'pcs';
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    if (!(qty > 0)) return '';
    const wsQty = roundMoney2(qty * cf);
    return `+${qty} ${wu} warehouse stock (= ${wsQty} ${wsu})`;
}

function scorePurchaseSearchItem(item, q) {
    const name = String(item.name || '').toLowerCase();
    const sku = String(item.sku || '').toLowerCase();
    if (!q) return 0;
    if (sku === q) return 100;
    if (name === q) return 95;
    if (sku.startsWith(q)) return 90;
    if (name.startsWith(q)) return 85;
    if (sku.includes(q)) return 70;
    if (name.includes(q)) return 60;
    const tokens = q.split(/\s+/).filter((t) => t.length >= 2);
    let hits = 0;
    for (const t of tokens) {
        if (name.includes(t) || sku.includes(t)) hits += 1;
    }
    if (tokens.length && hits === tokens.length) return 50 + hits * 5;
    return 0;
}

const SEARCH_QUICK_PICK_PI = 12;
const SEARCH_MAX_RESULTS_PI = 40;

/** Hydrated when navigating from Stock Inventory → Adjust via Purchase */
const PI_PRESET_FROM_STOCK_FLAG = 'supplier_pi_open_from_stock';
const PI_PRESET_STOCK_LINE = 'supplier_pi_preset_stock_line';

/** @typedef {'payables'|'super_suppliers'|'ssp_invoices'} ApTabId */

function fmtApMoney(value) {
    return Number(value ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatAccountsPayableDisplay(amount) {
    const n = Number(amount ?? 0);
    if (n < -0.005) {
        return `- SAR ${fmtApMoney(Math.abs(n))}`;
    }
    return `SAR ${fmtApMoney(n)}`;
}

function apStatusLabel(apStatus) {
    if (apStatus === 'unpaid') return 'Unpaid';
    if (apStatus === 'overpaid') return 'Overpaid';
    return 'Paid';
}

function apStatusBadgeStyle(apStatus) {
    if (apStatus === 'unpaid') {
        return { background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' };
    }
    if (apStatus === 'overpaid') {
        return { background: '#FFEDD5', color: '#C2410C', border: '1px solid #FED7AA' };
    }
    return { background: '#DCFCE7', color: '#15803D', border: '1px solid #BBF7D0' };
}

export default function SupplierPurchaseInvoices() {
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
    const [itemPickerSelectedIndex, setItemPickerSelectedIndex] = useState(0);
    const [lastPurchaseStockRefreshing, setLastPurchaseStockRefreshing] = useState(false);
    const lineFieldRefs = useRef({});
    const pendingFocusLineFieldRef = useRef(null);

    const [sspPanelKey, setSspPanelKey] = useState(0);
    /** @type {[ApTabId, React.Dispatch<React.SetStateAction<ApTabId>>]} */
    const [apTab, setApTab] = useState(
        /** @type {ApTabId} */ ('payables'),
    );

    const [catalogItems, setCatalogItems] = useState([]);
    const [catalogLoading, setCatalogLoading] = useState(false);

    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState('');
    /** Same modal as New Purchase Invoice — edit loads SSP purchase into identical fields */
    const [sspPurchaseModalMode, setSspPurchaseModalMode] = useState(
        /** @type {'create' | 'edit'} */ ('create'),
    );
    const [editingSspPurchaseId, setEditingSspPurchaseId] = useState(null);
    const [sspPurchaseEditLoading, setSspPurchaseEditLoading] = useState(false);

    const [superSuppliers, setSuperSuppliers] = useState([]);
    const [ssLoading, setSsLoading] = useState(true);
    const [ssListError, setSsListError] = useState('');
    const [supplierSearch, setSupplierSearch] = useState('');
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
    const [editingSuperSupplierId, setEditingSuperSupplierId] = useState(null);
    const [ssTogglingId, setSsTogglingId] = useState(null);
    const [ssDeletingId, setSsDeletingId] = useState(null);
    const [createSspPurchaseForId, setCreateSspPurchaseForId] = useState(null);
    const [auditOpen, setAuditOpen] = useState(false);
    const [auditSsFilter, setAuditSsFilter] = useState('');
    const [auditItems, setAuditItems] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);

    const [ssLedgerOpen, setSsLedgerOpen] = useState(false);
    const [ssLedgerLoading, setSsLedgerLoading] = useState(false);
    const [ssLedgerError, setSsLedgerError] = useState('');
    const [ssLedgerData, setSsLedgerData] = useState(null);

    const [ssProductsOpen, setSsProductsOpen] = useState(false);
    const [ssProductsLoading, setSsProductsLoading] = useState(false);
    const [ssProductsError, setSsProductsError] = useState('');
    const [ssProductsData, setSsProductsData] = useState(null);
    const [ssProductsSuperSupplierId, setSsProductsSuperSupplierId] = useState('');
    const [ssProductsDateFrom, setSsProductsDateFrom] = useState('');
    const [ssProductsDateTo, setSsProductsDateTo] = useState('');
    const [ssProductsProductFilter, setSsProductsProductFilter] = useState('');

    const loadSuperSuppliers = useCallback(async () => {
        setSsLoading(true);
        setSsListError('');
        try {
            const res = await listSupplierSuperSuppliers();
            const list = res?.superSuppliers ?? [];
            setSuperSuppliers(Array.isArray(list) ? list : []);
        } catch (err) {
            setSuperSuppliers([]);
            setSsListError(err?.message || 'Failed to load suppliers');
        } finally {
            setSsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSuperSuppliers();
    }, [loadSuperSuppliers]);

    const filteredSuperSuppliers = useMemo(() => {
        const q = supplierSearch.trim().toLowerCase();
        if (!q) return superSuppliers;
        return superSuppliers.filter((ss) => {
            const hay = [ss.name, ss.vatNumber, ss.mobile, ss.email, ss.notes]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [superSuppliers, supplierSearch]);

    const aggregateAp = useMemo(
        () =>
            filteredSuperSuppliers.reduce(
                (sum, ss) => sum + Number(ss.accountsPayable ?? 0),
                0,
            ),
        [filteredSuperSuppliers],
    );

    const openSuperSupplierLedger = async (superSupplierId, supplierName = '') => {
        setSsLedgerOpen(true);
        setSsLedgerLoading(true);
        setSsLedgerError('');
        setSsLedgerData({ supplier: { name: supplierName || 'Super supplier' } });
        try {
            const res = await getSuperSupplierApLedger(String(superSupplierId));
            const root = res?.data && typeof res.data === 'object' ? res.data : res;
            setSsLedgerData(root);
        } catch (e) {
            setSsLedgerError(e?.message || 'Could not load account ledger.');
            setSsLedgerData(null);
        } finally {
            setSsLedgerLoading(false);
        }
    };

    const closeSuperSupplierLedger = () => {
        setSsLedgerOpen(false);
        setSsLedgerError('');
        setSsLedgerData(null);
        void loadSuperSuppliers();
    };

    const loadSuperSupplierProducts = useCallback(
        async (superSupplierId, filters = {}) => {
            if (!superSupplierId) return;
            setSsProductsLoading(true);
            setSsProductsError('');
            try {
                const res = await getSuperSupplierPurchaseProducts(String(superSupplierId), filters);
                const root = res?.data && typeof res.data === 'object' ? res.data : res;
                setSsProductsData(root);
            } catch (e) {
                setSsProductsError(e?.message || 'Could not load purchased products.');
                setSsProductsData(null);
            } finally {
                setSsProductsLoading(false);
            }
        },
        [],
    );

    const openSuperSupplierProducts = (superSupplierId, supplierName = '') => {
        const id = String(superSupplierId);
        setSsProductsSuperSupplierId(id);
        setSsProductsOpen(true);
        setSsProductsDateFrom('');
        setSsProductsDateTo('');
        setSsProductsProductFilter('');
        setSsProductsData({ supplier: { name: supplierName || 'Super supplier' } });
        void loadSuperSupplierProducts(id, {});
    };

    const closeSuperSupplierProducts = () => {
        setSsProductsOpen(false);
        setSsProductsError('');
        setSsProductsData(null);
        setSsProductsSuperSupplierId('');
        setSsProductsDateFrom('');
        setSsProductsDateTo('');
        setSsProductsProductFilter('');
    };

    const applySuperSupplierProductsFilters = () => {
        if (!ssProductsSuperSupplierId) return;
        void loadSuperSupplierProducts(ssProductsSuperSupplierId, {
            dateFrom: ssProductsDateFrom || undefined,
            dateTo: ssProductsDateTo || undefined,
            product: ssProductsProductFilter.trim() || undefined,
        });
    };

    const clearSuperSupplierProductsFilters = () => {
        setSsProductsDateFrom('');
        setSsProductsDateTo('');
        setSsProductsProductFilter('');
        if (!ssProductsSuperSupplierId) return;
        void loadSuperSupplierProducts(ssProductsSuperSupplierId, {});
    };

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

    const handleSaveSuperSupplier = async () => {
        if (!ssForm.name?.trim()) {
            setSsErr('Name is required');
            return;
        }
        setSsSaving(true);
        setSsErr('');
        try {
            const payload = {
                name: ssForm.name.trim(),
                mobile: ssForm.mobile?.trim() || undefined,
                email: ssForm.email?.trim() || undefined,
                vatNumber: ssForm.vatNumber?.trim() || undefined,
                address: ssForm.address?.trim() || undefined,
                notes: ssForm.notes?.trim() || undefined,
            };
            if (editingSuperSupplierId) {
                await updateSupplierSuperSupplier(editingSuperSupplierId, payload);
            } else {
                await createSupplierSuperSupplier(payload);
            }
            setAddSsOpen(false);
            setEditingSuperSupplierId(null);
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

    const openEditSuperSupplier = (ss) => {
        setSsErr('');
        setEditingSuperSupplierId(String(ss.id));
        setSsForm({
            name: ss.name || '',
            mobile: ss.mobile || '',
            email: ss.email || '',
            vatNumber: ss.vatNumber || '',
            address: ss.address || '',
            notes: ss.notes || '',
        });
        setApTab('super_suppliers');
        setAddSsOpen(true);
    };

    const openAddSuperSupplier = () => {
        setSsErr('');
        setEditingSuperSupplierId(null);
        setSsForm({
            name: '',
            mobile: '',
            email: '',
            vatNumber: '',
            address: '',
            notes: '',
        });
        setApTab('super_suppliers');
        setAddSsOpen(true);
    };

    const handleToggleSuperSupplierActive = async (ss) => {
        const id = String(ss.id);
        setSsTogglingId(id);
        try {
            await updateSupplierSuperSupplier(id, { isActive: !ss.isActive });
            await loadSuperSuppliers();
        } catch (e) {
            window.alert(e?.message || 'Could not update status');
        } finally {
            setSsTogglingId(null);
        }
    };

    const handleDeleteSuperSupplier = async (ss) => {
        const purchaseCount = Number(ss.purchaseCount ?? 0);
        const apBalance = Number(ss.accountsPayable ?? 0);
        if (purchaseCount > 0 || Math.abs(apBalance) > 0.005) {
            window.alert(
                'This super supplier cannot be deleted because purchase or ledger transactions exist.',
            );
            return;
        }
        if (
            !window.confirm(
                `Delete super supplier "${ss.name}"? This cannot be undone.`,
            )
        ) {
            return;
        }
        const id = String(ss.id);
        setSsDeletingId(id);
        try {
            await deleteSupplierSuperSupplier(id);
            await loadSuperSuppliers();
        } catch (e) {
            window.alert(e?.message || 'Could not delete super supplier');
        } finally {
            setSsDeletingId(null);
        }
    };

    const canDeleteSuperSupplier = (ss) => {
        const purchaseCount = Number(ss.purchaseCount ?? 0);
        const apBalance = Number(ss.accountsPayable ?? 0);
        return purchaseCount === 0 && Math.abs(apBalance) <= 0.005;
    };

    useEffect(() => {
        if (!modalOpen) return undefined;
        let cancelled = false;
        setCatalogLoading(true);
        const params = { limit: 500, offset: 0 };
        if (superSupplierId) {
            params.superSupplierId = String(superSupplierId);
        }
        getSupplierInventoryStockBalances(params)
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
    }, [modalOpen, superSupplierId]);

    useEffect(() => {
        if (!modalOpen || !superSupplierId) return undefined;
        let cancelled = false;
        setLastPurchaseStockRefreshing(true);
        getSupplierInventoryStockBalances({
            limit: 500,
            offset: 0,
            superSupplierId: String(superSupplierId),
        })
            .then((res) => {
                if (cancelled) return;
                const normalized = (Array.isArray(res?.items) ? res.items : [])
                    .map((row) => mapStockBalanceToPurchasePickerRow(row))
                    .filter(Boolean);
                setCatalogItems((prev) => {
                    const byId = new Map(normalized.map((r) => [String(r.id), r]));
                    return prev.map((p) => byId.get(String(p.id)) ?? p);
                });
                setLineItems((prev) =>
                    prev.map((line) => {
                        if (!line.supplierProductId) return line;
                        const inv = normalized.find(
                            (x) => String(x.id) === String(line.supplierProductId),
                        );
                        if (!inv) return line;
                        const hasPrev = !!inv.hasPreviousPurchase;
                        return applyLineTotals(
                            {
                                ...line,
                                uom: line.uom || inv.unit,
                                warehouseUnit: inv.warehouseUnit ?? line.warehouseUnit,
                                workshopUnitCatalog:
                                    inv.workshopUnit ?? line.workshopUnitCatalog,
                                conversionFactor:
                                    inv.conversionFactor ?? line.conversionFactor,
                                hasPreviousPurchase: hasPrev,
                                lastPurchasePrice: hasPrev
                                    ? Number(inv.lastPrice ?? 0)
                                    : 0,
                                lastPurchaseMeta: hasPrev
                                    ? String(inv.lastPurchaseMeta || '').trim()
                                    : '',
                            },
                            amountsTaxInclusive,
                        );
                    }),
                );
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLastPurchaseStockRefreshing(false);
            });
        return () => {
            cancelled = true;
        };
    }, [modalOpen, superSupplierId, amountsTaxInclusive]);

    const catalogForSearch = catalogItems.length ? catalogItems : [];

    const getSearchSuggestionsPi = (query) => {
        const items = catalogForSearch;
        const q = query.trim().toLowerCase();
        if (!q) {
            return [...items]
                .sort((a, b) =>
                    String(a.name || '').localeCompare(String(b.name || ''), undefined, {
                        sensitivity: 'base',
                    }),
                )
                .slice(0, SEARCH_QUICK_PICK_PI);
        }
        return items
            .map((item) => ({ item, score: scorePurchaseSearchItem(item, q) }))
            .filter((x) => x.score > 0)
            .sort(
                (a, b) =>
                    b.score - a.score ||
                    String(a.item.name || '').localeCompare(String(b.item.name || '')),
            )
            .slice(0, SEARCH_MAX_RESULTS_PI)
            .map((x) => x.item);
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

    useEffect(() => {
        setItemPickerSelectedIndex(0);
    }, [itemPickerFilter, itemPickerLineId]);

    const getLineTabFields = useCallback(() => {
        const fields = ['item', 'account'];
        if (showDesc) fields.push('description');
        fields.push('uom', 'qty', 'price');
        if (showDiscount) {
            fields.push('discount', 'discountMode');
        }
        fields.push('taxCode');
        return fields;
    }, [showDesc, showDiscount]);

    const focusLineField = useCallback((lineId, fieldName) => {
        requestAnimationFrame(() => {
            lineFieldRefs.current[`${lineId}:${fieldName}`]?.focus?.();
        });
    }, []);

    useEffect(() => {
        const pending = pendingFocusLineFieldRef.current;
        if (!pending) return;
        pendingFocusLineFieldRef.current = null;
        focusLineField(pending.lineId, pending.fieldName);
    }, [lineItems.length, focusLineField]);

    const lastPurchaseHintForLine = useCallback(
        (line) => {
            if (line.supplierProductId) {
                const inv = catalogItems.find(
                    (x) => String(x.id) === String(line.supplierProductId),
                );
                if (inv) {
                    return {
                        hasPrev: !!inv.hasPreviousPurchase,
                        price: Number(inv.lastPrice ?? 0),
                        meta: String(inv.lastPurchaseMeta || '').trim(),
                    };
                }
            }
            return {
                hasPrev: !!line.hasPreviousPurchase,
                price: Number(line.lastPurchasePrice ?? 0),
                meta: String(line.lastPurchaseMeta || '').trim(),
            };
        },
        [catalogItems],
    );

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
                    uom: catItem.warehouseUnit || catItem.unit || line.uom || 'Box',
                    warehouseUnit: catItem.warehouseUnit ?? line.warehouseUnit ?? null,
                    workshopUnitCatalog:
                        catItem.workshopUnit ?? line.workshopUnitCatalog ?? null,
                    conversionFactor: catItem.conversionFactor ?? line.conversionFactor ?? 1,
                    price: unitPrice,
                    hasPreviousPurchase: !!catItem.hasPreviousPurchase,
                    lastPurchasePrice: catItem.hasPreviousPurchase
                        ? Number(catItem.lastPrice ?? 0)
                        : Number(line.lastPurchasePrice ?? 0),
                    lastPurchaseMeta: catItem.hasPreviousPurchase
                        ? String(catItem.lastPurchaseMeta || '').trim()
                        : '',
                };
                return applyLineTotals(raw, amountsTaxInclusive);
            }),
        );
        setItemPickerLineId(null);
        setItemPickerInput('');
        setItemPickerFilter('');
        focusLineField(lineId, 'uom');
    };

    const removePurchaseLine = (lineId) => {
        setLineItems((prev) => prev.filter((l) => l.id !== lineId));
        setItemPickerLineId((cur) => (cur === lineId ? null : cur));
    };

    const updateLineItem = (id, field, value) => {
        const recalc = new Set(['qty', 'price', 'taxCode', 'discount', 'discountMode', 'uom']);
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                let updated = { ...line, [field]: value };
                if (field === 'uom') {
                    const inv = findPiCapsRow(line, catalogItems);
                    const cf = Number(inv?.conversionFactor) || 1;
                    const oldIsWh = isPiWarehouseUomLine(line, inv);
                    const newIsWh = isPiWarehouseUomLine(updated, inv);
                    if (inv && cf > 0 && oldIsWh !== newIsWh) {
                        const p = parseFloat(String(line.price).replace(',', '.')) || 0;
                        updated = {
                            ...updated,
                            price: roundMoney2(oldIsWh ? p / cf : p * cf),
                        };
                    }
                }
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
        const lineId = nextLineId();
        const raw = {
            id: lineId,
            item: '',
            sku: '',
            supplierProductId: undefined,
            account: '1410 - Inventory Asset',
            description: '',
            uom: 'Box',
            qty: 1,
            price: 0,
            discount: 0,
            discountMode: 'percent',
            taxCode: 'VAT 15%',
            taxAmt: '0.00',
            totalFinal: '0.00',
            hasPreviousPurchase: false,
            lastPurchasePrice: 0,
            lastPurchaseMeta: '',
        };
        const newLine = applyLineTotals(raw, amountsTaxInclusive);
        setLineItems((prev) => [...prev, newLine]);
        pendingFocusLineFieldRef.current = { lineId, fieldName: 'item' };
        return lineId;
    };

    const handleLineFieldTab = (e, lineId, fieldName, lineIndex) => {
        if (e.key !== 'Tab' || e.shiftKey) return;
        const fields = getLineTabFields();
        const fieldIdx = fields.indexOf(fieldName);
        if (fieldIdx < 0 || fieldIdx !== fields.length - 1) return;
        if (lineIndex !== lineItems.length - 1) return;
        e.preventDefault();
        addEmptyPurchaseLine();
    };

    const handleLineItemPickerKeyDown = (e, line) => {
        const suggestions = getSearchSuggestionsPi(itemPickerFilter);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setItemPickerSelectedIndex((i) =>
                Math.min(i + 1, Math.max(0, suggestions.length - 1)),
            );
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setItemPickerSelectedIndex((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (
                itemPickerLineId === line.id &&
                suggestions[itemPickerSelectedIndex]
            ) {
                applyCatalogPurchaseItemToLine(
                    line.id,
                    suggestions[itemPickerSelectedIndex],
                );
                return;
            }
            const text = String(itemPickerInputRef.current ?? '').trim();
            setLineItems((prev) =>
                prev.map((l) => (l.id === line.id ? { ...l, item: text } : l)),
            );
            setItemPickerLineId(null);
            setItemPickerInput('');
            setItemPickerFilter('');
            focusLineField(line.id, 'account');
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setItemPickerLineId(null);
            setItemPickerInput('');
            setItemPickerFilter('');
        }
    };

    const addItemToLines = (item) => {
        const lineId = nextLineId();
        const unitPrice = Number(item.price) || 0;
        const catalogId =
            item?.id != null && String(item.id).trim() !== ''
                ? String(item.id).trim()
                : undefined;
        const raw = {
            id: lineId,
            sku: item.sku || '',
            item: item.name,
            supplierProductId: catalogId,
            account:
                item.type === 'Stock' ? '1410 - Inventory Asset' : '5100 - Cost of Goods Sold',
            description: '',
            uom: item.warehouseUnit || 'Box',
            warehouseUnit: item.warehouseUnit ?? null,
            workshopUnitCatalog: item.workshopUnit ?? null,
            conversionFactor: item.conversionFactor ?? 1,
            qty: 1,
            price: unitPrice,
            discount: 0,
            discountMode: 'percent',
            taxCode: 'VAT 15%',
            taxAmt: '0.00',
            totalFinal: '0.00',
            hasPreviousPurchase: !!item.hasPreviousPurchase,
            lastPurchasePrice: item.hasPreviousPurchase ? Number(item.lastPrice ?? 0) : 0,
            lastPurchaseMeta: item.hasPreviousPurchase
                ? String(item.lastPurchaseMeta || '').trim()
                : '',
        };
        const newLine = applyLineTotals(raw, amountsTaxInclusive);
        setLineItems((prev) => [...prev, newLine]);
        setSearchQuery('');
        setShowDropdown(false);
        pendingFocusLineFieldRef.current = { lineId, fieldName: 'uom' };
        return lineId;
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((i) => (i < searchResults.length - 1 ? i + 1 : i));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((i) => (i > 0 ? i - 1 : i));
        } else if (e.key === 'Enter' && selectedIndex >= 0 && searchResults[selectedIndex]) {
            e.preventDefault();
            addItemToLines(searchResults[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
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
        cols.push('1fr', '1fr', '1fr', '1fr', '1fr'); // Total, TaxCode, TaxAmt, Grand Total, Last Purchase
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
                            uom: it.unit || 'Box',
                            qty: String(it.qty ?? 1),
                            price: priceStr,
                            discount: discVal,
                            discountMode: discMode,
                            taxCode,
                            taxAmt: '0.00',
                            totalFinal: '0.00',
                            hasPreviousPurchase: false,
                            lastPurchasePrice: 0,
                            lastPurchaseMeta: '',
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
                    warehouseUnit: String(line.warehouseUnit || line.unit || 'Box').trim() || 'Box',
                    workshopUnit: String(line.workshopUnit || '').trim() || undefined,
                    conversionFactor: Number(line.conversionFactor) || 1,
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
            const inv = findPiCapsRow(line, catalogItems);
            const resolvedUnit = resolvePiLineUnitForApi(line, inv);
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
                unit: resolvedUnit,
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
            await loadSuperSuppliers();
        } catch (err) {
            console.error('Save super supplier purchase failed:', err);
            setCreateError(err?.message || 'Could not save purchase invoice');
        } finally {
            setCreateSubmitting(false);
        }
    };

    return (
        <div className="purchases-view">
            {ssListError ? (
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
                    <strong>Could not load suppliers:</strong> {ssListError}
                </div>
            ) : null}

            <header className="purchases-header-row">
                <div className="pi-header-left">
                    <h2 className="cash-bank-title">Purchases</h2>
                    <p className="cash-bank-desc">Track supplier payables, super suppliers, and upstream purchase invoices.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="btn-save-all"
                        onClick={() => {
                            setSsErr('');
                            openAddSuperSupplier();
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
                    { id: 'payables', label: 'Suppliers' },
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
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 12,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderBottom: '1px solid #E2E8F0',
                        background: '#FAFAFA',
                    }}
                >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        <div
                            style={{
                                background: '#F1F5F9',
                                padding: '8px 12px',
                                borderRadius: 10,
                                fontSize: '0.8125rem',
                            }}
                        >
                            Total suppliers: <strong>{filteredSuperSuppliers.length}</strong>
                        </div>
                        <div
                            style={{
                                background: '#FEF3C7',
                                padding: '8px 12px',
                                borderRadius: 10,
                                fontSize: '0.8125rem',
                            }}
                        >
                            Aggregate AP: <strong>{formatAccountsPayableDisplay(aggregateAp)}</strong>
                        </div>
                    </div>
                    <div style={{ position: 'relative', minWidth: 220 }}>
                        <Search
                            size={16}
                            style={{
                                position: 'absolute',
                                left: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#94A3B8',
                            }}
                        />
                        <input
                            type="search"
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                            placeholder="Search suppliers…"
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 34px',
                                borderRadius: 8,
                                border: '1px solid #E2E8F0',
                                fontSize: '0.875rem',
                            }}
                        />
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Name</th>
                            <th className="table-th">Accounts payable</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ssLoading ? (
                            <tr>
                                <td colSpan={4} style={{ padding: 0, verticalAlign: 'top' }}>
                                    <div style={{ padding: 16 }}>
                                        <ShimmerTable rows={8} columns={4} />
                                    </div>
                                </td>
                            </tr>
                        ) : filteredSuperSuppliers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="table-cell table-empty">
                                    {ssListError
                                        ? 'No data loaded.'
                                        : superSuppliers.length === 0
                                          ? 'No super suppliers yet. Use "Add Super Supplier" above.'
                                          : 'No suppliers match your search.'}
                                </td>
                            </tr>
                        ) : (
                            filteredSuperSuppliers.map((ss) => {
                                const apStatus = ss.apStatus ?? 'paid';
                                return (
                                    <tr key={String(ss.id)} className="table-row">
                                    <td className="table-cell">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openSuperSupplierLedger(String(ss.id), ss.name)
                                                }
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
                                                title="Open accounts payable ledger"
                                            >
                                                <strong
                                                    style={{
                                                        color: '#EA580C',
                                                        textDecoration: 'underline',
                                                    }}
                                                >
                                                    {ss.name}
                                                </strong>
                                            </button>
                                            {ss.vatNumber ? (
                                                <div
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-text-muted)',
                                                        marginTop: 4,
                                                    }}
                                                >
                                                    VAT: {ss.vatNumber}
                                                </div>
                                            ) : null}
                                    </td>
                                    <td className="table-cell">
                                            {formatAccountsPayableDisplay(ss.accountsPayable)}
                                    </td>
                                    <td className="table-cell">
                                            <span
                                                className="status-badge"
                                                style={{
                                                    ...apStatusBadgeStyle(apStatus),
                                                    fontWeight: 700,
                                                    textTransform: 'none',
                                                }}
                                            >
                                                {apStatusLabel(apStatus)}
                                            </span>
                                        </td>
                                        <td className="table-cell">
                                            <button
                                                type="button"
                                                className="btn-pi-cancel"
                                                style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                onClick={() =>
                                                    openSuperSupplierLedger(String(ss.id), ss.name)
                                                }
                                            >
                                                <BookOpen size={14} /> Ledger
                                            </button>
                                    </td>
                                </tr>
                                );
                            })
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
                                                onClick={() => openSuperSupplierProducts(String(ss.id), ss.name)}
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
                                                title="View purchased products"
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
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: 10,
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <label
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        cursor:
                                                            ssTogglingId === String(ss.id)
                                                                ? 'wait'
                                                                : 'pointer',
                                                        fontSize: '0.8125rem',
                                                        opacity:
                                                            ssTogglingId === String(ss.id) ? 0.6 : 1,
                                                    }}
                                                    title={
                                                        ss.isActive
                                                            ? 'Set inactive'
                                                            : 'Set active'
                                                    }
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(ss.isActive)}
                                                        disabled={ssTogglingId === String(ss.id)}
                                                        onChange={() =>
                                                            handleToggleSuperSupplierActive(ss)
                                                        }
                                                        style={{ width: 16, height: 16 }}
                                                    />
                                                    {ss.isActive ? 'Active' : 'Inactive'}
                                                </label>
                                                <button
                                                    type="button"
                                                    className="btn-pi-cancel"
                                                    style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                                                    onClick={() => openEditSuperSupplier(ss)}
                                                >
                                                    <Edit size={14} /> Edit
                                                </button>
                                                {canDeleteSuperSupplier(ss) ? (
                                                <button
                                                    type="button"
                                                    className="btn-pi-cancel"
                                                        style={{
                                                            padding: '6px 12px',
                                                            fontSize: '0.8125rem',
                                                            color: '#B91C1C',
                                                            borderColor: '#FECACA',
                                                        }}
                                                        disabled={ssDeletingId === String(ss.id)}
                                                        onClick={() => handleDeleteSuperSupplier(ss)}
                                                    >
                                                        <Trash2 size={14} />{' '}
                                                        {ssDeletingId === String(ss.id)
                                                            ? 'Deleting…'
                                                            : 'Delete'}
                                                </button>
                                                ) : null}
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
                                <Building2 size={20} />{' '}
                                {editingSuperSupplierId ? 'Edit Super Supplier' : 'Add Super Supplier'}
                            </span>
                        }
                        onClose={() => {
                            if (!ssSaving) {
                                setAddSsOpen(false);
                                setEditingSuperSupplierId(null);
                                setSsErr('');
                            }
                        }}
                        width="520px"
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={ssSaving}
                                    onClick={() => {
                                        setAddSsOpen(false);
                                        setEditingSuperSupplierId(null);
                                        setSsErr('');
                                    }}
                                >
                                    Cancel
                                </button>
                                <button type="button" className="btn-pi-create" disabled={ssSaving} onClick={handleSaveSuperSupplier}>
                                    {ssSaving ? 'Saving…' : editingSuperSupplierId ? 'Save changes' : 'Save'}
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

                {ssLedgerOpen && (
                    <Modal
                        title={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <BookOpen size={20} /> Account ledger —{' '}
                                {ssLedgerData?.supplier?.name || 'Super supplier'}
                            </span>
                        }
                        onClose={closeSuperSupplierLedger}
                        width="960px"
                        footer={
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                }}
                            >
                                <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>
                                    Current accounts payable:{' '}
                                    {formatAccountsPayableDisplay(ssLedgerData?.accountsPayable)}
                                </span>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                    onClick={closeSuperSupplierLedger}
                            >
                                Close
                            </button>
                            </div>
                        }
                    >
                        {ssLedgerLoading ? (
                            <ShimmerTextBlock lines={8} />
                        ) : ssLedgerError ? (
                            <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.875rem' }}>{ssLedgerError}</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    <div
                                        style={{
                                            background: '#F1F5F9',
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            fontSize: '0.8125rem',
                                        }}
                                    >
                                        Account:{' '}
                                        <strong>
                                            [{ssLedgerData?.account?.code}] {ssLedgerData?.account?.name}
                                        </strong>
                                    </div>
                                    <div
                                        style={{
                                            background: '#FEF3C7',
                                            padding: '10px 14px',
                                            borderRadius: 10,
                                            fontSize: '0.8125rem',
                                        }}
                                    >
                                        Current balance:{' '}
                                        <strong>
                                            {formatAccountsPayableDisplay(ssLedgerData?.accountsPayable)}
                                        </strong>
                                    </div>
                                    <span
                                        className="status-badge"
                                        style={{
                                            ...apStatusBadgeStyle(ssLedgerData?.apStatus ?? 'paid'),
                                            fontWeight: 700,
                                            textTransform: 'none',
                                            alignSelf: 'center',
                                        }}
                                    >
                                        {apStatusLabel(ssLedgerData?.apStatus ?? 'paid')}
                                    </span>
                                </div>
                                <div style={{ maxHeight: 460, overflow: 'auto' }}>
                                    <table className="ws-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Entry #</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Description</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Reference</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Debit</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Credit</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(ssLedgerData?.lines || []).length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={7}
                                                        style={{ padding: 16, color: 'var(--color-text-muted)' }}
                                                    >
                                                        No journal transactions for this supplier yet.
                                                    </td>
                                                </tr>
                                            ) : (
                                                (ssLedgerData?.lines || []).map((ln, idx) => (
                                                    <tr key={`${ln.entryNumber}-${ln.date}-${idx}`}>
                                                        <td style={{ padding: 8, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                            {ln.date || '—'}
                                                        </td>
                                                        <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.entryNumber || '—'}</td>
                                                        <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.description || '—'}</td>
                                                        <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.reference || '—'}</td>
                                                        <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top' }}>
                                                            {Number(ln.debit) > 0
                                                                ? `SAR ${fmtApMoney(ln.debit)}`
                                                                : '—'}
                                                        </td>
                                                        <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top' }}>
                                                            {Number(ln.credit) > 0
                                                                ? `SAR ${fmtApMoney(ln.credit)}`
                                                                : '—'}
                                                        </td>
                                                        <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top', fontWeight: 700 }}>
                                                            {formatAccountsPayableDisplay(ln.runningBalance)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {ssLedgerData?.total > (ssLedgerData?.lines?.length || 0) ? (
                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                        Showing {ssLedgerData.lines.length} of {ssLedgerData.total} journal lines.
                                    </p>
                                ) : null}
                            </div>
                        )}
                    </Modal>
                )}

                {ssProductsOpen && (
                    <Modal
                        title={
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Package size={20} /> Purchased products —{' '}
                                {ssProductsData?.supplier?.name || 'Super supplier'}
                            </span>
                        }
                        onClose={closeSuperSupplierProducts}
                        width="960px"
                        footer={
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%',
                                    flexWrap: 'wrap',
                                    gap: 8,
                                }}
                            >
                                <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>
                                    {ssProductsData?.summary
                                        ? `${ssProductsData.summary.lineCount} line(s) · Qty ${Number(ssProductsData.summary.totalQty || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} · Total SAR ${fmtApMoney(ssProductsData.summary.totalAmount || 0)}`
                                        : 'Purchased products'}
                                </span>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    onClick={closeSuperSupplierProducts}
                                >
                                    Close
                                </button>
                            </div>
                        }
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 10,
                                alignItems: 'flex-end',
                                marginBottom: 14,
                            }}
                        >
                            <div className="pi-field" style={{ minWidth: 150 }}>
                                <label>From date</label>
                                <input
                                    type="date"
                                    value={ssProductsDateFrom}
                                    onChange={(e) => setSsProductsDateFrom(e.target.value)}
                                />
                            </div>
                            <div className="pi-field" style={{ minWidth: 150 }}>
                                <label>To date</label>
                                <input
                                    type="date"
                                    value={ssProductsDateTo}
                                    onChange={(e) => setSsProductsDateTo(e.target.value)}
                                />
                            </div>
                            <div className="pi-field" style={{ flex: '1 1 220px', minWidth: 200 }}>
                                <label>Product filter</label>
                                <div style={{ position: 'relative' }}>
                                    <Search
                                        size={16}
                                        style={{
                                            position: 'absolute',
                                            left: 10,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    />
                                    <input
                                        type="text"
                                        value={ssProductsProductFilter}
                                        onChange={(e) => setSsProductsProductFilter(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') applySuperSupplierProductsFilters();
                                        }}
                                        placeholder="Search by product name or SKU"
                                        style={{ paddingLeft: 34, width: '100%' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn-pi-create"
                                    disabled={ssProductsLoading}
                                    onClick={applySuperSupplierProductsFilters}
                                >
                                    Apply filters
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={ssProductsLoading}
                                    onClick={clearSuperSupplierProductsFilters}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        {ssProductsLoading ? (
                            <ShimmerTextBlock lines={8} />
                        ) : ssProductsError ? (
                            <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.875rem' }}>{ssProductsError}</p>
                        ) : (
                                <div style={{ maxHeight: 460, overflow: 'auto' }}>
                                    <table className="ws-table" style={{ width: '100%', fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Date</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>Invoice</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Reference</th>
                                            <th style={{ textAlign: 'left', padding: 8 }}>Product</th>
                                                <th style={{ textAlign: 'left', padding: 8 }}>SKU</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Qty</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Unit price</th>
                                                <th style={{ textAlign: 'right', padding: 8 }}>Line total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                        {(ssProductsData?.lines || []).length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    style={{ padding: 16, color: 'var(--color-text-muted)' }}
                                                >
                                                    No purchased products found for the selected filters.
                                                    </td>
                                                </tr>
                                            ) : (
                                            (ssProductsData?.lines || []).map((ln) => (
                                                <tr key={ln.id}>
                                                        <td style={{ padding: 8, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                                            {ln.purchaseDate || '—'}
                                                        </td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.invoiceNo || '—'}</td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.referenceNo || '—'}</td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                                                        <div>{ln.productName || '—'}</div>
                                                        {ln.lineDescription ? (
                                                            <div
                                                                style={{
                                                                    fontSize: '0.75rem',
                                                                    color: 'var(--color-text-muted)',
                                                                    marginTop: 2,
                                                                }}
                                                            >
                                                                {ln.lineDescription}
                                                            </div>
                                                        ) : null}
                                                        </td>
                                                    <td style={{ padding: 8, verticalAlign: 'top' }}>{ln.sku || '—'}</td>
                                                        <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top' }}>
                                                        {Number(ln.qty).toLocaleString(undefined, {
                                                            maximumFractionDigits: 3,
                                                        })}{' '}
                                                        {ln.unit || 'pcs'}
                                                        </td>
                                                        <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top' }}>
                                                        SAR {fmtApMoney(ln.unitPrice)}
                                                    </td>
                                                    <td style={{ padding: 8, textAlign: 'right', verticalAlign: 'top', fontWeight: 700 }}>
                                                        SAR {fmtApMoney(ln.lineTotal)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                {ssProductsData?.total > (ssProductsData?.lines?.length || 0) ? (
                                    <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                        Showing {ssProductsData.lines.length} of {ssProductsData.total} product lines.
                                    </p>
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
                                    <div className="pi-col-qty">
                                        Qty
                                        <span
                                            style={{
                                                display: 'block',
                                                fontWeight: 400,
                                                fontSize: 11,
                                                color: '#64748b',
                                            }}
                                        >
                                            (warehouse)
                                        </span>
                                    </div>
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
                                    <div className="pi-col-total">Last Purchase Price</div>
                                    <div aria-hidden />
                                </div>

                                {lineItems.map((line, idx) => {
                                    const capsRow = findPiCapsRow(line, catalogItems);
                                    const uomOpts = capsRow
                                        ? linePiUomOptions(line, capsRow)
                                        : [String(line.warehouseUnit || line.uom || 'Box').trim() || 'Box'];
                                    const conversionPreview = formatPiUomConversionPreview(
                                        line,
                                        capsRow,
                                    );
                                    return (
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
                                                            setItemPickerSelectedIndex(0);
                                                        }}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setItemPickerLineId(line.id);
                                                            setItemPickerInput(v);
                                                            setItemPickerFilter(v);
                                                            setItemPickerSelectedIndex(0);
                                                        }}
                                                        onKeyDown={(e) =>
                                                            handleLineItemPickerKeyDown(e, line)
                                                        }
                                                        ref={(el) => {
                                                            lineFieldRefs.current[`${line.id}:item`] = el;
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
                                                                        className={`pi-result-item${
                                                                            itemPickerSelectedIndex === i
                                                                                ? ' selected'
                                                                                : ''
                                                                        }`}
                                                                        onMouseDown={(ev) => {
                                                                            ev.preventDefault();
                                                                            applyCatalogPurchaseItemToLine(
                                                                                line.id,
                                                                                invItem,
                                                                            );
                                                                        }}
                                                                        onMouseEnter={() =>
                                                                            setItemPickerSelectedIndex(i)
                                                                        }
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
                                                ref={(el) => {
                                                    lineFieldRefs.current[`${line.id}:account`] = el;
                                                }}
                                                onChange={(e) => updateLineItem(line.id, 'account', e.target.value)}
                                                onKeyDown={(e) =>
                                                    handleLineFieldTab(e, line.id, 'account', idx)
                                                }
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
                                                    onKeyDown={(e) =>
                                                        handleLineFieldTab(
                                                            e,
                                                            line.id,
                                                            'description',
                                                            idx,
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                        <div className="pi-col-uom">
                                            <input
                                                type="text"
                                                className="pi-row-input"
                                                readOnly
                                                title="Purchase quantity is always in warehouse units (e.g. Box)"
                                                value={
                                                    capsRow?.warehouseUnit ||
                                                    line.warehouseUnit ||
                                                    line.uom ||
                                                    uomOpts[0] ||
                                                    'Box'
                                                }
                                                ref={(el) => {
                                                    lineFieldRefs.current[`${line.id}:uom`] = el;
                                                }}
                                                onKeyDown={(e) =>
                                                    handleLineFieldTab(
                                                        e,
                                                        line.id,
                                                        'uom',
                                                        idx,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="pi-col-qty">
                                            <input
                                                type="text"
                                                value={line.qty}
                                                className="pi-row-input-num pi-math-input"
                                                ref={(el) => {
                                                    lineFieldRefs.current[`${line.id}:qty`] = el;
                                                }}
                                                onChange={(e) => updateLineItem(line.id, 'qty', e.target.value)}
                                                onKeyDown={(e) => {
                                                    handleMathKeyDown(e, line.id, 'qty');
                                                    handleLineFieldTab(e, line.id, 'qty', idx);
                                                }}
                                                onBlur={(e) => handleMathBlur(e, line.id, 'qty')}
                                            />
                                            {conversionPreview ? (
                                                <div
                                                    style={{
                                                        fontSize: '0.65rem',
                                                        color: '#64748b',
                                                        lineHeight: 1.3,
                                                        marginTop: 2,
                                                        whiteSpace: 'normal',
                                                    }}
                                                >
                                                    {conversionPreview}
                                                </div>
                                            ) : null}
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
                                                ref={(el) => {
                                                    lineFieldRefs.current[`${line.id}:price`] = el;
                                                }}
                                                onChange={(e) => updateLineItem(line.id, 'price', e.target.value)}
                                                onKeyDown={(e) => {
                                                    handleMathKeyDown(e, line.id, 'price');
                                                    handleLineFieldTab(e, line.id, 'price', idx);
                                                }}
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
                                                    onKeyDown={(e) => {
                                                        handleMathKeyDown(
                                                            e,
                                                            line.id,
                                                            'discount',
                                                        );
                                                        handleLineFieldTab(
                                                            e,
                                                            line.id,
                                                            'discount',
                                                            idx,
                                                        );
                                                    }}
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
                                                    onKeyDown={(e) =>
                                                        handleLineFieldTab(
                                                            e,
                                                            line.id,
                                                            'discountMode',
                                                            idx,
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
                                            <select
                                                className="pi-row-input"
                                                value={line.taxCode}
                                                ref={(el) => {
                                                    lineFieldRefs.current[`${line.id}:taxCode`] = el;
                                                }}
                                                onChange={(e) => updateLineItem(line.id, 'taxCode', e.target.value)}
                                                onKeyDown={(e) =>
                                                    handleLineFieldTab(e, line.id, 'taxCode', idx)
                                                }
                                            >
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
                                            className="pi-col-total"
                                            style={{
                                                background: '#FFFBEB',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {(() => {
                                                if (
                                                    lastPurchaseStockRefreshing &&
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
                                                const lp = lastPurchaseHintForLine(line);
                                                const show =
                                                    lp.hasPrev &&
                                                    Number.isFinite(lp.price) &&
                                                    lp.price > 0;
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
                                                            {Number(lp.price).toLocaleString(undefined, {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 4,
                                                            })}
                                                        </span>
                                                        {lp.meta ? (
                                                            <span
                                                                style={{
                                                                    fontSize: '0.675rem',
                                                                    color: '#475569',
                                                                    fontWeight: 500,
                                                                    whiteSpace: 'normal',
                                                                }}
                                                            >
                                                                {lp.meta}
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
                                                        {superSupplierId
                                                            ? 'No previous purchase from this supplier'
                                                            : 'Select super supplier'}
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
                                    );
                                })}

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
