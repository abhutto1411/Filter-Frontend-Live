import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CheckCircle2,
    Circle,
    Package,
    Plus,
    Search,
    Send,
    ShoppingCart,
    Truck,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { UNIT_OPTIONS } from '../workshop/constants';
import {
    bulkAddMasterProductsToInventory,
    createSupplierProductRequest,
    getSupplierLocations,
    listSupplierMasterCatalogProducts,
    listSupplierProductRequests,
    fetchAllSupplierProducts,
} from '../../services/supplierApi';
import { ShimmerCatalogGrid } from '../../components/supplier/Shimmer';
import { formatUomRule } from '../workshop/workshopUomUtils';
import { scatT } from '../../utils/supplierCatalogI18n';

// ─── Previously: supplier-owned CRUD listing — replaced by Super Admin master list ─────

const PAGE_SIZE = 24;

const WAREHOUSE_UNIT_PRESETS = ['Box', 'Carton', 'Dozen', 'Pack', 'Drum', 'Bag'];
const WORKSHOP_UNIT_PRESETS = ['pcs', 'Liter', 'kg', 'ml', 'Set', 'piece'];

/** Same product list payload as Admin `InventoryPage` / `MasterCatalog` exposed via supplier API. */
function unwrapProducts(res) {
    if (Array.isArray(res)) return res;
    if (res?.products && Array.isArray(res.products)) return res.products;
    return [];
}

/** Map master product → supplier card row (aligned with Master Catalog grid fields). */
function mapMasterCatalogRow(p, t) {
    const brandName = (p.brandName || p.supplierName || '').trim() || t('emdash');
    const sku = (p.sku || '').trim();
    const descParts = [sku ? t('sku.prefix', { sku }) : null, (p.description || '').trim()].filter(Boolean);
    return {
        id: p.id,
        product_name: p.name || '',
        category: p.categoryName || '',
        supplier_id: brandName,
        supplier_name: brandName,
        sale_price: Number(p.salePrice ?? p.sellingPrice ?? 0),
        unit: (p.unit || 'pcs').trim() || 'pcs',
        min_order_qty: 1,
        stock_qty: Number(p.currentStock ?? p.stockQty ?? p.quantityOnHand ?? p.stock ?? 0),
        description: descParts.join(' · '),
        isActive: p.isActive !== false,
        _approval: p.isActive === false ? 'rejected' : 'approved',
    };
}

/**
 * Lists the same approved master products shown in Super Admin → Inventory → Master Catalog,
 * but through supplier endpoint (`/supplier/products/master-catalog`).
 */
