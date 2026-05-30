/**
 * Helpers for workshop ↔ supplier purchase invoices
 * (POST/GET /workshop-staff/supplier-purchase-invoices, /supplier/workshop-purchase-invoices).
 *
 * POST body matches CreateWorkshopSupplierPurchaseInvoiceDto (nested fields; server may expect
 * snake_case `branch_id`, `issue_date`, `due_date`, and string `supplier.id`). Also sends camelCase
 * aliases. Nested `dueDate` is kept for compatibility. lines[].branchCatalogProductId, etc.
 */

function money2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

/** Trimmed string id — used for `supplier.id` (`.trim()` on server) and `branch_id`. */
function toTrimmedIdString(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim();
    return s === '' ? null : s;
}

/** `YYYY-MM-DD` for API (server expects `issue_date` / ISO date string). */
function normalizeIssueDateForApi(raw) {
    if (raw == null || raw === '') return undefined;
    const s = String(raw).trim();
    const head = s.length >= 10 ? s.slice(0, 10) : s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
    const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
    if (m) {
        const d = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10);
        const yr = parseInt(m[3], 10);
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && yr >= 1900 && yr <= 2100) {
            return `${yr}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }
    return undefined;
}

/**
 * dueDate: object for server parseWorkshopPurchaseDueDate (camelCase — Nest DTO).
 * Maps payment_terms / net_days / custom / computed from the invoice UI.
 */
function buildDueDatePayload({
    dueDateType,
    netDays,
    customDueDate,
    issueDate,
    computedDueDate,
}) {
    const issue = normalizeIssueDateForApi(issueDate);
    const computed =
        computedDueDate && computedDueDate !== '—' && String(computedDueDate).trim() !== ''
            ? normalizeIssueDateForApi(computedDueDate)
            : undefined;
    if (dueDateType === 'Custom') {
        const custom = normalizeIssueDateForApi(customDueDate);
        return {
            type: 'Custom',
            customDate: custom,
            computedDueDate: computed || custom,
            netDays: undefined,
            issueDate: issue,
            issue_date: issue,
        };
    }
    if (dueDateType === 'EOM') {
        return {
            type: 'EOM',
            computedDueDate: computed,
            issueDate: issue,
            issue_date: issue,
        };
    }
    return {
        type: 'Net',
        netDays: Number(netDays) || 0,
        issueDate: issue,
        issue_date: issue,
        computedDueDate: computed,
    };
}

/** Nest `parseWorkshopPurchaseDueDate` reads snake_case on the nested object. */
function workshopPurchaseDueDateNestedForApi(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const net = payload.netDays ?? payload.net_days;
    return {
        type: payload.type ?? 'Net',
        net_days: net != null && Number.isFinite(Number(net)) ? Math.floor(Number(net)) : undefined,
        custom_date: payload.customDate ?? payload.custom_date ?? null,
        computed_due_date: payload.computedDueDate ?? payload.computed_due_date ?? null,
        // camelCase aliases for lenient servers / logging
        netDays: net != null && Number.isFinite(Number(net)) ? Math.floor(Number(net)) : undefined,
        customDate: payload.customDate ?? payload.custom_date ?? null,
        computedDueDate: payload.computedDueDate ?? payload.computed_due_date ?? null,
    };
}

/**
 * Flat `YYYY-MM-DD` due date for APIs that require `due_date` (matches WorkshopPurchases due logic).
 */
function resolveFlatDueDateIso(p, duePayload, issueNorm) {
    const fromNested =
        normalizeIssueDateForApi(duePayload?.computedDueDate) ??
        normalizeIssueDateForApi(duePayload?.customDate);
    if (fromNested) return fromNested;

    const fromParam = normalizeIssueDateForApi(p.computedDueDate);
    if (fromParam) return fromParam;

    const issueStr = issueNorm ?? normalizeIssueDateForApi(p.issueDate);
    if (!issueStr) return undefined;

    const issue = new Date(`${issueStr}T12:00:00`);
    if (Number.isNaN(issue.getTime())) return undefined;

    const type = String(p.dueDateType || 'Net');
    if (type === 'Custom') {
        return normalizeIssueDateForApi(p.customDueDate);
    }
    if (type === 'EOM') {
        const eom = new Date(issue.getFullYear(), issue.getMonth() + 1, 0);
        return `${eom.getFullYear()}-${String(eom.getMonth() + 1).padStart(2, '0')}-${String(eom.getDate()).padStart(2, '0')}`;
    }
    const net = parseInt(p.netDays, 10) || 0;
    const due = new Date(issue);
    due.setDate(issue.getDate() + net);
    return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
}

/**
 * GET /workshop-staff/supplier-purchase-invoices/:id — unwrap nested invoice object from various API envelopes.
 * Workshop Nest handler returns `{ success: true, purchaseInvoice: formatWorkshopSupplierPurchaseInvoice(...) }`.
 */
export function unwrapWorkshopStaffSupplierPurchaseInvoiceGet(res) {
    if (!res || typeof res !== 'object') return null;
    if (res.purchaseInvoice != null && typeof res.purchaseInvoice === 'object') {
        return res.purchaseInvoice;
    }
    const inner =
        res.invoice ??
        res.purchaseInvoice ??
        res.purchase_invoice ??
        res.data?.invoice ??
        res.data?.purchaseInvoice ??
        res.data?.purchase_invoice ??
        (res.data && typeof res.data === 'object' && !Array.isArray(res.data) && (res.data.id ?? res.data._id) != null
            ? res.data
            : null);
    if (inner && typeof inner === 'object') return inner;
    if (res.id != null || res._id != null) return res;
    return null;
}

export function unwrapWorkshopSupplierPurchaseInvoiceList(res) {
    if (!res || typeof res !== 'object') return [];
    /** Primary: `invoices`. Legacy: `purchaseInvoices` / workshop `purchaseInvoices`. */
    const keys = ['invoices', 'purchaseInvoices', 'purchase_invoices', 'data', 'items', 'rows', 'results'];
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
        if (Array.isArray(res?.data?.[k])) return res.data[k];
    }
    if (Array.isArray(res.data)) return res.data;
    return [];
}

function formatInvoiceQtyDisplay(n) {
    if (n == null || !Number.isFinite(n)) return null;
    if (Number.isInteger(n)) return n.toLocaleString();
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function invoiceLineQty(line) {
    if (!line || typeof line !== 'object') return null;
    const raw = line.qty ?? line.quantity;
    if (raw == null || raw === '') return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
}

/** Non-empty trimmed UOM/unit string, or null if absent. */
function invoiceLineUomRaw(line) {
    if (!line || typeof line !== 'object') return null;
    const u = line.uom ?? line.unit ?? line.unitOfMeasure ?? line.unit_of_measure;
    const s = u != null ? String(u).trim() : '';
    return s === '' ? null : s;
}

/** Best-effort display name for a catalog / free-text invoice line */
function invoiceLineDisplayName(line) {
    if (!line || typeof line !== 'object') return '';
    const nested = line.product != null && typeof line.product === 'object' ? line.product : null;
    const candidates = [
        line.itemName,
        line.item_name,
        line.productName,
        line.product_name,
        nested?.name,
        line.description,
    ];
    for (const v of candidates) {
        if (v == null) continue;
        const s = String(v).trim();
        if (s !== '') return s;
    }
    return '';
}

/**
 * Compact product column: first distinct line label; “(+N more)” when several products.
 */
export function workshopInvoiceProductNameSummary(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { product_label: '—' };
    }
    const distinct = [];
    for (const it of items) {
        const n = invoiceLineDisplayName(it);
        if (!n) continue;
        if (!distinct.includes(n)) distinct.push(n);
    }
    if (distinct.length === 0) return { product_label: '—' };
    if (distinct.length === 1) return { product_label: distinct[0] };
    return { product_label: `${distinct[0]} (+${distinct.length - 1} more)` };
}

/**
 * Labels for workshop purchase invoice list rows: aggregates qty when every line shares the same UOM;
 * otherwise shows first line qty with (+N).
 */
export function workshopInvoiceQtyUnitSummary(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { quantity_label: '—', unit_label: '—' };
    }
    const parsed = items.map((it) => ({
        qty: invoiceLineQty(it),
        uom: invoiceLineUomRaw(it),
    }));
    if (parsed.length === 1) {
        const p = parsed[0];
        return {
            quantity_label: p.qty != null ? formatInvoiceQtyDisplay(p.qty) : '—',
            unit_label: p.uom ?? '—',
        };
    }
    const distinctUoms = [...new Set(parsed.map((p) => p.uom).filter(Boolean))];
    const allSameUnit = distinctUoms.length <= 1;
    if (allSameUnit) {
        const sum = parsed.reduce((s, p) => s + (p.qty ?? 0), 0);
        const uomLabel = distinctUoms[0] ?? '—';
        return { quantity_label: formatInvoiceQtyDisplay(sum), unit_label: uomLabel };
    }
    const first = parsed[0];
    const extra = parsed.length - 1;
    return {
        quantity_label:
            first.qty != null ? `${formatInvoiceQtyDisplay(first.qty)} (+${extra})` : '—',
        unit_label: 'mixed',
    };
}

/**
 * First line unit price (ex VAT when present) for supplier list column.
 * Multi-line invoices show the first line’s unit price (same convention as product summary).
 */
export function workshopInvoicePrimaryUnitPriceSummary(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { primary_unit_price: null };
    }
    const line = items[0];
    const direct = Number(
        line.unitPriceExVat ??
            line.unit_price_ex_vat ??
            line.unitPrice ??
            line.unit_price ??
            NaN,
    );
    if (Number.isFinite(direct)) {
        return { primary_unit_price: money2(direct) };
    }
    const qty = Number(line.qty ?? line.quantity ?? 0);
    const lineTotal = Number(
        line.lineTotal ?? line.line_total ?? line.subtotalExVat ?? line.subtotal_ex_vat ?? 0,
    );
    if (qty > 0 && Number.isFinite(lineTotal)) {
        return { primary_unit_price: money2(lineTotal / qty) };
    }
    return { primary_unit_price: null };
}

/**
 * Merge workshop purchase-invoice `ui` flags for list/detail (GET).
 * Backend `formatWorkshopSupplierPurchaseInvoice` includes top-level `ui` when present (from stored create payload).
 * Legacy rows: read `payload.ui` when `payload` is JSON string or object.
 */
export function extractWorkshopPurchaseInvoiceUiFromPayload(raw) {
    if (!raw || typeof raw !== 'object') return {};
    if (raw.ui && typeof raw.ui === 'object') {
        return { ...raw.ui };
    }
    let p = raw.payload;
    if (typeof p === 'string') {
        try {
            p = JSON.parse(p);
        } catch {
            p = null;
        }
    }
    if (p && typeof p === 'object' && p.ui && typeof p.ui === 'object') {
        return { ...p.ui };
    }
    return {};
}

/**
 * Newest-first sort for merged workshop purchase-invoice tables (affiliated + non-affiliated).
 * Same issue date is common; tie-break with created time, then numeric id / invoice number.
 *
 * @param {ReturnType<typeof normalizeWorkshopSupplierPurchaseInvoiceRow>} a
 * @param {ReturnType<typeof normalizeWorkshopSupplierPurchaseInvoiceRow>} b
 * @returns {number}
 */
export function compareWorkshopPurchaseInvoiceListRowsDesc(a, b) {
    if (!a || !b) return 0;
    const dateA = String(a.date || '').slice(0, 10);
    const dateB = String(b.date || '').slice(0, 10);
    if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
    }
    const rawA = a._raw && typeof a._raw === 'object' ? a._raw : {};
    const rawB = b._raw && typeof b._raw === 'object' ? b._raw : {};
    const tA = Date.parse(String(rawA.createdAt ?? rawA.created_at ?? ''));
    const tB = Date.parse(String(rawB.createdAt ?? rawB.created_at ?? ''));
    if (Number.isFinite(tA) && Number.isFinite(tB) && tA !== tB) {
        return tB - tA;
    }
    const idA = Number(a.id);
    const idB = Number(b.id);
    if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
        return idB - idA;
    }
    const invA = String(a.invoice_number ?? '');
    const invB = String(b.invoice_number ?? '');
    return invB.localeCompare(invA, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Merged affiliated + local lists can contain the same WLPI row twice (e.g. both endpoints
 * or duplicate payloads). One stable key per WLPI number; otherwise `invoiceKind` + `id`.
 *
 * @param {Array<ReturnType<typeof normalizeWorkshopSupplierPurchaseInvoiceRow>|null|undefined>} rows
 * @returns {Array<ReturnType<typeof normalizeWorkshopSupplierPurchaseInvoiceRow>>}
 */
export function dedupeWorkshopPurchaseInvoiceListRows(rows) {
    if (!Array.isArray(rows) || rows.length <= 1) return rows.filter(Boolean);
    const map = new Map();
    for (const r of rows) {
        if (!r || typeof r !== 'object') continue;
        const no = String(r.invoice_number ?? '').trim();
        const key = /^WLPI-/i.test(no)
            ? `wlpi:${no.toUpperCase()}`
            : `${r.invoiceKind === 'local' ? 'local' : 'affiliated'}:${String(r.id ?? '')}`;
        if (!map.has(key)) map.set(key, r);
    }
    return [...map.values()];
}

/**
 * Map API invoice → WorkshopPurchases table row shape.
 * Branch (GET): `branch` { id, name }, `branchId`, `branch_id`, `branchName`, `branch_name` (per formatWorkshopSupplierPurchaseInvoice).
 */
export function normalizeWorkshopSupplierPurchaseInvoiceRow(inv) {
    if (!inv || typeof inv !== 'object') return null;
    const id = inv.id ?? inv._id;
    if (id == null) return null;
    const supplier = inv.supplier && typeof inv.supplier === 'object' ? inv.supplier : null;
    const topVendor =
        [inv.vendor_name, inv.vendorName, inv.supplier_name, inv.supplierName].find(
            (v) => v != null && String(v).trim() !== '',
        ) ?? '';
    const vendorFallback =
        supplier?.supplierName ?? supplier?.name ?? inv.supplierName ?? inv.supplier_name ?? inv.vendorName ?? '';
    const vendorName = String(topVendor || vendorFallback).trim();
    const status = String(inv.status ?? inv.state ?? 'pending').toLowerCase();
    const invoiceKind = inv._invoiceKind === 'local' ? 'local' : 'affiliated';
    const sub = money2(
        inv.subtotalExVat ?? inv.subtotal_ex_vat ?? inv.subtotalExcludingVat ?? inv.subtotal ?? 0,
    );
    const items = Array.isArray(inv.items) ? inv.items : Array.isArray(inv.lines) ? inv.lines : [];
    const payload = inv.payload && typeof inv.payload === 'object' ? inv.payload : null;
    const payloadTotals = payload?.totals && typeof payload.totals === 'object' ? payload.totals : null;
    let vat = money2(
        (status === 'draft' ? payloadTotals?.total_vat ?? payloadTotals?.totalVat : null) ??
            inv.taxAmount ??
            inv.tax_amount ??
            inv.totalVat ??
            inv.total_vat ??
            inv.taxTotal ??
            inv.tax_total ??
            inv.vatAmount ??
            inv.vat_amount ??
            0,
    );
    if (vat === 0 && items.length > 0) {
        const sumLineTax = items.reduce(
            (s, line) =>
                s +
                money2(
                    line?.taxAmount ??
                        line?.tax_amount ??
                        line?.vatAmount ??
                        line?.vat_amount ??
                        line?.lineVat ??
                        line?.line_vat ??
                        0,
                ),
            0,
        );
        if (sumLineTax > 0) vat = sumLineTax;
    }
    const grand = money2(
        (status === 'draft' ? payloadTotals?.grand_total ?? payloadTotals?.grandTotal : null) ??
            inv.grandTotal ??
            inv.grand_total ??
            inv.totalInclVat ??
            inv.total ??
            0,
    );
    const paid = money2(inv.paidAmount ?? inv.amountPaid ?? inv.amount_paid ?? 0);
    const balance = money2(
        status === 'draft'
            ? Math.max(0, grand - paid)
            : inv.balance ?? inv.balanceDue ?? inv.balance_due ?? Math.max(0, grand - paid),
    );
    const hasStockFlag = Boolean(
        inv.stockAppliedAt ??
            inv.stock_applied_at ??
            inv.stockUpdated ??
            inv.stock_updated ??
            inv.stockReceived ??
            inv.stock_received,
    );
    const stockUpdated =
        hasStockFlag ||
        status === 'approved' ||
        (status === 'completed' && invoiceKind !== 'local');
    const { quantity_label, unit_label } = workshopInvoiceQtyUnitSummary(items);
    const { product_label } = workshopInvoiceProductNameSummary(items);
    const { primary_unit_price } = workshopInvoicePrimaryUnitPriceSummary(items);
    const totalsObj = inv.totals && typeof inv.totals === 'object' ? inv.totals : null;
    const freightIn = money2(
        inv.freightIn ?? inv.freight_in ?? totalsObj?.freight_in ?? totalsObj?.freightIn ?? 0,
    );
    const br = inv.branch && typeof inv.branch === 'object' ? inv.branch : null;
    const branchIdVal = inv.branchId ?? inv.branch_id ?? br?.id ?? '';
    const branch_id = branchIdVal != null && String(branchIdVal).trim() !== '' ? String(branchIdVal).trim() : '';
    const branchNameRaw = [br?.name, inv.branchName, inv.branch_name]
        .map((v) => (v == null ? '' : String(v).trim()))
        .find((s) => s !== '') ?? '';
    const branch_name = branchNameRaw || (branch_id ? `Branch ${branch_id}` : '');
    return {
        id: String(id),
        invoice_number:
            inv.invoiceNumber ?? inv.invoice_number ?? inv.reference ?? inv.ref ?? String(id).slice(0, 12),
        supplier: vendorName,
        vendor_name: vendorName,
        date: (inv.issueDate ?? inv.issue_date ?? inv.createdAt ?? inv.created_at ?? '').toString().slice(0, 10),
        due_date: (inv.dueDate ?? inv.due_date ?? '').toString().slice(0, 10) || null,
        vendor_invoice_ref:
            inv.vendorInvoiceRef ??
            inv.vendor_invoice_ref ??
            inv.vendorRef ??
            inv.refNumber ??
            inv.ref_number ??
            '',
        description: inv.description ?? inv.title ?? '',
        notes: inv.notes ?? inv.internalNotes ?? inv.internal_notes ?? '',
        subtotal: sub,
        vat_amount: vat,
        freight_in: freightIn,
        branch_id,
        branch_name,
        grand_total: grand,
        amount_paid: paid,
        balance_due: balance,
        payment_status: (inv.paymentStatus ?? inv.payment_status ?? (paid >= grand ? 'paid' : 'unpaid'))
            .toString()
            .toLowerCase(),
        status,
        stock_updated: stockUpdated,
        quantity_label,
        unit_label,
        product_label,
        primary_unit_price,
        items,
        payload,
        invoiceKind,
        _raw: inv,
    };
}

/**
 * POST /workshop-staff/supplier-purchase-invoices — CreateWorkshopSupplierPurchaseInvoiceDto (nested, camelCase).
 *
 * **Branch (backend):** sends both `branch_id` and `branchId` (same trimmed id). If both were ever sent,
 * `branch_id` wins on the server — keep them identical.
 *
 * **Freight (backend):** server reads, in order: `body.freightIn` → `body.freight_in` →
 * `body.totals?.freight_in` → `body.totals?.freightIn` (finite number ≥ 0). This builder sets all of them
 * consistently. If `totals.grandTotal` / `grand_total` is sent, it must already include freight when freight > 0
 * (client `computePurchaseInvoiceTotals` includes freight in `grand_total`).
 *
 * **UI flags:** `ui.amounts_tax_inclusive` / `ui.amountsTaxInclusive` are stored in payload; server does not
 * re-split lines — line `unit_price_ex_vat`, `tax_amount`, etc. must remain correct (FE handles inclusive unit UX).
 *
 * @param {object} p
 * @param {string|number} p.supplierId — linked supplier (numeric preferred)
 * @param {string|number} p.branchId — branch PK (mirrored as `branch_id` on the wire)
 * @param {string} p.issueDate — YYYY-MM-DD
 * @param {'Net'|'Custom'|'EOM'} p.dueDateType
 * @param {number|string} p.netDays
 * @param {string} p.customDueDate — YYYY-MM-DD when Custom
 * @param {string} p.computedDueDate — YYYY-MM-DD from UI (no "—")
 * @param {string} [p.vendorInvoiceRef] → ref_number
 * @param {string} [p.description]
 * @param {string} [p.notes]
 * @param {string} [p.currency]
 * @param {string} [p.status] — e.g. draft (server still creates pending workflow)
 * @param {boolean} p.updateLastPurchasePriceOnSave
 * @param {boolean} p.showLineDescriptionColumn
 * @param {boolean} p.showLineDiscountColumn
 * @param {boolean} p.lineDiscountIsPercent — ui.line_discount_is_percent
 * @param {'fixed_sar'|'percent'|string} p.invoiceDiscountMode
 * @param {number} p.invoiceDiscountValue
 * @param {number} [p.freightIn] — added to grand total (SAR), no extra VAT on freight in this client model
 * @param {boolean} [p.showAmountsTaxInclusive] — persisted in `ui` when backend supports it
 * @param {Array<object>} p.lines — from buildEnrichedLineItems
 * @param {object} p.totals — from computePurchaseInvoiceTotals (snake_case keys)
 */
export function buildCreateWorkshopSupplierPurchaseInvoiceBody(p) {
    const t = p.totals || {};
    const invMode = String(p.invoiceDiscountMode || 'fixed_sar');
    const discountType = invMode === 'percent' || invMode.toLowerCase().includes('percent') ? 'percent' : 'fixed';

    const lines = (p.lines || []).map((l) => {
        const pid = l.branch_catalog_product_id;
        const incl = money2(l.line_total_incl_vat);
        const branchPid = pid != null && String(pid).trim() !== '' ? String(pid) : null;
        const itemNameStr = String(l.item_name ?? l.itemName ?? l.item ?? '').trim();
        const desc = l.description || undefined;
        const acctCode = l.account_code || undefined;
        const acctName = l.account_name || undefined;
        const uom = l.uom || 'piece';
        const qty = money2(l.qty);
        const unitEx = money2(l.unit_price_ex_vat);
        const grossEx = money2(l.gross_ex_vat);
        const taxableEx = money2(l.taxable_ex_vat);
        const lineDiscRaw = l.line_discount_raw ?? 0;
        const lineDiscAmt = money2(l.line_discount_amount);
        const lineDiscMode =
            l.line_discount_mode === 'fixed_sar' || l.lineDiscountMode === 'fixed_sar'
                ? 'fixed_sar'
                : 'percent';
        const taxCd = l.tax_code || 'VAT 15%';
        const taxRt = l.tax_rate;
        const taxAmt = money2(l.tax_amount);
        const unitPurchaseIncl = money2(l.unit_purchase_price_incl_vat ?? l.unitPurchasePriceInclVat);
        return {
            branchCatalogProductId: branchPid,
            branch_catalog_product_id: branchPid,
            itemName: itemNameStr,
            item_name: itemNameStr,
            description: desc,
            accountCode: acctCode,
            account_code: acctCode,
            accountName: acctName,
            account_name: acctName,
            uom,
            quantity: qty,
            unitPriceExVat: unitEx,
            unit_price_ex_vat: unitEx,
            unitPurchasePriceInclVat: unitPurchaseIncl,
            unit_purchase_price_incl_vat: unitPurchaseIncl,
            grossExVat: grossEx,
            gross_ex_vat: grossEx,
            taxableExVat: taxableEx,
            taxable_ex_vat: taxableEx,
            lineDiscountRaw: lineDiscRaw,
            line_discount_raw: lineDiscRaw,
            lineDiscountAmount: lineDiscAmt,
            line_discount_amount: lineDiscAmt,
            lineDiscountMode: lineDiscMode,
            line_discount_mode: lineDiscMode,
            taxCode: taxCd,
            tax_code: taxCd,
            taxRate: taxRt,
            tax_rate: taxRt,
            taxAmount: taxAmt,
            tax_amount: taxAmt,
            lineTotalInclVat: incl,
            line_total_incl_vat: incl,
            /** Line incl. VAT → DB `total` when present */
            total: incl,
        };
    });

    const issueNorm = normalizeIssueDateForApi(p.issueDate);

    const dueDatePayload = buildDueDatePayload({
        dueDateType: p.dueDateType || 'Net',
        netDays: p.netDays,
        customDueDate: p.customDueDate,
        issueDate: p.issueDate,
        computedDueDate: p.computedDueDate,
    });

    const dueNorm = resolveFlatDueDateIso(p, dueDatePayload, issueNorm);
    const dueNested = workshopPurchaseDueDateNestedForApi(dueDatePayload);

    const branchIdStr = toTrimmedIdString(p.branchId);
    return {
        supplier: { id: toTrimmedIdString(p.supplierId) },
        branch_id: branchIdStr,
        branchId: branchIdStr,
        issueDate: issueNorm,
        issue_date: issueNorm,
        dueDate: dueDatePayload,
        /** Object form so create/update draft preserves Net days / Custom / EOM (flat string loses terms). */
        due_date: dueNested,
        due_date_iso: dueNorm,
        vendorInvoiceRef: p.vendorInvoiceRef || undefined,
        description: p.description || undefined,
        notes: p.notes || undefined,
        currency: p.currency || 'SAR',
        status: p.status ?? 'draft',
        updateLastPurchasePriceOnSave: Boolean(p.updateLastPurchasePriceOnSave),
        freightIn: money2(p.freightIn ?? 0),
        freight_in: money2(p.freightIn ?? 0),
        ui: {
            showLineDescriptionColumn: Boolean(p.showLineDescriptionColumn),
            showLineDiscountColumn: Boolean(p.showLineDiscountColumn),
            lineDiscountIsPercent: Boolean(p.lineDiscountIsPercent),
            amountsTaxInclusive: Boolean(p.showAmountsTaxInclusive),
            amounts_tax_inclusive: Boolean(p.showAmountsTaxInclusive),
            prices_include_vat: Boolean(p.showAmountsTaxInclusive ?? p.pricesIncludeVat),
            no_vat: Boolean(p.noVat),
        },
        tax: p.tax ?? {
            label: p.vatLabel ?? 'VAT 15%',
            rate: p.vatRate ?? 0.15,
        },
        selected_branch_filter: p.selectedBranchFilter ?? null,
        update_last_purchase_price_on_save: Boolean(p.updateLastPurchasePriceOnSave),
        invoiceDiscount: {
            mode: invMode,
            value: money2(p.invoiceDiscountValue ?? 0),
            discountType,
        },
        lines,
        totals: {
            lineGrossExVat: money2(t.line_gross_ex_vat),
            lineDiscountAmount: money2(t.line_discount_amount),
            linesTaxableExVat: money2(t.lines_taxable_ex_vat),
            linesTotalVat: money2(t.lines_total_vat),
            linesGrandTotalInclVat: money2(t.lines_grand_total_incl_vat),
            invoiceDiscountAppliedExVat: money2(t.invoice_discount_applied_ex_vat),
            subtotalExVat: money2(t.subtotal_ex_vat),
            totalVat: money2(t.total_vat),
            freightIn: money2(t.freight_in ?? 0),
            freight_in: money2(t.freight_in ?? 0),
            grandTotal: money2(t.grand_total),
        },
    };
}
