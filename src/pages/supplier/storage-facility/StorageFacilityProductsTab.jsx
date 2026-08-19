import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileSpreadsheet, FileText, Link2, Plus, Search } from 'lucide-react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import Modal from '../../../components/Modal';
import RowActionsMenu from '../../../components/RowActionsMenu';
import SearchableEntityCombobox from './SearchableEntityCombobox';
import { ShimmerTable } from '../../../components/supplier/Shimmer';
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
import '../../../styles/admin/AccountingPage.css';

function todayYmd() {
    return new Date().toISOString().slice(0, 10);
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
    const sfApi = useStorageFacilityApi();
    const productSort = useColumnSort();
    const [timelineProductId, setTimelineProductId] = useState(null);
    const [timeline, setTimeline] = useState(null);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineErr, setTimelineErr] = useState('');
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

    const searchWh = useCallback(async (q = '', limit) => {
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
    }, [sfApi]);

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
        setTimelineErr('');
        try {
            const res = await sfApi.getStorageProductTimeline(brandId, timelineProductId, {
                from: dateFrom || undefined,
                to: dateTo || undefined,
                asOf: asOfDate || dateTo || undefined,
            });
            setTimeline(res);
        } catch (e) {
            setTimelineErr(e?.message || 'Failed to load timeline');
            setTimeline(null);
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
            window.alert(ex?.message || 'Save failed');
        } finally {
            setBusy(false);
        }
    };

    const toggleActive = async (p) => {
        try {
            await sfApi.updateStorageProduct(brandId, p.id, { isActive: !p.isActive });
            await onReload();
        } catch (ex) {
            window.alert(ex?.message || 'Update failed');
        }
    };

    const handleDelete = async (p) => {
        if (
            !window.confirm(
                `Delete "${p.name}"? If it has history it will be deactivated instead.`,
            )
        ) {
            return;
        }
        try {
            const res = await sfApi.deleteStorageProduct(brandId, p.id);
            if (timelineProductId === p.id) setTimelineProductId(null);
            await onReload();
            if (res?.softDeleted) {
                window.alert('Product deactivated (has movement history).');
            }
        } catch (ex) {
            window.alert(ex?.message || 'Delete failed');
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
            window.alert(ex?.message || 'Link failed');
        } finally {
            setBusy(false);
        }
    };

    if (timelineProductId) {
        const p = timeline?.product ?? products.find((x) => x.id === timelineProductId);
        const rows = timeline?.rows ?? [];
        const kpis = timeline?.kpis ?? {};
        const timelineUom = productEffectiveUom(p || {});
        const splitTimelineUom =
            timelineUom.warehouseUnit &&
            timelineUom.workshopUnit &&
            String(timelineUom.warehouseUnit).toLowerCase() !==
                String(timelineUom.workshopUnit).toLowerCase() &&
            Number(timelineUom.conversionFactor) > 1;
        const qtyColLabel = splitTimelineUom
            ? `Qty owned (${timelineUom.warehouseUnit})`
            : 'Qty owned';
        const balanceColLabel = splitTimelineUom
            ? `Balance (${timelineUom.warehouseUnit})`
            : 'Balance';

        return (
            <div className="mgr-sf-ar-page">
                <button
                    type="button"
                    className="btn-portal-outline"
                    style={{ marginBottom: 12 }}
                    onClick={() => setTimelineProductId(null)}
                >
                    <ArrowLeft size={14} style={{ marginRight: 6 }} />
                    Back to products
                </button>

                <p
                    style={{
                        fontSize: '0.75rem',
                        color: '#64748b',
                        margin: '0 0 4px',
                    }}
                >
                    Inventory Items &gt; {p?.name ?? 'Product'}
                </p>
                <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem' }}>
                    Inventory Items — Qty owned
                </h2>

                <div
                    className="mgr-si-toolbar"
                    style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}
                >
                    <label style={{ fontSize: '0.8125rem' }}>
                        From{' '}
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="mgr-si-filter-select"
                        />
                    </label>
                    <label style={{ fontSize: '0.8125rem' }}>
                        To{' '}
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="mgr-si-filter-select"
                        />
                    </label>
                    <label style={{ fontSize: '0.8125rem' }}>
                        Closing as of{' '}
                        <input
                            type="date"
                            value={asOfDate}
                            onChange={(e) => setAsOfDate(e.target.value)}
                            className="mgr-si-filter-select"
                        />
                    </label>
                    <button type="button" className="mgr-si-search-btn" onClick={loadTimeline}>
                        <Search size={14} /> Apply
                    </button>
                    <button
                        type="button"
                        className="mgr-si-search-btn"
                        disabled={!rows.length}
                        onClick={() => {
                            const exportOpts = {
                                dateFrom,
                                dateTo,
                                asOfDate: kpis.asOfDate || asOfDate,
                                unit: timelineUom.warehouseUnit || p?.unit || '',
                                qtyColLabel,
                                balanceColLabel,
                            };
                            exportStorageTimelineExcel(
                                p,
                                rows,
                                kpis,
                                `storage-timeline-${p?.sku || p?.id}`,
                                exportOpts,
                            );
                        }}
                    >
                        <FileSpreadsheet size={14} /> Excel
                    </button>
                    <button
                        type="button"
                        className="mgr-si-search-btn"
                        disabled={!rows.length}
                        onClick={() => {
                            const exportOpts = {
                                dateFrom,
                                dateTo,
                                asOfDate: kpis.asOfDate || asOfDate,
                                unit: timelineUom.warehouseUnit || p?.unit || '',
                                qtyColLabel,
                                balanceColLabel,
                            };
                            exportStorageTimelinePdf(
                                p,
                                rows,
                                kpis,
                                `storage-timeline-${p?.sku || p?.id}`,
                                exportOpts,
                            );
                        }}
                    >
                        <FileText size={14} /> PDF
                    </button>
                </div>

                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    <div className="ws-section" style={{ padding: 14 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>
                            TOTAL STOCK IN
                        </div>
                        <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#15803d' }}>
                            {fmtQty(kpis.totalStockIn, p?.unit)}
                        </div>
                    </div>
                    <div className="ws-section" style={{ padding: 14 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>
                            TOTAL STOCK OUT
                        </div>
                        <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#b45309' }}>
                            {fmtQty(kpis.totalStockOut, p?.unit)}
                        </div>
                    </div>
                    <div className="ws-section" style={{ padding: 14 }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>
                            CLOSING BALANCE
                        </div>
                        <div style={{ fontSize: '1.375rem', fontWeight: 800 }}>
                            {fmtQty(kpis.closingBalance, p?.unit)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            as of {kpis.asOfDate || asOfDate}
                        </div>
                    </div>
                </div>

                {timelineErr ? <div className="mgr-si-error">{timelineErr}</div> : null}

                {timelineLoading ? (
                    <ShimmerTable rows={10} columns={6} />
                ) : (
                    <div className="premium-table mgr-si-table-wrap">
                        <table className="mgr-si-table mgr-sf-inv-timeline-table">
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th mgr-sf-ar-th-narrow">Edit</th>
                                    <th className="table-th mgr-sf-ar-th-narrow">View</th>
                                    <th className="table-th">Date</th>
                                    <th className="table-th">Transaction</th>
                                    <th className="table-th">Reference</th>
                                    <th className="table-th">Inventory Item</th>
                                    <th className="table-th mgr-si-cell-amount">{qtyColLabel}</th>
                                    <th className="table-th mgr-si-cell-amount">{balanceColLabel}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="table-cell" style={{ padding: 24 }}>
                                            No movements in this date range.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r) => (
                                        <tr key={r.id} className="table-row">
                                            <td className="table-cell">—</td>
                                            <td className="table-cell">—</td>
                                            <td className="table-cell mgr-si-cell-date">
                                                {r.dateDisplay || r.date}
                                            </td>
                                            <td className="table-cell">{r.transaction}</td>
                                            <td className="table-cell">{r.reference}</td>
                                            <td className="table-cell">{r.inventoryItem}</td>
                                            <td
                                                className="table-cell mgr-si-cell-amount"
                                                style={{
                                                    color:
                                                        r.qtyOwned < 0 ? '#dc2626' : '#15803d',
                                                }}
                                            >
                                                {r.qtyOwned > 0 ? '+' : ''}
                                                {formatStorageMovementQtyDisplay(
                                                    r.qtyOwned,
                                                    timelineUom,
                                                )}
                                            </td>
                                            <td className="table-cell mgr-si-cell-amount">
                                                {formatStorageMovementQtyDisplay(
                                                    r.balance,
                                                    timelineUom,
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    }

    return (
        <>
            <button
                type="button"
                className="mgr-si-btn-new"
                style={{ marginBottom: 12 }}
                onClick={() => {
                    setProductModal(true);
                    onLoadCatalog?.();
                    searchWh('', 5000);
                }}
            >
                <Plus size={14} /> Add product
            </button>

            <div className="premium-table mgr-si-table-wrap">
                <table className="mgr-si-table">
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th mgr-si-th-actions">Actions</th>
                            <SortableTh className="table-th" label="SKU" columnKey="sku" sortKey={productSort.sortKey} sortDir={productSort.sortDir} onSort={productSort.toggleSort} />
                            <SortableTh className="table-th" label="Name" columnKey="name" sortKey={productSort.sortKey} sortDir={productSort.sortDir} onSort={productSort.toggleSort} />
                            <SortableTh className="table-th" label="Qty" columnKey="qty" sortKey={productSort.sortKey} sortDir={productSort.sortDir} onSort={productSort.toggleSort} />
                            <SortableTh className="table-th" label="Warehouse link" columnKey="whlink" sortKey={productSort.sortKey} sortDir={productSort.sortDir} onSort={productSort.toggleSort} />
                            <SortableTh className="table-th" label="Status" columnKey="status" sortKey={productSort.sortKey} sortDir={productSort.sortDir} onSort={productSort.toggleSort} />
                        </tr>
                    </thead>
                    <tbody>
                        {productSort
                            .sortRows(products, {
                                sku: (p) => p.sku || '',
                                name: (p) => p.name || '',
                                qty: (p) => Number(p.qtyOnHand ?? 0),
                                whlink: (p) => p.warehouseProduct?.name || '',
                                status: (p) => (p.isActive === false ? 'inactive' : 'active'),
                            })
                            .map((p) => (
                            <tr
                                key={p.id}
                                className={`table-row mgr-sf-ar-customer-row ${!p.isActive ? 'mgr-sf-product-inactive' : ''}`}
                            >
                                <td
                                    className="table-cell mgr-si-cell-actions"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <RowActionsMenu
                                        ariaLabel={`Actions for ${p.name || 'product'}`}
                                        items={[
                                            {
                                                label: 'Adjust stock',
                                                onClick: () => setAdjustProduct(p),
                                            },
                                            {
                                                label: 'Edit',
                                                onClick: () =>
                                                    setEditProduct({
                                                        id: p.id,
                                                        name: p.name,
                                                        sku: p.sku || '',
                                                        unit: p.unit || 'pcs',
                                                        uomProfileId: p.uomProfileId,
                                                        uomSelect: productUomSelectValue(p, uomProfiles),
                                                    }),
                                            },
                                            {
                                                label: p.isActive === false ? 'Activate' : 'Inactive',
                                                onClick: () => toggleActive(p),
                                            },
                                            {
                                                label: 'Link',
                                                title: 'Update warehouse catalog link',
                                                onClick: () => openLinkModal(p),
                                            },
                                            {
                                                label: 'Delete',
                                                onClick: () => handleDelete(p),
                                                danger: true,
                                            },
                                        ]}
                                    />
                                </td>
                                <td
                                    className="table-cell"
                                    onClick={() => openTimeline(p.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {p.sku || '—'}
                                </td>
                                <td
                                    className="table-cell mgr-si-cell-customer"
                                    onClick={() => openTimeline(p.id)}
                                    style={{ cursor: 'pointer', color: '#2563eb' }}
                                >
                                    {p.name}
                                </td>
                                <td
                                    className="table-cell"
                                    onClick={() => openTimeline(p.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {(() => {
                                        const d = formatStockOnHandDisplay(
                                            p.qtyOnHand,
                                            productEffectiveUom(p),
                                        );
                                        return (
                                            <>
                                                {d.primary}
                                                {d.secondary ? (
                                                    <span
                                                        style={{
                                                            display: 'block',
                                                            fontSize: '0.75rem',
                                                            color: '#64748b',
                                                        }}
                                                    >
                                                        {d.secondary}
                                                    </span>
                                                ) : null}
                                            </>
                                        );
                                    })()}
                                </td>
                                <td className="table-cell">
                                    {p.warehouseProduct?.name ?? (
                                        <span style={{ color: '#94a3b8' }}>Not linked</span>
                                    )}
                                </td>
                                <td className="table-cell">
                                    <span
                                        className={
                                            p.isActive === false
                                                ? 'mgr-sf-ar-status mgr-sf-ar-status--unpaid'
                                                : 'mgr-sf-ar-status mgr-sf-ar-status--paid'
                                        }
                                    >
                                        {p.isActive === false ? 'Inactive' : 'Active'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {productModal ? (
                <Modal
                    title="Add product"
                    width="520px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !busy && setProductModal(false)}
                >
                    <form className="sf-simple-form" onSubmit={saveProduct}>
                        <div className="sf-form-field">
                            <label htmlFor="sf-prod-catalog">Map from warehouse catalog (optional)</label>
                            {catalogLoading ? (
                                <p className="sf-form-field-hint">Loading catalog…</p>
                            ) : (
                                <p className="sf-form-field-hint">
                                    {catalogTotal > 0
                                        ? `${catalogTotal} warehouse products — type to search, ↑↓ to move, Enter to select`
                                        : 'Search your main warehouse catalog'}
                                </p>
                            )}
                            <SearchableEntityCombobox
                                id="sf-prod-catalog"
                                options={catalogOptions}
                                value={catalogMapId}
                                displayText={catalogSearch}
                                onDisplayTextChange={(t) => {
                                    handleCatalogQuery(t, setCatalogSearch);
                                    if (!t.trim()) setCatalogMapId('');
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
                                placeholder="Search by name or SKU…"
                            />
                            <button
                                type="button"
                                className="sf-doc-link-btn"
                                disabled={catalogLoading}
                                onClick={() => searchWh('', 5000)}
                            >
                                Refresh catalog ({catalogTotal || '…'})
                            </button>
                        </div>
                        <div className="sf-form-field">
                            <label htmlFor="sf-prod-name">Product name *</label>
                            <input
                                id="sf-prod-name"
                                value={newProduct.name}
                                onChange={(e) =>
                                    setNewProduct((x) => ({ ...x, name: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label htmlFor="sf-prod-sku">SKU</label>
                                <input
                                    id="sf-prod-sku"
                                    value={newProduct.sku}
                                    onChange={(e) =>
                                        setNewProduct((x) => ({ ...x, sku: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="sf-form-field">
                                <label htmlFor="sf-prod-unit">Unit / UOM</label>
                                <StorageUomSelect
                                    id="sf-prod-unit"
                                    variant="product"
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
                                    <p className="sf-form-field-hint">
                                        Create UOM profiles on the UOM tab (e.g. 1 Box = 12 Liter).
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={busy}
                                onClick={() => setProductModal(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={busy}>
                                {busy ? 'Saving…' : 'Save product'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {editProduct ? (
                <Modal
                    title="Edit product"
                    width="520px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !busy && setEditProduct(null)}
                >
                    <form className="sf-simple-form" onSubmit={saveProduct}>
                        <div className="sf-form-field">
                            <label htmlFor="sf-edit-name">Product name *</label>
                            <input
                                id="sf-edit-name"
                                value={editProduct.name}
                                onChange={(e) =>
                                    setEditProduct((x) => ({ ...x, name: e.target.value }))
                                }
                                required
                            />
                        </div>
                        <div className="sf-form-row-2">
                            <div className="sf-form-field">
                                <label htmlFor="sf-edit-sku">SKU</label>
                                <input
                                    id="sf-edit-sku"
                                    value={editProduct.sku ?? ''}
                                    onChange={(e) =>
                                        setEditProduct((x) => ({ ...x, sku: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="sf-form-field">
                                <label htmlFor="sf-edit-unit">Unit / UOM</label>
                                <StorageUomSelect
                                    id="sf-edit-unit"
                                    variant="product"
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
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={busy}
                                onClick={() => setEditProduct(null)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={busy}>
                                {busy ? 'Saving…' : 'Update'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {linkProduct ? (
                <Modal
                    title="Link warehouse SKU"
                    width="560px"
                    contentClassName="sf-simple-modal sf-link-catalog-modal"
                    onClose={() => !busy && setLinkProduct(null)}
                >
                    <div className="sf-link-catalog-head">
                        <span className="sf-link-catalog-label">Storage product</span>
                        <strong>{linkProduct.name}</strong>
                        {linkProduct.sku ? (
                            <span className="sf-link-catalog-meta">SKU: {linkProduct.sku}</span>
                        ) : null}
                    </div>
                    {linkProduct.warehouseProduct ? (
                        <div className="sf-link-catalog-current">
                            <span>Currently linked</span>
                            <strong>{linkProduct.warehouseProduct.name}</strong>
                        </div>
                    ) : (
                        <p className="sf-link-catalog-lead">
                            Choose the matching product from your main warehouse catalog (for
                            withdrawals).
                        </p>
                    )}
                    {catalogLoading ? (
                        <p className="sf-form-field-hint">Loading warehouse catalog…</p>
                    ) : (
                        <p className="sf-form-field-hint">
                            {catalogTotal > 0
                                ? `${catalogTotal} products available — search, then ↑↓ and Enter`
                                : 'No catalog products loaded'}
                        </p>
                    )}
                    <div className="sf-form-field">
                        <label htmlFor="sf-link-catalog">Warehouse catalog product</label>
                        <SearchableEntityCombobox
                            id="sf-link-catalog"
                            options={catalogOptions}
                            value={linkMapId}
                            displayText={linkMapSearch}
                            onDisplayTextChange={(t) => {
                                handleCatalogQuery(t, setLinkMapSearch);
                                if (!t.trim()) setLinkMapId('');
                            }}
                            onSelect={(w) => {
                                setLinkMapId(String(w.id));
                                setLinkMapSearch(w.label);
                            }}
                            placeholder="Type name or SKU…"
                            disabled={busy}
                        />
                    </div>
                    <div className="sf-form-actions">
                        <button
                            type="button"
                            className="btn-portal-outline"
                            disabled={busy || catalogLoading}
                            onClick={() => searchWh('', 5000)}
                        >
                            Refresh list
                        </button>
                        <button
                            type="button"
                            className="mgr-si-btn-new"
                            disabled={busy || !linkMapId}
                            onClick={() => saveLink()}
                        >
                            {busy ? 'Linking…' : 'Save link'}
                        </button>
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
        </>
    );
}
