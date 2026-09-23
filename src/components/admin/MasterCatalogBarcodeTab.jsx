import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, Printer, X } from 'lucide-react';
import SearchableEntityCombobox from '../SearchableEntityCombobox';
import ProductBarcodeSvg from './ProductBarcodeSvg';
import { catalogDisplayName } from '../../utils/catalogDisplayName';
import { mcT } from '../../utils/masterCatalogI18n';
import { clearProductBarcode, generateProductBarcode, listBarcodedProducts, searchProductsForBarcode } from '../../services/superAdminApi';
import {
    exportMasterBarcodeListPdf,
    exportMasterBarcodeStickerPdf,
} from '../../utils/masterCatalogBarcodeExport';

function formatSalePrice(value, t) {
    const n = Number(value);
    if (!Number.isFinite(n)) return t('barcode.noPrice');
    return `SAR ${n.toFixed(2)}`;
}

function unwrapProducts(res) {
    if (Array.isArray(res?.products)) return res.products;
    if (Array.isArray(res?.data?.products)) return res.data.products;
    if (Array.isArray(res?.data)) return res.data;
    return [];
}

function toTableRow(p) {
    if (!p?.id) return null;
    return {
        id: String(p.id),
        name: p.name,
        arabicName: p.arabicName ?? null,
        sku: p.sku ?? null,
        brandName: p.brandName ?? null,
        salePrice: p.salePrice ?? null,
        barcode: p.barcode ? String(p.barcode).trim() : '',
    };
}

