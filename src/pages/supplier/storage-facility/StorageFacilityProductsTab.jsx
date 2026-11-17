import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeft,
    FileSpreadsheet,
    FileText,
    Loader,
    Package,
    Plus,
    RotateCcw,
    Search,
} from 'lucide-react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import { sfDate } from './sfFormat';
import Modal from '../../../components/Modal';
import RowActionsMenu from '../../../components/RowActionsMenu';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import SearchableEntityCombobox from './SearchableEntityCombobox';
import { useColumnSort, SortableTh } from '../../../components/TableSort';
import StorageUomSelect from './StorageUomSelect';
import StorageProductStockAdjustModal from './StorageProductStockAdjustModal';
import {
    formatStockOnHandDisplay,
    formatStorageMovementQtyDisplay,
    parseProductUomSelectValue,
    productEffectiveUom,
    productUomSelectValue,
} from './storageFacilityUomUtils';
import {
    exportStorageTimelineExcel,
    exportStorageTimelinePdf,
} from './storageFacilityTimelineExport';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import '../../../styles/ui.css';

function todayYmd() {
    return toRiyadhDateISO();
}

function firstOfYearYmd() {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
}

function fmtQty(n, unit = '') {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    const s = Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(3);
    return unit ? `${s} ${unit}` : s;
}

