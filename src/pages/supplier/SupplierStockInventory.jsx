import React, { useCallback, useEffect, useState, useMemo } from 'react';
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
import { getSupplierInventoryStockBalances, setSupplierStock } from '../../services/supplierApi';
import SupplierProductHistoryDrawer from './accounting/SupplierProductHistoryDrawer';
import {
    mapSupplierHistoryToTimelineEntries,
    formatSupplierTimelineSourceRef,
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
    const [movementEntries, setMovementEntries] = useState([]);
    const [activeTab, setActiveTab] = useState('inventory');
    const [search, setSearch] = useState('');
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

    const totalSKUs = stock.length;
    const criticalCount = stock.filter((s) => s.qty <= (s.criticalLevel ?? 0)).length;
    const reorderNeededCount = stock.filter(
        (s) => s.reorder != null && s.qty <= s.reorder && s.qty > (s.criticalLevel ?? 0),
    ).length;
    const inventoryValue = stock.reduce((sum, s) => sum + (s.qty || 0) * (s.price || 0), 0);
    const criticalItems = stock.filter((s) => s.qty <= (s.criticalLevel ?? 0));

    const locationSummary = (row) => {
        const locs = row?.byLocation || [];
        if (!locs.length) return '—';
        return locs
            .map((l) => `${l.locationName || '—'}: ${fmtQty(l.quantityWorkshopUnits ?? l.quantityWarehouseUnits)}`)
            .join(' · ');
    };

    const loadStock = useCallback(async (opts = {}) => {
        const silent = !!opts.silent;
        if (!silent) {
            setLoading(true);
        }
        setApiError('');
        try {
            const res = await getSupplierInventoryStockBalances({ limit: 200, historyLimit: 200 });
            const items = Array.isArray(res?.items)
                ? res.items.map((item) => ({
                      id: item.productId,
                      sku: item.sku || '-',
                      name: item.productName,
                      unit: item.workshopUnit || 'pcs',
                      openingAdoption: item.openingAdoption != null ? Number(item.openingAdoption) : null,
                      qty: Number(item.currentBalanceWorkshop || 0),
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
            setStock(items);
            setMovementEntries(mapSupplierHistoryToTimelineEntries(hist));
        } catch (err) {
            console.error('Supplier stock API failed:', err);
            if (!silent) {
                setStock([]);
                setMovementEntries([]);
                setApiError(err?.message || 'Failed to load stock');
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        loadStock();
    }, [loadStock]);

    const refreshTimelineForProduct = async (productId) => {
        if (!productId) return;
        setTimelineLoading(true);
        setTimelineError('');
        try {
            const res = await getSupplierInventoryStockBalances({
                productId: String(productId),
                historyLimit: 200,
                limit: 25,
                offset: 0,
            });
            const hist = Array.isArray(res?.transactionHistory) ? res.transactionHistory : [];
            setTimelineEntries(mapSupplierHistoryToTimelineEntries(hist));
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
        await refreshTimelineForProduct(row?.id);
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
                    unit: s.unit || 'pcs',
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

    const handleConfirmAdjustment = async () => {
        if (!adjustItem || adjustConfirming) return;
        const qtyDelta = Number.parseFloat(String(adjustQty).replace(/,/g, '')) || 0;
        if (qtyDelta <= 0 || !Number.isFinite(qtyDelta)) return;
        const currentQty = adjustItem.qty || 0;
        const newQty =
            adjustmentType === 'add'
                ? currentQty + qtyDelta
                : Math.max(0, currentQty - qtyDelta);
        const savedId = adjustItem.id;
        setAdjustConfirming(true);
        try {
            await setSupplierStock({
                supplierProductId: String(adjustItem.id),
                supplierLocationId: String(
                    adjustItem.locationId || adjustItem.byLocation?.[0]?.supplierLocationId || '',
                ),
                currentQuantity: newQty,
                ...(adjustNotes.trim() ? { notes: adjustNotes.trim() } : {}),
            });
            setStock((prev) => prev.map((s) => (s.id === adjustItem.id ? { ...s, qty: newQty } : s)));
            setAdjustModalOpen(false);
            setAdjustItem(null);
            setAdjustQty('');
            setAdjustNotes('');
            await loadStock({ silent: true });
            if (timelineOpen && timelineProduct && String(timelineProduct.id) === String(savedId)) {
                await refreshTimelineForProduct(savedId);
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
                                                    <td>{s.unit}</td>
                                                    <td>
                                                        <strong>{fmtQty(s.qty)}</strong>
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
                                                                openAdjust(s);
                                                            }}
                                                            style={{
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
                                disabled={movementEntries.length === 0}
                                title={
                                    movementEntries.length === 0
                                        ? 'No movements to export'
                                        : 'Download spreadsheet (.xlsx)'
                                }
                                onClick={() => {
                                    exportMovementsExcel(movementEntries, 'supplier-stock-movements');
                                }}
                                style={{
                                    ...exportToolbarBtnStyle,
                                    opacity: movementEntries.length === 0 ? 0.5 : 1,
                                    cursor:
                                        movementEntries.length === 0 ? 'not-allowed' : 'pointer',
                                }}
                            >
                                <FileSpreadsheet size={14} aria-hidden /> Excel
                            </button>
                            <button
                                type="button"
                                disabled={movementEntries.length === 0}
                                title={
                                    movementEntries.length === 0 ? 'No movements' : 'Download PDF'
                                }
                                onClick={() => {
                                    exportMovementsPdf(movementEntries, 'supplier-stock-movements');
                                }}
                                style={{
                                    ...exportToolbarBtnStyle,
                                    opacity: movementEntries.length === 0 ? 0.5 : 1,
                                    cursor:
                                        movementEntries.length === 0 ? 'not-allowed' : 'pointer',
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
                                        <th>Product</th>
                                        <th>From</th>
                                        <th>To</th>
                                        <th>Δ</th>
                                        <th>Reason</th>
                                        <th>Source / Ref</th>
                                        <th>By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movementEntries.map((e) => (
                                        <tr key={e.id}>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                                                {new Date(e.at).toLocaleString()}
                                            </td>
                                            <td>{e.productLabel}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {fmtQty(e.previousQty)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                                {fmtQty(e.newQty)}
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
                                                {fmtDelta(e.delta)}
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
                        {movementEntries.length === 0 && (
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
                                    No movements yet
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
                                        {fmtQty(stock.find((p) => String(p.id) === String(timelineProduct.id))?.qty ?? timelineProduct.qty)}
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
                                                    From
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
                                                    To
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
                                                    Δ
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
                                                        {fmtQty(e.previousQty)}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>
                                                        {fmtQty(e.newQty)}
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
                                                        {fmtDelta(e.delta)}
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
                                    {fmtQty(adjustItem.qty)}{' '}
                                    {adjustItem.unit || 'unit'}
                                </p>
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
                                    Quantity *
                                </label>
                                <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={adjustQty}
                                    onChange={(e) => setAdjustQty(e.target.value)}
                                    placeholder={`in ${adjustItem.unit || 'unit'}`}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.875rem',
                                    }}
                                />
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
        </div>
    );
}
