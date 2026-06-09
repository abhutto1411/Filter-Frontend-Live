import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { formatAffiliatedBranchCustomerLabel } from '../../utils/affiliatedCustomerLabels';

/** Session key: JSON line preset (legacy / fallback). Primary path is router state `salesInvoiceFromAlert`. */
const SI_PRESET_LINE_KEY = 'supplier_sales_invoice_preset_line';

const SALES_INVOICE_FROM_ALERT_KEY = 'salesInvoiceFromAlert';
const FOCUS_SALES_INVOICE_ID_KEY = 'supplier_focus_sales_invoice_id';
const WORKSHOP_PURCHASE_SI_PREFILL_KEY = 'supplier_workshop_purchase_sales_prefill';

/** Router state key for Transaction Hub receipt prefill from Sales Invoices. */
const TRANSACTION_HUB_RECEIPT_PREFILL_KEY = 'transactionHubReceiptPrefill';

function normalizeSalesInvoiceCustomers(branchesRes) {
    const raw = Array.isArray(branchesRes?.customers) ? branchesRes.customers : [];
    if (raw.length) {
        return raw.map((c) => ({
            key: String(c.key),
            group: c.group || 'Customers',
            label: c.label || 'Customer',
            subtitle: c.subtitle ?? null,
            customerType: c.customerType,
            branchId: c.branchId ?? null,
            workshopId: c.workshopId ?? null,
            externalPartyId: c.externalPartyId ?? null,
            disabled: Boolean(c.disabled),
        }));
    }
    const legacy = Array.isArray(branchesRes?.branches) ? branchesRes.branches : [];
    return legacy
        .filter((b) => !b.noBranch && (b.branchId || b.id))
        .map((b) => {
            const branchId = String(b.branchId ?? b.id);
            return {
                key: `affiliated:branch:${branchId}`,
                group: 'Affiliated Workshops',
                label:
                    b.label ||
                    formatAffiliatedBranchCustomerLabel(b.workshopName, b.name),
                subtitle: null,
                customerType: 'affiliated_branch',
                branchId,
                workshopId: b.workshopId != null ? String(b.workshopId) : null,
                externalPartyId: null,
                disabled: false,
            };
        });
}

function customerKeyFromBranchId(branchId) {
    const bid = String(branchId ?? '').trim();
    return bid ? `affiliated:branch:${bid}` : '';
}

function normalizePrefillCustomerOption(customer, prefillFallback = {}) {
    if (!customer || typeof customer !== 'object' || !customer.key) return null;
    return {
        key: String(customer.key),
        group: customer.group || 'Affiliated Workshops',
        label:
            customer.label ||
            formatAffiliatedBranchCustomerLabel(
                prefillFallback.workshopName,
                prefillFallback.branchName,
            ) ||
            'Customer',
        subtitle: customer.subtitle ?? null,
        customerType: customer.customerType || 'affiliated_branch',
        branchId: customer.branchId ?? prefillFallback.branchId ?? null,
        workshopId: customer.workshopId ?? prefillFallback.workshopId ?? null,
        externalPartyId: null,
        disabled: Boolean(customer.disabled),
    };
}

function mergeSalesInvoiceCustomerOption(options, customer, prefillFallback = {}) {
    const c = normalizePrefillCustomerOption(customer, prefillFallback);
    if (!c) return options;
    const list = Array.isArray(options) ? options : [];
    if (list.some((x) => x.key === c.key)) return list;
    return [...list, c].sort((a, b) => {
        const g = (a.group || '').localeCompare(b.group || '');
        if (g !== 0) return g;
        return (a.label || '').localeCompare(b.label || '');
    });
}

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
        supplierLegalName: inv.supplierName,
        supplierName: inv.supplierName,
        supplierVatNumber: inv.supplierVatNumber,
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
            productNameArabic: it.productNameArabic ?? it.product_name_arabic ?? null,
            product_name_arabic: it.productNameArabic ?? it.product_name_arabic ?? null,
            qty: it.qty,
            quantity: it.qty,
            qtyReturned: Number(it.qtyReturned ?? it.qty_returned ?? 0),
            unit: it.unit || 'pcs',
            uom: it.unit || 'pcs',
            qtyWorkshop: it.qtyWorkshop ?? null,
            workshopUnit: it.workshopUnit ?? null,
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