export default function StorageFacilityProductsTab({
    brandId,
    products,
    uomProfiles = [],
    onReload,
    whSearch,
    onLoadCatalog,
}) {
    const t = useSfT();
    const sfApi = useStorageFacilityApi();
    const productSort = useColumnSort();
    const [timelineProductId, setTimelineProductId] = useState(null);
    const [timeline, setTimeline] = useState(null);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineError, setTimelineError] = useState(false);
    const [dateFrom, setDateFrom] = useState(firstOfYearYmd());
    const [dateTo, setDateTo] = useState(todayYmd());
    const [asOfDate, setAsOfDate] = useState(todayYmd());

    const [productModal, setProductModal] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [linkProduct, setLinkProduct] = useState(null);
    const [newProduct, setNewProduct] = useState({
        name: '',
        sku: '',
        unit: 'pcs',
        uomSelect: 'unit:pcs',
    });
    const [catalogMapId, setCatalogMapId] = useState('');
    const [catalogSearch, setCatalogSearch] = useState('');
    const [linkMapId, setLinkMapId] = useState('');
    const [linkMapSearch, setLinkMapSearch] = useState('');
    const [adjustProduct, setAdjustProduct] = useState(null);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogTotal, setCatalogTotal] = useState(0);
    const [busy, setBusy] = useState(false);
    const [localWh, setLocalWh] = useState(whSearch ?? []);
    const catalogSearchTimer = React.useRef(null);

    useEffect(() => {
        setLocalWh(whSearch ?? []);
    }, [whSearch]);

    const catalogOptions = useMemo(
        () =>
            (localWh || []).map((w) => ({
                id: w.id,
                label: w.name,
                subtitle: [w.sku, w.unit].filter(Boolean).join(' · ') || undefined,
            })),
        [localWh],
    );

    const searchWh = useCallback(
        async (q = '', limit) => {
            setCatalogLoading(true);
            try {
                const res = await sfApi.searchWarehouseProductsForMap(q, {
                    limit: limit ?? (q.trim() ? 200 : 5000),
                });
                setLocalWh(res?.products ?? []);
                setCatalogTotal(Number(res?.total) || (res?.products?.length ?? 0));
            } catch {
                setLocalWh([]);
                setCatalogTotal(0);
            } finally {
                setCatalogLoading(false);
            }
        },
        [sfApi],
    );

    const handleCatalogQuery = useCallback(
        (text, setText) => {
            setText(text);
            if (catalogSearchTimer.current) clearTimeout(catalogSearchTimer.current);
            catalogSearchTimer.current = setTimeout(() => {
                const q = text.trim();
                searchWh(q, q ? 200 : 5000);
            }, 280);
        },
        [searchWh],
    );

    const openLinkModal = (p) => {
        setLinkProduct(p);
        setLinkMapId(p.warehouseProduct?.id ? String(p.warehouseProduct.id) : '');
        setLinkMapSearch(p.warehouseProduct?.name ?? '');
        onLoadCatalog?.();
        searchWh('', 5000);
    };

    const loadTimeline = useCallback(async () => {
        if (!timelineProductId) return;
        setTimelineLoading(true);
        try {
            const res = await sfApi.getStorageProductTimeline(brandId, timelineProductId, {
                from: dateFrom || undefined,
                to: dateTo || undefined,
                asOf: asOfDate || dateTo || undefined,
            });
            setTimeline(res);
            setTimelineError(false);
        } catch {
            setTimeline(null);
            setTimelineError(true);
        } finally {
            setTimelineLoading(false);
        }
    }, [brandId, timelineProductId, dateFrom, dateTo, asOfDate, sfApi]);

    useEffect(() => {
        if (timelineProductId) loadTimeline();
    }, [timelineProductId, loadTimeline]);

    const openTimeline = (productId) => {
        setTimelineProductId(productId);
        setTimeline(null);
    };

    const sortedProducts = useMemo(
        () =>
            productSort.sortRows(products, {
                sku: (p) => p.sku || '',
                name: (p) => p.name || '',
                qty: (p) => Number(p.qtyOnHand ?? 0),
                whlink: (p) => p.warehouseProduct?.name || '',
                status: (p) => (p.isActive === false ? 'inactive' : 'active'),
            }),
        [products, productSort],
    );

    const listPaging = usePagedRows(sortedProducts, {
        resetKey: `${brandId}|${productSort.sortKey}|${productSort.sortDir}`,
    });

    const timelineRows = timeline?.rows ?? [];
    const timelinePaging = usePagedRows(timelineRows, {
        resetKey: `${timelineProductId}|${dateFrom}|${dateTo}|${asOfDate}`,
    });

    const saveProduct = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            if (editProduct) {
                const parsed = parseProductUomSelectValue(editProduct.uomSelect);
                await sfApi.updateStorageProduct(brandId, editProduct.id, {
                    name: editProduct.name,
                    sku: editProduct.sku,
                    ...(parsed.uomProfileId
                        ? { uomProfileId: parsed.uomProfileId }
                        : { unit: parsed.unit }),
                });
                if (!parsed.uomProfileId && parsed.unit) {
                    await sfApi.applyStorageProductUom(brandId, editProduct.id, {
                        warehouseUnit: parsed.unit,
                        workshopUnit: parsed.unit,
                        conversionFactor: 1,
                    });
                }
                setEditProduct(null);
            } else {
                const parsed = parseProductUomSelectValue(newProduct.uomSelect);
                const res = await sfApi.createStorageProduct(brandId, {
                    name: newProduct.name,
                    sku: newProduct.sku,
                    unit: parsed.unit || newProduct.unit || 'pcs',
                    uomProfileId: parsed.uomProfileId || undefined,
                    supplierProductId: catalogMapId || undefined,
                });
                const newId = res?.product?.id;
                if (newId && !parsed.uomProfileId && parsed.unit) {
                    await sfApi.applyStorageProductUom(brandId, newId, {
                        warehouseUnit: parsed.unit,
                        workshopUnit: parsed.unit,
                        conversionFactor: 1,
                    });
                }
                setProductModal(false);
                setNewProduct({ name: '', sku: '', unit: 'pcs', uomSelect: 'unit:pcs' });
                setCatalogMapId('');
                setCatalogSearch('');
            }
            await onReload();
        } catch (ex) {
            window.alert(ex?.message || t('pr.errSave'));
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async (p) => {
        try {
            await sfApi.updateStorageProduct(brandId, p.id, { isActive: !p.isActive });
            await onReload();
        } catch (ex) {
            window.alert(ex?.message || t('pr.errToggle'));
        }
    };

    const handleDelete = async (p) => {
        if (!window.confirm(t('pr.confirmDelete', { name: p.name }))) return;
        try {
            const res = await sfApi.deleteStorageProduct(brandId, p.id);
            if (timelineProductId === p.id) setTimelineProductId(null);
            await onReload();
            if (res?.softDeleted) window.alert(t('pr.softDeleted'));
        } catch (ex) {
            window.alert(ex?.message || t('pr.errDelete'));
        }
    };

    const saveLink = async (supplierProductId) => {
        const id = supplierProductId || linkMapId;
        if (!linkProduct || !id) return;
        setBusy(true);
        try {
            await sfApi.setStorageProductCatalogMap(brandId, linkProduct.id, {
                supplierProductId: id,
            });
            setLinkProduct(null);
            setLinkMapId('');
            setLinkMapSearch('');
            await onReload();
            if (timelineProductId === linkProduct.id) await loadTimeline();
        } catch (ex) {
            window.alert(ex?.message || t('pr.errLink'));
        } finally {
            setBusy(false);
        }
    };

    if (timelineProductId) {
        const p = timeline?.product ?? products.find((x) => x.id === timelineProductId);
        const kpis = timeline?.kpis ?? {};
        const timelineUom = productEffectiveUom(p || {});
        // Two units are worth naming in the header only when they differ.
        const splitTimelineUom =
            timelineUom.warehouseUnit &&
            timelineUom.workshopUnit &&
            String(timelineUom.warehouseUnit).toLowerCase() !==
                String(timelineUom.workshopUnit).toLowerCase() &&
            Number(timelineUom.conversionFactor) > 1;
        const qtyColLabel = splitTimelineUom
            ? t('pr.tl.th.qtyUnit', { unit: timelineUom.warehouseUnit })
            : t('pr.tl.th.qty');
        const balanceColLabel = splitTimelineUom
            ? t('pr.tl.th.balanceUnit', { unit: timelineUom.warehouseUnit })
            : t('pr.tl.th.balance');
        const exportOpts = {
            dateFrom,
            dateTo,
            asOfDate: kpis.asOfDate || asOfDate,
            unit: timelineUom.warehouseUnit || p?.unit || '',
            qtyColLabel,
            balanceColLabel,
        };
        const exportName = `storage-timeline-${p?.sku || p?.id}`;

        return (
            <div className="ui-root ui-root--flush ui-stack">
                <div>
                    <button
                        type="button"
                        className="ui-btn ui-btn--subtle ui-btn--sm"
                        onClick={() => setTimelineProductId(null)}
                    >
                        <ArrowLeft size={14} /> {t('pr.tl.back')}
                    </button>
                </div>

                <div className="ui-head">
                    <h1>{p?.name ?? t('pr.tl.crumb')}</h1>
                    <p>{t('pr.tl.title')}</p>
                </div>

                <div className="ui-row ui-row--fields">
                    <div className="ui-field">
                        <label htmlFor="sf-tl-from">{t('pr.tl.from')}</label>
                        <input
                            id="sf-tl-from"
                            type="date"
                            className="ui-input"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </div>
                    <div className="ui-field">
                        <label htmlFor="sf-tl-to">{t('pr.tl.to')}</label>
                        <input
                            id="sf-tl-to"
                            type="date"
                            className="ui-input"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </div>
                    <div className="ui-field">
                        <label htmlFor="sf-tl-asof">{t('pr.tl.asOf')}</label>
                        <input
                            id="sf-tl-asof"
                            type="date"
                            className="ui-input"
                            value={asOfDate}
                            onChange={(e) => setAsOfDate(e.target.value)}
                        />
                    </div>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={loadTimeline}
                        >
                            <Search size={14} /> {t('pr.tl.apply')}
                        </button>
                    </div>
                </div>

                <div className="ui-kpis">
                    <div className="ui-metric ui-metric--ok">
                        <div className="ui-metric-label">{t('pr.tl.kpi.in')}</div>
                        <div className="ui-metric-value">{fmtQty(kpis.totalStockIn, p?.unit)}</div>
                    </div>
                    <div className="ui-metric ui-metric--warn">
                        <div className="ui-metric-label">{t('pr.tl.kpi.out')}</div>
                        <div className="ui-metric-value">{fmtQty(kpis.totalStockOut, p?.unit)}</div>
                    </div>
                    <div className="ui-metric">
                        <div className="ui-metric-label">{t('pr.tl.kpi.closing')}</div>
                        <div className="ui-metric-value">{fmtQty(kpis.closingBalance, p?.unit)}</div>
                        <div className="ui-metric-foot">
                            {t('pr.tl.kpi.asOf', { date: sfDate(kpis.asOfDate || asOfDate) })}
                        </div>
                    </div>
                </div>

                <div className="ui-table-wrap ui-table-wrap--scroll">
                    <div className="ui-toolbar">
                        <span>{t('pr.tl.count', { n: timelineRows.length })}</span>
                        <div className="ui-toolbar-end">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default ui-btn--sm"
                                disabled={!timelineRows.length}
                                onClick={() =>
                                    exportStorageTimelineExcel(
                                        p,
                                        timelineRows,
                                        kpis,
                                        exportName,
                                        exportOpts,
                                    )
                                }
                            >
                                <FileSpreadsheet size={13} /> {t('pr.tl.excel')}
                            </button>
                            <button
                                type="button"
                                className="ui-btn ui-btn--default ui-btn--sm"
                                disabled={!timelineRows.length}
                                onClick={() =>
                                    exportStorageTimelinePdf(
                                        p,
                                        timelineRows,
                                        kpis,
                                        exportName,
                                        exportOpts,
                                    )
                                }
                            >
                                <FileText size={13} /> {t('pr.tl.pdf')}
                            </button>
                        </div>
                    </div>

                    {!timelineLoading && timelineError ? (
                        <div className="ui-empty">
                            <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                            <div className="ui-empty-title">{t('pr.tl.errLoad')}</div>
                            <div className="ui-empty-sub">{t('pr.tl.errSub')}</div>
                            <button
                                type="button"
                                className="ui-btn ui-btn--default ui-btn--sm"
                                onClick={loadTimeline}
                            >
                                <RotateCcw size={13} /> {t('pr.tl.retry')}
                            </button>
                        </div>
                    ) : !timelineLoading && timelineRows.length === 0 ? (
                        <div className="ui-empty">
                            <div className="ui-empty-icon"><Package size={18} /></div>
                            <div className="ui-empty-title">{t('pr.tl.emptyTitle')}</div>
                            <div className="ui-empty-sub">{t('pr.tl.emptySub')}</div>
                        </div>
                    ) : (
                        <table className="ui-table">
                            <thead>
                                <tr>
                                    <th>{t('pr.tl.th.date')}</th>
                                    <th>{t('pr.tl.th.transaction')}</th>
                                    <th>{t('pr.tl.th.reference')}</th>
                                    <th>{t('pr.tl.th.item')}</th>
                                    <th className="ui-num">{qtyColLabel}</th>
                                    <th className="ui-num">{balanceColLabel}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {timelineLoading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <tr key={`sk-${i}`} className="ui-sk-row">
                                            <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                            <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                            <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                            <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                            <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                            <td><div className="ui-sk ui-sk--text ui-sk--w40" /></td>
                                        </tr>
                                    ))
                                ) : timelinePaging.pagedRows.map((r) => (
                                    <tr key={r.id}>
                                        <td data-label={t('pr.tl.th.date')} className="ui-nowrap">
                                            {r.dateDisplay || sfDate(r.date)}
                                        </td>
                                        <td data-label={t('pr.tl.th.transaction')}>{r.transaction}</td>
                                        <td data-label={t('pr.tl.th.reference')} className="ui-meta">
                                            {r.reference}
                                        </td>
                                        <td data-label={t('pr.tl.th.item')}>{r.inventoryItem}</td>
                                        <td
                                            data-label={qtyColLabel}
                                            className={`ui-num ui-money ui-money--${r.qtyOwned < 0 ? 'out' : 'in'}`}
                                        >
                                            {r.qtyOwned > 0 ? '+' : ''}
                                            {formatStorageMovementQtyDisplay(r.qtyOwned, timelineUom)}
                                        </td>
                                        <td data-label={balanceColLabel} className="ui-num ui-strong">
                                            {formatStorageMovementQtyDisplay(r.balance, timelineUom)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <UiPager {...timelinePaging.pagerProps} />
                </div>
            </div>
        );
    }

    const sortProps = (columnKey) => ({
        columnKey,
        sortKey: productSort.sortKey,
        sortDir: productSort.sortDir,
        onSort: productSort.toggleSort,
        title: t('pr.sortHint'),
    });

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <span>{t('pr.count', { n: products.length })}</span>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => {
                                setProductModal(true);
                                onLoadCatalog?.();
                                searchWh('', 5000);
                            }}
                        >
                            <Plus size={14} /> {t('pr.add')}
                        </button>
                    </div>
                </div>

                {products.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><Package size={18} /></div>
                        <div className="ui-empty-title">{t('pr.emptyTitle')}</div>
                        <div className="ui-empty-sub">{t('pr.emptySub')}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <SortableTh label={t('pr.th.sku')} {...sortProps('sku')} />
                                <SortableTh label={t('pr.th.name')} {...sortProps('name')} />
                                <SortableTh
                                    label={t('pr.th.qty')}
                                    className="ui-num"
                                    {...sortProps('qty')}
                                />
                                <SortableTh label={t('pr.th.link')} {...sortProps('whlink')} />
                                <SortableTh label={t('pr.th.status')} {...sortProps('status')} />
                                <th aria-label={t('pr.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {listPaging.pagedRows.map((p) => {
                                const onHand = formatStockOnHandDisplay(
                                    p.qtyOnHand,
                                    productEffectiveUom(p),
                                );
                                const active = p.isActive !== false;
                                return (
                                    <tr key={p.id}>
                                        <td data-label={t('pr.th.sku')} className="ui-mono">
                                            {p.sku || '—'}
                                        </td>
                                        <td data-label={t('pr.th.name')}>
                                            {/* The name opens the product's timeline, so a
                                                keyboard reaches every row. */}
                                            <button
                                                type="button"
                                                className="ui-link"
                                                onClick={() => openTimeline(p.id)}
                                            >
                                                {p.name}
                                            </button>
                                        </td>
                                        <td data-label={t('pr.th.qty')} className="ui-num">
                                            <div className="ui-strong">{onHand.primary}</div>
                                            {onHand.secondary ? (
                                                <div className="ui-meta">{onHand.secondary}</div>
                                            ) : null}
                                        </td>
                                        <td data-label={t('pr.th.link')}>
                                            {p.warehouseProduct?.name ?? (
                                                <span className="ui-meta">{t('pr.notLinked')}</span>
                                            )}
                                        </td>
                                        <td data-label={t('pr.th.status')}>
                                            <span className={`ui-pill ui-pill--${active ? 'ok' : 'neutral'}`}>
                                                {active ? t('pr.status.active') : t('pr.status.inactive')}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="ui-rowacts">
                                                <RowActionsMenu
                                                    ariaLabel={t('pr.act.menu', { name: p.name })}
                                                    items={[
                                                        {
                                                            label: t('pr.act.adjust'),
                                                            onClick: () => setAdjustProduct(p),
                                                        },
                                                        {
                                                            label: t('pr.act.edit'),
                                                            onClick: () =>
                                                                setEditProduct({
                                                                    id: p.id,
                                                                    name: p.name,
                                                                    sku: p.sku || '',
                                                                    unit: p.unit || 'pcs',
                                                                    uomProfileId: p.uomProfileId,
                                                                    uomSelect: productUomSelectValue(
                                                                        p,
                                                                        uomProfiles,
                                                                    ),
                                                                }),
                                                        },
                                                        {
                                                            label: active
                                                                ? t('pr.act.deactivate')
                                                                : t('pr.act.activate'),
                                                            onClick: () => toggleActive(p),
                                                        },
                                                        {
                                                            label: t('pr.act.link'),
                                                            onClick: () => openLinkModal(p),
                                                        },
                                                        {
                                                            label: t('pr.act.delete'),
                                                            onClick: () => handleDelete(p),
                                                            danger: true,
                                                        },
                                                    ]}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                <UiPager {...listPaging.pagerProps} />
            </div>

            {productModal ? (
                <Modal
                    title={t('pr.modal.add')}
                    width="560px"
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={busy}
                    onClose={() => setProductModal(false)}
                >
                    <form onSubmit={saveProduct} className="ui-stack">
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-prod-catalog">
                                    {t('pr.label.catalog')}{' '}
                                    <span className="ui-field-opt">{t('pr.optional')}</span>
                                </label>
                                <SearchableEntityCombobox
                                    id="sf-prod-catalog"
                                    options={catalogOptions}
                                    value={catalogMapId}
                                    displayText={catalogSearch}
                                    onDisplayTextChange={(text) => {
                                        handleCatalogQuery(text, setCatalogSearch);
                                        if (!text.trim()) setCatalogMapId('');
                                    }}
                                    onSelect={(w) => {
                                        setCatalogMapId(String(w.id));
                                        setCatalogSearch(w.label);
                                        const full = localWh.find(
                                            (x) => String(x.id) === String(w.id),
                                        );
                                        if (full) {
                                            setNewProduct((x) => ({
                                                ...x,
                                                name: full.name || x.name,
                                                sku: full.sku || x.sku,
                                            }));
                                        }
                                    }}
                                    placeholder={t('pr.catalog.ph')}
                                />
                                <p className="ui-help">
                                    {catalogLoading
                                        ? t('pr.catalog.loading')
                                        : catalogTotal > 0
                                          ? t('pr.catalog.count', { n: catalogTotal })
                                          : t('pr.catalog.search')}
                                </p>
                                <div className="ui-row">
                                    <button
                                        type="button"
                                        className="ui-btn ui-btn--subtle ui-btn--sm"
                                        disabled={catalogLoading}
                                        onClick={() => searchWh('', 5000)}
                                    >
                                        <RotateCcw size={13} /> {t('pr.catalog.refresh')}
                                    </button>
                                </div>
                            </div>
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-prod-name">{t('pr.label.name')}</label>
                                <input
                                    id="sf-prod-name"
                                    type="text"
                                    className="ui-input"
                                    value={newProduct.name}
                                    onChange={(e) =>
                                        setNewProduct((x) => ({ ...x, name: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-prod-sku">
                                    {t('pr.label.sku')}{' '}
                                    <span className="ui-field-opt">{t('pr.optional')}</span>
                                </label>
                                <input
                                    id="sf-prod-sku"
                                    type="text"
                                    className="ui-input"
                                    value={newProduct.sku}
                                    onChange={(e) =>
                                        setNewProduct((x) => ({ ...x, sku: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-prod-unit">{t('pr.label.unit')}</label>
                                <StorageUomSelect
                                    id="sf-prod-unit"
                                    variant="product"
                                    className="ui-select"
                                    profiles={uomProfiles}
                                    value={newProduct.uomSelect}
                                    onChange={(v) => {
                                        const parsed = parseProductUomSelectValue(v);
                                        setNewProduct((x) => ({
                                            ...x,
                                            uomSelect: v,
                                            unit: parsed.unit || x.unit,
                                        }));
                                    }}
                                />
                                {uomProfiles.length === 0 ? (
                                    <p className="ui-help">{t('pr.noProfiles')}</p>
                                ) : null}
                            </div>
                        </div>

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={busy}
                                onClick={() => setProductModal(false)}
                            >
                                {t('pr.btn.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
                                {busy ? (
                                    <><Loader size={14} className="ui-spin" /> {t('pr.btn.saving')}</>
                                ) : t('pr.btn.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {editProduct ? (
                <Modal
                    title={t('pr.modal.edit')}
                    width="560px"
                    contentClassName="ui-tokens"
                    disableClose={busy}
                    onClose={() => setEditProduct(null)}
                >
                    <form onSubmit={saveProduct}>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-edit-name">{t('pr.label.name')}</label>
                                <input
                                    id="sf-edit-name"
                                    type="text"
                                    className="ui-input"
                                    value={editProduct.name}
                                    onChange={(e) =>
                                        setEditProduct((x) => ({ ...x, name: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-edit-sku">
                                    {t('pr.label.sku')}{' '}
                                    <span className="ui-field-opt">{t('pr.optional')}</span>
                                </label>
                                <input
                                    id="sf-edit-sku"
                                    type="text"
                                    className="ui-input"
                                    value={editProduct.sku ?? ''}
                                    onChange={(e) =>
                                        setEditProduct((x) => ({ ...x, sku: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-edit-unit">{t('pr.label.unit')}</label>
                                <StorageUomSelect
                                    id="sf-edit-unit"
                                    variant="product"
                                    className="ui-select"
                                    profiles={uomProfiles}
                                    value={
                                        editProduct.uomSelect ??
                                        productUomSelectValue(editProduct, uomProfiles)
                                    }
                                    onChange={(v) => {
                                        const parsed = parseProductUomSelectValue(v);
                                        setEditProduct((x) => ({
                                            ...x,
                                            uomSelect: v,
                                            unit: parsed.unit || x.unit,
                                        }));
                                    }}
                                />
                            </div>
                        </div>

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={busy}
                                onClick={() => setEditProduct(null)}
                            >
                                {t('pr.btn.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
                                {busy ? (
                                    <><Loader size={14} className="ui-spin" /> {t('pr.btn.saving')}</>
                                ) : t('pr.btn.update')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {linkProduct ? (
                <Modal
                    title={t('pr.link.title')}
                    width="580px"
                    contentClassName="ui-tokens"
                    disableClose={busy}
                    onClose={() => setLinkProduct(null)}
                >
                    <div className="ui-stack">
                        <div className="ui-panel ui-panel-pad">
                            <div className="ui-kv">
                                <span className="ui-kv-label">{t('pr.link.storageProduct')}</span>
                                <span className="ui-kv-value">
                                    {linkProduct.name}
                                    {linkProduct.sku
                                        ? ` · ${t('pr.link.sku', { sku: linkProduct.sku })}`
                                        : ''}
                                </span>
                            </div>
                            {linkProduct.warehouseProduct ? (
                                <div className="ui-kv">
                                    <span className="ui-kv-label">{t('pr.link.current')}</span>
                                    <span className="ui-kv-value">
                                        {linkProduct.warehouseProduct.name}
                                    </span>
                                </div>
                            ) : null}
                        </div>

                        {linkProduct.warehouseProduct ? null : (
                            <p className="ui-lead">{t('pr.link.lead')}</p>
                        )}

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-link-catalog">{t('pr.link.label')}</label>
                                <SearchableEntityCombobox
                                    id="sf-link-catalog"
                                    options={catalogOptions}
                                    value={linkMapId}
                                    displayText={linkMapSearch}
                                    onDisplayTextChange={(text) => {
                                        handleCatalogQuery(text, setLinkMapSearch);
                                        if (!text.trim()) setLinkMapId('');
                                    }}
                                    onSelect={(w) => {
                                        setLinkMapId(String(w.id));
                                        setLinkMapSearch(w.label);
                                    }}
                                    placeholder={t('pr.catalog.ph')}
                                    disabled={busy}
                                />
                                <p className="ui-help">
                                    {catalogLoading
                                        ? t('pr.link.loading')
                                        : catalogTotal > 0
                                          ? t('pr.link.count', { n: catalogTotal })
                                          : t('pr.link.none')}
                                </p>
                            </div>
                        </div>

                        <div className="ui-form-foot ui-form-foot--split">
                            <button
                                type="button"
                                className="ui-btn ui-btn--subtle ui-btn--sm"
                                disabled={busy || catalogLoading}
                                onClick={() => searchWh('', 5000)}
                            >
                                <RotateCcw size={13} /> {t('pr.link.refresh')}
                            </button>
                            <div className="ui-row">
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--default"
                                    disabled={busy}
                                    onClick={() => setLinkProduct(null)}
                                >
                                    {t('pr.btn.cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="ui-btn ui-btn--primary"
                                    disabled={busy || !linkMapId}
                                    onClick={() => saveLink()}
                                >
                                    {busy ? (
                                        <>
                                            <Loader size={14} className="ui-spin" />{' '}
                                            {t('pr.link.saving')}
                                        </>
                                    ) : t('pr.link.save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            ) : null}

            {adjustProduct ? (
                <StorageProductStockAdjustModal
                    brandId={brandId}
                    product={adjustProduct}
                    onClose={() => setAdjustProduct(null)}
                    onSaved={async () => {
                        await onReload();
                        if (timelineProductId === adjustProduct.id) {
                            await loadTimeline();
                        }
                    }}
                />
            ) : null}
        </div>
    );
}
