import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, Package, AlertCircle, Wallet, RefreshCw, History, X } from 'lucide-react';
import './Workshop.css';

import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';
import { MOCK_SUPPLIERS_CATALOG } from './constants';
import { getMyProducts, getBranchProducts, patchBranchProduct } from '../../services/workshopCatalogApi';
import {
    getWorkshopStaffBranchProducts,
    getWorkshopStaffProducts,
    unwrapWorkshopBranchListResponse,
} from '../../services/workshopStaffApi';
import {
    postBranchProductInventoryAdjustment,
    postBranchBulkInventoryAdjustment,
    getBranchProductInventoryAdjustments,
} from '../../services/workshopInventoryApi';
import { useAuth } from '../../context/AuthContext';

/** Match WorkshopDashboard / WorkshopDepartments response shapes. */
function extractProducts(res) {
    return unwrapWorkshopBranchListResponse(res, 'products');
}

/**
 * GET /workshop-staff/branches/:id/products (and workshop-wide `getProducts`) return nested
 * `categories` / `uncategorizedProducts`. Flatten so each row carries server `qtyOnHand` /
 * `currentQty` for that branch (or all-branches sum), matching `branch_inventory` used by the timeline.
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

/** Single branch_inventory qty when API nests an object or an array (Prisma include). */
function pickBranchInventoryQtyFromRow(r) {
    if (!r || typeof r !== 'object') return null;
    const bi = r.branchInventory ?? r.branch_inventory;
    if (bi == null) return null;
    if (Array.isArray(bi)) {
        const first = bi[0];
        if (!first || typeof first !== 'object') return null;
        const v = first.qtyOnHand ?? first.qty_on_hand;
        return v != null && v !== '' ? Number(v) : null;
    }
    const v = bi.qtyOnHand ?? bi.qty_on_hand;
    return v != null && v !== '' ? Number(v) : null;
}

function pickNumber(...vals) {
    for (const v of vals) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}

function formatSar(amount, { decimals = 0 } = {}) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 'SAR —';
    return `SAR ${n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}`;
}

/**
 * Branch adoption opening from `workshop_products` (or top-level list fields).
 * Never use global catalog `products.opening_qty` — that is not the branch adoption baseline.
 */
function pickBranchAdoptionOpeningQty(row) {
    if (!row || typeof row !== 'object') return null;
    const wps = row.workshopProducts ?? row.workshop_products;
    if (Array.isArray(wps)) {
        for (const wp of wps) {
            const v = wp?.openingQty ?? wp?.opening_qty;
            if (v != null && v !== '') {
                const n = Number(v);
                if (Number.isFinite(n)) return n;
            }
        }
    }
    for (const v of [row.openingQty, row.opening_qty]) {
        if (v != null && v !== '') {
            const n = Number(v);
            if (Number.isFinite(n)) return n;
        }
    }
    return null;
}

/** First numeric value, or `null` if none set (so we can fall back to opening qty). */
function firstFiniteNumber(values) {
    for (const v of values) {
        if (v == null || v === '') continue;
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

export const INVENTORY_ADJUSTMENT_REASON_OPENING_QTY = 'Opening qty';

const INVENTORY_ADJUST_REASON_OPTIONS = [
    { value: INVENTORY_ADJUSTMENT_REASON_OPENING_QTY, label: 'Opening qty' },
    { value: 'Damaged Stock', label: 'Damaged Stock' },
    { value: 'Inventory Count Correction', label: 'Inventory Count Correction' },
    { value: 'Expired Item', label: 'Expired Item' },
    { value: 'Returns/Exchanges', label: 'Returns/Exchanges' },
    { value: 'Other', label: 'Other (Manual Entry)' },
];

function computeBulkAdjustmentRow(item, amount, isOpeningReason) {
    const amt = Math.max(0, Math.round(Number(amount) || 0));
    if (isOpeningReason) {
        const prevOpening =
            item.openingQty != null && item.openingQty !== ''
                ? Number(item.openingQty)
                : Number(item.qty) || 0;
        const prevCurrent = Number(item.qty) || 0;
        return {
            id: String(item.id),
            name: item.name || '—',
            sku: item.sku || '—',
            isOpening: true,
            prevQty: prevOpening,
            prevOpening,
            prevCurrent,
            newQty: amt,
            newOpening: amt,
            newCurrent: amt,
            unchanged: prevOpening === amt && prevCurrent === amt,
        };
    }
    const prevQty = Number(item.qty) || 0;
    return {
        id: String(item.id),
        name: item.name || '—',
        sku: item.sku || '—',
        isOpening: false,
        prevQty,
        prevOpening: item.openingQty != null ? Number(item.openingQty) : null,
        prevCurrent: prevQty,
        newQty: amt,
        newOpening: null,
        newCurrent: amt,
        unchanged: amt === prevQty,
    };
}

function isOpeningQtyAdjustmentEntry(entry) {
    if (!entry) return false;
    const reason = String(entry.reason ?? '').trim();
    const source = String(entry.source ?? '').toLowerCase();
    return (
        reason === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY ||
        source === 'manual_opening_qty' ||
        source === 'super_admin_starting_stock'
    );
}

function humanizeInventoryLogSource(source) {
    const s = String(source || 'manual').toLowerCase();
    if (s === 'manual_opening_qty') return 'Manual (opening qty)';
    if (s === 'supplier_purchase_invoice') return 'Supplier purchase (approved)';
    if (s === 'local_supplier_purchase_invoice') return 'Non-affiliated supplier purchase';
    if (s === 'super_admin_starting_stock') return 'Super admin (opening stock)';
    if (s === 'pos') return 'POS';
    if (s === 'purchase_receipt') return 'Purchase receipt';
    return s.replace(/_/g, ' ');
}

function humanizeInventoryLogReferenceType(type) {
    const t = String(type || '').toLowerCase();
    if (t === 'workshop_supplier_purchase_invoice') return 'Workshop purchase invoice';
    if (t === 'workshop_local_supplier_purchase_invoice') return 'Workshop local purchase invoice';
    return t.replace(/_/g, ' ');
}

function normalizeAdjustmentEntry(raw) {
    if (!raw) return null;
    const at = raw.at ?? raw.createdAt ?? raw.created_at ?? raw.occurredAt;
    if (!at) return null;
    const movementType = String(raw.movementType ?? raw.movement_type ?? '').toLowerCase();
    let source = String(raw.source ?? 'manual').toLowerCase();
    if (
        (source === 'manual' || source === '') &&
        (movementType === 'workshop_supplier_purchase_received' ||
            movementType === 'workshop_local_supplier_purchase_received' ||
            movementType.includes('supplier_purchase'))
    ) {
        source =
            movementType === 'workshop_local_supplier_purchase_received'
                ? 'local_supplier_purchase_invoice'
                : 'supplier_purchase_invoice';
    }
    const id = String(
        raw.id ?? raw.logId ?? raw.movementId ?? raw.movement_id ?? `${at}-${raw.previousQty}-${raw.newQty}`,
    );
    const previousQty =
        raw.previousQty != null
            ? Number(raw.previousQty)
            : raw.previous_qty != null
              ? Number(raw.previous_qty)
              : null;
    const newQty =
        raw.newQty != null ? Number(raw.newQty) : raw.new_qty != null ? Number(raw.new_qty) : null;
    let delta = 0;
    if (raw.delta != null) delta = Number(raw.delta);
    else if (raw.qty != null) delta = Number(raw.qty);
    else if (previousQty != null && newQty != null) delta = newQty - previousQty;
    const referenceRaw = raw.reference ?? raw.reference_json;
    const reference =
        referenceRaw && typeof referenceRaw === 'object' && !Array.isArray(referenceRaw)
            ? {
                  type: referenceRaw.type ? String(referenceRaw.type) : '',
                  id: referenceRaw.id != null ? String(referenceRaw.id) : '',
                  invoiceNumber:
                      referenceRaw.invoiceNumber != null
                          ? String(referenceRaw.invoiceNumber)
                          : referenceRaw.invoice_number != null
                            ? String(referenceRaw.invoice_number)
                            : undefined,
              }
            : null;
    const reason =
        raw.reason ||
        (source === 'supplier_purchase_invoice' ? 'Supplier purchase (approved)' : null) ||
        (source === 'local_supplier_purchase_invoice' ? 'Non-affiliated supplier purchase' : null) ||
        '—';
    return {
        id,
        at: String(at),
        previousQty,
        newQty,
        delta,
        reason,
        note: raw.note ?? raw.notes ?? null,
        adjustedBy: raw.adjustedBy ?? raw.adjusted_by ?? raw.user ?? null,
        source,
        reference,
        movementType: movementType || undefined,
        affectsOpening: isOpeningQtyAdjustmentEntry({ reason, source }),
    };
}

function extractAdjustmentEntries(res) {
    const list =
        (Array.isArray(res?.data?.entries) && res.data.entries)
        || (Array.isArray(res?.entries) && res.entries)
        || (Array.isArray(res?.data?.movements) && res.data.movements)
        || (Array.isArray(res?.movements) && res.movements)
        || [];
    return list.map(normalizeAdjustmentEntry).filter(Boolean);
}

function extractTimelineMeta(res) {
    const data = res?.data && typeof res.data === 'object' ? res.data : res;
    if (!data || typeof data !== 'object') return null;
    const stored =
        data.storedOpeningQty != null
            ? Number(data.storedOpeningQty)
            : data.stored_opening_qty != null
              ? Number(data.stored_opening_qty)
              : null;
    const current =
        data.currentQtyOnHand != null
            ? Number(data.currentQtyOnHand)
            : data.current_qty_on_hand != null
              ? Number(data.current_qty_on_hand)
              : null;
    if (!Number.isFinite(stored) && !Number.isFinite(current)) return null;
    return {
        storedOpeningQty: Number.isFinite(stored) ? stored : null,
        currentQtyOnHand: Number.isFinite(current) ? current : null,
    };
}

function mergeLogEntries(localList, serverList) {
    const byId = new Map();
    for (const e of serverList || []) byId.set(e.id, e);
    for (const e of localList || []) {
        if (!byId.has(e.id)) byId.set(e.id, e);
    }
    return [...byId.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/** Latest adoption baseline from audit rows (opening-qty adjustments only). */
function latestOpeningQtyFromLogEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const openingRows = entries.filter((e) => isOpeningQtyAdjustmentEntry(e));
    if (openingRows.length === 0) return null;
    openingRows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const latest = openingRows[0];
    if (latest?.newQty == null || !Number.isFinite(Number(latest.newQty))) return null;
    return Number(latest.newQty);
}

/** Same low-stock rule as the dashboard & Dept & Products. */
function isLowStockRow(p) {
    const crit = Number(p.critical_level) || 0;
    const qty = Number(p.qty) || 0;
    return crit > 0 && qty <= crit;
}

function pickDisplayName(master, row) {
    const candidates = [
        master?.name,
        row?.name,
        row?.productName,
        row?.product_name,
        row?.serviceName,
        row?.itemName,
        row?.item_name,
        master?.title,
    ];
    for (const c of candidates) {
        if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    const sku = master?.sku ?? row?.sku;
    if (sku != null && String(sku).trim() !== '') return String(sku).trim();
    return 'Unnamed';
}

function buildInventorySearchText(row) {
    const fields = [
        row?._searchText,
        row?.name,
        row?.productName,
        row?.product_name,
        row?.itemName,
        row?.item_name,
        row?.sku,
        row?.code,
        row?.barcode,
        row?.partNumber,
        row?.part_number,
        row?.brand,
        row?.departmentName,
        row?.department_name,
        row?.categoryName,
        row?.category_name,
        row?.id,
    ];
    return fields
        .map(normalizeInventorySearchValue)
        .filter(Boolean)
        .join(' ');
}

function normalizeInventorySearchValue(value) {
    if (value == null) return '';
    let s = String(value);
    try {
        if (typeof s.normalize === 'function') {
            s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
        }
    } catch {
        /* lone surrogates / engines without normalize — fall back to raw string */
    }
    return s.toLowerCase().trim();
}

function buildRawInventorySearchText(...sources) {
    const fields = [];
    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;
        fields.push(
            source.name,
            source.productName,
            source.product_name,
            source.itemName,
            source.item_name,
            source.title,
            source.sku,
            source.code,
            source.barcode,
            source.partNumber,
            source.part_number,
            source.brand,
            source.departmentName,
            source.department_name,
            source.department?.name,
            source.categoryName,
            source.category_name,
            source.category?.name,
            source.id,
            source.productId,
            source.product_id,
        );
    }
    return fields.map(normalizeInventorySearchValue).filter(Boolean).join(' ');
}

function matchesProductNameSearch(row, query) {
    const q = normalizeInventorySearchValue(query);
    if (!q) return true;
    /** Prefer full row index (name, SKU, dept, brand, `_searchText`) so search works across API shapes and Vercel builds. */
    const hay = normalizeInventorySearchValue(buildInventorySearchText(row));
    if (!hay) return false;
    return q
        .split(/\s+/)
        .filter(Boolean)
        .every((term) => hay.includes(term));
}

/** Value written into the search field when a suggestion is chosen (matches token search). */
function inventorySearchValueFromRow(row) {
    const name = String(row?.name ?? '').trim();
    const sku = String(row?.sku ?? '').trim();
    return [name, sku].filter(Boolean).join(' ').trim() || name || sku || '';
}

const INV_SEARCH_SUGGEST_LIMIT = 12;

/**
 * Same merge as Dept & Products `buildBranchProductRow`: branch link fields win over nested
 * `product` snapshot so on-hand qty does not fall back to catalog/stale `currentQty` on the master.
 */
function mergeBranchProductRowForInventory(row) {
    const master = row?.product && typeof row.product === 'object' ? row.product : {};
    const branchOpening = pickBranchAdoptionOpeningQty(row);
    return {
        ...row,
        ...master,
        id: master.id ?? row?.productId ?? row?.product_id ?? row?.id,
        /** Keep branch-scoped inventory from the workshop row; nested `product` must not wipe it. */
        branchInventory: row?.branchInventory ?? row?.branch_inventory ?? master?.branchInventory,
        branch_inventory: row?.branch_inventory ?? row?.branchInventory ?? master?.branch_inventory,
        openingQty: branchOpening ?? row?.openingQty ?? row?.opening_qty,
        opening_qty: branchOpening ?? row?.opening_qty ?? row?.opening_qty,
        currentQty: row?.currentQty ?? master?.currentQty,
        current_qty: row?.current_qty ?? master?.current_qty,
        qtyOnHand: row?.qtyOnHand ?? master?.qtyOnHand,
        qty_on_hand: row?.qty_on_hand ?? master?.qty_on_hand,
        stockQty: row?.stockQty ?? master?.stockQty,
        stock_qty: row?.stock_qty ?? master?.stock_qty,
        criticalStockPoint: row?.criticalStockPoint ?? master?.criticalStockPoint,
        critical_stock_point: row?.critical_stock_point ?? master?.critical_stock_point,
        salePriceOverride: row?.salePriceOverride ?? master?.salePriceOverride,
        salePriceBeforeVat: row?.salePriceBeforeVat ?? master?.salePriceBeforeVat,
        sellingPriceBeforeVat: row?.sellingPriceBeforeVat ?? master?.sellingPriceBeforeVat,
        salePrice: row?.salePrice ?? master?.salePrice,
        sellingPrice: row?.sellingPrice ?? master?.sellingPrice,
        purchasePrice: row?.purchasePriceOverride ?? master?.purchasePrice ?? row?.purchasePrice,
    };
}

/**
 * Map a catalog row to a flat inventory row (products only).
 * Merges link row + nested `product` like Dept & Products branch lists.
 */
function mapApiRowToInventory(row) {
    const merged = mergeBranchProductRowForInventory(row);
    const nested = row?.product && typeof row.product === 'object' ? row.product : null;
    const master = nested || row;
    const sourceRowId = row?.id ?? row?.branchProductId ?? row?.branch_product_id ?? row?.workshopProductId ?? row?.workshop_product_id;
    const branchId = row?.branchId ?? row?.branch_id ?? row?.branch?.id ?? merged.branchId ?? merged.branch_id ?? merged.branch?.id ?? '';
    const branchName = row?.branchName ?? row?.branch_name ?? row?.branch?.name ?? merged.branchName ?? merged.branch_name ?? merged.branch?.name ?? '';
    const id =
        merged.id ??
        master?.id ??
        row?.id ??
        row?.productId ??
        row?.product_id ??
        row?.serviceId ??
        row?.service_id;
    if (id == null || String(id).trim() === '') return null;

    const openingFromWorkshopLink =
        pickBranchAdoptionOpeningQty(row) ?? pickBranchAdoptionOpeningQty(merged);
    const openingFromScalars = firstFiniteNumber([
        row.openingQty,
        row.opening_qty,
        merged.openingQty,
        merged.opening_qty,
    ]);
    const openingQty = openingFromWorkshopLink != null ? openingFromWorkshopLink : openingFromScalars;
    const invQtyRow = pickBranchInventoryQtyFromRow(row);
    const invQtyMerged = pickBranchInventoryQtyFromRow(merged);
    const onHand = firstFiniteNumber([
        invQtyRow,
        invQtyMerged,
        row.qtyOnHand,
        row.qty_on_hand,
        row.currentQty,
        row.current_qty,
        merged.qtyOnHand,
        merged.qty_on_hand,
        merged.currentQty,
        merged.current_qty,
        merged.stockQty,
        merged.stock_qty,
        merged.inventory?.qtyOnHand,
        merged.inventory?.qty_on_hand,
        merged.inventory?.currentQty,
        merged.inventory?.current_qty,
    ]);
    const qty = onHand !== null ? onHand : openingQty;

    const critical_level = pickNumber(
        merged.criticalStockPoint,
        merged.critical_stock_point,
    );
    const basePrice = pickNumber(
        merged.salePriceOverride,
        merged.sellingPriceOverride,
        merged.salePriceBeforeVat,
        merged.sellingPriceBeforeVat,
        merged.salePrice,
        merged.sellingPrice,
        merged.sale_price,
        merged.purchasePrice,
        merged.purchase_price,
    );
    const purchasePrice = pickNumber(
        merged.purchasePriceOverride,
        row?.purchasePriceOverride,
        merged.purchasePrice,
        merged.purchase_price,
        row?.purchasePrice,
        row?.purchase_price,
        master?.purchasePrice,
        master?.purchase_price,
    );

    return {
        id: String(id),
        name: pickDisplayName(master, row),
        brand: master?.brand || '',
        sku: master?.sku || row?.sku || '',
        departmentName:
            master?.departmentName ||
            master?.department_name ||
            master?.department?.name ||
            row?.departmentName ||
            row?.department_name ||
            row?.department?.name ||
            '—',
        categoryName:
            master?.categoryName ||
            master?.category_name ||
            master?.category?.name ||
            row?.categoryName ||
            '—',
        basePrice,
        purchasePrice,
        openingQty,
        qty,
        critical_level,
        branchId: branchId != null && String(branchId).trim() !== '' ? String(branchId) : null,
        branchName: branchName != null && String(branchName).trim() !== '' ? String(branchName) : null,
        _rowKey: [
            id,
            branchId,
            sourceRowId,
            row?.sku ?? master?.sku ?? '',
        ].map((v) => (v == null ? '' : String(v))).join(':'),
        _searchText: buildRawInventorySearchText(row, master, merged, nested),
    };
}

function applyStatusesFromParent(rows, selectedProducts) {
    const sel = new Map((selectedProducts || []).map((s) => [String(s.id), s]));
    return rows.map((r) => {
        const match = sel.get(String(r.id));
        if (match?.status) return { ...r, status: match.status };
        const { status, ...rest } = r;
        return rest;
    });
}

function stockStatus(item) {
    if (item.status === 'Requested') return { label: 'Requested', tone: 'blue' };
    if ((Number(item.qty) || 0) <= 0) return { label: 'Out of Stock', tone: 'red' };
    if (isLowStockRow(item)) return { label: 'Low Stock', tone: 'amber' };
    return { label: 'In Stock', tone: 'green' };
}

const ADJUST_LOG_STORAGE_PREFIX = 'pos-filter:workshop-inv-adjustments:v1:';

function adjustmentLogStorageKey(selectedBranchId) {
    const key = !selectedBranchId || selectedBranchId === 'all' ? 'all' : String(selectedBranchId);
    return `${ADJUST_LOG_STORAGE_PREFIX}${key}`;
}

/** @returns {Record<string, Array<{ id: string, at: string, previousQty: number, newQty: number, delta: number, reason: string }>>} */
function loadAdjustmentLogsFromStorage(storageKey) {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return {};
        const p = JSON.parse(raw);
        return p && typeof p === 'object' ? p : {};
    } catch {
        return {};
    }
}

function saveAdjustmentLogsToStorage(storageKey, map) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(map));
    } catch {
        /* ignore quota / private mode */
    }
}

