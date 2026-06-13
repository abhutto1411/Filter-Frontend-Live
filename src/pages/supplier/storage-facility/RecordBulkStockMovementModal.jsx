import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';

import ProductLineCombobox from './ProductLineCombobox';
import SearchableEntityCombobox from './SearchableEntityCombobox';
import StorageFacilityVatTotals, { fmtSar } from './StorageFacilityVatTotals';
import { computeStorageTotals, unitAmountForApi } from './storageFacilityTotals';

const ADJUSTMENT_REASONS = [
    { value: '', label: 'Select reason…' },
    { value: 'cycle_count', label: 'Cycle count correction' },
    { value: 'damage', label: 'Damaged / write-off' },
    { value: 'expired', label: 'Expired stock' },
    { value: 'found', label: 'Found stock' },
    { value: 'opening', label: 'Opening balance' },
    { value: 'other', label: 'Other' },
];

const LINE_GRID = '36px minmax(140px, 1.5fr) 72px 96px 36px';

function newLine() {
    return {
        key: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        storageProductId: '',
        search: '',
        qty: '',
        unitCost: '',
    };
}

function locationLabel(loc) {
    if (!loc) return '';
    const co = loc.companyName ? ` — ${loc.companyName}` : '';
    const kind = loc.locationKind === 'owner_warehouse' ? ' (main warehouse)' : '';
    return `${loc.name}${co}${kind}`;
}

