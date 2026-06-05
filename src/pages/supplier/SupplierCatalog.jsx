import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    CheckCircle2,
    Circle,
    Globe2,
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
    createSupplierProduct,
    createSupplierProductRequest,
    getSupplierLocations,
    listSupplierMasterCatalogProducts,
    listSupplierProductRequests,
    fetchAllSupplierProducts,
    setSupplierStock,
    updateSupplierProduct,
} from '../../services/supplierApi';
import { ShimmerCatalogGrid } from '../../components/supplier/Shimmer';

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
function mapMasterCatalogRow(p) {
    const brandName = (p.brandName || p.supplierName || '').trim() || '—';
    const sku = (p.sku || '').trim();
    const descParts = [sku ? `SKU: ${sku}` : null, (p.description || '').trim()].filter(Boolean);
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
        _approval: p.isActive === false ? 'Rejected' : 'Approved',
    };
}

/**
 * Lists the same approved master products shown in Super Admin → Inventory → Master Catalog,
 * but through supplier endpoint (`/supplier/products/master-catalog`).
 */
export default function SupplierCatalog() {
    const branchLabel = 'All branches';
    const zoneName = 'Central Zone';

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
                const approved = raw.filter((p) => p.isActive !== false);
                setMasterProducts(approved);

                const catMap = new Map();
                approved.forEach((p) => {
                    if (!p?.categoryId || !p?.categoryName) return;
                    catMap.set(String(p.categoryId), p.categoryName);
                });
                setCategoryRows(
                    [...catMap.entries()].map(([id, name]) => ({ id, name })),
                );
            })
            .catch((err) => {
                if (err.name === 'AbortError') return;
                setApiError(err.message || 'Failed to load master catalog.');
                setMasterProducts([]);
                setCategoryRows([]);
            })
            .finally(() => {
                if (signal.aborted) return;
                setLoading(false);
            });
    }, []);

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
        const bySku = new Set();
        const byName = new Set();
        (existingSupplierProducts || []).forEach((p) => {
            // treat inactive items as "not added" so they appear in Not Added tab for re-add
            if (p?.isActive === false) return;
            if (p?.sku) bySku.add(String(p.sku).trim().toLowerCase());
            const nm = String(p?.productName || p?.name || '').trim().toLowerCase();
            if (nm) byName.add(nm);
        });
        return { bySku, byName };
    }, [existingSupplierProducts]);

    const isAlreadyAdded = useCallback(
        (p) => {
            const skuKey = String(p?.sku || '').trim().toLowerCase();
            const nameKey = String(p?.name || '').trim().toLowerCase();
            return (
                (!!skuKey && myInventoryKeyset.bySku.has(skuKey)) ||
                (!!nameKey && myInventoryKeyset.byName.has(nameKey))
            );
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

    const cardRows = useMemo(() => filteredRaw.map(mapMasterCatalogRow), [filteredRaw]);

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
                `Purchase order placed for ${orderItem.product_name} with ${orderSupplier?.name}`,
            );
            setOrderItem(null);
            setOrderSupplier(null);
        }
    };
    const handleRequestProduct = async () => {
        if (!reqForm.product_name?.trim()) {
            setRequestError('Product name is required.');
            return;
        }
        setRequestSubmitting(true);
        setRequestError('');
        const form = {
            ...reqForm,
            product_name: reqForm.product_name || 'New Product',
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
            setRequestError(err?.message || 'Failed to submit product request.');
        } finally {
            setRequestSubmitting(false);
        }
    };

    const toggleSelectProduct = (productId) => {
        const id = String(productId);
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
            new Set(filteredRaw.map((p) => String(p?.id ?? '')).filter(Boolean)),
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
            const existingProduct =
                existing.find(
                    (ep) =>
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
                warehouseUnit:
                    existingProduct?.warehouseUnit ||
                    (p.unit === 'piece' || p.unit === 'pcs' ? 'Box' : p.unit || 'Box'),
                workshopUnit: existingProduct?.workshopUnit || p.unit || 'pcs',
                conversionFactor: String(existingProduct?.conversionFactor ?? 1),
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
                warehouseUnit: prev[id]?.warehouseUnit ?? 'Box',
                workshopUnit: prev[id]?.workshopUnit ?? 'pcs',
                conversionFactor: prev[id]?.conversionFactor ?? '1',
                [key]: value,
            },
        }));
    };

    const handleAddSelectedToInventory = async () => {
        setInventorySaving(true);
        setInventoryError('');
        setInventorySuccess('');

        try {
            const bySku = new Map();
            const byName = new Map();
            existingSupplierProducts.forEach((p) => {
                if (p?.sku) bySku.set(String(p.sku).trim().toLowerCase(), p);
                if (p?.name || p?.productName) {
                    byName.set(String(p.name || p.productName).trim().toLowerCase(), p);
                }
            });

            for (const master of selectedMasterProducts) {
                const id = String(master.id);
                const row = inventoryQtyForm[id] || {
                    openingQty: '0',
                    stockQty: '0',
                    criticalStockLevel: '',
                    warehouseUnit: 'Box',
                    workshopUnit: master.unit || 'pcs',
                    conversionFactor: '1',
                };
                const openingQty = Math.max(0, Number(row.openingQty || 0));
                const stockQty = Math.max(0, Number(row.stockQty || 0));
                const warehouseUnit = String(row.warehouseUnit || 'Box').trim() || 'Box';
                const workshopUnit = String(row.workshopUnit || 'pcs').trim() || 'pcs';
                const conversionFactor = Math.max(
                    0.0001,
                    Number(row.conversionFactor || 1) || 1,
                );

                const critRaw = row.criticalStockLevel;
                let criticalStockAlert;
                if (
                    critRaw !== '' &&
                    critRaw !== undefined &&
                    critRaw !== null
                ) {
                    const n = Number(critRaw);
                    if (Number.isFinite(n) && n >= 0) {
                        criticalStockAlert = n;
                    }
                }

                const skuKey = String(master.sku || '').trim().toLowerCase();
                const nameKey = String(master.name || '').trim().toLowerCase();

                let supplierProductId =
                    bySku.get(skuKey)?.id || byName.get(nameKey)?.id || null;
                const wasExistingSupplierProduct = !!supplierProductId;

                if (!supplierProductId) {
                    const created = await createSupplierProduct({
                        productName: master.name,
                        sku: master.sku || `MC-${master.id}`,
                        categoryId: master.categoryId ? String(master.categoryId) : undefined,
                        warehouseUnit,
                        workshopUnit,
                        conversionFactor,
                        pricePerWarehouseUnit: Number(
                            master.purchasePrice ?? master.salePrice ?? 0,
                        ),
                        reorderLevel: openingQty,
                        ...(criticalStockAlert !== undefined
                            ? { criticalStockAlert }
                            : {}),
                    });
                    supplierProductId = created?.product?.id;
                    if (!supplierProductId) {
                        throw new Error(`Failed to create supplier product for ${master.name}`);
                    }
                }

                if (skuKey) {
                    bySku.set(skuKey, { id: supplierProductId });
                }
                if (nameKey) {
                    byName.set(nameKey, { id: supplierProductId });
                }

                await setSupplierStock({
                    supplierProductId: String(supplierProductId),
                    ...(autoLocationId ? { supplierLocationId: String(autoLocationId) } : {}),
                    currentQuantity: stockQty,
                });

                if (
                    wasExistingSupplierProduct &&
                    (criticalStockAlert !== undefined ||
                        warehouseUnit ||
                        workshopUnit ||
                        conversionFactor)
                ) {
                    await updateSupplierProduct(String(supplierProductId), {
                        ...(criticalStockAlert !== undefined
                            ? { criticalStockAlert }
                            : {}),
                        warehouseUnit,
                        workshopUnit,
                        conversionFactor,
                    });
                }
            }

            setInventorySuccess(
                `${selectedMasterProducts.length} product(s) added to inventory successfully.`,
            );
            setAddInventoryOpen(false);
            setSelectedProductIds(new Set());
        } catch (err) {
            setInventoryError(err?.message || 'Failed to add selected products to inventory.');
        } finally {
            setInventorySaving(false);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2
                        className="ws-page-title"
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        <Package size={20} style={{ color: '#2563EB' }} /> Product Catalog
                    </h2>
                    <p
                        className="ws-page-sub"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}
                    >
                        <Globe2 size={14} style={{ color: '#7C3AED' }} /> Branch:{' '}
                        <strong>{branchLabel}</strong> · {zoneName} · {brandCountForHeader}{' '}
                        brands · {cardRows.length} products
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
                                setSyncMsg('Synced master catalog.');
                                setTimeout(() => setSyncMsg(''), 2500);
                            } catch (e) {
                                setSyncMsg(e?.message || 'Sync failed.');
                                setTimeout(() => setSyncMsg(''), 3500);
                            } finally {
                                setSyncing(false);
                            }
                        }}
                        disabled={syncing}
                        title="Sync / refresh master catalog"
                    >
                        {syncing ? 'Syncing…' : 'Sync'}
                    </button>
                    <button
                        className="btn-portal-outline"
                        type="button"
                        onClick={openAddToInventoryModal}
                        disabled={selectedProductIds.size === 0}
                    >
                        <Plus size={15} /> Add to Inventory
                        {selectedProductIds.size > 0 ? ` (${selectedProductIds.size})` : ''}
                    </button>
                    <button className="btn-portal" onClick={() => setShowRequestForm(true)}>
                        <Plus size={15} /> Request New Product
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

            <div
                role="tablist"
                aria-label="Catalog sections"
                style={{
                    display: 'flex',
                    gap: 4,
                    marginBottom: 20,
                    borderBottom: '2px solid var(--color-border-light, #e2e8f0)',
                }}
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={catalogTab === 'browse'}
                    id="catalog-tab-browse"
                    onClick={() => setCatalogTab('browse')}
                    style={{
                        padding: '10px 18px',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color:
                            catalogTab === 'browse'
                                ? 'var(--color-text-dark)'
                                : 'var(--color-text-muted)',
                        borderBottom:
                            catalogTab === 'browse'
                                ? '2px solid #2563EB'
                                : '2px solid transparent',
                        marginBottom: -2,
                        borderRadius: '8px 8px 0 0',
                    }}
                >
                    <Package size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Browse catalog
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={catalogTab === 'requests'}
                    id="catalog-tab-requests"
                    onClick={() => setCatalogTab('requests')}
                    style={{
                        padding: '10px 18px',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color:
                            catalogTab === 'requests'
                                ? 'var(--color-text-dark)'
                                : 'var(--color-text-muted)',
                        borderBottom:
                            catalogTab === 'requests'
                                ? '2px solid #2563EB'
                                : '2px solid transparent',
                        marginBottom: -2,
                        borderRadius: '8px 8px 0 0',
                    }}
                >
                    <Send size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    My Product Requests
                    {requests.length > 0 ? (
                        <span
                            style={{
                                marginLeft: 8,
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: catalogTab === 'requests' ? '#DBEAFE' : '#F1F5F9',
                                color: '#1D4ED8',
                            }}
                        >
                            {requests.length}
                        </span>
                    ) : null}
                </button>
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
                        Same listing as Super Admin → Master Catalog through
                        `GET /supplier/products/master-catalog`.
                    </span>
                </div>
            ) : null}

            {catalogTab === 'browse' ? (
                <>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        <button
                            type="button"
                            className={
                                masterFilterTab === 'not_added'
                                    ? 'btn-portal'
                                    : 'btn-portal-outline'
                            }
                            onClick={() => setMasterFilterTab('not_added')}
                        >
                            Not Added Products
                        </button>
                        <button
                            type="button"
                            className={
                                masterFilterTab === 'already_added'
                                    ? 'btn-portal'
                                    : 'btn-portal-outline'
                            }
                            onClick={() => setMasterFilterTab('already_added')}
                        >
                            Already Added Products
                        </button>
                    </div>
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
                        placeholder="Search name, SKU, brand…"
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
                    <option value="all">All Categories</option>
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
                    <option value="all">All brands</option>
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
                        {allFilteredSelected ? 'Deselect all' : 'Select all'}
                        {filteredRaw.length > 0 ? ` (${filteredRaw.length})` : ''}
                    </button>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={selectedProductIds.size === 0}
                        onClick={clearProductSelection}
                    >
                        Clear selection
                        {selectedProductIds.size > 0 ? ` (${selectedProductIds.size})` : ''}
                    </button>
                    <span
                        style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)',
                            marginLeft: 'auto',
                        }}
                    >
                        Applies to the full filtered list (all pages), not only this page.
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
                        Unable to load this catalog section
                    </p>
                    <p style={{ margin: '8px 0 0', fontSize: '0.8125rem' }}>
                        Fix the issue above or try again later.
                    </p>
                </div>
            ) : cardRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
                    <Package size={48} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No products available yet.</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.875rem' }}>
                        Click &quot;Request New Product&quot; or adjust filters.
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
                                    cursor: 'pointer',
                                }}
                                className="ws-section"
                                onClick={() => toggleSelectProduct(item.id)}
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
                                                    Ready to add in inventory
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
                                                display: 'inline-flex',
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
                                            {isSelected ? 'Selected' : 'Select'}
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectProduct(item.id)}
                                                aria-label={`Select ${item.product_name}`}
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
                                        <div>
                                            <p style={{ fontSize: '0.9375rem', fontWeight: 900, margin: 0, lineHeight: 1.2 }}>
                                                SAR {(item.sale_price || 0).toLocaleString()}
                                            </p>
                                            <p
                                                style={{
                                                    fontSize: '0.625rem',
                                                    color: 'var(--color-text-muted)',
                                                    margin: '1px 0 0',
                                                    lineHeight: 1.2,
                                                }}
                                            >
                                                per {item.unit} · Min: {item.min_order_qty || 1}
                                            </p>
                                        </div>
                                        <span
                                            className={`ws-badge ${inStock ? 'ws-badge--green' : 'ws-badge--red'}`}
                                            style={{ fontSize: '0.625rem', padding: '2px 6px' }}
                                        >
                                            {inStock ? `${item.stock_qty} in stock` : 'Out'}
                                        </span>
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
                        Previous
                    </button>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Page {page} of {totalPages} ({cardRows.length} products)
                    </span>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={page >= totalPages || loading}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
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
                                    No product requests yet
                                </p>
                                <p
                                    style={{
                                        margin: '10px auto 18px',
                                        fontSize: '0.875rem',
                                        maxWidth: 420,
                                    }}
                                >
                                    Use <strong>Request New Product</strong> in the header to ask for a new SKU.
                                </p>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    onClick={() => setShowRequestForm(true)}
                                >
                                    <Plus size={15} /> Request New Product
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
                                    <Send size={16} style={{ color: '#2563EB' }} /> My Product Requests
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
                                                    Qty: {req.quantity_needed} {req.unit}
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
                                                {req.status}
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
                        title="Request New Product"
                        onClose={() => setShowRequestForm(false)}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowRequestForm(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-submit"
                                    onClick={handleRequestProduct}
                                    disabled={requestSubmitting}
                                >
                                    {requestSubmitting ? 'Submitting...' : 'Submit Request'}
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
                                <label>Product Name *</label>
                                <input
                                    placeholder="e.g. 5W-30 Engine Oil 4L"
                                    value={reqForm.product_name}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, product_name: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>SKU</label>
                                <input
                                    placeholder="e.g. OIL-5W30-4L"
                                    value={reqForm.sku}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, sku: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>Brand Name</label>
                                <input
                                    placeholder="e.g. AC Delco"
                                    value={reqForm.brand_name}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, brand_name: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                <label>Description</label>
                                <input
                                    placeholder="Short product description"
                                    value={reqForm.description}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, description: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>Arabic Name</label>
                                <input
                                    placeholder="Optional Arabic name"
                                    value={reqForm.arabic_name}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, arabic_name: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>Branch ID</label>
                                <input
                                    placeholder="Optional branch id"
                                    value={reqForm.branch_id}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, branch_id: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field">
                                <label>Department</label>
                                <select
                                    value={reqForm.department_id}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, department_id: e.target.value }))
                                    }
                                >
                                    <option value="">Select department</option>
                                    {departmentOptions.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>Category</label>
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
                                    <option value="">Select category</option>
                                    {categoryRows.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ws-field">
                                <label>Unit</label>
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
                                <label>Quantity Needed</label>
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
                                <label>Target Price (SAR)</label>
                                <input
                                    type="number"
                                    placeholder="Optional"
                                    value={reqForm.target_price}
                                    onChange={(e) =>
                                        setReqForm((f) => ({ ...f, target_price: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                <label>Notes</label>
                                <input
                                    placeholder="Any specific requirements..."
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
                        title="Place Purchase Order"
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
                                >
                                    Cancel
                                </button>
                                <button className="btn-submit" onClick={handlePlaceOrder}>
                                    Place Order
                                </button>
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
                                Supplier: <strong>{orderSupplier?.name}</strong> · SAR{' '}
                                {orderItem.sale_price?.toLocaleString()} / {orderItem.unit}
                            </p>
                        </div>
                        <div className="ws-form-grid">
                            <div className="ws-field">
                                <label>Quantity (min: {orderItem.min_order_qty || 1})</label>
                                <input
                                    type="number"
                                    defaultValue={orderItem.min_order_qty || 1}
                                />
                            </div>
                            <div className="ws-field">
                                <label>Payment Account</label>
                                <select>
                                    <option>Select account (optional)</option>
                                    <option>Main Cash</option>
                                    <option>Al-Rajhi Bank</option>
                                </select>
                            </div>
                            <div className="ws-field" style={{ gridColumn: '1/-1' }}>
                                <label>Notes</label>
                                <input placeholder="Delivery instructions, urgency..." />
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
                                    Subtotal (excl. VAT)
                                </span>
                                <span>
                                    SAR{' '}
                                    {(
                                        ((orderItem.sale_price || 0) * (orderItem.min_order_qty || 1)) /
                                        1.15
                                    ).toFixed(2)}
                                </span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: 4,
                                }}
                            >
                                <span style={{ color: 'var(--color-text-muted)' }}>VAT (15%)</span>
                                <span>
                                    SAR{' '}
                                    {(
                                        (((orderItem.sale_price || 0) * (orderItem.min_order_qty || 1)) *
                                            0.15) /
                                        1.15
                                    ).toFixed(2)}
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
                                <span>Total</span>
                                <span>
                                    SAR{' '}
                                    {(
                                        (orderItem.sale_price || 0) * (orderItem.min_order_qty || 1)
                                    ).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </Modal>
                )}
                {addInventoryOpen && (
                    <Modal
                        title="Add Selected Products to Inventory"
                        width="1100px"
                        onClose={() => setAddInventoryOpen(false)}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    onClick={() => setAddInventoryOpen(false)}
                                    disabled={inventorySaving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    onClick={handleAddSelectedToInventory}
                                    disabled={inventorySaving || selectedMasterProducts.length === 0}
                                >
                                    {inventorySaving ? 'Adding...' : 'Add to Inventory'}
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
                                Inventory location (auto):{' '}
                                <strong style={{ color: 'var(--color-text-dark)' }}>
                                    {locationOptions.find((loc) => String(loc.id) === String(autoLocationId))?.name || '-'}
                                </strong>
                            </div>
                        ) : null}

                        <div style={{ maxHeight: 360, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 10 }}>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Warehouse UOM</th>
                                        <th>Workshop UOM</th>
                                        <th>CF (1 wh = ? ws)</th>
                                        <th>Opening Qty</th>
                                        <th>Stock Qty</th>
                                        <th>Critical stock level</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedMasterProducts.map((p) => {
                                        const row = inventoryQtyForm[String(p.id)] || {
                                            openingQty: '0',
                                            stockQty: '0',
                                            criticalStockLevel: '',
                                            warehouseUnit: 'Box',
                                            workshopUnit: p.unit || 'pcs',
                                            conversionFactor: '1',
                                        };
                                        return (
                                            <tr key={p.id}>
                                                <td>{p.name}</td>
                                                <td>
                                                    <select
                                                        value={row.warehouseUnit || 'Box'}
                                                        onChange={(e) =>
                                                            updateInventoryQty(
                                                                p.id,
                                                                'warehouseUnit',
                                                                e.target.value,
                                                            )
                                                        }
                                                        style={{
                                                            width: 100,
                                                            padding: '6px 8px',
                                                            borderRadius: 6,
                                                            border: '1px solid var(--color-border)',
                                                        }}
                                                    >
                                                        {WAREHOUSE_UNIT_PRESETS.map((u) => (
                                                            <option key={u} value={u}>
                                                                {u}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        value={row.workshopUnit || 'pcs'}
                                                        onChange={(e) =>
                                                            updateInventoryQty(
                                                                p.id,
                                                                'workshopUnit',
                                                                e.target.value,
                                                            )
                                                        }
                                                        style={{
                                                            width: 90,
                                                            padding: '6px 8px',
                                                            borderRadius: 6,
                                                            border: '1px solid var(--color-border)',
                                                        }}
                                                    >
                                                        {[...new Set([...(WORKSHOP_UNIT_PRESETS || []), p.unit || 'pcs'])].map(
                                                            (u) => (
                                                                <option key={u} value={u}>
                                                                    {u}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0.0001"
                                                        step="any"
                                                        value={row.conversionFactor ?? '1'}
                                                        onChange={(e) =>
                                                            updateInventoryQty(
                                                                p.id,
                                                                'conversionFactor',
                                                                e.target.value,
                                                            )
                                                        }
                                                        title="1 warehouse unit = this many workshop units (e.g. 1 Box = 20 Liter)"
                                                        style={{
                                                            width: 72,
                                                            padding: '6px 8px',
                                                            borderRadius: 6,
                                                            border: '1px solid var(--color-border)',
                                                        }}
                                                    />
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
                                                        placeholder="Optional"
                                                        value={row.criticalStockLevel}
                                                        onChange={(e) =>
                                                            updateInventoryQty(
                                                                p.id,
                                                                'criticalStockLevel',
                                                                e.target.value,
                                                            )
                                                        }
                                                        title="When warehouse stock ≤ this value, alerts show as critical (supplierProduct.criticalStockAlert)."
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