export default function SupplierCatalog({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => scatT(locale, key, vars), [locale]);

    const branchLabel = t('branch.all');
    const zoneName = t('zone.central');

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchRef = useRef();
    useEffect(() => {
        clearTimeout(searchRef.current);
        searchRef.current = setTimeout(() => setDebouncedSearch(search.trim()), 350);
        return () => clearTimeout(searchRef.current);
    }, [search]);

    const [categoryRows, setCategoryRows] = useState([]);

    const [selectedCategoryId, setSelectedCategoryId] = useState('all');
    const [selectedBrand, setSelectedBrand] = useState('all');
    const [page, setPage] = useState(1);

    /** Raw rows from supplier endpoint backed by master catalog products. */
    const [masterProducts, setMasterProducts] = useState([]);
    /** True until master catalog fetch settles — avoids empty-state flash. */
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');

    const [showRequestForm, setShowRequestForm] = useState(false);
    const [orderItem, setOrderItem] = useState(null);
    const [orderSupplier, setOrderSupplier] = useState(null);
    const [selectedProductIds, setSelectedProductIds] = useState(new Set());
    const [addInventoryOpen, setAddInventoryOpen] = useState(false);
    const [locationOptions, setLocationOptions] = useState([]);
    const [autoLocationId, setAutoLocationId] = useState('');
    const [inventoryQtyForm, setInventoryQtyForm] = useState({});
    const [inventorySaving, setInventorySaving] = useState(false);
    const [inventoryError, setInventoryError] = useState('');
    const [inventorySuccess, setInventorySuccess] = useState('');
    const [existingSupplierProducts, setExistingSupplierProducts] = useState([]);
    const [requests, setRequests] = useState([]);
    /** `browse` = master catalog grid; `requests` = My Product Requests list */
    const [catalogTab, setCatalogTab] = useState('browse');
    /** Master catalog sub-tabs: already in my stock inventory vs not yet added */
    const [masterFilterTab, setMasterFilterTab] = useState('not_added');
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState('');
    const [requestSubmitting, setRequestSubmitting] = useState(false);
    const [requestError, setRequestError] = useState('');
    const [reqForm, setReqForm] = useState({
        product_name: '',
        sku: '',
        brand_name: '',
        description: '',
        arabic_name: '',
        category: '',
        category_id: '',
        department_id: '',
        branch_id: '',
        unit: 'piece',
        quantity_needed: 1,
        target_price: '',
        notes: '',
    });

    const loadMasterCatalog = useCallback((signal) => {
        setLoading(true);
        setApiError('');
        listSupplierMasterCatalogProducts({ signal })
            .then((productsRes) => {
                const raw = unwrapProducts(productsRes);
                setMasterProducts(raw);

                const catMap = new Map();
                raw.forEach((p) => {
                    if (!p?.categoryId || !p?.categoryName) return;
                    catMap.set(String(p.categoryId), p.categoryName);
                });
                setCategoryRows(
                    [...catMap.entries()].map(([id, name]) => ({ id, name })),
                );
            })
            .catch((err) => {
                if (err.name === 'AbortError') return;
                setApiError(err.message || t('err.loadCatalog'));
                setMasterProducts([]);
                setCategoryRows([]);
            })
            .finally(() => {
                if (signal.aborted) return;
                setLoading(false);
            });
    }, [t]);

    const loadMyInventoryProducts = useCallback(async () => {
        try {
            const existingRes = await fetchAllSupplierProducts({ status: 'all', pageSize: 2000 });
            const existing = Array.isArray(existingRes) ? existingRes : [];
            setExistingSupplierProducts(existing);
        } catch {
            setExistingSupplierProducts([]);
        }
    }, []);

    useEffect(() => {
        const ctrl = new AbortController();
        loadMasterCatalog(ctrl.signal);
        return () => ctrl.abort();
    }, [loadMasterCatalog]);

    useEffect(() => {
        loadMyInventoryProducts();
    }, [loadMyInventoryProducts]);

    useEffect(() => {
        let cancelled = false;
        listSupplierProductRequests({ limit: 100 })
            .then((res) => {
                if (cancelled) return;
                const rows = Array.isArray(res?.items) ? res.items : [];
                setRequests(
                    rows.map((r) => ({
                        id: r.id,
                        product_name: r.name,
                        quantity_needed: '-',
                        unit: '-',
                        status: r.status || 'pending',
                    })),
                );
            })
            .catch(() => {
                if (!cancelled) setRequests([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, selectedCategoryId, selectedBrand]);

    const brandDropdownSource = useMemo(() => {
        const names = [
            ...new Set(masterProducts.map((p) => (p.brandName || '').trim()).filter(Boolean)),
        ].sort((a, b) => a.localeCompare(b));
        return names.map((name) => ({ id: name, name }));
    }, [masterProducts]);

    const departmentOptions = useMemo(() => {
        const map = new Map();
        masterProducts.forEach((p) => {
            if (!p?.departmentId || !p?.departmentName) return;
            map.set(String(p.departmentId), p.departmentName);
        });
        return [...map.entries()].map(([id, name]) => ({ id, name }));
    }, [masterProducts]);

    const myInventoryKeyset = useMemo(() => {
        const byMasterId = new Set();
        (existingSupplierProducts || []).forEach((p) => {
            const masterId = String(p?.masterProductId || '').trim();
            if (masterId) byMasterId.add(masterId);
        });
        return { byMasterId };
    }, [existingSupplierProducts]);

    const isAlreadyAdded = useCallback(
        (p) => {
            const masterId = String(p?.id || '').trim();
            return !!masterId && myInventoryKeyset.byMasterId.has(masterId);
        },
        [myInventoryKeyset],
    );

    const filteredRaw = useMemo(() => {
        const q = debouncedSearch.toLowerCase().trim();
        return masterProducts.filter((p) => {
            const added = isAlreadyAdded(p);
            if (masterFilterTab === 'already_added' && !added) return false;
            if (masterFilterTab === 'not_added' && added) return false;
            const matchesCategory =
                selectedCategoryId === 'all' || String(p.categoryId) === String(selectedCategoryId);
            const matchesBrand =
                selectedBrand === 'all' || String((p.brandName || '').trim()) === selectedBrand;

            let matchesSearch = true;
            if (q) {
                matchesSearch = [
                    p.name,
                    p.arabicName,
                    p.sku,
                    p.brandName,
                    p.categoryName,
                ].some((v) => (v || '').toLowerCase().includes(q));
            }
            return matchesSearch && matchesCategory && matchesBrand;
        });
    }, [
        masterProducts,
        debouncedSearch,
        selectedCategoryId,
        selectedBrand,
        masterFilterTab,
        isAlreadyAdded,
    ]);

    const cardRows = useMemo(
        () => filteredRaw.map((p) => mapMasterCatalogRow(p, t)),
        [filteredRaw, t],
    );

    const brandCountForHeader = brandDropdownSource.length || 0;

    const pagedRows = useMemo(
        () => cardRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [cardRows, page],
    );

    const totalPages = Math.max(1, Math.ceil(cardRows.length / PAGE_SIZE));

    const getBrandRow = (id) =>
        brandDropdownSource.find((b) => String(b.id) === String(id));

    const selectedMasterProducts = useMemo(
        () => masterProducts.filter((p) => selectedProductIds.has(String(p.id))),
        [masterProducts, selectedProductIds],
    );

    useEffect(() => {
        const maxP = Math.max(1, Math.ceil(cardRows.length / PAGE_SIZE));
        setPage((p) => (p > maxP ? maxP : p));
    }, [cardRows.length]);

    const handlePlaceOrder = () => {
        if (orderItem) {
            alert(
                t('order.alert', {
                    product: orderItem.product_name,
                    supplier: orderSupplier?.name,
                }),
            );
            setOrderItem(null);
            setOrderSupplier(null);
        }
    };
    const handleRequestProduct = async () => {
        if (!reqForm.product_name?.trim()) {
            setRequestError(t('err.nameRequired'));
            return;
        }
        setRequestSubmitting(true);
        setRequestError('');
        const form = {
            ...reqForm,
            product_name: reqForm.product_name || t('fallback.newProduct'),
            quantity_needed: reqForm.quantity_needed || 1,
            unit: reqForm.unit || 'piece',
            status: 'pending',
        };
        try {
            const res = await createSupplierProductRequest({
                name: form.product_name,
                sku: form.sku || undefined,
                brandName: form.brand_name || undefined,
                description: form.description || undefined,
                arabicName: form.arabic_name || undefined,
                unit: form.unit || 'pcs',
                expectedPrice: form.target_price ? Number(form.target_price) : undefined,
                quantityNeeded: Number(form.quantity_needed) || 0,
                categoryLabel: form.category || undefined,
                branchId: form.branch_id || undefined,
                departmentId: form.department_id || undefined,
                categoryId: form.category_id || undefined,
                notes: form.notes || undefined,
            });
            const requestId = res?.request?.id || Date.now();
            setRequests((prev) => [
                { id: requestId, ...form },
                ...prev,
            ]);
            setCatalogTab('requests');
            setShowRequestForm(false);
            setReqForm({
                product_name: '',
                sku: '',
                brand_name: '',
                description: '',
                arabic_name: '',
                category: '',
                category_id: '',
                department_id: '',
                branch_id: '',
                unit: 'piece',
                quantity_needed: 1,
                target_price: '',
                notes: '',
            });
        } catch (err) {
            setRequestError(err?.message || t('err.submit'));
        } finally {
            setRequestSubmitting(false);
        }
    };

    const toggleSelectProduct = (productId) => {
        const id = String(productId);
        const master = masterProducts.find((p) => String(p.id) === id);
        if (master?.isActive === false) return;
        setSelectedProductIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    /** All products matching current filters (all pages — same set as shown in “N products”). */
    const selectAllFiltered = () => {
        setSelectedProductIds(
            new Set(
                filteredRaw
                    .filter((p) => p.isActive !== false)
                    .map((p) => String(p?.id ?? ''))
                    .filter(Boolean),
            ),
        );
    };

    const clearProductSelection = () => {
        setSelectedProductIds(new Set());
    };

    const filteredIdsSelectedCount = useMemo(() => {
        let n = 0;
        filteredRaw.forEach((p) => {
            const id = String(p?.id ?? '');
            if (id && selectedProductIds.has(id)) n += 1;
        });
        return n;
    }, [filteredRaw, selectedProductIds]);

    const allFilteredSelected =
        filteredRaw.length > 0 && filteredIdsSelectedCount === filteredRaw.length;

    const openAddToInventoryModal = async () => {
        if (selectedProductIds.size === 0) return;
        setInventoryError('');
        setInventorySuccess('');
        let locations = [];
        let existing = [];
        try {
            const locRes = await getSupplierLocations();
            locations = Array.isArray(locRes?.locations)
                ? locRes.locations
                : Array.isArray(locRes)
                  ? locRes
                  : [];
        } catch {
            locations = [];
        }
        try {
            const existingRes = await fetchAllSupplierProducts({ status: 'all', pageSize: 2000 });
            existing = Array.isArray(existingRes) ? existingRes : [];
        } catch {
            existing = [];
        }
        setLocationOptions(locations);
        setExistingSupplierProducts(existing);
        setAutoLocationId(String(locations?.[0]?.id || ''));

        const defaults = {};
        selectedMasterProducts.forEach((p) => {
            const id = String(p.id);
            const masterId = String(p.id);
            const existingProduct =
                existing.find(
                    (ep) =>
                        String(ep.masterProductId || '') === masterId ||
                        String(ep.sku || '').trim().toLowerCase() ===
                            String(p.sku || '').trim().toLowerCase() ||
                        String(ep.name || ep.productName || '')
                            .trim()
                            .toLowerCase() === String(p.name || '').trim().toLowerCase(),
                ) ?? null;
            defaults[id] = {
                openingQty: '0',
                stockQty: '0',
                criticalStockLevel: '',
            };
        });
        setInventoryQtyForm(defaults);
        setAddInventoryOpen(true);
    };

    const updateInventoryQty = (productId, key, value) => {
        const id = String(productId);
        setInventoryQtyForm((prev) => ({
            ...prev,
            [id]: {
                openingQty: prev[id]?.openingQty ?? '0',
                stockQty: prev[id]?.stockQty ?? '0',
                criticalStockLevel: prev[id]?.criticalStockLevel ?? '',
                [key]: value,
            },
        }));
    };

    const handleAddSelectedToInventory = async () => {
        setInventorySaving(true);
        setInventoryError('');
        setInventorySuccess('');

        try {
            const items = selectedMasterProducts.map((master) => {
                const id = String(master.id);
                const row = inventoryQtyForm[id] || {
                    openingQty: '0',
                    stockQty: '0',
                    criticalStockLevel: '',
                };
                const openingQty = Math.max(0, Number(row.openingQty || 0));
                const stockQty = Math.max(0, Number(row.stockQty || 0));
                const payload = {
                    masterProductId: id,
                    openingQty: Number.isFinite(openingQty) ? openingQty : 0,
                    stockQty: Number.isFinite(stockQty) ? stockQty : 0,
                };
                const critRaw = row.criticalStockLevel;
                if (
                    critRaw !== '' &&
                    critRaw !== undefined &&
                    critRaw !== null
                ) {
                    const n = Number(critRaw);
                    if (Number.isFinite(n) && n >= 0) {
                        payload.criticalStockLevel = n;
                    }
                }
                return payload;
            });

            const result = await bulkAddMasterProductsToInventory({
                ...(autoLocationId
                    ? { supplierLocationId: String(autoLocationId) }
                    : {}),
                items,
            });

            const created = Number(result?.created ?? 0);
            const already = Number(result?.alreadyInInventory ?? 0);
            const skipped = Array.isArray(result?.skippedMasterProductIds)
                ? result.skippedMasterProductIds.length
                : 0;
            const parts = [];
            if (created > 0) parts.push(t('inv.added', { n: created }));
            if (already > 0) parts.push(t('inv.already', { n: already }));
            if (skipped > 0) parts.push(t('inv.skipped', { n: skipped }));
            setInventorySuccess(
                parts.length > 0
                    ? t('inv.success', { parts: parts.join(', ') })
                    : result?.message ||
                          t('inv.processed', { n: selectedMasterProducts.length }),
            );
            setAddInventoryOpen(false);
            setSelectedProductIds(new Set());
            await loadMyInventoryProducts();
        } catch (err) {
            setInventoryError(err?.message || t('err.addInventory'));
        } finally {
            setInventorySaving(false);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">
                        {t('page.sub', {
                            branch: branchLabel,
                            zone: zoneName,
                            brands: brandCountForHeader,
                            products: cardRows.length,
                        })}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        className="btn-portal-outline"
                        type="button"
                        onClick={async () => {
                            setSyncing(true);
                            setSyncMsg('');
                            try {
                                const ctrl = new AbortController();
                                loadMasterCatalog(ctrl.signal);
                                await loadMyInventoryProducts();
                                setSyncMsg(t('msg.synced'));
                                setTimeout(() => setSyncMsg(''), 2500);
                            } catch (e) {
                                setSyncMsg(e?.message || t('msg.syncFailed'));
                                setTimeout(() => setSyncMsg(''), 3500);
                            } finally {
                                setSyncing(false);
                            }
                        }}
                        disabled={syncing}
                        title={t('btn.syncTitle')}
                    >
                        {syncing ? t('btn.syncing') : t('btn.sync')}
                    </button>
                    <button
                        className="btn-portal-outline"
                        type="button"
                        onClick={openAddToInventoryModal}
                        disabled={selectedProductIds.size === 0}
                    >
                        <Plus size={15} /> {t('btn.addToInventory')}
                        {selectedProductIds.size > 0 ? ` (${selectedProductIds.size})` : ''}
                    </button>
                    <button className="btn-portal" onClick={() => setShowRequestForm(true)}>
                        <Plus size={15} /> {t('btn.requestNew')}
                    </button>
                </div>
            </div>
            {syncMsg ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 12,
                        padding: 12,
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        borderRadius: 12,
                        color: '#1D4ED8',
                        fontSize: '0.875rem',
                    }}
                >
                    {syncMsg}
                </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div role="tablist" aria-label={t('tab.ariaSections')} className="theme-segmented">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={catalogTab === 'browse'}
                        id="catalog-tab-browse"
                        onClick={() => setCatalogTab('browse')}
                        className={`theme-segmented__btn${
                            catalogTab === 'browse' ? ' theme-segmented__btn--active' : ''
                        }`}
                    >
                        {t('tab.browse')}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={catalogTab === 'requests'}
                        id="catalog-tab-requests"
                        onClick={() => setCatalogTab('requests')}
                        className={`theme-segmented__btn${
                            catalogTab === 'requests' ? ' theme-segmented__btn--active' : ''
                        }`}
                    >
                        {t('tab.requests')}
                        {requests.length > 0 ? ` (${requests.length})` : ''}
                    </button>
                </div>

                {catalogTab === 'browse' ? (
                    <div role="tablist" aria-label={t('filter.aria')} className="theme-segmented">
                        <button
                            type="button"
                            className={`theme-segmented__btn${
                                masterFilterTab === 'not_added' ? ' theme-segmented__btn--active' : ''
                            }`}
                            onClick={() => setMasterFilterTab('not_added')}
                        >
                            {t('filter.notAdded')}
                        </button>
                        <button
                            type="button"
                            className={`theme-segmented__btn${
                                masterFilterTab === 'already_added' ? ' theme-segmented__btn--active' : ''
                            }`}
                            onClick={() => setMasterFilterTab('already_added')}
                        >
                            {t('filter.alreadyAdded')}
                        </button>
                    </div>
                ) : null}
            </div>

            {inventorySuccess ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 12,
                        padding: 10,
                        fontSize: '0.8125rem',
                        color: '#047857',
                        border: '1px solid #A7F3D0',
                        background: '#ECFDF5',
                    }}
                >
                    {inventorySuccess}
                </div>
            ) : null}

            {apiError ? (
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
                    {apiError}{' '}
                    <span style={{ color: '#64748B' }}>
                        {t('err.loadCatalogHint')}
                    </span>
                </div>
            ) : null}

            {catalogTab === 'browse' ? (
                <>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search
                        size={16}
                        aria-hidden
                        style={{
                            position: 'absolute',
                            left: 12,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--color-text-muted)',
                            pointerEvents: 'none',
                            zIndex: 1,
                        }}
                    />
                    <input
                        type="text"
                        placeholder={t('search.placeholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '10px 12px 10px 44px',
                            borderRadius: 10,
                            border: '1px solid var(--color-border)',
                            fontSize: '0.875rem',
                            outline: 'none',
                        }}
                    />
                </div>
                <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    disabled={loading}
                    style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--color-border)',
                        fontSize: '0.875rem',
                        minWidth: 160,
                    }}
                >
                    <option value="all">{t('filter.allCategories')}</option>
                    {categoryRows.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--color-border)',
                        fontSize: '0.875rem',
                        minWidth: 180,
                    }}
                >
                    <option value="all">{t('filter.allBrands')}</option>
                    {brandDropdownSource.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.name}
                        </option>
                    ))}
                </select>
                    </div>

                    {!loading && !apiError && cardRows.length > 0 ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap',
                        marginBottom: 14,
                        padding: '10px 12px',
                        background: '#F8FAFC',
                        borderRadius: 10,
                        border: '1px solid var(--color-border-light, #e2e8f0)',
                    }}
                >
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={filteredRaw.length === 0}
                        onClick={
                            allFilteredSelected ? clearProductSelection : selectAllFiltered
                        }
                    >
                        {allFilteredSelected ? t('select.deselect') : t('select.all')}
                        {filteredRaw.length > 0 ? ` (${filteredRaw.length})` : ''}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={selectedProductIds.size === 0}
                        onClick={clearProductSelection}
                    >
                        {t('select.clear')}
                        {selectedProductIds.size > 0 ? ` (${selectedProductIds.size})` : ''}
                    </button>
                    <span
                        style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            marginLeft: 'auto',
                        }}
                    >
                        {t('select.hint')}
                    </span>
                </div>
            ) : null}

            {loading ? (
                <div className="ws-section" style={{ padding: 20 }}>
                    <ShimmerCatalogGrid cards={8} />
                </div>
            ) : apiError ? (
                <div
                    className="ws-section"
                    style={{
                        textAlign: 'center',
                        padding: 48,
                        color: 'var(--color-text-muted)',
                        borderStyle: 'dashed',
                        borderColor: 'var(--color-border)',
                    }}
                >
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-dark)' }}>
                        {t('load.unable')}
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '0.8125rem' }}>
                        {t('load.fixHint')}
                    </p>
                </div>
            ) : cardRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
                    <Package size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>{t('empty.title')}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
                        {t('empty.hint')}
                    </p>
                </div>
            ) : (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: 16,
                    }}
                >
                    {pagedRows.map((item) => {
                        const sup = getBrandRow(item.supplier_id);
                        const inStock = (item.stock_qty || 0) > 0;
                        const isSelected = selectedProductIds.has(String(item.id));
                        const masterProduct = masterProducts.find(
                            (p) => String(p.id) === String(item.id),
                        );
                        const added = masterProduct ? isAlreadyAdded(masterProduct) : false;
                        const masterInactive = masterProduct?.isActive === false || item.isActive === false;
                        let supplierWhQty = 0;
                        let supplierProductInactive = false;
                        if (added && masterProduct) {
                            const sp = existingSupplierProducts.find(
                                (p) =>
                                    String(p.masterProductId || '') ===
                                    String(masterProduct.id),
                            );
                            supplierProductInactive = sp?.isActive === false;
                            supplierWhQty = Number(
                                sp?.warehouseQty ?? sp?.qty ?? sp?.currentQuantity ?? 0,
                            );
                        }
                        const showInactive = masterInactive || supplierProductInactive;
                        return (
                            <div
                                key={item.id}
                                style={{
                                    background: isSelected
                                        ? 'linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 40%)'
                                        : '#fff',
                                    border: isSelected
                                        ? '1px solid rgba(245, 158, 11, 0.55)'
                                        : '1px solid var(--color-border)',
                                    borderRadius: 12,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isSelected
                                        ? '0 6px 16px rgba(245, 158, 11, 0.14)'
                                        : '0 2px 6px rgba(15, 23, 42, 0.04)',
                                    cursor: showInactive ? 'default' : 'pointer',
                                    opacity: showInactive ? 0.72 : 1,
                                }}
                                className="ws-section"
                                onClick={() => !showInactive && toggleSelectProduct(item.id)}
                            >
                                <div
                                    style={{
                                        padding: '8px 10px',
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 4,
                                        minHeight: 0,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            gap: 8,
                                        }}
                                    >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <p
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: '0.8125rem',
                                                    color: 'var(--color-text-dark)',
                                                    margin: 0,
                                                    lineHeight: 1.25,
                                                }}
                                            >
                                                {item.product_name}
                                            </p>
                                            {isSelected ? (
                                                <div
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        marginTop: 4,
                                                        fontSize: '0.625rem',
                                                        fontWeight: 700,
                                                        color: '#92400E',
                                                    }}
                                                >
                                                    <CheckCircle2 size={11} />
                                                    {t('card.ready')}
                                                </div>
                                            ) : null}
                                            {item.category ? (
                                                <span
                                                    className="ws-badge ws-badge--gray"
                                                    style={{
                                                        marginTop: 4,
                                                        display: 'inline-block',
                                                        fontSize: '0.625rem',
                                                        padding: '2px 6px',
                                                    }}
                                                >
                                                    {item.category}
                                                </span>
                                            ) : null}
                                            {showInactive ? (
                                                <span
                                                    className="ws-badge ws-badge--gray"
                                                    style={{
                                                        marginTop: 4,
                                                        marginLeft: item.category ? 4 : 0,
                                                        display: 'inline-block',
                                                        fontSize: '0.625rem',
                                                        padding: '2px 6px',
                                                    }}
                                                >
                                                    {t('card.inactive')}
                                                </span>
                                            ) : null}
                                            <p
                                                style={{
                                                    fontSize: '0.6875rem',
                                                    color: 'var(--color-text-muted)',
                                                    margin: '4px 0 0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                    lineHeight: 1.25,
                                                }}
                                            >
                                                <Truck size={11} aria-hidden />
                                                {sup?.name || item.supplier_name}
                                            </p>
                                            {item.description ? (
                                                <p
                                                    style={{
                                                        fontSize: '0.6875rem',
                                                        color: 'var(--color-text-muted)',
                                                        margin: '2px 0 0',
                                                        lineHeight: 1.3,
                                                    }}
                                                >
                                                    {item.description}
                                                </p>
                                            ) : null}
                                        </div>
                                        <label
                                            style={{
                                                display: showInactive ? 'none' : 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                fontSize: '0.625rem',
                                                fontWeight: 700,
                                                color: isSelected ? '#B45309' : 'var(--color-text-muted)',
                                                background: isSelected ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                                                border: isSelected
                                                    ? '1px solid rgba(245, 158, 11, 0.35)'
                                                    : '1px solid var(--color-border-light)',
                                                borderRadius: 999,
                                                padding: '2px 6px',
                                                cursor: 'pointer',
                                                flexShrink: 0,
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {isSelected ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                                            {isSelected ? t('card.selected') : t('card.select')}
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectProduct(item.id)}
                                                aria-label={t('card.selectAria', { name: item.product_name })}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        padding: '6px 10px',
                                        borderTop: '1px solid var(--color-border-light)',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 8,
                                        }}
                                    >
                                        <span
                                            className={`ws-badge ${inStock ? 'ws-badge--green' : added ? 'ws-badge--gray' : 'ws-badge--red'}`}
                                            style={{
                                                fontSize: '0.625rem',
                                                padding: '2px 6px',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {added
                                                ? supplierWhQty > 0
                                                    ? t('card.inYourStock', { qty: supplierWhQty })
                                                    : t('card.inCatalogZero')
                                                : inStock
                                                  ? t('card.inStock', { qty: item.stock_qty })
                                                  : t('card.out')}
                                        </span>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ fontSize: '0.9375rem', fontWeight: 900, margin: 0, lineHeight: 1.2 }}>
                                                {t('money.sar', {
                                                    amount: (item.sale_price || 0).toLocaleString(),
                                                })}
                                            </p>
                                            <p
                                                style={{
                                                    fontSize: '0.625rem',
                                                    color: 'var(--color-text-muted)',
                                                    margin: '1px 0 0',
                                                    lineHeight: 1.2,
                                                }}
                                            >
                                                {t('card.perMin', {
                                                    unit: item.unit,
                                                    min: item.min_order_qty || 1,
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && totalPages > 1 ? (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        marginTop: 16,
                    }}
                >
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        {t('page.prev')}
                    </button>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        {t('page.of', {
                            page,
                            total: totalPages,
                            n: cardRows.length,
                        })}
                    </span>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={page >= totalPages || loading}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        {t('page.next')}
                    </button>
                </div>
            ) : null}
                </>
            ) : (
                <div className="ws-section">
                    <div style={{ padding: 16 }}>
                        {requests.length === 0 ? (
                            <div
                                style={{
                                    textAlign: 'center',
                                    padding: '40px 24px',
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                <Send
                                    size={44}
                                    style={{
                                        opacity: 0.35,
                                        margin: '0 auto 14px',
                                        display: 'block',
                                        color: '#2563EB',
                                    }}
                                />
                                <p
                                    style={{
                                        margin: 0,
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        color: 'var(--color-text-dark)',
                                    }}
                                >
                                    {t('req.emptyTitle')}
                                </p>
                                <p
                                    style={{
                                        margin: '10px auto 18px',
                                        fontSize: '0.875rem',
                                        maxWidth: 420,
                                    }}
                                >
                                    {t('req.emptyBody')}
                                </p>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    onClick={() => setShowRequestForm(true)}
                                >
                                    <Plus size={15} /> {t('btn.requestNew')}
                                </button>
                            </div>
                        ) : (
                            <>
                                <h3
                                    style={{
                                        fontSize: '0.9375rem',
                                        fontWeight: 700,
                                        color: 'var(--color-text-dark)',
                                        margin: '0 0 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}
                                >
                                    <Send size={16} style={{ color: '#2563EB' }} /> {t('req.heading')}
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {requests.map((req) => (
                                        <div
                                            key={req.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: 12,
                                                background: 'var(--color-bg-muted)',
                                                borderRadius: 10,
                                            }}
                                        >
                                            <div>
                                                <p style={{ fontWeight: 600, margin: 0 }}>{req.product_name}</p>
                                                <p
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-text-muted)',
                                                        margin: '2px 0 0',
                                                    }}
                                                >
                                                    {t('req.qty', {
                                                        qty: req.quantity_needed,
                                                        unit: req.unit,
                                                    })}
                                                </p>
                                            </div>
                                            <span
                                                className={`ws-badge ${
                                                    req.status === 'pending'
                                                        ? 'ws-badge--yellow'
                                                        : req.status === 'fulfilled'
                                                          ? 'ws-badge--green'
                                                          : 'ws-badge--blue'
                                                }`}
                                            >
                                                {req.status === 'pending'
                                                    ? t('status.pending')
                                                    : req.status === 'fulfilled'
                                                      ? t('status.fulfilled')
                                                      : req.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <AnimatePresence>
                {showRequestForm && (
                    <Modal
                        title={t("form.title")}
                        onClose={() => setShowRequestForm(false)}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowRequestForm(false)}
                                >{t("form.cancel")}</button>
                                <button
                                    className="btn-submit"
                                    onClick={handleRequestProduct}
                                    disabled={requestSubmitting}
                                >
                                    {requestSubmitting ? t("form.submitting") : t("form.submit")}
                                </button>
                            </div>
                        }
                    >
                        {requestError ? (
                            <div style={{ marginBottom: 8, fontSize: '0.8125rem', color: '#B91C1C' }}>
                                {requestError}
                            </div>
                        ) : null}
                        <div className="ws-form-grid">
                            <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                <label>{t("form.productName")}</label>
                                <input
                                    placeholder={t("form.productNamePh")}
                                    value={reqForm.product_name}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, product_name: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t("form.sku")}</label>
                                <input
                                    placeholder={t("form.skuPh")}
                                    value={reqForm.sku}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, sku: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t("form.brand")}</label>
                                <input
                                    placeholder={t("form.brandPh")}
                                    value={reqForm.brand_name}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, brand_name: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                <label>{t("form.desc")}</label>
                                <input
                                    placeholder={t("form.descPh")}
                                    value={reqForm.description}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, description: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t("form.arabic")}</label>
                                <input
                                    placeholder={t("form.arabicPh")}
                                    value={reqForm.arabic_name}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, arabic_name: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t("form.branchId")}</label>
                                <input
                                    placeholder={t("form.branchIdPh")}
                                    value={reqForm.branch_id}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, branch_id: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t("form.department")}</label>
                                <select
                                    value={reqForm.department_id}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, department_id: e.target.value }))
                                    }
                                >
                                    <option value="">{t("form.selectDept")}</option>
                                    {departmentOptions.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>{t("form.category")}</label>
                                <select
                                    value={reqForm.category_id}
                                    onChange={(e) =>
                                        setReqForm((f) => {
                                            const picked = categoryRows.find((c) => String(c.id) === String(e.target.value));
                                            return {
                                                ...f,
                                                category_id: e.target.value,
                                                category: picked?.name || '',
                                            };
                                        })
                                    }
                                >
                                    <option value="">{t("form.selectCat")}</option>
                                    {categoryRows.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>{t("form.unit")}</label>
                                <select
                                    value={reqForm.unit}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, unit: e.target.value }))
                                    }
                                >
                                    <option value="piece">piece</option>
                                    {UNIT_OPTIONS.filter((u) => u !== 'piece').map((u) => (
                                        <option key={u} value={u}>
                                            {u}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>{t("form.qtyNeeded")}</label>
                                <input
                                    type="number"
                                    value={reqForm.quantity_needed}
                                    onChange={(e) =>
                                        setReqForm((f) => ({
                                            ...f,
                                            quantity_needed: Math.max(1, +e.target.value || 1),
                                        }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t("form.targetPrice")}</label>
                                <input
                                    type="number"
                                    placeholder={t("form.optional")}
                                    value={reqForm.target_price}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, target_price: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                <label>{t("form.notes")}</label>
                                <input
                                    placeholder={t("form.notesPh")}
                                    value={reqForm.notes}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, notes: e.target.value }))
                                    }
                                />
                            </div>
                        </div>
                    </Modal>
                )}
                {orderItem && (
                    <Modal
                        title={t("order.title")}
                        onClose={() => {
                            setOrderItem(null);
                            setOrderSupplier(null);
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setOrderItem(null);
                                        setOrderSupplier(null);
                                    }}
                                >{t("form.cancel")}</button>
                                <button className="btn-submit" onClick={handlePlaceOrder}>{t("order.place")}</button>
                            </div>
                        }
                    >
                        <div
                            style={{
                                padding: 12,
                                background: 'var(--color-bg-muted)',
                                borderRadius: 10,
                                marginBottom: 16,
                            }}
                        >
                            <p style={{ fontWeight: 700, margin: 0 }}>{orderItem.product_name}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                                {t("order.supplierLine", {
                                name: orderSupplier?.name,
                                price: t("money.sar", { amount: (orderItem.sale_price || 0).toLocaleString() }),
                                unit: orderItem.unit,
                            })}
                            </p>
                        </div>
                        <div className="ws-form-grid">
                            <div className="ws-field">
                                <label>{t("order.qtyMin", { min: orderItem.min_order_qty || 1 })}</label>
                                <input
                                    type="number"
                                    defaultValue={orderItem.min_order_qty || 1}
                                />
                            </div>
                            <div className="ws-field">
                                <label>{t("order.paymentAccount")}</label>
                                <select>
                                    <option>{t("order.selectAccount")}</option>
                                    <option>{t("order.mainCash")}</option>
                                    <option>{t("order.alRajhi")}</option>
                                </select>
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                <label>{t("form.notes")}</label>
                                <input placeholder={t("order.notesPh")} />
                            </div>
                        </div>
                        <div
                            style={{
                                background: 'rgba(59,130,246,0.08)',
                                borderRadius: 10,
                                padding: 14,
                                marginTop: 16,
                                fontSize: '0.8125rem',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: 4,
                                }}
                            >
                                <span style={{ color: 'var(--color-text-muted)' }}>
                                    {t("order.subtotal")}
                                </span>
                                <span>
                                    {t("money.sar", {
                                        amount: (
                                            ((orderItem.sale_price || 0) * (orderItem.min_order_qty || 1)) /
                                            1.15
                                        ).toFixed(2),
                                    })}
                                </span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: 4,
                                }}
                            >
                                <span style={{ color: 'var(--color-text-muted)' }}>{t("order.vat")}</span>
                                <span>
                                    {t("money.sar", {
                                        amount: (
                                            (((orderItem.sale_price || 0) * (orderItem.min_order_qty || 1)) *
                                                0.15) /
                                            1.15
                                        ).toFixed(2),
                                    })}
                                </span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontWeight: 800,
                                    fontSize: '1rem',
                                    paddingTop: 8,
                                    borderTop: '1px solid rgba(59,130,246,0.2)',
                                    marginTop: 8,
                                }}
                            >
                                <span>{t("order.total")}</span>
                                <span>
                                    {t("money.sar", {
                                        amount: (
                                            (orderItem.sale_price || 0) * (orderItem.min_order_qty || 1)
                                        ).toLocaleString(),
                                    })}
                                </span>
                            </div>
                        </div>
                    </Modal>
                )}
                {addInventoryOpen && (
                    <Modal
                        title={t("inv.title")}
                        width="1100px"
                        onClose={() => setAddInventoryOpen(false)}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    onClick={() => setAddInventoryOpen(false)}
                                    disabled={inventorySaving}
                                >{t("form.cancel")}</button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    onClick={handleAddSelectedToInventory}
                                    disabled={inventorySaving || selectedMasterProducts.length === 0}
                                >
                                    {inventorySaving ? t("inv.adding") : t("inv.add")}
                                </button>
                            </div>
                        }
                    >
                        {inventoryError ? (
                            <div style={{ marginBottom: 10, fontSize: '0.8125rem', color: '#B91C1C' }}>
                                {inventoryError}
                            </div>
                        ) : null}

                        {autoLocationId ? (
                            <div
                                style={{
                                    marginBottom: 12,
                                    padding: 10,
                                    borderRadius: 8,
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-bg-muted)',
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                {t("inv.locationAuto")}{' '}
                                <strong style={{ color: 'var(--color-text-dark)' }}>
                                    {locationOptions.find((loc) => String(loc.id) === String(autoLocationId))?.name || '-'}
                                </strong>
                            </div>
                        ) : null}

                        <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>{t("inv.th.product")}</th>
                                        <th>{t("inv.th.masterUom")}</th>
                                        <th>{t("inv.th.opening")}</th>
                                        <th>{t("inv.th.stock")}</th>
                                        <th>{t("inv.th.critical")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedMasterProducts.map((p) => {
                                        const row = inventoryQtyForm[String(p.id)] || {
                                            openingQty: '0',
                                            stockQty: '0',
                                            criticalStockLevel: '',
                                        };
                                        const masterUomRule =
                                            p.conversionRule ||
                                            formatUomRule(
                                                p.warehouseUnit,
                                                p.workshopUnit ?? p.unit,
                                                p.conversionFactor ?? 1,
                                            );
                                        return (
                                            <tr key={p.id}>
                                                <td>{p.name}</td>
                                                <td className="ws-muted" style={{ fontSize: '0.8125rem' }}>
                                                    {masterUomRule}
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={row.openingQty}
                                                        onChange={(e) => updateInventoryQty(p.id, 'openingQty', e.target.value)}
                                                        style={{ width: 110, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={row.stockQty}
                                                        onChange={(e) => updateInventoryQty(p.id, 'stockQty', e.target.value)}
                                                        style={{ width: 110, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        placeholder={t("form.optional")}
                                                        value={row.criticalStockLevel}
                                                        onChange={(e) =>
                                                            updateInventoryQty(
                                                                p.id,
                                                                'criticalStockLevel',
                                                                e.target.value,
                                                            )
                                                        }
                                                        title={t("inv.criticalTitle")}
                                                        style={{
                                                            width: 120,
                                                            padding: '6px 8px',
                                                            borderRadius: 6,
                                                            border: '1px solid var(--color-border)',
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

        </div>
    );
}