export default function RecordBulkStockMovementModal({
    brandId,
    brandName,
    products,
    initialProductId,
    onClose,
    onSaved,
}) {
    const sfApi = useStorageFacilityApi();
    const [movementType, setMovementType] = useState('IN');
    const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dueDateType, setDueDateType] = useState('Net');
    const [netDays, setNetDays] = useState(30);
    const [customDueDate, setCustomDueDate] = useState('');
    const [reference, setReference] = useState('');
    const [description, setDescription] = useState('');
    const [billingAddress, setBillingAddress] = useState('');
    const [notes, setNotes] = useState('');

    const [lines, setLines] = useState(() => {
        const first = newLine();
        if (initialProductId) {
            const p = products.find((x) => String(x.id) === String(initialProductId));
            if (p) {
                first.storageProductId = String(p.id);
                first.search = p.name || '';
            }
        }
        return [first, newLine(), newLine()];
    });
    const [saving, setSaving] = useState(false);

    const [locations, setLocations] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [salesReps, setSalesReps] = useState([]);
    const [metaLoading, setMetaLoading] = useState(true);

    const [fromLocationId, setFromLocationId] = useState('');
    const [locationSearch, setLocationSearch] = useState('');
    const [storageCustomerId, setStorageCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [salesRepId, setSalesRepId] = useState('');
    const [adjustmentReason, setAdjustmentReason] = useState('');
    const [adjustmentReasonOther, setAdjustmentReasonOther] = useState('');
    const [amountsTaxInclusive, setAmountsTaxInclusive] = useState(false);

    const productRefs = useRef([]);
    const qtyRefs = useRef([]);
    const costRefs = useRef([]);

    const showUnitPrice = movementType === 'IN' || movementType === 'OUT';
    const unitPriceLabel =
        movementType === 'OUT'
            ? amountsTaxInclusive
                ? 'Unit price (incl. VAT)'
                : 'Unit price (excl. VAT)'
            : amountsTaxInclusive
              ? 'Unit cost (incl. VAT)'
              : 'Unit cost (excl. VAT)';

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setMetaLoading(true);
            try {
                const [locRes, custRes, repRes] = await Promise.all([
                    sfApi.listStorageLocations(brandId),
                    sfApi.listStorageCustomers(brandId),
                    sfApi.listStorageSalesReps(brandId),
                ]);
                if (cancelled) return;
                const locs = locRes?.locations ?? [];
                setLocations(locs);
                setCustomers(custRes?.customers ?? []);
                setSalesReps(repRes?.salesReps ?? []);
                const defaultLoc = locs.find((l) => l.locationKind === 'owner_warehouse');
                if (defaultLoc) {
                    setFromLocationId(String(defaultLoc.id));
                    setLocationSearch(locationLabel(defaultLoc));
                }
            } catch {
                /* optional */
            } finally {
                if (!cancelled) setMetaLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [brandId]);

    const locationOptions = useMemo(
        () =>
            locations.map((loc) => ({
                id: loc.id,
                label: loc.name,
                subtitle: [loc.companyName, loc.locationKind === 'owner_warehouse' ? 'Main warehouse' : 'Storage']
                    .filter(Boolean)
                    .join(' · '),
            })),
        [locations],
    );

    const customerOptions = useMemo(
        () =>
            customers.map((c) => ({
                id: c.id,
                label: c.name,
                subtitle: [c.code, c.mobile].filter(Boolean).join(' · ') || undefined,
            })),
        [customers],
    );

    const calculatedDueDate = useMemo(() => {
        const issue = new Date(issueDate);
        if (Number.isNaN(issue.getTime())) return '—';
        if (dueDateType === 'Custom') return customDueDate || '—';
        if (dueDateType === 'EOM') {
            return new Date(issue.getFullYear(), issue.getMonth() + 1, 0)
                .toISOString()
                .slice(0, 10);
        }
        const due = new Date(issue);
        due.setDate(issue.getDate() + parseInt(String(netDays || 0), 10));
        return due.toISOString().slice(0, 10);
    }, [issueDate, dueDateType, netDays, customDueDate]);

    const updateLine = useCallback((key, patch) => {
        setLines((prev) =>
            prev.map((ln) => (ln.key === key ? { ...ln, ...patch } : ln)),
        );
    }, []);

    const addLine = useCallback((focusProduct = true) => {
        setLines((prev) => [...prev, newLine()]);
        if (focusProduct) {
            window.setTimeout(() => {
                productRefs.current[productRefs.current.length - 1]?.focus();
            }, 50);
        }
    }, []);

    const removeLine = (key) => {
        setLines((prev) => (prev.length <= 1 ? [newLine()] : prev.filter((ln) => ln.key !== key)));
    };

    const validLines = useMemo(
        () =>
            lines.filter(
                (ln) =>
                    ln.storageProductId &&
                    ln.qty !== '' &&
                    Number(ln.qty) > 0 &&
                    Number.isFinite(Number(ln.qty)),
            ),
        [lines],
    );

    const linesForTotals = useMemo(
        () =>
            lines
                .filter((ln) => ln.qty !== '' && ln.unitCost !== '')
                .map((ln) => ({ qty: ln.qty, unitAmount: ln.unitCost })),
        [lines],
    );

    const totals = useMemo(
        () => computeStorageTotals(linesForTotals, amountsTaxInclusive),
        [linesForTotals, amountsTaxInclusive],
    );

    const hasPricedLines = totals.grandTotal > 0;

    const isStockSale = movementType === 'OUT' && !!storageCustomerId && hasPricedLines;

    const resolvedAdjustmentReason = useMemo(() => {
        if (adjustmentReason === 'other') return adjustmentReasonOther.trim() || 'Other';
        const opt = ADJUSTMENT_REASONS.find((r) => r.value === adjustmentReason);
        return opt?.label && adjustmentReason ? opt.label : '';
    }, [adjustmentReason, adjustmentReasonOther]);

    const submit = async (e) => {
        e.preventDefault();
        if (validLines.length === 0) {
            window.alert('Add at least one product with quantity.');
            return;
        }
        if (isStockSale && validLines.some((ln) => !ln.unitCost || Number(ln.unitCost) <= 0)) {
            window.alert('Stock sale: every line needs a unit price.');
            return;
        }
        if (movementType === 'ADJUSTMENT' && !resolvedAdjustmentReason) {
            window.alert('Select an adjustment reason.');
            return;
        }

        const noteParts = [
            reference.trim() ? `Ref: ${reference.trim()}` : null,
            description.trim() || null,
            billingAddress.trim() ? `Bill to: ${billingAddress.trim()}` : null,
            notes.trim() || null,
        ].filter(Boolean);

        setSaving(true);
        try {
            const res = await sfApi.postStorageBulkMovements(brandId, {
                movementType,
                issueDate,
                fromLocationId:
                    movementType === 'IN' && fromLocationId ? fromLocationId : undefined,
                storageCustomerId:
                    movementType === 'OUT' && storageCustomerId
                        ? storageCustomerId
                        : undefined,
                salesRepId: movementType === 'OUT' && salesRepId ? salesRepId : undefined,
                adjustmentReason:
                    movementType === 'ADJUSTMENT' ? resolvedAdjustmentReason : undefined,
                notes: noteParts.length ? noteParts.join('\n') : undefined,
                lines: validLines.map((ln) => ({
                    storageProductId: ln.storageProductId,
                    qty: Number(ln.qty),
                    unitCost:
                        ln.unitCost !== ''
                            ? unitAmountForApi(ln.unitCost, amountsTaxInclusive)
                            : undefined,
                })),
            });
            if (res?.isStockSale && res?.invoiceNo) {
                window.alert(
                    `Sale posted as invoice ${res.invoiceNo}. Customer AR updated: ${fmtSar(res.grandTotal)}.`,
                );
            }
            onSaved?.();
            onClose?.();
        } catch (ex) {
            window.alert(ex?.message || 'Could not save movements');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            title="Record stock movement"
            size="large"
            onClose={() => !saving && onClose?.()}
            contentClassName="sf-doc-modal"
            disableClose={saving}
        >
            <form className="pi-form-container sf-doc-modal-shell" onSubmit={submit}>
                <div className="sf-doc-modal-top">
                <p className="sf-doc-modal-lead">
                    {brandName ? `${brandName} — ` : ''}
                    Record stock in, stock out, or adjustment. Use Tab between fields; product search
                    supports ↑↓ and Enter.
                </p>

                <div className="pi-header-grid">
                    <div className="pi-field">
                        <label>Issue date</label>
                        <div className="pi-input-with-icon">
                            <input
                                type="date"
                                value={issueDate}
                                onChange={(e) => setIssueDate(e.target.value)}
                            />
                            <Calendar size={16} />
                        </div>
                    </div>
                    <div className="pi-field">
                        <label>Due date</label>
                        <div
                            className={`pi-due-grid ${dueDateType === 'EOM' ? 'pi-due-eom' : ''}`}
                        >
                            <select
                                value={dueDateType}
                                onChange={(e) => setDueDateType(e.target.value)}
                            >
                                <option value="Net">Net</option>
                                <option value="Custom">Custom</option>
                                <option value="EOM">EOM</option>
                            </select>
                            {dueDateType === 'Net' ? (
                                <div className="pi-days-input">
                                    <input
                                        type="number"
                                        min="0"
                                        value={netDays}
                                        onChange={(e) => setNetDays(e.target.value)}
                                    />
                                    <span>days</span>
                                </div>
                            ) : null}
                            {dueDateType === 'Custom' ? (
                                <div className="pi-date-input-small">
                                    <input
                                        type="date"
                                        value={customDueDate}
                                        onChange={(e) => setCustomDueDate(e.target.value)}
                                    />
                                </div>
                            ) : null}
                        </div>
                        <span className="pi-sub-label">Due: {calculatedDueDate}</span>
                    </div>
                    <div className="pi-field">
                        <label>Reference (optional)</label>
                        <input
                            type="text"
                            placeholder="Ref #"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                        />
                    </div>
                </div>

                <div className="pi-header-grid">
                    <div className="pi-field">
                        <label>Transaction type</label>
                        <select
                            value={movementType}
                            onChange={(e) => setMovementType(e.target.value)}
                        >
                            <option value="IN">Stock in</option>
                            <option value="OUT">Stock out</option>
                            <option value="ADJUSTMENT">Adjustment</option>
                        </select>
                    </div>

                    {movementType === 'IN' ? (
                        <div className="pi-field" style={{ gridColumn: 'span 2' }}>
                            <label>Received from (location &amp; company)</label>
                            <SearchableEntityCombobox
                                options={locationOptions}
                                value={fromLocationId}
                                displayText={locationSearch}
                                disabled={metaLoading}
                                onDisplayTextChange={(t) => {
                                    setLocationSearch(t);
                                    setFromLocationId('');
                                }}
                                onSelect={(loc) => {
                                    setFromLocationId(String(loc.id));
                                    const full = locations.find(
                                        (l) => String(l.id) === String(loc.id),
                                    );
                                    setLocationSearch(
                                        full ? locationLabel(full) : loc.label,
                                    );
                                }}
                                placeholder="Search location…"
                            />
                        </div>
                    ) : null}

                    {movementType === 'OUT' ? (
                        <>
                            <div className="pi-field">
                                <label>Customer</label>
                                <SearchableEntityCombobox
                                    options={customerOptions}
                                    value={storageCustomerId}
                                    displayText={customerSearch}
                                    disabled={metaLoading}
                                    onDisplayTextChange={(t) => {
                                        setCustomerSearch(t);
                                        setStorageCustomerId('');
                                    }}
                                    onSelect={(c) => {
                                        setStorageCustomerId(String(c.id));
                                        setCustomerSearch(c.label);
                                    }}
                                    placeholder="Search customer…"
                                />
                            </div>
                            <div className="pi-field">
                                <label>Sales representative</label>
                                <select
                                    value={salesRepId}
                                    disabled={metaLoading}
                                    onChange={(e) => setSalesRepId(e.target.value)}
                                >
                                    <option value="">Optional</option>
                                    {salesReps.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            {r.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </>
                    ) : null}

                    {movementType === 'ADJUSTMENT' ? (
                        <div className="pi-field" style={{ gridColumn: 'span 2' }}>
                            <label>Adjustment reason *</label>
                            <select
                                value={adjustmentReason}
                                onChange={(e) => setAdjustmentReason(e.target.value)}
                                required
                            >
                                {ADJUSTMENT_REASONS.map((r) => (
                                    <option key={r.value || 'empty'} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                            {adjustmentReason === 'other' ? (
                                <input
                                    type="text"
                                    className="sf-pi-cell-input"
                                    style={{ marginTop: 8 }}
                                    placeholder="Describe reason"
                                    value={adjustmentReasonOther}
                                    onChange={(e) =>
                                        setAdjustmentReasonOther(e.target.value)
                                    }
                                />
                            ) : null}
                        </div>
                    ) : null}
                </div>

                {(movementType === 'OUT' && storageCustomerId) || movementType === 'IN' ? (
                    <div className="sf-doc-meta-grid">
                        <div className="pi-field">
                            <label>Billing address (optional)</label>
                            <textarea
                                rows={1}
                                className="sf-compact-textarea"
                                placeholder="Address or delivery note"
                                value={billingAddress}
                                onChange={(e) => setBillingAddress(e.target.value)}
                            />
                        </div>
                        <div className="pi-field">
                            <label>Description (optional)</label>
                            <input
                                type="text"
                                placeholder="Short description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="pi-field" style={{ marginBottom: 12, maxWidth: 520 }}>
                        <label>Description (optional)</label>
                        <input
                            type="text"
                            placeholder="Short description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                )}
                </div>

                <div className="sf-doc-modal-scroll">
                <div className="pi-lines-section">
                    <div
                        className="pi-lines-header sf-pi-lines-header"
                        style={{ gridTemplateColumns: LINE_GRID }}
                    >
                        <div>#</div>
                        <div>Product</div>
                        <div>Qty</div>
                        {showUnitPrice ? <div>{unitPriceLabel}</div> : <div />}
                        <div />
                    </div>
                    {lines.map((ln, rowIndex) => (
                        <div
                            key={ln.key}
                            className="pi-line-row sf-pi-line-data-row"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: LINE_GRID,
                                gap: 12,
                                alignItems: 'start',
                            }}
                        >
                            <span className="sf-pi-line-num">{rowIndex + 1}</span>
                            <ProductLineCombobox
                                products={products}
                                value={ln.storageProductId}
                                searchText={ln.search}
                                inputRef={(el) => {
                                    productRefs.current[rowIndex] = el;
                                }}
                                onSearchChange={(search) =>
                                    updateLine(ln.key, { search, storageProductId: '' })
                                }
                                onSelect={(p) =>
                                    updateLine(ln.key, {
                                        storageProductId: String(p.id),
                                        search: p.name || '',
                                    })
                                }
                                onTabAdvance={() => qtyRefs.current[rowIndex]?.focus()}
                            />
                            <input
                                ref={(el) => {
                                    qtyRefs.current[rowIndex] = el;
                                }}
                                type="number"
                                min="0.001"
                                step="any"
                                className="sf-pi-cell-input"
                                value={ln.qty}
                                onChange={(e) => updateLine(ln.key, { qty: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Tab' && !e.shiftKey) {
                                        if (showUnitPrice) {
                                            e.preventDefault();
                                            costRefs.current[rowIndex]?.focus();
                                        } else if (rowIndex === lines.length - 1) {
                                            e.preventDefault();
                                            addLine(true);
                                        }
                                    }
                                }}
                            />
                            {showUnitPrice ? (
                                <input
                                    ref={(el) => {
                                        costRefs.current[rowIndex] = el;
                                    }}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="sf-pi-cell-input"
                                    placeholder={
                                        movementType === 'OUT' && storageCustomerId
                                            ? 'Required'
                                            : 'Optional'
                                    }
                                    value={ln.unitCost}
                                    onChange={(e) =>
                                        updateLine(ln.key, { unitCost: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Tab' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (rowIndex === lines.length - 1) addLine(true);
                                            else productRefs.current[rowIndex + 1]?.focus();
                                        }
                                    }}
                                />
                            ) : (
                                <div />
                            )}
                            <button
                                type="button"
                                className="sf-bulk-row-remove"
                                onClick={() => removeLine(ln.key)}
                                tabIndex={-1}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    <div className="pi-line-row">
                        <button type="button" className="btn-add-line" onClick={() => addLine(true)}>
                            <Plus size={16} /> Add line
                        </button>
                    </div>
                </div>
                </div>

                <div className="sf-doc-modal-bottom">
                {showUnitPrice ? (
                    <StorageFacilityVatTotals
                        lines={linesForTotals}
                        amountsTaxInclusive={amountsTaxInclusive}
                        onAmountsTaxInclusiveChange={setAmountsTaxInclusive}
                        unitFieldLabel={
                            movementType === 'OUT' ? 'Unit price' : 'Unit cost'
                        }
                        footerHint={
                            isStockSale
                                ? 'Posting creates a stock sale invoice and updates customer AR.'
                                : ''
                        }
                    />
                ) : null}

                <div className="pi-field" style={{ maxWidth: 480, marginBottom: 0 }}>
                    <label>Internal notes (optional)</label>
                    <textarea
                        rows={1}
                        className="sf-compact-textarea"
                        placeholder="Additional notes…"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                <div className="sf-doc-modal-footer">
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={saving}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="mgr-si-btn-new"
                        disabled={saving || validLines.length === 0}
                    >
                        {saving
                            ? 'Saving…'
                            : isStockSale
                              ? `Post sale (${fmtSar(totals.grandTotal)})`
                              : `Record ${validLines.length} line${validLines.length === 1 ? '' : 's'}`}
                    </button>
                </div>
                </div>
            </form>
        </Modal>
    );
}
