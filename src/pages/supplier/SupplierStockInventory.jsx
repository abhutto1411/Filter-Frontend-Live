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
import { ShimmerStatStrip, ShimmerTable } from '../../components/supplier/Shimmer';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import {
    fetchAllSupplierProducts,
    getSupplierInventoryStockBalances,
    getSupplierProductInventoryTimeline,
    setSupplierStock,
    updateSupplierProduct,
} from '../../services/supplierApi';
import SupplierProductHistoryDrawer from './accounting/SupplierProductHistoryDrawer';
import StockProductUomEditModal from './StockProductUomEditModal';
import {
    mapSupplierHistoryToMovementRegister,
    mapSupplierHistoryToTimelineEntries,
    formatSupplierTimelineSourceRef,
    formatDualUomQty,
} from './supplierInventoryTimelineUtils';
import {
    exportMovementsExcel,
    exportMovementsPdf,
    exportStockInventoryExcel,
    exportStockInventoryPdf,
    exportTimelineExcel,
    exportTimelinePdf,
} from './supplierInventoryExport';

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

export default function SupplierStockInventory() {
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

    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineProduct, setTimelineProduct] = useState(null);
    const [timelineEntries, setTimelineEntries] = useState([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineError, setTimelineError] = useState('');
    const [accountingHistoryProduct, setAccountingHistoryProduct] = useState(null);
    const [uomEditProduct, setUomEditProduct] = useState(null);

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
                setApiError(err?.message || 'Failed to load stock');
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
            setItemsError(e?.message || 'Failed to load inventory items');
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
                currentQtyHint ??
                res?.currentBalanceWarehouse ??
                stock.find((p) => String(p.id) === String(productId))?.warehouseQty ??
                0;
            const uom = productUomByProductId[String(productId)] || {};
            setTimelineEntries(mapSupplierHistoryToTimelineEntries(hist, currentQty, uom));
        } catch (e) {
            setTimelineError(e?.message || 'Failed to load timeline.');
            setTimelineEntries([]);
        } finally {
            setTimelineLoading(false);
        }
    };

    const openTimeline = async (row) => {
        setTimelineProduct(row);
        setTimelineOpen(true);
        setTimelineEntries([]);
        await refreshTimelineForProduct(row?.id, row?.warehouseQty ?? row?.qty);
    };

    const closeTimeline = () => {
        setTimelineOpen(false);
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
            window.alert(e?.message || 'Failed to remove item from stock');
        } finally {
            setRemovingId(null);
        }
    };

    const handleConfirmAdjustment = async () => {
        if (!adjustItem || adjustConfirming) return;
        const qtyDelta = Number.parseFloat(String(adjustQty).replace(/,/g, '')) || 0;
        if (qtyDelta <= 0 || !Number.isFinite(qtyDelta)) return;
        const cf = Number(adjustItem.conversionFactor) || 1;
        const currentWh = Number(adjustItem.warehouseQty) || 0;
        const newWarehouseQty =
            adjustmentType === 'add'
                ? currentWh + qtyDelta
                : Math.max(0, currentWh - qtyDelta);
        const newWorkshopQty = Math.round(newWarehouseQty * cf * 1000) / 1000;
        const savedId = adjustItem.id;
        setAdjustConfirming(true);
        try {
            await setSupplierStock({
                supplierProductId: String(adjustItem.id),
                supplierLocationId: String(
                    adjustItem.locationId || adjustItem.byLocation?.[0]?.supplierLocationId || '',
                ),
                currentQuantity: newWarehouseQty,
                ...(adjustNotes.trim() ? { notes: adjustNotes.trim() } : {}),
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
            if (timelineOpen && timelineProduct && String(timelineProduct.id) === String(savedId)) {
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

    const showRefCol = timelineEntries.some(
        (e) => e.source !== 'manual' || e.reference?.id || e.invoiceNo,
    );
    const showByCol = timelineEntries.some((e) => e.adjustedBy?.name || e.adjustedBy?.id);

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Stock Inventory</h2>
                    <p className="ws-page-sub">Warehouse stock levels and movements</p>
                </div>
            </div>

            {apiError ? (
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
                    <strong>Could not load stock:</strong> {apiError}
                </div>
            ) : null}

            {loading ? (
                <ShimmerStatStrip cards={4} />
            ) : (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 12,
                        marginBottom: 20,
                    }}
                >
                    <div className="ws-section" style={{ marginBottom: 0, padding: 16, textAlign: 'center' }}>
                        <p
                            style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: 'var(--color-text-muted)',
                                margin: 0,
                                textTransform: 'uppercase',
                            }}
                        >
                            Total SKUs
                        </p>
                        <p
                            style={{
                                fontSize: '1.5rem',
                                fontWeight: 800,
                                color: 'var(--color-text-dark)',
                                margin: '4px 0 0 0',
                            }}
                        >
                            {totalSKUs}
                        </p>
                    </div>
                    <div
                        className="ws-section"
                        style={{
                            marginBottom: 0,
                            padding: 16,
                            textAlign: 'center',
                            borderLeft: '4px solid #DC2626',
                        }}
                    >
                        <p
                            style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: '#B91C1C',
                                margin: 0,
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                            }}
                        >
                            <AlertTriangle size={14} /> Critical
                        </p>
                        <p
                            style={{
                                fontSize: '1.5rem',
                                fontWeight: 800,
                                color: '#DC2626',
                                margin: '4px 0 0 0',
                            }}
                        >
                            {criticalCount}
                        </p>
                    </div>
                    <div
                        className="ws-section"
                        style={{
                            marginBottom: 0,
                            padding: 16,
                            textAlign: 'center',
                            background: '#FEF3C7',
                            border: '1px solid #FDE68A',
                        }}
                    >
                        <p
                            style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: '#B45309',
                                margin: 0,
                                textTransform: 'uppercase',
                            }}
                        >
                            Reorder Needed
                        </p>
                        <p
                            style={{
                                fontSize: '1.5rem',
                                fontWeight: 800,
                                color: '#B45309',
                                margin: '4px 0 0 0',
                            }}
                        >
                            {reorderNeededCount}
                        </p>
                    </div>
                    <div
                        className="ws-section"
                        style={{
                            marginBottom: 0,
                            padding: 16,
                            textAlign: 'center',
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                        }}
                    >
                        <p
                            style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: '#1D4ED8',
                                margin: 0,
                                textTransform: 'uppercase',
                            }}
                        >
                            Inventory Value
                        </p>
                        <p
                            style={{
                                fontSize: '1.5rem',
                                fontWeight: 800,
                                color: '#1D4ED8',
                                margin: '4px 0 0 0',
                            }}
                        >
                            SAR {inventoryValue.toLocaleString()}
                        </p>
                    </div>
                </div>
            )}

            <div
                style={{
                    display: 'flex',
                    gap: 0,
                    borderBottom: '2px solid var(--color-border)',
                    marginBottom: 16,
                }}
            >
                <button
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    style={{
                        padding: '10px 20px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        border: 'none',
                        borderBottom:
                            activeTab === 'inventory' ? '2px solid #2563EB' : '2px solid transparent',
                        marginBottom: -2,
                        background: 'none',
                        color: activeTab === 'inventory' ? '#2563EB' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                    }}
                >
                    Stock Inventory
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('items')}
                    style={{
                        padding: '10px 20px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        border: 'none',
                        borderBottom:
                            activeTab === 'items' ? '2px solid #2563EB' : '2px solid transparent',
                        marginBottom: -2,
                        background: 'none',
                        color: activeTab === 'items' ? '#2563EB' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                    }}
                >
                    Inventory items
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('movements')}
                    style={{
                        padding: '10px 20px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        border: 'none',
                        borderBottom:
                            activeTab === 'movements' ? '2px solid #2563EB' : '2px solid transparent',
                        marginBottom: -2,
                        background: 'none',
                        color: activeTab === 'movements' ? '#2563EB' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                    }}
                >
                    Stock Movements
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
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>Inventory items</h3>
                            <p
                                style={{
                                    margin: '4px 0 0',
                                    fontSize: '0.8125rem',
                                    color: 'var(--color-text-muted)',
                                }}
                            >
                                Shows all catalog items (including 0 quantity). Use Critical to
                                toggle critical-only view.
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
                                {criticalOnly ? 'Critical (ON)' : 'Critical'}
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                onClick={loadItems}
                                disabled={itemsLoading}
                            >
                                {itemsLoading ? 'Refreshing…' : 'Refresh'}
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
                            placeholder="Search items by name or SKU..."
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
                                        <th>Product</th>
                                        <th>SKU</th>
                                        <th style={{ textAlign: 'right' }}>Qty (warehouse)</th>
                                        <th style={{ textAlign: 'right' }}>Qty (workshop)</th>
                                        <th style={{ textAlign: 'right' }}>Critical</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(inventoryItems || [])
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
                                                </tr>
                                            );
                                        })}
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
                                placeholder="Search products by name or SKU..."
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
                            Click a <strong>row</strong> to open <strong>Inventory stock timeline</strong> (audit log).
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
                                            ? 'Showing critical + low stock only (click to release)'
                                            : 'Show only critical/low stock (click to toggle)'
                                    }
                                >
                                    {criticalOnly ? 'Critical (ON)' : 'Critical'}
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
                                    Export
                                </span>
                                <button
                                    type="button"
                                    disabled={filteredList.length === 0}
                                    title={
                                        filteredList.length === 0
                                            ? 'Nothing to export for the current filters'
                                            : 'Download spreadsheet (.xlsx)'
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
                                    <FileSpreadsheet size={14} aria-hidden /> Excel
                                </button>
                                <button
                                    type="button"
                                    disabled={filteredList.length === 0}
                                    title={
                                        filteredList.length === 0
                                            ? 'Nothing to export'
                                            : 'Download PDF'
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
                                    <FileText size={14} aria-hidden /> PDF
                                </button>
                                {search.trim() ? (
                                    <span
                                        style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        ({filteredList.length} row{filteredList.length !== 1 ? 's' : ''}{' '}
                                        match search)
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    {criticalItems.length > 0 && (
                        <div
                            style={{
                                marginBottom: 16,
                                padding: 14,
                                background: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: 12,
                                borderLeft: '4px solid #DC2626',
                            }}
                        >
                            <p
                                style={{
                                    fontWeight: 700,
                                    fontSize: '0.875rem',
                                    color: '#B91C1C',
                                    margin: 0,
                                }}
                            >
                                Critical Stock Alert ({criticalItems.length} item
                                {criticalItems.length !== 1 ? 's' : ''})
                            </p>
                            <div style={{ marginTop: 8 }}>
                                {criticalItems.map((s) => (
                                    <p
                                        key={s.id}
                                        style={{
                                            fontSize: '0.8125rem',
                                            color: '#B91C1C',
                                            margin: '2px 0 0 0',
                                        }}
                                    >
                                        <strong>{s.name}</strong>: {fmtQty(s.qty)} {s.unit}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="ws-section">
                            <ShimmerTable rows={10} columns={10} />
                        </div>
                    ) : (
                        <div className="ws-section">
                            <div style={{ overflowX: 'auto' }}>
                                <table className="ws-table">
                                    <thead>
                                        <tr>
                                            <th>Product</th>
                                            <th>SKU</th>
                                            <th>Unit</th>
                                            <th>Stock Qty</th>
                                            <th>Awaiting Workshop</th>
                                            <th>Critical Level</th>
                                            <th>Reorder Level</th>
                                            <th>Purchase Price</th>
                                            <th>Value</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredList.map((s) => {
                                            const value = (s.qty || 0) * (s.price || 0);
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
                                                        background: isCritical ? '#FEF2F2' : undefined,
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
                                                                Timeline
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
                                                                title="Issued on sales invoice — workshop has not approved/received yet"
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
                                                                    Not received
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            '—'
                                                        )}
                                                    </td>
                                                    <td>
                                                        {s.criticalLevel != null ? fmtQty(s.criticalLevel) : '-'}
                                                    </td>
                                                    <td>{s.reorder != null ? fmtQty(s.reorder) : '-'}</td>
                                                    <td>SAR {Number(s.price).toLocaleString()}</td>
                                                    <td>SAR {value.toLocaleString()}</td>
                                                    <td>
                                                        <span
                                                            className={`ws-badge ${isCritical ? 'ws-badge--red' : 'ws-badge--green'}`}
                                                        >
                                                            {isCritical ? 'Critical' : 'OK'}
                                                        </span>
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setUomEditProduct(s);
                                                            }}
                                                            style={{
                                                                padding: '6px 10px',
                                                                borderRadius: 6,
                                                                border: '1px solid #e0e7ff',
                                                                background: '#eef2ff',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 4,
                                                            }}
                                                            title="Edit warehouse / workshop UOM and conversion factor"
                                                        >
                                                            <Pencil size={12} /> Edit UOM
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openAdjust(s);
                                                            }}
                                                            style={{
                                                                marginLeft: 6,
                                                                padding: '6px 10px',
                                                                borderRadius: 6,
                                                                border: '1px solid var(--color-border)',
                                                                background: '#fff',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            Adjust
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigateToPurchaseWithProduct(s);
                                                            }}
                                                            style={{
                                                                marginLeft: 6,
                                                                padding: '6px 10px',
                                                                borderRadius: 6,
                                                                border: '1px solid var(--color-border)',
                                                                background: '#fff',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 4,
                                                            }}
                                                        >
                                                            <Pencil size={12} /> Adjust via Purchase
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setAccountingHistoryProduct({ id: s.id, name: s.name });
                                                            }}
                                                            style={{
                                                                marginLeft: 6,
                                                                padding: '6px 10px',
                                                                borderRadius: 6,
                                                                border: '1px solid var(--color-border)',
                                                                background: '#fff',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 4,
                                                            }}
                                                            title="View moving-average inventory history (accounting)"
                                                        >
                                                            <History size={12} /> Accounting
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                removeFromStock(s);
                                                            }}
                                                            disabled={String(removingId) === String(s.id)}
                                                            style={{
                                                                marginLeft: 6,
                                                                padding: '6px 10px',
                                                                borderRadius: 6,
                                                                border: '1px solid #fecaca',
                                                                background:
                                                                    String(removingId) === String(s.id)
                                                                        ? '#fee2e2'
                                                                        : '#fff',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                cursor:
                                                                    String(removingId) === String(s.id)
                                                                        ? 'not-allowed'
                                                                        : 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                                color: '#b91c1c',
                                                            }}
                                                            title="Remove from your stock list"
                                                        >
                                                            Remove
                                                        </button>
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
                                    Page <strong>{stockPage}</strong> · Showing{' '}
                                    <strong>{stock.length}</strong> of <strong>{totalSKUs}</strong>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        type="button"
                                        className="btn-portal-outline"
                                        onClick={() => setStockPage((p) => Math.max(1, p - 1))}
                                        disabled={stockPage <= 1}
                                    >
                                        Prev
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
                                        Next
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
                                            ? 'No products match your search'
                                            : 'No stock items yet'}
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
                                    Search product
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
                                        placeholder="Type product name or SKU… (↑↓ Enter)"
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
                                            title="Clear product filter"
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
                                                    SKU: {p.sku || '—'} · On hand:{' '}
                                                    {fmtQty(p.warehouseQty)} {p.unit || 'pcs'}
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
                                        No products match
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
                                        SKU {selectedMovementProduct.sku || '—'} ·{' '}
                                        {displayedMovementEntries.length} movement(s)
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '1.125rem',
                                            fontWeight: 800,
                                            color: '#14532D',
                                            marginTop: 6,
                                        }}
                                    >
                                        Final balance:{' '}
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
                                    Select a product to view its full movement history and final
                                    warehouse balance. Leave empty to see all products.
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
                            >
                                Export
                            </span>
                            <button
                                type="button"
                                disabled={displayedMovementEntries.length === 0}
                                title={
                                    displayedMovementEntries.length === 0
                                        ? 'No movements to export'
                                        : 'Download spreadsheet (.xlsx)'
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
                                <FileSpreadsheet size={14} aria-hidden /> Excel
                            </button>
                            <button
                                type="button"
                                disabled={displayedMovementEntries.length === 0}
                                title={
                                    displayedMovementEntries.length === 0
                                        ? 'No movements'
                                        : 'Download PDF'
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
                                <FileText size={14} aria-hidden /> PDF
                            </button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table">
                                <thead>
                                    <tr>
                                        <th>When</th>
                                        {!movementProductId ? <th>Product</th> : null}
                                        <th>From (warehouse)</th>
                                        <th>To (warehouse)</th>
                                        <th>Δ (warehouse)</th>
                                        <th>Workshop equiv.</th>
                                        <th>Reason</th>
                                        <th>Source / Ref</th>
                                        <th>By</th>
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
                                        ? 'No movements for this product yet'
                                        : 'No movements yet'}
                                </p>
                            </div>
                        )}
                    </div>
                ))}

            <AnimatePresence>
                {timelineOpen && timelineProduct && (
                    <Modal
                        title="Inventory stock timeline"
                        width="780px"
                        onClose={closeTimeline}
                    >
                        <div style={{ padding: '0 24px 24px' }}>
                            <div
                                style={{
                                    marginBottom: 20,
                                    padding: '14px 16px',
                                    background: '#F9FAFB',
                                    borderRadius: 12,
                                    border: '1px solid var(--color-border-light)',
                                }}
                            >
                                <p
                                    style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        color: 'var(--color-text-muted)',
                                        textTransform: 'uppercase',
                                        margin: '0 0 6px',
                                    }}
                                >
                                    Product
                                </p>
                                <h4
                                    style={{
                                        margin: 0,
                                        fontSize: '1.05rem',
                                        fontWeight: 800,
                                    }}
                                >
                                    {timelineProduct.name}
                                </h4>
                                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    SKU: <strong>{timelineProduct.sku || '—'}</strong> · Opening (adoption):{' '}
                                    <strong>{fmtQty(timelineProduct.openingAdoption)}</strong> · Current stock:{' '}
                                    <strong>
                                        {formatDualUomQty(
                                            stock.find((p) => String(p.id) === String(timelineProduct.id))
                                                ?.warehouseQty ?? timelineProduct.warehouseQty ?? 0,
                                            timelineProduct.warehouseUnit || 'Box',
                                            stock.find((p) => String(p.id) === String(timelineProduct.id))?.qty ??
                                                timelineProduct.qty ??
                                                0,
                                            timelineProduct.unit || 'Liter',
                                        )}
                                    </strong>
                                </p>
                                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                    {locationSummary(timelineProduct)}
                                </p>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: 8,
                                        marginTop: 12,
                                    }}
                                >
                                    <button
                                        type="button"
                                        disabled={
                                            timelineLoading ||
                                            timelineError ||
                                            !timelineEntries.length
                                        }
                                        title={
                                            timelineLoading
                                                ? 'Loading…'
                                                : timelineError
                                                  ? 'Fix load error before export'
                                                  : !timelineEntries.length
                                                    ? 'No timeline rows to export'
                                                    : 'Download spreadsheet (.xlsx)'
                                        }
                                        onClick={() => {
                                            exportTimelineExcel(
                                                timelineProduct,
                                                timelineEntries,
                                                `timeline-${String(timelineProduct.name || 'product').replace(/\s+/g, '-')}`,
                                            );
                                        }}
                                        style={{
                                            ...exportToolbarBtnStyle,
                                            opacity:
                                                timelineLoading ||
                                                timelineError ||
                                                !timelineEntries.length
                                                    ? 0.5
                                                    : 1,
                                            cursor:
                                                timelineLoading ||
                                                timelineError ||
                                                !timelineEntries.length
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                        }}
                                    >
                                        <FileSpreadsheet size={14} aria-hidden /> Excel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={
                                            timelineLoading ||
                                            timelineError ||
                                            !timelineEntries.length
                                        }
                                        title={
                                            timelineLoading
                                                ? 'Loading…'
                                                : timelineError
                                                  ? 'Fix load error before export'
                                                  : !timelineEntries.length
                                                    ? 'No timeline rows to export'
                                                    : 'Download PDF'
                                        }
                                        onClick={() => {
                                            exportTimelinePdf(
                                                timelineProduct,
                                                timelineEntries,
                                                `timeline-${String(timelineProduct.name || 'product').replace(/\s+/g, '-')}`,
                                            );
                                        }}
                                        style={{
                                            ...exportToolbarBtnStyle,
                                            opacity:
                                                timelineLoading ||
                                                timelineError ||
                                                !timelineEntries.length
                                                    ? 0.5
                                                    : 1,
                                            cursor:
                                                timelineLoading ||
                                                timelineError ||
                                                !timelineEntries.length
                                                    ? 'not-allowed'
                                                    : 'pointer',
                                        }}
                                    >
                                        <FileText size={14} aria-hidden /> PDF
                                    </button>
                                </div>
                            </div>
                            {timelineError ? (
                                <p
                                    style={{
                                        margin: '0 0 12px',
                                        padding: '10px 12px',
                                        background: '#FEF3C7',
                                        borderRadius: 8,
                                        color: '#92400E',
                                        fontSize: '0.8125rem',
                                    }}
                                >
                                    {timelineError}
                                </p>
                            ) : null}
                            {timelineLoading ? (
                                <p
                                    style={{
                                        margin: 0,
                                        padding: '40px 0',
                                        textAlign: 'center',
                                        color: 'var(--color-text-muted)',
                                        fontSize: '0.875rem',
                                    }}
                                >
                                    Loading history…
                                </p>
                            ) : !timelineEntries.length ? (
                                <p
                                    style={{
                                        margin: 0,
                                        padding: '24px 0',
                                        textAlign: 'center',
                                        color: 'var(--color-text-muted)',
                                        fontSize: '0.875rem',
                                    }}
                                >
                                    No timeline entries yet for this product.
                                </p>
                            ) : (
                                <div
                                    style={{
                                        overflowX: 'auto',
                                        maxHeight: 'min(420px, 55vh)',
                                        overflowY: 'auto',
                                        border: '1px solid var(--color-border-light)',
                                        borderRadius: 12,
                                    }}
                                >
                                    <table
                                        style={{
                                            width: '100%',
                                            borderCollapse: 'collapse',
                                            fontSize: '0.8125rem',
                                        }}
                                    >
                                        <thead>
                                            <tr style={{ background: '#F9FAFB', position: 'sticky', top: 0 }}>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '12px 14px',
                                                        fontWeight: 800,
                                                        color: 'var(--color-text-muted)',
                                                        textTransform: 'uppercase',
                                                        fontSize: '0.7rem',
                                                    }}
                                                >
                                                    When
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'right',
                                                        padding: '12px 14px',
                                                        fontWeight: 800,
                                                        color: 'var(--color-text-muted)',
                                                        textTransform: 'uppercase',
                                                        fontSize: '0.7rem',
                                                    }}
                                                >
                                                    From (warehouse)
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'right',
                                                        padding: '12px 14px',
                                                        fontWeight: 800,
                                                        color: 'var(--color-text-muted)',
                                                        textTransform: 'uppercase',
                                                        fontSize: '0.7rem',
                                                    }}
                                                >
                                                    To (warehouse)
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'right',
                                                        padding: '12px 14px',
                                                        fontWeight: 800,
                                                        color: 'var(--color-text-muted)',
                                                        textTransform: 'uppercase',
                                                        fontSize: '0.7rem',
                                                    }}
                                                >
                                                    Δ (warehouse)
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'right',
                                                        padding: '12px 14px',
                                                        fontWeight: 800,
                                                        color: 'var(--color-text-muted)',
                                                        textTransform: 'uppercase',
                                                        fontSize: '0.7rem',
                                                    }}
                                                >
                                                    Workshop equiv.
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'left',
                                                        padding: '12px 14px',
                                                        fontWeight: 800,
                                                        color: 'var(--color-text-muted)',
                                                        textTransform: 'uppercase',
                                                        fontSize: '0.7rem',
                                                    }}
                                                >
                                                    Reason
                                                </th>
                                                {showRefCol ? (
                                                    <th
                                                        style={{
                                                            textAlign: 'left',
                                                            padding: '12px 14px',
                                                            fontWeight: 800,
                                                            color: 'var(--color-text-muted)',
                                                            textTransform: 'uppercase',
                                                            fontSize: '0.7rem',
                                                        }}
                                                    >
                                                        Source / Ref
                                                    </th>
                                                ) : null}
                                                {showByCol ? (
                                                    <th
                                                        style={{
                                                            textAlign: 'left',
                                                            padding: '12px 14px',
                                                            fontWeight: 800,
                                                            color: 'var(--color-text-muted)',
                                                            textTransform: 'uppercase',
                                                            fontSize: '0.7rem',
                                                        }}
                                                    >
                                                        By
                                                    </th>
                                                ) : null}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {timelineEntries.map((e) => (
                                                <tr
                                                    key={e.id}
                                                    style={{
                                                        borderBottom: '1px solid var(--color-border-light)',
                                                    }}
                                                >
                                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                        {new Date(e.at).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                                                        {formatDualUomQty(
                                                            e.previousQty,
                                                            e.warehouseUnit,
                                                            e.previousQtyWorkshop,
                                                            e.workshopUnit,
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                                                        {formatDualUomQty(
                                                            e.newQty,
                                                            e.warehouseUnit,
                                                            e.newQtyWorkshop,
                                                            e.workshopUnit,
                                                        )}
                                                    </td>
                                                    <td
                                                        style={{
                                                            padding: '12px 14px',
                                                            textAlign: 'right',
                                                            fontWeight: 700,
                                                            color:
                                                                e.delta == null ||
                                                                !Number.isFinite(Number(e.delta))
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
                                                            padding: '12px 14px',
                                                            textAlign: 'right',
                                                            color: 'var(--color-text-muted)',
                                                        }}
                                                    >
                                                        {e.deltaWorkshop != null
                                                            ? `${fmtDelta(e.deltaWorkshop)} ${e.workshopUnit || 'Liter'}`
                                                            : '—'}
                                                    </td>
                                                    <td style={{ padding: '12px 14px' }}>{e.reason}</td>
                                                    {showRefCol ? (
                                                        <td
                                                            style={{
                                                                padding: '12px 14px',
                                                                color: 'var(--color-text-muted)',
                                                                maxWidth: 320,
                                                            }}
                                                        >
                                                            {formatSupplierTimelineSourceRef(e)}
                                                        </td>
                                                    ) : null}
                                                    {showByCol ? (
                                                        <td style={{ padding: '12px 14px', color: 'var(--color-text-muted)' }}>
                                                            {e.adjustedBy?.name || '—'}
                                                        </td>
                                                    ) : null}
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
                {adjustModalOpen && adjustItem && (
                    <Modal
                        title={`Stock Adjustment — ${adjustItem.name}`}
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
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-portal"
                                    style={{ background: 'var(--color-text-dark)', color: '#fff', border: 'none' }}
                                    disabled={
                                        adjustConfirming ||
                                        !adjustQty ||
                                        Number(parseFloat(String(adjustQty))) <= 0
                                    }
                                    onClick={handleConfirmAdjustment}
                                >
                                    {adjustConfirming ? 'Confirming...' : 'Confirm Adjustment'}
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
                                    Current Stock
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
                                        1 {adjustItem.warehouseUnit} ={' '}
                                        {adjustItem.conversionFactor || 1} {adjustItem.unit}
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
                                    Adjustment Type
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
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
                                        + Add Stock
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
                                        - Remove Stock
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
                                    Quantity ({adjustItem.warehouseUnit || 'Box'}) *
                                </label>
                                <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={adjustQty}
                                    onChange={(e) => setAdjustQty(e.target.value)}
                                    placeholder={`How many ${adjustItem.warehouseUnit || 'Box'}?`}
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
                                        Number.parseFloat(String(adjustQty).replace(/,/g, '')) ||
                                        0;
                                    if (!(delta > 0)) return null;
                                    const cf = Number(adjustItem.conversionFactor) || 1;
                                    const curWh = Number(adjustItem.warehouseQty) || 0;
                                    const newWh =
                                        adjustmentType === 'add'
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
                                            After adjustment: {fmtQty(newWh)} {whUnit}
                                            {hasSplit
                                                ? ` (= ${fmtQty(newWs)} ${wsUnit})`
                                                : ''}
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
                                    Notes / Reason
                                </label>
                                <textarea
                                    value={adjustNotes}
                                    onChange={(e) => setAdjustNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Optional reason for adjustment"
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

            {uomEditProduct ? (
                <StockProductUomEditModal
                    product={uomEditProduct}
                    onClose={() => setUomEditProduct(null)}
                    onSaved={() => loadStock({ silent: true })}
                />
            ) : null}
        </div>
    );
}
