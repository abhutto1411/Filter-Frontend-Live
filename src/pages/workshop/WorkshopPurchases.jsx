import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, BarChart3, AlertTriangle, Calendar, Zap, Trash2 } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import WsTableScroll from '../../components/workshop/WsTableScroll';
import { useAuth } from '../../context/AuthContext';

const PURCHASES_TABS = [
    { id: 'invoices',      label: 'Purchase Invoices',     permission: 'workshop.purchases.invoices.view' },
    { id: 'price_report',  label: 'Purchase Price Report', permission: 'workshop.purchases.price-report.view' },
];
import {
    getWorkshopStaffBranchProducts,
    getWorkshopSuppliers,
    getRegisteredWorkshopSuppliers,
    branchScopeParams,
    createWorkshopSupplierPurchaseInvoice,
    getWorkshopSupplierPurchaseInvoice,
    getWorkshopSupplierLastPurchasePrices,
    getWorkshopSupplierProductUomRules,
    listWorkshopSupplierPurchaseInvoices,
    updateWorkshopSupplierPurchaseInvoiceDraft,
    unwrapWorkshopBranchListResponse,
    filterPortalVisibleBranches,
} from '../../services/workshopStaffApi';
import { getBranchProducts } from '../../services/workshopCatalogApi';
import {
    buildCreateWorkshopSupplierPurchaseInvoiceBody,
    extractWorkshopPurchaseInvoiceUiFromPayload,
    normalizeWorkshopSupplierPurchaseInvoiceRow,
    compareWorkshopPurchaseInvoiceListRowsDesc,
    dedupeWorkshopPurchaseInvoiceListRows,
    unwrapWorkshopStaffSupplierPurchaseInvoiceGet,
    unwrapWorkshopSupplierPurchaseInvoiceList,
} from '../../services/workshopSupplierPurchaseInvoices';
import {
    listLocalSuppliers,
    createLocalSupplierPurchaseInvoice,
    listAllLocalSupplierPurchaseInvoices,
    getWorkshopLocalPurchaseInvoice,
    patchWorkshopLocalPurchaseInvoice,
} from '../../services/workshopSuppliersApi';
import { ShimmerTableBodyRows, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import WorkshopPurchaseInvoiceView from '../../components/supplier/WorkshopPurchaseInvoiceView';
import InvoiceRefField from '../../components/invoices/InvoiceRefField';
import { getNextWorkshopPurchaseInvoiceReference } from '../../services/invoiceReferenceApi';
import { PI_ACCOUNT_OPTIONS } from './constants';
import {
    PURCHASE_INVOICE_VAT_RATE as VAT_RATE,
    PURCHASE_INVOICE_TAX_LABEL as TAX_LABEL,
    PURCHASE_INVOICE_TAXES as TAXES,
    computeLineAmounts,
    computePurchaseInvoiceTotals,
    buildPurchaseInvoicePayload,
    reconstructInvoiceUnitPriceInput,
    serializePurchaseInvoiceFormLines,
    buildPurchaseInvoiceFormSnapshot,
    buildPurchaseInvoiceLinesForSave,
} from './purchaseInvoicePayload';
import {
    isInvoiceLineSubmitReady,
    resolveManualInvoiceLineLabel,
} from '../../utils/invoiceLineLabel';
import {
    applyLineTotals,
    computeLineFinancials,
} from '../../utils/invoiceLineFinancials';
import {
    defaultUomForWarehouseProduct,
    findUomCapsForLine,
    parseWorkshopPurchaseLineUomHint,
    isWarehouseUomLine,
    lineUomOptions,
    normUomLabel,
    prefillPriceForLineUom,
    uomRuleToCaps,
} from './workshopPurchaseUomUtils';
import WorkshopUomSelect from './WorkshopUomSelect';
import { listWorkshopUomProfiles } from '../../services/workshopCatalogApi';
import { branchProductToUomCaps, lineInventoryCapsForInvoice } from './workshopUomUtils';

const SUPPLIERS_PAGE_LIMIT = 500;
const PRODUCT_SEARCH_RESULT_LIMIT = 30;

/**
 * GET /workshop-staff/branches/:id/products returns nested `categories` / `uncategorizedProducts`.
 * `unwrapWorkshopBranchListResponse` alone returns [] so product pickers stay empty and
 * non-affiliated purchase invoices fail (no `branch_catalog_product_id` on lines).
 */
function flattenWorkshopStaffBranchProductsResponse(res) {
    if (res == null) return [];
    if (Array.isArray(res)) return res;
    if (typeof res !== 'object') return [];
    const out = [];
    const uncategorized =
        res.uncategorizedProducts ??
        res.uncategorized_products ??
        res?.data?.uncategorizedProducts;
    if (Array.isArray(uncategorized)) {
        for (const p of uncategorized) {
            if (p && typeof p === 'object') out.push(p);
        }
    }
    const categories = res.categories ?? res?.data?.categories;
    if (Array.isArray(categories)) {
        for (const c of categories) {
            if (!c || typeof c !== 'object') continue;
            const subs = c.subCategories ?? c.sub_categories ?? [];
            if (Array.isArray(subs)) {
                for (const s of subs) {
                    if (s?.products && Array.isArray(s.products)) {
                        for (const p of s.products) {
                            if (p && typeof p === 'object') out.push(p);
                        }
                    }
                }
            }
            const direct = c.productsWithoutSub ?? c.products_without_sub;
            if (Array.isArray(direct)) {
                for (const p of direct) {
                    if (p && typeof p === 'object') out.push(p);
                }
            }
        }
    }
    if (out.length > 0) return out;
    return unwrapWorkshopBranchListResponse(res, 'products');
}

function unwrapSuppliersResponse(res) {
    if (Array.isArray(res)) return res;
    if (!res || typeof res !== 'object') return [];
    const keys = ['suppliers', 'data', 'items'];
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

/** Top-level or nested pagination from GET /workshop-staff/suppliers. */
function pickListMeta(res) {
    if (!res || typeof res !== 'object') {
        return { total: null, limit: null, offset: null };
    }
    const p = res.pagination;
    const total = res.total ?? p?.total ?? res.count ?? null;
    const limit = res.limit ?? p?.limit ?? null;
    const offset = res.offset ?? p?.offset ?? null;
    return { total: total != null ? Number(total) : null, limit, offset };
}

function normalizeSupplierRow(s) {
    const id = String(s.id ?? s._id ?? '');
    const name = s.supplierName ?? s.name ?? '';
    if (!id) return null;
    return { id, name: name || '—', raw: s };
}

function isNonAffiliatedPickerSupplier(row) {
    return row?.__supplierType === 'local' || row?.raw?.__supplierType === 'local';
}

function isWorkshopPortalLocalSupplier(row) {
    const raw = row?.raw ?? row;
    const rt =
        raw?.registrationType ??
        raw?.registration_type ??
        row?.registrationType ??
        null;
    return String(rt ?? '').toLowerCase() === 'workshop_local';
}

/**
 * Rows for the PI vendor dropdown (same branch scope as affiliated list).
 * Used on the main suppliers path and on the registered-suppliers fallback path.
 */
async function fetchNonAffiliatedSupplierPickerRows({ invoiceBranchId, modalOpen, effectiveBranchId }) {
    const branchForScope = String(invoiceBranchId ?? '').trim();
    const scopeBranch =
        branchForScope !== ''
            ? branchForScope
            : modalOpen && effectiveBranchId && String(effectiveBranchId) !== 'all'
              ? String(effectiveBranchId)
              : 'all';
    const localParams = {};
    if (scopeBranch && scopeBranch !== 'all') {
        localParams.branchId = scopeBranch;
    }
    const localRes = await listLocalSuppliers(localParams);
    return (localRes?.suppliers ?? [])
        .filter((s) => s.isActive !== false)
        .map((s) => ({
            id: String(s.id),
            name: `${s.name} (Non-affiliated)`,
            raw: { ...s, __supplierType: 'local' },
            __supplierType: 'local',
        }));
}

function roundMoney2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

function firstNonEmptyString(...candidates) {
    for (const c of candidates) {
        if (c == null) continue;
        const s = String(c).trim();
        if (s !== '') return s;
    }
    return '';
}

function pickBranchCatalogItemId(row, nested) {
    /** Master catalog product id — never use workshopProduct / branch adoption link ids. */
    const productSnap = row?.product && typeof row.product === 'object' ? row.product : null;
    const raw =
        productSnap?.id ??
        row?.productId ??
        row?.product_id ??
        nested?.productId ??
        nested?.id ??
        nested?.serviceId ??
        row?.catalogProductId ??
        row?.catalog_product_id ??
        row?.serviceId ??
        row?.service_id ??
        row?.id;
    if (raw == null || raw === '') return '';
    return String(raw);
}

function isBranchCatalogRowActive(row, nested) {
    if (row?.isActive === false || row?.is_active === false) return false;
    if (nested?.isActive === false || nested?.is_active === false) return false;
    const productSnap = row?.product && typeof row.product === 'object' ? row.product : null;
    if (productSnap?.isActive === false || productSnap?.is_active === false) return false;
    return true;
}

/** Branch rows often put `name` on the row while `product` / `service` is a pricing snapshot without a label. */
function pickBranchCatalogItemName(row, nested) {
    return (
        firstNonEmptyString(
            row?.name,
            row?.productName,
            row?.serviceName,
            row?.title,
            row?.label,
            row?.nameEn,
            row?.name_en,
            row?.nameAr,
            row?.name_ar,
            nested?.name,
            nested?.productName,
            nested?.serviceName,
            nested?.title,
            nested?.label,
            nested?.nameEn,
            nested?.name_en,
            nested?.nameAr,
            nested?.name_ar,
            row?.sku,
            nested?.sku,
        ) || ''
    );
}

function pickBranchCatalogItemUnit(row, nested) {
    return firstNonEmptyString(nested?.unit, nested?.uom, row?.unit, row?.uom) || 'piece';
}

/**
 * Ex-VAT unit for purchase lines (UNIT PRICE column).
 * Prefer purchase price (treated as VAT-inclusive) ÷ (1 + VAT), then fallback to
 * explicit before-VAT sale/selling fields, then inclusive sale/selling fallback.
 */
function pickPriceExclusiveUnit(row) {
    const nested = row?.product ?? row?.service;
    const snap = nested != null && typeof nested === 'object' ? nested : null;

    const purchaseInclusiveCandidates = [
        snap?.purchasePrice,
        snap?.purchase_price,
        row?.purchasePrice,
        row?.purchase_price,
    ];
    for (const v of purchaseInclusiveCandidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
            return roundMoney2(n / (1 + VAT_RATE));
        }
    }

    const beforeVatCandidates = [
        snap?.salePriceBeforeVat,
        snap?.sale_price_before_vat,
        snap?.sellingPriceBeforeVat,
        snap?.selling_price_before_vat,
        row?.salePriceBeforeVat,
        row?.sale_price_before_vat,
        row?.sellingPriceBeforeVat,
        row?.selling_price_before_vat,
    ];
    for (const v of beforeVatCandidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
            return roundMoney2(n);
        }
    }

    const inclusiveRaw = Number(
        row?.salePriceOverride ??
            row?.sellingPriceOverride ??
            row?.salePrice ??
            row?.sellingPrice ??
            snap?.salePriceOverride ??
            snap?.sellingPriceOverride ??
            snap?.salePrice ??
            snap?.sellingPrice ??
            snap?.sale_price ??
            snap?.selling_price ??
            snap?.basePrice ??
            snap?.price ??
            0,
    );
    if (Number.isFinite(inclusiveRaw) && inclusiveRaw > 0) {
        return roundMoney2(inclusiveRaw / (1 + VAT_RATE));
    }

    return 0;
}

/** VAT-inclusive purchase unit (branch/catalog purchase price when set). */
function pickPriceInclusivePurchaseUnit(row) {
    const nested = row?.product ?? row?.service;
    const snap = nested != null && typeof nested === 'object' ? nested : null;
    const purchaseInclusiveCandidates = [
        snap?.purchasePrice,
        snap?.purchase_price,
        row?.purchasePrice,
        row?.purchase_price,
    ];
    for (const v of purchaseInclusiveCandidates) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
            return roundMoney2(n);
        }
    }
    const ex = pickPriceExclusiveUnit(row);
    if (ex > 0) return roundMoney2(ex * (1 + VAT_RATE));
    return 0;
}

function normalizeBranchProductOption(row) {
    if (!row || typeof row !== 'object') return null;
    const nested = row?.product ?? row?.service;
    if (!isBranchCatalogRowActive(row, nested)) return null;
    const id = pickBranchCatalogItemId(row, nested);
    if (!id) return null;
    const name =
        pickBranchCatalogItemName(row, nested) ||
        `Item ${id.slice(0, 8)}${id.length > 8 ? '…' : ''}`;
    const unit = pickBranchCatalogItemUnit(row, nested);
    const isService =
        row?.service != null ||
        row?.itemType === 'service' ||
        String(nested?.type || row?.type || '').toLowerCase() === 'service';
    const type = isService ? 'service' : 'Stock';
    const priceExcl = pickPriceExclusiveUnit(row);
    const priceIncl = pickPriceInclusivePurchaseUnit(row);
    const warehouseUnit = row.warehouseUnit ?? nested?.warehouseUnit ?? null;
    const workshopUnit = row.workshopUnit ?? nested?.workshopUnit ?? null;
    const conversionFactor =
        row.conversionFactor != null
            ? Number(row.conversionFactor)
            : nested?.conversionFactor != null
              ? Number(nested.conversionFactor)
              : null;
    const conversionRule = row.conversionRule ?? nested?.conversionRule ?? null;
    const supplierProductId = row.supplierProductId ?? nested?.supplierProductId ?? null;
    return {
        id,
        name,
        unit,
        type,
        priceExcl,
        priceIncl,
        isActive: true,
        sku: row.sku ?? nested?.sku ?? null,
        warehouseUnit,
        workshopUnit,
        conversionFactor,
        conversionRule,
        supplierProductId,
    };
}

function createEmptyLine() {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        productId: '',
        item: '',
        account: '1410 - Inventory Asset',
        description: '',
        uom: 'piece',
        uomProfileId: null,
        uomMode: 'warehouse',
        qty: 1,
        price: 0,
        discount: 0,
        discountMode: 'percent',
        taxCode: TAX_LABEL,
        taxAmt: '0.00',
        totalFinal: '0.00',
    };
}

/**
 * Map a normalized workshop PI row → shape consumed by `WorkshopPurchaseInvoiceView`
 * (the same printable invoice template used by Supplier SI). Field aliases are
 * duplicated (snake + camel) so the template's `pick(...)` helper finds them.
 */
function mapWorkshopPurchaseInvoiceForViewDetail(row) {
    if (!row || typeof row !== 'object') return {};
    const items = Array.isArray(row.items) ? row.items : [];
    const totalVat = Number(row.vat_amount ?? row.total_vat ?? 0);
    const grand = Number(row.grand_total ?? 0);
    const ex = Number(row.subtotal ?? Math.max(0, grand - totalVat - Number(row.freight_in ?? 0)));
    const supplierLabel = row.vendor_name ?? row.supplier ?? '';
    const raw = row._raw && typeof row._raw === 'object' ? row._raw : {};
    const payload =
        row.payload && typeof row.payload === 'object'
            ? row.payload
            : raw.payload && typeof raw.payload === 'object'
              ? raw.payload
              : null;
    const supplierInvoiceNo =
        row.supplier_invoice_no ??
        raw.supplierInvoiceNo ??
        payload?.supplierInvoiceNo ??
        payload?.supplier_invoice_no ??
        null;
    const displayInvoiceNo =
        supplierInvoiceNo != null && String(supplierInvoiceNo).trim() !== ''
            ? String(supplierInvoiceNo).trim()
            : row.invoice_number ?? row.id;
    const supplierObj =
        raw.supplier && typeof raw.supplier === 'object' ? raw.supplier : null;
    const supplierVat =
        raw.supplierVatNumber ??
        raw.supplier_vat_number ??
        supplierObj?.vatId ??
        supplierObj?.vatNumber ??
        supplierObj?.vat_id ??
        '';
    return {
        id: row.id,
        invoiceNumber: displayInvoiceNo,
        invoiceNo: displayInvoiceNo,
        workshopPurchaseInvoiceNumber: row.invoice_number ?? row.id,
        linkedSupplierInvoiceId: row.supplier_invoice_id ?? raw.supplierInvoiceId ?? null,
        issueDate: row.date,
        invoiceDate: row.date,
        dueDate: row.due_date,
        status: row.status,
        workshopName: row.branch_name ?? '',
        branchName: row.branch_name ?? '',
        branch: row.branch_id ? { id: row.branch_id, name: row.branch_name ?? '' } : undefined,
        supplierName: supplierLabel,
        supplierLegalName: supplierLabel,
        supplierVatNumber: supplierVat,
        vendorName: supplierLabel,
        vendor_name: supplierLabel,
        supplier: supplierObj ?? row._raw?.supplier ?? undefined,
        vendorInvoiceRef: row.vendor_invoice_ref ?? '',
        vendorRef: row.vendor_invoice_ref ?? '',
        subtotalExVat: ex,
        subtotal: ex,
        vatAmount: totalVat,
        totalVat,
        grandTotal: grand,
        total: grand,
        amountPaid: Number(row.amount_paid ?? 0),
        paidAmount: Number(row.amount_paid ?? 0),
        balanceDue: Number(row.balance_due ?? 0),
        balance: Number(row.balance_due ?? 0),
        freight: Number(row.freight_in ?? 0),
        freight_in: Number(row.freight_in ?? 0),
        paymentStatus: row.payment_status ?? 'unpaid',
        notes: row.notes ?? '',
        description: row.description ?? '',
        items: items.map((it) => {
            const qty = Number(it.quantity ?? it.qty ?? 0);
            const unitEx = Number(
                it.unitPriceExVat ?? it.unit_price_ex_vat ?? it.unitPrice ?? it.unit_price ?? 0,
            );
            const taxAmt = Number(it.taxAmount ?? it.tax_amount ?? 0);
            const lineTotalIncl = Number(it.total ?? it.lineTotalInclVat ?? it.line_total_incl_vat ?? 0);
            const taxCode = String(it.taxCode ?? it.tax_code ?? TAX_LABEL).trim() || TAX_LABEL;
            const lineRate = (() => {
                const m = /([\d.]+)\s*%/.exec(taxCode);
                if (m) return Number(m[1]) / 100;
                const r = Number(it.taxRate ?? it.tax_rate ?? it.vatRate ?? it.vat_rate);
                return Number.isFinite(r) ? r : VAT_RATE;
            })();
            const wsQty = it.qtyWorkshop ?? it.qty_workshop ?? null;
            const wsUnit = it.workshopUnit ?? it.workshop_unit ?? null;
            const productNameArabic =
                it.productNameArabic ??
                it.product_name_arabic ??
                it.arabicName ??
                it.arabic_name ??
                null;
            return {
                id: it.id,
                productName: it.itemName ?? it.item_name ?? it.productName ?? it.product_name ?? '—',
                product_name: it.itemName ?? it.item_name ?? it.productName ?? it.product_name ?? '—',
                productNameArabic,
                product_name_arabic: productNameArabic,
                arabicName: productNameArabic,
                qty,
                quantity: qty,
                qtyWorkshop: wsQty != null ? Number(wsQty) : null,
                workshopUnit: wsUnit,
                unit: String(it.uom ?? it.unit ?? 'piece') || 'piece',
                uom: String(it.uom ?? it.unit ?? 'piece') || 'piece',
                unitPrice: unitEx,
                unit_price: unitEx,
                unitPriceExVat: unitEx,
                vatRate: lineRate,
                vat_rate: lineRate,
                vatAmount: taxAmt,
                vat_amount: taxAmt,
                lineTotal: Number(it.lineTotal ?? it.line_total ?? Math.max(0, lineTotalIncl - taxAmt)),
                line_total: Number(it.lineTotal ?? it.line_total ?? Math.max(0, lineTotalIncl - taxAmt)),
                lineTotalInclVat: lineTotalIncl,
                line_total_incl_vat: lineTotalIncl,
            };
        }),
    };
}

