import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Eye, FileText, Loader2, Plus, RotateCcw, Search, Trash2, Building2, Package, Zap, Info, Calendar, Hash, Link2 } from 'lucide-react';
import InlineFormScreen from '../../components/InlineFormScreen';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';
import WorkshopPurchaseReturnDetailView from '../../components/workshop/WorkshopPurchaseReturnDetailView';
import { ShimmerTable, ShimmerTextBlock } from '../../components/supplier/Shimmer';
import {
    branchScopeParams,
    createAffiliatedPurchaseReturn,
    getAffiliatedPurchaseReturn,
    getWorkshopStaffBranchProducts,
    getWorkshopSupplierProductUomRules,
    getWorkshopSupplierPurchaseInvoice,
    getWorkshopSuppliers,
    listAffiliatedPurchaseReturns,
    listWorkshopSupplierPurchaseInvoices,
    unwrapWorkshopBranchListResponse,
} from '../../services/workshopStaffApi';
import {
    getWorkshopLocalPurchaseInvoice,
    listAllLocalSupplierPurchaseInvoices,
    listLocalSuppliers,
} from '../../services/workshopSuppliersApi';
import { getBranchProducts, listWorkshopUomProfiles } from '../../services/workshopCatalogApi';
import WorkshopUomSelect from './WorkshopUomSelect';
import { branchProductToUomCaps, lineInventoryCapsForInvoice } from './workshopUomUtils';
import {
    convertQtyWhenUomChanges,
    defaultUomForWarehouseProduct,
    findUomCapsForLine,
    formatWorkshopPurchaseLineUomHint,
    isWarehouseUomLine,
    maxReturnQtyInLineUom,
    returnQtyInInvoiceLineUom,
    roundMoney2,
    normUomLabel,
} from './workshopPurchaseUomUtils';
import '../../styles/admin/AccountingPage.css';

const SUPPLIERS_PAGE_LIMIT = 50;

