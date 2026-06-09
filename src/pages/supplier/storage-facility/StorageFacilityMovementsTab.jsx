import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    FileSpreadsheet,
    FileText,
    Package,
    Plus,
    Search,
    TrendingUp,
} from 'lucide-react';
import { ShimmerStatStrip, ShimmerTable } from '../../../components/supplier/Shimmer';
import { listStorageMovements } from '../../../services/storageFacilityApi';
import RecordBulkStockMovementModal from './RecordBulkStockMovementModal';
import {
    exportStorageMovementsExcel,
    exportStorageMovementsPdf,
} from './storageFacilityMovementsExport';
import '../../../styles/admin/AccountingPage.css';

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

function fmtQty(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return x.toFixed(3).replace(/\.?0+$/, '');
}

function fmtDelta(d) {
    if (d == null || !Number.isFinite(Number(d))) return '—';
    const n = Number(d);
    if (n > 0) return `+${fmtQty(n)}`;
    return fmtQty(n);
}

function movementReason(m) {
    const t = String(m.movementType || '').toUpperCase();
    const name = m.productName || 'product';
    const ctx = [];
    if (m.fromLocationName) {
        ctx.push(
            m.fromCompanyName
                ? `${m.fromLocationName} (${m.fromCompanyName})`
                : m.fromLocationName,
        );
    }
    if (m.customerName) ctx.push(m.customerName);
    if (m.salesRepName) ctx.push(`rep: ${m.salesRepName}`);
    if (m.adjustmentReason) ctx.push(m.adjustmentReason);
    const suffix = ctx.length ? ` · ${ctx.join(' · ')}` : '';
    if (t === 'IN') return `Stock in — ${name}${suffix}`;
    if (t === 'OUT') return `Stock out — ${name}${suffix}`;
    if (t === 'ADJUSTMENT') return `Adjustment — ${name}${suffix}`;
    if (t === 'TRANSFER_IN') return `Transfer in — ${name}`;
    if (t === 'TRANSFER_OUT') return `Transfer out — ${name}`;
    if (t === 'WITHDRAWAL_TO_OWNER') return `Withdrawal to owner — ${name}`;
    if (m.notes?.trim()) return m.notes.trim();
    return `${m.movementType} — ${name}`;
}

function movementSourceRef(m) {
    if (m.invoiceNo) {
        const typeLabel =
            m.invoiceType === 'stock_sale'
                ? 'Stock sale'
                : m.invoiceType === 'withdrawal_to_owner'
                  ? 'Withdrawal'
                  : m.invoiceType === 'storage_fee'
                    ? 'Storage fee'
                    : 'Invoice';
        return `${typeLabel} — #${m.invoiceNo}`;
    }
    if (m.referenceType && m.referenceId) {
        return `${m.referenceType} — ${m.referenceId}`;
    }
    return 'Manual entry';
}

function mapMovementRow(m) {
    const delta = Number(m.quantityChange);
    const newQty = Number(m.balanceQty);
    const prevQty = newQty - delta;
    return {
        id: m.id,
        at: m.createdAt,
        productId: m.productId,
        productLabel: m.productName,
        sku: m.sku,
        unit: m.unit || 'pcs',
        previousQty: prevQty,
        newQty,
        delta,
        reason: movementReason(m),
        sourceRef: movementSourceRef(m),
        movementType: m.movementType,
        customerName: m.customerName,
        salesRepName: m.salesRepName,
        fromLocationName: m.fromLocationName,
        raw: m,
    };
}

