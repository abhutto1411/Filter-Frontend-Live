import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Loader, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import { sfDate } from './sfFormat';
import ProductLineCombobox from './ProductLineCombobox';
import {
    defaultEntryUnitForProduct,
    stockQtyToEntryQty,
} from './storageFacilityUomUtils';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import '../../../styles/ui.css';

function isStorageHub(loc) {
    return loc?.locationKind === 'brand_storage' && loc?.isSystem;
}

function isTransferSource(loc) {
    return (
        loc?.locationKind === 'brand_site' ||
        (loc?.locationKind === 'brand_storage' && !loc?.isSystem)
    );
}

/** What kind of place this is, said after its name. */
function locationLabel(t, loc) {
    if (!loc) return '';
    const name = loc.companyName && isTransferSource(loc)
        ? `${loc.name} — ${loc.companyName}`
        : loc.name;
    if (loc.locationKind === 'owner_warehouse') return t('tr.loc.warehouse', { name });
    if (isTransferSource(loc)) return t('tr.loc.source', { name });
    if (isStorageHub(loc)) return t('tr.loc.hub', { name });
    return loc.name;
}

function newLine() {
    return {
        key: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        storageProductId: '',
        search: '',
        qty: '',
        unit: '',
        uomProfileId: '',
        unitCost: '',
    };
}