export default function MasterCatalogBarcodeTab({ locale, canGenerate = false }) {
    const t = useCallback((key, vars) => mcT(locale, key, vars), [locale]);
    const pdfT = useCallback((key, vars) => mcT('en', key, vars), []);
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [rows, setRows] = useState([]);
    const [tableLoading, setTableLoading] = useState(true);
    const [generatingId, setGeneratingId] = useState('');
    const [removingId, setRemovingId] = useState('');
    const [rowError, setRowError] = useState('');
    const [searchTick, setSearchTick] = useState(0);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [busyExport, setBusyExport] = useState('');
    const [stickerOpen, setStickerOpen] = useState(false);
    const [stickerQty, setStickerQty] = useState('100');
    const [confirmRow, setConfirmRow] = useState(null);
    const [confirmStep, setConfirmStep] = useState(1);

    useEffect(() => {
        let cancelled = false;
        setTableLoading(true);
        listBarcodedProducts()
            .then((res) => {
                if (cancelled) return;
                setRows(unwrapProducts(res).map(toTableRow).filter(Boolean));
            })
            .catch((err) => {
                if (cancelled) return;
                setRows([]);
                setRowError(err?.message || t('barcode.searchError'));
            })
            .finally(() => {
                if (!cancelled) setTableLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const q = query.trim();
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            setSearching(true);
            setSearchError('');
            try {
                const res = await searchProductsForBarcode({ q, limit: 30 });
                if (cancelled) return;
                setHits(unwrapProducts(res));
            } catch (err) {
                if (cancelled) return;
                setHits([]);
                setSearchError(err?.message || t('barcode.searchError'));
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 220);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [query, t, searchTick]);

    const inList = useMemo(() => new Set(rows.map((r) => String(r.id))), [rows]);

    const options = useMemo(
        () =>
            hits
                .filter((p) => p && p.id != null && !inList.has(String(p.id)))
                .map((p) => {
                    const name = catalogDisplayName(p, locale) || p.name || String(p.id);
                    const barcode = p.barcode ? String(p.barcode).trim() : '';
                    const price = formatSalePrice(p.salePrice, t);
                    return {
                        id: String(p.id),
                        label: name,
                        subtitle: [
                            p.sku,
                            barcode ? `${t('barcode.hasBarcode')} · ${barcode}` : null,
                            price,
                        ].filter(Boolean).join(' · '),
                        searchText: [p.name, p.arabicName, p.sku, p.brandName, barcode].filter(Boolean).join(' '),
                        product: p,
                    };
                }),
        [hits, inList, locale, t],
    );

    const addProduct = useCallback((opt) => {
        const p = opt?.product;
        if (!p?.id) return;
        const id = String(p.id);
        setRows((prev) => {
            if (prev.some((r) => String(r.id) === id)) return prev;
            const row = toTableRow(p);
            return row ? [...prev, row] : prev;
        });
        setQuery('');
        setRowError('');
    }, []);

    const removeRow = useCallback(async (row) => {
        const id = String(row?.id ?? '');
        if (!id) return;
        const hasCode = Boolean(row?.barcode);
        setRowError('');
        if (hasCode) {
            setRemovingId(id);
            try {
                await clearProductBarcode(id);
            } catch (err) {
                setRowError(err?.message || t('barcode.removeError'));
                setRemovingId('');
                return;
            }
            setRemovingId('');
            setSearchTick((n) => n + 1);
        }
        setRows((prev) => prev.filter((r) => String(r.id) !== id));
        setSelectedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        setConfirmRow(null);
        setConfirmStep(1);
    }, [t]);

    const requestRemove = useCallback((row) => {
        if (!row?.id) return;
        if (!row.barcode) {
            removeRow(row);
            return;
        }
        setRowError('');
        setConfirmRow(row);
        setConfirmStep(1);
    }, [removeRow]);

    const generate = useCallback(
        async (id) => {
            if (!canGenerate) return;
            setGeneratingId(String(id));
            setRowError('');
            try {
                const res = await generateProductBarcode(id);
                const product = res?.product || res?.data?.product || res;
                const barcode = product?.barcode != null ? String(product.barcode).trim() : '';
                if (!barcode) throw new Error(t('barcode.error'));
                setRows((prev) =>
                    prev.map((r) => (String(r.id) === String(id) ? { ...r, ...product, barcode } : r)),
                );
            } catch (err) {
                setRowError(err?.message || t('barcode.error'));
            } finally {
                setGeneratingId('');
            }
        },
        [canGenerate, t],
    );

    const toggleSelect = useCallback((id) => {
        const key = String(id);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(String(r.id)));
    const selectedRows = useMemo(
        () => rows.filter((r) => selectedIds.has(String(r.id))),
        [rows, selectedIds],
    );
    const exportRows = selectedRows.length ? selectedRows : rows;
    const stickerSource = selectedRows.filter((r) => String(r.barcode || '').trim());

    const toggleSelectAll = useCallback(() => {
        setSelectedIds((prev) => {
            if (rows.length === 0) return prev;
            const allOn = rows.every((r) => prev.has(String(r.id)));
            if (allOn) return new Set();
            return new Set(rows.map((r) => String(r.id)));
        });
    }, [rows]);

    const runListPdf = useCallback(async () => {
        setRowError('');
        setBusyExport('list');
        try {
            await exportMasterBarcodeListPdf({ rows: exportRows, t: pdfT });
        } catch (err) {
            setRowError(err?.message || t('barcode.export.none'));
        } finally {
            setBusyExport('');
        }
    }, [exportRows, pdfT, t]);

    const openStickers = useCallback(() => {
        setRowError('');
        if (!stickerSource.length) {
            setRowError(t('barcode.sticker.needSelect'));
            return;
        }
        setStickerQty('100');
        setStickerOpen(true);
    }, [stickerSource, t]);

    const runStickerPdf = useCallback(async () => {
        const qty = Math.round(Number(stickerQty));
        if (!Number.isFinite(qty) || qty < 1 || qty > 500) {
            setRowError(t('barcode.sticker.needQty'));
            return;
        }
        setRowError('');
        setBusyExport('stickers');
        try {
            await exportMasterBarcodeStickerPdf({ rows: stickerSource, quantity: qty, t: pdfT });
            setStickerOpen(false);
        } catch (err) {
            setRowError(err?.message || t('barcode.export.none'));
        } finally {
            setBusyExport('');
        }
    }, [stickerQty, stickerSource, pdfT, t]);

    return (
        <div className="mc-barcode-tab">
            <p className="mc-barcode-hint">{t('barcode.hint')}</p>
            <div className="mc-barcode-search">
                <SearchableEntityCombobox
                    options={options}
                    value=""
                    displayText={query}
                    onDisplayTextChange={setQuery}
                    onSelect={addProduct}
                    placeholder={t('barcode.search')}
                    loading={searching}
                    loadingHint={t('barcode.loading')}
                    emptyHint={searchError || t('barcode.emptyHint')}
                    entityLabel="product"
                    menuMinWidth={420}
                    filterLocally={false}
                />
                <span className="mc-items-count">{t('barcode.count', { n: rows.length })}</span>
            </div>
            {rowError ? <div className="mc-barcode-error">{rowError}</div> : null}

            {tableLoading ? (
                <div className="mc-table-placeholder">{t('barcode.loadingTable')}</div>
            ) : rows.length === 0 ? (
                <div className="mc-table-placeholder">{t('barcode.empty')}</div>
            ) : (
                <>
                <div className="mc-barcode-toolbar">
                    <button
                        type="button"
                        className="mc-btn-ghost"
                        disabled={Boolean(busyExport)}
                        onClick={runListPdf}
                    >
                        <FileDown size={15} />
                        {busyExport === 'list' ? t('barcode.exporting') : t('barcode.exportPdf')}
                    </button>
                    <button
                        type="button"
                        className="mc-btn-primary"
                        disabled={Boolean(busyExport)}
                        onClick={openStickers}
                    >
                        <Printer size={15} />
                        {t('barcode.printStickers')}
                    </button>
                    <span className="mc-items-count">
                        {t('barcode.selected', { n: selectedIds.size })}
                    </span>
                </div>
                <div className="mc-availability-table-container">
                    <table className="mc-availability-table mc-barcode-table">
                        <thead>
                            <tr>
                                <th className="mc-barcode-check-col">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleSelectAll}
                                        aria-label={t('barcode.th.select')}
                                    />
                                </th>
                                <th>{t('barcode.th.name')}</th>
                                <th>{t('barcode.th.price')}</th>
                                <th>{t('barcode.th.number')}</th>
                                <th>{t('barcode.th.visual')}</th>
                                <th>{t('barcode.th.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                const busy = String(generatingId) === String(row.id);
                                const removing = String(removingId) === String(row.id);
                                const hasCode = Boolean(row.barcode);
                                const checked = selectedIds.has(String(row.id));
                                return (
                                    <tr key={row.id}>
                                        <td className="mc-barcode-check-col">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleSelect(row.id)}
                                                aria-label={catalogDisplayName(row, locale) || row.name}
                                            />
                                        </td>
                                        <td>
                                            <div className="mc-table-product">
                                                {catalogDisplayName(row, locale) || row.name}
                                            </div>
                                            {row.sku ? <div className="mc-pc-sku">{row.sku}</div> : null}
                                        </td>
                                        <td>{formatSalePrice(row.salePrice, t)}</td>
                                        <td className="mono">{hasCode ? row.barcode : '—'}</td>
                                        <td>
                                            {hasCode ? <ProductBarcodeSvg value={row.barcode} /> : <span className="mc-muted">—</span>}
                                        </td>
                                        <td>
                                            <div className="mc-table-actions">
                                                {hasCode ? (
                                                    <span className="mc-av-badge green">{t('barcode.hasBarcode')}</span>
                                                ) : canGenerate ? (
                                                    <button
                                                        type="button"
                                                        className="mc-btn-primary"
                                                        disabled={busy}
                                                        onClick={() => generate(row.id)}
                                                    >
                                                        {busy ? t('barcode.generating') : t('barcode.generate')}
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    className="mc-btn-ghost mc-barcode-remove"
                                                    disabled={busy || removing}
                                                    onClick={() => requestRemove(row)}
                                                    aria-label={t('barcode.remove')}
                                                >
                                                    <X size={12} />
                                                    {t('barcode.remove')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                </>
            )}

            {stickerOpen ? (
                <div className="mc-barcode-qty-overlay" role="dialog" aria-modal="true" aria-labelledby="mc-barcode-sticker-title">
                    <div className="mc-barcode-qty-modal">
                        <h3 id="mc-barcode-sticker-title">{t('barcode.sticker.title')}</h3>
                        <p>{t('barcode.sticker.body')}</p>
                        <label className="mc-barcode-qty-label">
                            {t('barcode.sticker.qty')}
                            <input
                                type="number"
                                min={1}
                                max={500}
                                step={1}
                                value={stickerQty}
                                onChange={(e) => setStickerQty(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        runStickerPdf();
                                    }
                                }}
                                autoFocus
                            />
                        </label>
                        {rowError ? <div className="mc-barcode-error">{rowError}</div> : null}
                        <div className="mc-barcode-qty-actions">
                            <button
                                type="button"
                                className="mc-btn-primary"
                                disabled={busyExport === 'stickers'}
                                onClick={runStickerPdf}
                            >
                                {busyExport === 'stickers' ? t('barcode.printing') : t('barcode.sticker.print')}
                            </button>
                            <button
                                type="button"
                                className="mc-btn-ghost"
                                disabled={busyExport === 'stickers'}
                                onClick={() => setStickerOpen(false)}
                            >
                                {t('barcode.sticker.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {confirmRow ? (
                <div className="mc-barcode-qty-overlay" role="dialog" aria-modal="true" aria-labelledby="mc-barcode-confirm-title">
                    <div className="mc-barcode-qty-modal">
                        <h3 id="mc-barcode-confirm-title">
                            {confirmStep === 1 ? t('barcode.confirm1.title') : t('barcode.confirm2.title')}
                        </h3>
                        <p>
                            {confirmStep === 1
                                ? t('barcode.confirm1.body', {
                                    name: catalogDisplayName(confirmRow, locale) || confirmRow.name || '',
                                })
                                : t('barcode.confirm2.body')}
                        </p>
                        {rowError ? <div className="mc-barcode-error">{rowError}</div> : null}
                        <div className="mc-barcode-qty-actions">
                            <button
                                type="button"
                                className="mc-btn-primary mc-barcode-confirm-yes"
                                disabled={Boolean(removingId)}
                                onClick={() => {
                                    if (confirmStep === 1) {
                                        setConfirmStep(2);
                                        return;
                                    }
                                    removeRow(confirmRow);
                                }}
                            >
                                {removingId ? t('barcode.removing') : t('barcode.confirm.yes')}
                            </button>
                            <button
                                type="button"
                                className="mc-btn-ghost"
                                disabled={Boolean(removingId)}
                                onClick={() => {
                                    setConfirmRow(null);
                                    setConfirmStep(1);
                                    setRowError('');
                                }}
                            >
                                {t('barcode.confirm.no')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
