import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    FileSpreadsheet,
    FileText,
    History,
    Package,
    Pencil,
    Search,
    TrendingUp,
} from 'lucide-react';
import { ShimmerKpiGrid, ShimmerTable } from '../../components/supplier/Shimmer';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import RowActionsMenu from '../../components/RowActionsMenu';
import { useColumnSort, SortableTh } from '../../components/TableSort';
import {
    fetchAllSupplierProducts,
    getSupplierInventoryStockBalances,
    getSupplierProductInventoryTimeline,
    setSupplierStock,
    updateSupplierProduct,
} from '../../services/supplierApi';
import SupplierProductHistoryDrawer from './accounting/SupplierProductHistoryDrawer';
import StockProductPurchasePriceEditModal from './StockProductPurchasePriceEditModal';
import StockProductSalesPriceEditModal from './StockProductSalesPriceEditModal';
import StockProductCriticalLevelEditModal from './StockProductCriticalLevelEditModal';
import SupplierStockProductTimelineScreen from './SupplierStockProductTimelineScreen';

function stockRowMatchesSearch(row, searchText) {
    const q = String(searchText || '').trim().toLowerCase();
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    const hay = [
        row?.name,
        row?.sku,
        row?.masterProductName,
        row?.masterProductSku,
        row?.masterProductArabicName,
    ]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
    return tokens.every((t) => hay.includes(t));
}
import {
    mapSupplierHistoryToMovementRegister,
    mapSupplierHistoryToTimelineEntries,
    formatSupplierTimelineSourceRef,
    formatDualUomQty,
    warehouseStockLineValueSar,
} from './supplierInventoryTimelineUtils';
import {
    exportMovementsExcel,
    exportMovementsPdf,
    exportStockInventoryExcel,
    exportStockInventoryPdf,
} from './supplierInventoryExport';
import { sstockT } from '../../utils/supplierStockI18n';

function fmtQty(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    const s = x.toFixed(3).replace(/\.?0+$/, '');
    return s;
}

function fmtDelta(d) {
    if (d == null || !Number.isFinite(Number(d))) return '—';
    const n = Number(d);
    if (n > 0) return `+${fmtQty(n)}`;
    return fmtQty(n);
}

/** Purchase Invoices (AP) consumes this to open “New Purchase Invoice” with one line preset. */
const PI_PRESET_FROM_STOCK_FLAG = 'supplier_pi_open_from_stock';
const PI_PRESET_STOCK_LINE = 'supplier_pi_preset_stock_line';

const exportToolbarBtnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: '#fff',
    fontSize: '0.8125rem',
    fontWeight: 600,
    cursor: 'pointer',
    color: 'var(--color-text-dark)',
};