export default function StorageFacilityTransfersTab({ brandId, products, onReload }) {
    const t = useSfT();
    const sfApi = useStorageFacilityApi();
    const [transfers, setTransfers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTransferId, setEditingTransferId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({
        transferDate: toRiyadhDateISO(),
        fromLocationId: '',
        toLocationId: '',
        notes: '',
    });
    const [lines, setLines] = useState(() => [newLine(), newLine()]);

    const productRefs = useRef([]);
    const qtyRefs = useRef([]);
    const costRefs = useRef([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [trRes, locRes] = await Promise.all([
                sfApi.listStorageTransfers(brandId),
                sfApi.listStorageLocations(brandId),
            ]);
            setTransfers(trRes?.transfers ?? []);
            setLocations(locRes?.locations ?? []);
            setLoadError(false);
        } catch {
            setTransfers([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, sfApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    const paging = usePagedRows(transfers, { resetKey: brandId });

    // Both ends offer the same set: a source, the facility, or the warehouse.
    const locationOptions = useMemo(
        () =>
            locations
                .filter(
                    (l) =>
                        isTransferSource(l) ||
                        isStorageHub(l) ||
                        l.locationKind === 'owner_warehouse',
                )
                .map((l) => ({ ...l, label: locationLabel(t, l) })),
        [locations, t],
    );

    const updateLine = (key, patch) => {
        setLines((prev) => prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)));
    };

    const addLine = (focusProduct = true) => {
        setLines((prev) => [...prev, newLine()]);
        if (focusProduct) {
            window.setTimeout(() => {
                const inputs = productRefs.current;
                inputs[inputs.length - 1]?.focus();
            }, 50);
        }
    };

    const removeLine = (key) => {
        setLines((prev) => (prev.length <= 1 ? [newLine()] : prev.filter((ln) => ln.key !== key)));
    };

    const focusQty = (rowIndex) => window.setTimeout(() => qtyRefs.current[rowIndex]?.focus(), 0);
    const focusCost = (rowIndex) => window.setTimeout(() => costRefs.current[rowIndex]?.focus(), 0);

    const focusNextRowProduct = (rowIndex) => {
        const next = rowIndex + 1;
        if (next >= lines.length) addLine(true);
        else window.setTimeout(() => productRefs.current[next]?.focus(), 0);
    };

    const validLines = useMemo(
        () => lines.filter((ln) => ln.storageProductId && ln.qty !== '' && Number(ln.qty) > 0),
        [lines],
    );

    const openNew = () => {
        setEditingTransferId(null);
        const hubDefault = locations.find((l) => isStorageHub(l));
        const sourceDefault = locations.find((l) => isTransferSource(l));
        setForm({
            transferDate: toRiyadhDateISO(),
            fromLocationId: sourceDefault?.id || locations[0]?.id || '',
            toLocationId: hubDefault?.id || locations[1]?.id || '',
            notes: '',
        });
        setLines([newLine(), newLine()]);
        setModalOpen(true);
    };

    const openEdit = async (transfer) => {
        setBusy(true);
        try {
            const res = await sfApi.getStorageTransfer(brandId, transfer.id);
            const tr = res?.transfer ?? transfer;
            setEditingTransferId(tr.id);
            setForm({
                transferDate: tr.transferDate || toRiyadhDateISO(),
                fromLocationId: tr.fromLocation?.id || '',
                toLocationId: tr.toLocation?.id || '',
                notes: tr.notes || '',
            });
            setLines(
                tr.items?.length > 0
                    ? tr.items.map((ln) => {
                          const p = products.find(
                              (x) => String(x.id) === String(ln.storageProductId),
                          );
                          return {
                              key: `tr-${ln.id || ln.storageProductId}-${Math.random().toString(36).slice(2, 6)}`,
                              storageProductId: String(ln.storageProductId || ''),
                              search: ln.productName || p?.name || '',
                              qty: ln.qty != null ? stockQtyToEntryQty(ln.qty, p || {}) : '',
                              unit: defaultEntryUnitForProduct(p || {}),
                              uomProfileId: p?.uomProfileId ? String(p.uomProfileId) : '',
                              unitCost:
                                  ln.unitCost != null && Number(ln.unitCost) > 0
                                      ? String(ln.unitCost)
                                      : '',
                          };
                      })
                    : [newLine(), newLine()],
            );
            setModalOpen(true);
        } catch (ex) {
            window.alert(ex?.message || t('tr.err.open'));
        } finally {
            setBusy(false);
        }
    };

    const closeModal = () => {
        if (busy) return;
        setModalOpen(false);
        setEditingTransferId(null);
    };

    const unitOf = (ln) => {
        if (ln.unit) return ln.unit;
        if (!ln.storageProductId) return '—';
        const p = products.find((x) => String(x.id) === String(ln.storageProductId));
        return defaultEntryUnitForProduct(p || {});
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.fromLocationId || !form.toLocationId) {
            window.alert(t('tr.err.locations'));
            return;
        }
        if (form.fromLocationId === form.toLocationId) {
            window.alert(t('tr.err.sameLocation'));
            return;
        }
        if (validLines.length === 0) {
            window.alert(t('tr.err.noLines'));
            return;
        }
        setBusy(true);
        try {
            const payload = {
                transferDate: form.transferDate,
                fromLocationId: form.fromLocationId,
                toLocationId: form.toLocationId,
                notes: form.notes.trim() || undefined,
                lines: validLines.map((ln) => {
                    const p = products.find((x) => String(x.id) === String(ln.storageProductId));
                    return {
                        storageProductId: ln.storageProductId,
                        qty: Number(ln.qty),
                        unit: ln.unit?.trim() || defaultEntryUnitForProduct(p || {}),
                        uomProfileId: ln.uomProfileId || p?.uomProfileId || undefined,
                        unitCost: ln.unitCost !== '' ? Number(ln.unitCost) : undefined,
                    };
                }),
            };
            if (editingTransferId) {
                await sfApi.updateStorageTransfer(brandId, editingTransferId, payload);
            } else {
                await sfApi.createStorageTransfer(brandId, payload);
            }
            closeModal();
            setReloadKey((k) => k + 1);
            await onReload?.();
        } catch (ex) {
            window.alert(ex?.message || t('tr.err.save'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t('tr.lead')}</p>

            <div className="ui-table-wrap ui-table-wrap--scroll">
                <div className="ui-toolbar">
                    <span>{t('tr.count', { n: transfers.length })}</span>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={openNew}
                        >
                            <Plus size={14} /> {t('tr.new')}
                        </button>
                    </div>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('tr.errLoad')}</div>
                        <div className="ui-empty-sub">{t('tr.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('tr.retry')}
                        </button>
                    </div>
                ) : !loading && transfers.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><ArrowLeftRight size={18} /></div>
                        <div className="ui-empty-title">{t('tr.emptyTitle')}</div>
                        <div className="ui-empty-sub">{t('tr.emptySub')}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('tr.th.no')}</th>
                                <th>{t('tr.th.date')}</th>
                                <th>{t('tr.th.route')}</th>
                                <th>{t('tr.th.lines')}</th>
                                <th>{t('tr.th.notes')}</th>
                                <th aria-label={t('tr.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--btn" /></td>
                                    </tr>
                                ))
                            ) : paging.pagedRows.map((row) => (
                                <tr key={row.id}>
                                    <td data-label={t('tr.th.no')} className="ui-mono ui-nowrap">
                                        {row.transferNo}
                                    </td>
                                    <td data-label={t('tr.th.date')} className="ui-nowrap">
                                        {sfDate(row.transferDate)}
                                    </td>
                                    <td data-label={t('tr.th.route')}>
                                        <span className="ui-row">
                                            {row.fromLocation?.name || '—'}
                                            <ArrowLeftRight size={13} className="ui-glyph" />
                                            {row.toLocation?.name || '—'}
                                        </span>
                                    </td>
                                    <td data-label={t('tr.th.lines')}>
                                        {row.items?.map((ln, i) => (
                                            <div key={i} className="ui-meta">
                                                {t('tr.line.qty', {
                                                    name: ln.productName,
                                                    qty: ln.qty,
                                                })}
                                                {ln.direction ? ` (${ln.direction})` : ''}
                                            </div>
                                        ))}
                                    </td>
                                    <td data-label={t('tr.th.notes')} className="ui-meta">
                                        {row.notes || '—'}
                                    </td>
                                    <td>
                                        <div className="ui-rowacts">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                aria-label={t('tr.editAria', { no: row.transferNo })}
                                                disabled={busy}
                                                onClick={() => openEdit(row)}
                                            >
                                                <Pencil size={13} /> {t('tr.edit')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerProps} />
            </div>

            {modalOpen ? (
                <Modal
                    title={editingTransferId ? t('tr.modal.edit') : t('tr.modal.new')}
                    size="large"
                    onClose={closeModal}
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={busy}
                >
                    <form onSubmit={submit} className="ui-stack">
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-4">
                                <label htmlFor="sf-tr-from">{t('tr.label.from')}</label>
                                <select
                                    id="sf-tr-from"
                                    className="ui-select"
                                    value={form.fromLocationId}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, fromLocationId: e.target.value }))
                                    }
                                    required
                                >
                                    <option value="">{t('tr.selectLocation')}</option>
                                    {locationOptions.map((l) => (
                                        <option key={l.id} value={l.id}>{l.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ui-field ui-col-4">
                                <label htmlFor="sf-tr-to">{t('tr.label.to')}</label>
                                <select
                                    id="sf-tr-to"
                                    className="ui-select"
                                    value={form.toLocationId}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, toLocationId: e.target.value }))
                                    }
                                    required
                                >
                                    <option value="">{t('tr.selectLocation')}</option>
                                    {locationOptions.map((l) => (
                                        <option key={l.id} value={l.id}>{l.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="ui-field ui-col-4">
                                <label htmlFor="sf-tr-date">{t('tr.label.date')}</label>
                                <input
                                    id="sf-tr-date"
                                    type="date"
                                    className="ui-input"
                                    value={form.transferDate}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, transferDate: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                        </div>

                        <div className="ui-table-wrap ui-table-wrap--scroll">
                            <table className="ui-table">
                                <thead>
                                    <tr>
                                        <th>{t('tr.grid.num')}</th>
                                        <th>{t('tr.grid.product')}</th>
                                        <th>{t('tr.grid.qty')}</th>
                                        <th>{t('tr.grid.cost')}</th>
                                        <th aria-label={t('tr.th.actions')} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((ln, rowIndex) => (
                                        <tr key={ln.key}>
                                            <td data-label={t('tr.grid.num')} className="ui-mono">
                                                {rowIndex + 1}
                                            </td>
                                            <td data-label={t('tr.grid.product')}>
                                                <ProductLineCombobox
                                                    products={products}
                                                    value={ln.storageProductId}
                                                    searchText={ln.search}
                                                    inputRef={(el) => {
                                                        productRefs.current[rowIndex] = el;
                                                    }}
                                                    onSearchChange={(search) =>
                                                        updateLine(ln.key, {
                                                            search,
                                                            storageProductId: '',
                                                        })
                                                    }
                                                    onSelect={(p) =>
                                                        updateLine(ln.key, {
                                                            storageProductId: String(p.id),
                                                            search: p.name || '',
                                                            unit: defaultEntryUnitForProduct(p),
                                                            uomProfileId: p.uomProfileId
                                                                ? String(p.uomProfileId)
                                                                : '',
                                                        })
                                                    }
                                                    onTabAdvance={() => focusQty(rowIndex)}
                                                />
                                            </td>
                                            <td data-label={t('tr.grid.qty')}>
                                                <div className="ui-affix">
                                                    <input
                                                        ref={(el) => {
                                                            qtyRefs.current[rowIndex] = el;
                                                        }}
                                                        type="number"
                                                        min="0.001"
                                                        step="any"
                                                        className="ui-input ui-input--cell ui-input--figure"
                                                        aria-label={t('tr.grid.qty')}
                                                        value={ln.qty}
                                                        onChange={(e) =>
                                                            updateLine(ln.key, { qty: e.target.value })
                                                        }
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Tab' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                focusCost(rowIndex);
                                                            }
                                                        }}
                                                    />
                                                    <span className="ui-affix-sym">{unitOf(ln)}</span>
                                                </div>
                                            </td>
                                            <td data-label={t('tr.grid.cost')}>
                                                <input
                                                    ref={(el) => {
                                                        costRefs.current[rowIndex] = el;
                                                    }}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="ui-input ui-input--cell ui-input--figure"
                                                    aria-label={t('tr.grid.cost')}
                                                    placeholder={t('tr.optional')}
                                                    value={ln.unitCost}
                                                    onChange={(e) =>
                                                        updateLine(ln.key, { unitCost: e.target.value })
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Tab' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            if (rowIndex === lines.length - 1) {
                                                                addLine(true);
                                                            } else {
                                                                focusNextRowProduct(rowIndex);
                                                            }
                                                        }
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <div className="ui-rowacts">
                                                    <button
                                                        type="button"
                                                        className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                                                        onClick={() => removeLine(ln.key)}
                                                        tabIndex={-1}
                                                        aria-label={t('tr.grid.removeRow')}
                                                        title={t('tr.grid.removeRow')}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="ui-row">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default ui-btn--sm"
                                onClick={() => addLine(true)}
                            >
                                <Plus size={14} /> {t('tr.addLine')}
                            </button>
                        </div>

                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-8">
                                <label htmlFor="sf-tr-notes">
                                    {t('tr.label.notes')}{' '}
                                    <span className="ui-field-opt">{t('tr.optional')}</span>
                                </label>
                                <textarea
                                    id="sf-tr-notes"
                                    rows={2}
                                    className="ui-textarea"
                                    value={form.notes}
                                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={busy}
                                onClick={closeModal}
                            >
                                {t('tr.btn.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="ui-btn ui-btn--primary"
                                disabled={busy || validLines.length === 0}
                            >
                                {busy ? (
                                    <><Loader size={14} className="ui-spin" /> {t('tr.btn.saving')}</>
                                ) : editingTransferId
                                    ? t('tr.btn.save', { n: validLines.length })
                                    : t('tr.btn.post', { n: validLines.length })}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
