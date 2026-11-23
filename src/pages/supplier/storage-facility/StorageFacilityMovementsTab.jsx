import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    ArrowDownCircle,
    ArrowUpCircle,
    FileSpreadsheet,
    FileText,
    Package,
    Plus,
    RotateCcw,
    Search,
    TrendingUp,
    X,
} from 'lucide-react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import { sfStamp } from './sfFormat';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import RecordBulkStockMovementModal from './RecordBulkStockMovementModal';
import {
    exportStorageMovementsExcel,
    exportStorageMovementsPdf,
} from './storageFacilityMovementsExport';
import '../../../styles/ui.css';

function fmtQty(n) {
    if (n == null || !Number.isFinite(Number(n))) return '—';
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return x.toFixed(3).replace(/\.?0+$/, '');
}

function fmtDelta(d) {
    if (d == null || !Number.isFinite(Number(d))) return '—';
    const n = Number(d);
    return n > 0 ? `+${fmtQty(n)}` : fmtQty(n);
}

/** What the movement was, and the context that explains it. */
function movementReason(t, m) {
    const kind = String(m.movementType || '').toUpperCase();
    const name = m.productName || '';
    const ctx = [];
    if (m.fromLocationName) {
        ctx.push(
            m.fromCompanyName
                ? `${m.fromLocationName} (${m.fromCompanyName})`
                : m.fromLocationName,
        );
    }
    if (m.customerName) ctx.push(m.customerName);
    if (m.salesRepName) ctx.push(t('mv.reason.rep', { name: m.salesRepName }));
    if (m.adjustmentReason) ctx.push(m.adjustmentReason);
    const suffix = ctx.length ? ` · ${ctx.join(' · ')}` : '';

    const key = `mv.reason.${kind}`;
    const headline = t(key, { name });
    if (headline !== key) return `${headline}${suffix}`;
    if (m.notes?.trim()) return m.notes.trim();
    return t('mv.reason.other', { type: m.movementType, name });
}

/** The document a movement came from, or that it was keyed in by hand. */
function movementSourceRef(t, m) {
    if (m.invoiceNo) {
        const typeKey = `inv.type.${m.invoiceType}`;
        const typeLabel = t(typeKey);
        return t('mv.src.invoice', {
            type: typeLabel === typeKey ? t('mv.src.invoiceGeneric') : typeLabel,
            no: m.invoiceNo,
        });
    }
    if (m.referenceType && m.referenceId) {
        return t('mv.src.ref', { type: m.referenceType, id: m.referenceId });
    }
    return t('mv.src.manual');
}