export default function StorageFacilityMovementsTab({
    brandId,
    brandName,
    products,
    onReload,
}) {
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    const [movementProductId, setMovementProductId] = useState(null);
    const [movementProductSearch, setMovementProductSearch] = useState('');
    const [movementPickerOpen, setMovementPickerOpen] = useState(false);
    const [movementPickerIdx, setMovementPickerIdx] = useState(0);
    const movementSearchRef = useRef(null);
    const movementPickerListRef = useRef(null);

    const [recordOpen, setRecordOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        storageProductId: '',
        movementType: 'IN',
        qty: '',
        notes: '',
        unitCost: '',
    });

    const loadMovements = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listStorageMovements(brandId, { limit: 500 });
            setMovements(Array.isArray(res?.movements) ? res.movements : []);
        } catch (e) {
            setErr(e?.message || 'Failed to load movements');
            setMovements([]);
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    useEffect(() => {
        loadMovements();
    }, [loadMovements]);

    const entries = useMemo(
        () => movements.map(mapMovementRow),
        [movements],
    );

    const movementProductOptions = useMemo(() => {
        const list = products.filter((p) => p.isActive !== false);
        const q = movementProductSearch.trim().toLowerCase();
        if (!q) return list;
        return list.filter(
            (p) =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q),
        );
    }, [products, movementProductSearch]);

    const selectedMovementProduct = useMemo(() => {
        if (!movementProductId) return null;
        return products.find((p) => String(p.id) === String(movementProductId)) || null;
    }, [products, movementProductId]);

    const displayedEntries = useMemo(() => {
        if (!movementProductId) return entries;
        return entries.filter((e) => String(e.productId) === String(movementProductId));
    }, [entries, movementProductId]);

    const movementFinalBalance = useMemo(() => {
        if (!movementProductId || !displayedEntries.length) {
            return selectedMovementProduct?.qtyOnHand ?? null;
        }
        const latest = displayedEntries[0];
        return latest?.newQty ?? selectedMovementProduct?.qtyOnHand ?? null;
    }, [movementProductId, displayedEntries, selectedMovementProduct]);

    const kpis = useMemo(() => {
        const rows = displayedEntries;
        let stockIn = 0;
        let stockOut = 0;
        for (const e of rows) {
            const d = Number(e.delta);
            if (d > 0) stockIn += d;
            else stockOut += Math.abs(d);
        }
        const productCount = new Set(rows.map((r) => r.productId)).size;
        return {
            movementCount: rows.length,
            stockIn,
            stockOut,
            productCount,
        };
    }, [displayedEntries]);

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
                setMovementPickerIdx((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter' && options.length > 0) {
                e.preventDefault();
                selectMovementProduct(options[movementPickerIdx] ?? options[0]);
            }
            if (e.key === 'Escape') setMovementPickerOpen(false);
        },
        [movementProductOptions, movementPickerIdx, selectMovementProduct],
    );

    const openRecord = () => setRecordOpen(true);

    if (loading && movements.length === 0) {
        return (
            <div className="ws-section">
                <ShimmerStatStrip cards={4} />
                <ShimmerTable rows={10} columns={7} />
            </div>
        );
    }

    return (
        <div>
            {err ? <div className="mgr-si-error" style={{ marginBottom: 12 }}>{err}</div> : null}

            <div
                className="ws-kpi-grid"
                style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    marginBottom: 16,
                    gap: 12,
                }}
            >
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">MOVEMENTS</p>
                        <p className="ws-kpi-value">{kpis.movementCount}</p>
                        <p className="ws-kpi-sub">
                            {movementProductId ? 'This product' : 'All products'}
                        </p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue">
                        <TrendingUp size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">STOCK IN</p>
                        <p className="ws-kpi-value" style={{ color: '#15803d' }}>
                            {fmtQty(kpis.stockIn)}
                        </p>
                        <p className="ws-kpi-sub">Total received (filtered)</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">
                        <ArrowDownCircle size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">STOCK OUT</p>
                        <p className="ws-kpi-value" style={{ color: '#b45309' }}>
                            {fmtQty(kpis.stockOut)}
                        </p>
                        <p className="ws-kpi-sub">Total issued (filtered)</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--yellow">
                        <ArrowUpCircle size={22} />
                    </div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">PRODUCTS</p>
                        <p className="ws-kpi-value">{kpis.productCount || products.length}</p>
                        <p className="ws-kpi-sub">With movement history</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--purple">
                        <Package size={22} />
                    </div>
                </div>
            </div>

            <div className="ws-section">
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    <button type="button" className="mgr-si-btn-new" onClick={openRecord}>
                        <Plus size={14} /> Record movement
                    </button>
                </div>

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
                            htmlFor="sf-movement-product-search"
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
                                id="sf-movement-product-search"
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
                                className="sf-movement-search-input"
                            />
                            {movementProductId ? (
                                <button
                                    type="button"
                                    title="Clear product filter"
                                    className="sf-movement-search-clear"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={clearMovementProductFilter}
                                >
                                    ✕
                                </button>
                            ) : null}
                        </div>
                        {movementPickerOpen && movementProductOptions.length > 0 ? (
                            <ul
                                ref={movementPickerListRef}
                                className="sf-movement-picker"
                                role="listbox"
                            >
                                {movementProductOptions.map((p, idx) => (
                                    <li
                                        key={p.id}
                                        role="option"
                                        aria-selected={idx === movementPickerIdx}
                                        className={
                                            idx === movementPickerIdx
                                                ? 'sf-movement-picker-item active'
                                                : 'sf-movement-picker-item'
                                        }
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => selectMovementProduct(p)}
                                    >
                                        <div className="sf-movement-picker-name">{p.name}</div>
                                        <div className="sf-movement-picker-meta">
                                            SKU: {p.sku || '—'} · On hand: {p.qtyOnHand}{' '}
                                            {p.unit}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>

                    {selectedMovementProduct ? (
                        <div className="sf-movement-selected-card">
                            <div className="sf-movement-selected-label">
                                {selectedMovementProduct.name}
                            </div>
                            <div className="sf-movement-selected-meta">
                                SKU {selectedMovementProduct.sku || '—'} ·{' '}
                                {displayedEntries.length} movement(s)
                            </div>
                            <div className="sf-movement-selected-balance">
                                Final balance: {fmtQty(movementFinalBalance)}{' '}
                                {selectedMovementProduct.unit}
                            </div>
                        </div>
                    ) : (
                        <p className="sf-movement-filter-hint">
                            Select a product to view its full movement history and final balance.
                            Leave empty to see all products.
                        </p>
                    )}
                </div>

                <div className="sf-movement-export-bar">
                    <span className="sf-movement-export-label">Export</span>
                    <button
                        type="button"
                        disabled={displayedEntries.length === 0}
                        style={{
                            ...exportToolbarBtnStyle,
                            opacity: displayedEntries.length === 0 ? 0.5 : 1,
                        }}
                        onClick={() =>
                            exportStorageMovementsExcel(
                                displayedEntries,
                                `storage-movements-${brandName || brandId}`,
                            )
                        }
                    >
                        <FileSpreadsheet size={14} /> Excel
                    </button>
                    <button
                        type="button"
                        disabled={displayedEntries.length === 0}
                        style={{
                            ...exportToolbarBtnStyle,
                            opacity: displayedEntries.length === 0 ? 0.5 : 1,
                        }}
                        onClick={() =>
                            exportStorageMovementsPdf(
                                displayedEntries,
                                `storage-movements-${brandName || brandId}`,
                            )
                        }
                    >
                        <FileText size={14} /> PDF
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>When</th>
                                {!movementProductId ? <th>Product</th> : null}
                                <th style={{ textAlign: 'right' }}>From</th>
                                <th style={{ textAlign: 'right' }}>To</th>
                                <th style={{ textAlign: 'right' }}>Change</th>
                                <th>Reason</th>
                                <th>Source / Ref</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedEntries.map((e) => (
                                <tr key={e.id}>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                                        {new Date(e.at).toLocaleString()}
                                    </td>
                                    {!movementProductId ? (
                                        <td>{e.productLabel}</td>
                                    ) : null}
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {fmtQty(e.previousQty)} {e.unit}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                        {fmtQty(e.newQty)} {e.unit}
                                    </td>
                                    <td
                                        style={{
                                            textAlign: 'right',
                                            fontWeight: 700,
                                            color:
                                                Number(e.delta) >= 0 ? '#047857' : '#B91C1C',
                                        }}
                                    >
                                        {fmtDelta(e.delta)} {e.unit}
                                    </td>
                                    <td style={{ fontSize: '0.8125rem' }}>{e.reason}</td>
                                    <td
                                        style={{
                                            fontSize: '0.8125rem',
                                            color: 'var(--color-text-muted)',
                                            maxWidth: 220,
                                        }}
                                    >
                                        {e.sourceRef}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {displayedEntries.length === 0 ? (
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
                                : 'No movements yet — record your first stock movement'}
                        </p>
                    </div>
                ) : null}
            </div>

            {recordOpen ? (
                <RecordBulkStockMovementModal
                    brandId={brandId}
                    brandName={brandName}
                    products={products}
                    initialProductId={movementProductId}
                    onClose={() => setRecordOpen(false)}
                    onSaved={async () => {
                        await loadMovements();
                        await onReload?.();
                    }}
                />
            ) : null}
        </div>
    );
}