function sarFmt(v) {
    return Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatMgrDate(iso) {
    if (!iso || iso === '—') return '—';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    if (!y || !m || !d) return String(iso).slice(0, 10);
    return `${d}/${m}/${y}`;
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
    return { id, name: name || '—', raw: s, __supplierType: 'affiliated' };
}

async function fetchNonAffiliatedSupplierPickerRows(scopeBranchId) {
    const localParams = {};
    if (scopeBranchId && scopeBranchId !== 'all') {
        localParams.branchId = scopeBranchId;
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

function pickBranchCatalogItemId(row) {
    const nested = row?.product ?? row?.service;
    const productSnap = row?.product && typeof row.product === 'object' ? row.product : null;
    const raw =
        productSnap?.id ??
        row?.productId ??
        row?.product_id ??
        nested?.productId ??
        nested?.id ??
        row?.id;
    if (raw == null || raw === '') return '';
    return String(raw);
}

function pickBranchCatalogItemName(row) {
    const nested = row?.product ?? row?.service;
    return (
        String(
            row?.name ??
                row?.productName ??
                row?.serviceName ??
                nested?.name ??
                nested?.productName ??
                row?.sku ??
                '',
        ).trim() || 'Product'
    );
}

function pickBranchCatalogItemUnit(row) {
    const nested = row?.product ?? row?.service;
    return String(nested?.unit ?? nested?.uom ?? row?.unit ?? row?.uom ?? 'piece').trim() || 'piece';
}

function flattenWorkshopStaffBranchProductsResponse(res) {
    if (res == null) return [];
    if (Array.isArray(res)) return res;
    if (typeof res !== 'object') return [];
    const out = [];
    const uncategorized = res.uncategorizedProducts ?? res.uncategorized_products ?? res?.data?.uncategorizedProducts;
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

function normalizeBranchProductOption(row) {
    if (!row || typeof row !== 'object') return null;
    const nested = row?.product ?? row?.service;
    const id = pickBranchCatalogItemId(row);
    if (!id) return null;
    const isService =
        row?.service != null ||
        row?.itemType === 'service' ||
        String(nested?.type || row?.type || '').toLowerCase() === 'service';
    if (isService) return null;
    const name = pickBranchCatalogItemName(row);
    const unit = pickBranchCatalogItemUnit(row);
    const nestedObj = nested != null && typeof nested === 'object' ? nested : null;
    return {
        id,
        name,
        unit,
        priceExcl: pickBranchCatalogUnitPrice(row),
        sku: row?.sku ?? nestedObj?.sku ?? null,
        warehouseUnit: row.warehouseUnit ?? nestedObj?.warehouseUnit ?? null,
        workshopUnit: row.workshopUnit ?? nestedObj?.workshopUnit ?? null,
        conversionFactor:
            row.conversionFactor != null
                ? Number(row.conversionFactor)
                : nestedObj?.conversionFactor != null
                  ? Number(nestedObj.conversionFactor)
                  : null,
        uomProfileId: row.uomProfileId ?? nestedObj?.uomProfileId ?? null,
        supplierProductId: row.supplierProductId ?? nestedObj?.supplierProductId ?? null,
    };
}

function pickBranchCatalogUnitPrice(row) {
    const nested = row?.product ?? row?.service;
    const snap = nested != null && typeof nested === 'object' ? nested : null;
    const candidates = [
        snap?.purchasePrice,
        snap?.purchase_price,
        row?.purchasePrice,
        row?.purchase_price,
        snap?.unitPrice,
        row?.unitPrice,
    ];
    for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n >= 0) return n;
    }
    return 0;
}

function createEmptyManualLine() {
    return {
        id: `ml-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: '',
        productLabel: '',
        productSearch: '',
        qty: '',
        unitPrice: '',
        uom: 'piece',
        uomProfileId: null,
        uomMode: 'warehouse',
        reason: '',
    };
}

function pickPurchaseInvoiceNo(inv) {
    if (!inv || typeof inv !== 'object') return '—';
    const raw =
        inv.invoiceNo ??
        inv.invoiceNumber ??
        inv.invoice_number ??
        inv.reference ??
        inv.ref ??
        inv.refNumber ??
        inv.ref_number;
    if (raw != null && String(raw).trim() !== '') return String(raw).trim();
    if (inv.id != null && String(inv.id).trim() !== '') return String(inv.id);
    return '—';
}

/** Qty + UOM as billed on the supplier/warehouse invoice (Box), when split UOM applies. */
function invoiceLineBilledQty(item) {
    const raw = item?.billedQty ?? item?.billed_qty;
    if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n)) return n;
    }
    return 0;
}

function invoiceLineBilledUom(item) {
    const raw = item?.billedUom ?? item?.billed_uom;
    if (raw != null && String(raw).trim() !== '') return String(raw).trim();
    return '—';
}

/** Workshop branch inventory qty + UOM (what was actually received — basis for returns). */
function invoiceLineInventoryQty(item) {
    const wsQty = item?.qtyWorkshop ?? item?.qty_workshop;
    if (wsQty != null) {
        const n = Number(wsQty);
        if (Number.isFinite(n) && n > 0) return n;
    }
    const raw = item?.qty ?? item?.quantity ?? 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
}

function invoiceLineInventoryUom(item) {
    const wsUnit = item?.workshopUnit ?? item?.workshop_unit;
    if (wsUnit != null && String(wsUnit).trim() !== '') return String(wsUnit).trim();
    return (
        String(item?.uom ?? item?.unit ?? '').trim() || '—'
    );
}

function invoiceLineForReturnCalc(item) {
    return {
        ...item,
        qty: invoiceLineInventoryQty(item),
        uom: invoiceLineInventoryUom(item),
    };
}

function formatInvoiceInvQtyDisplay(item) {
    const qty = invoiceLineInventoryQty(item);
    const uom = invoiceLineInventoryUom(item);
    const billedQty = invoiceLineBilledQty(item);
    const billedUom = invoiceLineBilledUom(item);
    const conversionNote =
        billedQty > 0 &&
        billedUom &&
        billedUom !== '—' &&
        normUomLabel(uom) !== normUomLabel(billedUom)
            ? `= ${billedQty} ${billedUom} on supplier invoice`
            : '';
    return { qty, uom, conversionNote };
}

function mapPurchaseInvoicesFromResponse(res, invoiceKind = 'affiliated') {
    if (!res || !Array.isArray(res.invoices)) return [];
    return res.invoices.map((inv) => ({
        id: inv.id,
        invoiceKind,
        invoiceNo: pickPurchaseInvoiceNo(inv),
        supplierName: inv.supplier?.name || inv.supplierName || inv.supplier_name || inv.vendor_name || inv.localSupplier?.name || 'Supplier',
        supplierId: inv.supplier?.id ?? inv.supplierId ?? inv.localSupplierId ?? inv.local_supplier_id,
        branchName: inv.branch?.name || inv.branchName || inv.branch_name || '—',
        branchId: inv.branch?.id ?? inv.branchId ?? inv.branch_id,
        date: inv.issueDate || inv.issue_date || inv.invoiceDate || inv.date,
        amount: Number(inv.grandTotal || inv.grand_total || 0),
        productLabel: inv.productLabel || inv.product_label || inv.items?.[0]?.itemName || inv.items?.[0]?.product_name || '—',
    }));
}

function piComboboxSubtitle(inv) {
    const lines = [inv.supplierName, inv.branchName !== '—' ? inv.branchName : null].filter(Boolean);
    const detail = [];
    if (inv.productLabel && inv.productLabel !== '—') detail.push(inv.productLabel);
    if (inv.date) detail.push(`Issued ${formatMgrDate(inv.date)}`);
    if (detail.length) lines.push(detail.join(' · '));
    return lines.join('\n');
}

function piSelectedDisplay(inv) {
    if (!inv) return '';
    return `${pickPurchaseInvoiceNo(inv)} · ${inv.supplierName || 'Supplier'}`;
}

function returnStatusBadge(row) {
    const st = String(row?.status || 'pending').toLowerCase();
    if (st === 'approved' || row?.returnKind === 'local' || row?.mode === 'local_direct') {
        return { label: 'Approved', cls: 'mgr-si-status mgr-si-status--paid' };
    }
    if (row?.mode === 'workshop_initiated') {
        return { label: 'Pending supplier', cls: 'mgr-si-status mgr-si-status--pending' };
    }
    return { label: 'Pending workshop', cls: 'mgr-si-status mgr-si-status--pending' };
}

export default function WorkshopPurchaseReturns({ selectedBranchId = 'all', branches = [] }) {
    const location = useLocation();
    const [formOpen, setFormOpen] = useState(Boolean(location.state?.prefillInvoiceId));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');
    const [rows, setRows] = useState([]);

    const [suppliers, setSuppliers] = useState([]);
    const [suppliersLoading, setSuppliersLoading] = useState(false);
    const [suppliersError, setSuppliersError] = useState('');

    const [selectedSupplierKey, setSelectedSupplierKey] = useState('');
    const [supplierSearchDraft, setSupplierSearchDraft] = useState('');

    const [purchaseInvoices, setPurchaseInvoices] = useState([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);
    const [listSearch, setListSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedInvoiceId, setSelectedInvoiceId] = useState(
        location.state?.prefillInvoiceId ? String(location.state.prefillInvoiceId) : '',
    );
    const [selectedInvoiceKind, setSelectedInvoiceKind] = useState('affiliated');
    const [invoiceSearchDraft, setInvoiceSearchDraft] = useState('');
    const [invoiceDetail, setInvoiceDetail] = useState(null);
    const [lineQty, setLineQty] = useState({});
    const [lineReason, setLineReason] = useState({});
    const [manualLines, setManualLines] = useState([createEmptyManualLine()]);
    const [branchProductOptions, setBranchProductOptions] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productsLoadError, setProductsLoadError] = useState('');
    const [workshopUomProfiles, setWorkshopUomProfiles] = useState([]);
    const [supplierUomByProductId, setSupplierUomByProductId] = useState({});
    const [invoiceLineUom, setInvoiceLineUom] = useState({});

    const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
    const [reference, setReference] = useState('');
    const [referenceAuto, setReferenceAuto] = useState(true);
    const [description, setDescription] = useState('');
    const [viewReturnId, setViewReturnId] = useState(null);
    const [viewReturnDetail, setViewReturnDetail] = useState(null);
    const [viewReturnLoading, setViewReturnLoading] = useState(false);

    const branchParams = useMemo(
        () => (selectedBranchId && selectedBranchId !== 'all' ? { branchId: String(selectedBranchId) } : {}),
        [selectedBranchId],
    );

    const scopeBranchId = useMemo(() => {
        if (selectedBranchId && selectedBranchId !== 'all') return String(selectedBranchId);
        if (invoiceDetail?.branchId) return String(invoiceDetail.branchId);
        if (branches?.length === 1) return String(branches[0].id);
        return branches?.[0]?.id ? String(branches[0].id) : '';
    }, [selectedBranchId, invoiceDetail?.branchId, branches]);

    const selectedSupplier = useMemo(() => {
        if (!selectedSupplierKey) return null;
        const [type, id] = selectedSupplierKey.split(':');
        return suppliers.find((s) => s.__supplierType === type && String(s.id) === String(id)) || null;
    }, [selectedSupplierKey, suppliers]);

    const isLocalSupplier = selectedSupplier?.__supplierType === 'local';

    const selectedInvoiceMeta = useMemo(
        () => purchaseInvoices.find((row) => String(row.id) === String(selectedInvoiceId)) || null,
        [purchaseInvoices, selectedInvoiceId],
    );

    const effectiveBranchId = useMemo(() => {
        if (selectedBranchId && selectedBranchId !== 'all') return String(selectedBranchId);
        if (invoiceDetail?.branchId) return String(invoiceDetail.branchId);
        if (selectedInvoiceMeta?.branchId) return String(selectedInvoiceMeta.branchId);
        return scopeBranchId;
    }, [selectedBranchId, invoiceDetail?.branchId, selectedInvoiceMeta?.branchId, scopeBranchId]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await listAffiliatedPurchaseReturns(branchParams);
            setRows(Array.isArray(res?.items) ? res.items : []);
        } catch (err) {
            setError(err.message || 'Failed to load debit notes.');
        } finally {
            setLoading(false);
        }
    }, [branchParams]);

    const loadSuppliers = useCallback(async () => {
        setSuppliersLoading(true);
        setSuppliersError('');
        try {
            let offset = 0;
            const merged = [];
            let hardCap = 60;
            while (hardCap-- > 0) {
                const res = await getWorkshopSuppliers({
                    ...branchScopeParams(scopeBranchId || 'all'),
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
            try {
                const localRows = await fetchNonAffiliatedSupplierPickerRows(scopeBranchId);
                merged.push(...localRows);
            } catch (e) {
                console.warn('[debit-notes] failed to load local suppliers', e);
            }
            setSuppliers(merged);
        } catch (e) {
            let localRows = [];
            try {
                localRows = await fetchNonAffiliatedSupplierPickerRows(scopeBranchId);
            } catch {
                /* ignore */
            }
            setSuppliers(localRows);
            setSuppliersError(e.message || 'Could not load workshop suppliers.');
        } finally {
            setSuppliersLoading(false);
        }
    }, [scopeBranchId]);

    const loadPurchaseInvoices = useCallback(async () => {
        setInvoicesLoading(true);
        setFormError('');
        try {
            const baseParams = { ...branchParams, limit: 200, offset: 0 };
            const fetchAffiliatedBatch = async (extra = {}) => {
                const rows = [];
                let offset = 0;
                let pages = 0;
                while (pages++ < 15) {
                    const res = await listWorkshopSupplierPurchaseInvoices({
                        ...baseParams,
                        ...extra,
                        offset,
                    });
                    rows.push(...mapPurchaseInvoicesFromResponse(res, 'affiliated'));
                    const total = res?.total != null ? Number(res.total) : null;
                    const batchLen = Array.isArray(res?.invoices) ? res.invoices.length : 0;
                    if (total != null && rows.length >= total) break;
                    if (batchLen < 200) break;
                    offset += 200;
                }
                return rows;
            };

            const [workshopCreated, affiliatedMirrors, localRes] = await Promise.all([
                fetchAffiliatedBatch(),
                fetchAffiliatedBatch({ forAffiliatedReturns: 'true' }),
                listAllLocalSupplierPurchaseInvoices({ ...branchParams, limit: 500, offset: 0 }).catch(
                    () => ({ invoices: [] }),
                ),
            ]);

            const byKey = new Map();
            for (const inv of [...workshopCreated, ...affiliatedMirrors, ...mapPurchaseInvoicesFromResponse(localRes, 'local')]) {
                const key = `${inv.invoiceKind}:${inv.id}`;
                if (!byKey.has(key)) byKey.set(key, inv);
            }
            const merged = [...byKey.values()].sort((a, b) =>
                String(b.date || '').localeCompare(String(a.date || '')),
            );
            setPurchaseInvoices(merged);
        } catch (err) {
            setFormError(err.message || 'Failed to load purchase invoices.');
            setPurchaseInvoices([]);
        } finally {
            setInvoicesLoading(false);
        }
    }, [branchParams]);

    const loadBranchProducts = useCallback(async () => {
        if (!effectiveBranchId) {
            setBranchProductOptions([]);
            return;
        }
        setProductsLoading(true);
        setProductsLoadError('');
        try {
            const supplierId =
                selectedSupplier && !isLocalSupplier ? String(selectedSupplier.id) : undefined;

            const fetchRows = async (withSupplier) => {
                const res = await getWorkshopStaffBranchProducts(effectiveBranchId, {
                    supplierId: withSupplier ? supplierId : undefined,
                });
                return flattenWorkshopStaffBranchProductsResponse(res);
            };

            let prodRows = await fetchRows(Boolean(supplierId));
            if (prodRows.length === 0 && supplierId) {
                prodRows = await fetchRows(false);
            }
            if (prodRows.length === 0) {
                try {
                    prodRows = unwrapWorkshopBranchListResponse(
                        await getBranchProducts(effectiveBranchId),
                        'products',
                    );
                } catch {
                    /* keep empty */
                }
            }

            const opts = prodRows
                .map(normalizeBranchProductOption)
                .filter(Boolean)
                .sort((a, b) => a.name.localeCompare(b.name));
            setBranchProductOptions(opts);
            if (opts.length === 0) {
                setProductsLoadError(
                    'No branch products found. Adopt products in Inventory or select a specific branch.',
                );
            }
        } catch (err) {
            console.warn('[debit-notes] branch products', err);
            setProductsLoadError(err.message || 'Could not load branch products.');
            setBranchProductOptions([]);
        } finally {
            setProductsLoading(false);
        }
    }, [effectiveBranchId, selectedSupplier, isLocalSupplier]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!formOpen || !location.state?.prefillInvoiceId || selectedSupplierKey) return;
        let active = true;
        const prefillId = String(location.state.prefillInvoiceId);
        getWorkshopSupplierPurchaseInvoice(prefillId)
            .then((res) => {
                if (!active) return;
                const invoice = res?.purchaseInvoice || res?.invoice || res;
                const supplierId = invoice?.supplier?.id ?? invoice?.supplierId;
                const supplierName = invoice?.supplier?.name ?? invoice?.supplierName ?? '';
                if (supplierId) {
                    const key = `affiliated:${supplierId}`;
                    setSelectedSupplierKey(key);
                    setSupplierSearchDraft(supplierName || 'Supplier');
                }
                setSelectedInvoiceId(prefillId);
                setSelectedInvoiceKind('affiliated');
                setInvoiceSearchDraft(
                    `${pickPurchaseInvoiceNo(invoice)} · ${supplierName || 'Supplier'}`,
                );
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [formOpen, location.state?.prefillInvoiceId, selectedSupplierKey]);

    useEffect(() => {
        if (!formOpen) return;
        loadSuppliers();
    }, [formOpen, loadSuppliers]);

    useEffect(() => {
        if (!formOpen) return;
        loadPurchaseInvoices();
    }, [formOpen, loadPurchaseInvoices]);

    useEffect(() => {
        if (!formOpen || selectedInvoiceId) return;
        loadBranchProducts();
    }, [formOpen, selectedInvoiceId, selectedSupplierKey, loadBranchProducts]);

    useEffect(() => {
        if (!formOpen) return;
        let cancelled = false;
        listWorkshopUomProfiles()
            .then((res) => {
                if (!cancelled) setWorkshopUomProfiles(res?.profiles ?? []);
            })
            .catch(() => {
                if (!cancelled) setWorkshopUomProfiles([]);
            });
        return () => {
            cancelled = true;
        };
    }, [formOpen]);

    useEffect(() => {
        if (!formOpen || !effectiveBranchId || isLocalSupplier || !selectedSupplier?.id) {
            setSupplierUomByProductId({});
            return;
        }
        let cancelled = false;
        getWorkshopSupplierProductUomRules(String(selectedSupplier.id), effectiveBranchId)
            .then((res) => {
                if (cancelled) return;
                const map = {};
                for (const rule of Array.isArray(res?.rules) ? res.rules : []) {
                    if (rule?.productId == null) continue;
                    map[String(rule.productId)] = rule;
                }
                setSupplierUomByProductId(map);
            })
            .catch(() => {
                if (!cancelled) setSupplierUomByProductId({});
            });
        return () => {
            cancelled = true;
        };
    }, [formOpen, effectiveBranchId, isLocalSupplier, selectedSupplier?.id]);

    useEffect(() => {
        if (!formOpen || !selectedInvoiceId) {
            setInvoiceDetail(null);
            setLineQty({});
            setLineReason({});
            setInvoiceLineUom({});
            return;
        }
        let active = true;
        setInvoiceLoading(true);
        setFormError('');
        const loader =
            selectedInvoiceKind === 'local'
                ? getWorkshopLocalPurchaseInvoice(selectedInvoiceId)
                : getWorkshopSupplierPurchaseInvoice(selectedInvoiceId);
        loader
            .then((res) => {
                if (!active) return;
                const invoice =
                    res?.purchaseInvoice ||
                    res?.invoice ||
                    res?.localPurchaseInvoice ||
                    res;
                setInvoiceDetail(invoice);
                const nextQty = {};
                const nextReason = {};
                (invoice?.items || []).forEach((item) => {
                    nextQty[String(item.id)] = '';
                    nextReason[String(item.id)] = '';
                });
                setLineQty(nextQty);
                setLineReason(nextReason);
                const nextUom = {};
                (invoice?.items || []).forEach((item) => {
                    const inventoryUom = invoiceLineInventoryUom(item);
                    const wsUnit = item?.workshopUnit ?? item?.workshop_unit;
                    const caps = findUomCapsForLine(item, supplierUomByProductId, branchProductOptions);
                    const defaultUom =
                        inventoryUom !== '—'
                            ? inventoryUom
                            : wsUnit || item.uom || 'piece';
                    const isWorkshopDefault =
                        caps &&
                        wsUnit &&
                        normUomLabel(defaultUom) === normUomLabel(wsUnit);
                    nextUom[String(item.id)] = {
                        uom: defaultUom,
                        uomProfileId: item.uomProfileId ?? null,
                        uomMode: isWorkshopDefault ? 'workshop' : 'warehouse',
                    };
                });
                setInvoiceLineUom(nextUom);
                if (referenceAuto) {
                    const refNo = pickPurchaseInvoiceNo(invoice);
                    if (refNo !== '—') setReference(refNo);
                }
            })
            .catch((err) => {
                if (active) setFormError(err.message || 'Failed to load purchase invoice.');
            })
            .finally(() => {
                if (active) setInvoiceLoading(false);
            });
        return () => {
            active = false;
        };
    }, [formOpen, selectedInvoiceId, selectedInvoiceKind, referenceAuto]);

    const filteredRows = useMemo(() => {
        const q = listSearch.trim().toLowerCase();
        return rows.filter((row) => {
            if (statusFilter !== 'all' && String(row.status || '').toLowerCase() !== statusFilter) {
                return false;
            }
            if (!q) return true;
            const hay = [
                row.returnNumber,
                row.supplierName,
                row.description,
                row.sourcePurchaseInvoiceNumber,
                row.supplierSalesReturnNo,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(q);
        });
    }, [rows, listSearch, statusFilter]);

    const listTotal = useMemo(
        () => filteredRows.reduce((sum, row) => sum + Number(row.grandTotal || 0), 0),
        [filteredRows],
    );

    const invoiceLineTotal = useMemo(() => {
        return (invoiceDetail?.items || []).reduce((sum, item) => {
            const invLineUom = invoiceLineUom[String(item.id)] ?? {
                uom: item.uom || 'piece',
                uomMode: 'warehouse',
            };
            const caps = lineInventoryCapsForInvoice(
                findUomCapsForLine(
                    { productId: item.productId, ...invLineUom },
                    supplierUomByProductId,
                    branchProductOptions,
                ),
                { productId: item.productId, ...invLineUom },
                workshopUomProfiles,
            );
            const typedQty = Number(lineQty[String(item.id)] || 0);
            const billedItem = invoiceLineForReturnCalc(item);
            const qtyInInvoiceUom = returnQtyInInvoiceLineUom(
                typedQty,
                invLineUom,
                billedItem,
                caps,
            );
            if (!(qtyInInvoiceUom > 0)) return sum;
            const ratio =
                billedItem.qty > 0 ? qtyInInvoiceUom / Number(billedItem.qty) : 0;
            const lineTotal = Number(item.lineTotal || 0) * ratio;
            const lineTax = Number(item.taxAmount || 0) * ratio;
            return sum + lineTotal + lineTax;
        }, 0);
    }, [invoiceDetail, lineQty, invoiceLineUom, supplierUomByProductId, branchProductOptions, workshopUomProfiles]);

    const manualLineTotal = useMemo(() => {
        return manualLines.reduce((sum, line) => {
            const qty = Number(line.qty || 0);
            const unit = Number(line.unitPrice || 0);
            if (!(qty > 0)) return sum;
            return sum + qty * unit;
        }, 0);
    }, [manualLines]);

    const estimatedTotal = selectedInvoiceId ? invoiceLineTotal : manualLineTotal;

    const filledLineCount = useMemo(() => {
        if (selectedInvoiceId) {
            return Object.values(lineQty).filter((q) => Number(q) > 0).length;
        }
        return manualLines.filter((l) => l.productId && Number(l.qty) > 0).length;
    }, [selectedInvoiceId, lineQty, manualLines]);

    const supplierComboboxOptions = useMemo(
        () =>
            suppliers.map((s) => ({
                id: `${s.__supplierType}:${s.id}`,
                label: s.name,
                subtitle:
                    s.__supplierType === 'local'
                        ? 'Non-affiliated supplier'
                        : 'Affiliated supplier',
                searchTokens: [s.name, s.__supplierType === 'local' ? 'non-affiliated' : 'affiliated'],
            })),
        [suppliers],
    );

    const piComboboxOptions = useMemo(
        () =>
            purchaseInvoices.map((inv) => ({
                id: String(inv.id),
                label: pickPurchaseInvoiceNo(inv),
                subtitle: piComboboxSubtitle(inv),
                trailing: `SAR ${sarFmt(inv.amount)}`,
                searchTokens: [
                    inv.invoiceNo,
                    inv.supplierName,
                    inv.branchName,
                    inv.productLabel,
                    inv.date,
                ].filter(Boolean),
            })),
        [purchaseInvoices],
    );

    const productComboboxOptions = useMemo(
        () =>
            branchProductOptions.map((opt) => ({
                id: opt.id,
                label: opt.name,
                subtitle: opt.sku ? `SKU ${opt.sku}` : undefined,
                trailing: opt.priceExcl > 0 ? `SAR ${sarFmt(opt.priceExcl)}` : undefined,
                unitPrice: opt.priceExcl,
                productOption: opt,
                searchTokens: [opt.name, opt.sku].filter(Boolean),
            })),
        [branchProductOptions],
    );

    const resetFormFields = () => {
        setSelectedSupplierKey('');
        setSupplierSearchDraft('');
        setSelectedInvoiceId('');
        setSelectedInvoiceKind('affiliated');
        setInvoiceSearchDraft('');
        setDescription('');
        setReference('');
        setReferenceAuto(true);
        setLineQty({});
        setLineReason({});
        setManualLines([createEmptyManualLine()]);
        setInvoiceDetail(null);
        setInvoiceLineUom({});
        setBranchProductOptions([]);
        setProductsLoadError('');
    };

    const openForm = () => {
        setFormOpen(true);
        setFormError('');
        setSuccess('');
    };

    const closeForm = () => {
        if (saving) return;
        setFormOpen(false);
        resetFormFields();
    };

    const handleSupplierSelect = (opt) => {
        setSelectedSupplierKey(String(opt.id));
        setSupplierSearchDraft(opt.label);
        setSelectedInvoiceId('');
        setSelectedInvoiceKind('affiliated');
        setInvoiceSearchDraft('');
        setInvoiceDetail(null);
        setLineQty({});
        setLineReason({});
        setManualLines([createEmptyManualLine()]);
    };

    const handleInvoiceSelect = (opt) => {
        const inv = purchaseInvoices.find((row) => String(row.id) === String(opt.id));
        setSelectedInvoiceId(String(opt.id));
        setSelectedInvoiceKind(inv?.invoiceKind || 'affiliated');
        setInvoiceSearchDraft(
            inv ? piSelectedDisplay(inv) : String(opt.label || opt.id || '').trim(),
        );
        setManualLines([createEmptyManualLine()]);
        if (inv?.supplierId) {
            const kind = inv.invoiceKind === 'local' ? 'local' : 'affiliated';
            const supplierKey = `${kind}:${inv.supplierId}`;
            const match = suppliers.find(
                (s) => s.__supplierType === kind && String(s.id) === String(inv.supplierId),
            );
            if (match) {
                setSelectedSupplierKey(supplierKey);
                setSupplierSearchDraft(match.name);
            } else if (inv.supplierName) {
                setSelectedSupplierKey(supplierKey);
                setSupplierSearchDraft(inv.supplierName);
            }
        }
    };

    const clearInvoiceSelection = () => {
        setSelectedInvoiceId('');
        setSelectedInvoiceKind('affiliated');
        setInvoiceSearchDraft('');
        setInvoiceDetail(null);
        setLineQty({});
        setLineReason({});
    };

    const addManualLine = () => {
        setManualLines((prev) => [...prev, createEmptyManualLine()]);
    };

    const removeManualLine = (lineId) => {
        setManualLines((prev) => {
            if (prev.length <= 1) return [createEmptyManualLine()];
            return prev.filter((l) => l.id !== lineId);
        });
    };

    const updateManualLine = (lineId, patch) => {
        setManualLines((prev) =>
            prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
        );
    };

    const handleManualProductSelect = (lineId, opt) => {
        const productOpt = opt?.productOption ?? branchProductOptions.find((o) => String(o.id) === String(opt?.id));
        const caps = productOpt ? branchProductToUomCaps(productOpt) : null;
        const defaultUom = caps ? defaultUomForWarehouseProduct(caps, productOpt?.unit) : productOpt?.unit || 'piece';
        updateManualLine(lineId, {
            productId: String(opt.id),
            productLabel: opt.label,
            productSearch: opt.label,
            unitPrice:
                opt.unitPrice != null && Number(opt.unitPrice) >= 0
                    ? String(opt.unitPrice)
                    : productOpt?.priceExcl > 0
                      ? String(productOpt.priceExcl)
                      : '',
            uom: defaultUom,
            uomProfileId: productOpt?.uomProfileId ?? null,
            uomMode: 'warehouse',
        });
    };

    const updateManualLineUom = (lineId, uomValue) => {
        setManualLines((prev) =>
            prev.map((line) => {
                if (line.id !== lineId) return line;
                let updated = { ...line };
                if (uomValue && typeof uomValue === 'object') {
                    updated = {
                        ...updated,
                        uom: uomValue.uom ?? updated.uom,
                        uomProfileId: uomValue.uomProfileId ?? null,
                        uomMode: uomValue.uomMode ?? 'warehouse',
                    };
                } else {
                    updated.uom = uomValue;
                }
                const caps = lineInventoryCapsForInvoice(
                    findUomCapsForLine(updated, supplierUomByProductId, branchProductOptions),
                    updated,
                    workshopUomProfiles,
                );
                const cf = Number(caps?.conversionFactor) || 1;
                const oldIsWh = isWarehouseUomLine(line, caps);
                const newIsWh = isWarehouseUomLine(updated, caps);
                if (caps && cf > 0 && oldIsWh !== newIsWh) {
                    const p = parseFloat(String(line.unitPrice).replace(',', '.')) || 0;
                    if (p > 0) {
                        updated.unitPrice = String(roundMoney2(oldIsWh ? p / cf : p * cf));
                    }
                }
                return updated;
            }),
        );
    };

    const updateInvoiceLineUom = (itemId, uomValue, invoiceItem) => {
        const itemKey = String(itemId);
        const current = invoiceLineUom[itemKey] ?? {
            uom: invoiceItem?.uom || 'piece',
            uomMode: 'warehouse',
        };
        const next =
            uomValue && typeof uomValue === 'object'
                ? {
                      ...current,
                      uom: uomValue.uom ?? current.uom,
                      uomProfileId: uomValue.uomProfileId ?? null,
                      uomMode: uomValue.uomMode ?? 'warehouse',
                  }
                : { ...current, uom: uomValue };

        const caps = lineInventoryCapsForInvoice(
            findUomCapsForLine(
                { productId: invoiceItem?.productId, ...next },
                supplierUomByProductId,
                branchProductOptions,
            ),
            { productId: invoiceItem?.productId, ...next },
            workshopUomProfiles,
        );

        setInvoiceLineUom((prev) => ({
            ...prev,
            [itemKey]: next,
        }));

        setLineQty((prev) => {
            const raw = prev[itemKey];
            if (raw == null || raw === '') return prev;
            const converted = convertQtyWhenUomChanges(raw, current, next, caps);
            if (converted === '' || converted === raw) return prev;
            return { ...prev, [itemKey]: converted };
        });
    };

    const capsForManualLine = (line) =>
        lineInventoryCapsForInvoice(
            findUomCapsForLine(line, supplierUomByProductId, branchProductOptions),
            line,
            workshopUomProfiles,
        );

    const capsForInvoiceItem = (item) => {
        const line = {
            productId: item.productId,
            uom: invoiceLineUom[String(item.id)]?.uom ?? item.uom,
            uomProfileId: invoiceLineUom[String(item.id)]?.uomProfileId ?? null,
        };
        return lineInventoryCapsForInvoice(
            findUomCapsForLine(line, supplierUomByProductId, branchProductOptions),
            line,
            workshopUomProfiles,
        );
    };

    const handleSubmit = async (event) => {
        event?.preventDefault?.();
        if (!selectedSupplier) {
            setFormError('Select a supplier.');
            return;
        }
        if (!effectiveBranchId) {
            setFormError('Select a branch from the sidebar before creating a debit note.');
            return;
        }

        let lines = [];
        if (selectedInvoiceId) {
            lines = (invoiceDetail?.items || [])
                .map((item) => {
                    const invLineUom = invoiceLineUom[String(item.id)] ?? {
                        uom: invoiceLineInventoryUom(item),
                        uomMode:
                            item?.workshopUnit || item?.workshop_unit ? 'workshop' : 'warehouse',
                    };
                    const caps = capsForInvoiceItem(item);
                    const typedQty = Number(lineQty[String(item.id)] || 0);
                    const billedItem = invoiceLineForReturnCalc(item);
                    const qtyInInvoiceUom = returnQtyInInvoiceLineUom(
                        typedQty,
                        invLineUom,
                        billedItem,
                        caps,
                    );
                    return {
                        sourcePurchaseInvoiceItemId: String(item.id),
                        qty: qtyInInvoiceUom,
                        reason: lineReason[String(item.id)] || '',
                        uom: invLineUom.uom ?? billedItem.uom ?? undefined,
                    };
                })
                .filter((item) => item.qty > 0);
        } else {
            lines = manualLines
                .map((line) => ({
                    productId: line.productId,
                    qty: Number(line.qty || 0),
                    reason: line.reason || '',
                    uom: line.uom || undefined,
                }))
                .filter((line) => line.productId && line.qty > 0);
        }

        if (!lines.length) {
            setFormError(
                selectedInvoiceId
                    ? 'Enter at least one return quantity.'
                    : 'Add at least one product line with quantity.',
            );
            return;
        }

        if (selectedInvoiceId) {
            for (const item of invoiceDetail?.items || []) {
                const invLineUom = invoiceLineUom[String(item.id)] ?? {
                    uom: item.uom || 'piece',
                    uomMode: 'warehouse',
                };
                const caps = capsForInvoiceItem(item);
                const typedQty = Number(lineQty[String(item.id)] || 0);
                if (!(typedQty > 0)) continue;
                const billedItem = invoiceLineForReturnCalc(item);
                const qtyInInvoiceUom = returnQtyInInvoiceLineUom(
                    typedQty,
                    invLineUom,
                    billedItem,
                    caps,
                );
                const maxTyped = maxReturnQtyInLineUom(billedItem, invLineUom, caps);
                if (qtyInInvoiceUom > Number(billedItem.qty) + 1e-9) {
                    const label = item.itemName || item.productName || 'line';
                    setFormError(
                        maxTyped != null
                            ? `Return qty for "${label}" exceeds invoice qty (max ${maxTyped} ${invLineUom.uom}).`
                            : `Return qty for "${label}" exceeds invoice qty.`,
                    );
                    return;
                }
            }
        }

        setSaving(true);
        setFormError('');
        try {
            const payload = {
                branchId: effectiveBranchId,
                issueDate,
                reference: referenceAuto ? undefined : reference.trim() || undefined,
                description: description.trim() || undefined,
                lines,
            };
            if (isLocalSupplier) {
                payload.supplierType = 'local';
                payload.localSupplierId = selectedSupplier.id;
                payload.supplierId = selectedSupplier.id;
            } else {
                payload.supplierId = selectedSupplier.id;
            }
            if (selectedInvoiceId) {
                payload.sourcePurchaseInvoiceId = selectedInvoiceId;
            }
            const res = await createAffiliatedPurchaseReturn(payload);
            setSuccess(
                isLocalSupplier
                    ? `Debit note completed: ${res?.purchaseReturnNo || ''}. Stock and payables updated immediately.`
                    : `Debit note created: ${res?.purchaseReturnNo || ''}. Sent to supplier for approval.`,
            );
            setFormOpen(false);
            resetFormFields();
            await load();
        } catch (err) {
            setFormError(err.message || 'Failed to create debit note.');
        } finally {
            setSaving(false);
        }
    };

    const handleViewReturn = async (row) => {
        setViewReturnId(row.id);
        setViewReturnLoading(true);
        setViewReturnDetail(null);
        try {
            const res = await getAffiliatedPurchaseReturn(row.id);
            setViewReturnDetail(res?.purchaseReturn || null);
        } catch {
            setViewReturnDetail(row);
        } finally {
            setViewReturnLoading(false);
        }
    };

    const closeView = () => {
        setViewReturnId(null);
        setViewReturnDetail(null);
        setViewReturnLoading(false);
    };

    const formBusy = saving || invoiceLoading || suppliersLoading;

    return (
        <div className="mgr-si-page">
            {!formOpen && !viewReturnId ? (
                <>
                    <header className="mgr-si-header">
                        <div className="mgr-si-header-top">
                            <div className="mgr-si-breadcrumb">Purchases › Debit Notes</div>
                            <div className="mgr-si-toolbar-actions">
                                <button type="button" className="mgr-si-btn-new" onClick={openForm}>
                                    <Plus size={16} /> New Debit Note
                                </button>
                            </div>
                        </div>
                        <h2 className="mgr-si-title">Debit Notes</h2>
                        <p className="mgr-si-subtitle">
                            Purchase returns against affiliated supplier invoices. Each debit note is
                            sent to the supplier as a <strong>sales return</strong> for approval or QR
                            confirmation before stock updates on both sides.
                        </p>
                    </header>

                    <div className="mgr-si-toolbar">
                        <div className="mgr-si-filter-bar">
                            <span className="mgr-si-filter-label">Status</span>
                            <select
                                className="mgr-si-filter-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                aria-label="Filter by status"
                            >
                                <option value="all">All</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                            </select>
                        </div>
                        <div className="mgr-si-search-wrap">
                            <div className="mgr-si-search-input-wrap">
                                <Search size={16} className="mgr-si-search-icon" aria-hidden />
                                <input
                                    type="search"
                                    className="mgr-si-search-input"
                                    placeholder="Search debit note #, supplier, invoice…"
                                    value={listSearch}
                                    onChange={(e) => setListSearch(e.target.value)}
                                    aria-label="Search debit notes"
                                />
                            </div>
                            <button type="button" className="mgr-si-search-btn">
                                Search
                            </button>
                        </div>
                    </div>

                    {error ? <div className="mgr-si-error">{error}</div> : null}
                    {success ? (
                        <div
                            style={{
                                marginBottom: 16,
                                padding: '12px 14px',
                                borderRadius: 10,
                                background: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                color: '#047857',
                                fontSize: '0.875rem',
                            }}
                        >
                            {success}
                        </div>
                    ) : null}

                    <div className="premium-table mgr-si-table-wrap">
                        <div style={{ overflowX: 'auto' }}>
                            {loading && filteredRows.length === 0 ? (
                                <div style={{ padding: 16 }}>
                                    <ShimmerTable rows={8} columns={6} />
                                </div>
                            ) : (
                                <table className="mgr-si-table">
                                    <thead>
                                        <tr className="table-header-row">
                                            <th className="table-th">Date</th>
                                            <th className="table-th">Debit note #</th>
                                            <th className="table-th">Supplier</th>
                                            <th className="table-th">Description</th>
                                            <th className="table-th">Amount</th>
                                            <th className="table-th">Status</th>
                                            <th className="table-th" style={{ width: 72 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!loading && filteredRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="table-cell table-empty">
                                                    <FileText
                                                        size={36}
                                                        style={{
                                                            opacity: 0.25,
                                                            margin: '0 auto 12px',
                                                            display: 'block',
                                                        }}
                                                    />
                                                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                                                        No debit notes yet
                                                    </div>
                                                    <p
                                                        style={{
                                                            margin: 0,
                                                            color: '#64748B',
                                                            fontSize: '0.875rem',
                                                        }}
                                                    >
                                                        Create a debit note from an affiliated purchase
                                                        invoice — the linked supplier receives it as a
                                                        sales return for approval.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="mgr-si-btn-new"
                                                        style={{ marginTop: 16 }}
                                                        onClick={openForm}
                                                    >
                                                        <Plus size={16} /> New Debit Note
                                                    </button>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRows.map((row) => {
                                                const badge = returnStatusBadge(row);
                                                return (
                                                    <tr key={row.id} className="table-row">
                                                        <td className="table-cell">
                                                            {formatMgrDate(row.issueDate)}
                                                        </td>
                                                        <td
                                                            className="table-cell"
                                                            style={{ fontWeight: 600 }}
                                                        >
                                                            {row.returnNumber}
                                                        </td>
                                                        <td className="table-cell">
                                                            {row.supplierName || '—'}
                                                        </td>
                                                        <td className="table-cell">
                                                            {row.description ||
                                                                row.sourcePurchaseInvoiceNumber ||
                                                                'Purchase Return'}
                                                        </td>
                                                        <td className="table-cell mgr-si-cell-amount">
                                                            SAR {sarFmt(row.grandTotal)}
                                                        </td>
                                                        <td className="table-cell">
                                                            <span className={badge.cls}>{badge.label}</span>
                                                        </td>
                                                        <td className="table-cell">
                                                            <button
                                                                type="button"
                                                                className="btn-portal-outline"
                                                                style={{ padding: '6px 10px' }}
                                                                onClick={() => handleViewReturn(row)}
                                                                title="View debit note"
                                                            >
                                                                <Eye size={15} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                    {filteredRows.length > 0 ? (
                                        <tfoot>
                                            <tr>
                                                <td colSpan={4} />
                                                <td
                                                    className="table-cell mgr-si-cell-amount"
                                                    style={{ fontWeight: 700 }}
                                                >
                                                    SAR {sarFmt(listTotal)}
                                                </td>
                                                <td colSpan={2} />
                                            </tr>
                                        </tfoot>
                                    ) : null}
                                </table>
                            )}
                        </div>
                    </div>
                </>
            ) : null}

            {formOpen ? (
                <InlineFormScreen
                    title={
                        <div className="pi-modal-title">
                            <span className="pi-breadcrumb">
                                Debit Notes › <span className="pi-b-active">New</span>
                            </span>
                            <div className="pi-title-main">
                                <RotateCcw size={24} />
                                <span>Debit Note</span>
                            </div>
                        </div>
                    }
                    onBack={closeForm}
                    backLabel="Back to list"
                    bodyClassName="supplier-affiliated-return-form-body"
                    footer={
                        <div className="pi-modal-footer">
                            <div className="pi-footer-left">
                                <button
                                    type="button"
                                    className="btn-pi-cancel"
                                    onClick={closeForm}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                            </div>
                            <div className="pi-footer-right">
                                {formError ? (
                                    <div className="dn-footer-error">{formError}</div>
                                ) : null}
                                {estimatedTotal > 0 ? (
                                    <div className="dn-footer-total" aria-live="polite">
                                        <span className="dn-footer-total__label">Total</span>
                                        <span className="dn-footer-total__value">
                                            SAR {sarFmt(estimatedTotal)}
                                        </span>
                                    </div>
                                ) : null}
                                <button
                                    type="button"
                                    className="btn-pi-create"
                                    onClick={handleSubmit}
                                    disabled={formBusy}
                                >
                                    {saving ? (
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
                                            Creating…
                                        </span>
                                    ) : (
                                        'Create debit note'
                                    )}
                                </button>
                            </div>
                        </div>
                    }
                >
                    <form className="pi-form-container" onSubmit={handleSubmit}>
                        {invoiceLoading && selectedInvoiceId && !invoiceDetail ? (
                            <div style={{ padding: '12px 0 24px' }}>
                                <ShimmerTextBlock lines={5} />
                                <div style={{ marginTop: 18 }}>
                                    <ShimmerTable rows={5} columns={6} />
                                </div>
                            </div>
                        ) : (
                            <div className="dn-create">
                                <div
                                    className={`dn-callout ${isLocalSupplier ? 'dn-callout--instant' : 'dn-callout--approval'}`}
                                >
                                    <div className="dn-callout__icon" aria-hidden>
                                        {isLocalSupplier ? <Zap size={20} /> : <Info size={20} />}
                                    </div>
                                    <div className="dn-callout__body">
                                        <p className="dn-callout__title">
                                            {isLocalSupplier
                                                ? 'Instant return — no supplier approval'
                                                : 'Supplier approval required'}
                                        </p>
                                        <p className="dn-callout__text">
                                            {isLocalSupplier ? (
                                                <>
                                                    Stock and accounts payable update{' '}
                                                    <strong>immediately</strong> when you create this
                                                    debit note. Nothing is sent to a supplier portal.
                                                </>
                                            ) : (
                                                <>
                                                    This debit note is sent to the supplier as a{' '}
                                                    <strong>sales return</strong>. Stock and GL update on
                                                    both sides only after the supplier{' '}
                                                    <strong>approves</strong> or{' '}
                                                    <strong>scans the QR once</strong> with their password.
                                                </>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="dn-panels">
                                    <section className="dn-panel">
                                        <header className="dn-panel__head">
                                            <span className="dn-panel__icon">
                                                <Calendar size={18} />
                                            </span>
                                            <div>
                                                <h3 className="dn-panel__title">Document details</h3>
                                                <p className="dn-panel__subtitle">Date, reference & description</p>
                                            </div>
                                        </header>
                                        <div className="dn-doc-grid">
                                            <div className="dn-field">
                                                <label htmlFor="dn-issue-date">Issue date</label>
                                                <input
                                                    id="dn-issue-date"
                                                    type="date"
                                                    className="dn-input"
                                                    value={issueDate}
                                                    onChange={(e) => setIssueDate(e.target.value)}
                                                    disabled={saving}
                                                />
                                            </div>
                                            <div className="dn-field dn-field--ref">
                                                <label htmlFor="dn-reference">Reference</label>
                                                <input
                                                    id="dn-reference"
                                                    type="text"
                                                    className="dn-input"
                                                    value={reference}
                                                    onChange={(e) => setReference(e.target.value)}
                                                    disabled={saving || referenceAuto}
                                                    placeholder="Auto or custom reference"
                                                />
                                                <label className="dn-switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={referenceAuto}
                                                        onChange={(e) => setReferenceAuto(e.target.checked)}
                                                        disabled={saving}
                                                    />
                                                    <span className="dn-switch__track" aria-hidden />
                                                    <span className="dn-switch__label">
                                                        <Hash size={14} aria-hidden />
                                                        Automatic from invoice
                                                    </span>
                                                </label>
                                            </div>
                                            <div className="dn-field dn-field--full">
                                                <label htmlFor="dn-description">
                                                    Description{' '}
                                                    <span className="dn-optional">optional</span>
                                                </label>
                                                <input
                                                    id="dn-description"
                                                    type="text"
                                                    className="dn-input"
                                                    value={description}
                                                    onChange={(e) => setDescription(e.target.value)}
                                                    placeholder="e.g. Purchase Return, damaged goods…"
                                                    disabled={saving}
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    <section className="dn-panel">
                                        <header className="dn-panel__head">
                                            <span className="dn-panel__icon">
                                                <Building2 size={18} />
                                            </span>
                                            <div>
                                                <h3 className="dn-panel__title">Supplier & invoice</h3>
                                                <p className="dn-panel__subtitle">
                                                    Pick a supplier, then optionally link a purchase invoice
                                                </p>
                                            </div>
                                        </header>
                                        <div className="dn-supplier-grid">
                                            <div className="dn-field">
                                                <label>
                                                    Supplier{' '}
                                                    <span className="dn-required">*</span>
                                                </label>
                                                <SearchableEntityCombobox
                                                    className="dn-combobox"
                                                    menuMinWidth={480}
                                                    options={supplierComboboxOptions}
                                                    value={selectedSupplierKey}
                                                    displayText={supplierSearchDraft}
                                                    entityLabel="supplier"
                                                    loading={suppliersLoading}
                                                    placeholder="Type to search supplier…"
                                                    emptyHint={
                                                        suppliersLoading
                                                            ? 'Loading suppliers…'
                                                            : suppliers.length === 0
                                                              ? 'No suppliers found'
                                                              : 'No matches — try another name'
                                                    }
                                                    disabled={saving}
                                                    onDisplayTextChange={(text) => {
                                                        setSupplierSearchDraft(text);
                                                        if (!text.trim()) {
                                                            setSelectedSupplierKey('');
                                                            clearInvoiceSelection();
                                                            return;
                                                        }
                                                        if (selectedSupplierKey && selectedSupplier) {
                                                            if (
                                                                text.trim() !==
                                                                selectedSupplier.name.trim()
                                                            ) {
                                                                setSelectedSupplierKey('');
                                                                clearInvoiceSelection();
                                                            }
                                                        }
                                                    }}
                                                    onSelect={handleSupplierSelect}
                                                />
                                                {selectedSupplier ? (
                                                    <span
                                                        className={`dn-supplier-badge ${isLocalSupplier ? 'dn-supplier-badge--local' : 'dn-supplier-badge--affiliated'}`}
                                                    >
                                                        {isLocalSupplier
                                                            ? 'Non-affiliated'
                                                            : 'Affiliated'}
                                                    </span>
                                                ) : null}
                                                {suppliersError ? (
                                                    <p className="dn-field-hint dn-field-hint--warn">
                                                        {suppliersError}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div className="dn-field">
                                                <label>
                                                    Purchase invoice{' '}
                                                    <span className="dn-optional">optional</span>
                                                </label>
                                                <SearchableEntityCombobox
                                                    className="dn-combobox"
                                                    menuMinWidth={520}
                                                    options={piComboboxOptions}
                                                    value={selectedInvoiceId}
                                                    displayText={invoiceSearchDraft}
                                                    entityLabel="invoice"
                                                    loading={invoicesLoading}
                                                    placeholder="Type to search purchase invoice…"
                                                    emptyHint={
                                                        invoicesLoading
                                                            ? 'Loading invoices…'
                                                            : purchaseInvoices.length === 0
                                                              ? 'No purchase invoices found'
                                                              : 'No matches — try invoice # or supplier'
                                                    }
                                                    disabled={saving}
                                                    onDisplayTextChange={(text) => {
                                                        setInvoiceSearchDraft(text);
                                                        if (!text.trim()) {
                                                            clearInvoiceSelection();
                                                            return;
                                                        }
                                                        if (selectedInvoiceId && selectedInvoiceMeta) {
                                                            const label =
                                                                piSelectedDisplay(selectedInvoiceMeta);
                                                            if (text.trim() !== label.trim()) {
                                                                clearInvoiceSelection();
                                                            }
                                                        }
                                                    }}
                                                    onSelect={handleInvoiceSelect}
                                                />
                                                {selectedInvoiceId ? (
                                                    <p className="dn-field-hint">
                                                        <Link2 size={13} aria-hidden />
                                                        Lines prefilled from invoice — adjust return
                                                        quantities below
                                                    </p>
                                                ) : (
                                                    <p className="dn-field-hint">
                                                        Pick any invoice to prefill lines, or skip and add
                                                        products manually
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </section>

                                    <section className="dn-panel dn-panel--lines">
                                        <header className="dn-panel__head dn-panel__head--lines">
                                            <span className="dn-panel__icon">
                                                <Package size={18} />
                                            </span>
                                            <div className="dn-panel__head-main">
                                                <h3 className="dn-panel__title">Return lines</h3>
                                                <p className="dn-panel__subtitle">
                                                    {selectedInvoiceId
                                                        ? 'Enter quantities to return from the linked invoice'
                                                        : 'Add products and quantities to return'}
                                                </p>
                                            </div>
                                            {filledLineCount > 0 ? (
                                                <span className="dn-lines-badge">
                                                    {filledLineCount} line
                                                    {filledLineCount === 1 ? '' : 's'} with qty
                                                </span>
                                            ) : null}
                                        </header>

                                        <div className="dn-lines-card">
                                            {selectedInvoiceId ? (
                                                (invoiceDetail?.items || []).length === 0 ? (
                                                    <div className="dn-empty">
                                                        <Loader2
                                                            size={28}
                                                            className="supplier-sales-last-sale-spinner"
                                                        />
                                                        <p>Loading invoice lines…</p>
                                                    </div>
                                                ) : (
                                                    <div className="dn-lines-scroll">
                                                        <table className="dn-lines-table">
                                                            <thead>
                                                                <tr>
                                                                    <th className="dn-th-item">Item</th>
                                                                    <th className="dn-th-inv-qty">Inv. qty</th>
                                                                    <th className="dn-th-uom">UOM</th>
                                                                    <th className="dn-th-return-qty">Return qty</th>
                                                                    <th className="dn-th-price">Unit price</th>
                                                                    <th className="dn-th-total">Total</th>
                                                                    <th className="dn-th-reason">Reason</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {(invoiceDetail?.items || []).map(
                                                                    (item, idx) => {
                                                                        const invLineUom = invoiceLineUom[String(item.id)] ?? {
                                                                            uom: invoiceLineInventoryUom(item),
                                                                            uomProfileId: null,
                                                                            uomMode:
                                                                                item?.workshopUnit || item?.workshop_unit
                                                                                    ? 'workshop'
                                                                                    : 'warehouse',
                                                                        };
                                                                        const invCaps = capsForInvoiceItem(item);
                                                                        const billedItem = invoiceLineForReturnCalc(item);
                                                                        const invQtyDisplay = formatInvoiceInvQtyDisplay(item);
                                                                        const typedQty = Number(
                                                                            lineQty[String(item.id)] || 0,
                                                                        );
                                                                        const qtyInInvoiceUom = returnQtyInInvoiceLineUom(
                                                                            typedQty,
                                                                            invLineUom,
                                                                            billedItem,
                                                                            invCaps,
                                                                        );
                                                                        const ratio =
                                                                            billedItem.qty > 0
                                                                                ? qtyInInvoiceUom / Number(billedItem.qty)
                                                                                : 0;
                                                                        const lineTotal =
                                                                            (Number(item.lineTotal || 0) +
                                                                                Number(
                                                                                    item.taxAmount || 0,
                                                                                )) *
                                                                            ratio;
                                                                        const hasQty = typedQty > 0;
                                                                        const maxReturnQty = maxReturnQtyInLineUom(
                                                                            billedItem,
                                                                            invLineUom,
                                                                            invCaps,
                                                                        );
                                                                        const invUomHint = formatWorkshopPurchaseLineUomHint(
                                                                            {
                                                                                ...invLineUom,
                                                                                qty: typedQty,
                                                                                unitPrice: item.unitPrice,
                                                                            },
                                                                            invCaps,
                                                                        );
                                                                        return (
                                                                            <tr
                                                                                key={item.id}
                                                                                className={
                                                                                    hasQty
                                                                                        ? 'dn-line-row dn-line-row--active'
                                                                                        : 'dn-line-row'
                                                                                }
                                                                            >
                                                                                <td className="dn-td-item">
                                                                                    <span className="dn-line-index">
                                                                                        {idx + 1}
                                                                                    </span>
                                                                                    <span className="dn-line-name">
                                                                                        {item.itemName ||
                                                                                            item.productName}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="dn-td-num dn-td-muted">
                                                                                    <div className="dn-inv-qty-display">
                                                                                        <span>
                                                                                            {invQtyDisplay.qty}{' '}
                                                                                            {invQtyDisplay.uom}
                                                                                        </span>
                                                                                        {invQtyDisplay.conversionNote ? (
                                                                                            <span className="dn-inv-qty-sub">
                                                                                                {invQtyDisplay.conversionNote}
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="dn-td-uom">
                                                                                    <div className="dn-uom-cell">
                                                                                    {item.productId && (invCaps || workshopUomProfiles.length > 0) ? (
                                                                                        <>
                                                                                            <WorkshopUomSelect
                                                                                                variant="invoice-line"
                                                                                                className="dn-input dn-uom-select"
                                                                                                line={invLineUom}
                                                                                                capsRow={invCaps}
                                                                                                profiles={workshopUomProfiles}
                                                                                                disabled={saving}
                                                                                                onChange={(parsed) =>
                                                                                                    updateInvoiceLineUom(
                                                                                                        item.id,
                                                                                                        parsed,
                                                                                                        item,
                                                                                                    )
                                                                                                }
                                                                                            />
                                                                                            {invUomHint ? (
                                                                                                <span
                                                                                                    className="dn-uom-hint"
                                                                                                    title={invUomHint}
                                                                                                >
                                                                                                    {invUomHint}
                                                                                                </span>
                                                                                            ) : null}
                                                                                        </>
                                                                                    ) : (
                                                                                        <span className="dn-td-muted">
                                                                                            {invLineUom.uom}
                                                                                        </span>
                                                                                    )}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="dn-td-num dn-return-qty-cell">
                                                                                    <div className="dn-qty-with-uom">
                                                                                        <input
                                                                                            type="number"
                                                                                            min="0"
                                                                                            max={
                                                                                                maxReturnQty != null
                                                                                                    ? maxReturnQty
                                                                                                    : undefined
                                                                                            }
                                                                                            step="0.001"
                                                                                            className="dn-input dn-input--qty"
                                                                                            value={
                                                                                                lineQty[
                                                                                                    String(
                                                                                                        item.id,
                                                                                                    )
                                                                                                ] ?? ''
                                                                                            }
                                                                                            onChange={(e) =>
                                                                                                setLineQty(
                                                                                                    (prev) => ({
                                                                                                        ...prev,
                                                                                                        [String(
                                                                                                            item.id,
                                                                                                        )]:
                                                                                                            e
                                                                                                                .target
                                                                                                                .value,
                                                                                                    }),
                                                                                                )
                                                                                            }
                                                                                            placeholder={
                                                                                                maxReturnQty != null
                                                                                                    ? `Max ${maxReturnQty}`
                                                                                                    : undefined
                                                                                            }
                                                                                            disabled={saving}
                                                                                            aria-label={`Return qty (${invLineUom.uom}) for ${item.itemName || item.productName}`}
                                                                                        />
                                                                                        <span className="dn-qty-uom">
                                                                                            {invLineUom.uom}
                                                                                        </span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="dn-td-num dn-td-muted">
                                                                                    {sarFmt(item.unitPrice)}
                                                                                </td>
                                                                                <td className="dn-td-num dn-td-total">
                                                                                    {hasQty
                                                                                        ? sarFmt(lineTotal)
                                                                                        : '—'}
                                                                                </td>
                                                                                <td className="dn-td-reason">
                                                                                    <input
                                                                                        type="text"
                                                                                        className="dn-input"
                                                                                        value={
                                                                                            lineReason[
                                                                                                String(
                                                                                                    item.id,
                                                                                                )
                                                                                            ] ?? ''
                                                                                        }
                                                                                        onChange={(e) =>
                                                                                            setLineReason(
                                                                                                (prev) => ({
                                                                                                    ...prev,
                                                                                                    [String(
                                                                                                        item.id,
                                                                                                    )]:
                                                                                                        e
                                                                                                            .target
                                                                                                            .value,
                                                                                                }),
                                                                                            )
                                                                                        }
                                                                                        placeholder="Optional reason"
                                                                                        disabled={saving}
                                                                                    />
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    },
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )
                                            ) : !selectedSupplier ? (
                                                <div className="dn-empty">
                                                    <Building2 size={36} strokeWidth={1.25} />
                                                    <p className="dn-empty__title">Select a supplier</p>
                                                    <p className="dn-empty__text">
                                                        Choose a supplier above, then link an invoice or
                                                        add return lines manually.
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="dn-lines-scroll">
                                                        <table className="dn-lines-table">
                                                            <thead>
                                                                <tr>
                                                                    <th className="dn-th-item">Product</th>
                                                                    <th className="dn-th-uom">UOM</th>
                                                                    <th className="dn-th-return-qty">Return qty</th>
                                                                    <th className="dn-th-price">Unit price</th>
                                                                    <th className="dn-th-total">Total</th>
                                                                    <th className="dn-th-reason">Reason</th>
                                                                    <th className="dn-th-action" aria-label="Remove" />
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {manualLines.map((line, idx) => {
                                                                    const qty = Number(line.qty || 0);
                                                                    const unit = Number(
                                                                        line.unitPrice || 0,
                                                                    );
                                                                    const lineTotal =
                                                                        qty > 0 && unit >= 0
                                                                            ? qty * unit
                                                                            : 0;
                                                                    const hasQty =
                                                                        line.productId && qty > 0;
                                                                    const lineCaps = capsForManualLine(line);
                                                                    const uomHint = formatWorkshopPurchaseLineUomHint(
                                                                        { ...line, qty },
                                                                        lineCaps,
                                                                    );
                                                                    return (
                                                                        <tr
                                                                            key={line.id}
                                                                            className={
                                                                                hasQty
                                                                                    ? 'dn-line-row dn-line-row--active'
                                                                                    : 'dn-line-row'
                                                                            }
                                                                        >
                                                                            <td className="dn-td-item">
                                                                                <span className="dn-line-index">
                                                                                    {idx + 1}
                                                                                </span>
                                                                                <SearchableEntityCombobox
                                                                                    className="dn-combobox dn-combobox--inline"
                                                                                    menuMinWidth={360}
                                                                                    options={
                                                                                        productComboboxOptions
                                                                                    }
                                                                                    value={line.productId}
                                                                                    displayText={
                                                                                        line.productSearch
                                                                                    }
                                                                                    entityLabel="product"
                                                                                    loading={
                                                                                        productsLoading
                                                                                    }
                                                                                    placeholder={
                                                                                        effectiveBranchId
                                                                                            ? 'Search product…'
                                                                                            : 'Select branch first'
                                                                                    }
                                                                                    emptyHint={
                                                                                        productsLoading
                                                                                            ? 'Loading products…'
                                                                                            : productsLoadError ||
                                                                                              (productComboboxOptions.length ===
                                                                                              0
                                                                                                  ? 'No products in branch catalog'
                                                                                                  : 'No matches')
                                                                                    }
                                                                                    disabled={
                                                                                        saving ||
                                                                                        !effectiveBranchId ||
                                                                                        productsLoading
                                                                                    }
                                                                                    onDisplayTextChange={(
                                                                                        text,
                                                                                    ) => {
                                                                                        updateManualLine(
                                                                                            line.id,
                                                                                            {
                                                                                                productSearch:
                                                                                                    text,
                                                                                            },
                                                                                        );
                                                                                        if (!text.trim()) {
                                                                                            updateManualLine(
                                                                                                line.id,
                                                                                                {
                                                                                                    productId:
                                                                                                        '',
                                                                                                    productLabel:
                                                                                                        '',
                                                                                                    unitPrice:
                                                                                                        '',
                                                                                                },
                                                                                            );
                                                                                        } else if (
                                                                                            line.productId &&
                                                                                            text.trim() !==
                                                                                                line.productLabel.trim()
                                                                                        ) {
                                                                                            updateManualLine(
                                                                                                line.id,
                                                                                                {
                                                                                                    productId:
                                                                                                        '',
                                                                                                    productLabel:
                                                                                                        '',
                                                                                                },
                                                                                            );
                                                                                        }
                                                                                    }}
                                                                                    onSelect={(opt) =>
                                                                                        handleManualProductSelect(
                                                                                            line.id,
                                                                                            opt,
                                                                                        )
                                                                                    }
                                                                                />
                                                                            </td>
                                                                            <td className="dn-td-uom">
                                                                                <div className="dn-uom-cell">
                                                                                {line.productId &&
                                                                                (lineCaps || workshopUomProfiles.length > 0) ? (
                                                                                    <>
                                                                                        <WorkshopUomSelect
                                                                                            variant="invoice-line"
                                                                                            className="dn-input dn-uom-select"
                                                                                            line={line}
                                                                                            capsRow={lineCaps}
                                                                                            profiles={workshopUomProfiles}
                                                                                            disabled={saving}
                                                                                            onChange={(parsed) =>
                                                                                                updateManualLineUom(
                                                                                                    line.id,
                                                                                                    parsed,
                                                                                                )
                                                                                            }
                                                                                        />
                                                                                        {uomHint ? (
                                                                                            <span
                                                                                                className="dn-uom-hint"
                                                                                                title={uomHint}
                                                                                            >
                                                                                                {uomHint}
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </>
                                                                                ) : (
                                                                                    <span className="dn-td-muted">
                                                                                        {line.uom || '—'}
                                                                                    </span>
                                                                                )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="dn-td-num dn-return-qty-cell">
                                                                                <div className="dn-qty-with-uom">
                                                                                    <input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        step="0.001"
                                                                                        className="dn-input dn-input--qty"
                                                                                        value={line.qty}
                                                                                        onChange={(e) =>
                                                                                            updateManualLine(
                                                                                                line.id,
                                                                                                {
                                                                                                    qty: e.target
                                                                                                        .value,
                                                                                                },
                                                                                            )
                                                                                        }
                                                                                        disabled={saving}
                                                                                        aria-label={`Return qty (${line.uom || 'unit'})`}
                                                                                    />
                                                                                    <span className="dn-qty-uom">
                                                                                        {line.uom || 'unit'}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="dn-td-num">
                                                                                <div className="dn-price-cell">
                                                                                    <input
                                                                                        type="number"
                                                                                        min="0"
                                                                                        step="0.01"
                                                                                        className="dn-input dn-input--qty"
                                                                                        value={
                                                                                            line.unitPrice
                                                                                        }
                                                                                        onChange={(e) =>
                                                                                            updateManualLine(
                                                                                                line.id,
                                                                                                {
                                                                                                    unitPrice:
                                                                                                        e
                                                                                                            .target
                                                                                                            .value,
                                                                                                },
                                                                                            )
                                                                                        }
                                                                                        disabled={saving}
                                                                                    />
                                                                                    <span className="dn-currency">
                                                                                        SAR
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="dn-td-num dn-td-total">
                                                                                {hasQty
                                                                                    ? sarFmt(lineTotal)
                                                                                    : '—'}
                                                                            </td>
                                                                            <td className="dn-td-reason">
                                                                                <input
                                                                                    type="text"
                                                                                    className="dn-input"
                                                                                    value={line.reason}
                                                                                    onChange={(e) =>
                                                                                        updateManualLine(
                                                                                            line.id,
                                                                                            {
                                                                                                reason: e
                                                                                                    .target
                                                                                                    .value,
                                                                                            },
                                                                                        )
                                                                                    }
                                                                                    placeholder="Optional"
                                                                                    disabled={saving}
                                                                                />
                                                                            </td>
                                                                            <td className="dn-td-action">
                                                                                <button
                                                                                    type="button"
                                                                                    className="dn-line-remove"
                                                                                    onClick={() =>
                                                                                        removeManualLine(
                                                                                            line.id,
                                                                                        )
                                                                                    }
                                                                                    disabled={saving}
                                                                                    aria-label="Remove line"
                                                                                >
                                                                                    <Trash2 size={16} />
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="dn-lines-footer">
                                                        <button
                                                            type="button"
                                                            className="dn-add-line"
                                                            onClick={addManualLine}
                                                            disabled={saving || !selectedSupplier}
                                                        >
                                                            <Plus size={16} />
                                                            Add another line
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="dn-summary">
                                            <span className="dn-summary__label">Estimated return total</span>
                                            <span className="dn-summary__amount">
                                                SAR {sarFmt(estimatedTotal)}
                                            </span>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}
                    </form>
                </InlineFormScreen>
            ) : null}

            {viewReturnId ? (
                <InlineFormScreen
                    title={
                        <div className="pi-modal-title">
                            <span className="pi-breadcrumb">
                                Debit Notes ›{' '}
                                <span className="pi-b-active">
                                    {viewReturnDetail?.returnNumber || 'View'}
                                </span>
                            </span>
                            <div className="pi-title-main">
                                <RotateCcw size={24} />
                                <span>Debit Note</span>
                            </div>
                        </div>
                    }
                    onBack={closeView}
                    backLabel="Back to list"
                    bodyClassName="supplier-affiliated-return-form-body"
                >
                    {viewReturnLoading ? (
                        <ShimmerTextBlock lines={12} />
                    ) : viewReturnDetail ? (
                        <WorkshopPurchaseReturnDetailView
                            detail={viewReturnDetail}
                            currency={viewReturnDetail.workshop?.currencyCode || 'SAR'}
                            variant="workshop"
                            compact
                        />
                    ) : (
                        <p style={{ color: '#64748B' }}>Could not load debit note.</p>
                    )}
                </InlineFormScreen>
            ) : null}
        </div>
    );
}