function mapPurchaseInvoiceLineForView(line, idx) {
    if (!line || typeof line !== 'object') {
        return {
            key: `line-${idx}`,
            item: '—',
            account: '—',
            desc: '',
            uom: 'piece',
            qty: 0,
            unitEx: 0,
            lineDisc: 0,
            taxAmt: 0,
            totalIncl: 0,
            taxCode: TAX_LABEL,
            taxableFromApi: null,
        };
    }
    const nested = line.product && typeof line.product === 'object' ? line.product : null;
    const item =
        line.itemName ??
        line.item_name ??
        line.productName ??
        line.product_name ??
        nested?.name ??
        line.description ??
        '—';
    const acct =
        [
            line.accountName,
            line.account_name,
            line.accountCode,
            line.account_code,
            nested?.accountName,
            nested?.account_name,
            line.account?.name,
            line.account?.code,
        ]
            .map((x) => (x != null ? String(x).trim() : ''))
            .find((s) => s !== '') ?? '—';
    const desc = String(
        line.lineDescription ?? line.line_description ?? line.description ?? line.notes ?? '',
    ).trim();
    const uom = String(line.uom ?? line.unit ?? 'piece').trim() || 'piece';
    const qty = Number(line.quantity ?? line.qty ?? 0);
    let unitEx = roundMoney2(
        line.unitPriceExVat ??
            line.unit_price_ex_vat ??
            line.unitPrice ??
            line.unit_price ??
            line.priceExVat ??
            line.price_ex_vat ??
            0,
    );
    const lineDisc = roundMoney2(
        line.discount ?? line.lineDiscountAmount ?? line.line_discount_amount ?? line.lineDiscountRaw ?? 0,
    );
    const taxAmt = roundMoney2(line.taxAmount ?? line.tax_amount ?? 0);
    /** Workshop GET formatter: `total` = incl. VAT; `lineTotal` = ex-VAT line base (taxable), not incl. total. */
    const totalIncl = roundMoney2(line.total ?? line.lineTotalInclVat ?? line.line_total_incl_vat ?? 0);
    const taxCode = String(line.taxCode ?? line.tax_code ?? TAX_LABEL).trim() || TAX_LABEL;
    const ltRaw = line.lineTotal ?? line.line_total;
    const taxableFromLineTotal =
        ltRaw != null && ltRaw !== '' && Number.isFinite(Number(ltRaw)) ? roundMoney2(ltRaw) : null;
    const taxableRaw = line.taxableExVat ?? line.taxable_ex_vat ?? line.grossExVat ?? line.gross_ex_vat;
    const taxableFromNamed =
        taxableRaw != null && taxableRaw !== '' && Number.isFinite(Number(taxableRaw))
            ? roundMoney2(taxableRaw)
            : null;
    const taxableFromApi = taxableFromLineTotal ?? taxableFromNamed;
    if (unitEx === 0 && qty > 0 && totalIncl > 0) {
        const impliedEx = roundMoney2(totalIncl - taxAmt);
        if (impliedEx > 0) unitEx = roundMoney2(impliedEx / qty);
    }
    return {
        key: String(line.id ?? line._id ?? `line-${idx}`),
        item,
        account: acct,
        desc,
        uom,
        qty: Number.isFinite(qty) ? qty : 0,
        unitEx,
        lineDisc,
        taxAmt,
        totalIncl,
        taxCode,
        taxableFromApi,
    };
}

function pickViewInvoiceUi(raw, items = []) {
    const ui = extractWorkshopPurchaseInvoiceUiFromPayload(raw);
    const list = Array.isArray(items) ? items : [];
    const lineHasDisc = list.some((it) => {
        const d = Number(it?.discount ?? it?.lineDiscountAmount ?? it?.line_discount_amount ?? 0);
        return Number.isFinite(d) && d !== 0;
    });
    const headerDiscAmt = Number(raw?.discountAmount ?? raw?.discount_amount ?? 0);
    const headerHasDisc = Number.isFinite(headerDiscAmt) && headerDiscAmt !== 0;
    const rawDiscType = String(raw?.discountType ?? raw?.discount_type ?? '').toLowerCase();
    const line0DiscType = list.length
        ? String(list[0]?.discountType ?? list[0]?.discount_type ?? '').toLowerCase()
        : '';
    const anyLineDesc = list.some((it) => String(it?.description ?? '').trim().length > 0);
    return {
        showDesc:
            Boolean(ui.showLineDescriptionColumn ?? ui.show_line_description_column ?? true) || anyLineDesc,
        showDiscount:
            Boolean(ui.showLineDiscountColumn ?? ui.show_line_discount_column) ||
            lineHasDisc ||
            headerHasDisc,
        discountIsPercent:
            Boolean(ui.lineDiscountIsPercent ?? ui.line_discount_is_percent) ||
            rawDiscType === 'percent' ||
            (lineHasDisc && line0DiscType === 'percent'),
        amountsTaxInclusive: Boolean(
            ui.amountsTaxInclusive ??
                ui.amounts_tax_inclusive ??
                ui.prices_include_vat ??
                false,
        ),
    };
}