export default function SupplierStockInventory({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => sstockT(locale, key, vars), [locale]);
    const navigate = useNavigate();
    const [stock, setStock] = useState([]);
    const [stockTotal, setStockTotal] = useState(0);
    const [stockPage, setStockPage] = useState(1);
    const STOCK_PAGE_SIZE = 15;
    const [movementHistory, setMovementHistory] = useState([]);
    const [warehouseQtyByProductId, setWarehouseQtyByProductId] = useState({});
    const [productUomByProductId, setProductUomByProductId] = useState({});
    const [movementProductId, setMovementProductId] = useState(null);
    const [movementProductSearch, setMovementProductSearch] = useState('');
    const [movementPickerOpen, setMovementPickerOpen] = useState(false);
    const [movementPickerIdx, setMovementPickerIdx] = useState(0);
    const movementSearchRef = useRef(null);
    const movementPickerListRef = useRef(null);
    const [activeTab, setActiveTab] = useState('inventory');
    const [search, setSearch] = useState('');
    const [criticalOnly, setCriticalOnly] = useState(false);

    const [inventoryItems, setInventoryItems] = useState([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [itemsError, setItemsError] = useState('');
    const [removingId, setRemovingId] = useState(null);
    const [adjustModalOpen, setAdjustModalOpen] = useState(false);
    const [adjustItem, setAdjustItem] = useState(null);
    const [adjustmentType, setAdjustmentType] = useState('remove');
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustNotes, setAdjustNotes] = useState('');
    const [adjustConfirming, setAdjustConfirming] = useState(false);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState('');

    const [timelineProduct, setTimelineProduct] = useState(null);
    const [timelineEntries, setTimelineEntries] = useState([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineError, setTimelineError] = useState('');
    const [accountingHistoryProduct, setAccountingHistoryProduct] = useState(null);
    const [purchasePriceEditProduct, setPurchasePriceEditProduct] = useState(null);
    const [salesPriceEditProduct, setSalesPriceEditProduct] = useState(null);
    const [criticalLevelEditProduct, setCriticalLevelEditProduct] = useState(null);

    // `stock` is already server-filtered by `search` (name or SKU). Keep a light client filter
    // as a safety net (e.g. if backend returns broader results).
    const filteredList = useMemo(() => {
        const list = stock || [];
        if (!search.trim()) return list;
        const q = search.toLowerCase().trim();
        return list.filter(
            (s) =>
                (s.name || '').toLowerCase().includes(q) ||
                (s.sku || '').toLowerCase().includes(q),
        );
    }, [stock, search]);

    /** 3-state column sorting for the two inventory tables. */
    const stockSort = useColumnSort();
    const itemsSort = useColumnSort();

    const movementProductOptions = useMemo(() => {
        const list = stock || [];
        const q = movementProductSearch.trim().toLowerCase();
        if (!q) return list;
        return list.filter(
            (s) =>
                (s.name || '').toLowerCase().includes(q) ||
                (s.sku || '').toLowerCase().includes(q),
        );
    }, [stock, movementProductSearch]);

    const selectedMovementProduct = useMemo(() => {
        if (!movementProductId) return null;
        return stock.find((s) => String(s.id) === String(movementProductId)) || null;
    }, [stock, movementProductId]);

    const displayedMovementEntries = useMemo(() => {
        if (!movementHistory.length) return [];
        if (movementProductId) {
            const filtered = movementHistory.filter(
                (h) => String(h.supplierProductId) === String(movementProductId),
            );
            const whQty = warehouseQtyByProductId[String(movementProductId)] ?? 0;
            const uom = productUomByProductId[String(movementProductId)] || {};
            return mapSupplierHistoryToTimelineEntries(filtered, whQty, uom);
        }
        return mapSupplierHistoryToMovementRegister(
            movementHistory,
            warehouseQtyByProductId,
            productUomByProductId,
        );
    }, [movementHistory, warehouseQtyByProductId, productUomByProductId, movementProductId]);

    const movementFinalBalance = useMemo(() => {
        if (!movementProductId) return null;
        return warehouseQtyByProductId[String(movementProductId)] ?? 0;
    }, [movementProductId, warehouseQtyByProductId]);

    const selectMovementProduct = useCallback((product) => {
        if (!product?.id) return;
        setMovementProductId(String(product.id));
        setMovementProductSearch(product.name || '');
        setMovementPickerOpen(false);
        setMovementPickerIdx(0);
    }, []);

    const clearMovementProductFilter = useCallback(() => {
        setMovementProductId(null);
        setMovementProductSearch('');
        setMovementPickerOpen(false);
        setMovementPickerIdx(0);
        movementSearchRef.current?.focus();
    }, []);

    const onMovementSearchKeyDown = useCallback(
        (e) => {
            const options = movementProductOptions;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMovementPickerOpen(true);
                setMovementPickerIdx((i) =>
                    options.length === 0 ? 0 : Math.min(i + 1, options.length - 1),
                );
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMovementPickerOpen(true);
                setMovementPickerIdx((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (options.length === 0) return;
                const pick = options[movementPickerIdx] ?? options[0];
                selectMovementProduct(pick);
                return;
            }
            if (e.key === 'Escape') {
                setMovementPickerOpen(false);
            }
        },
        [movementProductOptions, movementPickerIdx, selectMovementProduct],
    );

    useEffect(() => {
        if (!movementPickerOpen || !movementPickerListRef.current) return;
        const el = movementPickerListRef.current.querySelector(
            `[data-movement-pick-idx="${movementPickerIdx}"]`,
        );
        el?.scrollIntoView({ block: 'nearest' });
    }, [movementPickerIdx, movementPickerOpen]);

    const totalSKUs = stockTotal || stock.length;
    const criticalCount = stock.filter((s) => s.qty <= (s.criticalLevel ?? 0)).length;
    const reorderNeededCount = stock.filter(
        (s) => s.reorder != null && s.qty <= s.reorder && s.qty > (s.criticalLevel ?? 0),
    ).length;
    const inventoryValue = stock.reduce((sum, s) => sum + (s.qty || 0) * (s.price || 0), 0);
    const criticalItems = stock.filter((s) => s.qty <= (s.criticalLevel ?? 0));

    const locationSummary = (row) => {
        const locs = row?.byLocation || [];
        const whUom = row?.warehouseUnit || 'Box';
        const wsUom = row?.unit || 'Liter';
        if (!locs.length) return '—';
        return locs
            .map((l) =>
                `${l.locationName || '—'}: ${formatDualUomQty(
                    l.quantityWarehouseUnits,
                    whUom,
                    l.quantityWorkshopUnits,
                    wsUom,
                )}`,
            )
            .join(' · ');
    };

    const loadStock = useCallback(async (opts = {}) => {
        const silent = !!opts.silent;
        if (!silent) {
            setLoading(true);
        }
        setApiError('');
        try {
            const res = await getSupplierInventoryStockBalances({
                limit: STOCK_PAGE_SIZE,
                offset: (stockPage - 1) * STOCK_PAGE_SIZE,
                historyLimit: 50,
                search: search.trim() ? search.trim() : undefined,
                ...(criticalOnly ? { isLowCriticalOnly: true } : {}),
            });
            const items = Array.isArray(res?.items)
                ? res.items.map((item) => ({
                      id: item.productId,
                      sku: item.sku || '-',
                      name: item.productName,
                      unit: item.workshopUnit || 'pcs',
                      warehouseUnit: item.warehouseUnit || 'Box',
                      conversionFactor: Number(item.conversionFactor) || 1,
                      openingAdoption: item.openingAdoption != null ? Number(item.openingAdoption) : null,
                      qty: Number(item.currentBalanceWorkshop || 0),
                      warehouseQty: Number(item.currentBalanceWarehouse || 0),
                      pendingWorkshopReceive: Number(
                          item.pendingWorkshopReceiveWorkshop || 0,
                      ),
                      pendingWorkshopReceiveWarehouse: Number(
                          item.pendingWorkshopReceiveWarehouse || 0,
                      ),
                      criticalLevel: item.criticalAt != null ? Number(item.criticalAt) : 0,
                      reorder: item.reorderAt != null ? Number(item.reorderAt) : 0,
                      price:
                          Number(item.valueWarehouseSar || 0) > 0 &&
                          Number(item.currentBalanceWarehouse || 0) > 0
                              ? Number(item.valueWarehouseSar) /
                                Number(item.currentBalanceWarehouse)
                              : 0,
                      salePrice: (() => {
                          const sp =
                              item.salePrice != null && Number(item.salePrice) > 0
                                  ? Number(item.salePrice)
                                  : null;
                          return sp;
                      })(),
                      salePriceWarehouse: (() => {
                          const sp =
                              item.salePrice != null && Number(item.salePrice) > 0
                                  ? Number(item.salePrice)
                                  : null;
                          if (sp == null) return null;
                          const cf = Number(item.conversionFactor) || 1;
                          return Math.round(sp * Math.max(0.0001, cf) * 100) / 100;
                      })(),
                      byLocation: item.byLocation || [],
                      locationId: item.byLocation?.[0]?.supplierLocationId,
                  }))
                : [];
            const hist = Array.isArray(res?.transactionHistory) ? res.transactionHistory : [];
            setStockTotal(Number(res?.total ?? items.length) || 0);
            const warehouseQtyByProductId = Object.fromEntries(
                items.map((i) => [String(i.id), i.warehouseQty]),
            );
            const uomByProductId = Object.fromEntries(
                items.map((i) => [
                    String(i.id),
                    {
                        warehouseUnit: i.warehouseUnit,
                        workshopUnit: i.unit,
                        conversionFactor: i.conversionFactor,
                    },
                ]),
            );
            setStock(items);
            setMovementHistory(hist);
            setWarehouseQtyByProductId(warehouseQtyByProductId);
            setProductUomByProductId(uomByProductId);
        } catch (err) {
            console.error('Supplier stock API failed:', err);
            if (!silent) {
                setStock([]);
                setMovementHistory([]);
                setWarehouseQtyByProductId({});
                setProductUomByProductId({});
                setApiError(err?.message || t('err.loadStock'));
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [search, criticalOnly, stockPage]);

    useEffect(() => {
        // Reset pagination when search or critical filter changes
        setStockPage(1);
    }, [search, criticalOnly]);

    useEffect(() => {
        // Debounce search to avoid spamming the API while typing.
        const t = setTimeout(() => {
        loadStock();
        }, 250);
        return () => clearTimeout(t);
    }, [loadStock, search]);

    const loadItems = useCallback(async () => {
        setItemsLoading(true);
        setItemsError('');
        try {
            const products = await fetchAllSupplierProducts({ status: 'all', pageSize: 2000 });
            setInventoryItems(Array.isArray(products) ? products : []);
        } catch (e) {
            setInventoryItems([]);
            setItemsError(e?.message || t('err.loadItems'));
        } finally {
            setItemsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab !== 'items') return;
        if (inventoryItems.length > 0) return;
        loadItems();
    }, [activeTab, inventoryItems.length, loadItems]);

    const refreshTimelineForProduct = async (productId, currentQtyHint) => {
        if (!productId) return;
        setTimelineLoading(true);
        setTimelineError('');
        try {
            const res = await getSupplierProductInventoryTimeline(productId, {
                historyLimit: 50,
            });
            const hist = Array.isArray(res?.transactionHistory) ? res.transactionHistory : [];
            const currentQty =
                res?.currentBalanceWarehouse ??
                currentQtyHint ??
                stock.find((p) => String(p.id) === String(productId))?.warehouseQty ??
                0;
            const uom = productUomByProductId[String(productId)] || {};
            setTimelineEntries(mapSupplierHistoryToTimelineEntries(hist, currentQty, uom));
        } catch (e) {
            setTimelineError(e?.message || t('err.loadTimeline'));
            setTimelineEntries([]);
        } finally {
            setTimelineLoading(false);
        }
    };

    const openTimeline = async (row) => {
        setTimelineProduct(row);
        setTimelineEntries([]);
        await refreshTimelineForProduct(row?.id, row?.warehouseQty ?? row?.qty);
    };

    const closeTimeline = () => {
        setTimelineProduct(null);
        setTimelineEntries([]);
        setTimelineError('');
    };

    const navigateToPurchaseWithProduct = (s) => {
        try {
            sessionStorage.setItem(PI_PRESET_FROM_STOCK_FLAG, '1');
            sessionStorage.setItem(
                PI_PRESET_STOCK_LINE,
                JSON.stringify({
                    supplierProductId: String(s.id),
                    masterProductId:
                        s.masterProductId != null && String(s.masterProductId).trim() !== ''
                            ? String(s.masterProductId).trim()
                            : String(s.id),
                    name: s.name || '',
                    sku: !s.sku || s.sku === '-' ? '' : String(s.sku),
                    unit: s.warehouseUnit || s.unit || 'Box',
                    warehouseUnit: s.warehouseUnit || 'Box',
                    workshopUnit: s.unit || 'pcs',
                    conversionFactor: s.conversionFactor || 1,
                    price: Number(s.price) || 0,
                }),
            );
        } catch {
            sessionStorage.removeItem(PI_PRESET_FROM_STOCK_FLAG);
            sessionStorage.removeItem(PI_PRESET_STOCK_LINE);
        }
        navigate('/supplier/purchase_invoices');
    };

    const openAdjust = (s) => {
        setAdjustItem(s);
        setAdjustmentType('remove');
        setAdjustQty('');
        setAdjustNotes('');
        setAdjustConfirming(false);
        setAdjustModalOpen(true);
    };

    const removeFromStock = async (row) => {
        if (!row?.id) return;
        const ok = window.confirm(
            `Remove "${row.name}" from your stock list?\n\nThis will deactivate the item in your inventory. You can re-add it later from Product Catalog.`,
        );
        if (!ok) return;
        setRemovingId(String(row.id));
        try {
            await updateSupplierProduct(String(row.id), { isActive: false });
            // Optimistic UI: drop from current list, then refresh.
            setStock((prev) => prev.filter((p) => String(p.id) !== String(row.id)));
            await loadStock({ silent: true });
        } catch (e) {
            window.alert(e?.message || t('err.remove'));
        } finally {
            setRemovingId(null);
        }
    };

    const handleConfirmAdjustment = async () => {
        if (!adjustItem || adjustConfirming) return;
        const qtyInput = Number.parseFloat(String(adjustQty).replace(/,/g, ''));
        if (!Number.isFinite(qtyInput) || qtyInput < 0) return;
        if (adjustmentType !== 'set' && qtyInput <= 0) return;
        const cf = Number(adjustItem.conversionFactor) || 1;
        const currentWh = Number(adjustItem.warehouseQty) || 0;
        const newWarehouseQty =
            adjustmentType === 'set'
                ? qtyInput
                : adjustmentType === 'add'
                  ? currentWh + qtyInput
                  : Math.max(0, currentWh - qtyInput);
        const newWorkshopQty = Math.round(newWarehouseQty * cf * 1000) / 1000;
        const savedId = adjustItem.id;
        setAdjustConfirming(true);
        try {
            const autoNote =
                adjustmentType === 'set' && newWarehouseQty === 0 && !adjustNotes.trim()
                    ? t('adjust.zeroNote')
                    : adjustmentType === 'set' && !adjustNotes.trim()
                      ? t('adjust.setNote', { qty: newWarehouseQty, unit: adjustItem.warehouseUnit || 'Box' })
                      : '';
            await setSupplierStock({
                supplierProductId: String(adjustItem.id),
                supplierLocationId: String(
                    adjustItem.locationId || adjustItem.byLocation?.[0]?.supplierLocationId || '',
                ),
                currentQuantity: newWarehouseQty,
                ...(adjustNotes.trim() || autoNote ? { notes: adjustNotes.trim() || autoNote } : {}),
            });
            setStock((prev) =>
                prev.map((s) =>
                    s.id === adjustItem.id
                        ? { ...s, warehouseQty: newWarehouseQty, qty: newWorkshopQty }
                        : s,
                ),
            );
            setAdjustModalOpen(false);
            setAdjustItem(null);
            setAdjustQty('');
            setAdjustNotes('');
            await loadStock({ silent: true });
            if (timelineProduct && String(timelineProduct.id) === String(savedId)) {
                await refreshTimelineForProduct(
                    savedId,
                    timelineProduct?.warehouseQty ?? timelineProduct?.qty,
                );
            }
        } catch (err) {
            console.error('Set supplier stock failed:', err);
        } finally {
            setAdjustConfirming(false);
        }
    };

    if (timelineProduct) {
        const stockRow = stock.find((p) => String(p.id) === String(timelineProduct.id));
        return (
            <SupplierStockProductTimelineScreen
                product={timelineProduct}
                stockRow={stockRow}
                entries={timelineEntries}
                loading={timelineLoading}
                error={timelineError}
                locationSummary={locationSummary}
                onBack={closeTimeline}
                locale={locale}
            />
        );
    }

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">{t('page.title')}</h2>
                    <p className="ws-page-sub">{t('page.sub')}</p>
                </div>
            </div>

            {apiError ? (
                <div className="theme-alert">
                    <strong>{t('err.couldNotLoad')}</strong> {apiError}
                </div>
            ) : null}

            {loading ? (
                <ShimmerKpiGrid cards={4} />
            ) : (
                <div className="ws-kpi-grid">
                    {[
                        { key: 'skus', label: t('kpi.skus'), value: totalSKUs, Icon: Package },
                        { key: 'critical', label: t('kpi.critical'), value: criticalCount, Icon: AlertTriangle },
                        { key: 'reorder', label: t('kpi.reorder'), value: reorderNeededCount, Icon: TrendingUp },
                        {
                            key: 'value',
                            label: t('kpi.value'),
                            value: t('money.sar', { amount: inventoryValue.toLocaleString() }),
                            Icon: FileSpreadsheet,
                        },
                    ].map(({ key, label, value, Icon }) => (
                        <div key={key} className="ws-kpi-card">
                            <div>
                                <p className="ws-kpi-label">{label}</p>
                                <p className="ws-kpi-value">{value}</p>
                            </div>
                            <div className="ws-kpi-icon ws-kpi-icon--dark">
                                <Icon size={22} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="theme-segmented" style={{ marginBottom: 16 }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    className={`theme-segmented__btn${activeTab === 'inventory' ? ' theme-segmented__btn--active' : ''}`}
                >
                    {t('tab.inventory')}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('items')}
                    className={`theme-segmented__btn${activeTab === 'items' ? ' theme-segmented__btn--active' : ''}`}
                >
                    {t('tab.items')}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('movements')}
                    className={`theme-segmented__btn${activeTab === 'movements' ? ' theme-segmented__btn--active' : ''}`}
                >
                    {t('tab.movements')}
                </button>
                    </div>

            {activeTab === 'items' && (
                <div className="ws-section" style={{ padding: 16 }}>
                    <div
                        style={{
                                display: 'flex',
                            flexWrap: 'wrap',
                                alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            marginBottom: 12,
                            }}
                        >
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>{t('items.title')}</h3>
                        <p
                            style={{
                                    margin: '4px 0 0',
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                {t('items.sub')}
                        </p>
                    </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                                type="button"
                                onClick={() => setCriticalOnly((v) => !v)}
                                className="btn-portal-outline"
                        style={{
                                    borderColor: criticalOnly ? '#DC2626' : undefined,
                                    color: criticalOnly ? '#DC2626' : undefined,
                                    fontWeight: 700,
                                }}
                            >
                                {criticalOnly ? t('btn.criticalOn') : t('btn.critical')}
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={loadItems}
                                disabled={itemsLoading}
                            >
                                {itemsLoading ? t('btn.refreshing') : t('btn.refresh')}
                            </button>
                    </div>
                    </div>

                    {itemsError ? (
                        <div className="mgr-si-error" style={{ marginBottom: 12 }}>
                            {itemsError}
                </div>
                    ) : null}

                    <div style={{ position: 'relative', width: '100%', marginBottom: 12 }}>
                        <Search
                            size={16}
                style={{
                                position: 'absolute',
                                left: 14,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#9CA3AF',
                                pointerEvents: 'none',
                            }}
                            aria-hidden
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('search.items')}
                    style={{
                                width: '100%',
                                padding: '11px 14px 11px 42px',
                                borderRadius: 10,
                                border: '1px solid var(--color-border)',
                        fontSize: '0.875rem',
                            }}
                        />
            </div>

                    {itemsLoading && inventoryItems.length === 0 ? (
                        <ShimmerTable rows={8} columns={6} />
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <SortableTh label={t('th.product')} columnKey="product" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <SortableTh label={t('th.sku')} columnKey="sku" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <SortableTh label={t('th.qtyWh')} columnKey="qtyWh" align="right" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <SortableTh label={t('th.qtyWs')} columnKey="qtyWs" align="right" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <SortableTh label={t('th.critical')} columnKey="critical" align="right" sortKey={itemsSort.sortKey} sortDir={itemsSort.sortDir} onSort={itemsSort.toggleSort} />
                                        <th>{t('th.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const itemsRows = (inventoryItems || [])
                                        .filter((p) => {
                                            const q = search.trim().toLowerCase();
                                            if (!q) return true;
                                            return (
                                                String(p?.name || p?.productName || '')
                                                    .toLowerCase()
                                                    .includes(q) ||
                                                String(p?.sku || '').toLowerCase().includes(q)
                                            );
                                        })
                                        .filter((p) => {
                                            if (!criticalOnly) return true;
                                            const pid = String(p?.id);
                                            const wh = Number(warehouseQtyByProductId[pid] ?? 0);
                                            const crit = Number(p?.criticalStockAlert ?? 0);
                                            return crit > 0 && wh <= crit;
                                        });
                                        return itemsSort
                                            .sortRows(itemsRows, {
                                                product: (p) => p?.name || p?.productName || '',
                                                sku: (p) => p?.sku || '',
                                                qtyWh: (p) =>
                                                    Number(warehouseQtyByProductId[String(p?.id)] ?? 0),
                                                qtyWs: (p) => {
                                                    const pid = String(p?.id);
                                                    const uom = productUomByProductId[pid] || {};
                                                    const cf =
                                                        Number(
                                                            uom.conversionFactor ||
                                                                p?.conversionFactor ||
                                                                1,
                                                        ) || 1;
                                                    return Number(warehouseQtyByProductId[pid] ?? 0) * cf;
                                                },
                                                critical: (p) => Number(p?.criticalStockAlert ?? 0),
                                            })
                                            .map((p) => {
                                            const pid = String(p?.id);
                                            const uom = productUomByProductId[pid] || {};
                                            const cf =
                                                Number(
                                                    uom.conversionFactor ||
                                                        p?.conversionFactor ||
                                                        1,
                                                ) || 1;
                                            const wh = Number(warehouseQtyByProductId[pid] ?? 0);
                                            const ws = wh * cf;
                                            return (
                                                <tr key={pid}>
                                                    <td style={{ fontWeight: 600 }}>
                                                        {p?.name || p?.productName || '—'}
                                                    </td>
                                                    <td>{p?.sku || '—'}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {fmtQty(wh)}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {fmtQty(ws)}
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {p?.criticalStockAlert != null
                                                            ? fmtQty(Number(p.criticalStockAlert))
                                                            : '—'}
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        <RowActionsMenu
                                                            ariaLabel={t('action.aria', { name: p?.name || p?.productName || t('fallback.item') })}
                                                            items={[
                                                                {
                                                                    label: t('action.editCritical'),
                                                                    onClick: () =>
                                                                        setCriticalLevelEditProduct({
                                                                            id: p.id,
                                                                            name:
                                                                                p?.name ||
                                                                                p?.productName ||
                                                                                t('fallback.product'),
                                                                            sku: p?.sku || '',
                                                                            warehouseUnit:
                                                                                uom.warehouseUnit ||
                                                                                p?.warehouseUnit ||
                                                                                'Box',
                                                                            unit:
                                                                                uom.workshopUnit ||
                                                                                p?.workshopUnit ||
                                                                                'pcs',
                                                                            conversionFactor: cf,
                                                                            criticalLevel:
                                                                                p?.criticalStockAlert != null
                                                                                    ? Number(p.criticalStockAlert)
                                                                                    : null,
                                                                            criticalStockAlert:
                                                                                p?.criticalStockAlert != null
                                                                                    ? Number(p.criticalStockAlert)
                                                                                    : null,
                                                                        }),
                                                                },
                                                            ]}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'inventory' && (
                <>
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <Search
                                size={16}
                                style={{
                                    position: 'absolute',
                                    left: 14,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#9CA3AF',
                                    pointerEvents: 'none',
                                }}
                                aria-hidden
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t('search.products')}
                                style={{
                                    width: '100%',
                                    padding: '11px 14px 11px 42px',
                                    borderRadius: 10,
                                    border: '1px solid var(--color-border)',
                                    fontSize: '0.875rem',
                                }}
                            />
                        </div>
                        <p
                            style={{
                                margin: '8px 0 0',
                                fontSize: '0.8125rem',
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            {t('hint.rowTimeline')}
                        </p>
                        {!loading ? (
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: 10,
                                    marginTop: 10,
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setCriticalOnly((v) => !v)}
                                    className="btn-portal-outline"
                                    style={{
                                        borderColor: criticalOnly ? '#DC2626' : undefined,
                                        color: criticalOnly ? '#DC2626' : undefined,
                                        fontWeight: 700,
                                    }}
                                    title={
                                        criticalOnly
                                            ? t('title.criticalOn')
                                            : t('title.criticalOff')
                                    }
                                >
                                    {criticalOnly ? t('btn.criticalOn') : t('btn.critical')}
                                </button>
                                <span
                                    style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: 'var(--color-text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    {t('export.label')}
                                </span>
                                <button
                                    type="button"
                                    disabled={filteredList.length === 0}
                                    title={
                                        filteredList.length === 0
                                            ? t('export.nothingFilters')
                                            : t('export.xlsx')
                                    }
                                    onClick={() => {
                                        exportStockInventoryExcel(filteredList, 'supplier-stock-inventory');
                                    }}
                                    style={{
                                        ...exportToolbarBtnStyle,
                                        opacity: filteredList.length === 0 ? 0.5 : 1,
                                        cursor:
                                            filteredList.length === 0 ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <FileSpreadsheet size={14} aria-hidden /> {t('btn.excel')}
                                </button>
                                <button
                                    type="button"
                                    disabled={filteredList.length === 0}
                                    title={
                                        filteredList.length === 0
                                            ? t('export.nothing')
                                            : t('export.pdf')
                                    }
                                    onClick={() => {
                                        exportStockInventoryPdf(filteredList, 'supplier-stock-inventory');
                                    }}
                                    style={{
                                        ...exportToolbarBtnStyle,
                                        opacity: filteredList.length === 0 ? 0.5 : 1,
                                        cursor:
                                            filteredList.length === 0 ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <FileText size={14} aria-hidden /> {t('btn.pdf')}
                                </button>
                                {search.trim() ? (
                                    <span
                                        style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        {filteredList.length === 1
                                            ? t('matchSearch', { n: filteredList.length })
                                            : t('matchSearchPlural', { n: filteredList.length })}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    {loading ? (
                        <div className="ws-section">
                            <ShimmerTable rows={10} columns={11} />
                        </div>
                    ) : (
                        <div className="ws-section">
                            <div style={{ overflowX: 'auto' }}>
                                <table className="ws-table">
                                    <thead>
                                        <tr>
                                            <SortableTh label={t('th.product')} columnKey="product" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.sku')} columnKey="sku" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.unit')} columnKey="unit" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.stockQty')} columnKey="stockQty" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.awaiting')} columnKey="awaiting" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.criticalLevel')} columnKey="critical" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.reorderLevel')} columnKey="reorder" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.purchasePrice')} columnKey="price" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.salesPrice')} columnKey="salePrice" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.value')} columnKey="value" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <SortableTh label={t('th.status')} columnKey="status" sortKey={stockSort.sortKey} sortDir={stockSort.sortDir} onSort={stockSort.toggleSort} />
                                            <th>{t('th.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stockSort
                                            .sortRows(filteredList, {
                                                product: (s) => s.name,
                                                sku: (s) => s.sku,
                                                unit: (s) => s.warehouseUnit || s.unit,
                                                stockQty: (s) => Number(s.warehouseQty ?? s.qty ?? 0),
                                                awaiting: (s) => Number(s.pendingWorkshopReceive ?? 0),
                                                critical: (s) => Number(s.criticalLevel ?? 0),
                                                reorder: (s) => Number(s.reorder ?? 0),
                                                price: (s) => Number(s.price ?? 0),
                                                salePrice: (s) => Number(s.salePrice ?? 0),
                                                value: (s) => Number(warehouseStockLineValueSar(s) ?? 0),
                                                status: (s) =>
                                                    s.qty <= (s.criticalLevel ?? 0) ? 'critical' : 'ok',
                                            })
                                            .map((s) => {
                                            const value = warehouseStockLineValueSar(s);
                                            const isCritical = s.qty <= (s.criticalLevel ?? 0);
                                            return (
                                                <tr
                                                    key={s.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => openTimeline(s)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            openTimeline(s);
                                                        }
                                                    }}
                                                    style={{
                                                        cursor: 'pointer',
                                                    }}
                                                    className="ws-inv-row-clickable"
                                                >
                                                    <td>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: 4,
                                                                alignItems: 'flex-start',
                                                            }}
                                                        >
                                                            <span style={{ fontWeight: 700 }}>{s.name}</span>
                                                            <span
                                                                style={{
                                                                    fontSize: '0.7rem',
                                                                    color: 'var(--color-text-muted)',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 4,
                                                                }}
                                                            >
                                                                <History size={12} aria-hidden />
                                                                {t('row.timeline')}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                        {s.sku || '-'}
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight: 600 }}>
                                                            {s.warehouseUnit || 'Box'}
                                                        </span>
                                                        {s.unit &&
                                                        String(s.warehouseUnit || '')
                                                            .toLowerCase() !==
                                                            String(s.unit).toLowerCase() ? (
                                                            <span
                                                                style={{
                                                                    display: 'block',
                                                                    fontSize: '0.7rem',
                                                                    color: 'var(--color-text-muted)',
                                                                }}
                                                            >
                                                                → {s.unit} (×
                                                                {s.conversionFactor || 1})
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td>
                                                        <strong>
                                                            {formatDualUomQty(
                                                                s.warehouseQty,
                                                                s.warehouseUnit,
                                                                s.qty,
                                                                s.unit,
                                                            )}
                                                        </strong>
                                                    </td>
                                                    <td>
                                                        {(s.pendingWorkshopReceive || 0) > 0 ? (
                                                        <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    flexDirection: 'column',
                                                                    gap: 2,
                                                                    fontSize: '0.8125rem',
                                                                    color: '#B45309',
                                                                    fontWeight: 600,
                                                                }}
                                                                title={t('row.awaitingTitle')}
                                                            >
                                                                {fmtQty(s.pendingWorkshopReceive)}{' '}
                                                                {s.unit}
                                                                <span
                                                                    style={{
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 500,
                                                                        color: 'var(--color-text-muted)',
                                                                    }}
                                                                >
                                                                    {t('row.notReceived')}
                                                        </span>
                                                            </span>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            <span>
                                                                {s.criticalLevel != null
                                                                    ? fmtQty(s.criticalLevel)
                                                                    : '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>{s.reorder != null ? fmtQty(s.reorder) : '-'}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                            <span>
                                                                {t('money.sarPer', { amount: Number(s.price).toLocaleString(), unit: s.warehouseUnit || t('fallback.unit') })}
                                                            </span>
                                                            {s.usesCatalogPrice ? (
                                                                <span
                                                            style={{
                                                                        fontSize: '0.68rem',
                                                                        color: '#64748b',
                                                                fontWeight: 600,
                                                                    }}
                                                                >
                                                                    {t('row.fromCatalog')}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: 4,
                                                            }}
                                                        >
                                                            <span>
                                                                {s.salePrice != null &&
                                                                Number(s.salePrice) > 0
                                                                    ? t('money.sarPer', { amount: Number(s.salePrice).toLocaleString(), unit: s.unit || t('fallback.unit') })
                                                                    : '—'}
                                                            </span>
                                                            {s.salePrice != null &&
                                                            Number(s.salePrice) > 0 &&
                                                            s.salePriceWarehouse != null &&
                                                            Number(s.salePriceWarehouse) > 0 &&
                                                            String(s.warehouseUnit || '')
                                                                .trim()
                                                                .toLowerCase() !==
                                                                String(s.unit || '')
                                                                    .trim()
                                                                    .toLowerCase() ? (
                                                                <span
                                                            style={{
                                                                        fontSize: '0.68rem',
                                                                        color: '#64748b',
                                                                fontWeight: 600,
                                                                    }}
                                                                >
                                                                    {t('money.sarPer', { amount: Number(s.salePriceWarehouse).toLocaleString(), unit: s.warehouseUnit || t('fallback.unit') })}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td>{t('money.sar', { amount: value.toLocaleString() })}</td>
                                                    <td>
                                                        <span
                                                            className={`ws-badge ${isCritical ? 'ws-badge--red' : 'ws-badge--green'}`}
                                                        >
                                                            {isCritical ? t('status.critical') : t('status.ok')}
                                                        </span>
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        <RowActionsMenu
                                                            ariaLabel={t('action.aria', { name: s.name || t('fallback.product') })}
                                                            items={[
                                                                {
                                                                    label: t('action.editPurchase'),
                                                                    onClick: () => setPurchasePriceEditProduct(s),
                                                                },
                                                                {
                                                                    label: t('action.editSales'),
                                                                    onClick: () => setSalesPriceEditProduct(s),
                                                                },
                                                                {
                                                                    label: t('action.editCritical'),
                                                                    onClick: () => setCriticalLevelEditProduct(s),
                                                                },
                                                                {
                                                                    label: t('action.adjust'),
                                                                    onClick: () => openAdjust(s),
                                                                },
                                                                {
                                                                    label: t('action.adjustPurchase'),
                                                                    onClick: () => navigateToPurchaseWithProduct(s),
                                                                },
                                                                {
                                                                    label: t('action.accounting'),
                                                                    onClick: () =>
                                                                        setAccountingHistoryProduct({
                                                                            id: s.id,
                                                                            name: s.name,
                                                                        }),
                                                                },
                                                                {
                                                                    label: t('action.remove'),
                                                                    onClick: () => removeFromStock(s),
                                                                    disabled: String(removingId) === String(s.id),
                                                                    danger: true,
                                                                },
                                                            ]}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {accountingHistoryProduct ? (
                                <SupplierProductHistoryDrawer
                                    supplierProductId={accountingHistoryProduct.id}
                                    productName={accountingHistoryProduct.name}
                                    onClose={() => setAccountingHistoryProduct(null)}
                                />
                            ) : null}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                    marginTop: 14,
                                }}
                            >
                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    {t('page.showing', { page: stockPage, shown: stock.length, total: totalSKUs })}
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        type="button"
                                        className="btn-portal-outline"
                                        onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                                        disabled={stockPage <= 1}
                                    >
                                        {t('btn.prev')}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-portal-outline"
                                        onClick={() =>
                                            setStockPage((p) =>
                                                p * STOCK_PAGE_SIZE >= (totalSKUs || 0) ? p : p + 1,
                                            )
                                        }
                                        disabled={stockPage * STOCK_PAGE_SIZE >= (totalSKUs || 0)}
                                    >
                                        {t('btn.next')}
                                    </button>
                                </div>
                            </div>
                            {filteredList.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 40 }}>
                                    <Package
                                        size={40}
                                        style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }}
                                    />
                                    <p
                                        style={{
                                            margin: 0,
                                            fontSize: '0.875rem',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        {search
                                            ? t('empty.noMatch')
                                            : t('empty.noStock')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'movements' &&
                (loading ? (
                    <div className="ws-section">
                        <ShimmerTable rows={10} columns={8} />
                    </div>
                ) : (
                    <div className="ws-section">
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'flex-end',
                                gap: 12,
                                marginBottom: 16,
                            }}
                        >
                            <div style={{ flex: '1 1 280px', maxWidth: 420, position: 'relative' }}>
                                <label
                                    htmlFor="movement-product-search"
                                style={{
                                        display: 'block',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                        marginBottom: 6,
                                    }}
                                >
                                    {t('movements.searchProduct')}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Search
                                        size={16}
                                        style={{
                                            position: 'absolute',
                                            left: 14,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#9CA3AF',
                                            pointerEvents: 'none',
                                        }}
                                        aria-hidden
                                    />
                                    <input
                                        id="movement-product-search"
                                        ref={movementSearchRef}
                                        type="text"
                                        value={movementProductSearch}
                                        onChange={(e) => {
                                            setMovementProductSearch(e.target.value);
                                            setMovementProductId(null);
                                            setMovementPickerOpen(true);
                                            setMovementPickerIdx(0);
                                        }}
                                        onFocus={() => setMovementPickerOpen(true)}
                                        onBlur={() => {
                                            window.setTimeout(() => setMovementPickerOpen(false), 150);
                                        }}
                                        onKeyDown={onMovementSearchKeyDown}
                                        placeholder={t('movements.searchPh')}
                                        autoComplete="off"
                                        role="combobox"
                                        aria-expanded={movementPickerOpen}
                                        aria-controls="movement-product-picker-list"
                                        aria-autocomplete="list"
                                style={{
                                            width: '100%',
                                            padding: '10px 36px 10px 40px',
                                            borderRadius: 10,
                                            border: '1px solid var(--color-border)',
                                            fontSize: '0.875rem',
                                        }}
                                    />
                                    {movementProductId ? (
                            <button
                                type="button"
                                            title={t('movements.clearFilter')}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={clearMovementProductFilter}
                                style={{
                                                position: 'absolute',
                                                right: 8,
                                                top: '50%',
                                                transform: 'translateY(-50%)',
                                                border: 'none',
                                                background: '#F3F4F6',
                                                borderRadius: 6,
                                                padding: '4px 8px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                color: '#64748B',
                                            }}
                                        >
                                            ✕
                            </button>
                                    ) : null}
                        </div>
                                {movementPickerOpen && movementProductOptions.length > 0 ? (
                                    <ul
                                        id="movement-product-picker-list"
                                        ref={movementPickerListRef}
                                        role="listbox"
                                                style={{
                                            position: 'absolute',
                                            zIndex: 20,
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            margin: '4px 0 0',
                                            padding: 4,
                                            listStyle: 'none',
                                            background: '#fff',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 10,
                                            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                                            maxHeight: 240,
                                            overflowY: 'auto',
                                        }}
                                    >
                                        {movementProductOptions.map((p, idx) => (
                                            <li
                                                key={String(p.id)}
                                                role="option"
                                                aria-selected={idx === movementPickerIdx}
                                                data-movement-pick-idx={idx}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onMouseEnter={() => setMovementPickerIdx(idx)}
                                                onClick={() => selectMovementProduct(p)}
                                                style={{
                                                    padding: '10px 12px',
                                                    borderRadius: 8,
                                                    cursor: 'pointer',
                                                    background:
                                                        idx === movementPickerIdx
                                                            ? '#EFF6FF'
                                                            : 'transparent',
                                                }}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                                                    {p.name}
                        </div>
                                                <div
                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--color-text-muted)',
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {t('movements.skuOnHand', { sku: p.sku || t('emdash'), qty: fmtQty(p.warehouseQty), unit: p.unit || 'pcs' })}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                                {movementPickerOpen &&
                                movementProductSearch.trim() &&
                                movementProductOptions.length === 0 ? (
                                    <div
                                    style={{
                                            position: 'absolute',
                                            zIndex: 20,
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            marginTop: 4,
                                            padding: '12px 14px',
                                            background: '#fff',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: 10,
                                            fontSize: '0.8125rem',
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                        {t('movements.noMatch')}
                            </div>
                                ) : null}
                    </div>
                            {selectedMovementProduct ? (
                            <div
                                style={{
                                        flex: '1 1 240px',
                                        padding: '12px 16px',
                                        background: '#F0FDF4',
                                        border: '1px solid #BBF7D0',
                                    borderRadius: 12,
                                }}
                            >
                                    <div
                                    style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                            color: '#166534',
                                        textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}
                                    >
                                        {selectedMovementProduct.name}
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: '#15803D', marginTop: 4 }}>
                                        {t('movements.skuCount', { sku: selectedMovementProduct.sku || t('emdash'), n: displayedMovementEntries.length })}
                                    </div>
                                    <div
                                    style={{
                                            fontSize: '1.125rem',
                                        fontWeight: 800,
                                            color: '#14532D',
                                            marginTop: 6,
                                        }}
                                    >
                                        {t('movements.finalBalance')}{' '}
                                        {formatDualUomQty(
                                            movementFinalBalance,
                                            selectedMovementProduct.warehouseUnit,
                                            (movementFinalBalance || 0) *
                                                (selectedMovementProduct.conversionFactor || 1),
                                            selectedMovementProduct.unit,
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p
                                    style={{
                                        flex: '1 1 200px',
                                        margin: 0,
                                        fontSize: '0.8125rem',
                                        color: 'var(--color-text-muted)',
                                        alignSelf: 'center',
                                    }}
                                >
                                    {t('movements.hint')}
                                </p>
                            )}
                        </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: 10,
                                marginBottom: 14,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--color-text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                }}
                            >{t('export.label')}</span>
                                    <button
                                        type="button"
                                disabled={displayedMovementEntries.length === 0}
                                        title={
                                    displayedMovementEntries.length === 0
                                        ? t('export.noMovements')
                                                    : t('export.xlsx')
                                        }
                                        onClick={() => {
                                    exportMovementsExcel(
                                        displayedMovementEntries,
                                        movementProductId
                                            ? `stock-movements-${String(selectedMovementProduct?.name || movementProductId).replace(/\s+/g, '-')}`
                                            : 'supplier-stock-movements',
                                            );
                                        }}
                                        style={{
                                            ...exportToolbarBtnStyle,
                                    opacity: displayedMovementEntries.length === 0 ? 0.5 : 1,
                                            cursor:
                                        displayedMovementEntries.length === 0
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                        }}
                                    >
                                        <FileSpreadsheet size={14} aria-hidden /> {t('btn.excel')}
                                    </button>
                                    <button
                                        type="button"
                                disabled={displayedMovementEntries.length === 0}
                                        title={
                                    displayedMovementEntries.length === 0
                                        ? t('export.noMovementsShort')
                                                    : t('export.pdf')
                                        }
                                        onClick={() => {
                                    exportMovementsPdf(
                                        displayedMovementEntries,
                                        movementProductId
                                            ? `stock-movements-${String(selectedMovementProduct?.name || movementProductId).replace(/\s+/g, '-')}`
                                            : 'supplier-stock-movements',
                                            );
                                        }}
                                        style={{
                                            ...exportToolbarBtnStyle,
                                    opacity: displayedMovementEntries.length === 0 ? 0.5 : 1,
                                            cursor:
                                        displayedMovementEntries.length === 0
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                        }}
                                    >
                                        <FileText size={14} aria-hidden /> {t('btn.pdf')}
                                    </button>
                                </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table">
                                        <thead>
                                    <tr>
                                        <th>{t('th.when')}</th>
                                        {!movementProductId ? <th>{t('th.product')}</th> : null}
                                        <th>{t('th.fromWh')}</th>
                                        <th>{t('th.toWh')}</th>
                                        <th>{t('th.deltaWh')}</th>
                                        <th>{t('th.wsEquiv')}</th>
                                        <th>{t('th.reason')}</th>
                                        <th>{t('th.sourceRef')}</th>
                                        <th>{t('th.by')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                    {displayedMovementEntries.map((e) => (
                                        <tr key={e.id}>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                                                        {new Date(e.at).toLocaleString()}
                                                    </td>
                                            {!movementProductId ? (
                                                <td>{e.productLabel}</td>
                                            ) : null}
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.8125rem' }}>
                                                {fmtQty(e.previousQty)} {e.warehouseUnit || 'Box'}
                                                    </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.8125rem' }}>
                                                {fmtQty(e.newQty)} {e.warehouseUnit || 'Box'}
                                                    </td>
                                                    <td
                                                        style={{
                                                            textAlign: 'right',
                                                            fontWeight: 700,
                                                            color:
                                                        e.delta == null || !Number.isFinite(Number(e.delta))
                                                                    ? 'var(--color-text-muted)'
                                                                    : Number(e.delta) >= 0
                                                                      ? '#047857'
                                                                      : '#B91C1C',
                                                        }}
                                                    >
                                                {fmtDelta(e.delta)} {e.warehouseUnit || 'Box'}
                                                    </td>
                                                        <td
                                                            style={{
                                                    textAlign: 'right',
                                                    fontSize: '0.8125rem',
                                                                color: 'var(--color-text-muted)',
                                                }}
                                            >
                                                {e.deltaWorkshop != null
                                                    ? `${fmtDelta(e.deltaWorkshop)} ${e.workshopUnit || 'Liter'}`
                                                    : e.conversionFactor > 1
                                                      ? `${fmtQty((e.previousQtyWorkshop ?? e.previousQty * e.conversionFactor))} → ${fmtQty((e.newQtyWorkshop ?? e.newQty * e.conversionFactor))} ${e.workshopUnit || 'Liter'}`
                                                      : '—'}
                                            </td>
                                            <td>{e.reason}</td>
                                            <td
                                                style={{
                                                    fontSize: '0.8125rem',
                                                    color: 'var(--color-text-muted)',
                                                    maxWidth: 280,
                                                            }}
                                                        >
                                                            {formatSupplierTimelineSourceRef(e)}
                                                        </td>
                                            <td style={{ fontSize: '0.8125rem' }}>
                                                            {e.adjustedBy?.name || '—'}
                                                        </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                        {displayedMovementEntries.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 48 }}>
                                <TrendingUp
                                    size={48}
                                    style={{
                                        opacity: 0.3,
                                        margin: '0 auto 16px',
                                        display: 'block',
                                    }}
                                />
                                <p
                                    style={{
                                        margin: 0,
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                    }}
                                >
                                    {movementProductId
                                        ? t('empty.noMovementsProduct')
                                        : t('empty.noMovements')}
                                </p>
                        </div>
                )}
                    </div>
                ))}

            <AnimatePresence>
                {adjustModalOpen && adjustItem && (
                    <Modal
                        title={t('adjust.title', { name: adjustItem.name })}
                        disableClose={adjustConfirming}
                        onClose={() => {
                            setAdjustModalOpen(false);
                            setAdjustItem(null);
                            setAdjustConfirming(false);
                        }}
                        footer={
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="btn-portal-outline"
                                    disabled={adjustConfirming}
                                    onClick={() => {
                                        setAdjustModalOpen(false);
                                        setAdjustItem(null);
                                        setAdjustConfirming(false);
                                    }}
                                >
                                    {t('btn.cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none' }}
                                    disabled={
                                        adjustConfirming ||
                                        adjustQty === '' ||
                                        !Number.isFinite(
                                            Number.parseFloat(String(adjustQty).replace(/,/g, '')),
                                        ) ||
                                        Number.parseFloat(String(adjustQty).replace(/,/g, '')) <
                                            0 ||
                                        (adjustmentType !== 'set' &&
                                            Number.parseFloat(String(adjustQty).replace(/,/g, '')) <=
                                                0)
                                    }
                                    onClick={handleConfirmAdjustment}
                                >
                                    {adjustConfirming ? t('adjust.confirming') : t('adjust.confirm')}
                                </button>
                            </div>
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: 4,
                                    }}
                                >
                                    {t('adjust.current')}
                                </label>
                                <p
                                    style={{
                                        fontSize: '1.25rem',
                                        fontWeight: 700,
                                        color: 'var(--color-text-dark)',
                                        margin: 0,
                                    }}
                                >
                                    {formatDualUomQty(
                                        adjustItem.warehouseQty,
                                        adjustItem.warehouseUnit || 'Box',
                                        adjustItem.qty,
                                        adjustItem.unit,
                                    )}
                                </p>
                                {adjustItem.unit &&
                                adjustItem.warehouseUnit &&
                                String(adjustItem.warehouseUnit).toLowerCase() !==
                                    String(adjustItem.unit).toLowerCase() ? (
                                    <p
                                        style={{
                                            margin: '6px 0 0',
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        {t('adjust.conv', {
                                            wh: adjustItem.warehouseUnit,
                                            cf: adjustItem.conversionFactor || 1,
                                            ws: adjustItem.unit,
                                        })}
                                    </p>
                                ) : null}
                            </div>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: 8,
                                    }}
                                >
                                    {t('adjust.type')}
                                </label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentType('add')}
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)',
                                            background:
                                                adjustmentType === 'add' ? 'var(--color-text-dark)' : 'var(--color-bg-muted)',
                                            color:
                                                adjustmentType === 'add' ? '#fff' : 'var(--color-text-body)',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {t('adjust.add')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentType('remove')}
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            borderRadius: 8,
                                            border: 'none',
                                            background: adjustmentType === 'remove' ? '#DC2626' : '#FEE2E2',
                                            color: adjustmentType === 'remove' ? '#fff' : '#B91C1C',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {t('adjust.remove')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustmentType('set')}
                                        style={{
                                            flex: 1,
                                            minWidth: 120,
                                            padding: '10px 14px',
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)',
                                            background:
                                                adjustmentType === 'set'
                                                    ? '#1D4ED8'
                                                    : '#EFF6FF',
                                            color:
                                                adjustmentType === 'set' ? '#fff' : '#1E40AF',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {t('adjust.set')}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: 6,
                                    }}
                                >
                                    {adjustmentType === 'set'
                                        ? t('adjust.newLevel', { unit: adjustItem.warehouseUnit || 'Box' })
                                        : t('adjust.qty', { unit: adjustItem.warehouseUnit || 'Box' })}
                                </label>
                                <input
                                    type="number"
                                    min={adjustmentType === 'set' ? '0' : '0.001'}
                                    step="any"
                                    value={adjustQty}
                                    onChange={(e) => setAdjustQty(e.target.value)}
                                    placeholder={
                                        adjustmentType === 'set'
                                            ? t('adjust.phSet', { unit: adjustItem.warehouseUnit || 'Box' })
                                            : t('adjust.phQty', { unit: adjustItem.warehouseUnit || 'Box' })
                                    }
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.875rem',
                                    }}
                                />
                                {(() => {
                                    const delta =
                                        Number.parseFloat(String(adjustQty).replace(/,/g, '')) ??
                                        NaN;
                                    if (!Number.isFinite(delta)) return null;
                                    if (adjustmentType !== 'set' && !(delta > 0)) return null;
                                    if (adjustmentType === 'set' && delta < 0) return null;
                                    const cf = Number(adjustItem.conversionFactor) || 1;
                                    const curWh = Number(adjustItem.warehouseQty) || 0;
                                    const newWh =
                                        adjustmentType === 'set'
                                            ? delta
                                            : adjustmentType === 'add'
                                              ? curWh + delta
                                              : Math.max(0, curWh - delta);
                                    const newWs = Math.round(newWh * cf * 1000) / 1000;
                                    const whUnit = adjustItem.warehouseUnit || 'Box';
                                    const wsUnit = adjustItem.unit || 'Liter';
                                    const hasSplit =
                                        cf > 1 &&
                                        wsUnit.toLowerCase() !== whUnit.toLowerCase();
                                    return (
                                        <p
                                            style={{
                                                margin: '8px 0 0',
                                                fontSize: '0.8125rem',
                                                color: 'var(--color-text-body)',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {hasSplit
                                                ? t('adjust.afterSplit', {
                                                      qty: fmtQty(newWh),
                                                      unit: whUnit,
                                                      wsQty: fmtQty(newWs),
                                                      wsUnit,
                                                  })
                                                : t('adjust.after', {
                                                      qty: fmtQty(newWh),
                                                      unit: whUnit,
                                                  })}
                                        </p>
                                    );
                                })()}
                            </div>
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        color: 'var(--color-text-muted)',
                                        marginBottom: 6,
                                    }}
                                >
                                    {t('adjust.notes')}
                                </label>
                                <textarea
                                    value={adjustNotes}
                                    onChange={(e) => setAdjustNotes(e.target.value)}
                                    rows={3}
                                    placeholder={t('adjust.notesPh')}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.875rem',
                                        resize: 'vertical',
                                    }}
                                />
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>


            {purchasePriceEditProduct ? (
                <StockProductPurchasePriceEditModal
                    product={purchasePriceEditProduct}
                    onClose={() => setPurchasePriceEditProduct(null)}
                    onSaved={() => loadStock({ silent: true })}
                    locale={locale}
                />
            ) : null}

            {salesPriceEditProduct ? (
                <StockProductSalesPriceEditModal
                    product={salesPriceEditProduct}
                    onClose={() => setSalesPriceEditProduct(null)}
                    locale={locale}
                    onSaved={(saved) => {
                        const productId = salesPriceEditProduct?.id;
                        if (productId && saved?.salePrice != null) {
                            setStock((prev) =>
                                prev.map((row) =>
                                    String(row.id) === String(productId)
                                        ? {
                                              ...row,
                                              salePrice: Number(saved.salePrice),
                                              salePriceWarehouse:
                                                  saved.salePriceWarehouse != null
                                                      ? Number(saved.salePriceWarehouse)
                                                      : row.salePriceWarehouse,
                                          }
                                        : row,
                                ),
                            );
                        }
                        loadStock({ silent: true });
                    }}
                />
            ) : null}

            {criticalLevelEditProduct ? (
                <StockProductCriticalLevelEditModal
                    product={criticalLevelEditProduct}
                    onClose={() => setCriticalLevelEditProduct(null)}
                    locale={locale}
                    onSaved={() => {
                        loadStock({ silent: true });
                        if (activeTab === 'items') loadItems();
                    }}
                />
            ) : null}
        </div>
    );
}
