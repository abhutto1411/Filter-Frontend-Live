import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import { ShimmerTable } from '../../../components/supplier/Shimmer';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import ProductLineCombobox from './ProductLineCombobox';
import {
    defaultEntryUnitForProduct,
    productEffectiveUom,
    stockQtyToEntryQty,
} from './storageFacilityUomUtils';

function isStorageHub(loc) {
    return loc?.locationKind === 'brand_storage' && loc?.isSystem;
}

function isTransferSource(loc) {
    return (
        loc?.locationKind === 'brand_site' ||
        (loc?.locationKind === 'brand_storage' && !loc?.isSystem)
    );
}

function formatTransferLocationLabel(loc) {
    if (!loc) return '';
    if (loc.locationKind === 'owner_warehouse') {
        return `${loc.name} (main warehouse)`;
    }
    if (isTransferSource(loc)) {
        const company = loc.companyName ? ` — ${loc.companyName}` : '';
        return `${loc.name}${company} (transfer source)`;
    }
    if (isStorageHub(loc)) {
        return `${loc.name} (storage facility)`;
    }
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

export default function StorageFacilityTransfersTab({
    brandId,
    products,
    onReload,
}) {
    const sfApi = useStorageFacilityApi();
    const [transfers, setTransfers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTransferId, setEditingTransferId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({
        transferDate: new Date().toISOString().slice(0, 10),
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
        setErr('');
        try {
            const [trRes, locRes] = await Promise.all([
                sfApi.listStorageTransfers(brandId),
                sfApi.listStorageLocations(brandId),
            ]);
            setTransfers(trRes?.transfers ?? []);
            setLocations(locRes?.locations ?? []);
        } catch (e) {
            setErr(e?.message || 'Failed to load transfers');
            setTransfers([]);
        } finally {
            setLoading(false);
        }
    }, [brandId, sfApi]);

    useEffect(() => {
        load();
    }, [load]);

    const locationOptions = useMemo(
        () =>
            locations.map((l) => ({
                ...l,
                label: formatTransferLocationLabel(l),
            })),
        [locations],
    );

    const fromLocationOptions = useMemo(
        () =>
            locationOptions.filter(
                (l) =>
                    isTransferSource(l) ||
                    isStorageHub(l) ||
                    l.locationKind === 'owner_warehouse',
            ),
        [locationOptions],
    );

    const toLocationOptions = useMemo(
        () =>
            locationOptions.filter(
                (l) =>
                    isStorageHub(l) ||
                    isTransferSource(l) ||
                    l.locationKind === 'owner_warehouse',
            ),
        [locationOptions],
    );

    const updateLine = (key, patch) => {
        setLines((prev) =>
            prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)),
        );
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
        setLines((prev) => {
            if (prev.length <= 1) return [newLine()];
            return prev.filter((ln) => ln.key !== key);
        });
    };

    const focusQty = (rowIndex) => {
        window.setTimeout(() => qtyRefs.current[rowIndex]?.focus(), 0);
    };

    const focusCost = (rowIndex) => {
        window.setTimeout(() => costRefs.current[rowIndex]?.focus(), 0);
    };

    const focusNextRowProduct = (rowIndex) => {
        const next = rowIndex + 1;
        if (next >= lines.length) addLine(true);
        else window.setTimeout(() => productRefs.current[next]?.focus(), 0);
    };

    const validLines = useMemo(
        () =>
            lines.filter(
                (ln) =>
                    ln.storageProductId &&
                    ln.qty !== '' &&
                    Number(ln.qty) > 0,
            ),
        [lines],
    );

    const openNew = () => {
        setEditingTransferId(null);
        const hubDefault = locations.find((l) => isStorageHub(l));
        const sourceDefault = locations.find((l) => isTransferSource(l));
        setForm({
            transferDate: new Date().toISOString().slice(0, 10),
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
            const t = res?.transfer ?? transfer;
            setEditingTransferId(t.id);
            setForm({
                transferDate: t.transferDate || new Date().toISOString().slice(0, 10),
                fromLocationId: t.fromLocation?.id || '',
                toLocationId: t.toLocation?.id || '',
                notes: t.notes || '',
            });
            const mapped =
                t.items?.length > 0
                    ? t.items.map((ln) => {
                          const p = products.find(
                              (x) => String(x.id) === String(ln.storageProductId),
                          );
                          return {
                              key: `tr-${ln.id || ln.storageProductId}-${Math.random().toString(36).slice(2, 6)}`,
                              storageProductId: String(ln.storageProductId || ''),
                              search: ln.productName || p?.name || '',
                              qty:
                                  ln.qty != null
                                      ? stockQtyToEntryQty(ln.qty, p || {})
                                      : '',
                              unit: defaultEntryUnitForProduct(p || {}),
                              uomProfileId: p?.uomProfileId
                                  ? String(p.uomProfileId)
                                  : '',
                              unitCost:
                                  ln.unitCost != null && Number(ln.unitCost) > 0
                                      ? String(ln.unitCost)
                                      : '',
                          };
                      })
                    : [newLine(), newLine()];
            setLines(mapped);
            setModalOpen(true);
        } catch (ex) {
            window.alert(ex?.message || 'Could not load transfer');
        } finally {
            setBusy(false);
        }
    };

    const closeModal = () => {
        if (busy) return;
        setModalOpen(false);
        setEditingTransferId(null);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!form.fromLocationId || !form.toLocationId) {
            window.alert('Select from and to locations.');
            return;
        }
        if (form.fromLocationId === form.toLocationId) {
            window.alert('From and to must be different locations.');
            return;
        }
        if (validLines.length === 0) {
            window.alert('Add at least one product line.');
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
                    const p = products.find(
                        (x) => String(x.id) === String(ln.storageProductId),
                    );
                    return {
                        storageProductId: ln.storageProductId,
                        qty: Number(ln.qty),
                        unit:
                            ln.unit?.trim() ||
                            defaultEntryUnitForProduct(p || {}),
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
            await load();
            await onReload?.();
        } catch (ex) {
            window.alert(ex?.message || 'Transfer failed');
        } finally {
            setBusy(false);
        }
    };

    if (loading && transfers.length === 0 && locations.length === 0) {
        return (
            <div className="ws-section">
                <ShimmerTable rows={6} columns={5} />
            </div>
        );
    }

    return (
        <div>
            {err ? <div className="mgr-si-error" style={{ marginBottom: 12 }}>{err}</div> : null}

            <p className="mgr-si-subtitle" style={{ marginBottom: 12 }}>
                Receive stock from external transfer sources (factory, brand depot) into your
                storage facility, or move stock between your storage facility and main warehouse.
            </p>

            <button type="button" className="mgr-si-btn-new" style={{ marginBottom: 16 }} onClick={openNew}>
                <Plus size={14} /> New transfer
            </button>

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Transfer #</th>
                            <th>Date</th>
                            <th>From → To</th>
                            <th>Lines</th>
                            <th>Notes</th>
                            <th style={{ width: 72 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transfers.map((t) => (
                            <tr key={t.id}>
                                <td style={{ fontWeight: 600 }}>{t.transferNo}</td>
                                <td>{t.transferDate}</td>
                                <td>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        {t.fromLocation?.name || '—'}
                                        <ArrowLeftRight size={14} style={{ color: '#94a3b8' }} />
                                        {t.toLocation?.name || '—'}
                                    </span>
                                </td>
                                <td style={{ fontSize: '0.8125rem' }}>
                                    {t.items?.map((ln, i) => (
                                        <div key={i}>
                                            {ln.productName} × {ln.qty}
                                            {ln.direction ? ` (${ln.direction})` : ''}
                                        </div>
                                    ))}
                                </td>
                                <td style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                                    {t.notes || '—'}
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        className="btn-portal-outline"
                                        title="Edit transfer"
                                        aria-label={`Edit transfer ${t.transferNo}`}
                                        disabled={busy}
                                        onClick={() => openEdit(t)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            padding: '6px 10px',
                                            fontSize: '0.75rem',
                                        }}
                                    >
                                        <Pencil size={14} /> Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {transfers.length === 0 && !loading ? (
                <p style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>
                    No transfers yet.
                </p>
            ) : null}

            {modalOpen ? (
                <Modal
                    title={editingTransferId ? 'Edit stock transfer' : 'Stock transfer'}
                    size="large"
                    onClose={closeModal}
                    contentClassName="sf-doc-modal sf-transfer-modal"
                    disableClose={busy}
                >
                    <form onSubmit={submit} className="sf-movement-form sf-doc-modal-shell">
                        <div className="sf-doc-modal-top">
                        <div className="sf-transfer-loc-row">
                            <div className="sf-movement-field" style={{ flex: 1 }}>
                                <label htmlFor="sf-tr-from">From location *</label>
                                <select
                                    id="sf-tr-from"
                                    className="sf-movement-input"
                                    value={form.fromLocationId}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, fromLocationId: e.target.value }))
                                    }
                                    required
                                >
                                    <option value="">Choose…</option>
                                    {fromLocationOptions.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="sf-movement-field" style={{ flex: 1 }}>
                                <label htmlFor="sf-tr-to">To location *</label>
                                <select
                                    id="sf-tr-to"
                                    className="sf-movement-input"
                                    value={form.toLocationId}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, toLocationId: e.target.value }))
                                    }
                                    required
                                >
                                    <option value="">Choose…</option>
                                    {toLocationOptions.map((l) => (
                                        <option key={l.id} value={l.id}>
                                            {l.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="sf-movement-field" style={{ flex: '0 0 160px' }}>
                                <label htmlFor="sf-tr-date">Date</label>
                                <input
                                    id="sf-tr-date"
                                    type="date"
                                    className="sf-movement-input"
                                    value={form.transferDate}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, transferDate: e.target.value }))
                                    }
                                    required
                                />
                            </div>
                        </div>
                        </div>

                        <div className="sf-doc-modal-scroll">
                        <div className="sf-bulk-grid-scroll">
                            <table className="sf-bulk-grid-table">
                                <thead>
                                    <tr>
                                        <th className="sf-bulk-col-num">#</th>
                                        <th className="sf-bulk-col-product">Product</th>
                                        <th className="sf-bulk-col-qty">Quantity (unit)</th>
                                        <th className="sf-bulk-col-cost">Unit cost (SAR)</th>
                                        <th className="sf-bulk-col-actions" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.map((ln, rowIndex) => (
                                        <tr key={ln.key}>
                                            <td className="sf-bulk-col-num">{rowIndex + 1}</td>
                                            <td className="sf-bulk-col-product">
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
                                            <td className="sf-bulk-col-qty">
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        gap: 6,
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <input
                                                        ref={(el) => {
                                                            qtyRefs.current[rowIndex] = el;
                                                        }}
                                                        type="number"
                                                        min="0.001"
                                                        step="any"
                                                        className="sf-bulk-grid-input"
                                                        style={{ flex: 1 }}
                                                        value={ln.qty}
                                                        onChange={(e) =>
                                                            updateLine(ln.key, {
                                                                qty: e.target.value,
                                                            })
                                                        }
                                                        onKeyDown={(e) => {
                                                            if (
                                                                e.key === 'Tab' &&
                                                                !e.shiftKey
                                                            ) {
                                                                e.preventDefault();
                                                                focusCost(rowIndex);
                                                            }
                                                        }}
                                                    />
                                                    <span
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            color: '#64748b',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {ln.unit ||
                                                            (ln.storageProductId
                                                                ? defaultEntryUnitForProduct(
                                                                      products.find(
                                                                          (p) =>
                                                                              String(
                                                                                  p.id,
                                                                              ) ===
                                                                              String(
                                                                                  ln.storageProductId,
                                                                              ),
                                                                      ) || {},
                                                                  )
                                                                : '—')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="sf-bulk-col-cost">
                                                <input
                                                    ref={(el) => {
                                                        costRefs.current[rowIndex] = el;
                                                    }}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="sf-bulk-grid-input"
                                                    placeholder="Optional"
                                                    value={ln.unitCost}
                                                    onChange={(e) =>
                                                        updateLine(ln.key, {
                                                            unitCost: e.target.value,
                                                        })
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
                                            <td className="sf-bulk-col-actions">
                                                <button
                                                    type="button"
                                                    className="sf-bulk-row-remove"
                                                    onClick={() => removeLine(ln.key)}
                                                    tabIndex={-1}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            type="button"
                            className="btn-portal-outline sf-bulk-add-line-btn"
                            onClick={() => addLine(true)}
                        >
                            <Plus size={14} /> Add line
                        </button>

                        <div className="sf-movement-field" style={{ maxWidth: 480 }}>
                            <label htmlFor="sf-tr-notes">Notes (optional)</label>
                            <textarea
                                id="sf-tr-notes"
                                rows={1}
                                className="sf-movement-input sf-movement-textarea sf-compact-textarea"
                                value={form.notes}
                                onChange={(e) =>
                                    setForm((f) => ({ ...f, notes: e.target.value }))
                                }
                            />
                        </div>

                        <div className="sf-movement-form-footer">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={busy}
                                onClick={closeModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="mgr-si-btn-new"
                                disabled={busy || validLines.length === 0}
                            >
                                {busy
                                    ? 'Saving…'
                                    : editingTransferId
                                      ? `Save changes (${validLines.length} line(s))`
                                      : `Post transfer (${validLines.length} line(s))`}
                            </button>
                        </div>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