function salesInvoiceSarFmt(v) {
    return Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatSalesInvoiceMgrDate(iso) {
    if (!iso || iso === '—') return '—';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    if (!y || !m || !d) return String(iso);
    return `${d}/${m}/${y}`;
}

function salesInvoiceCustomerLabel(inv) {
    if (!inv || typeof inv !== 'object') return '—';
    return inv.workshopName
        ? `${inv.workshopName} — ${inv.branch}`
        : inv.branch || '—';
}

function salesInvoiceMgrStatus(inv) {
    const balance = Number(inv?.balance ?? 0);
    const paid = Number(inv?.paid ?? 0);
    const due = String(inv?.dueDate ?? '').slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (balance <= 0.005) {
        return { label: 'Paid in full', cls: 'mgr-si-status mgr-si-status--paid' };
    }
    if (due && due < today && balance > 0.005) {
        return { label: 'Overdue', cls: 'mgr-si-status mgr-si-status--overdue' };
    }
    if (paid > 0.005) {
        return { label: 'Partially paid', cls: 'mgr-si-status mgr-si-status--partial' };
    }
    const raw = String(inv?.status || '')
        .replace(/_/g, ' ')
        .trim();
    if (raw === 'draft') {
        return { label: 'Draft', cls: 'mgr-si-status mgr-si-status--draft' };
    }
    return {
        label: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Pending payment',
        cls: 'mgr-si-status mgr-si-status--pending',
    };
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
    return { id: String(id), nameBase, typeLabel, optionLabel, cashBankLabel: optionLabel, raw     };
}

/** Prefill payload for Accounting → Transaction Hub → Receipts tab. */
function buildTransactionHubReceiptPrefill(inv) {
    const today = new Date().toISOString().slice(0, 10);
    const balance = Number(inv?.balance ?? 0);
    let payeeValue = '';
    if (inv?.branchId != null && String(inv.branchId).trim() !== '') {
        payeeValue = `branch|${String(inv.branchId).trim()}`;
    } else if (inv?.workshopId != null && String(inv.workshopId).trim() !== '') {
        payeeValue = `workshop|${String(inv.workshopId).trim()}`;
    }
    const invoiceNo = String(inv?.invoiceNo || '').trim();
    return {
        tab: 'receipt',
        variant: 'receipt',
        headerDate: today,
        headerRef: invoiceNo,
        generalNote: invoiceNo ? `Payment received for sales invoice ${invoiceNo}` : '',
        cashBankLabel: String(inv?.cashBankAccount || '').trim() || undefined,
        salesInvoiceId: inv?.id != null ? String(inv.id) : undefined,
        lines: [
            {
                lineDate: today,
                payType: 'customer',
                payeeValue,
                amount: balance > 0 ? String(roundMoney2(balance)) : '',
                lineReference: invoiceNo,
                notes: salesInvoiceCustomerLabel(inv),
            },
        ],
    };
}

function mapSupplierInvoicesListFromResponse(invRes) {
    if (!invRes || !Array.isArray(invRes.invoices)) return [];
    return invRes.invoices.map((inv) => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        branch: inv.branch?.name || '-',
        branchId: inv.branch?.id,
        workshopId: inv.workshop?.id ?? null,
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
    const unitCostWh =
        qtyWh > 0 ? Number(item.valueWarehouseSar || 0) / qtyWh : 0;
    const conversionFactor = Number(item.conversionFactor) || 1;
    const warehouseUnit =
        item.warehouseUnit || item.unitCode || item.unit || 'Box';
    const workshopUnit = item.workshopUnit || 'pcs';
    const suggestedWs = Number(item.suggestedSaleUnitPriceWorkshop ?? NaN);
    const suggestedWh =
        Number.isFinite(suggestedWs) && suggestedWs > 0
            ? suggestedWs * conversionFactor
            : unitCostWh;
    const price =
        Number.isFinite(suggestedWh) && suggestedWh > 0
            ? Math.max(0, suggestedWh)
            : Number.isFinite(unitCostWh)
              ? Math.max(0, unitCostWh)
              : 0;
    const uom = warehouseUnit;
    const costHint =
        qtyWh > 0
            ? `Warehouse stock: ${qtyWh} ${warehouseUnit} • Unit cost SAR ${unitCostWh.toLocaleString(undefined, { maximumFractionDigits: 4 })} / ${warehouseUnit}`
            : 'No warehouse stock — you can still enter qty/price; save may be blocked if over stock.';
    const listHint =
        Number.isFinite(suggestedWh) && suggestedWh > 0
            ? `Suggested list SAR ${suggestedWh.toFixed(2)} / ${warehouseUnit} (invoice default)`
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

    return {
    id: catalogId ?? `row-${item.productName}-${item.sku || ''}`,
    name: item.productName || 'Product',
    sku: String(item.sku ?? item.barcode ?? '').trim(),
    price,
    unit: uom,
    warehouseUnit,
    workshopUnit,

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
        if (isWarehouseUomLine(ln, inv)) continue;
        otherSum += parseFloat(String(ln.qty).replace(',', '.')) || 0;
    }
    return Math.max(0, roundMoney2(cap - otherSum));
}

function normUomLabel(u) {
    return String(u ?? '').trim().toLowerCase();
}

function isWarehouseUomLine(line, inv) {
    const wu = normUomLabel(inv?.warehouseUnit);
    const u = normUomLabel(line?.uom);
    return !!wu && !!u && u === wu;
}

function maxSellableQtyWarehouseForLine(line, lines, inventoryItems) {
    const inv = findInventoryCapsRow(line, inventoryItems);
    if (!inv || !Number.isFinite(Number(inv.warehouseStockQty))) {
        return null;
    }
    const cap = Number(inv.warehouseStockQty);
    const key = salesLineStockKey(line);
    if (!key) return null;
    let otherSum = 0;
    for (const ln of lines) {
        if (ln.id === line.id) continue;
        if (salesLineStockKey(ln) !== key) continue;
        if (!isWarehouseUomLine(ln, inv)) continue;
        otherSum += parseFloat(String(ln.qty).replace(',', '.')) || 0;
    }
    return Math.max(0, roundMoney2(cap - otherSum));
}

function maxSellableQtyForLine(line, lines, inventoryItems) {
    const inv = findInventoryCapsRow(line, inventoryItems);
    if (!inv) return null;
    return isWarehouseUomLine(line, inv)
        ? maxSellableQtyWarehouseForLine(line, lines, inventoryItems)
        : maxSellableQtyWorkshopForLine(line, lines, inventoryItems);
}

function lineUomOptions(line, inv) {
    const opts = [];
    const wu = String(inv?.warehouseUnit ?? '').trim();
    const wsu = String(inv?.workshopUnit ?? '').trim();
    if (wu) opts.push(wu);
    if (wsu && normUomLabel(wsu) !== normUomLabel(wu)) opts.push(wsu);
    if (opts.length === 0) {
        return [String(line?.uom ?? 'pcs').trim() || 'pcs'];
    }
    return opts;
}

function formatLineUomConversionPreview(line, inv) {
    if (!inv) return '';
    const cf = Number(inv.conversionFactor) || 1;
    if (!(cf > 1)) return '';
    const wu = inv.warehouseUnit || 'Box';
    const wsu = inv.workshopUnit || 'pcs';
    const qty = parseFloat(String(line.qty).replace(',', '.')) || 0;
    if (!(qty > 0)) return '';
    const price = parseFloat(String(line.price).replace(',', '.')) || 0;
    if (isWarehouseUomLine(line, inv)) {
        const wsQty = roundMoney2(qty * cf);
        const wsPrice = cf > 0 ? roundMoney2(price / cf) : price;
        return `${qty} ${wu} = ${wsQty} ${wsu} at workshop · SAR ${price.toFixed(2)}/${wu} → SAR ${wsPrice.toFixed(2)}/${wsu}`;
    }
    const whQty = roundMoney2(qty / cf);
    const whPrice = roundMoney2(price * cf);
    return `${qty} ${wsu} = ${whQty} ${wu} warehouse · SAR ${price.toFixed(2)}/${wsu} → SAR ${whPrice.toFixed(2)}/${wu}`;
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
    const [invoiceListSearch, setInvoiceListSearch] = useState('');
    const [invoiceListFilter, setInvoiceListFilter] = useState('all');
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
    const [editingInvoiceStatus, setEditingInvoiceStatus] = useState(null);
    const saveErrorRef = useRef(null);

    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [refNo, setRefNo] = useState('');
    const [selectedCustomerKey, setSelectedCustomerKey] = useState('');
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
    const [customerPickerIndex, setCustomerPickerIndex] = useState(-1);
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
    const [customerOptions, setCustomerOptions] = useState([]);
    /** Set when GET /supplier/invoices/customer-branches fails (network, auth, server). */
    const [customerBranchesLoadError, setCustomerBranchesLoadError] =
        useState('');
    const customerSearchWrapRef = useRef(null);
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

    const selectedCustomer = useMemo(
        () => customerOptions.find((c) => c.key === selectedCustomerKey) ?? null,
        [customerOptions, selectedCustomerKey],
    );

    const isWalkInCustomer = selectedCustomer?.customerType === 'external_party';
    const isEditingDraft =
        invoiceModalMode === 'edit' && editingInvoiceStatus === 'draft';
    const saveDisabledCommon =
        saving ||
        editInvoiceLoading ||
        !selectedCustomerKey ||
        lineItems.length === 0;
    const issueSaveDisabled =
        saveDisabledCommon ||
        (invoiceModalMode === 'create' && !inventoryInitialLoadDone);
    const draftSaveDisabled = saveDisabledCommon;
    const issueButtonLabel = isEditingDraft
        ? isWalkInCustomer
            ? 'Create Sale Invoice'
            : 'Issue Sales Invoice'
        : invoiceModalMode === 'edit'
          ? 'Update Invoice'
          : isWalkInCustomer
            ? 'Create Sale Invoice'
            : 'Issue Sales Invoice';
    const showDraftSaveButton =
        invoiceModalMode === 'create' || isEditingDraft;

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

    const lineFieldRefs = useRef({});
    const pendingFocusLineFieldRef = useRef(null);
    const [itemPickerSelectedIndex, setItemPickerSelectedIndex] = useState(0);

    const focusLineField = useCallback((lineId, fieldName) => {
        requestAnimationFrame(() => {
            lineFieldRefs.current[`${lineId}:${fieldName}`]?.focus?.();
        });
    }, []);

    useEffect(() => {
        if (saveError && saveErrorRef.current) {
            saveErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [saveError]);

    useEffect(() => {
        const pending = pendingFocusLineFieldRef.current;
        if (!pending) return;
        pendingFocusLineFieldRef.current = null;
        focusLineField(pending.lineId, pending.fieldName);
    }, [lineItems.length, focusLineField]);

    const filteredCustomerOptions = useMemo(() => {
        const q = customerSearchQuery.trim().toLowerCase();
        const list = customerOptions.filter((c) => !c.disabled);
        if (!q) return list;
        return list.filter((c) => {
            const hay = [c.label, c.group, c.subtitle].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [customerOptions, customerSearchQuery]);

    /** Line preset from Workshop Alerts; applied after inventory load (avoids session + Strict Mode races). */
    const salesInvoiceAlertLinePresetRef = useRef(null);
    /** Workshop purchase order id when issuing AR from Prepare sales invoice. */
    const workshopPurchaseSourceIdRef = useRef(null);
    const workshopPurchasePrefillRef = useRef(null);

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
            const recalc = new Set(['qty', 'price', 'taxCode', 'discount', 'discountMode', 'uom']);
            setLineItems((prev) =>
                prev.map((line) => {
                    if (line.id !== id) return line;
                    let nextVal = value;
                    if (field === 'qty') {
                        const maxW = maxSellableQtyForLine(line, prev, inventoryItems);
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
                    let updated = { ...line, [field]: nextVal };
                    if (field === 'uom') {
                        const inv = findInventoryCapsRow(line, inventoryItems);
                        const cf = Number(inv?.conversionFactor) || 1;
                        const oldIsWh = isWarehouseUomLine(line, inv);
                        const newIsWh = isWarehouseUomLine(updated, inv);
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
                const maxW = maxSellableQtyForLine(line, prev, inventoryItems);
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
        const lineId = nextLineId();
        const unitPrice = Number(item.price) || 0;
        const hasPrev = !!item.hasPreviousSale;
        const lastSaleAmt = hasPrev ? Number(item.lastPrice ?? 0) : 0;
        const catId =
            item.catalogProductResolved && item.id != null && String(item.id).trim() !== ''
                ? String(item.id)
                : '';
        const rawLine = {
            id: lineId,
            sku: item.sku || '',
            item: item.name,
            account: '4100 - Sales Revenue',
            description: '',
            uom: item.unit || item.warehouseUnit || 'Box',
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
        pendingFocusLineFieldRef.current = { lineId, fieldName: 'item' };
        return lineId;
    }, [amountsTaxInclusive]);

    const removeLineItem = (lineId) => {
        setLineItems((prev) => prev.filter((l) => l.id !== lineId));
    };

    const addEmptyLine = () => {
        const lineId = nextLineId();
        const rawLine = {
            id: lineId,
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
        addEmptyLine();
    };

    const handleKeyDown = (e) => {
        if (!showDropdown) return;
        if (e.key === 'ArrowDown') {
            setSelectedIndex((i) => (i < searchResults.length - 1 ? i + 1 : i));
        } else if (e.key === 'ArrowUp') {
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
        setSelectedCustomerKey('');
        setCustomerSearchQuery('');
        setCustomerPickerOpen(false);
        setCustomerPickerIndex(-1);
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
        setEditingInvoiceStatus(null);
        workshopPurchaseSourceIdRef.current = null;
        workshopPurchasePrefillRef.current = null;
    };

    const applyWorkshopPurchasePrefill = useCallback(
        (prefill) => {
            if (!prefill || typeof prefill !== 'object') return;
            workshopPurchasePrefillRef.current = prefill;
            workshopPurchaseSourceIdRef.current =
                prefill.workshopPurchaseInvoiceId != null
                    ? String(prefill.workshopPurchaseInvoiceId)
                    : null;
            if (prefill.issueDate) setIssueDate(String(prefill.issueDate).slice(0, 10));
            if (prefill.dueDateType) setDueDateType(prefill.dueDateType);
            if (prefill.netDays != null) setNetDays(String(prefill.netDays));
            if (prefill.customDueDate) setCustomDueDate(String(prefill.customDueDate).slice(0, 10));
            if (prefill.refNo) setRefNo(String(prefill.refNo));
            if (prefill.internalNotes) setInternalNotes(String(prefill.internalNotes));
            if (prefill.freightIn != null) setFreightCharges(String(prefill.freightIn));
            if (prefill.invoiceDiscount != null) {
                setInvoiceDiscountValue(String(prefill.invoiceDiscount));
            }
            if (prefill.invoiceDiscountMode === 'percent') {
                setInvoiceDiscountMode('percent');
            }
            if (prefill.customerKey) {
                setSelectedCustomerKey(String(prefill.customerKey));
            } else if (prefill.branchId) {
                setSelectedCustomerKey(customerKeyFromBranchId(prefill.branchId));
            }
            if (prefill.customer) {
                setCustomerOptions((prev) =>
                    mergeSalesInvoiceCustomerOption(prev, prefill.customer, prefill),
                );
            }
            setDescription(
                prefill.workshopPurchaseInvoiceNumber
                    ? `Workshop order ${prefill.workshopPurchaseInvoiceNumber}`
                    : '',
            );
        },
        [],
    );

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

    const handleSaveInvoice = async (saveMode = 'issue') => {
        const isDraftSave = saveMode === 'draft';
        const isEditingDraft =
            invoiceModalMode === 'edit' && editingInvoiceStatus === 'draft';
        const isFinalizingDraft = !isDraftSave && isEditingDraft;

        setSaveError('');
        if (!selectedCustomerKey || !selectedCustomer) {
            setSaveError('Select a customer.');
            return;
        }
        if (selectedCustomer.disabled) {
            setSaveError('Selected customer is inactive.');
            return;
        }
        if (lineItems.length === 0) {
            setSaveError('Add at least one line item.');
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
        if (isDraftSave) {
            const namedLine = normalizedLines.find((line) => line.productName);
            if (!namedLine) {
                setSaveError('Add at least one product name to save a draft.');
                return;
            }
        } else {
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
                const maxCap = maxSellableQtyForLine(row, lineItems, inventoryItems);
                if (maxCap == null || !Number.isFinite(maxCap)) continue;
                const qNum = normalizedLines[i].qty;
                if (qNum > maxCap + 1e-6) {
                    setSaveError(
                        `Line ${i + 1}: quantity ${qNum} exceeds available supplier stock (${maxCap} ${normalizedLines[i].unit} max across this invoice).`,
                    );
                    return;
                }
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
            ...(selectedCustomer.customerType === 'external_party' &&
            selectedCustomer.externalPartyId
                ? { externalPartyId: String(selectedCustomer.externalPartyId) }
                : {}),
            ...(selectedCustomer.customerType === 'affiliated_workshop' &&
            selectedCustomer.workshopId
                ? { affiliatedWorkshopId: String(selectedCustomer.workshopId) }
                : {}),
            ...(workshopPurchaseSourceIdRef.current
                ? {
                      workshopPurchaseInvoiceId: workshopPurchaseSourceIdRef.current,
                      origin: 'workshop_purchase_request',
                      invoiceCategory: 'sales_invoice',
                  }
                : {}),
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
                    ...(isFinalizingDraft ? { status: 'pending_payment' } : {}),
                    items: itemsPayload,
                });
                if (isDraftSave) {
                    await loadInvoiceList({ silent: true });
                    return;
                }
                if (isFinalizingDraft) {
                    setEditingInvoiceStatus('pending_payment');
                }
            } else {
                const prefix = isDraftSave ? 'DRAFT' : 'WPI-SI';
                const invoiceNo =
                    (refNo && String(refNo).trim()) ||
                    `${prefix}-${Date.now().toString(36).toUpperCase()}`;
                const res = await createSupplierInvoice({
                    invoiceNo,
                    invoiceDate: issueDate,
                    dueDate: due,
                    ...(selectedCustomer.branchId
                        ? { branchId: String(selectedCustomer.branchId) }
                        : {}),
                    paymentTerms: dueDateType === 'Net' ? `Net ${netDays}` : dueDateType,
                    deliveryNoteUrl: description?.trim() || undefined,
                    ...(internalNotes.trim()
                        ? { internalNotes: internalNotes.trim() }
                        : {}),
                    freightIn: fin.freightIn,
                    invoiceDiscount: fin.invoiceDiscount,
                    salesInvoiceMeta,
                    status: isDraftSave ? 'draft' : 'pending_payment',
                    items: itemsPayload,
                });
                if (isDraftSave) {
                    setInvoiceModalMode('edit');
                    setEditingInvoiceId(res?.invoiceId || null);
                    setEditingInvoiceStatus('draft');
                    if (res?.invoiceNo) setRefNo(res.invoiceNo);
                    await loadInvoiceList({ silent: true });
                    return;
                }
            }
            setModalOpen(false);
            setInvoiceModalMode('create');
            setEditingInvoiceId(null);
            setEditingInvoiceStatus(null);
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
            setEditingInvoiceStatus(inv.status || 'pending_payment');
            const wpiFromMeta =
                m.workshopPurchaseInvoiceId ?? m.workshop_purchase_invoice_id;
            workshopPurchaseSourceIdRef.current =
                wpiFromMeta != null && String(wpiFromMeta).trim() !== ''
                    ? String(wpiFromMeta).trim()
                    : null;
            setIssueDate(inv.invoiceDate || issueDate);
            const m =
                inv.salesInvoiceMeta != null && typeof inv.salesInvoiceMeta === 'object'
                    ? inv.salesInvoiceMeta
                    : {};
            if (m.externalPartyId) {
                setSelectedCustomerKey(`external:${String(m.externalPartyId)}`);
            } else if (m.affiliatedWorkshopId) {
                setSelectedCustomerKey(`affiliated:workshop:${String(m.affiliatedWorkshopId)}`);
            } else if (inv.branch?.id != null) {
                setSelectedCustomerKey(customerKeyFromBranchId(inv.branch.id));
            } else {
                setSelectedCustomerKey('');
            }
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
                            uom: it.unit || it.supplierProduct?.warehouseUnit || 'pcs',
                            qtyWorkshop: it.qtyWorkshop ?? null,
                            workshopUnit: it.workshopUnit ?? it.supplierProduct?.workshopUnit ?? null,
                            warehouseUnit: it.supplierProduct?.warehouseUnit ?? null,
                            workshopUnitCatalog: it.supplierProduct?.workshopUnit ?? null,
                            conversionFactor:
                                it.supplierProduct?.conversionFactor != null
                                    ? Number(it.supplierProduct.conversionFactor)
                                    : 1,
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

    useEffect(() => {
        try {
            const focusId = sessionStorage.getItem(FOCUS_SALES_INVOICE_ID_KEY);
            if (!focusId || !String(focusId).trim()) return;
            sessionStorage.removeItem(FOCUS_SALES_INVOICE_ID_KEY);
            handleViewInvoice({ id: String(focusId).trim() });
        } catch {
            /* ignore */
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount (workshop order → sales invoice link)
    }, []);

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

    const goRecordPaymentInHub = (inv) => {
        const prefill = buildTransactionHubReceiptPrefill(inv);
        try {
            sessionStorage.setItem(
                TRANSACTION_HUB_RECEIPT_PREFILL_KEY,
                JSON.stringify(prefill),
            );
        } catch {
            /* ignore quota / private mode */
        }
        navigate('/supplier/accounting/hub', {
            state: { [TRANSACTION_HUB_RECEIPT_PREFILL_KEY]: prefill },
        });
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
    const filteredList = useMemo(() => {
        let rows = list;
        const q = invoiceListSearch.trim().toLowerCase();
        if (q) {
            rows = rows.filter((inv) => {
                const hay = [
                    inv.invoiceNo,
                    inv.vendorRef,
                    inv.productLabel,
                    salesInvoiceCustomerLabel(inv),
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return hay.includes(q);
            });
        }
        const today = new Date().toISOString().slice(0, 10);
        if (invoiceListFilter === 'unpaid') {
            rows = rows.filter((inv) => Number(inv.balance ?? 0) > 0.005);
        } else if (invoiceListFilter === 'paid') {
            rows = rows.filter((inv) => Number(inv.balance ?? 0) <= 0.005);
        } else if (invoiceListFilter === 'overdue') {
            rows = rows.filter((inv) => {
                const due = String(inv.dueDate ?? '').slice(0, 10);
                return Number(inv.balance ?? 0) > 0.005 && due && due < today;
            });
        }
        return rows;
    }, [list, invoiceListSearch, invoiceListFilter]);
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

    const selectCustomerOption = (customer) => {
        if (!customer || customer.disabled) return;
        setSelectedCustomerKey(customer.key);
        setCustomerSearchQuery('');
        setCustomerPickerOpen(false);
        setCustomerPickerIndex(-1);
    };

    const handleCustomerSearchKeyDown = (e) => {
        if (invoiceModalMode === 'edit') return;
        if (!customerPickerOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setCustomerPickerOpen(true);
                e.preventDefault();
            }
            return;
        }
        if (e.key === 'Escape') {
            setCustomerPickerOpen(false);
            setCustomerPickerIndex(-1);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setCustomerPickerIndex((i) =>
                Math.min(i + 1, Math.max(0, filteredCustomerOptions.length - 1)),
            );
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setCustomerPickerIndex((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === 'Enter' && customerPickerIndex >= 0) {
            e.preventDefault();
            selectCustomerOption(filteredCustomerOptions[customerPickerIndex]);
        }
    };

    useEffect(() => {
        if (!modalOpen || !customerPickerOpen) return undefined;
        const onDocMouseDown = (e) => {
            const el = customerSearchWrapRef.current;
            if (el && !el.contains(e.target)) {
                setCustomerPickerOpen(false);
                setCustomerPickerIndex(-1);
            }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [modalOpen, customerPickerOpen]);

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
                    uom: catalogItem.unit || catalogItem.warehouseUnit || line.uom || 'pcs',
                    warehouseUnit: catalogItem.warehouseUnit ?? line.warehouseUnit ?? null,
                    workshopUnitCatalog: catalogItem.workshopUnit ?? line.workshopUnitCatalog ?? null,
                    conversionFactor: catalogItem.conversionFactor ?? line.conversionFactor ?? 1,
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
        focusLineField(lineId, 'item');
    };

    const handleLineItemPickerKeyDown = (e, line) => {
        const suggestions = getSearchSuggestions(itemPickerFilter);
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
                applyCatalogItemToLine(line.id, suggestions[itemPickerSelectedIndex]);
                return;
            }
            const text = String(itemPickerInputRef.current ?? '').trim();
            setLineItems((prev) =>
                prev.map((l) =>
                    l.id === line.id ? { ...l, item: text } : l,
                ),
            );
            setItemPickerLineId(null);
            setItemPickerInput('');
            setItemPickerFilter('');
            focusLineField(line.id, 'item');
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setItemPickerLineId(null);
            setItemPickerInput('');
            setItemPickerFilter('');
        }
    };

    useEffect(() => {
        setItemPickerSelectedIndex(0);
    }, [itemPickerFilter, itemPickerLineId]);

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
                if (branchesRes && branchesRes.__error) {
                    branchesErr =
                        branchesRes.__error?.message ||
                        (typeof branchesRes.__error === 'string'
                            ? branchesRes.__error
                            : branchesErrDefault);
                }

                setCustomerBranchesLoadError(branchesErr);
                setInventoryItems(mergeInventoryLists(stockItems, INVENTORY_ITEMS));
                let customers = normalizeSalesInvoiceCustomers(branchesRes);
                const wpiPrefill = workshopPurchasePrefillRef.current;
                if (wpiPrefill?.customer) {
                    customers = mergeSalesInvoiceCustomerOption(
                        customers,
                        wpiPrefill.customer,
                        wpiPrefill,
                    );
                }
                setCustomerOptions(customers);

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
        const bid = selectedCustomer?.branchId ? String(selectedCustomer.branchId) : '';
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
                                uom: line.uom || inv.unit,
                                warehouseUnit: inv.warehouseUnit ?? line.warehouseUnit,
                                workshopUnitCatalog: inv.workshopUnit ?? line.workshopUnitCatalog,
                                conversionFactor: inv.conversionFactor ?? line.conversionFactor,
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
    }, [modalOpen, inventoryInitialLoadDone, selectedCustomerKey, selectedCustomer?.branchId]);

    useEffect(() => {
        if (!modalOpen) {
            setLastSaleStockRefreshing(false);
        }
    }, [modalOpen]);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(WORKSHOP_PURCHASE_SI_PREFILL_KEY);
            if (raw) {
                sessionStorage.removeItem(WORKSHOP_PURCHASE_SI_PREFILL_KEY);
                const prefill = JSON.parse(raw);
                if (prefill && typeof prefill === 'object') {
                    setInvoiceModalMode('create');
                    setEditingInvoiceId(null);
                    resetInvoiceForm();
                    applyWorkshopPurchasePrefill(prefill);
                    setModalOpen(true);
                    return;
                }
            }
        } catch {
            /* ignore */
        }
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
                setSelectedCustomerKey(customerKeyFromBranchId(bid));
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
                    setSelectedCustomerKey(customerKeyFromBranchId(presetBranch));
                }
                setModalOpen(true);
            }
        } catch {
            /* ignore */
        }
    }, [location.state, location.pathname, location.search, navigate, applyWorkshopPurchasePrefill]);

    useEffect(() => {
        if (!modalOpen || !inventoryInitialLoadDone) return;
        if (invoiceModalMode !== 'create' || editingInvoiceId != null) return;

        const wpiPrefill = workshopPurchasePrefillRef.current;
        if (wpiPrefill && Array.isArray(wpiPrefill.lines) && wpiPrefill.lines.length > 0) {
            workshopPurchasePrefillRef.current = null;
            const built = [];
            for (const ln of wpiPrefill.lines) {
                const nameTrim = String(ln.productName ?? '').trim();
                if (!nameTrim) continue;
                const sid =
                    ln.supplierProductId != null && String(ln.supplierProductId).trim() !== ''
                        ? String(ln.supplierProductId).trim()
                        : '';
                let match = sid
                    ? inventoryItems.find((i) => String(i.id) === sid)
                    : null;
                if (!match) {
                    match = inventoryItems.find(
                        (i) =>
                            String(i.name || '').trim().toLowerCase() ===
                            nameTrim.toLowerCase(),
                    );
                }
                const vatRate = Number(ln.vatRate ?? 15);
                const taxCode =
                    TAXES.find((t) => Math.abs(t.percent - vatRate) < 0.01)?.code || 'VAT 15%';
                const qty = Number(ln.qty) > 0 ? Number(ln.qty) : 1;
                const unitPrice = Number(ln.unitPrice) || 0;
                const lineId = nextLineId();
                const rawLine = {
                    id: lineId,
                    sku: String(ln.sku ?? '').trim(),
                    item: nameTrim,
                    account: '4100 - Sales Revenue',
                    description: String(ln.lineDescription ?? '').trim(),
                    uom: String(ln.unit || 'pcs').trim() || 'pcs',
                    qty: String(qty),
                    price: String(unitPrice),
                    discount: Number(ln.lineDiscount ?? 0),
                    discountMode:
                        ln.lineDiscountMode === 'percent' ? 'percent' : 'fixed_sar',
                    taxCode,
                    taxAmt: '0.00',
                    totalFinal: '0.00',
                    supplierStockProductId: sid || null,
                    supplierProductId: sid,
                    workshopCatalogProductId: ln.workshopCatalogProductId
                        ? String(ln.workshopCatalogProductId)
                        : null,
                    hasPreviousSale: false,
                    lastSalePrice: 0,
                    lastSaleMeta: '',
                };
                if (match) {
                    rawLine.sku = match.sku || rawLine.sku;
                    rawLine.uom = ln.unit || match.unit || match.warehouseUnit || 'pcs';
                    rawLine.warehouseUnit = match.warehouseUnit ?? null;
                    rawLine.workshopUnitCatalog = match.workshopUnit ?? null;
                    rawLine.conversionFactor = match.conversionFactor ?? 1;
                    rawLine.supplierStockProductId = match.supplierStockProductId ?? sid;
                    rawLine.supplierProductId = String(match.id);
                    rawLine.hasPreviousSale = !!match.hasPreviousSale;
                    rawLine.lastSalePrice = match.hasPreviousSale
                        ? Number(match.lastPrice ?? 0)
                        : 0;
                    rawLine.lastSaleMeta = match.hasPreviousSale
                        ? String(match.lastSaleMeta || '').trim()
                        : '';
                }
                built.push(applyLineTotals(rawLine, amountsTaxInclusive));
            }
            if (built.length) setLineItems(built);
            return;
        }

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
        <div className="mgr-si-page">
            <header className="mgr-si-header">
                <div className="mgr-si-header-top">
                    <div className="mgr-si-breadcrumb">Sales Invoices (AR)</div>
                    <div className="mgr-si-toolbar-actions">
                        <button
                            type="button"
                            className="mgr-si-btn-new"
                            onClick={openNewInvoiceModal}
                        >
                            <Plus size={16} /> New Invoice
                        </button>
                    </div>
                </div>
                <h2 className="mgr-si-title">Sales Invoices (AR)</h2>
                <p className="mgr-si-subtitle">
                    Warehouse → workshop invoices. Creates <strong>Accounts Receivable</strong> for you and a{' '}
                    <strong>Purchase Invoice</strong> on the workshop side. Auto-posted to GL on save
                    (AR/Sales/VAT/COGS).
                </p>
            </header>

            <div className="mgr-si-toolbar">
                <div className="mgr-si-filter-bar">
                    <span className="mgr-si-filter-label">Where</span>
                    <select
                        className="mgr-si-filter-select"
                        value={invoiceListFilter}
                        onChange={(e) => setInvoiceListFilter(e.target.value)}
                        aria-label="Filter invoices"
                    >
                        <option value="all">All invoices</option>
                        <option value="unpaid">Balance due is greater than 0</option>
                        <option value="overdue">Balance due is overdue</option>
                        <option value="paid">Balance due is 0 (paid in full)</option>
                    </select>
                </div>
                <div className="mgr-si-search-wrap">
                    <div className="mgr-si-search-input-wrap">
                        <Search size={16} className="mgr-si-search-icon" aria-hidden />
                        <input
                            type="search"
                            className="mgr-si-search-input"
                            placeholder="Search reference, customer, description…"
                            value={invoiceListSearch}
                            onChange={(e) => setInvoiceListSearch(e.target.value)}
                            aria-label="Search sales invoices"
                        />
                    </div>
                    <button
                        type="button"
                        className="mgr-si-search-btn"
                        onClick={() => void loadInvoiceList()}
                    >
                        Search
                    </button>
                </div>
            </div>

            {listError ? (
                <div className="mgr-si-error">{listError}</div>
            ) : null}

            <div className="premium-table mgr-si-table-wrap">
                <div style={{ overflowX: 'auto' }}>
                    {listLoading && list.length === 0 ? (
                        <div style={{ padding: 16 }}>
                            <ShimmerTable rows={8} columns={9} />
                        </div>
                    ) : (
                        <>
                            <table className="mgr-si-table">
                                <thead>
                                    <tr className="table-header-row">
                                        <th className="table-th">Issue date</th>
                                        <th className="table-th">Due date</th>
                                        <th className="table-th">Reference</th>
                                        <th className="table-th">Customer</th>
                                        <th className="table-th">Description</th>
                                        <th className="table-th">Invoice Amount</th>
                                        <th className="table-th">Balance due</th>
                                        <th className="table-th">Status</th>
                                        <th className="table-th mgr-si-th-actions">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!listLoading && filteredList.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="table-cell table-empty">
                                                <FileText
                                                    size={36}
                                                    style={{
                                                        opacity: 0.25,
                                                        margin: '0 auto 12px',
                                                        display: 'block',
                                                    }}
                                                />
                                                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                                                    {list.length === 0
                                                        ? 'No sales invoices yet'
                                                        : 'No invoices match your search or filter'}
                                                </div>
                                                {list.length === 0 ? (
                                                    <>
                                                        <div
                                                            style={{
                                                                fontSize: '0.8125rem',
                                                                marginBottom: 16,
                                                            }}
                                                        >
                                                            Issue a warehouse → workshop invoice; it will appear here.
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="mgr-si-btn-new"
                                                            onClick={openNewInvoiceModal}
                                                        >
                                                            <Plus size={15} /> Create first invoice
                                                        </button>
                                                    </>
                                                ) : null}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredList.map((inv) => {
                                            const isDraft = inv.status === 'draft';
                                            const canMutate = inv.status === 'pending_payment';
                                            const canEdit = isDraft || canMutate;
                                            const mgrStatus = salesInvoiceMgrStatus(inv);
                                            const arSettle = salesInvoiceArSettlementLabel(inv);
                                            const refLabel = inv.invoiceNo || inv.id;
                                            return (
                                                <tr key={inv.id} className="table-row">
                                                    <td className="table-cell mgr-si-cell-date">
                                                        {formatSalesInvoiceMgrDate(inv.date)}
                                                    </td>
                                                    <td className="table-cell mgr-si-cell-date">
                                                        {formatSalesInvoiceMgrDate(inv.dueDate)}
                                                    </td>
                                                    <td className="table-cell">
                                                        <button
                                                            type="button"
                                                            className="mgr-si-ref-link"
                                                            onClick={() => handleViewInvoice(inv)}
                                                            title="View invoice"
                                                        >
                                                            {refLabel}
                                                        </button>
                                                    </td>
                                                    <td
                                                        className="table-cell mgr-si-cell-customer"
                                                        title={salesInvoiceCustomerLabel(inv)}
                                                    >
                                                        {salesInvoiceCustomerLabel(inv)}
                                                    </td>
                                                    <td
                                                        className="table-cell mgr-si-cell-desc"
                                                        title={inv.productLabel || ''}
                                                    >
                                                        {inv.productLabel && inv.productLabel !== '—'
                                                            ? inv.productLabel
                                                            : '—'}
                                                    </td>
                                                    <td className="table-cell mgr-si-cell-amount">
                                                        SAR {salesInvoiceSarFmt(inv.amount)}
                                                    </td>
                                                    <td className="table-cell mgr-si-cell-balance">
                                                        <span>SAR {salesInvoiceSarFmt(inv.balance)}</span>
                                                        {Number(inv.returnsTotal || 0) > 0 ? (
                                                            <div className="mgr-si-returns-note">
                                                                − SAR{' '}
                                                                {salesInvoiceSarFmt(inv.returnsTotal)} returns
                                                            </div>
                                                        ) : null}
                                                        {arSettle.text !== 'Paid' && canMutate ? (
                                                            <button
                                                                type="button"
                                                                className="mgr-si-record-pay"
                                                                onClick={() => goRecordPaymentInHub(inv)}
                                                            >
                                                                Record payment
                                                            </button>
                                                        ) : null}
                                                    </td>
                                                    <td className="table-cell">
                                                        <span className={mgrStatus.cls}>{mgrStatus.label}</span>
                                                    </td>
                                                    <td className="table-cell mgr-si-cell-actions">
                                                        <div className="mgr-si-action-icons">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleViewInvoice(inv)}
                                                                className="mgr-si-icon-btn"
                                                                title="View"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={salesInvoicePdfBusy}
                                                                onClick={() => handleDownloadInvoice(inv)}
                                                                className="mgr-si-icon-btn"
                                                                title="Download PDF"
                                                            >
                                                                <Download size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openReturnModal(inv)}
                                                                className="mgr-si-icon-btn mgr-si-icon-btn--return"
                                                                title="Record return / credit"
                                                            >
                                                                <RotateCcw size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={!canEdit}
                                                                onClick={() => openEditInvoice(inv)}
                                                                className={`mgr-si-icon-btn mgr-si-icon-btn--edit${
                                                                    canEdit ? '' : ' mgr-si-icon-btn--disabled'
                                                                }`}
                                                                title={isDraft ? 'Edit draft' : 'Edit'}
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                            {!listLoading && invoiceListTotal > 0 && invoiceListTotalPages > 1 ? (
                                <div className="mgr-si-pagination">
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
                                    <span className="mgr-si-pagination-meta">
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
                                        {invoiceModalMode === 'edit'
                                            ? editingInvoiceStatus === 'draft'
                                                ? 'Draft'
                                                : 'Edit'
                                            : 'New'}
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
                                        type="button"
                                        className="btn-pi-cancel"
                                        onClick={closeInvoiceModal}
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="pi-footer-right">
                                    {saveError ? (
                                        <div
                                            ref={saveErrorRef}
                                            style={{
                                                flex: '1 1 100%',
                                                marginBottom: 8,
                                                padding: '8px 12px',
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
                                    {showDraftSaveButton ? (
                                        <button
                                            type="button"
                                            className="btn-pi-draft"
                                            onClick={() => void handleSaveInvoice('draft')}
                                            disabled={draftSaveDisabled}
                                        >
                                            {saving ? 'Saving…' : 'Save as Draft'}
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        className="btn-pi-create"
                                        onClick={() => void handleSaveInvoice('issue')}
                                        disabled={issueSaveDisabled}
                                    >
                                        {saving ? 'Saving…' : issueButtonLabel}
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
                                    background: isWalkInCustomer ? '#FFFBEB' : '#ECFEFF',
                                    border: isWalkInCustomer
                                        ? '1px solid #FDE68A'
                                        : '1px solid #A5F3FC',
                                    fontSize: '0.8125rem',
                                    color: isWalkInCustomer ? '#92400E' : '#0369A1',
                                    marginBottom: 16,
                                }}
                            >
                                {isWalkInCustomer ? (
                                    <>
                                        Walk-in / off-platform customer — this invoice stays in{' '}
                                        <strong>your supplier portal only</strong> (no workshop portal
                                        or purchase invoice on the customer side). AR posts to the{' '}
                                        <strong>Non-Affiliated Customers</strong> control account in
                                        Chart of Accounts.
                                    </>
                                ) : (
                                    <>
                                        This creates an <strong>Accounts Receivable</strong> for you
                                        (supplier). It will also create a matching{' '}
                                        <strong>Purchase Invoice</strong> on the workshop side and
                                        update stock levels on both ends.
                                    </>
                                )}
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
                                    <label>Customer *</label>
                                    <div
                                        ref={customerSearchWrapRef}
                                        className="pi-search-box-wrapper"
                                        style={{ position: 'relative' }}
                                    >
                                        <div className="pi-search-box">
                                            <Search size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search affiliated or non-affiliated customer…"
                                                value={
                                                    customerPickerOpen
                                                        ? customerSearchQuery
                                                        : selectedCustomer?.label || ''
                                                }
                                                readOnly={invoiceModalMode === 'edit'}
                                                onChange={(e) => {
                                                    setCustomerSearchQuery(e.target.value);
                                                    setCustomerPickerOpen(true);
                                                    setCustomerPickerIndex(0);
                                                }}
                                                onFocus={() => {
                                                    if (invoiceModalMode !== 'edit') {
                                                        setCustomerPickerOpen(true);
                                                        setCustomerSearchQuery('');
                                                        setCustomerPickerIndex(0);
                                                    }
                                                }}
                                                onKeyDown={handleCustomerSearchKeyDown}
                                            />
                                        </div>
                                        {customerPickerOpen && invoiceModalMode !== 'edit' ? (
                                            <div className="pi-search-results">
                                                {filteredCustomerOptions.length > 0 ? (
                                                    filteredCustomerOptions.map(
                                                        (customer, index) => {
                                                            const showGroupHeader =
                                                                index === 0 ||
                                                                filteredCustomerOptions[index - 1]
                                                                    .group !== customer.group;
                                                            return (
                                                                <React.Fragment key={customer.key}>
                                                                    {showGroupHeader ? (
                                                                        <div
                                                                            style={{
                                                                                padding:
                                                                                    '8px 12px 4px',
                                                                                fontSize: '0.6875rem',
                                                                                fontWeight: 700,
                                                                                color: '#64748b',
                                                                                textTransform:
                                                                                    'uppercase',
                                                                                letterSpacing:
                                                                                    '0.04em',
                                                                                background:
                                                                                    '#f8fafc',
                                                                            }}
                                                                        >
                                                                            {customer.group}
                                                                        </div>
                                                                    ) : null}
                                                                    <div
                                                                        className={`pi-result-item ${
                                                                            customerPickerIndex ===
                                                                            index
                                                                                ? 'selected'
                                                                                : ''
                                                                        }`}
                                                                        onClick={() =>
                                                                            selectCustomerOption(
                                                                                customer,
                                                                            )
                                                                        }
                                                                        onMouseEnter={() =>
                                                                            setCustomerPickerIndex(
                                                                                index,
                                                                            )
                                                                        }
                                                                    >
                                                                        <div className="pi-result-info">
                                                                            <div className="pi-item-name">
                                                                                {customer.label}
                                                                            </div>
                                                                            {customer.subtitle ? (
                                                                                <div
                                                                                    className="pi-item-meta"
                                                                                    style={{
                                                                                        fontSize: 11,
                                                                                        color: '#64748b',
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        customer.subtitle
                                                                                    }
                                                                                </div>
                                                                            ) : null}
                                                                        </div>
                                                                    </div>
                                                                </React.Fragment>
                                                            );
                                                        },
                                                    )
                                                ) : (
                                                    <div
                                                        style={{
                                                            padding: 14,
                                                            fontSize: 13,
                                                            color: '#64748b',
                                                        }}
                                                    >
                                                        {customerOptions.length === 0
                                                            ? 'No customers loaded. Add affiliated workshops or non-affiliated customers first.'
                                                            : 'No matching customers.'}
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
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
                                    customerOptions.length === 0 ? (
                                        <span
                                            className="pi-sub-label"
                                            style={{ color: '#B45309', marginTop: 6, display: 'block' }}
                                        >
                                            No customers found. Add workshops under Affiliated Filter
                                            workshops or customers under Non-affiliated customers /
                                            workshops.
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
                                    const capsRow = findInventoryCapsRow(line, inventoryItems);
                                    const maxQtyCap = maxSellableQtyForLine(
                                        line,
                                        lineItems,
                                        inventoryItems,
                                    );
                                    const uomOpts = capsRow
                                        ? lineUomOptions(line, capsRow)
                                        : [String(line.uom || 'pcs').trim() || 'pcs'];
                                    const conversionPreview = formatLineUomConversionPreview(
                                        line,
                                        capsRow,
                                    );
                                    return (
                                    <div
                                        key={line.id}
                                        className={`pi-lines-header pi-line-data-row${
                                            itemPickerLineId === line.id
                                                ? ' pi-line-row-picker-open'
                                                : ''
                                        }`}
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
                                                        ref={(el) => {
                                                            lineFieldRefs.current[`${line.id}:item`] =
                                                                el;
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
                                                            setItemPickerSelectedIndex(
                                                                0,
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
                                                            setItemPickerSelectedIndex(
                                                                0,
                                                            );
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key ===
                                                                    'Tab' &&
                                                                !e.shiftKey &&
                                                                itemPickerLineId ===
                                                                    line.id
                                                            ) {
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
                                                            handleLineItemPickerKeyDown(
                                                                e,
                                                                line,
                                                            );
                                                            handleLineFieldTab(
                                                                e,
                                                                line.id,
                                                                'item',
                                                                idx,
                                                            );
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
                                                    <div className="pi-search-results pi-line-item-picker-results">
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
                                                                            className={`pi-result-item ${
                                                                                itemPickerSelectedIndex ===
                                                                                i
                                                                                    ? 'selected'
                                                                                    : ''
                                                                            }`}
                                                                            onMouseDown={(
                                                                                ev,
                                                                            ) => {
                                                                                ev.preventDefault();
                                                                                applyCatalogItemToLine(
                                                                                    line.id,
                                                                                    invItem,
                                                                                );
                                                                            }}
                                                                            onMouseEnter={() =>
                                                                                setItemPickerSelectedIndex(
                                                                                    i,
                                                                                )
                                                                            }
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
                                                ref={(el) => {
                                                    lineFieldRefs.current[
                                                        `${line.id}:account`
                                                    ] = el;
                                                }}
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'account',
                                                        e.target.value
                                                    )
                                                }
                                                onKeyDown={(e) =>
                                                    handleLineFieldTab(
                                                        e,
                                                        line.id,
                                                        'account',
                                                        idx,
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
                                                    ref={(el) => {
                                                        lineFieldRefs.current[
                                                            `${line.id}:description`
                                                        ] = el;
                                                    }}
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
                                            {uomOpts.length > 1 ? (
                                                <select
                                                    className="pi-row-input"
                                                    value={line.uom ?? uomOpts[0]}
                                                    ref={(el) => {
                                                        lineFieldRefs.current[`${line.id}:uom`] = el;
                                                    }}
                                                    onChange={(e) =>
                                                        updateLineItem(
                                                            line.id,
                                                            'uom',
                                                            e.target.value,
                                                        )
                                                    }
                                                    onKeyDown={(e) =>
                                                        handleLineFieldTab(
                                                            e,
                                                            line.id,
                                                            'uom',
                                                            idx,
                                                        )
                                                    }
                                                >
                                                    {uomOpts.map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    className="pi-row-input"
                                                    placeholder="UOM"
                                                    value={line.uom ?? ''}
                                                    ref={(el) => {
                                                        lineFieldRefs.current[`${line.id}:uom`] = el;
                                                    }}
                                                    onChange={(e) =>
                                                        updateLineItem(
                                                            line.id,
                                                            'uom',
                                                            e.target.value,
                                                        )
                                                    }
                                                    onKeyDown={(e) =>
                                                        handleLineFieldTab(
                                                            e,
                                                            line.id,
                                                            'uom',
                                                            idx,
                                                        )
                                                    }
                                                />
                                            )}
                                        </div>
                                        <div className="pi-col-qty">
                                            <input
                                                type="text"
                                                aria-label={
                                                    maxQtyCap != null &&
                                                    Number.isFinite(maxQtyCap)
                                                        ? `Quantity. Maximum ${maxQtyCap} ${line.uom || 'pcs'} (supplier stock balance).`
                                                        : 'Quantity'
                                                }
                                                value={line.qty}
                                                title={
                                                    maxQtyCap != null &&
                                                    Number.isFinite(maxQtyCap)
                                                        ? `Max ${maxQtyCap} ${line.uom || 'pcs'} — supplier stock`
                                                        : undefined
                                                }
                                                className="pi-row-input-num pi-math-input"
                                                ref={(el) => {
                                                    lineFieldRefs.current[`${line.id}:qty`] = el;
                                                }}
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'qty',
                                                        e.target.value,
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    handleMathKeyDown(e, line.id, 'qty');
                                                    handleLineFieldTab(
                                                        e,
                                                        line.id,
                                                        'qty',
                                                        idx,
                                                    );
                                                }}
                                                onBlur={(e) =>
                                                    handleMathBlur(e, line.id, 'qty')
                                                }
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
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'price',
                                                        e.target.value,
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    handleMathKeyDown(
                                                        e,
                                                        line.id,
                                                        'price',
                                                    );
                                                    handleLineFieldTab(
                                                        e,
                                                        line.id,
                                                        'price',
                                                        idx,
                                                    );
                                                }}
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
                                                    ref={(el) => {
                                                        lineFieldRefs.current[
                                                            `${line.id}:discount`
                                                        ] = el;
                                                    }}
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
                                                        line.discountMode ===
                                                        'fixed_sar'
                                                            ? 'fixed_sar'
                                                            : 'percent'
                                                    }
                                                    ref={(el) => {
                                                        lineFieldRefs.current[
                                                            `${line.id}:discountMode`
                                                        ] = el;
                                                    }}
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
                                                ref={(el) => {
                                                    lineFieldRefs.current[
                                                        `${line.id}:taxCode`
                                                    ] = el;
                                                }}
                                                onChange={(e) =>
                                                    updateLineItem(
                                                        line.id,
                                                        'taxCode',
                                                        e.target.value
                                                    )
                                                }
                                                onKeyDown={(e) =>
                                                    handleLineFieldTab(
                                                        e,
                                                        line.id,
                                                        'taxCode',
                                                        idx,
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
                                    <Zap size={14} /> Tip: ↑ ↓ arrows, Enter to select product on the
                                    same line. Tab moves across fields; Tab on the last field adds a
                                    new line. Price fields support math (e.g. 120*2).
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
                                            {isWalkInCustomer ? (
                                                <>
                                                    Creates <strong>Accounts Receivable</strong> for
                                                    this walk-in customer and links the journal to{' '}
                                                    <strong>AR — Non-Affiliated Customers</strong> in
                                                    Chart of Accounts. Stock is reduced from your
                                                    warehouse; nothing is sent to a customer portal.
                                                </>
                                            ) : (
                                                <>
                                                    Creates <strong>Accounts Receivable</strong> for
                                                    this workshop branch. A linked{' '}
                                                    <strong>Purchase Invoice</strong> will appear in
                                                    the workshop&apos;s Accounting module.
                                                </>
                                            )}
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