function workshopIdFromSession(workshop) {
    if (!workshop || typeof workshop !== 'object') return undefined;
    const id = workshop.id ?? workshop._id ?? workshop.workshopId;
    return id != null && String(id).trim() !== '' ? String(id) : undefined;
}

export default function WorkshopInventory({
    selectedBranchId = 'all',
    branches = [],
    selectedProducts = [],
    onTabChange,
    updateProductStatus,
}) {
    const { workshop } = useAuth();
    const workshopIdQuery = useMemo(() => workshopIdFromSession(workshop), [workshop]);

    const [searchQuery, setSearchQuery] = useState('');
    const [invSuggestOpen, setInvSuggestOpen] = useState(false);
    const [invSuggestIndex, setInvSuggestIndex] = useState(-1);
    const invSearchBlurTimerRef = useRef(null);
    const invSuggestDropdownRef = useRef(null);
    const [productRows, setProductRows] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const selectedProductsRef = useRef(selectedProducts);
    useEffect(() => {
        selectedProductsRef.current = selectedProducts;
    }, [selectedProducts]);

    const isAllBranches = !selectedBranchId || selectedBranchId === 'all';
    const selectedBranchName = useMemo(() => {
        if (isAllBranches) return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, isAllBranches, selectedBranchId]);

    const logStorageKey = useMemo(() => adjustmentLogStorageKey(selectedBranchId), [selectedBranchId]);
    const [adjustmentLogs, setAdjustmentLogs] = useState({});
    const [logProduct, setLogProduct] = useState(null);
    const [logLoading, setLogLoading] = useState(false);
    const [logFetchError, setLogFetchError] = useState('');
    const [fetchedLogEntries, setFetchedLogEntries] = useState(null);
    const [timelineMeta, setTimelineMeta] = useState(null);
    const [alignOpeningSaving, setAlignOpeningSaving] = useState(false);
    const [alignOpeningError, setAlignOpeningError] = useState('');

    const logOpeningContext = useMemo(() => {
        if (!logProduct) return null;
        const pid = String(logProduct.id);
        const row = productRows.find((p) => String(p.id) === pid);
        const rowOpening =
            timelineMeta?.storedOpeningQty != null && Number.isFinite(timelineMeta.storedOpeningQty)
                ? timelineMeta.storedOpeningQty
                : row?.openingQty != null && row?.openingQty !== ''
                  ? Number(row.openingQty)
                  : logProduct.openingQty != null && logProduct.openingQty !== ''
                    ? Number(logProduct.openingQty)
                    : null;
        const mergedForOpening = isAllBranches
            ? adjustmentLogs[pid] || []
            : logLoading
              ? null
              : mergeLogEntries(adjustmentLogs[pid] || [], fetchedLogEntries || []);
        const timelineOpening =
            mergedForOpening != null ? latestOpeningQtyFromLogEntries(mergedForOpening) : null;
        const storedDrift =
            rowOpening === 0 && timelineOpening != null && timelineOpening > 0;
        const displayOpening =
            rowOpening != null && !storedDrift ? rowOpening : timelineOpening ?? rowOpening;
        return {
            pid,
            rowOpening,
            timelineOpening,
            storedDrift,
            displayOpening,
        };
    }, [logProduct, productRows, fetchedLogEntries, timelineMeta, adjustmentLogs, isAllBranches, logLoading]);

    useEffect(() => {
        if (!logProduct) {
            setAlignOpeningError('');
            setAlignOpeningSaving(false);
            setTimelineMeta(null);
        }
    }, [logProduct]);

    const alignOpeningAdoptionFromTimeline = async () => {
        if (!logOpeningContext?.storedDrift || !logOpeningContext.timelineOpening || isAllBranches) return;
        const target = logOpeningContext.timelineOpening;
        const pid = logOpeningContext.pid;
        setAlignOpeningSaving(true);
        setAlignOpeningError('');
        try {
            const res = await postBranchProductInventoryAdjustment(
                String(selectedBranchId),
                pid,
                {
                    newQty: target,
                    reason: INVENTORY_ADJUSTMENT_REASON_OPENING_QTY,
                },
                { workshopId: workshopIdQuery },
            );
            if (!res?.success) {
                throw new Error(res?.message || 'Could not update opening adoption.');
            }
            const d = res.data || {};
            const nextOpening =
                d.openingQty != null
                    ? Number(d.openingQty)
                    : d.opening_qty != null
                      ? Number(d.opening_qty)
                      : target;
            const nextStock =
                d.qtyOnHand != null
                    ? Number(d.qtyOnHand)
                    : d.qty_on_hand != null
                      ? Number(d.qty_on_hand)
                      : nextOpening;
            setProductRows((prev) =>
                prev.map((p) =>
                    String(p.id) === pid
                        ? { ...p, openingQty: nextOpening, qty: nextStock, status: undefined }
                        : p,
                ),
            );
            setLogProduct((lp) =>
                lp && String(lp.id) === pid ? { ...lp, openingQty: nextOpening, qty: nextStock } : lp,
            );
            const serverEntry = normalizeAdjustmentEntry({
                id: d.logId,
                createdAt: d.createdAt,
                previousQty: d.previousQty,
                newQty: d.newQty,
                delta: d.delta,
                reason: d.reason || INVENTORY_ADJUSTMENT_REASON_OPENING_QTY,
                source: d.source || 'manual_opening_qty',
                adjustedBy: d.adjustedBy,
            });
            if (serverEntry) {
                setFetchedLogEntries((prev) => {
                    const list = Array.isArray(prev) ? prev : [];
                    if (list.some((e) => e.id === serverEntry.id)) return list;
                    return [serverEntry, ...list];
                });
            }
            setTimelineMeta({ storedOpeningQty: nextOpening, currentQtyOnHand: nextStock });
        } catch (err) {
            setAlignOpeningError(err.message || 'Could not align opening adoption.');
        } finally {
            setAlignOpeningSaving(false);
        }
    };

    useEffect(() => {
        if (!logProduct) {
            setFetchedLogEntries(null);
            setTimelineMeta(null);
            setLogFetchError('');
            setLogLoading(false);
            return;
        }
        if (isAllBranches) {
            setFetchedLogEntries(null);
            setTimelineMeta(null);
            setLogFetchError('');
            setLogLoading(false);
            return;
        }
        const ctrl = new AbortController();
        setLogLoading(true);
        setLogFetchError('');
        (async () => {
            try {
                const res = await getBranchProductInventoryAdjustments(String(selectedBranchId), String(logProduct.id), {
                    signal: ctrl.signal,
                    workshopId: workshopIdQuery,
                });
                if (!ctrl.signal.aborted) {
                    setFetchedLogEntries(extractAdjustmentEntries(res));
                    setTimelineMeta(extractTimelineMeta(res));
                }
            } catch (e) {
                if (e.name === 'AbortError') return;
                if (!ctrl.signal.aborted) {
                    setFetchedLogEntries([]);
                    setTimelineMeta(null);
                    setLogFetchError(e.message || 'Could not load adjustment history.');
                }
            } finally {
                if (!ctrl.signal.aborted) setLogLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [logProduct, isAllBranches, selectedBranchId, workshopIdQuery]);

    useEffect(() => {
        setAdjustmentLogs(loadAdjustmentLogsFromStorage(logStorageKey));
    }, [logStorageKey]);

    const loadInventory = useCallback(async () => {
        setIsLoading(true);
        setLoadError('');
        try {
            const isAll = !selectedBranchId || selectedBranchId === 'all';
            let products = [];

            if (isAll) {
                try {
                    const pRes = await getWorkshopStaffProducts({ allBranches: true });
                    products = flattenWorkshopStaffBranchProductsResponse(pRes);
                    if (products.length === 0) {
                        products = extractProducts(pRes);
                    }
                } catch {
                    products = [];
                }
                if (products.length === 0) {
                    try {
                        products = extractProducts(await getMyProducts());
                    } catch {
                        products = [];
                    }
                }
            } else {
                const bid = String(selectedBranchId);
                try {
                    const prodRes = await getWorkshopStaffBranchProducts(bid);
                    products = flattenWorkshopStaffBranchProductsResponse(prodRes);
                    if (products.length === 0) {
                        products = extractProducts(prodRes);
                    }
                } catch {
                    products = [];
                }
                if (products.length === 0) {
                    try {
                        products = extractProducts(await getBranchProducts(bid));
                    } catch {
                        products = [];
                    }
                }
                // Do not fall back to getMyProducts({ branchId }) here: some backends return a
                // workshop-wide union that ignores branchId, which wrongly fills empty branches (e.g. Riyadh with Dubai SKUs).
            }

            const mapped = products.map(mapApiRowToInventory).filter(Boolean);
            setProductRows(applyStatusesFromParent(mapped, selectedProductsRef.current));
        } catch (error) {
            setLoadError(error.message || 'Failed to load inventory.');
            setProductRows([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        setProductRows((prev) => (prev.length === 0 ? prev : applyStatusesFromParent(prev, selectedProducts)));
    }, [selectedProducts]);

    useEffect(() => {
        loadInventory();
    }, [loadInventory]);

    useEffect(() => {
        setSelectedProductIds([]);
    }, [selectedBranchId]);

    /**
     * Live-refresh when a workshop approval (or QR receive) just adjusted stock
     * for any branch. We always reload the open list — backend filters by the
     * sidebar's selected branch already, so cross-branch noise is fine.
     */
    useEffect(() => {
        const handler = () => {
            loadInventory();
        };
        window.addEventListener('workshop-inventory-updated', handler);
        return () => window.removeEventListener('workshop-inventory-updated', handler);
    }, [loadInventory]);

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestItem, setRequestItem] = useState(null);
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [requestQty, setRequestQty] = useState(0);

    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [adjustItem, setAdjustItem] = useState(null);
    const [newQty, setNewQty] = useState('');
    const [adjustReason, setAdjustReason] = useState('');
    const [adjustSubmitError, setAdjustSubmitError] = useState('');
    const [adjustSaving, setAdjustSaving] = useState(false);

    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const selectAllCheckboxRef = useRef(null);
    const [isBulkAdjustModalOpen, setIsBulkAdjustModalOpen] = useState(false);
    const [bulkAdjustAmount, setBulkAdjustAmount] = useState('');
    const [bulkAdjustReason, setBulkAdjustReason] = useState('');
    const [bulkAdjustSaving, setBulkAdjustSaving] = useState(false);
    const [bulkAdjustError, setBulkAdjustError] = useState('');
    const [bulkAdjustProgress, setBulkAdjustProgress] = useState({ done: 0, total: 0 });

    const [isCriticalModalOpen, setIsCriticalModalOpen] = useState(false);
    const [criticalItem, setCriticalItem] = useState(null);
    const [criticalInput, setCriticalInput] = useState('');
    const [criticalSubmitError, setCriticalSubmitError] = useState('');
    const [criticalSaving, setCriticalSaving] = useState(false);
    const [isInvValueProofOpen, setIsInvValueProofOpen] = useState(false);
    const [isLowStockProofOpen, setIsLowStockProofOpen] = useState(false);

    const inventoryValueBreakdown = useMemo(() => {
        const lines = productRows
            .map((p) => {
                const qty = Number(p.qty) || 0;
                const purchasePrice = Number(p.purchasePrice) || 0;
                const lineValue = qty * purchasePrice;
                return {
                    id: String(p.id),
                    name: p.name || '—',
                    sku: p.sku || '—',
                    departmentName: p.departmentName || '—',
                    qty,
                    purchasePrice,
                    lineValue,
                };
            })
            .sort((a, b) => b.lineValue - a.lineValue || a.name.localeCompare(b.name));
        const total = lines.reduce((sum, row) => sum + row.lineValue, 0);
        const skusWithStock = lines.filter((row) => row.qty > 0).length;
        const skusWithValue = lines.filter((row) => row.lineValue > 0).length;
        return { lines, total, skusWithStock, skusWithValue, skuCount: lines.length };
    }, [productRows]);

    const lowStockBreakdown = useMemo(() => {
        const lines = productRows
            .filter(isLowStockRow)
            .map((p) => {
                const qty = Number(p.qty) || 0;
                const critical = Number(p.critical_level) || 0;
                const gap = Math.max(0, critical - qty);
                const status = qty <= 0 ? 'Out of stock' : 'Low stock';
                return {
                    id: String(p.id),
                    name: p.name || '—',
                    sku: p.sku || '—',
                    departmentName: p.departmentName || '—',
                    categoryName: p.categoryName || '—',
                    qty,
                    critical,
                    gap,
                    status,
                };
            })
            .sort((a, b) => {
                if (a.qty <= 0 && b.qty > 0) return -1;
                if (b.qty <= 0 && a.qty > 0) return 1;
                return b.gap - a.gap || a.name.localeCompare(b.name);
            });
        const withCriticalSet = productRows.filter((p) => (Number(p.critical_level) || 0) > 0).length;
        const outOfStock = lines.filter((row) => row.qty <= 0).length;
        const lowOnly = lines.length - outOfStock;
        return {
            lines,
            count: lines.length,
            outOfStock,
            lowOnly,
            withCriticalSet,
            skuCount: productRows.length,
            withoutCritical: productRows.length - withCriticalSet,
        };
    }, [productRows]);

    const stats = useMemo(() => {
        const totalProducts = productRows.length;
        const inventoryValue = inventoryValueBreakdown.total;
        return [
            {
                label: 'Total products',
                value: totalProducts,
                sub: `SKUs in scope · ${selectedBranchName}`,
                icon: Package,
                color: '#3B82F6',
                clickable: false,
                proofKey: null,
            },
            {
                label: 'Low stock (SKUs)',
                value: lowStockBreakdown.count,
                sub: `At or below critical level · ${selectedBranchName}`,
                icon: AlertCircle,
                color: '#EF4444',
                clickable: true,
                proofKey: 'lowStock',
            },
            {
                label: 'Total inventory value',
                value: formatSar(Math.round(inventoryValue)),
                sub: `Current stock × purchase price · ${selectedBranchName}`,
                icon: Wallet,
                color: '#10B981',
                clickable: true,
                proofKey: 'inventoryValue',
            },
        ];
    }, [productRows, selectedBranchName, inventoryValueBreakdown.total, lowStockBreakdown.count]);

    const handleOpenRequest = (item) => {
        if (updateProductStatus) {
            updateProductStatus(item.id, 'Requested');
        }
        setProductRows((prev) =>
            prev.map((p) => (p.id === item.id ? { ...p, status: 'Requested' } : p)),
        );

        if (onTabChange) {
            onTabChange('purchases', { autoOpenModal: true, selectedItem: item });
        }
    };

    const handleRequestSubmit = () => {
        setIsRequestModalOpen(false);
        setRequestItem(null);
        setSelectedSupplier('');
        setRequestQty(0);
    };

    const closeAdjustModal = () => {
        setIsAdjustModalOpen(false);
        setAdjustItem(null);
        setAdjustSubmitError('');
        setAdjustSaving(false);
    };

    const resolveEffectiveOpeningForItem = useCallback(
        (item) => {
            if (!item) return item;
            const pid = String(item.id);
            const rowOpening =
                item.openingQty != null && item.openingQty !== ''
                    ? Number(item.openingQty)
                    : null;
            const timelineOpening = latestOpeningQtyFromLogEntries(adjustmentLogs[pid] || []);
            const effectiveOpening =
                rowOpening != null && !(rowOpening === 0 && timelineOpening != null && timelineOpening > 0)
                    ? rowOpening
                    : timelineOpening ?? rowOpening;
            if (effectiveOpening == null || !Number.isFinite(effectiveOpening)) return item;
            if (effectiveOpening === rowOpening) return item;
            return { ...item, openingQty: effectiveOpening };
        },
        [adjustmentLogs],
    );

    const handleOpenAdjust = (item) => {
        const resolved = resolveEffectiveOpeningForItem(item);
        setAdjustItem(resolved);
        setNewQty(resolved.qty != null ? String(resolved.qty) : '0');
        setAdjustReason('');
        setAdjustSubmitError('');
        setIsAdjustModalOpen(true);
    };

    const isAdjustOpeningQty = adjustReason === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY;

    const handleAdjustReasonChange = (value) => {
        setAdjustReason(value);
        if (!adjustItem) return;
        // Keep the quantity the user typed; only refresh adoption metadata for opening-qty mode.
        if (value === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY) {
            const resolved = resolveEffectiveOpeningForItem(adjustItem);
            if (resolved !== adjustItem) setAdjustItem(resolved);
        }
    };

    const closeCriticalModal = () => {
        setIsCriticalModalOpen(false);
        setCriticalItem(null);
        setCriticalInput('');
        setCriticalSubmitError('');
        setCriticalSaving(false);
    };

    const handleOpenCritical = (item) => {
        setCriticalItem(item);
        setCriticalInput(item.critical_level != null && item.critical_level !== '' ? String(item.critical_level) : '0');
        setCriticalSubmitError('');
        setIsCriticalModalOpen(true);
    };

    const handleCriticalSubmit = async () => {
        if (!criticalItem || isAllBranches) return;
        const parsed = Number.parseFloat(String(criticalInput).trim().replace(/,/g, ''));
        if (!Number.isFinite(parsed) || parsed < 0) {
            setCriticalSubmitError('Enter a number ≥ 0.');
            return;
        }
        const nextCrit = Math.round(parsed * 1000) / 1000;
        const prevCrit = Number(criticalItem.critical_level) || 0;
        if (nextCrit === prevCrit) {
            closeCriticalModal();
            return;
        }
        const pid = String(criticalItem.id);
        const bid = String(selectedBranchId);
        setCriticalSaving(true);
        setCriticalSubmitError('');
        try {
            const res = await patchBranchProduct(bid, pid, { criticalStockPoint: nextCrit }, { workshopId: workshopIdQuery });
            if (res && typeof res === 'object' && res.success === false) {
                throw new Error(res.message || 'Update failed.');
            }
            const payload = res?.data && typeof res.data === 'object' ? res.data : res || {};
            const serverCrit = pickNumber(
                payload.criticalStockPoint,
                payload.critical_stock_point,
                nextCrit,
            );
            setProductRows((prev) =>
                prev.map((p) => (p.id === pid ? { ...p, critical_level: serverCrit } : p)),
            );
            closeCriticalModal();
        } catch (err) {
            setCriticalSubmitError(err.message || 'Could not update critical level.');
        } finally {
            setCriticalSaving(false);
        }
    };

    const handleAdjustSubmit = async () => {
        if (!adjustItem || !adjustReason.trim()) return;
        const openingQtyAdjust = adjustReason.trim() === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY;
        const prevQty = openingQtyAdjust
            ? Number(adjustItem.openingQty ?? adjustItem.qty) || 0
            : Number(adjustItem.qty) || 0;
        const parsed = Number.parseFloat(String(newQty).trim().replace(/,/g, ''));
        if (!Number.isFinite(parsed) || parsed < 0) return;
        const qtyNum = Math.round(parsed);
        if (!openingQtyAdjust && qtyNum === prevQty) return;

        const pid = String(adjustItem.id);
        const reasonTrim = adjustReason.trim();

        if (!isAllBranches) {
            setAdjustSaving(true);
            setAdjustSubmitError('');
            try {
                const adjustBody = {
                    newQty: qtyNum,
                    reason: reasonTrim,
                };
                // Opening qty: server reads workshop_products.opening_qty (list row can be stale).
                if (!openingQtyAdjust) {
                    adjustBody.previousQty = prevQty;
                }
                const res = await postBranchProductInventoryAdjustment(
                    String(selectedBranchId),
                    pid,
                    adjustBody,
                    { workshopId: workshopIdQuery },
                );
                if (!res?.success) {
                    throw new Error(res?.message || 'Adjustment failed.');
                }
                const d = res.data || {};
                const serverEntry = {
                    id: String(d.logId || `${d.createdAt || new Date().toISOString()}-adj`),
                    at: d.createdAt || new Date().toISOString(),
                    previousQty: d.previousQty != null ? Number(d.previousQty) : prevQty,
                    newQty: d.newQty != null ? Number(d.newQty) : qtyNum,
                    delta: d.delta != null ? Number(d.delta) : qtyNum - prevQty,
                    reason: d.reason || reasonTrim,
                    adjustedBy: d.adjustedBy || null,
                    source: d.source || (openingQtyAdjust ? 'manual_opening_qty' : 'manual'),
                    affectsOpening:
                        d.adjustmentTarget === 'opening' ||
                        openingQtyAdjust ||
                        d.source === 'manual_opening_qty',
                };

                setAdjustmentLogs((prevMap) => {
                    const list = [...(prevMap[pid] || []), serverEntry];
                    const next = { ...prevMap, [pid]: list };
                    saveAdjustmentLogsToStorage(logStorageKey, next);
                    return next;
                });

                const nextOpening =
                    openingQtyAdjust || d.adjustmentTarget === 'opening'
                        ? d.openingQty != null
                            ? Number(d.openingQty)
                            : serverEntry.newQty
                        : null;
                const nextStock =
                    openingQtyAdjust || d.adjustmentTarget === 'opening'
                        ? d.qtyOnHand != null
                            ? Number(d.qtyOnHand)
                            : d.qty_on_hand != null
                              ? Number(d.qty_on_hand)
                              : nextOpening
                        : serverEntry.newQty;

                setProductRows((prev) =>
                    prev.map((p) => {
                        if (p.id !== adjustItem.id) return p;
                        if (openingQtyAdjust || d.adjustmentTarget === 'opening') {
                            return {
                                ...p,
                                openingQty: nextOpening,
                                qty: nextStock,
                                status: undefined,
                            };
                        }
                        return { ...p, qty: nextStock, status: undefined };
                    }),
                );

                if (logProduct && String(logProduct.id) === pid) {
                    setLogProduct((lp) => {
                        if (!lp || String(lp.id) !== pid) return lp;
                        if (openingQtyAdjust || d.adjustmentTarget === 'opening') {
                            return { ...lp, openingQty: nextOpening, qty: nextStock };
                        }
                        return { ...lp, qty: nextStock };
                    });
                    setFetchedLogEntries((prev) => {
                        const normalized = normalizeAdjustmentEntry({
                            ...serverEntry,
                            createdAt: serverEntry.at,
                        });
                        if (!normalized) return prev;
                        const list = Array.isArray(prev) ? prev : [];
                        if (list.some((e) => e.id === normalized.id)) return list;
                        return [normalized, ...list];
                    });
                }

                closeAdjustModal();
                if (!openingQtyAdjust) {
                    void loadInventory();
                }
            } catch (err) {
                setAdjustSubmitError(err.message || 'Adjustment failed. If stock changed elsewhere, refresh and try again.');
            } finally {
                setAdjustSaving(false);
            }
            return;
        }

        const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            at: new Date().toISOString(),
            previousQty: prevQty,
            newQty: qtyNum,
            delta: qtyNum - prevQty,
            reason: reasonTrim,
        };

        setAdjustmentLogs((prevMap) => {
            const list = [...(prevMap[pid] || []), entry];
            const next = { ...prevMap, [pid]: list };
            saveAdjustmentLogsToStorage(logStorageKey, next);
            return next;
        });

        setProductRows((prev) =>
            prev.map((p) =>
                p.id === adjustItem.id ? { ...p, qty: qtyNum, status: undefined } : p,
            ),
        );
        closeAdjustModal();
    };

    const filteredProducts = useMemo(() => {
        if (!normalizeInventorySearchValue(searchQuery)) return productRows;
        return productRows.filter((p) => matchesProductNameSearch(p, searchQuery));
    }, [productRows, searchQuery]);

    const selectedIdSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);

    const visibleProductIds = useMemo(
        () => filteredProducts.map((p) => String(p.id)).filter(Boolean),
        [filteredProducts],
    );

    const allVisibleSelected =
        visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedIdSet.has(id));

    const someVisibleSelected = visibleProductIds.some((id) => selectedIdSet.has(id));

    const selectedProductsForBulk = useMemo(
        () => productRows.filter((p) => selectedIdSet.has(String(p.id))),
        [productRows, selectedIdSet],
    );

    const isBulkOpeningQty =
        bulkAdjustReason.trim() === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY;

    const bulkAdjustPreview = useMemo(() => {
        const amt = bulkAdjustAmount;
        return selectedProductsForBulk.map((item) =>
            computeBulkAdjustmentRow(item, amt, isBulkOpeningQty),
        );
    }, [selectedProductsForBulk, bulkAdjustAmount, isBulkOpeningQty]);

    const bulkAdjustWillChangeCount = bulkAdjustPreview.filter((row) => !row.unchanged).length;

    useLayoutEffect(() => {
        const el = selectAllCheckboxRef.current;
        if (!el) return;
        el.indeterminate = someVisibleSelected && !allVisibleSelected;
    }, [someVisibleSelected, allVisibleSelected]);

    const toggleProductSelection = useCallback((productId) => {
        const sid = String(productId);
        setSelectedProductIds((prev) =>
            prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid],
        );
    }, []);

    const toggleSelectAllVisible = useCallback(() => {
        if (allVisibleSelected) {
            setSelectedProductIds((prev) => prev.filter((id) => !visibleProductIds.includes(id)));
            return;
        }
        setSelectedProductIds((prev) => {
            const next = new Set([...prev, ...visibleProductIds]);
            return [...next];
        });
    }, [allVisibleSelected, visibleProductIds]);

    const clearProductSelection = useCallback(() => {
        setSelectedProductIds([]);
    }, []);

    const openBulkAdjustModal = () => {
        setBulkAdjustAmount('');
        setBulkAdjustReason('');
        setBulkAdjustError('');
        setBulkAdjustProgress({ done: 0, total: 0 });
        setIsBulkAdjustModalOpen(true);
    };

    const closeBulkAdjustModal = () => {
        setIsBulkAdjustModalOpen(false);
        setBulkAdjustSaving(false);
        setBulkAdjustError('');
        setBulkAdjustProgress({ done: 0, total: 0 });
    };

    const handleBulkAdjustSubmit = async () => {
        if (selectedProductsForBulk.length === 0) return;
        if (!bulkAdjustReason.trim()) return;
        const parsedAmt = Number.parseFloat(String(bulkAdjustAmount).trim().replace(/,/g, ''));
        if (!Number.isFinite(parsedAmt) || parsedAmt < 0) {
            setBulkAdjustError('Enter a valid amount ≥ 0.');
            return;
        }
        if (bulkAdjustWillChangeCount === 0) {
            setBulkAdjustError('No selected products would change with this amount.');
            return;
        }
        if (isBulkOpeningQty && parsedAmt === 0) {
            setBulkAdjustError(
                'Bulk opening adoption cannot be set to 0 when products would change. That overwrites stored adoption with zero.',
            );
            return;
        }

        const reasonTrim = bulkAdjustReason.trim();
        const targets = bulkAdjustPreview.filter((row) => !row.unchanged);
        const total = targets.length;

        if (!isAllBranches) {
            setBulkAdjustSaving(true);
            setBulkAdjustError('');
            setBulkAdjustProgress({ done: 0, total });
            try {
                const res = await postBranchBulkInventoryAdjustment(
                    String(selectedBranchId),
                    {
                        reason: reasonTrim,
                        items: targets.map((row) => ({
                            productId: row.id,
                            newQty: row.newQty,
                            ...(row.isOpening ? {} : { previousQty: row.prevQty }),
                        })),
                    },
                    { workshopId: workshopIdQuery },
                );
                if (!res?.success) {
                    throw new Error(res?.message || 'Bulk adjustment failed.');
                }

                const updatedCount = Number(res.updated) || 0;
                const apiFailures = Array.isArray(res.failures) ? res.failures : [];
                const failedIds = new Set(apiFailures.map((f) => String(f.productId)));
                const openingQtyAdjust =
                    reasonTrim === INVENTORY_ADJUSTMENT_REASON_OPENING_QTY;

                const succeededRows = targets.filter((row) => !failedIds.has(String(row.id)));
                if (succeededRows.length > 0) {
                    setProductRows((prev) =>
                        prev.map((p) => {
                            const row = succeededRows.find((t) => String(t.id) === String(p.id));
                            if (!row) return p;
                            const next = {
                                ...p,
                                qty: row.newCurrent ?? row.newQty,
                                status: undefined,
                            };
                            if (openingQtyAdjust) {
                                next.openingQty = row.newOpening ?? row.newQty;
                            }
                            return next;
                        }),
                    );
                    const at = new Date().toISOString();
                    setAdjustmentLogs((prevMap) => {
                        const next = { ...prevMap };
                        for (const row of succeededRows) {
                            const entry = {
                                id: `bulk-${at}-${row.id}`,
                                at,
                                previousQty: row.prevQty,
                                newQty: row.newQty,
                                delta: row.newQty - row.prevQty,
                                reason: reasonTrim,
                                source: openingQtyAdjust ? 'manual_opening_qty' : 'manual',
                                affectsOpening: openingQtyAdjust,
                            };
                            next[row.id] = [...(next[row.id] || []), entry];
                        }
                        saveAdjustmentLogsToStorage(logStorageKey, next);
                        return next;
                    });
                    if (!openingQtyAdjust) {
                        void loadInventory();
                    }
                }

                setBulkAdjustProgress({ done: total, total });

                if (apiFailures.length === 0) {
                    clearProductSelection();
                    closeBulkAdjustModal();
                } else if (updatedCount > 0) {
                    const failLabels = apiFailures
                        .slice(0, 8)
                        .map((f) => {
                            const item = selectedProductsForBulk.find(
                                (p) => String(p.id) === String(f.productId),
                            );
                            return item?.name || f.productId;
                        })
                        .join(', ');
                    setBulkAdjustError(
                        `Updated ${updatedCount} of ${total}. Failed ${apiFailures.length}${failLabels ? `: ${failLabels}${apiFailures.length > 8 ? '…' : ''}` : ''}.`,
                    );
                } else {
                    setBulkAdjustError(apiFailures[0]?.message || 'Bulk adjustment failed.');
                }
            } catch (err) {
                setBulkAdjustError(err.message || 'Bulk adjustment failed.');
            } finally {
                setBulkAdjustSaving(false);
            }
            return;
        }

        setBulkAdjustSaving(true);
        setBulkAdjustError('');
        setAdjustmentLogs((prevMap) => {
            const next = { ...prevMap };
            for (const row of targets) {
                const entry = {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    at: new Date().toISOString(),
                    previousQty: row.prevQty,
                    newQty: row.newQty,
                    delta: row.newQty - row.prevQty,
                    reason: reasonTrim,
                    source: row.isOpening ? 'manual_opening_qty' : 'manual',
                    affectsOpening: Boolean(row.isOpening),
                };
                next[row.id] = [...(next[row.id] || []), entry];
            }
            saveAdjustmentLogsToStorage(logStorageKey, next);
            return next;
        });
        setProductRows((prev) =>
            prev.map((p) => {
                const row = targets.find((t) => t.id === String(p.id));
                if (!row) return p;
                if (row.isOpening) {
                    return {
                        ...p,
                        openingQty: row.newOpening,
                        qty: row.newCurrent,
                        status: undefined,
                    };
                }
                return { ...p, qty: row.newQty, status: undefined };
            }),
        );
        clearProductSelection();
        closeBulkAdjustModal();
        setBulkAdjustSaving(false);
    };

    const invSearchSuggestions = useMemo(() => {
        const q = normalizeInventorySearchValue(searchQuery);
        if (!q) return [];
        return productRows.filter((p) => matchesProductNameSearch(p, searchQuery)).slice(0, INV_SEARCH_SUGGEST_LIMIT);
    }, [productRows, searchQuery]);

    const applyInventorySearchSuggestion = useCallback((row) => {
        setSearchQuery(inventorySearchValueFromRow(row));
        setInvSuggestOpen(false);
        setInvSuggestIndex(-1);
    }, []);

    const onInvSearchKeyDown = useCallback(
        (e) => {
            if (e.key === 'ArrowDown') {
                if (!invSearchSuggestions.length) return;
                e.preventDefault();
                setInvSuggestOpen(true);
                setInvSuggestIndex((i) => {
                    if (i < 0) return 0;
                    return Math.min(i + 1, invSearchSuggestions.length - 1);
                });
                return;
            }
            if (e.key === 'ArrowUp') {
                if (!invSearchSuggestions.length) return;
                e.preventDefault();
                setInvSuggestOpen(true);
                setInvSuggestIndex((i) => (i <= 0 ? -1 : i - 1));
                return;
            }
            if (e.key === 'Enter') {
                if (invSuggestOpen && invSuggestIndex >= 0 && invSearchSuggestions[invSuggestIndex]) {
                    e.preventDefault();
                    applyInventorySearchSuggestion(invSearchSuggestions[invSuggestIndex]);
                }
                return;
            }
            if (e.key === 'Escape') {
                setInvSuggestOpen(false);
                setInvSuggestIndex(-1);
            }
        },
        [invSearchSuggestions, invSuggestOpen, invSuggestIndex, applyInventorySearchSuggestion],
    );

    useLayoutEffect(() => {
        if (!invSuggestOpen || invSuggestIndex < 0) return;
        const list = invSuggestDropdownRef.current;
        const item = list?.querySelector(`#workshop-inv-suggest-${invSuggestIndex}`);
        if (!list || !item) return;
        const padding = 6;
        const listRect = list.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        if (itemRect.bottom > listRect.bottom - padding) {
            list.scrollTop += itemRect.bottom - listRect.bottom + padding;
        } else if (itemRect.top < listRect.top + padding) {
            list.scrollTop -= listRect.top - itemRect.top + padding;
        }
    }, [invSuggestIndex, invSuggestOpen, invSearchSuggestions]);

    const clearInvSearchBlurTimer = useCallback(() => {
        if (invSearchBlurTimerRef.current != null) {
            clearTimeout(invSearchBlurTimerRef.current);
            invSearchBlurTimerRef.current = null;
        }
    }, []);

    useEffect(() => () => clearInvSearchBlurTimer(), [clearInvSearchBlurTimer]);

    const tableEmptyMessage = () => {
        if (isLoading) return 'Loading inventory…';
        if (loadError) return loadError;
        if (productRows.length === 0) return 'No products in this scope yet — adopt items under Dept & Products or Catalog.';
        return 'No products match your search.';
    };

    return (
        <div className="mc-catalog-container">
            <div className="mc-selection-header">
                <div className="mc-header-left">
                    <h3>Inventory Management</h3>
                    <p>
                        Track and manage <strong>product</strong> stock for <strong>{selectedBranchName}</strong>
                        {isAllBranches ? ' (workshop-wide product list)' : ''}.
                    </p>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                            type="button"
                            className="mc-btn-ghost"
                            style={{ padding: '8px 14px', fontSize: '0.8125rem', border: '1px solid var(--color-border)', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 8 }}
                            onClick={() => loadInventory()}
                            disabled={isLoading}
                        >
                            <RefreshCw size={16} style={{ opacity: isLoading ? 0.5 : 1, animation: isLoading ? 'ws-spin 0.8s linear infinite' : undefined }} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="mc-stats-grid"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '20px',
                    marginBottom: '24px',
                }}
            >
                {stats.map((stat, i) => {
                    const cardStyle = {
                        background: '#fff',
                        padding: '24px',
                        borderRadius: '24px',
                        border: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                        width: '100%',
                    };
                    const inner = (
                        <>
                        <div
                            style={{
                                width: '54px',
                                height: '54px',
                                borderRadius: '14px',
                                background: `${stat.color}15`,
                                color: stat.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <stat.icon size={26} />
                        </div>
                        <div style={{ minWidth: 0, textAlign: 'left' }}>
                            <p
                                style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    margin: '0 0 4px',
                                }}
                            >
                                {stat.label}
                            </p>
                            <h4
                                style={{
                                    fontSize: '1.5rem',
                                    fontWeight: 800,
                                    color: 'var(--color-text-dark)',
                                    margin: 0,
                                }}
                            >
                                {stat.value}
                            </h4>
                            {stat.sub ? (
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>{stat.sub}</p>
                            ) : null}
                            {stat.clickable ? (
                                <p className="ws-kpi-proof-hint" style={{ marginTop: 8 }}>
                                    Click for line-by-line breakdown
                                </p>
                            ) : null}
                        </div>
                        </>
                    );
                    if (stat.clickable) {
                        const proofClass =
                            stat.proofKey === 'lowStock'
                                ? 'mc-stat-card ws-inv-stat-card--clickable ws-inv-stat-card--clickable-danger'
                                : 'mc-stat-card ws-inv-stat-card--clickable';
                        return (
                            <button
                                key={i}
                                type="button"
                                className={proofClass}
                                style={cardStyle}
                                onClick={() => {
                                    if (stat.proofKey === 'lowStock') setIsLowStockProofOpen(true);
                                    else if (stat.proofKey === 'inventoryValue') setIsInvValueProofOpen(true);
                                }}
                                aria-label={`${stat.label}: view calculation breakdown`}
                            >
                                {inner}
                            </button>
                        );
                    }
                    return (
                        <div key={i} className="mc-stat-card" style={cardStyle}>
                            {inner}
                        </div>
                    );
                })}
            </div>

            <div className="mc-selection-layout">
                <div className="mc-selection-main" style={{ gridColumn: 'span 2' }}>
                    <div
                        className="mc-inventory-card"
                        style={{
                            background: '#fff',
                            borderRadius: '24px',
                            border: '1px solid var(--color-border)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                padding: '24px',
                                borderBottom: '1px solid var(--color-border-light)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                            }}
                        >
                            <div className="mc-header-filter" style={{ width: '100%', maxWidth: 'none' }}>
                                <div
                                    className="mc-filter-select-wrapper mc-inv-search-combo"
                                    style={{ position: 'relative', width: '100%', minWidth: 'min(900px, 100%)', maxWidth: '100%' }}
                                >
                                    <Search className="mc-filter-icon" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search by product name or SKU..."
                                        className="mc-filter-select"
                                        style={{
                                            paddingLeft: '40px',
                                            paddingRight: searchQuery ? '70px' : '14px',
                                            width: '100%',
                                            minHeight: 46,
                                            fontSize: '0.95rem',
                                            backgroundImage: 'none',
                                            cursor: 'text',
                                        }}
                                        value={searchQuery}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setSearchQuery(v);
                                            setInvSuggestIndex(-1);
                                            if (!normalizeInventorySearchValue(v)) {
                                                setInvSuggestOpen(false);
                                            } else {
                                                setInvSuggestOpen(true);
                                            }
                                        }}
                                        onKeyDown={onInvSearchKeyDown}
                                        onFocus={() => {
                                            clearInvSearchBlurTimer();
                                            if (normalizeInventorySearchValue(searchQuery)) {
                                                setInvSuggestOpen(true);
                                            }
                                        }}
                                        onBlur={() => {
                                            clearInvSearchBlurTimer();
                                            invSearchBlurTimerRef.current = setTimeout(() => {
                                                invSearchBlurTimerRef.current = null;
                                                setInvSuggestOpen(false);
                                                setInvSuggestIndex(-1);
                                            }, 200);
                                        }}
                                        disabled={isLoading}
                                        role="combobox"
                                        aria-autocomplete="list"
                                        aria-expanded={invSuggestOpen}
                                        aria-controls="workshop-inv-search-suggest-list"
                                        aria-activedescendant={
                                            invSuggestOpen && invSuggestIndex >= 0
                                                ? `workshop-inv-suggest-${invSuggestIndex}`
                                                : undefined
                                        }
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setInvSuggestOpen(false);
                                                setInvSuggestIndex(-1);
                                            }}
                                            aria-label="Clear search"
                                            title="Clear search"
                                            style={{
                                                position: 'absolute',
                                                right: 8,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                border: 'none',
                                                background: '#F3F4F6',
                                                color: '#374151',
                                                borderRadius: 8,
                                                width: 26,
                                                height: 26,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                    {invSuggestOpen && normalizeInventorySearchValue(searchQuery) && (
                                        <div
                                            ref={invSuggestDropdownRef}
                                            id="workshop-inv-search-suggest-list"
                                            className="mc-inv-search-dropdown"
                                            role="listbox"
                                            aria-label="Matching products"
                                            onMouseDown={(ev) => ev.preventDefault()}
                                        >
                                            {invSearchSuggestions.length === 0 ? (
                                                <div className="mc-inv-search-dropdown-empty">No matching products</div>
                                            ) : (
                                                invSearchSuggestions.map((row, idx) => (
                                                    <button
                                                        key={row._rowKey || row.id || idx}
                                                        type="button"
                                                        id={`workshop-inv-suggest-${idx}`}
                                                        role="option"
                                                        aria-selected={invSuggestIndex === idx}
                                                        className={`mc-inv-search-suggest${invSuggestIndex === idx ? ' is-active' : ''}`}
                                                        onMouseEnter={() => setInvSuggestIndex(idx)}
                                                        onClick={() => applyInventorySearchSuggestion(row)}
                                                    >
                                                        <span className="mc-inv-search-suggest-name">{row.name}</span>
                                                        {row.sku ? (
                                                            <span className="mc-inv-search-suggest-sku">{row.sku}</span>
                                                        ) : null}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                Showing <strong>{filteredProducts.length}</strong> of{' '}
                                <strong>{productRows.length}</strong> products
                                {searchQuery ? ` for "${searchQuery}"` : ''}.
                            </p>
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginTop: 4,
                                }}
                            >
                                <button
                                    type="button"
                                    className="mc-btn-ghost"
                                    style={{ padding: '8px 14px', fontSize: '0.8125rem', border: '1px solid var(--color-border)', borderRadius: 10 }}
                                    onClick={toggleSelectAllVisible}
                                    disabled={isLoading || filteredProducts.length === 0}
                                >
                                    {allVisibleSelected && visibleProductIds.length > 0
                                        ? 'Deselect all on page'
                                        : 'Select all on page'}
                                </button>
                                {selectedProductIds.length > 0 ? (
                                    <>
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-dark)' }}>
                                            {selectedProductIds.length} selected
                                        </span>
                                        <button
                                            type="button"
                                            className="mc-btn-primary"
                                            style={{ padding: '8px 14px', fontSize: '0.8125rem' }}
                                            onClick={openBulkAdjustModal}
                                        >
                                            Bulk adjust
                                        </button>
                                        <button
                                            type="button"
                                            className="mc-btn-ghost"
                                            style={{ padding: '8px 14px', fontSize: '0.8125rem', border: '1px solid var(--color-border)', borderRadius: 10 }}
                                            onClick={clearProductSelection}
                                        >
                                            Clear selection
                                        </button>
                                    </>
                                ) : null}
                                {isAllBranches && selectedProductIds.length > 0 ? (
                                    <span style={{ fontSize: '0.75rem', color: '#B45309' }}>
                                        Select a single branch to save bulk adjustments on the server.
                                    </span>
                                ) : null}
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                Use checkboxes to select products for <strong>bulk adjust</strong>, or <strong>Select all on page</strong>.
                                Click a <strong>row</strong> for adjustment history. Use <strong>↑</strong> <strong>↓</strong> and{' '}
                                <strong>Enter</strong> to pick a search suggestion.
                                {isAllBranches
                                    ? ' With all branches selected, history is only what this browser saved (no server log).'
                                    : ' History is loaded from the server for this branch.'}
                            </p>
                        </div>

                        <div className="mc-table-container" style={{ overflowX: 'auto' }}>
                            <table className="mc-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid var(--color-border-light)' }}>
                                        <th
                                            style={{
                                                padding: '16px 12px',
                                                width: 48,
                                                textAlign: 'center',
                                            }}
                                        >
                                            <input
                                                ref={selectAllCheckboxRef}
                                                type="checkbox"
                                                checked={allVisibleSelected && visibleProductIds.length > 0}
                                                onChange={toggleSelectAllVisible}
                                                disabled={isLoading || filteredProducts.length === 0}
                                                aria-label="Select all products on this page"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'left',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Name
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'left',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            SKU
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'left',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Department
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'left',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Category
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                            title="workshop_products.opening_qty — adoption baseline; Opening qty manual adjust also sets current stock"
                                        >
                                            Opening (adoption)
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                            title="branch_inventory.qty_on_hand when present; otherwise same as adoption opening until first stock movement"
                                        >
                                            Current stock
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                            title="Low-stock threshold for this branch (branch_products.criticalStockPoint). When current stock ≤ this value (and &gt; 0), the row is treated as low stock."
                                        >
                                            Critical
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Price
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Status
                                        </th>
                                        <th
                                            style={{
                                                padding: '16px 24px',
                                                textAlign: 'right',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                color: 'var(--color-text-muted)',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <ShimmerTableBodyRows rows={8} columns={11} />
                                    ) : filteredProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                <div style={{ marginBottom: '16px', opacity: 0.3 }}>
                                                    <Package size={48} style={{ margin: '0 auto' }} />
                                                </div>
                                                <p style={{ fontWeight: 600 }}>{tableEmptyMessage()}</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredProducts.map((item, idx) => {
                                            const st = stockStatus(item);
                                            const low = isLowStockRow(item);
                                            const qtyBg =
                                                item.qty <= 0
                                                    ? '#FEF2F2'
                                                    : low
                                                      ? '#FFFBEB'
                                                      : '#ECFDF5';
                                            const qtyColor =
                                                item.qty <= 0 ? '#EF4444' : low ? '#D97706' : '#047857';

                                            const statusBg =
                                                st.tone === 'blue'
                                                    ? '#EFF6FF'
                                                    : st.tone === 'green'
                                                      ? '#ECFDF5'
                                                      : st.tone === 'amber'
                                                        ? '#FFFBEB'
                                                        : '#FEF2F2';
                                            const statusColor =
                                                st.tone === 'blue'
                                                    ? '#3B82F6'
                                                    : st.tone === 'green'
                                                      ? '#047857'
                                                      : st.tone === 'amber'
                                                        ? '#D97706'
                                                        : '#EF4444';

                                            return (
                                                <tr
                                                    key={`inv:${idx}:${item._rowKey || item.id || ''}:${searchQuery}`}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => setLogProduct(item)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setLogProduct(item);
                                                        }
                                                    }}
                                                    style={{
                                                        borderBottom: '1px solid var(--color-border-light)',
                                                        cursor: 'pointer',
                                                    }}
                                                    className="ws-inv-row-clickable"
                                                >
                                                    <td
                                                        style={{ padding: '16px 12px', textAlign: 'center' }}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIdSet.has(String(item.id))}
                                                            onChange={() => toggleProductSelection(item.id)}
                                                            aria-label={`Select ${item.name || 'product'}`}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            <span
                                                                style={{
                                                                    textAlign: 'left',
                                                                    fontWeight: 700,
                                                                    color: 'var(--color-primary)',
                                                                    fontSize: '0.9375rem',
                                                                }}
                                                            >
                                                                {item.name}
                                                            </span>
                                                            {item.brand && (
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.brand}</span>
                                                            )}
                                                            {(adjustmentLogs[item.id]?.length || 0) > 0 && (
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                    <History size={12} aria-hidden />
                                                                    {adjustmentLogs[item.id].length} manual adjustment{adjustmentLogs[item.id].length !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                                                        {item.sku || '—'}
                                                    </td>
                                                    <td style={{ padding: '16px 24px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{item.departmentName}</td>
                                                    <td style={{ padding: '16px 24px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{item.categoryName}</td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                        <span
                                                            style={{
                                                                display: 'inline-block',
                                                                padding: '4px 10px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.875rem',
                                                                fontWeight: 700,
                                                                color: 'var(--color-text-dark)',
                                                                background: '#F3F4F6',
                                                            }}
                                                        >
                                                            {item.openingQty != null && item.openingQty !== ''
                                                                ? item.openingQty
                                                                : '—'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                        <span
                                                            style={{
                                                                padding: '4px 10px',
                                                                background: qtyBg,
                                                                color: qtyColor,
                                                                borderRadius: '6px',
                                                                fontSize: '0.8125rem',
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {item.qty}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                        {Number(item.critical_level) > 0 ? item.critical_level : '—'}
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-dark)' }}>
                                                        SAR {item.basePrice?.toLocaleString() || '0'}
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                        <span
                                                            style={{
                                                                padding: '6px 12px',
                                                                borderRadius: '20px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                background: statusBg,
                                                                color: statusColor,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                            }}
                                                        >
                                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                                                            {st.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                            <button
                                                                type="button"
                                                                className="mc-btn-primary"
                                                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenRequest(item);
                                                                }}
                                                            >
                                                                Request from Supplier
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="mc-btn-ghost"
                                                                style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid var(--color-border)' }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenAdjust(item);
                                                                }}
                                                            >
                                                                Manual Adjust
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="mc-btn-ghost"
                                                                style={{ padding: '6px 12px', fontSize: '0.75rem', border: '1px solid var(--color-border)' }}
                                                                title={
                                                                    isAllBranches
                                                                        ? 'Select a single branch to edit critical stock level.'
                                                                        : 'Set low-stock threshold for this branch'
                                                                }
                                                                disabled={isAllBranches}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenCritical(item);
                                                                }}
                                                            >
                                                                Critical level
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {isRequestModalOpen && (
                    <Modal onClose={() => setIsRequestModalOpen(false)} title="Request Stock from Supplier" width="500px">
                        <div className="mc-modal-form" style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '20px', padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Product Details</p>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{requestItem?.name}</h4>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>SKU: {requestItem?.sku || 'N/A'}</p>
                            </div>

                            <div className="mc-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>CHOOSE SUPPLIER</label>
                                <select className="mc-filter-select" style={{ width: '100%', height: '45px' }} value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
                                    <option value="">Select a supplier...</option>
                                    {MOCK_SUPPLIERS_CATALOG.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mc-form-group" style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>QUANTITY TO REQUEST</label>
                                <input
                                    type="number"
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    placeholder="Enter quantity..."
                                    value={requestQty}
                                    onChange={(e) => setRequestQty(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="mc-btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={() => setIsRequestModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="mc-btn-primary" style={{ flex: 2, padding: '12px' }} onClick={handleRequestSubmit} disabled={!selectedSupplier || requestQty <= 0}>
                                    Submit Request
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {logProduct && (
                    <Modal onClose={() => setLogProduct(null)} title="Inventory stock timeline" width="780px">
                        <div style={{ padding: '0 24px 24px' }}>
                            <div style={{ marginBottom: 20, padding: '14px 16px', background: '#F9FAFB', borderRadius: 12, border: '1px solid var(--color-border-light)' }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 6px' }}>Product</p>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{logProduct.name}</h4>
                                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    SKU: {logProduct.sku || '—'} · Opening (adoption):{' '}
                                    <strong
                                        style={{
                                            padding: '2px 8px',
                                            borderRadius: 6,
                                            background: '#FEF3C7',
                                            color: '#92400E',
                                        }}
                                    >
                                        {logOpeningContext?.displayOpening != null &&
                                        Number.isFinite(logOpeningContext.displayOpening)
                                            ? logOpeningContext.displayOpening
                                            : '—'}
                                    </strong>
                                    {logOpeningContext?.storedDrift ? (
                                        <span style={{ display: 'block', marginTop: 8, fontSize: '0.75rem', color: '#B45309' }}>
                                            Stored adoption on this branch is <strong>0</strong>, but your timeline&apos;s last
                                            opening-qty entry is <strong>{logOpeningContext.timelineOpening}</strong>. That
                                            usually means a later bulk/manual change wrote 0 to adoption, or only current stock was
                                            updated (not opening). The inventory table uses the stored value (0), not the history
                                            alone.
                                        </span>
                                    ) : null}
                                    {' '}
                                    · Current stock:{' '}
                                    <strong>{productRows.find((p) => String(p.id) === String(logProduct.id))?.qty ?? logProduct.qty}</strong>
                                    {isAllBranches ? ' · All branches: offline log only' : ` · ${selectedBranchName}`}
                                </p>
                                {logOpeningContext?.storedDrift && !isAllBranches ? (
                                    <div style={{ marginTop: 12 }}>
                                        <button
                                            type="button"
                                            className="mc-btn-primary"
                                            style={{ padding: '10px 16px', fontSize: '0.8125rem' }}
                                            disabled={alignOpeningSaving || logLoading}
                                            onClick={alignOpeningAdoptionFromTimeline}
                                        >
                                            {alignOpeningSaving
                                                ? 'Saving…'
                                                : `Set opening adoption to ${logOpeningContext.timelineOpening}`}
                                        </button>
                                        {alignOpeningError ? (
                                            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#B91C1C' }}>{alignOpeningError}</p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                            {logFetchError && (
                                <p style={{ margin: '0 0 12px', padding: '10px 12px', background: '#FEF3C7', borderRadius: 8, color: '#92400E', fontSize: '0.8125rem' }}>
                                    {logFetchError} Showing any entries cached in this browser.
                                </p>
                            )}
                            {(() => {
                                const localList = adjustmentLogs[logProduct.id] || [];
                                let merged;
                                if (isAllBranches) {
                                    merged = [...localList].sort((a, b) => String(b.at).localeCompare(String(a.at)));
                                } else if (logLoading) {
                                    return (
                                        <p style={{ margin: 0, padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                            Loading history…
                                        </p>
                                    );
                                } else {
                                    merged = mergeLogEntries(localList, fetchedLogEntries || []);
                                }

                                if (!merged.length) {
                                    return (
                                        <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                                            No timeline entries yet for this branch/product.
                                        </p>
                                    );
                                }
                                const showByCol = merged.some((e) => e.adjustedBy?.name || e.adjustedBy?.id);
                                const showRefCol = merged.some(
                                    (e) => e.reference?.id || (e.source && e.source !== 'manual'),
                                );
                                return (
                                    <div style={{ overflowX: 'auto', maxHeight: 'min(420px, 55vh)', overflowY: 'auto', border: '1px solid var(--color-border-light)', borderRadius: 12 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                                <tr style={{ background: '#F9FAFB', position: 'sticky', top: 0 }}>
                                                    <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>When</th>
                                                    <th style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>From</th>
                                                    <th style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>To</th>
                                                    <th style={{ textAlign: 'right', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>Δ</th>
                                                    <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>Reason</th>
                                                    {showRefCol ? (
                                                        <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>Source / Ref</th>
                                                    ) : null}
                                                    {showByCol ? (
                                                        <th style={{ textAlign: 'left', padding: '12px 14px', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', fontSize: '0.7rem' }}>By</th>
                                                    ) : null}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {merged.map((e) => {
                                                    const openingRow = isOpeningQtyAdjustmentEntry(e);
                                                    return (
                                                    <tr
                                                        key={e.id}
                                                        style={{
                                                            borderBottom: '1px solid var(--color-border-light)',
                                                            background: openingRow ? '#FEF9C3' : undefined,
                                                        }}
                                                    >
                                                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: openingRow ? '#92400E' : 'var(--color-text-muted)' }}>
                                                            {new Date(e.at).toLocaleString()}
                                                            {openingRow ? (
                                                                <span
                                                                    style={{
                                                                        display: 'block',
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: 800,
                                                                        textTransform: 'uppercase',
                                                                        marginTop: 4,
                                                                    }}
                                                                >
                                                                    Opening (adoption)
                                                                </span>
                                                            ) : null}
                                                        </td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{e.previousQty == null ? '—' : e.previousQty}</td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{e.newQty == null ? '—' : e.newQty}</td>
                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: e.delta >= 0 ? '#047857' : '#B91C1C' }}>
                                                            {e.delta > 0 ? `+${e.delta}` : e.delta}
                                                        </td>
                                                        <td style={{ padding: '12px 14px' }}>{e.reason}</td>
                                                        {showRefCol ? (
                                                            <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>
                                                                <span>{humanizeInventoryLogSource(e.source)}</span>
                                                                {e.reference?.id ? (
                                                                    <span>
                                                                        {' '}
                                                                        · {humanizeInventoryLogReferenceType(e.reference.type)}{' '}
                                                                        {e.reference.invoiceNumber ? (
                                                                            <strong>{e.reference.invoiceNumber}</strong>
                                                                        ) : (
                                                                            <>#{e.reference.id}</>
                                                                        )}
                                                                    </span>
                                                                ) : null}
                                                            </td>
                                                        ) : null}
                                                        {showByCol ? (
                                                            <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>
                                                                {e.adjustedBy?.name || e.adjustedBy?.id || '—'}
                                                            </td>
                                                        ) : null}
                                                    </tr>
                                                );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isAdjustModalOpen && (
                    <Modal onClose={closeAdjustModal} title="Manual Inventory Adjustment" width="500px">
                        <div className="mc-modal-form" style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '20px', padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Product Details</p>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{adjustItem?.name}</h4>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    Current stock: <strong>{adjustItem?.qty ?? 0}</strong>
                                    {adjustItem?.openingQty != null ? (
                                        <>
                                            {' '}
                                            · Opening (adoption):{' '}
                                            <strong
                                                style={{
                                                    padding: '2px 8px',
                                                    borderRadius: 6,
                                                    background: isAdjustOpeningQty ? '#FEF3C7' : 'transparent',
                                                    color: isAdjustOpeningQty ? '#92400E' : 'inherit',
                                                }}
                                            >
                                                {adjustItem.openingQty}
                                            </strong>
                                        </>
                                    ) : null}
                                </p>
                            </div>

                            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                                {isAdjustOpeningQty ? (
                                    <>
                                        Sets <strong>Opening (adoption)</strong> and <strong>Current stock</strong> to the same
                                        value (initial / reset). Enter the new total (≥ 0).
                                    </>
                                ) : (
                                    <>
                                        Sets <strong>current stock</strong> (effective on-hand per branch; not adoption opening). Enter a new total — higher to increase, lower to decrease. Must be ≥ 0.
                                    </>
                                )}
                                {isAllBranches
                                    ? ' Select a single branch to save on the server.'
                                    : isAdjustOpeningQty
                                      ? ' Uses the stored opening adoption on the server (the list can show 0 while the real value is higher).'
                                      : ' The server checks previousQty matches current stock — refresh if it changed elsewhere.'}
                            </p>

                            <div className="mc-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>
                                    {isAdjustOpeningQty ? 'NEW OPENING QTY (ADOPTION)' : 'NEW QUANTITY (CURRENT STOCK)'}
                                </label>
                                <input
                                    type="number"
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    placeholder={isAdjustOpeningQty ? 'Enter new opening qty…' : 'Enter new stock level…'}
                                    min={0}
                                    step={1}
                                    value={newQty}
                                    onChange={(e) => setNewQty(e.target.value)}
                                    disabled={adjustSaving}
                                />
                            </div>

                            <div className="mc-form-group" style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>REASON FOR ADJUSTMENT</label>
                                <select
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    value={adjustReason}
                                    onChange={(e) => handleAdjustReasonChange(e.target.value)}
                                    disabled={adjustSaving}
                                >
                                    <option value="">Select a reason...</option>
                                    {INVENTORY_ADJUST_REASON_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {adjustSubmitError && (
                                <p style={{ margin: '0 0 16px', padding: '12px', background: '#FEE2E2', borderRadius: 8, color: '#991B1B', fontSize: '0.8125rem' }}>
                                    {adjustSubmitError}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="mc-btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={closeAdjustModal} disabled={adjustSaving}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="mc-btn-primary"
                                    style={{ flex: 2, padding: '12px', background: '#4B5563', borderColor: '#4B5563' }}
                                    onClick={handleAdjustSubmit}
                                    disabled={(() => {
                                        if (adjustSaving || !adjustItem || !adjustReason.trim()) return true;
                                        const parsed = Number.parseFloat(String(newQty).trim().replace(/,/g, ''));
                                        if (!Number.isFinite(parsed) || parsed < 0) return true;
                                        const baseline = isAdjustOpeningQty
                                            ? Number(adjustItem.openingQty ?? adjustItem.qty) || 0
                                            : Number(adjustItem.qty) || 0;
                                        return Math.round(parsed) === baseline;
                                    })()}
                                >
                                    {adjustSaving ? 'Saving…' : 'Apply Adjustment'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isBulkAdjustModalOpen && (
                    <Modal
                        onClose={closeBulkAdjustModal}
                        title={`Bulk adjust — ${selectedProductsForBulk.length} product${selectedProductsForBulk.length !== 1 ? 's' : ''}`}
                        width="560px"
                    >
                        <div className="mc-modal-form" style={{ padding: '24px' }}>
                            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                                {isBulkOpeningQty ? (
                                    <>
                                        <strong>Opening qty</strong> sets <strong>Opening (adoption)</strong> and{' '}
                                        <strong>current stock</strong> to the value you enter.
                                    </>
                                ) : (
                                    <>
                                        Any other reason sets <strong>current stock only</strong> to the exact quantity you
                                        enter (not added on top). Opening (adoption) is unchanged.
                                    </>
                                )}
                                {isAllBranches
                                    ? ' All branches: changes are saved in this browser only until you pick a branch.'
                                    : ` Saved on the server for ${selectedBranchName}.`}
                            </p>

                            <div className="mc-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>
                                    REASON FOR ADJUSTMENT
                                </label>
                                <select
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    value={bulkAdjustReason}
                                    onChange={(e) => setBulkAdjustReason(e.target.value)}
                                    disabled={bulkAdjustSaving}
                                >
                                    <option value="">Select a reason...</option>
                                    {INVENTORY_ADJUST_REASON_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mc-form-group" style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>
                                    {isBulkOpeningQty
                                        ? 'NEW OPENING QTY (ADOPTION + CURRENT STOCK)'
                                        : 'NEW QUANTITY (CURRENT STOCK ONLY)'}
                                </label>
                                <input
                                    type="number"
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    min={0}
                                    step={1}
                                    placeholder="e.g. 90"
                                    value={bulkAdjustAmount}
                                    onChange={(e) => setBulkAdjustAmount(e.target.value)}
                                    disabled={bulkAdjustSaving || !bulkAdjustReason.trim()}
                                />
                            </div>

                            {bulkAdjustPreview.length > 0 && (
                                <div
                                    style={{
                                        marginBottom: 16,
                                        maxHeight: 200,
                                        overflowY: 'auto',
                                        border: '1px solid var(--color-border-light)',
                                        borderRadius: 12,
                                        background: '#F9FAFB',
                                    }}
                                >
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Product</th>
                                                {isBulkOpeningQty ? (
                                                    <>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Opening</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>New opening</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Current</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>New stock</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Current</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>New</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bulkAdjustPreview.slice(0, 12).map((row) => (
                                                <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                                                    <td style={{ padding: '8px 12px' }}>
                                                        <strong>{row.name}</strong>
                                                        {row.sku !== '—' ? (
                                                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{row.sku}</span>
                                                        ) : null}
                                                    </td>
                                                    {isBulkOpeningQty ? (
                                                        <>
                                                            <td
                                                                style={{
                                                                    padding: '8px 12px',
                                                                    textAlign: 'center',
                                                                    color: '#92400E',
                                                                    background: '#FFFBEB',
                                                                    fontWeight: 600,
                                                                }}
                                                            >
                                                                {row.prevOpening}
                                                            </td>
                                                            <td
                                                                style={{
                                                                    padding: '8px 12px',
                                                                    textAlign: 'center',
                                                                    fontWeight: 700,
                                                                    color: row.unchanged ? 'var(--color-text-muted)' : '#92400E',
                                                                    background: row.unchanged ? undefined : '#FEF3C7',
                                                                }}
                                                            >
                                                                {row.newOpening}
                                                            </td>
                                                            <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                                                {row.prevCurrent}
                                                            </td>
                                                            <td
                                                                style={{
                                                                    padding: '8px 12px',
                                                                    textAlign: 'center',
                                                                    fontWeight: 700,
                                                                    color: row.unchanged ? 'var(--color-text-muted)' : '#047857',
                                                                }}
                                                            >
                                                                {row.newCurrent}
                                                                {row.unchanged ? ' (skip)' : ''}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{row.prevQty}</td>
                                                            <td
                                                                style={{
                                                                    padding: '8px 12px',
                                                                    textAlign: 'center',
                                                                    fontWeight: 700,
                                                                    color: row.unchanged ? 'var(--color-text-muted)' : '#047857',
                                                                }}
                                                            >
                                                                {row.newQty}
                                                                {row.unchanged ? ' (skip)' : ''}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {bulkAdjustPreview.length > 12 ? (
                                        <p style={{ margin: 0, padding: '8px 12px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            + {bulkAdjustPreview.length - 12} more…
                                        </p>
                                    ) : null}
                                </div>
                            )}

                            <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                <strong>{bulkAdjustWillChangeCount}</strong> of {bulkAdjustPreview.length} will be updated.
                                {bulkAdjustSaving && bulkAdjustProgress.total > 0
                                    ? bulkAdjustProgress.done >= bulkAdjustProgress.total
                                        ? ' Done.'
                                        : ` Applying to ${bulkAdjustProgress.total} products on the server (one request)…`
                                    : ''}
                            </p>

                            {bulkAdjustError && (
                                <p style={{ margin: '0 0 16px', padding: '12px', background: '#FEE2E2', borderRadius: 8, color: '#991B1B', fontSize: '0.8125rem' }}>
                                    {bulkAdjustError}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="mc-btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={closeBulkAdjustModal} disabled={bulkAdjustSaving}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="mc-btn-primary"
                                    style={{ flex: 2, padding: '12px' }}
                                    onClick={handleBulkAdjustSubmit}
                                    disabled={
                                        bulkAdjustSaving ||
                                        !bulkAdjustReason.trim() ||
                                        bulkAdjustWillChangeCount === 0 ||
                                        !Number.isFinite(Number.parseFloat(String(bulkAdjustAmount).trim().replace(/,/g, '')))
                                    }
                                >
                                    {bulkAdjustSaving ? 'Applying…' : `Apply to ${bulkAdjustWillChangeCount} product${bulkAdjustWillChangeCount !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isCriticalModalOpen && (
                    <Modal onClose={closeCriticalModal} title="Critical stock level" width="500px">
                        <div className="mc-modal-form" style={{ padding: '24px' }}>
                            <div style={{ marginBottom: '20px', padding: '16px', background: '#F9FAFB', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Product</p>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{criticalItem?.name}</h4>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    Current stock: <strong>{criticalItem?.qty ?? 0}</strong>
                                    {criticalItem?.openingQty != null ? (
                                        <> · Opening (adoption): <strong>{criticalItem.openingQty}</strong></>
                                    ) : null}
                                </p>
                            </div>

                            {isAllBranches ? (
                                <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#92400E', background: '#FFFBEB', padding: 12, borderRadius: 8 }}>
                                    Select a <strong>single branch</strong> in the workshop header to update critical levels on the server.
                                </p>
                            ) : (
                                <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                                    When <strong>current stock</strong> is at or below this number (and the value is greater than 0), the product is flagged as <strong>low stock</strong>. Use <strong>0</strong> to turn off the threshold for this branch.
                                </p>
                            )}

                            <div className="mc-form-group" style={{ marginBottom: '24px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px', display: 'block' }}>
                                    CRITICAL STOCK POINT (THIS BRANCH)
                                </label>
                                <input
                                    type="number"
                                    className="mc-filter-select"
                                    style={{ width: '100%', height: '45px' }}
                                    min={0}
                                    step="any"
                                    placeholder="0"
                                    value={criticalInput}
                                    onChange={(e) => setCriticalInput(e.target.value)}
                                    disabled={criticalSaving || isAllBranches}
                                />
                            </div>

                            {criticalSubmitError && (
                                <p style={{ margin: '0 0 16px', padding: '12px', background: '#FEE2E2', borderRadius: 8, color: '#991B1B', fontSize: '0.8125rem' }}>
                                    {criticalSubmitError}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="button" className="mc-btn-ghost" style={{ flex: 1, padding: '12px' }} onClick={closeCriticalModal} disabled={criticalSaving}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="mc-btn-primary"
                                    style={{ flex: 2, padding: '12px' }}
                                    onClick={handleCriticalSubmit}
                                    disabled={
                                        criticalSaving ||
                                        isAllBranches ||
                                        (() => {
                                            const parsed = Number.parseFloat(String(criticalInput).trim().replace(/,/g, ''));
                                            if (!Number.isFinite(parsed) || parsed < 0) return true;
                                            const nextCrit = Math.round(parsed * 1000) / 1000;
                                            return nextCrit === (Number(criticalItem?.critical_level) || 0);
                                        })()
                                    }
                                >
                                    {criticalSaving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isLowStockProofOpen && (
                    <Modal
                        onClose={() => setIsLowStockProofOpen(false)}
                        title="Low stock (SKUs) — breakdown"
                        width="920px"
                    >
                        <div style={{ padding: '0 24px 24px' }}>
                            <p className="ws-kpi-proof-methodology">
                                <strong>Rule:</strong> a SKU counts as <em>low stock</em> only when{' '}
                                <strong>critical level &gt; 0</strong> and <strong>current stock ≤ critical level</strong>.
                                Products with critical set to 0 are excluded (not monitored for low stock).
                            </p>
                            <p className="ws-kpi-proof-methodology">
                                <strong>Scope:</strong> {selectedBranchName}
                                {isAllBranches ? ' (all adopted SKUs in this list)' : ''}.{' '}
                                <strong>Current stock</strong> is branch on-hand when present; otherwise adoption opening
                                qty. <strong>Critical</strong> is{' '}
                                <code style={{ fontSize: '0.8em' }}>branch_products.criticalStockPoint</code> for this
                                branch.
                            </p>

                            <div className="ws-kpi-proof-summary-grid">
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">KPI count (low stock)</span>
                                    <span className="ws-kpi-proof-stat-value">{lowStockBreakdown.count}</span>
                                </div>
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">Out of stock (qty = 0)</span>
                                    <span className="ws-kpi-proof-stat-value">{lowStockBreakdown.outOfStock}</span>
                                </div>
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">Low (qty &gt; 0, ≤ critical)</span>
                                    <span className="ws-kpi-proof-stat-value">{lowStockBreakdown.lowOnly}</span>
                                </div>
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">SKUs with critical set</span>
                                    <span className="ws-kpi-proof-stat-value">{lowStockBreakdown.withCriticalSet}</span>
                                </div>
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">SKUs without critical (excluded)</span>
                                    <span className="ws-kpi-proof-stat-value">{lowStockBreakdown.withoutCritical}</span>
                                </div>
                            </div>

                            {lowStockBreakdown.lines.length === 0 ? (
                                <p className="ws-kpi-proof-note">
                                    No low-stock SKUs in this scope — either stock is above critical for monitored items,
                                    or critical level is not set on any product.
                                </p>
                            ) : (
                                <div className="ws-kpi-proof-scroll">
                                    <table className="ws-table ws-kpi-proof-table">
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left' }}>Product</th>
                                                <th style={{ textAlign: 'left' }}>SKU</th>
                                                <th style={{ textAlign: 'left' }}>Department</th>
                                                <th style={{ textAlign: 'right' }}>Current stock</th>
                                                <th style={{ textAlign: 'right' }}>Critical</th>
                                                <th style={{ textAlign: 'right' }}>Shortfall</th>
                                                <th style={{ textAlign: 'left' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lowStockBreakdown.lines.map((row) => (
                                                <tr key={row.id}>
                                                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.sku}</td>
                                                    <td>{row.departmentName}</td>
                                                    <td
                                                        style={{
                                                            textAlign: 'right',
                                                            fontWeight: 700,
                                                            color: row.qty <= 0 ? '#B91C1C' : '#D97706',
                                                        }}
                                                    >
                                                        {row.qty}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.critical}</td>
                                                    <td
                                                        style={{
                                                            textAlign: 'right',
                                                            fontWeight: 700,
                                                            color: '#B91C1C',
                                                        }}
                                                    >
                                                        {row.gap}
                                                    </td>
                                                    <td>
                                                        <span
                                                            style={{
                                                                display: 'inline-block',
                                                                padding: '2px 8px',
                                                                borderRadius: 6,
                                                                fontSize: '0.7rem',
                                                                fontWeight: 800,
                                                                textTransform: 'uppercase',
                                                                background: row.qty <= 0 ? '#FEE2E2' : '#FFFBEB',
                                                                color: row.qty <= 0 ? '#991B1B' : '#92400E',
                                                            }}
                                                        >
                                                            {row.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isInvValueProofOpen && (
                    <Modal
                        onClose={() => setIsInvValueProofOpen(false)}
                        title="Total inventory value — calculation"
                        width="920px"
                    >
                        <div style={{ padding: '0 24px 24px' }}>
                            <p className="ws-kpi-proof-methodology">
                                <strong>Formula:</strong> for each product in scope,{' '}
                                <em>line value = current stock × purchase price</em>. The KPI total is the sum of all
                                line values (displayed rounded to the nearest SAR).
                            </p>
                            <p className="ws-kpi-proof-methodology">
                                <strong>Scope:</strong> {selectedBranchName}
                                {isAllBranches ? ' (all adopted SKUs across branches in this list)' : ''}.{' '}
                                <strong>Current stock</strong> uses branch on-hand quantity when set; otherwise adoption
                                opening qty. <strong>Purchase price</strong> is the branch/catalog purchase price on each
                                row.
                            </p>

                            <div className="ws-kpi-proof-summary-grid">
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">SKUs in list</span>
                                    <span className="ws-kpi-proof-stat-value">{inventoryValueBreakdown.skuCount}</span>
                                </div>
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">SKUs with stock &gt; 0</span>
                                    <span className="ws-kpi-proof-stat-value">{inventoryValueBreakdown.skusWithStock}</span>
                                </div>
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">SKUs with value &gt; 0</span>
                                    <span className="ws-kpi-proof-stat-value">{inventoryValueBreakdown.skusWithValue}</span>
                                </div>
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">Total (exact)</span>
                                    <span className="ws-kpi-proof-stat-value">
                                        {formatSar(inventoryValueBreakdown.total, { decimals: 2 })}
                                    </span>
                                </div>
                                <div className="ws-kpi-proof-stat">
                                    <span className="ws-kpi-proof-stat-label">KPI display (rounded)</span>
                                    <span className="ws-kpi-proof-stat-value">
                                        {formatSar(Math.round(inventoryValueBreakdown.total))}
                                    </span>
                                </div>
                            </div>

                            {inventoryValueBreakdown.lines.length === 0 ? (
                                <p className="ws-kpi-proof-note">No products in this scope yet.</p>
                            ) : (
                                <div className="ws-kpi-proof-scroll">
                                    <table className="ws-table ws-kpi-proof-table">
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left' }}>Product</th>
                                                <th style={{ textAlign: 'left' }}>SKU</th>
                                                <th style={{ textAlign: 'left' }}>Department</th>
                                                <th style={{ textAlign: 'right' }}>Purchase price</th>
                                                <th style={{ textAlign: 'right' }}>Current stock</th>
                                                <th style={{ textAlign: 'right' }}>Line value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inventoryValueBreakdown.lines.map((row) => (
                                                <tr key={row.id}>
                                                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{row.sku}</td>
                                                    <td>{row.departmentName}</td>
                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        {formatSar(row.purchasePrice, { decimals: 2 })}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.qty}</td>
                                                    <td
                                                        style={{
                                                            textAlign: 'right',
                                                            fontWeight: 700,
                                                            color: row.lineValue > 0 ? '#047857' : 'var(--color-text-muted)',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {formatSar(row.lineValue, { decimals: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '2px solid var(--color-border)' }}>
                                                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 800, paddingTop: 14 }}>
                                                    Total
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'right',
                                                        fontWeight: 800,
                                                        paddingTop: 14,
                                                        color: '#047857',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {formatSar(inventoryValueBreakdown.total, { decimals: 2 })}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}