function mapMovementRow(t, m) {
    const delta = Number(m.quantityChange);
    const newQty = Number(m.balanceQty);
    return {
        id: m.id,
        at: m.createdAt,
        productId: m.productId,
        productLabel: m.productName,
        sku: m.sku,
        unit: m.unit || 'pcs',
        previousQty: newQty - delta,
        newQty,
        delta,
        reason: movementReason(t, m),
        sourceRef: movementSourceRef(t, m),
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
    const t = useSfT();
    const sfApi = useStorageFacilityApi();
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const [movementProductId, setMovementProductId] = useState(null);
    const [movementProductSearch, setMovementProductSearch] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerIdx, setPickerIdx] = useState(0);
    const searchRef = useRef(null);

    const [recordOpen, setRecordOpen] = useState(false);

    const loadMovements = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sfApi.listStorageMovements(brandId, { limit: 500 });
            setMovements(Array.isArray(res?.movements) ? res.movements : []);
            setLoadError(false);
        } catch {
            setMovements([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, sfApi]);

    useEffect(() => {
        loadMovements();
    }, [loadMovements, reloadKey]);

    const entries = useMemo(() => movements.map((m) => mapMovementRow(t, m)), [movements, t]);

    const productOptions = useMemo(() => {
        const list = products.filter((p) => p.isActive !== false);
        const q = movementProductSearch.trim().toLowerCase();
        if (!q) return list;
        return list.filter(
            (p) =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.sku || '').toLowerCase().includes(q),
        );
    }, [products, movementProductSearch]);

    const selectedProduct = useMemo(() => {
        if (!movementProductId) return null;
        return products.find((p) => String(p.id) === String(movementProductId)) || null;
    }, [products, movementProductId]);

    const displayedEntries = useMemo(() => {
        if (!movementProductId) return entries;
        return entries.filter((e) => String(e.productId) === String(movementProductId));
    }, [entries, movementProductId]);

    // The whole history arrives in one response, and the From/To columns read
    // as a chain, so the pager slices rather than refetches.
    const paging = usePagedRows(displayedEntries, {
        resetKey: `${brandId}|${movementProductId || ''}`,
    });

    const finalBalance = useMemo(() => {
        if (!movementProductId || !displayedEntries.length) {
            return selectedProduct?.qtyOnHand ?? null;
        }
        return displayedEntries[0]?.newQty ?? selectedProduct?.qtyOnHand ?? null;
    }, [movementProductId, displayedEntries, selectedProduct]);

    const kpis = useMemo(() => {
        let stockIn = 0;
        let stockOut = 0;
        for (const e of displayedEntries) {
            const d = Number(e.delta);
            if (d > 0) stockIn += d;
            else stockOut += Math.abs(d);
        }
        return {
            movementCount: displayedEntries.length,
            stockIn,
            stockOut,
            productCount: new Set(displayedEntries.map((r) => r.productId)).size,
        };
    }, [displayedEntries]);

    const selectProduct = useCallback((product) => {
        if (!product?.id) return;
        setMovementProductId(String(product.id));
        setMovementProductSearch(product.name || '');
        setPickerOpen(false);
        setPickerIdx(0);
    }, []);

    const clearProductFilter = useCallback(() => {
        setMovementProductId(null);
        setMovementProductSearch('');
        setPickerOpen(false);
        searchRef.current?.focus();
    }, []);

    const onSearchKeyDown = useCallback(
        (e) => {
            const options = productOptions;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setPickerOpen(true);
                setPickerIdx((i) =>
                    options.length === 0 ? 0 : Math.min(i + 1, options.length - 1),
                );
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setPickerIdx((i) => Math.max(i - 1, 0));
                return;
            }
            if (e.key === 'Enter' && options.length > 0) {
                e.preventDefault();
                selectProduct(options[pickerIdx] ?? options[0]);
            }
            if (e.key === 'Escape') setPickerOpen(false);
        },
        [productOptions, pickerIdx, selectProduct],
    );

    const exportName = `storage-movements-${brandName || brandId}`;
    const noRows = displayedEntries.length === 0;

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-kpis">
                <div className="ui-metric">
                    <span className="ui-metric-icon"><TrendingUp size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('mv.kpi.movements')}</div>
                    <div className="ui-metric-value">{kpis.movementCount}</div>
                    <div className="ui-metric-foot">
                        {movementProductId ? t('mv.kpi.movements.one') : t('mv.kpi.movements.all')}
                    </div>
                </div>
                <div className="ui-metric ui-metric--ok">
                    <span className="ui-metric-icon"><ArrowDownCircle size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('mv.kpi.in')}</div>
                    <div className="ui-metric-value">{fmtQty(kpis.stockIn)}</div>
                    <div className="ui-metric-foot">{t('mv.kpi.in.sub')}</div>
                </div>
                <div className="ui-metric ui-metric--dang">
                    <span className="ui-metric-icon"><ArrowUpCircle size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('mv.kpi.out')}</div>
                    <div className="ui-metric-value">{fmtQty(kpis.stockOut)}</div>
                    <div className="ui-metric-foot">{t('mv.kpi.out.sub')}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Package size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('mv.kpi.products')}</div>
                    <div className="ui-metric-value">{kpis.productCount || products.length}</div>
                    <div className="ui-metric-foot">{t('mv.kpi.products.sub')}</div>
                </div>
            </div>

            <div className="ui-row ui-row--fields">
                {/* The picker drops out of the field, so `.ui-search` is the
                    positioned ancestor `.ui-suggest` needs. */}
                <div className="ui-field ui-field--grow">
                    <label htmlFor="sf-movement-product-search">{t('mv.search.label')}</label>
                    <div className="ui-search">
                        <Search size={14} />
                        <input
                            id="sf-movement-product-search"
                            ref={searchRef}
                            type="text"
                            className={`ui-input${movementProductId ? ' ui-input--clearable' : ''}`}
                            value={movementProductSearch}
                            onChange={(e) => {
                                setMovementProductSearch(e.target.value);
                                setMovementProductId(null);
                                setPickerOpen(true);
                                setPickerIdx(0);
                            }}
                            onFocus={() => setPickerOpen(true)}
                            onBlur={() => {
                                window.setTimeout(() => setPickerOpen(false), 150);
                            }}
                            onKeyDown={onSearchKeyDown}
                            placeholder={t('mv.search.ph')}
                            autoComplete="off"
                            role="combobox"
                            aria-expanded={pickerOpen}
                            aria-controls="sf-movement-picker"
                        />
                        {movementProductId ? (
                            <button
                                type="button"
                                className="ui-btn ui-btn--subtle ui-btn--sm ui-btn--icon ui-search-clear"
                                title={t('mv.search.clear')}
                                aria-label={t('mv.search.clear')}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={clearProductFilter}
                            >
                                <X size={13} />
                            </button>
                        ) : null}
                        {pickerOpen && productOptions.length > 0 ? (
                            <ul id="sf-movement-picker" className="ui-suggest" role="listbox">
                                {productOptions.map((p, idx) => (
                                    <li
                                        key={p.id}
                                        role="option"
                                        aria-selected={idx === pickerIdx}
                                        className="ui-pick"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => selectProduct(p)}
                                    >
                                        <div className="ui-pick-main">
                                            <div className="ui-pick-name">{p.name}</div>
                                            <div className="ui-pick-sub">
                                                {t('mv.pick.meta', {
                                                    sku: p.sku || '—',
                                                    qty: fmtQty(p.qtyOnHand),
                                                    unit: p.unit,
                                                })}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                </div>

                <div className="ui-toolbar-end">
                    <button
                        type="button"
                        className="ui-btn ui-btn--primary ui-btn--sm"
                        onClick={() => setRecordOpen(true)}
                    >
                        <Plus size={14} /> {t('mv.record')}
                    </button>
                </div>
            </div>

            {selectedProduct ? (
                <div className="ui-stat-strip">
                    <div className="ui-stat">
                        <span className="ui-stat-label">{selectedProduct.name}</span>
                    </div>
                    <div className="ui-stat">
                        <span className="ui-stat-label">
                            {t('mv.selected.meta', {
                                sku: selectedProduct.sku || '—',
                                n: displayedEntries.length,
                            })}
                        </span>
                    </div>
                    <div className="ui-stat">
                        <span className="ui-stat-label">{t('mv.selected.balance', {
                            qty: fmtQty(finalBalance),
                            unit: selectedProduct.unit,
                        })}</span>
                    </div>
                </div>
            ) : (
                <p className="ui-help">{t('mv.search.hint')}</p>
            )}

            <div className="ui-table-wrap ui-table-wrap--scroll">
                <div className="ui-toolbar">
                    <span>{t('mv.count', { n: displayedEntries.length })}</span>
                    <div className="ui-toolbar-end">
                        <span className="ui-meta">{t('mv.export')}</span>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            disabled={noRows}
                            onClick={() => exportStorageMovementsExcel(displayedEntries, exportName)}
                        >
                            <FileSpreadsheet size={13} /> {t('mv.export.excel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            disabled={noRows}
                            onClick={() => exportStorageMovementsPdf(displayedEntries, exportName)}
                        >
                            <FileText size={13} /> {t('mv.export.pdf')}
                        </button>
                    </div>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('mv.errLoad')}</div>
                        <div className="ui-empty-sub">{t('mv.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('mv.retry')}
                        </button>
                    </div>
                ) : !loading && noRows ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><TrendingUp size={18} /></div>
                        <div className="ui-empty-title">
                            {movementProductId ? t('mv.emptyTitle.product') : t('mv.emptyTitle')}
                        </div>
                        <div className="ui-empty-sub">
                            {movementProductId ? t('mv.emptySub.product') : t('mv.emptySub')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('mv.th.when')}</th>
                                {!movementProductId ? <th>{t('mv.th.product')}</th> : null}
                                <th className="ui-num">{t('mv.th.from')}</th>
                                <th className="ui-num">{t('mv.th.to')}</th>
                                <th className="ui-num">{t('mv.th.change')}</th>
                                <th>{t('mv.th.reason')}</th>
                                <th>{t('mv.th.source')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        {!movementProductId ? (
                                            <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        ) : null}
                                        <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                    </tr>
                                ))
                            ) : paging.pagedRows.map((e) => (
                                <tr key={e.id}>
                                    {/* The API already reports the business
                                        timezone, so the stamp is cut, not parsed —
                                        `new Date()` would shift it to the reader. */}
                                    <td data-label={t('mv.th.when')} className="ui-nowrap ui-mono">
                                        {sfStamp(e.at)}
                                    </td>
                                    {!movementProductId ? (
                                        <td data-label={t('mv.th.product')}>
                                            <span className="ui-strong">{e.productLabel}</span>
                                        </td>
                                    ) : null}
                                    <td data-label={t('mv.th.from')} className="ui-num">
                                        {fmtQty(e.previousQty)} {e.unit}
                                    </td>
                                    <td data-label={t('mv.th.to')} className="ui-num">
                                        {fmtQty(e.newQty)} {e.unit}
                                    </td>
                                    <td
                                        data-label={t('mv.th.change')}
                                        className={`ui-num ui-money ui-money--${Number(e.delta) >= 0 ? 'in' : 'out'}`}
                                    >
                                        {fmtDelta(e.delta)} {e.unit}
                                    </td>
                                    <td data-label={t('mv.th.reason')}>{e.reason}</td>
                                    <td data-label={t('mv.th.source')} className="ui-meta">
                                        {e.sourceRef}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerProps} />
            </div>

            {recordOpen ? (
                <RecordBulkStockMovementModal
                    brandId={brandId}
                    brandName={brandName}
                    products={products}
                    initialProductId={movementProductId}
                    onClose={() => setRecordOpen(false)}
                    onSaved={async () => {
                        setReloadKey((k) => k + 1);
                        await onReload?.();
                    }}
                />
            ) : null}
        </div>
    );
}