function formatViewInvoiceDiscount(raw) {
    if (!raw || typeof raw !== 'object') return '—';
    const disc = raw.invoiceDiscount ?? raw.invoice_discount;
    if (disc && typeof disc === 'object') {
        const mode = String(disc.mode ?? disc.type ?? 'fixed_sar');
        const val = Number(disc.value ?? disc.amount ?? 0);
        if (Number.isFinite(val) && val !== 0) {
            if (/percent/i.test(mode)) return `${val}%`;
            return `SAR ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    }
    const flatAmt = Number(raw.discountAmount ?? raw.discount_amount ?? 0);
    if (Number.isFinite(flatAmt) && flatAmt !== 0) {
        const dt = String(raw.discountType ?? raw.discount_type ?? 'fixed');
        if (/percent/i.test(dt)) return `${flatAmt}%`;
        return `SAR ${flatAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return '—';
}

export default function WorkshopPurchases({ tabState, clearTabState, selectedBranchId, branches = [] }) {
    const branchesForUi = useMemo(() => filterPortalVisibleBranches(branches), [branches]);
    const { hasPermission } = useAuth();
    const visiblePurchasesTabs = PURCHASES_TABS.filter((t) => hasPermission(t.permission));
    const [activeTab, setActiveTab] = useState(() => visiblePurchasesTabs[0]?.id ?? 'invoices');
    useEffect(() => {
        if (visiblePurchasesTabs.length === 0) return;
        if (!visiblePurchasesTabs.some((t) => t.id === activeTab)) {
            setActiveTab(visiblePurchasesTabs[0].id);
        }
    }, [visiblePurchasesTabs, activeTab]);
    const [filterSupplier, setFilterSupplier] = useState('all');
    const [filterProduct, setFilterProduct] = useState('all');
    const [modalOpen, setModalOpen] = useState(false);
    const [showDesc, setShowDesc] = useState(true);
    const [showDiscount, setShowDiscount] = useState(false);
    const [discountIsPercent, setDiscountIsPercent] = useState(false);
    const todayIso = useMemo(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }, []);
    const [issueDate, setIssueDate] = useState(todayIso);
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState(todayIso);
    const [selectedVendor, setSelectedVendor] = useState('');
    const [vendorInvoiceRef, setVendorInvoiceRef] = useState('');
    const [refAutoGenerate, setRefAutoGenerate] = useState(false);
    const [invoiceDescription, setInvoiceDescription] = useState('');
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [invoiceDiscountValue, setInvoiceDiscountValue] = useState('0');
    const [invoiceDiscountMode, setInvoiceDiscountMode] = useState('fixed_sar');
    /**
     * When false (default), unit price is ex-VAT and VAT is added on the line (same as supplier sales invoice).
     * When true, unit price is VAT-inclusive and tax is extracted from the entered amount.
     */
    const [amountsTaxInclusive, setAmountsTaxInclusive] = useState(false);
    const [freightSar, setFreightSar] = useState('0');
    const [updateLastPurchasePrice, setUpdateLastPurchasePrice] = useState(true);
    const [linkedSuppliers, setLinkedSuppliers] = useState([]);
    const [linkedSuppliersLoading, setLinkedSuppliersLoading] = useState(false);
    const [linkedSuppliersError, setLinkedSuppliersError] = useState('');
    const [linkedSuppliersUsingRegisteredFallback, setLinkedSuppliersUsingRegisteredFallback] = useState(false);
    const [lineItems, setLineItems] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [invoicesError, setInvoicesError] = useState('');
    const [submitInvoiceError, setSubmitInvoiceError] = useState('');
    const [submittingInvoice, setSubmittingInvoice] = useState(false);
    const [editingDraftId, setEditingDraftId] = useState(null);
    /** Non-affiliated (local) purchase invoice id when editing a draft WLPI. */
    const [editingLocalPiId, setEditingLocalPiId] = useState(null);
    const [editingDraftLoadingId, setEditingDraftLoadingId] = useState(null);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewInvoiceRow, setViewInvoiceRow] = useState(null);
    const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);
    const [viewInvoiceError, setViewInvoiceError] = useState('');
    /** Branch that receives stock for this invoice (modal); independent of sidebar when user picks another branch. */
    const [invoiceBranchId, setInvoiceBranchId] = useState('');
    /** Imperative handle for the printable invoice template (Download PDF). */
    const printableRef = useRef(null);
    /** When opening a draft for edit, re-select vendor by id after linked suppliers load (name-only match can fail). */
    const editingDraftSupplierIdRef = useRef(null);
    const draftSupplierSyncedRef = useRef(false);
    const clearDraftEditSession = useCallback(() => {
        editingDraftSupplierIdRef.current = '';
        draftSupplierSyncedRef.current = false;
        setEditingLocalPiId(null);
    }, []);

    const effectiveBranchId = useMemo(() => {
        if (selectedBranchId && selectedBranchId !== 'all') return selectedBranchId;
        return branchesForUi[0]?.id ?? null;
    }, [selectedBranchId, branchesForUi]);

    const [branchProductOptions, setBranchProductOptions] = useState([]);
    const [branchProductsLoading, setBranchProductsLoading] = useState(false);
    const [branchProductsError, setBranchProductsError] = useState('');
    const [productSearchByLineId, setProductSearchByLineId] = useState({});
    const [activeProductSearchLineId, setActiveProductSearchLineId] = useState(null);
    const [productDropdownPosition, setProductDropdownPosition] = useState(null);
    /** Keyboard highlight in the product search portal (-1 = none; Enter picks this row). */
    const [highlightedProductIndex, setHighlightedProductIndex] = useState(-1);
    const highlightedProductIndexRef = useRef(-1);
    const productSearchInputRefs = useRef({});
    const productResultsPanelRef = useRef(null);

    /**
     * Supplier-scoped last purchase prices (most recent unit price the
     * workshop paid this supplier per product). Map keyed by `productId.toString()`.
     * Refreshed when the selected supplier changes inside the PI modal.
     */
    const [lastPricesByProductId, setLastPricesByProductId] = useState({});
    const [lastPricesLoading, setLastPricesLoading] = useState(false);
    /** Affiliated supplier UOM rules keyed by branch catalog product id. */
    const [supplierUomByProductId, setSupplierUomByProductId] = useState({});
    /** Workshop reusable UOM profiles (Box=12L vs Box=24L). */
    const [workshopUomProfiles, setWorkshopUomProfiles] = useState([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await listWorkshopUomProfiles();
                if (!cancelled) setWorkshopUomProfiles(res?.profiles ?? []);
            } catch {
                if (!cancelled) setWorkshopUomProfiles([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const loadBranchProducts = useCallback(async (supplierIdForUom) => {
        if (!invoiceBranchId) {
            setBranchProductOptions([]);
            return;
        }
        setBranchProductsLoading(true);
        setBranchProductsError('');
        try {
            const prodRes = await getWorkshopStaffBranchProducts(invoiceBranchId, {
                supplierId: supplierIdForUom || undefined,
            });
            let prodRows = flattenWorkshopStaffBranchProductsResponse(prodRes);
            if (prodRows.length === 0) {
                try {
                    prodRows = unwrapWorkshopBranchListResponse(
                        await getBranchProducts(invoiceBranchId),
                        'products',
                    );
                } catch {
                    /* keep empty */
                }
            }
            const opts = prodRows.map(normalizeBranchProductOption).filter((o) => o && o.type !== 'service');
            opts.sort((a, b) => a.name.localeCompare(b.name));
            setBranchProductOptions(opts);
        } catch (e) {
            setBranchProductsError(e.message || 'Could not load branch products.');
            setBranchProductOptions([]);
        } finally {
            setBranchProductsLoading(false);
        }
    }, [invoiceBranchId]);

    const loadLinkedSuppliers = useCallback(async () => {
        setLinkedSuppliersLoading(true);
        setLinkedSuppliersError('');
        setLinkedSuppliersUsingRegisteredFallback(false);
        try {
            let offset = 0;
            const merged = [];
            let hardCap = 60;
            while (hardCap-- > 0) {
                const branchForScope = String(invoiceBranchId ?? '').trim();
                const scopeBranch =
                    branchForScope !== ''
                        ? branchForScope
                        : modalOpen &&
                            effectiveBranchId &&
                            String(effectiveBranchId) !== 'all'
                          ? String(effectiveBranchId)
                          : 'all';
                const res = await getWorkshopSuppliers({
                    ...branchScopeParams(scopeBranch ?? 'all'),
                    limit: SUPPLIERS_PAGE_LIMIT,
                    offset,
                });
                const rows = unwrapSuppliersResponse(res).map(normalizeSupplierRow).filter(Boolean);
                merged.push(...rows);
                const { total } = pickListMeta(res);
                if (total != null && merged.length >= total) break;
                if (rows.length < SUPPLIERS_PAGE_LIMIT) break;
                offset += SUPPLIERS_PAGE_LIMIT;
            }

            // Also include non-affiliated (local) suppliers so the workshop can
            // create a PI for them. Marked with __supplierType so the submit
            // handler routes to the local-supplier endpoint.
            try {
                const localRows = await fetchNonAffiliatedSupplierPickerRows({
                    invoiceBranchId,
                    modalOpen,
                    effectiveBranchId,
                });
                merged.push(...localRows);
            } catch (e) {
                console.warn('[purchases] failed to load local suppliers', e);
            }

            setLinkedSuppliers(merged);
        } catch (e) {
            const msg = String(e?.message || '');
            const missingWorkshopIdColumn =
                msg.includes('suppliers.workshop_id') || msg.includes('workshop_id');
            const unauthorized = /unauthorized|401|forbidden|403|jwt|token/i.test(msg);
            if (missingWorkshopIdColumn || unauthorized) {
                try {
                    const res = await getRegisteredWorkshopSuppliers({
                        limit: SUPPLIERS_PAGE_LIMIT,
                        offset: 0,
                    });
                    const rows = unwrapSuppliersResponse(res).map(normalizeSupplierRow).filter(Boolean);
                    const linkedOnly = rows.filter(
                        (r) =>
                            r?.raw?.isLinkedToWorkshop === true ||
                            r?.raw?.is_linked_to_workshop === true ||
                            r?.raw?.linkedToWorkshop === true,
                    );
                    let localRows = [];
                    try {
                        localRows = await fetchNonAffiliatedSupplierPickerRows({
                            invoiceBranchId,
                            modalOpen,
                            effectiveBranchId,
                        });
                    } catch (le) {
                        console.warn('[purchases] failed to load local suppliers (fallback path)', le);
                    }
                    setLinkedSuppliers([...linkedOnly, ...localRows]);
                    setLinkedSuppliersUsingRegisteredFallback(true);
                    setLinkedSuppliersError(
                        missingWorkshopIdColumn
                            ? 'Loaded via fallback: workshop suppliers list is unavailable (backend schema). Showing linked affiliated suppliers and non-affiliated suppliers where available.'
                            : 'Loaded via fallback: workshop suppliers endpoint is not authorized. Showing linked affiliated suppliers and non-affiliated suppliers where available.',
                    );
                    return;
                } catch {
                    // fallthrough
                }
            }
            let localRowsAfterError = [];
            try {
                localRowsAfterError = await fetchNonAffiliatedSupplierPickerRows({
                    invoiceBranchId,
                    modalOpen,
                    effectiveBranchId,
                });
            } catch (le) {
                console.warn('[purchases] failed to load local suppliers (after primary error)', le);
            }
            setLinkedSuppliers(localRowsAfterError);
            setLinkedSuppliersError(e.message || 'Could not load workshop suppliers.');
        } finally {
            setLinkedSuppliersLoading(false);
        }
    }, [effectiveBranchId, modalOpen, invoiceBranchId]);

    const loadPurchaseInvoices = useCallback(async () => {
        /** Workshop-wide list when sidebar is "All branches"; single branch otherwise (fallback: first visible branch). */
        const listScope =
            selectedBranchId === 'all'
                ? 'all'
                : selectedBranchId && selectedBranchId !== 'all'
                  ? selectedBranchId
                  : branchesForUi[0]?.id ?? null;

        if (listScope !== 'all' && !listScope) {
            setInvoices([]);
            return;
        }
        setInvoicesLoading(true);
        setInvoicesError('');
        try {
            const branchParams = branchScopeParams(listScope);
            const [res, localRes] = await Promise.all([
                listWorkshopSupplierPurchaseInvoices({
                    limit: 100,
                    offset: 0,
                    ...branchParams,
                }),
                listAllLocalSupplierPurchaseInvoices({
                    limit: 100,
                    offset: 0,
                    ...(listScope !== 'all' && listScope ? { branchId: String(listScope) } : {}),
                }).catch(() => ({ invoices: [] })),
            ]);
            const affList = unwrapWorkshopSupplierPurchaseInvoiceList(res);
            const localRaw = Array.isArray(localRes?.invoices) ? localRes.invoices : [];
            const merged = dedupeWorkshopPurchaseInvoiceListRows([
                ...localRaw.map((raw) => normalizeWorkshopSupplierPurchaseInvoiceRow(raw)),
                ...affList.map((raw) => normalizeWorkshopSupplierPurchaseInvoiceRow(raw)),
            ]).sort(compareWorkshopPurchaseInvoiceListRowsDesc);
            setInvoices(merged);
        } catch (e) {
            setInvoices([]);
            setInvoicesError(e.message || 'Could not load purchase invoices.');
        } finally {
            setInvoicesLoading(false);
        }
    }, [selectedBranchId, branchesForUi]);

    const closeViewInvoiceModal = useCallback(() => {
        setViewModalOpen(false);
        setViewInvoiceRow(null);
        setViewInvoiceError('');
        setViewInvoiceLoading(false);
    }, []);
    const closePurchaseInvoiceForm = useCallback(() => {
        setModalOpen(false);
        setSubmitInvoiceError('');
        setFreightSar('0');
        setAmountsTaxInclusive(false);
        setInvoiceBranchId('');
        setProductSearchByLineId({});
        setActiveProductSearchLineId(null);
        setProductDropdownPosition(null);
        setEditingDraftId(null);
        clearDraftEditSession();
    }, [clearDraftEditSession]);


    const openViewInvoiceModal = useCallback(async (listRow) => {
        if (!listRow?.id) return;
        setViewModalOpen(true);
        setViewInvoiceLoading(true);
        setViewInvoiceError('');
        setViewInvoiceRow(listRow);
        try {
            if (listRow.invoiceKind === 'local') {
                return;
            }
            const res = await getWorkshopSupplierPurchaseInvoice(listRow.id);
            const inv = unwrapWorkshopStaffSupplierPurchaseInvoiceGet(res) ?? (res && typeof res === 'object' ? res : null);
            const normalized = normalizeWorkshopSupplierPurchaseInvoiceRow(inv);
            if (normalized) {
                setViewInvoiceRow(normalized);
            } else {
                setViewInvoiceError('Invoice response was empty.');
            }
        } catch (e) {
            setViewInvoiceError(e.message || 'Could not load invoice details.');
        } finally {
            setViewInvoiceLoading(false);
        }
    }, []);

    const viewLineRows = useMemo(() => {
        if (!viewInvoiceRow?.items?.length) return [];
        return viewInvoiceRow.items.map((line, idx) => mapPurchaseInvoiceLineForView(line, idx));
    }, [viewInvoiceRow]);

    const viewUi = useMemo(
        () => pickViewInvoiceUi(viewInvoiceRow?._raw, viewInvoiceRow?.items),
        [viewInvoiceRow],
    );

    const viewDiscountLabel = useMemo(() => formatViewInvoiceDiscount(viewInvoiceRow?._raw), [viewInvoiceRow]);

    useEffect(() => {
        loadPurchaseInvoices();
    }, [loadPurchaseInvoices]);

    /** When opening the composer, default invoice branch from sidebar / first branch (before paint). */
    useLayoutEffect(() => {
        if (!modalOpen) return;
        if (editingDraftId || editingLocalPiId) return;
        if (branchesForUi.length === 0) {
            setInvoiceBranchId('');
            return;
        }
        const next =
            selectedBranchId && selectedBranchId !== 'all'
                ? String(selectedBranchId)
                : String(branchesForUi[0].id);
        setInvoiceBranchId((prev) => (prev === next ? prev : next));
    }, [modalOpen, editingDraftId, editingLocalPiId, selectedBranchId, branchesForUi]);

    useEffect(() => {
        if (!modalOpen || !invoiceBranchId) return;
        loadLinkedSuppliers();
    }, [modalOpen, invoiceBranchId, loadLinkedSuppliers]);

    const handleInvoiceBranchChange = (branchId) => {
        const id = String(branchId ?? '');
        if (!id || id === invoiceBranchId) return;
        setInvoiceBranchId(id);
        setLineItems([createEmptyLine()]);
        setProductSearchByLineId({});
        setActiveProductSearchLineId(null);
        setProductDropdownPosition(null);
    };

    useEffect(() => {
        if (activeTab !== 'price_report') return;
        loadLinkedSuppliers();
    }, [activeTab, loadLinkedSuppliers]);

    useEffect(() => {
        if (!tabState?.autoOpenModal) return;
        setModalOpen(true);
        if (tabState.prefillSupplier?.name) {
            setSelectedVendor(String(tabState.prefillSupplier.name));
        }
        if (tabState.selectedItem) {
            const item = tabState.selectedItem;
            const unitExcl = pickPriceExclusiveUnit(item);
            const unitIncl = pickPriceInclusivePurchaseUnit(item);
            const price = amountsTaxInclusive ? unitIncl : unitExcl;
            const tempLine = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                productId: String(item.id ?? ''),
                item: item.name,
                account: '1410 - Inventory Asset',
                description: '',
                uom: item.unit || 'piece',
                qty: 1,
                price,
                discount: 0,
                discountMode: 'percent',
                taxCode: TAX_LABEL,
            };
            const amts = computeLineAmounts(tempLine, false, discountIsPercent, VAT_RATE, {
                unitPriceTaxInclusive: amountsTaxInclusive,
                noVat: false,
            });
            const newLine = {
                ...tempLine,
                taxAmt: amts.taxAmt.toFixed(2),
                totalFinal: amts.totalIncl.toFixed(2),
            };
            setLineItems([newLine]);
        }
        if (clearTabState) clearTabState();
    }, [tabState, clearTabState, amountsTaxInclusive, discountIsPercent]);

    const applyDiscountForCalc = showDiscount;

    /**
     * Unit field is ex-VAT by default; when "Amounts are tax inclusive" is checked, unit is VAT-inclusive.
     */
    const lineFinancialsOpts = useMemo(
        () => ({
            taxes: TAXES,
            defaultRate: VAT_RATE,
            noVat: false,
        }),
        [],
    );

    const recalcStoredLineTotals = (line) => {
        const workingLine = applyDiscountForCalc ? line : { ...line, discount: 0 };
        return applyLineTotals(
            { ...workingLine, taxCode: line.taxCode || TAX_LABEL },
            amountsTaxInclusive,
            lineFinancialsOpts,
        );
    };

    const getProductSearchText = (line) => productSearchByLineId[line.id] ?? line.item ?? '';

    const getProductSearchResults = useCallback(
        (searchText) => {
            const q = String(searchText || '').trim().toLowerCase();
            if (!q) return [];
            return branchProductOptions
                .filter((p) => String(p.name || '').toLowerCase().includes(q))
                .slice(0, PRODUCT_SEARCH_RESULT_LIMIT);
        },
        [branchProductOptions],
    );

    const updateProductDropdownPosition = useCallback((lineId) => {
        const input = productSearchInputRefs.current[lineId];
        if (!input) return;
        const rect = input.getBoundingClientRect();
        const margin = 8;
        const minDropdownWidth = 520;
        const maxByViewport = Math.max(minDropdownWidth, window.innerWidth - margin * 2);
        const width = Math.min(Math.max(rect.width, minDropdownWidth), maxByViewport);
        let left = rect.left;
        if (left + width > window.innerWidth - margin) {
            left = Math.max(margin, window.innerWidth - width - margin);
        }
        setProductDropdownPosition({
            top: rect.bottom + 4,
            left,
            width,
        });
    }, []);

    useEffect(() => {
        if (!activeProductSearchLineId) return undefined;
        const reposition = () => updateProductDropdownPosition(activeProductSearchLineId);
        reposition();
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
    }, [activeProductSearchLineId, updateProductDropdownPosition]);

    useLayoutEffect(() => {
        if (highlightedProductIndex < 0) return;
        const root = productResultsPanelRef.current;
        if (!root) return;
        const opt = root.querySelector(
            `[data-pi-product-result-index="${highlightedProductIndex}"]`,
        );
        opt?.scrollIntoView({ block: 'nearest' });
    }, [highlightedProductIndex, productDropdownPosition, activeProductSearchLineId]);

    useEffect(() => {
        highlightedProductIndexRef.current = highlightedProductIndex;
    }, [highlightedProductIndex]);

    useEffect(() => {
        setHighlightedProductIndex(-1);
    }, [activeProductSearchLineId]);

    const updateLineItem = (id, field, value) => {
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== id) return line;
                let updatedLine = { ...line, [field]: value };
                if (field === 'uom' && value && typeof value === 'object') {
                    updatedLine = {
                        ...updatedLine,
                        uom: value.uom ?? updatedLine.uom,
                        uomProfileId: value.uomProfileId ?? null,
                        uomMode: value.uomMode ?? 'warehouse',
                    };
                }
                if (field === 'uom') {
                    const caps = lineInventoryCapsForInvoice(
                        findUomCapsForLine(updatedLine, supplierUomByProductId, branchProductOptions),
                        updatedLine,
                        workshopUomProfiles,
                    );
                    const cf = Number(caps?.conversionFactor) || 1;
                    const oldIsWh = isWarehouseUomLine(line, caps);
                    const newIsWh = isWarehouseUomLine(updatedLine, caps);
                    if (caps && cf > 0 && oldIsWh !== newIsWh) {
                        const p = parseFloat(String(line.price).replace(',', '.')) || 0;
                        updatedLine = {
                            ...updatedLine,
                            price: roundMoney2(oldIsWh ? p / cf : p * cf),
                        };
                    }
                }
                return recalcStoredLineTotals(updatedLine);
            }),
        );
    };

    useEffect(() => {
        setLineItems((prev) =>
            prev.map((line) => recalcStoredLineTotals(line)),
        );
    }, [showDiscount, discountIsPercent, amountsTaxInclusive]);

    const handleLineProductChange = (lineId, productId) => {
        if (!productId) {
            setProductSearchByLineId((prev) => ({ ...prev, [lineId]: '' }));
            setLineItems((prev) =>
                prev.map((line) => {
                    if (line.id !== lineId) return line;
                    const cleared = {
                        ...line,
                        productId: '',
                        item: '',
                        price: 0,
                        uom: 'piece',
                        account: '1410 - Inventory Asset',
                    };
                    return recalcStoredLineTotals(cleared);
                }),
            );
            return;
        }
        const opt = branchProductOptions.find((o) => o.id === productId);
        if (!opt) return;
        setProductSearchByLineId((prev) => ({ ...prev, [lineId]: opt.name }));
        setHighlightedProductIndex(-1);
        setActiveProductSearchLineId(null);
        setProductDropdownPosition(null);
        const last = lastPricesByProductId[String(productId)];
        const caps =
            opt.warehouseUnit && Number(opt.conversionFactor) > 1
                ? {
                      id: opt.supplierProductId,
                      warehouseUnit: opt.warehouseUnit,
                      workshopUnit: opt.workshopUnit,
                      conversionFactor: opt.conversionFactor,
                  }
                : findUomCapsForLine({ productId }, supplierUomByProductId, branchProductOptions);
        const defaultUom = caps
            ? defaultUomForWarehouseProduct(caps, opt.unit || 'piece')
            : opt.unit || 'piece';
        const catalogEx = Number(opt.priceExcl ?? 0);
        const catalogIncl = Number(opt.priceIncl ?? opt.priceExcl ?? 0);
        const prefillPrice = prefillPriceForLineUom({
            lineUom: defaultUom,
            caps,
            catalogUnit: opt.unit || 'piece',
            catalogEx,
            catalogIncl,
            lastRow: last,
            amountsTaxInclusive,
        });
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;
                const next = {
                    ...line,
                    productId: opt.id,
                    item: opt.name,
                    uom: defaultUom,
                    uomMode: caps && Number(caps.conversionFactor) > 1 ? 'warehouse' : line.uomMode,
                    warehouseUnit: caps?.warehouseUnit ?? null,
                    workshopUnit: caps?.workshopUnit ?? null,
                    conversionFactor: caps?.conversionFactor ?? null,
                    uomProfileId: opt.uomProfileId ?? caps?.uomProfileId ?? null,
                    supplierProductId: caps?.id ?? opt.supplierProductId ?? null,
                    account:
                        opt.type === 'Stock'
                            ? '1410 - Inventory Asset'
                            : '5100 - Cost of Goods Sold',
                    price: roundMoney2(prefillPrice),
                    taxCode: line.taxCode || TAX_LABEL,
                };
                return recalcStoredLineTotals(next);
            }),
        );
    };

    const handleLineProductSearchChange = (lineId, value) => {
        setProductSearchByLineId((prev) => ({ ...prev, [lineId]: value }));
        setHighlightedProductIndex(-1);
        setActiveProductSearchLineId(lineId);
        updateProductDropdownPosition(lineId);
        setLineItems((prev) =>
            prev.map((line) => {
                if (line.id !== lineId || !line.productId) return line;
                return recalcStoredLineTotals({
                    ...line,
                    productId: '',
                    item: '',
                    price: 0,
                    uom: 'piece',
                    account: '1410 - Inventory Asset',
                });
            }),
        );
    };

    const freightNum = useMemo(
        () => parseFloat(String(freightSar).replace(',', '.')) || 0,
        [freightSar],
    );

    const invoiceTotals = useMemo(
        () =>
            computePurchaseInvoiceTotals({
                lineItems,
                applyLineDiscount: applyDiscountForCalc,
                lineDiscountIsPercent: discountIsPercent,
                invoiceDiscountMode,
                invoiceDiscountValue,
                vatRate: VAT_RATE,
                unitPriceTaxInclusive: amountsTaxInclusive,
                noVat: false,
                freightIn: freightNum,
            }),
        [
            lineItems,
            applyDiscountForCalc,
            discountIsPercent,
            invoiceDiscountMode,
            invoiceDiscountValue,
            amountsTaxInclusive,
            freightNum,
        ],
    );

    const getSummary = () => {
        const fmt2 = (n) =>
            (Number(n) || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        const freightIn = invoiceTotals.freight_in ?? 0;
        const invoiceDiscountSar = invoiceTotals.invoice_discount_applied_ex_vat ?? 0;
        const invRaw = parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0;
        const invPctDisplayed = Math.min(100, Math.max(0, invRaw));
        return {
            subtotal: fmt2(invoiceTotals.lines_taxable_ex_vat),
            totalTax: fmt2(invoiceTotals.lines_total_vat),
            freight: fmt2(freightIn),
            freightInFormatted: fmt2(freightIn),
            invoiceDiscountFormatted: fmt2(invoiceDiscountSar),
            grandTotal: fmt2(invoiceTotals.grand_total),
            showFreightRow: Number(freightIn) > 0,
            showInvoiceDiscountRow: Number(invoiceDiscountSar) > 0,
            invoiceDiscountSummaryLabel:
                invoiceDiscountMode === 'percent'
                    ? `Invoice discount (${invPctDisplayed}%):`
                    : 'Invoice discount (fixed SAR):',
        };
    };

    const addEmptyLine = () => {
        setLineItems((prev) => [...prev, createEmptyLine()]);
    };

    const removeLine = (lineId) => {
        setProductSearchByLineId((prev) => {
            const next = { ...prev };
            delete next[lineId];
            return next;
        });
        setActiveProductSearchLineId((prev) => (prev === lineId ? null : prev));
        setProductDropdownPosition((prev) => (activeProductSearchLineId === lineId ? null : prev));
        setLineItems((prev) => {
            if (prev.length <= 1) {
                return [createEmptyLine()];
            }
            return prev.filter((l) => l.id !== lineId);
        });
    };

    /** Last row, Tab from tax-code select → new line + focus product picker */
    const handleTaxSelectTabFromLastRow = (e, lineIndex) => {
        if (e.key !== 'Tab' || e.shiftKey) return;
        if (lineIndex !== lineItems.length - 1) return;
        e.preventDefault();
        const nl = createEmptyLine();
        setLineItems((prev) => [...prev, nl]);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.querySelector(`[data-pi-row-product="${nl.id}"]`)?.focus();
            });
        });
    };

    const evalMath = (expr) => {
        const str = String(expr).trim();
        if (!str) return '';
        if (!/^[\d\s+\-*/.()]+$/.test(str)) return str;
        if (/^\d+(\.\d+)?$/.test(str)) return str;
        try {
            const result = Function(`return (${str})`)();
            if (typeof result === 'number' && isFinite(result)) return parseFloat(result.toFixed(6)).toString();
        } catch {
            /* invalid */
        }
        return str;
    };

    const handleMathKeyDown = (e, lineId, field) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const v = evalMath(e.target.value);
            updateLineItem(lineId, field, v);
        }
    };
    const handleMathBlur = (e, lineId, field) => {
        const v = evalMath(e.target.value);
        if (v !== e.target.value) updateLineItem(lineId, field, v);
    };

    const calculateDueDate = () => {
        const issue = new Date(issueDate);
        if (isNaN(issue.getTime())) return '—';
        let due = new Date(issue);
        if (dueDateType === 'Net') due.setDate(issue.getDate() + parseInt(netDays || 0, 10));
        else if (dueDateType === 'Custom') return customDueDate;
        else if (dueDateType === 'EOM') due = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    };

    const summary = getSummary();

    const totalPayables = invoices
        .filter((i) => i.payment_status !== 'paid')
        .reduce((s, i) => s + (i.balance_due || i.grand_total || 0), 0);
    const overduePayables = 0;
    const priceHistory = useMemo(
        () =>
            invoices.flatMap((inv) =>
                (inv.items || []).map((item) => ({
                    ...item,
                    invoice_number: inv.invoice_number || inv.id,
                    vendor_name: inv.vendor_name || inv.supplier,
                    invoice_date: inv.date,
                    invoice_id: inv.id,
                })),
            ),
        [invoices],
    );

    /** Vendors from invoices plus linked workshop suppliers (so new links appear before first invoice). */
    const priceReportVendorOptions = useMemo(() => {
        const set = new Set();
        for (const v of invoices.map((i) => i.vendor_name || i.supplier).filter(Boolean)) {
            set.add(String(v).trim());
        }
        for (const s of linkedSuppliers) {
            if (s?.name && String(s.name).trim()) set.add(String(s.name).trim());
        }
        return [...set].sort((a, b) => a.localeCompare(b));
    }, [invoices, linkedSuppliers]);

    /** Products that actually appear on at least one invoice line (not static catalog). */
    const invoicedProductOptions = useMemo(() => {
        const seen = new Set();
        const opts = [];
        for (const r of priceHistory) {
            const pid =
                r.product_id ??
                r.productId ??
                r.branchCatalogProductId ??
                r.branch_catalog_product_id;
            const pname = String(r.product_name ?? r.productName ?? r.itemName ?? r.item_name ?? '').trim();
            if (pid != null && String(pid).trim() !== '') {
                const key = String(pid);
                if (seen.has(key)) continue;
                seen.add(key);
                opts.push({ value: key, label: pname || `Product ${key}` });
            } else if (pname) {
                const key = `name:${pname}`;
                if (seen.has(key)) continue;
                seen.add(key);
                opts.push({ value: key, label: pname });
            }
        }
        opts.sort((a, b) => a.label.localeCompare(b.label));
        return opts;
    }, [priceHistory]);

    const filteredHistory = useMemo(() => {
        return priceHistory.filter((r) => {
            const matchSupplier = filterSupplier === 'all' || r.vendor_name === filterSupplier;
            const rowPid = String(
                r.product_id ?? r.productId ?? r.branchCatalogProductId ?? r.branch_catalog_product_id ?? '',
            );
            const rowName = String(r.product_name ?? r.productName ?? '').trim();
            let matchProduct = filterProduct === 'all';
            if (!matchProduct && filterProduct.startsWith('name:')) {
                matchProduct = rowName === filterProduct.slice(5);
            } else if (!matchProduct) {
                matchProduct = rowPid === filterProduct;
            }
            return matchSupplier && matchProduct;
        });
    }, [priceHistory, filterSupplier, filterProduct]);

    useEffect(() => {
        if (filterProduct === 'all') return;
        if (!invoicedProductOptions.some((o) => o.value === filterProduct)) {
            setFilterProduct('all');
        }
    }, [invoicedProductOptions, filterProduct]);

    useEffect(() => {
        if (filterSupplier === 'all') return;
        if (!priceReportVendorOptions.includes(filterSupplier)) {
            setFilterSupplier('all');
        }
    }, [priceReportVendorOptions, filterSupplier]);
    const invoiceSupplierOptions = useMemo(() => {
        const names = linkedSuppliers.map((s) => s.name).filter(Boolean);
        return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    }, [linkedSuppliers]);

    const selectedSupplierRow = useMemo(
        () => linkedSuppliers.find((s) => s.name === selectedVendor) ?? null,
        [linkedSuppliers, selectedVendor],
    );

    const isModalLocalSupplier = isNonAffiliatedPickerSupplier(selectedSupplierRow);

    /**
     * Detect supplier portal status — workshop_local suppliers do NOT need to
     * approve; we apply inventory at PI save time on the server. Used to swap
     * the AP alert message and skip "wait for approval" copy.
     */
    const isSelectedSupplierWorkshopLocal = useMemo(
        () =>
            isNonAffiliatedPickerSupplier(selectedSupplierRow) ||
            isWorkshopPortalLocalSupplier(selectedSupplierRow),
        [selectedSupplierRow],
    );

    /**
     * Fetch supplier-scoped last purchase prices when the selected supplier
     * changes inside the open modal. Cleared on close / no supplier.
     */
    useEffect(() => {
        if (!modalOpen) {
            setLastPricesByProductId({});
            return;
        }
        const supId = selectedSupplierRow?.id;
        if (!supId) {
            setLastPricesByProductId({});
            return;
        }
        let cancelled = false;
        setLastPricesLoading(true);
        getWorkshopSupplierLastPurchasePrices(supId, {
            supplierKind: isSelectedSupplierWorkshopLocal ? 'local' : 'affiliated',
            branchId: invoiceBranchId ?? undefined,
        })
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res?.prices) ? res.prices : [];
                const map = {};
                for (const row of list) {
                    if (row?.productId == null) continue;
                    map[String(row.productId)] = row;
                }
                setLastPricesByProductId(map);
            })
            .catch(() => {
                if (cancelled) return;
                setLastPricesByProductId({});
            })
            .finally(() => {
                if (!cancelled) setLastPricesLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [modalOpen, selectedSupplierRow, isSelectedSupplierWorkshopLocal, invoiceBranchId]);

    /** Load Box/Liter conversion rules when ordering from an affiliated supplier. */
    useEffect(() => {
        if (!modalOpen || !invoiceBranchId || isSelectedSupplierWorkshopLocal) {
            setSupplierUomByProductId({});
            return;
        }
        const supId = selectedSupplierRow?.id;
        if (!supId) {
            setSupplierUomByProductId({});
            return;
        }
        let cancelled = false;
        getWorkshopSupplierProductUomRules(supId, invoiceBranchId)
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res?.rules) ? res.rules : [];
                const map = {};
                for (const rule of list) {
                    if (rule?.productId == null) continue;
                    map[String(rule.productId)] = rule;
                }
                setSupplierUomByProductId(map);
            })
            .catch(() => {
                if (cancelled) return;
                setSupplierUomByProductId({});
            });
        return () => {
            cancelled = true;
        };
    }, [modalOpen, invoiceBranchId, selectedSupplierRow, isSelectedSupplierWorkshopLocal]);

    /** Reload branch catalog with supplier UOM rules when branch or affiliated supplier changes. */
    useEffect(() => {
        if (!modalOpen || !invoiceBranchId) return;
        const supId = isSelectedSupplierWorkshopLocal ? undefined : selectedSupplierRow?.id;
        loadBranchProducts(supId);
    }, [
        modalOpen,
        invoiceBranchId,
        selectedSupplierRow?.id,
        isSelectedSupplierWorkshopLocal,
        loadBranchProducts,
    ]);

    /** When UOM rules arrive after product pick, default lines to warehouse UOM (e.g. Box). */
    useEffect(() => {
        if (!modalOpen) return;
        if (!Object.keys(supplierUomByProductId).length && !branchProductOptions.some((o) => o.warehouseUnit)) {
            return;
        }
        setLineItems((prev) => {
            let anyChanged = false;
            const next = prev.map((line) => {
                const pid = String(line.productId ?? '').trim();
                if (!pid || line.supplierProductId) return line;
                const caps = findUomCapsForLine(line, supplierUomByProductId, branchProductOptions);
                if (!caps || !(Number(caps.conversionFactor) > 1)) return line;
                const whUom = defaultUomForWarehouseProduct(caps, line.uom);
                if (
                    normUomLabel(line.uom) === normUomLabel(whUom) &&
                    line.warehouseUnit &&
                    line.uomMode !== 'workshop'
                ) {
                    return line;
                }
                const opt = branchProductOptions.find((o) => String(o.id) === pid);
                const last = lastPricesByProductId[pid];
                const prefillPrice = prefillPriceForLineUom({
                    lineUom: whUom,
                    caps,
                    catalogUnit: opt?.unit || line.uom || 'piece',
                    catalogEx: Number(opt?.priceExcl ?? 0),
                    catalogIncl: Number(opt?.priceIncl ?? opt?.priceExcl ?? 0),
                    lastRow: last,
                    amountsTaxInclusive,
                });
                anyChanged = true;
                const updated = {
                    ...line,
                    uom: whUom,
                    uomMode: 'warehouse',
                    uomProfileId: caps.uomProfileId ?? line.uomProfileId ?? null,
                    warehouseUnit: caps.warehouseUnit,
                    workshopUnit: caps.workshopUnit,
                    conversionFactor: caps.conversionFactor,
                    supplierProductId: caps.id ?? line.supplierProductId,
                    price: roundMoney2(prefillPrice),
                };
                return recalcStoredLineTotals(updated);
            });
            return anyChanged ? next : prev;
        });
    }, [
        supplierUomByProductId,
        branchProductOptions,
        modalOpen,
        lastPricesByProductId,
        amountsTaxInclusive,
    ]);

    const hasValidSubmitLine = useMemo(
        () =>
            lineItems.some((l) =>
                isInvoiceLineSubmitReady(l, productSearchByLineId[l.id]),
            ),
        [lineItems, productSearchByLineId],
    );

    useEffect(() => {
        if (!modalOpen || linkedSuppliersLoading) return;
        if (editingDraftId || editingLocalPiId) return;
        if (invoiceSupplierOptions.length === 0) {
            setSelectedVendor('');
            return;
        }
        if (selectedVendor && invoiceSupplierOptions.includes(selectedVendor)) return;
        setSelectedVendor(invoiceSupplierOptions[0]);
    }, [modalOpen, linkedSuppliersLoading, invoiceSupplierOptions, selectedVendor, editingDraftId, editingLocalPiId]);

    /** After suppliers load, align vendor row with the draft's supplier id once (does not override manual changes afterward). */
    useEffect(() => {
        if (!modalOpen || linkedSuppliersLoading || (!editingDraftId && !editingLocalPiId)) return;
        if (draftSupplierSyncedRef.current) return;
        const wantId = editingDraftSupplierIdRef.current;
        if (!wantId) {
            draftSupplierSyncedRef.current = true;
            return;
        }
        const isRowLocal = (s) => isNonAffiliatedPickerSupplier(s);
        const editingLocalPi = Boolean(editingLocalPiId);
        const row = linkedSuppliers.find((s) => {
            if (String(s.id) !== String(wantId)) return false;
            return editingLocalPi ? isRowLocal(s) : !isRowLocal(s);
        });
        if (!row?.name) {
            return;
        }
        const current = linkedSuppliers.find((s) => {
            if (s.name !== selectedVendor) return false;
            return editingLocalPi ? isRowLocal(s) : !isRowLocal(s);
        });
        if (String(current?.id) !== String(wantId)) {
            setSelectedVendor(row.name);
        }
        draftSupplierSyncedRef.current = true;
    }, [modalOpen, linkedSuppliersLoading, linkedSuppliers, editingDraftId, editingLocalPiId, selectedVendor]);

    const canSubmitPurchaseInvoice =
        Boolean(invoiceBranchId) &&
        !linkedSuppliersLoading &&
        !submittingInvoice &&
        invoiceSupplierOptions.length > 0 &&
        Boolean(selectedVendor) &&
        invoiceSupplierOptions.includes(selectedVendor) &&
        Boolean(selectedSupplierRow?.id) &&
        lineItems.length > 0 &&
        hasValidSubmitLine;

    /** Draft save: branch + supplier only; partial lines and empty product rows are OK. */
    const canSavePurchaseInvoiceDraft =
        Boolean(invoiceBranchId) &&
        !linkedSuppliersLoading &&
        !submittingInvoice &&
        invoiceSupplierOptions.length > 0 &&
        Boolean(selectedVendor) &&
        invoiceSupplierOptions.includes(selectedVendor) &&
        Boolean(selectedSupplierRow?.id);

    const hydrateDraftInvoiceForm = (invoice) => {
        const payload = invoice?.payload && typeof invoice.payload === 'object' ? invoice.payload : {};
        const snapshot =
            payload.form_snapshot ??
            payload.formSnapshot ??
            (payload.form && typeof payload.form === 'object' ? payload.form : null);
        if (snapshot && typeof snapshot === 'object') {
            setInvoiceBranchId(String(snapshot.invoice_branch_id ?? snapshot.invoiceBranchId ?? payload.branch_id ?? ''));
            setSelectedVendor(String(snapshot.selected_vendor ?? snapshot.selectedVendor ?? ''));
            setIssueDate(String(snapshot.issue_date ?? snapshot.issueDate ?? todayIso).slice(0, 10));
            setDueDateType(String(snapshot.due_date_type ?? snapshot.dueDateType ?? 'Net').trim() || 'Net');
            setNetDays(Number(snapshot.net_days ?? snapshot.netDays ?? 30) || 30);
            setCustomDueDate(String(snapshot.custom_due_date ?? snapshot.customDueDate ?? todayIso).slice(0, 10));
            setVendorInvoiceRef(String(snapshot.vendor_invoice_ref ?? snapshot.vendorInvoiceRef ?? ''));
            setInvoiceDescription(String(snapshot.invoice_description ?? snapshot.invoiceDescription ?? ''));
            setInvoiceNotes(String(snapshot.invoice_notes ?? snapshot.invoiceNotes ?? ''));
            setInvoiceDiscountValue(String(snapshot.invoice_discount_value ?? snapshot.invoiceDiscountValue ?? '0'));
            const discMode = String(snapshot.invoice_discount_mode ?? snapshot.invoiceDiscountMode ?? 'fixed_sar').toLowerCase();
            setInvoiceDiscountMode(discMode.includes('percent') ? 'percent' : 'fixed_sar');
            setShowDesc(Boolean(snapshot.show_desc ?? snapshot.showDesc ?? true));
            setShowDiscount(Boolean(snapshot.show_discount ?? snapshot.showDiscount ?? false));
            setDiscountIsPercent(Boolean(snapshot.discount_is_percent ?? snapshot.discountIsPercent ?? false));
            setAmountsTaxInclusive(Boolean(snapshot.amounts_tax_inclusive ?? snapshot.amountsTaxInclusive ?? false));
            setFreightSar(String(snapshot.freight_sar ?? snapshot.freightSar ?? '0'));
            setUpdateLastPurchasePrice(
                Boolean(snapshot.update_last_purchase_price ?? snapshot.updateLastPurchasePrice ?? true),
            );
            const searchMap =
                snapshot.product_search_by_line_id ??
                snapshot.productSearchByLineId ??
                {};
            const rawLines = Array.isArray(snapshot.line_items)
                ? snapshot.line_items
                : Array.isArray(snapshot.lineItems)
                  ? snapshot.lineItems
                  : [];
            const nextSearch = {};
            const nextLines = rawLines.map((line) => {
                const lineId = String(
                    line.client_line_id ?? line.clientLineId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                );
                const itemName =
                    line.item ?? line.item_name ?? line.itemName ?? line.product_name ?? '';
                nextSearch[lineId] = String(searchMap[lineId] ?? searchMap[line.id] ?? itemName ?? '');
                return {
                    id: lineId,
                    productId: String(line.productId ?? line.branch_catalog_product_id ?? ''),
                    item: itemName,
                    account: line.account ?? '1410 - Inventory Asset',
                    description: line.description ?? '',
                    uom: line.uom ?? 'piece',
                    qty: line.qty ?? line.quantity ?? 1,
                    price: line.price ?? 0,
                    discount: line.discount ?? 0,
                    discountMode: line.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent',
                    taxCode: line.tax_code ?? line.taxCode ?? TAX_LABEL,
                    taxAmt: String(line.taxAmt ?? line.tax_amount ?? '0.00'),
                    totalFinal: String(line.totalFinal ?? line.line_total_incl_vat ?? '0.00'),
                    warehouseUnit: line.warehouseUnit ?? null,
                    workshopUnit: line.workshopUnit ?? null,
                    conversionFactor: line.conversionFactor ?? null,
                    supplierProductId: line.supplierProductId ?? null,
                };
            });
            setLineItems(nextLines.length > 0 ? nextLines : [createEmptyLine()]);
            setProductSearchByLineId(nextSearch);
            setActiveProductSearchLineId(null);
            setProductDropdownPosition(null);
            return;
        }
        const ui = payload.ui && typeof payload.ui === 'object' ? payload.ui : invoice?.ui || {};
        const duePayload =
            payload.dueDate && typeof payload.dueDate === 'object'
                ? payload.dueDate
                : payload.due_date && typeof payload.due_date === 'object'
                  ? payload.due_date
                  : null;
        const invDiscount = payload.invoiceDiscount || payload.invoice_discount || {};
        const payloadLines = Array.isArray(payload.lines) ? payload.lines : [];
        const formLines = Array.isArray(payload.form_lines) ? payload.form_lines : [];
        const detailLines = Array.isArray(invoice?.items) ? invoice.items : [];
        const sourceLines =
            formLines.length > 0 ? formLines : payloadLines.length > 0 ? payloadLines : detailLines;
        const loadedAmountsTaxInclusive = Boolean(
            ui.amountsTaxInclusive ??
                ui.amounts_tax_inclusive ??
                ui.prices_include_vat ??
                payload.prices_include_vat ??
                false,
        );
        const nextDiscountIsPercent = Boolean(ui.lineDiscountIsPercent ?? ui.line_discount_is_percent ?? false);

        setInvoiceBranchId(String(payload.branch_id ?? payload.branchId ?? invoice?.branchId ?? invoice?.branch_id ?? ''));
        const rawInv = invoice?._raw && typeof invoice._raw === 'object' ? invoice._raw : invoice;
        const isLocalPi =
            rawInv?._invoiceKind === 'local' ||
            invoice?._invoiceKind === 'local' ||
            invoice?.invoiceKind === 'local';
        setSelectedVendor(
            isLocalPi
                ? firstNonEmptyString(
                      invoice?.vendor_name,
                      invoice?.vendorName,
                      invoice?.supplier_name,
                      invoice?.supplierName,
                      invoice?.supplier?.name,
                  ) || selectedVendor
                : firstNonEmptyString(
                      invoice?.supplier?.name,
                      invoice?.supplier_name,
                      invoice?.supplierName,
                      invoice?.vendor_name,
                      invoice?.vendorName,
                  ) || selectedVendor,
        );
        setIssueDate(String(payload.issue_date ?? payload.issueDate ?? invoice?.issueDate ?? todayIso).slice(0, 10));
        setDueDateType(
            String(
                payload.due_date_type ??
                    duePayload?.type ??
                    invoice?.paymentTerms ??
                    invoice?.payment_terms ??
                    'Net',
            ).trim() || 'Net',
        );
        setNetDays(Number(duePayload?.net_days ?? duePayload?.netDays ?? invoice?.netDays ?? 30) || 30);
        setCustomDueDate(
            String(duePayload?.custom_date ?? duePayload?.customDate ?? invoice?.dueDate ?? todayIso).slice(0, 10),
        );
        setVendorInvoiceRef(
            payload.vendorInvoiceRef ??
                payload.vendor_invoice_ref ??
                invoice?.refNumber ??
                '',
        );
        setInvoiceDescription(payload.description ?? payload.invoice_description ?? invoice?.description ?? '');
        setInvoiceNotes(payload.notes ?? invoice?.notes ?? '');
        const headerDiscRaw =
            invDiscount.mode ?? invoice?.discountType ?? invoice?.discount_type ?? 'fixed_sar';
        const headerDisc = String(headerDiscRaw).toLowerCase();
        setInvoiceDiscountMode(
            headerDisc === 'percent' || headerDisc.includes('percent') ? 'percent' : 'fixed_sar',
        );
        setInvoiceDiscountValue(String(invDiscount.value ?? invoice?.discountAmount ?? '0'));
        setShowDesc(Boolean(ui.showLineDescriptionColumn ?? ui.show_line_description_column ?? true));
        setShowDiscount(Boolean(ui.showLineDiscountColumn ?? ui.show_line_discount_column ?? false));
        setDiscountIsPercent(nextDiscountIsPercent);
        setAmountsTaxInclusive(loadedAmountsTaxInclusive);
        setFreightSar(String(payload.freightIn ?? payload.freight_in ?? invoice?.freightIn ?? '0'));
        setUpdateLastPurchasePrice(Boolean(payload.updateLastPurchasePriceOnSave ?? payload.update_last_purchase_price_on_save ?? true));
        const nextSearch = {};
        const nextLines = sourceLines.map((line) => {
            const lineId = String(line.client_line_id ?? line.clientLineId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
            const itemName =
                line.item ??
                line.item_name ??
                line.itemName ??
                line.product_name ??
                '';
            const productId = String(
                line.productId ??
                    line.branch_catalog_product_id ??
                    line.branchCatalogProductId ??
                    line.product_id ??
                    '',
            );
            const qty = line.qty ?? line.quantity ?? 1;
            const taxCode = line.tax_code ?? line.taxCode ?? TAX_LABEL;
            const unitEx = Number(line.unit_price_ex_vat ?? line.unitPriceExVat ?? line.unitPrice ?? 0);
            const price =
                line.price != null && line.price !== ''
                    ? line.price
                    : reconstructInvoiceUnitPriceInput(
                          {
                              qty,
                              unitPrice: unitEx,
                              lineDiscountValue: line.discount ?? line.line_discount_raw ?? 0,
                              lineDiscountMode:
                                  line.discountMode ??
                                  line.line_discount_mode ??
                                  line.lineDiscountMode,
                          },
                          loadedAmountsTaxInclusive,
                          taxCode,
                          { taxes: TAXES, defaultRate: VAT_RATE },
                      );
            const lineDiscMode =
                line.discountMode ??
                line.line_discount_mode ??
                line.lineDiscountMode ??
                (nextDiscountIsPercent ? 'percent' : 'fixed_sar');
            nextSearch[lineId] = String(itemName || '');
            return recalcStoredLineTotals({
                id: lineId,
                productId,
                item: itemName,
                account:
                    line.account ??
                    line.account_display ??
                    `${line.account_code ?? '1410'} - ${line.account_name ?? 'Inventory Asset'}`,
                description: line.description ?? '',
                uom: line.uom ?? 'piece',
                qty,
                price,
                discount: line.discount ?? line.line_discount_raw ?? 0,
                discountMode: lineDiscMode === 'fixed_sar' ? 'fixed_sar' : 'percent',
                taxCode: line.tax_code ?? line.taxCode ?? TAX_LABEL,
                taxAmt: String(line.taxAmt ?? line.tax_amount ?? line.taxAmount ?? '0.00'),
                totalFinal: String(line.totalFinal ?? line.line_total_incl_vat ?? line.total ?? '0.00'),
            });
        });
        setLineItems(nextLines.length > 0 ? nextLines : [createEmptyLine()]);
        setProductSearchByLineId(nextSearch);
        setActiveProductSearchLineId(null);
        setProductDropdownPosition(null);
    };

    const handleEditDraftInvoice = async (invoice) => {
        setEditingDraftLoadingId(invoice.id);
        setInvoicesError('');
        try {
            const isLocal = invoice.invoiceKind === 'local' || invoice._raw?._invoiceKind === 'local';
            if (isLocal) {
                const res = await getWorkshopLocalPurchaseInvoice(invoice.id);
                const detail = res?.purchaseInvoice ?? res;
                draftSupplierSyncedRef.current = false;
                editingDraftSupplierIdRef.current = String(detail?.supplier?.id ?? '').trim();
                setEditingLocalPiId(String(invoice.id));
                setEditingDraftId(null);
                hydrateDraftInvoiceForm(detail);
                setModalOpen(true);
                return;
            }
            const res = await getWorkshopSupplierPurchaseInvoice(invoice.id);
            const detail = res?.purchaseInvoice ?? res?.invoice ?? res?.data ?? res;
            draftSupplierSyncedRef.current = false;
            editingDraftSupplierIdRef.current = String(
                detail?.supplier?.id ?? detail?.supplierId ?? detail?.supplier_id ?? '',
            ).trim();
            setEditingLocalPiId(null);
            setEditingDraftId(invoice.id);
            hydrateDraftInvoiceForm(detail);
            setModalOpen(true);
        } catch (e) {
            setInvoicesError(e.message || 'Could not load draft purchase invoice.');
        } finally {
            setEditingDraftLoadingId(null);
        }
    };

    const handleCreateInvoice = async (submitStatus = 'pending') => {
        const isDraftSave = submitStatus === 'draft';
        if (isDraftSave ? !canSavePurchaseInvoiceDraft : !canSubmitPurchaseInvoice) return;
        setSubmitInvoiceError('');
        const normalizedSubmitStatus = isDraftSave ? 'draft' : 'pending';
        const isLocalSupplier = isNonAffiliatedPickerSupplier(selectedSupplierRow);
        const selectedLineItems = isDraftSave
            ? lineItems
            : lineItems.filter((line) =>
                  isInvoiceLineSubmitReady(line, productSearchByLineId[line.id]),
              );
        if (!isDraftSave && selectedLineItems.length === 0) {
            setSubmitInvoiceError(
                'Add at least one line with an account (or product), quantity, and unit price.',
            );
            return;
        }
        if (!isDraftSave) {
            const invalidQtyIndex = selectedLineItems.findIndex((line) => {
                const qty = parseFloat(String(line.qty ?? '').replace(',', '.'));
                return !Number.isFinite(qty) || qty <= 0;
            });
            if (invalidQtyIndex !== -1) {
                const originalIndex = lineItems.findIndex((line) => line.id === selectedLineItems[invalidQtyIndex].id);
                setSubmitInvoiceError(`Line ${originalIndex + 1}: qty must be greater than 0.`);
                return;
            }
        }
        if (normalizedSubmitStatus !== 'draft') {
            for (const line of selectedLineItems) {
                const pid = String(line.productId ?? '').trim();
                if (!pid) continue;
                const opt = branchProductOptions.find((o) => String(o.id) === pid);
                if (!opt) {
                    const originalIndex = lineItems.findIndex((l) => l.id === line.id);
                    setSubmitInvoiceError(
                        `Line ${originalIndex + 1}${line.item ? ` (${line.item})` : ''}: product is not active on this branch. Pick it again from the branch product list or remove the line.`,
                    );
                    return;
                }
            }
        }
        const totals = computePurchaseInvoiceTotals({
            lineItems: selectedLineItems,
            applyLineDiscount: applyDiscountForCalc,
            lineDiscountIsPercent: discountIsPercent,
            invoiceDiscountMode,
            invoiceDiscountValue,
            vatRate: VAT_RATE,
            unitPriceTaxInclusive: amountsTaxInclusive,
            noVat: false,
            freightIn: freightNum,
        });
        const enrichedLines = buildPurchaseInvoiceLinesForSave(selectedLineItems, {
            applyLineDiscount: applyDiscountForCalc,
            lineDiscountIsPercent: discountIsPercent,
            amountsTaxInclusive,
            forDraft: isDraftSave,
            productSearchByLineId,
        });
        const dueComputed = calculateDueDate();
        const formSnapshot = buildPurchaseInvoiceFormSnapshot({
            invoiceBranchId,
            selectedVendor,
            supplierId: selectedSupplierRow?.id ?? null,
            issueDate,
            dueDateType,
            netDays,
            customDueDate,
            vendorInvoiceRef,
            invoiceDescription,
            invoiceNotes,
            invoiceDiscountValue,
            invoiceDiscountMode,
            showDesc,
            showDiscount,
            discountIsPercent,
            amountsTaxInclusive,
            freightSar,
            updateLastPurchasePrice,
            productSearchByLineId,
            lineItems,
        });
        const purchaseInvoicePayload = buildPurchaseInvoicePayload({
            status: normalizedSubmitStatus,
            branch_id: invoiceBranchId,
            selected_branch_filter: selectedBranchId ?? null,
            issue_date: issueDate,
            due_date_type: dueDateType,
            due_net_days: netDays,
            due_date_custom: customDueDate,
            due_date_computed: dueComputed === '—' ? '' : dueComputed,
            vendor_invoice_ref: vendorInvoiceRef,
            supplier: { id: selectedSupplierRow?.id ?? null, name: selectedVendor || '' },
            invoice_description: invoiceDescription,
            notes: invoiceNotes,
            currency: 'SAR',
            vat_rate: VAT_RATE,
            vat_label: TAX_LABEL,
            ui: {
                show_line_description_column: showDesc,
                show_line_discount_column: showDiscount,
                line_discount_is_percent: discountIsPercent,
                amounts_tax_inclusive: amountsTaxInclusive,
                prices_include_vat: amountsTaxInclusive,
                no_vat: false,
            },
            invoice_discount: {
                mode: invoiceDiscountMode,
                value: parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0,
            },
            update_last_purchase_price_on_save: updateLastPurchasePrice,
            lines: enrichedLines,
            totals,
        });
        const createBody = {
            ...buildCreateWorkshopSupplierPurchaseInvoiceBody({
                supplierId: selectedSupplierRow.id,
                branchId: invoiceBranchId,
                issueDate,
                dueDateType,
                netDays,
                customDueDate,
                computedDueDate: dueComputed === '—' ? '' : dueComputed,
                vendorInvoiceRef: vendorInvoiceRef,
                description: invoiceDescription,
                notes: invoiceNotes,
                currency: 'SAR',
                status: normalizedSubmitStatus,
                showLineDescriptionColumn: showDesc,
                showLineDiscountColumn: showDiscount,
                lineDiscountIsPercent: discountIsPercent,
                invoiceDiscountMode,
                invoiceDiscountValue: parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0,
                updateLastPurchasePriceOnSave: updateLastPurchasePrice,
                freightIn: freightNum,
                showAmountsTaxInclusive: amountsTaxInclusive,
                pricesIncludeVat: amountsTaxInclusive,
                noVat: false,
                selectedBranchFilter: selectedBranchId ?? null,
                vatLabel: TAX_LABEL,
                vatRate: VAT_RATE,
                tax: { label: TAX_LABEL, rate: VAT_RATE },
                lines: enrichedLines,
                totals,
            }),
            ...purchaseInvoicePayload,
            vendor_invoice_ref: vendorInvoiceRef,
            description: invoiceDescription,
            notes: invoiceNotes,
            tax: { label: TAX_LABEL, rate: VAT_RATE },
            form_lines: serializePurchaseInvoiceFormLines(lineItems),
            form_snapshot: formSnapshot,
        };
        if (import.meta.env.DEV) void console.info('[purchase_invoice_payload]', purchaseInvoicePayload);
        setSubmittingInvoice(true);
        try {
            let createRes;
            if (isLocalSupplier) {
                const masterProductIdForLocalPi = (ln) => {
                    const bcid = ln.branch_catalog_product_id;
                    if (bcid == null || String(bcid).trim() === '') return '';
                    const sid = String(bcid).trim();
                    const opt = branchProductOptions.find((o) => String(o.id) === sid);
                    return opt ? String(opt.id).trim() : sid;
                };
                const localLines = enrichedLines
                    .map((ln) => {
                        const productId = masterProductIdForLocalPi(ln);
                        const itemName = String(ln.item_name ?? '').trim();
                        if (!productId && !itemName) return null;
                        return {
                            ...(productId ? { productId } : {}),
                            itemName: itemName || 'Off-catalog line',
                            description: ln.description ?? null,
                            uom: ln.uom ?? null,
                            qty: Number(ln.quantity ?? ln.qty ?? 0),
                            unitPrice: Number(ln.unit_price_ex_vat ?? 0),
                            discount: Number(ln.line_discount_amount ?? ln.line_discount_raw ?? 0),
                            discountType: discountIsPercent ? 'percent' : 'fixed',
                            taxCode: 'VAT15',
                            taxAmount: Number(ln.tax_amount ?? 0),
                            lineTotal: Number(ln.taxable_ex_vat ?? ln.gross_ex_vat ?? 0),
                            total: Number(ln.line_total_incl_vat ?? 0),
                        };
                    })
                    .filter(Boolean);
                const localApiStatus = normalizedSubmitStatus === 'draft' ? 'draft' : 'completed';
                const localPiPayload = {
                    branchId: String(invoiceBranchId),
                    issueDate,
                    dueDate: dueComputed === '—' ? undefined : dueComputed,
                    paymentTerms: dueDateType,
                    netDays,
                    refNumber: vendorInvoiceRef || undefined,
                    description: invoiceDescription || undefined,
                    notes: invoiceNotes || undefined,
                    subtotal: Number(totals?.subtotal_ex_vat ?? 0),
                    discountAmount:
                        parseFloat(String(invoiceDiscountValue).replace(',', '.')) || 0,
                    discountType:
                        invoiceDiscountMode?.includes('percent') ? 'percent' : 'fixed',
                    freightIn: freightNum,
                    taxAmount: Number(totals?.total_vat ?? 0),
                    grandTotal: Number(totals?.grand_total ?? 0),
                    lines: localLines,
                    status: localApiStatus,
                    ui: {
                        showLineDescriptionColumn: showDesc,
                        showLineDiscountColumn: showDiscount,
                        lineDiscountIsPercent: discountIsPercent,
                        amountsTaxInclusive,
                        amounts_tax_inclusive: amountsTaxInclusive,
                        prices_include_vat: amountsTaxInclusive,
                    },
                    form_lines: serializePurchaseInvoiceFormLines(lineItems),
                    form_snapshot: formSnapshot,
                    updateLastPurchasePriceOnSave: updateLastPurchasePrice,
                };
                if (!isDraftSave && localLines.length === 0) {
                    throw new Error(
                        'Add at least one line with an account (or product), quantity, and unit price.',
                    );
                }
                if (editingLocalPiId) {
                    createRes = await patchWorkshopLocalPurchaseInvoice(editingLocalPiId, localPiPayload);
                } else {
                    createRes = await createLocalSupplierPurchaseInvoice(
                        String(selectedSupplierRow.id),
                        localPiPayload,
                    );
                }
                const applied = String(createRes?.status ?? '').toLowerCase() === 'completed';
                createRes = {
                    ...(createRes || {}),
                    autoApplied: applied,
                    stock: { applied, lines: localLines },
                };
            } else if (editingDraftId) {
                createRes = await updateWorkshopSupplierPurchaseInvoiceDraft(editingDraftId, createBody);
            } else {
                createRes = await createWorkshopSupplierPurchaseInvoice(createBody);
            }
            /**
             * Workshop-only suppliers auto-apply stock on save (no approval).
             * Refresh inventory views in other tabs/pages.
             */
            if (createRes?.autoApplied || createRes?.stock?.applied) {
                try {
                    window.dispatchEvent(
                        new CustomEvent('workshop-inventory-updated', {
                            detail: {
                                branchId: invoiceBranchId,
                                source: 'workshop_local_pi_auto_apply',
                            },
                        }),
                    );
                } catch {
                    /* non-fatal */
                }
            }
            await loadPurchaseInvoices();
            setModalOpen(false);
            setLineItems([]);
            setIssueDate(todayIso);
            setCustomDueDate(todayIso);
            setDueDateType('Net');
            setNetDays(30);
            setVendorInvoiceRef('');
            setRefAutoGenerate(false);
            setInvoiceDescription('');
            setInvoiceNotes('');
            setInvoiceDiscountValue('0');
            setInvoiceDiscountMode('fixed_sar');
            setFreightSar('0');
            setAmountsTaxInclusive(false);
            setInvoiceBranchId('');
            setProductSearchByLineId({});
            setActiveProductSearchLineId(null);
            setProductDropdownPosition(null);
            setEditingDraftId(null);
            clearDraftEditSession();
            setUpdateLastPurchasePrice(true);
        } catch (e) {
            setSubmitInvoiceError(e.message || 'Could not create purchase invoice.');
        } finally {
            setSubmittingInvoice(false);
        }
    };

    if (modalOpen) {
        return (
            <WorkshopSubScreen
                title={editingDraftId || editingLocalPiId ? 'Edit Purchase Invoice Draft' : 'New Purchase Invoice'}
                subtitle="Record supplier purchases, line items, and stock for a branch."
                backLabel="Back to Purchase Invoices"
                onBack={closePurchaseInvoiceForm}
                backDisabled={submittingInvoice}
                size="full"
                maxWidth="1350px"
                className="ws-pi-sub-screen"
                footer={(
                    <div className="pi-modal-footer">
                        <div className="pi-footer-left">
                            <button
                                type="button"
                                className="btn-pi-cancel"
                                onClick={closePurchaseInvoiceForm}
                                disabled={submittingInvoice}
                            >
                                Cancel
                            </button>
                        </div>
                        <div className="pi-footer-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                            {submitInvoiceError && (
                                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#B91C1C', maxWidth: 420, textAlign: 'right' }}>
                                    {submitInvoiceError}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <button
                                    type="button"
                                    className="btn-pi-draft"
                                    onClick={() => handleCreateInvoice('draft')}
                                    disabled={!canSavePurchaseInvoiceDraft || submittingInvoice}
                                >
                                    {submittingInvoice
                                        ? 'Saving…'
                                        : editingDraftId || editingLocalPiId
                                          ? 'Update Draft'
                                          : 'Save as Draft'}
                                </button>
                                <button
                                    type="button"
                                    className="btn-pi-create"
                                    onClick={() => handleCreateInvoice('pending')}
                                    disabled={!canSubmitPurchaseInvoice || submittingInvoice}
                                    title={
                                        !canSubmitPurchaseInvoice
                                            ? 'Need invoice branch, linked supplier with ID, at least one line with a branch product, and loaded suppliers.'
                                            : undefined
                                    }
                                >
                                    {submittingInvoice
                                        ? 'Creating…'
                                        : editingDraftId || editingLocalPiId
                                          ? isModalLocalSupplier
                                              ? 'Complete invoice'
                                              : 'Send to Supplier'
                                          : isModalLocalSupplier
                                            ? 'Create purchase invoice'
                                            : 'Create Purchase Invoice'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            >
                <div className="modal-content-purchase">
                    <div className="pi-form-container">
                        {branchesForUi.length === 0 && (
                            <p
                                style={{
                                    padding: '10px 14px',
                                    marginBottom: 12,
                                    borderRadius: 8,
                                    background: '#FFF7ED',
                                    border: '1px solid #FED7AA',
                                    fontSize: '0.875rem',
                                }}
                            >
                                Add a workshop branch before creating purchase invoices.
                            </p>
                        )}
                        {branchesForUi.length > 0 && (
                            <div className="pi-field pi-full-width" style={{ marginBottom: 16 }}>
                                <label>Branch for this invoice *</label>
                                <select
                                    value={invoiceBranchId}
                                    onChange={(e) => handleInvoiceBranchChange(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        fontSize: '0.9375rem',
                                        background: '#f8fafc',
                                    }}
                                >
                                    {branchesForUi.map((b) => (
                                        <option key={b.id} value={String(b.id)}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="pi-sub-label" style={{ marginTop: 6 }}>
                                    Products and quantities apply to this branch only. When the supplier approves and
                                    stock is updated, inventory changes on this branch.
                                </p>
                            </div>
                        )}
                        {!invoiceBranchId && branchesForUi.length > 0 && (
                            <p
                                style={{
                                    padding: '10px 14px',
                                    marginBottom: 12,
                                    borderRadius: 8,
                                    background: '#FFF7ED',
                                    border: '1px solid #FED7AA',
                                    fontSize: '0.875rem',
                                }}
                            >
                                Choose a branch above to load branch products for line items.
                            </p>
                        )}
                        {branchProductsError && (
                            <p style={{ color: '#B45309', fontSize: '0.875rem', marginBottom: 8 }}>{branchProductsError}</p>
                        )}
                        {!branchProductsLoading &&
                            invoiceBranchId &&
                            branchProductOptions.length === 0 &&
                            !branchProductsError && (
                                <p
                                    style={{
                                        color: '#92400E',
                                        fontSize: '0.875rem',
                                        marginBottom: 8,
                                        padding: '8px 12px',
                                        background: '#FFFBEB',
                                        border: '1px solid #FDE68A',
                                        borderRadius: 8,
                                    }}
                                >
                                    No branch products were returned. Check that this branch has products in catalog
                                    / inventory, or that the workshop-staff / workshop-catalog APIs are reachable.
                                </p>
                            )}
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
                                <span className="pi-sub-label">Due: {calculateDueDate()}</span>
                            </div>
                            <InvoiceRefField
                                placeholder="Vendor inv #"
                                value={vendorInvoiceRef}
                                onChange={setVendorInvoiceRef}
                                autoGenerate={refAutoGenerate}
                                onAutoGenerateChange={setRefAutoGenerate}
                                fetchNextReference={() =>
                                    getNextWorkshopPurchaseInvoiceReference({
                                        branchId: invoiceBranchId || selectedBranchId,
                                    })
                                }
                            />
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>Supplier / Vendor *</label>
                            <select
                                value={selectedVendor}
                                onChange={(e) => setSelectedVendor(e.target.value)}
                                disabled={linkedSuppliersLoading || invoiceSupplierOptions.length === 0}
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 10,
                                    fontSize: '0.9375rem',
                                    background: '#f8fafc',
                                }}
                            >
                                {linkedSuppliersLoading && (
                                    <option value="">Loading suppliers…</option>
                                )}
                                {!linkedSuppliersLoading && invoiceSupplierOptions.length === 0 && (
                                    <option value="">No suppliers linked to this workshop</option>
                                )}
                                {!linkedSuppliersLoading &&
                                    invoiceSupplierOptions.map((v) => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                            </select>
                            {linkedSuppliersUsingRegisteredFallback && (
                                <p className="pi-sub-label" style={{ color: '#B45309', marginTop: 6 }}>
                                    Supplier list is using the registered-suppliers fallback (same as Suppliers tab
                                    when the main endpoint fails).
                                </p>
                            )}
                            {linkedSuppliersError && (
                                <p className="pi-sub-label" style={{ color: '#B45309', marginTop: 6 }}>
                                    {linkedSuppliersError}
                                </p>
                            )}
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>Description</label>
                            <input
                                type="text"
                                placeholder="Invoice description (optional)"
                                value={invoiceDescription}
                                onChange={(e) => setInvoiceDescription(e.target.value)}
                            />
                        </div>

                        <div className="pi-lines-section ws-pi-lines-section">
                            <div className="ws-pi-lines-scroll">
                                <table className="ws-pi-lines-table">
                                    <colgroup>
                                        <col style={{ width: 44 }} />
                                        <col style={{ width: 40 }} />
                                        <col style={{ width: showDesc ? '17%' : '21%' }} />
                                        <col style={{ width: showDesc ? '14%' : '18%' }} />
                                        {showDesc ? <col style={{ width: '12%' }} /> : null}
                                        <col style={{ width: 96 }} />
                                        <col style={{ width: 72 }} />
                                        <col style={{ width: 96 }} />
                                        {showDiscount ? <col className="ws-pi-col-discount" style={{ width: 168 }} /> : null}
                                        <col style={{ width: showDiscount ? '8%' : '10%' }} />
                                        <col style={{ width: 84 }} />
                                        <col style={{ width: 80 }} />
                                        <col style={{ width: showDiscount ? '8%' : '10%' }} />
                                        <col style={{ width: 130 }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th scope="col" className="ws-pi-th-hash">
                                                #
                                            </th>
                                            <th scope="col" className="ws-pi-th-actions" aria-label="Remove line" />
                                            <th scope="col">Item</th>
                                            <th scope="col">Account</th>
                                            {showDesc ? <th scope="col">Description</th> : null}
                                            <th scope="col">UOM</th>
                                            <th scope="col" className="ws-pi-th-num">
                                                Qty
                                            </th>
                                            <th scope="col" className="ws-pi-th-num">
                                                Unit price {amountsTaxInclusive ? '(incl. VAT)' : '(ex VAT)'}
                                            </th>
                                            {showDiscount ? (
                                                <th scope="col" className="ws-pi-th-num">
                                                    Discount
                                                </th>
                                            ) : null}
                                            <th scope="col" className="ws-pi-th-num">
                                                Total
                                            </th>
                                            <th scope="col" title="Fixed VAT 15% for workshop supplier purchase invoices">
                                                Tax code
                                            </th>
                                            <th scope="col" className="ws-pi-th-num">
                                                Tax Amt
                                            </th>
                                            <th scope="col" className="ws-pi-th-num">
                                                Total
                                            </th>
                                            <th
                                                scope="col"
                                                title="Supplier-scoped: last price you paid this supplier for this product (per unit, incl. VAT when applicable)"
                                            >
                                                Last from supplier (incl.)
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.map((line, idx) => {
                                            const piLineColumnCount =
                                                12 + (showDesc ? 1 : 0) + (showDiscount ? 1 : 0);
                                            const workingLine = applyDiscountForCalc
                                                ? line
                                                : { ...line, discount: 0 };
                                            const amounts = computeLineFinancials(
                                                workingLine,
                                                amountsTaxInclusive,
                                                lineFinancialsOpts,
                                            );
                                            const uomCaps = lineInventoryCapsForInvoice(
                                                findUomCapsForLine(
                                                    line,
                                                    supplierUomByProductId,
                                                    branchProductOptions,
                                                ),
                                                line,
                                                workshopUomProfiles,
                                            );
                                            const capsRow =
                                                uomCaps ||
                                                branchProductToUomCaps(
                                                    branchProductOptions.find(
                                                        (o) => String(o.id) === String(line.productId),
                                                    ),
                                                );
                                            const uomOpts = capsRow
                                                ? lineUomOptions(line, capsRow)
                                                : [String(line.uom || 'piece').trim() || 'piece'];
                                            const conversionHint = parseWorkshopPurchaseLineUomHint(
                                                { ...line, price: line.price },
                                                uomCaps || capsRow,
                                            );
                                            return (
                                                <React.Fragment key={line.id}>
                                                <tr>
                                                    <td className="ws-pi-td-hash">{idx + 1}</td>
                                                    <td className="ws-pi-td-actions">
                                                        <button
                                                            type="button"
                                                            className="ws-pi-remove-line-btn"
                                                            tabIndex={-1}
                                                            aria-label="Remove line"
                                                            title="Remove line"
                                                            onClick={() => removeLine(line.id)}
                                                        >
                                                            <Trash2 size={16} aria-hidden />
                                                        </button>
                                                    </td>
                                                    <td>
                                                        {(() => {
                                                            const searchText = getProductSearchText(line);
                                                            const productResults = getProductSearchResults(searchText);
                                                            const canSearchProducts = !!invoiceBranchId && !branchProductsLoading;
                                                            const showProductResults =
                                                                activeProductSearchLineId === line.id && canSearchProducts;
                                                            return (
                                                                <div className="ws-pi-product-search">
                                                                    <input
                                                                        type="text"
                                                                        className="pi-row-input ws-pi-product-search-input"
                                                                        data-pi-row-product={line.id}
                                                                        ref={(node) => {
                                                                            if (node) productSearchInputRefs.current[line.id] = node;
                                                                            else delete productSearchInputRefs.current[line.id];
                                                                        }}
                                                                        value={searchText}
                                                                        disabled={!invoiceBranchId || branchProductsLoading}
                                                                        autoComplete="off"
                                                                        placeholder={
                                                                            branchProductsLoading
                                                                                ? 'Loading products...'
                                                                                : invoiceBranchId
                                                                                  ? 'Product (optional) — or pick account'
                                                                                  : 'Choose branch first'
                                                                        }
                                                                        onFocus={() => {
                                                                            setActiveProductSearchLineId(line.id);
                                                                            updateProductDropdownPosition(line.id);
                                                                        }}
                                                                        onChange={(e) => handleLineProductSearchChange(line.id, e.target.value)}
                                                                        onBlur={() => {
                                                                            window.setTimeout(() => {
                                                                                setHighlightedProductIndex(-1);
                                                                                setActiveProductSearchLineId((prev) =>
                                                                                    prev === line.id ? null : prev,
                                                                                );
                                                                                setProductDropdownPosition(null);
                                                                            }, 120);
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            const trimmed = String(searchText || '').trim();
                                                                            if (e.key === 'Escape') {
                                                                                if (!showProductResults) return;
                                                                                e.preventDefault();
                                                                                setHighlightedProductIndex(-1);
                                                                                setActiveProductSearchLineId(null);
                                                                                setProductDropdownPosition(null);
                                                                                return;
                                                                            }
                                                                            if (e.key === 'ArrowDown') {
                                                                                if (productResults.length === 0) return;
                                                                                e.preventDefault();
                                                                                setHighlightedProductIndex((prev) =>
                                                                                    prev < 0
                                                                                        ? 0
                                                                                        : Math.min(
                                                                                              prev + 1,
                                                                                              productResults.length - 1,
                                                                                          ),
                                                                                );
                                                                                return;
                                                                            }
                                                                            if (e.key === 'ArrowUp') {
                                                                                if (productResults.length === 0) return;
                                                                                e.preventDefault();
                                                                                setHighlightedProductIndex((prev) =>
                                                                                    prev <= 0 ? -1 : prev - 1,
                                                                                );
                                                                                return;
                                                                            }
                                                                            if (e.key !== 'Enter') return;
                                                                            e.preventDefault();
                                                                            if (productResults.length > 0) {
                                                                                const h = highlightedProductIndexRef.current;
                                                                                const pick =
                                                                                    h >= 0 && h < productResults.length
                                                                                        ? h
                                                                                        : 0;
                                                                                handleLineProductChange(line.id, productResults[pick].id);
                                                                                return;
                                                                            }
                                                                            const manual = String(searchText || '').trim();
                                                                            setProductSearchByLineId((prev) => ({
                                                                                ...prev,
                                                                                [line.id]: manual,
                                                                            }));
                                                                            setLineItems((prev) =>
                                                                                prev.map((l) =>
                                                                                    l.id === line.id
                                                                                        ? { ...l, item: manual, productId: '' }
                                                                                        : l,
                                                                                ),
                                                                            );
                                                                            setActiveProductSearchLineId(null);
                                                                            setProductDropdownPosition(null);
                                                                        }}
                                                                    />
                                                                    {showProductResults &&
                                                                        productDropdownPosition &&
                                                                        createPortal(
                                                                            <div
                                                                                ref={productResultsPanelRef}
                                                                                className="ws-pi-product-results"
                                                                                role="listbox"
                                                                                aria-label="Product search results"
                                                                                style={{
                                                                                    top: productDropdownPosition.top,
                                                                                    left: productDropdownPosition.left,
                                                                                    width: productDropdownPosition.width,
                                                                                }}
                                                                            >
                                                                                {String(searchText || '').trim() ? (
                                                                                    productResults.length > 0 ? (
                                                                                        productResults.map((p, ri) => (
                                                                                            <button
                                                                                                type="button"
                                                                                                key={p.id}
                                                                                                role="option"
                                                                                                aria-selected={ri === highlightedProductIndex}
                                                                                                data-pi-product-result-index={ri}
                                                                                                className={`ws-pi-product-result${ri === highlightedProductIndex ? ' is-highlighted' : ''}`}
                                                                                                onMouseEnter={() => setHighlightedProductIndex(ri)}
                                                                                                onMouseDown={(e) => {
                                                                                                    e.preventDefault();
                                                                                                    handleLineProductChange(line.id, p.id);
                                                                                                }}
                                                                                            >
                                                                                                <span>{p.name}</span>
                                                                                                <small>
                                                                                                    {p.warehouseUnit &&
                                                                                                    Number(p.conversionFactor) > 1
                                                                                                        ? `order in ${p.warehouseUnit} · stock in ${p.workshopUnit || p.unit}`
                                                                                                        : p.unit || 'piece'}
                                                                                                </small>
                                                                                            </button>
                                                                                        ))
                                                                                    ) : (
                                                                                        <div className="ws-pi-product-empty">
                                                                                            No products match this search.
                                                                                        </div>
                                                                                    )
                                                                                ) : (
                                                                                    <div className="ws-pi-product-empty">
                                                                                        Type product name to search.
                                                                                    </div>
                                                                                )}
                                                                            </div>,
                                                                            document.body,
                                                                        )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="pi-row-input ws-pi-select"
                                                            value={line.account}
                                                            onChange={(e) => updateLineItem(line.id, 'account', e.target.value)}
                                                        >
                                                            {PI_ACCOUNT_OPTIONS.map((opt) => (
                                                                <option key={opt.code} value={`${opt.code} - ${opt.name}`}>
                                                                    {opt.code} - {opt.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    {showDesc ? (
                                                        <td>
                                                            <input
                                                                type="text"
                                                                value={line.description}
                                                                className="pi-row-input"
                                                                onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                                                            />
                                                        </td>
                                                    ) : null}
                                                    <td className="ws-pi-td-uom">
                                                        {line.productId && (capsRow || workshopUomProfiles.length > 0) ? (
                                                            <WorkshopUomSelect
                                                                variant="invoice-line"
                                                                line={line}
                                                                capsRow={capsRow}
                                                                profiles={workshopUomProfiles}
                                                                onChange={(parsed) =>
                                                                    updateLineItem(line.id, 'uom', parsed)
                                                                }
                                                            />
                                                        ) : uomOpts.length > 1 ? (
                                                            <select
                                                                className="pi-row-input ws-pi-select"
                                                                value={line.uom ?? uomOpts[0]}
                                                                onChange={(e) =>
                                                                    updateLineItem(line.id, 'uom', e.target.value)
                                                                }
                                                            >
                                                                {uomOpts.map((opt) => (
                                                                    <option key={opt} value={opt}>
                                                                        {opt}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <span className="ws-pi-td-muted">{line.uom}</span>
                                                        )}
                                                    </td>
                                                    <td className="ws-pi-td-num ws-pi-td-qty">
                                                        <input
                                                            type="text"
                                                            value={line.qty === '' || line.qty === undefined ? '' : String(line.qty)}
                                                            className="pi-row-input-num pi-math-input"
                                                            onChange={(e) => updateLineItem(line.id, 'qty', e.target.value)}
                                                            onKeyDown={(e) => handleMathKeyDown(e, line.id, 'qty')}
                                                            onBlur={(e) => handleMathBlur(e, line.id, 'qty')}
                                                        />
                                                    </td>
                                                    <td
                                                        className="ws-pi-td-num ws-pi-price-cell"
                                                        title={
                                                            amountsTaxInclusive
                                                                ? 'Prefilled from supplier last price incl. VAT (or master catalog incl.). Editable.'
                                                                : 'Prefilled from supplier last price ex VAT (or master catalog ex VAT). Editable.'
                                                        }
                                                    >
                                                        <input
                                                            type="text"
                                                            value={
                                                                line.price === '' || line.price === undefined
                                                                    ? ''
                                                                    : String(line.price)
                                                            }
                                                            className="pi-row-input-num pi-math-input"
                                                            placeholder="0.00"
                                                            onChange={(e) => updateLineItem(line.id, 'price', e.target.value)}
                                                            onKeyDown={(e) => handleMathKeyDown(e, line.id, 'price')}
                                                            onBlur={(e) => handleMathBlur(e, line.id, 'price')}
                                                        />
                                                    </td>
                                                    {showDiscount ? (
                                                        <td className="ws-pi-td-num ws-pi-td-discount">
                                                            <div className="ws-pi-discount-cell">
                                                                <input
                                                                    type="text"
                                                                    className="pi-row-input-num pi-math-input ws-pi-discount-input"
                                                                    value={
                                                                        line.discount === '' || line.discount === undefined
                                                                            ? ''
                                                                            : String(line.discount)
                                                                    }
                                                                    onChange={(e) => updateLineItem(line.id, 'discount', e.target.value)}
                                                                    onKeyDown={(e) => handleMathKeyDown(e, line.id, 'discount')}
                                                                    onBlur={(e) => handleMathBlur(e, line.id, 'discount')}
                                                                />
                                                                <select
                                                                    className="pi-row-input ws-pi-discount-kind"
                                                                    value={line.discountMode === 'fixed_sar' ? 'fixed_sar' : 'percent'}
                                                                    onChange={(e) => updateLineItem(line.id, 'discountMode', e.target.value)}
                                                                >
                                                                    <option value="percent">%</option>
                                                                    <option value="fixed_sar">SAR</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                    ) : null}
                                                    <td className="ws-pi-td-num">SAR {amounts.lineExStr}</td>
                                                    <td className="ws-pi-td-tax">
                                                        <select
                                                            className="pi-row-input ws-pi-select"
                                                            value={line.taxCode || TAX_LABEL}
                                                            onChange={(e) => updateLineItem(line.id, 'taxCode', e.target.value)}
                                                            onKeyDown={(e) => handleTaxSelectTabFromLastRow(e, idx)}
                                                        >
                                                            {TAXES.map((t) => (
                                                                <option key={t.code} value={t.code}>
                                                                    {t.code}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="ws-pi-td-num">SAR {amounts.taxAmtStr}</td>
                                                    <td className="ws-pi-td-num ws-pi-td-strong">SAR {amounts.grandInclStr}</td>
                                                    <td className="ws-pi-td-num">
                                                        {(() => {
                                                            if (!line.productId) {
                                                                return <span style={{ color: '#94a3b8', fontSize: 11 }}>—</span>;
                                                            }
                                                            if (lastPricesLoading) {
                                                                return <span style={{ color: '#94a3b8', fontSize: 11 }}>Loading…</span>;
                                                            }
                                                            const last = lastPricesByProductId[String(line.productId)];
                                                            if (!last) {
                                                                return (
                                                                    <span
                                                                        style={{
                                                                            color: '#a16207',
                                                                            fontSize: 11,
                                                                            fontStyle: 'italic',
                                                                            whiteSpace: 'nowrap',
                                                                        }}
                                                                        title="No prior purchase from this supplier for this product — supplier-scoped last price unavailable."
                                                                    >
                                                                        Not purchased yet
                                                                    </span>
                                                                );
                                                            }
                                                            /** Per-unit after line discount; incl-VAT matches line total ÷ qty on prior PI */
                                                            const lastIncl = Number(last.lastUnitPriceInclVat ?? 0);
                                                            const lastEx = Number(last.lastUnitPriceExVat ?? 0);
                                                            const lastQty = Number(last.qty ?? 0);
                                                            const meta = [];
                                                            if (Number.isFinite(lastQty) && lastQty > 1) {
                                                                meta.push(`qty ${lastQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}`);
                                                            }
                                                            if (last.hadLineDiscount) meta.push('after disc.');
                                                            const tooltip =
                                                                `Per unit after line discount\n` +
                                                                `Incl. VAT: SAR ${Number.isFinite(lastIncl) ? lastIncl.toFixed(2) : '0.00'}\n` +
                                                                (!amountsTaxInclusive &&
                                                                Number.isFinite(lastEx) &&
                                                                lastEx > 0
                                                                    ? `Ex VAT: SAR ${lastEx.toFixed(2)}\n`
                                                                    : '') +
                                                                `Invoice ${last.lastInvoiceNumber || '—'}` +
                                                                (last.lastIssueDate ? `\nDate: ${last.lastIssueDate}` : '') +
                                                                (meta.length ? `\n(${meta.join(', ')})` : '');
                                                            return (
                                                                <div
                                                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
                                                                    title={tooltip}
                                                                >
                                                                    <span style={{ fontWeight: 600, color: '#0f766e' }}>
                                                                        SAR {Number.isFinite(lastIncl) ? lastIncl.toFixed(2) : '0.00'}
                                                                    </span>
                                                                    {!amountsTaxInclusive &&
                                                                    Number.isFinite(lastEx) &&
                                                                    lastEx > 0 &&
                                                                    Math.abs(lastEx - lastIncl) > 0.005 ? (
                                                                        <span style={{ fontSize: 10, color: '#64748b' }}>
                                                                            ex VAT SAR {lastEx.toFixed(2)}
                                                                        </span>
                                                                    ) : null}
                                                                    {last.lastIssueDate ? (
                                                                        <span style={{ fontSize: 10, color: '#64748b' }}>
                                                                            {last.lastIssueDate}
                                                                            {meta.length ? ` · ${meta.join(' · ')}` : ''}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                </tr>
                                                {conversionHint ? (
                                                    <tr className="ws-pi-conversion-subrow">
                                                        <td colSpan={2} aria-hidden />
                                                        <td colSpan={piLineColumnCount - 2}>
                                                            <div className="ws-pi-uom-conversion-hint">
                                                                <span className="ws-pi-uom-conversion-rule">
                                                                    {conversionHint.rule}
                                                                </span>
                                                                <span className="ws-pi-uom-conversion-stock">
                                                                    {conversionHint.stock}
                                                                </span>
                                                                {conversionHint.prices ? (
                                                                    <span className="ws-pi-uom-conversion-prices">
                                                                        {conversionHint.prices}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : null}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="pi-line-row">
                                <div style={{ flex: 1 }} />
                                <button type="button" className="btn-add-line" onClick={addEmptyLine}>
                                    <Plus size={16} /> Add line
                                </button>
                            </div>
                            <div className="pi-hint">
                                <Zap size={14} /> Tip: By default the unit column is <strong>ex VAT</strong> (15% VAT is
                                added on each line). Check <strong>Amounts are tax inclusive</strong> to enter
                                VAT-inclusive unit prices. When a product has a conversion rule (e.g. 1 Box = 12 Liter),
                                invoice qty is in the purchase unit and branch stock is updated in the workshop unit.
                                Qty, unit price, and discount support math (e.g. 12*5).
                            </div>
                        </div>

                        <div className="pi-config-row">
                            <label className="pi-checkbox">
                                <input
                                    type="checkbox"
                                    checked={showDesc}
                                    onChange={(e) => setShowDesc(e.target.checked)}
                                />
                                <span>Column — Description</span>
                            </label>
                            <label className="pi-checkbox">
                                <input
                                    type="checkbox"
                                    checked={showDiscount}
                                    onChange={(e) => setShowDiscount(e.target.checked)}
                                />
                                <span>Column — Discount</span>
                            </label>
                            <label className="pi-checkbox">
                                <input
                                    type="checkbox"
                                    checked={amountsTaxInclusive}
                                    onChange={(e) => setAmountsTaxInclusive(e.target.checked)}
                                />
                                <span>Amounts are tax inclusive</span>
                            </label>
                        </div>

                        <div className="pi-footer-grid">
                            <div className="pi-footer-column">
                                <div className="pi-field-inline">
                                    <label>Invoice Discount</label>
                                    <div className="pi-discount-group">
                                        <input
                                            type="text"
                                            value={invoiceDiscountValue}
                                            onChange={(e) => setInvoiceDiscountValue(e.target.value)}
                                        />
                                        <select
                                            value={invoiceDiscountMode}
                                            onChange={(e) => setInvoiceDiscountMode(e.target.value)}
                                        >
                                            <option value="fixed_sar">Fixed (SAR)</option>
                                            <option value="percent">Percent (%)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="pi-field-inline">
                                    <label>Freight (SAR)</label>
                                    <input
                                        type="text"
                                        value={freightSar}
                                        onChange={(e) => setFreightSar(e.target.value)}
                                        placeholder="0"
                                        style={{ maxWidth: 140 }}
                                    />
                                </div>
                                <div className="pi-field pi-full-width">
                                    <label>Notes</label>
                                    <textarea
                                        placeholder="Internal notes"
                                        rows={4}
                                        value={invoiceNotes}
                                        onChange={(e) => setInvoiceNotes(e.target.value)}
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
                                <div className="pi-ap-alert">
                                    <span>
                                        {isSelectedSupplierWorkshopLocal ? (
                                            <>
                                                Creates <strong>Accounts Payable</strong>. This supplier is{' '}
                                                <strong>workshop-only (not onboarded)</strong> — branch inventory will be{' '}
                                                <strong>updated automatically</strong> on save (no supplier approval).
                                            </>
                                        ) : (
                                            <>
                                                Creates <strong>Accounts Payable</strong>. After goods received, click &quot;Update Stock&quot; in the
                                                list.
                                            </>
                                        )}
                                    </span>
                                </div>
                                <label className="pi-checkbox pi-price-update">
                                    <input
                                        type="checkbox"
                                        checked={updateLastPurchasePrice}
                                        onChange={(e) => setUpdateLastPurchasePrice(e.target.checked)}
                                    />
                                    <span>Update last purchase price for all products on save (master catalog)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    if (viewModalOpen && viewInvoiceRow) {
        return (
            <WorkshopSubScreen
                title={`Purchase Invoice ${viewInvoiceRow.invoice_number || viewInvoiceRow.id}`}
                subtitle={viewInvoiceRow.vendor_name || viewInvoiceRow.supplier || 'Supplier purchase invoice'}
                backLabel="Back to Purchase Invoices"
                onBack={closeViewInvoiceModal}
                size="xl"
                maxWidth="1100px"
                className="ws-pi-sub-screen"
                footer={(
                    <div className="pi-modal-footer">
                        <div className="pi-footer-left">
                            <button type="button" className="btn-pi-cancel" onClick={closeViewInvoiceModal}>
                                Close
                            </button>
                        </div>
                    </div>
                )}
            >
                <div className="modal-content-purchase">
                    <div className="pi-form-container" data-ws-pi-printable-view="1">
                        {viewInvoiceError && (
                            <p
                                style={{
                                    marginBottom: 12,
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    color: '#B91C1C',
                                    fontSize: '0.875rem',
                                }}
                            >
                                {viewInvoiceError}
                            </p>
                        )}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 8,
                                marginBottom: 12,
                            }}
                        >
                            <button
                                type="button"
                                className="btn-pi-cancel"
                                onClick={() =>
                                    navigate('/workshop/purchase-returns', {
                                        state: { prefillInvoiceId: viewInvoiceRow.id },
                                    })
                                }
                                disabled={viewInvoiceLoading}
                            >
                                Purchase Return
                            </button>
                            <button
                                type="button"
                                className="btn-pi-cancel"
                                onClick={() => printableRef.current?.downloadPdf?.()}
                                disabled={viewInvoiceLoading}
                            >
                                Download PDF
                            </button>
                        </div>
                        {viewInvoiceLoading ? (
                            <ShimmerTextBlock lines={10} />
                        ) : (
                            <WorkshopPurchaseInvoiceView
                                ref={printableRef}
                                compact
                                variant="workshop_receive"
                                detail={mapWorkshopPurchaseInvoiceForViewDetail(viewInvoiceRow)}
                                listRow={{
                                    id: viewInvoiceRow.id,
                                    invoice_number:
                                        mapWorkshopPurchaseInvoiceForViewDetail(viewInvoiceRow).invoiceNumber ??
                                        viewInvoiceRow.invoice_number,
                                    invoiceNo:
                                        mapWorkshopPurchaseInvoiceForViewDetail(viewInvoiceRow).invoiceNumber ??
                                        viewInvoiceRow.invoice_number,
                                    date: viewInvoiceRow.date,
                                    status: viewInvoiceRow.status,
                                    grand_total: viewInvoiceRow.grand_total,
                                    vendor_name: viewInvoiceRow.vendor_name ?? viewInvoiceRow.supplier,
                                    branch_name: viewInvoiceRow.branch_name,
                                }}
                            />
                        )}
                        {false && (<>
                        <div style={{ display: 'none' }}>
                            <span>
                                {viewInvoiceRow.status || '—'}
                            </span>
                            <span
                                className={`ws-badge ${viewInvoiceRow.payment_status === 'paid' ? 'ws-badge--green' : 'ws-badge--yellow'}`}
                            >
                                {viewInvoiceRow.payment_status}
                            </span>
                            <span className={`ws-badge ${viewInvoiceRow.stock_updated ? 'ws-badge--green' : 'ws-badge--yellow'}`}>
                                Stock: {viewInvoiceRow.stock_updated ? 'Updated' : 'Pending'}
                            </span>
                            {viewUi.amountsTaxInclusive ? (
                                <span className="ws-badge ws-badge--yellow" title="Unit prices were entered VAT-inclusive on create">
                                    Unit prices: VAT-inclusive
                                </span>
                            ) : null}
                        </div>
                        <div className="pi-field pi-full-width" style={{ marginBottom: 16 }}>
                            <label>Receiving branch</label>
                            <div
                                style={{
                                    padding: '10px 14px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 10,
                                    background: '#f8fafc',
                                }}
                            >
                                {viewInvoiceRow.branch_name || viewInvoiceRow.branch_id ? (
                                    <>
                                        <strong>{viewInvoiceRow.branch_name || '—'}</strong>
                                        {viewInvoiceRow.branch_id ? (
                                            <span
                                                style={{
                                                    marginLeft: 10,
                                                    fontSize: '0.8125rem',
                                                    color: 'var(--color-text-muted)',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                ID: {viewInvoiceRow.branch_id}
                                            </span>
                                        ) : null}
                                    </>
                                ) : (
                                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                )}
                            </div>
                            {!(viewInvoiceRow.branch_id || viewInvoiceRow.branch_name) ? (
                                <p className="pi-sub-label" style={{ marginTop: 6, color: '#B45309' }}>
                                    Branch not returned on this invoice yet. Ask backend to include branch (id +
                                    name) on GET workshop purchase invoice detail so receiving location shows
                                    here.
                                </p>
                            ) : (
                                <p className="pi-sub-label" style={{ marginTop: 6 }}>
                                    Inventory updates on supplier approval apply to this branch.
                                </p>
                            )}
                        </div>
                        <div className="pi-header-grid">
                            <div className="pi-field">
                                <label>Invoice #</label>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        background: '#f8fafc',
                                        fontWeight: 700,
                                        color: '#EA580C',
                                    }}
                                >
                                    {viewInvoiceRow.invoice_number || viewInvoiceRow.id}
                                </div>
                            </div>
                            <div className="pi-field">
                                <label>Issue date</label>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        background: '#f8fafc',
                                    }}
                                >
                                    {viewInvoiceRow.date || '—'}
                                </div>
                            </div>
                            <div className="pi-field">
                                <label>Due date</label>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        background: '#f8fafc',
                                    }}
                                >
                                    {viewInvoiceRow.due_date || '—'}
                                </div>
                            </div>
                            <div className="pi-field">
                                <label>Vendor ref</label>
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: 10,
                                        background: '#f8fafc',
                                    }}
                                >
                                    {viewInvoiceRow.vendor_invoice_ref || '—'}
                                </div>
                            </div>
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>Vendor</label>
                            <div
                                style={{
                                    padding: '10px 14px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 10,
                                    background: '#f8fafc',
                                }}
                            >
                                {viewInvoiceRow.vendor_name || viewInvoiceRow.supplier || '—'}
                            </div>
                        </div>
                        <div className="pi-field pi-full-width">
                            <label>Description</label>
                            <div
                                style={{
                                    padding: '10px 14px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 10,
                                    background: '#f8fafc',
                                    minHeight: 44,
                                }}
                            >
                                {viewInvoiceRow.description || '—'}
                            </div>
                        </div>
                        <div className="pi-lines-section ws-pi-lines-section">
                            <div className="ws-pi-lines-scroll">
                                <table className="ws-pi-lines-table">
                                    <colgroup>
                                        <col style={{ width: 44 }} />
                                        <col style={{ width: viewUi.showDesc ? '20%' : '28%' }} />
                                        <col style={{ width: viewUi.showDesc ? '16%' : '22%' }} />
                                        {viewUi.showDesc ? <col style={{ width: '14%' }} /> : null}
                                        <col style={{ width: 72 }} />
                                        <col style={{ width: 72 }} />
                                        <col style={{ width: 96 }} />
                                        {viewUi.showDiscount ? <col style={{ width: 88 }} /> : null}
                                        <col style={{ width: viewUi.showDiscount ? '9%' : '11%' }} />
                                        <col style={{ width: 88 }} />
                                        <col style={{ width: 88 }} />
                                        <col style={{ width: viewUi.showDiscount ? '9%' : '11%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th scope="col" className="ws-pi-th-hash">
                                                #
                                            </th>
                                            <th scope="col">Item</th>
                                            <th scope="col">Account</th>
                                            {viewUi.showDesc ? <th scope="col">Description</th> : null}
                                            <th scope="col">UOM</th>
                                            <th scope="col" className="ws-pi-th-num">
                                                Qty
                                            </th>
                                            <th scope="col" className="ws-pi-th-num">
                                                Unit price (ex VAT)
                                            </th>
                                            {viewUi.showDiscount ? (
                                                <th scope="col" className="ws-pi-th-num">
                                                    Discount{viewUi.discountIsPercent ? ' %' : ' (SAR)'}
                                                </th>
                                            ) : null}
                                            <th scope="col" className="ws-pi-th-num">
                                                Taxable (ex VAT)
                                            </th>
                                            <th scope="col">Tax</th>
                                            <th scope="col" className="ws-pi-th-num">
                                                Tax Amt
                                            </th>
                                            <th scope="col" className="ws-pi-th-num">
                                                Line total (incl VAT)
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewLineRows.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={
                                                        10 +
                                                        (viewUi.showDesc ? 1 : 0) +
                                                        (viewUi.showDiscount ? 1 : 0)
                                                    }
                                                    style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}
                                                >
                                                    No line items on this invoice
                                                </td>
                                            </tr>
                                        ) : (
                                            viewLineRows.map((row, idx) => {
                                                const fallbackTaxable = roundMoney2(
                                                    row.unitEx * row.qty - (viewUi.showDiscount ? row.lineDisc : 0),
                                                );
                                                const displayTaxable =
                                                    row.taxableFromApi != null ? row.taxableFromApi : Math.max(0, fallbackTaxable);
                                                return (
                                                    <tr key={row.key}>
                                                        <td className="ws-pi-td-hash">{idx + 1}</td>
                                                        <td className="ws-pi-td-strong">{row.item}</td>
                                                        <td style={{ fontSize: '0.8125rem' }}>{row.account}</td>
                                                        {viewUi.showDesc ? (
                                                            <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                                                {row.desc || '—'}
                                                            </td>
                                                        ) : null}
                                                        <td className="ws-pi-td-muted">{row.uom}</td>
                                                        <td className="ws-pi-td-num">{row.qty}</td>
                                                        <td className="ws-pi-td-num">SAR {row.unitEx.toFixed(2)}</td>
                                                        {viewUi.showDiscount ? (
                                                            <td className="ws-pi-td-num">SAR {row.lineDisc.toFixed(2)}</td>
                                                        ) : null}
                                                        <td className="ws-pi-td-num">SAR {displayTaxable.toFixed(2)}</td>
                                                        <td className="ws-pi-td-tax">{row.taxCode}</td>
                                                        <td className="ws-pi-td-num">SAR {row.taxAmt.toFixed(2)}</td>
                                                        <td className="ws-pi-td-num ws-pi-td-strong">SAR {row.totalIncl.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="pi-footer-grid" style={{ marginTop: 16 }}>
                            <div className="pi-footer-column">
                                <div className="pi-field-inline">
                                    <label>Invoice discount</label>
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 10,
                                            background: '#f8fafc',
                                        }}
                                    >
                                        {viewDiscountLabel}
                                    </div>
                                </div>
                                <div className="pi-field pi-full-width">
                                    <label>Notes</label>
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 10,
                                            background: '#f8fafc',
                                            whiteSpace: 'pre-wrap',
                                            minHeight: 80,
                                        }}
                                    >
                                        {viewInvoiceRow.notes || '—'}
                                    </div>
                                </div>
                            </div>
                            <div className="pi-footer-column pi-summary-column">
                                <div className="pi-summary-card">
                                    <div className="pi-summary-row">
                                        <span>Subtotal (ex VAT):</span>
                                        <span>
                                            SAR{' '}
                                            {viewInvoiceRow.subtotal.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-summary-row">
                                        <span>Total tax ({TAX_LABEL}):</span>
                                        <span>
                                            SAR{' '}
                                            {viewInvoiceRow.vat_amount.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-summary-row">
                                        <span>Freight:</span>
                                        <span>
                                            SAR{' '}
                                            {(viewInvoiceRow.freight_in ?? 0).toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-summary-row pi-grand-total">
                                        <span>Grand total:</span>
                                        <span>
                                            SAR{' '}
                                            {viewInvoiceRow.grand_total.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-summary-row">
                                        <span>Paid:</span>
                                        <span style={{ color: '#059669' }}>
                                            SAR{' '}
                                            {viewInvoiceRow.amount_paid.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    <div className="pi-summary-row">
                                        <span>Balance due:</span>
                                        <span style={{ color: '#DC2626', fontWeight: 700 }}>
                                            SAR{' '}
                                            {viewInvoiceRow.balance_due.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </>)}
                    </div>
                </div>
            </WorkshopSubScreen>
        );
    }

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 16 }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Accounts Payable</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991B1B', margin: '4px 0 0' }}>SAR {totalPayables.toLocaleString()}</p>
                    <p style={{ fontSize: '0.75rem', color: '#DC2626', margin: '4px 0 0' }}>Owed to vendors</p>
                </div>
                {overduePayables > 0 && (
                    <div style={{ padding: 16, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AlertTriangle size={20} style={{ color: '#EA580C' }} />
                        <div>
                            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#EA580C' }}>Overdue</p>
                            <p style={{ fontSize: '1.25rem', fontWeight: 800 }}>SAR {overduePayables.toLocaleString()}</p>
                        </div>
                    </div>
                )}
                <div style={{ padding: 16, background: 'var(--color-bg-muted)', border: '1px solid var(--color-border)', borderRadius: 16 }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Total Purchase Invoices</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 800, margin: '4px 0 0' }}>{invoices.length}</p>
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    {hasPermission('workshop.purchases.invoices.view') && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('invoices')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                background: activeTab === 'invoices' ? 'var(--color-text-dark)' : '#fff',
                                color: activeTab === 'invoices' ? 'var(--color-primary)' : 'var(--color-text-body)',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: activeTab === 'invoices' ? 'none' : '1px solid var(--color-border)',
                            }}
                        >
                            Purchase Invoices
                        </button>
                    )}
                    {hasPermission('workshop.purchases.price-report.view') && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('price_report')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                border: '1px solid var(--color-border)',
                                background: activeTab === 'price_report' ? 'var(--color-text-dark)' : '#fff',
                                color: activeTab === 'price_report' ? 'var(--color-primary)' : 'var(--color-text-body)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <BarChart3 size={14} />
                            Purchase Price Report
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    className="btn-portal"
                    onClick={() => {
                        setEditingDraftId(null);
                        clearDraftEditSession();
                        setAmountsTaxInclusive(false);
                        setLineItems((prev) => (prev.length > 0 ? prev : [createEmptyLine()]));
                        setModalOpen(true);
                    }}
                >
                    <Plus size={16} /> New Purchase Invoice
                </button>
            </div>
            {activeTab === 'invoices' && (
                <div className="ws-section">
                    {invoicesError && (
                        <div
                            style={{
                                marginBottom: 12,
                                padding: 12,
                                borderRadius: 10,
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                color: '#B91C1C',
                                fontSize: '0.875rem',
                            }}
                        >
                            {invoicesError}
                        </div>
                    )}
                    <WsTableScroll>
                        <table className="ws-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Vendor</th>
                                    <th>Ref</th>
                                    <th>Issue Date</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Tax</th>
                                    <th>Total</th>
                                    <th>Paid</th>
                                    <th>Balance</th>
                                    <th>Payment</th>
                                    <th>Stock</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoicesLoading && invoices.length === 0 ? (
                                    <ShimmerTableBodyRows rows={8} columns={13} />
                                ) : null}
                                {invoices.map((inv) => (
                                    <tr key={`${inv.invoiceKind === 'local' ? 'L' : 'A'}:${inv.id}`}>
                                        <td>
                                            <strong style={{ color: '#EA580C' }}>{inv.invoice_number || inv.id}</strong>
                                        </td>
                                        <td>{inv.vendor_name || inv.supplier || '–'}</td>
                                        <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            {inv.vendor_invoice_ref || '–'}
                                        </td>
                                        <td style={{ fontSize: '0.75rem' }}>{inv.date || '–'}</td>
                                        <td style={{ fontSize: '0.75rem' }}>{inv.due_date || '–'}</td>
                                        <td>
                                            <span className={`ws-badge ws-badge--${inv.status === 'approved' ? 'green' : inv.status === 'rejected' ? 'red' : inv.status === 'draft' ? 'gray' : 'yellow'}`}>
                                                {inv.status || '—'}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.75rem' }}>SAR {(inv.vat_amount || 0).toLocaleString()}</td>
                                        <td>
                                            <strong>SAR {(inv.grand_total || 0).toLocaleString()}</strong>
                                        </td>
                                        <td style={{ color: '#059669' }}>SAR {(inv.amount_paid || 0).toLocaleString()}</td>
                                        <td style={{ color: '#DC2626', fontWeight: 700 }}>SAR {(inv.balance_due || 0).toLocaleString()}</td>
                                        <td>
                                            <span
                                                className={`ws-badge ${inv.payment_status === 'paid' ? 'ws-badge--green' : 'ws-badge--yellow'}`}
                                            >
                                                {inv.payment_status}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`ws-badge ${inv.stock_updated ? 'ws-badge--green' : 'ws-badge--yellow'}`}>
                                                {inv.stock_updated ? 'Updated' : 'Pending'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {inv.status === 'draft' ? (
                                                    <button
                                                        type="button"
                                                        className="btn-portal"
                                                        style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#111827', color: '#fff', border: 'none' }}
                                                        disabled={editingDraftLoadingId === inv.id}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            void handleEditDraftInvoice(inv);
                                                        }}
                                                    >
                                                        {editingDraftLoadingId === inv.id ? 'Loading…' : 'Edit'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn-portal"
                                                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            void openViewInvoiceModal(inv);
                                                        }}
                                                    >
                                                        View
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {!invoicesLoading && invoices.length === 0 && (
                                    <tr>
                                        <td colSpan={13} style={{ textAlign: 'center', padding: 40 }}>
                                            No purchase invoices yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </WsTableScroll>
                </div>
            )}
            {activeTab === 'price_report' && (
                <div className="ws-section">
                    <div style={{ padding: 16, display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                        <div>
                            <label style={{ fontSize: '0.6875rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                                Filter by Vendor
                            </label>
                            <select
                                value={filterSupplier}
                                onChange={(e) => setFilterSupplier(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', minWidth: 160 }}
                            >
                                <option value="all">All Vendors</option>
                                {priceReportVendorOptions.map((v) => (
                                    <option key={v} value={v}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.6875rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                                Filter by Product
                            </label>
                            <select
                                value={filterProduct}
                                onChange={(e) => setFilterProduct(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', minWidth: 160 }}
                            >
                                <option value="all">All Products</option>
                                {invoicedProductOptions.map((p) => (
                                    <option key={p.value} value={p.value}>
                                        {p.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <WsTableScroll>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Vendor</th>
                                <th>Invoice #</th>
                                <th>Date</th>
                                <th>Qty</th>
                                <th>Unit</th>
                                <th>Unit Price (SAR)</th>
                                <th>Line Total</th>
                                <th>Tax</th>
                                <th>Grand Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.map((r, idx) => (
                                <tr key={idx}>
                                    <td>
                                        <strong>{r.product_name}</strong>
                                    </td>
                                    <td>{r.vendor_name}</td>
                                    <td style={{ color: '#EA580C' }}>{r.invoice_number}</td>
                                    <td style={{ fontSize: '0.75rem' }}>{r.invoice_date || '–'}</td>
                                    <td>{r.quantity}</td>
                                    <td style={{ fontSize: '0.75rem' }}>{r.unit}</td>
                                    <td>
                                        <strong style={{ color: '#2563EB' }}>SAR {parseFloat(r.unit_price || 0).toFixed(2)}</strong>
                                    </td>
                                    <td>SAR {parseFloat(r.total || 0).toFixed(2)}</td>
                                    <td style={{ fontSize: '0.75rem' }}>VAT 15%</td>
                                    <td>
                                        <strong>SAR {(parseFloat(r.total || 0) * 1.15).toFixed(2)}</strong>
                                    </td>
                                </tr>
                            ))}
                            {filteredHistory.length === 0 && (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>
                                        No price history found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </WsTableScroll>
                </div>
            )}

        </div>
    );
}
