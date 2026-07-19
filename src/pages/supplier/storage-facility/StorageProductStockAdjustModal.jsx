import React, { useEffect, useMemo, useState } from 'react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import Modal from '../../../components/Modal';
import { formatUomRule, normUomKey, productEffectiveUom } from './storageFacilityUomUtils';

function fmtQty(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    return v.toFixed(3).replace(/\.?0+$/, '');
}

export default function StorageProductStockAdjustModal({
    brandId,
    product,
    onClose,
    onSaved,
}) {
    const sfApi = useStorageFacilityApi();
    const [adjustmentType, setAdjustmentType] = useState('remove');
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustNotes, setAdjustNotes] = useState('');
    const [busy, setBusy] = useState(false);

    const eff = useMemo(() => productEffectiveUom(product || {}), [product]);
    const cf = Math.max(0.0001, Number(eff.conversionFactor) || 1);
    const splitUom =
        eff.warehouseUnit &&
        eff.workshopUnit &&
        normUomKey(eff.warehouseUnit) !== normUomKey(eff.workshopUnit) &&
        cf > 1;

    const currentWs = Number(product?.qtyOnHand) || 0;
    const currentWh = splitUom ? currentWs / cf : currentWs;

    useEffect(() => {
        if (!product) return;
        setAdjustmentType('remove');
        setAdjustQty('');
        setAdjustNotes('');
    }, [product]);

    if (!product) return null;

    const qtyInput = Number.parseFloat(String(adjustQty).replace(/,/g, ''));
    const previewWs = (() => {
        if (!Number.isFinite(qtyInput) || qtyInput < 0) return null;
        if (adjustmentType === 'set') {
            return splitUom ? qtyInput * cf : qtyInput;
        }
        if (adjustmentType === 'add') {
            return splitUom ? currentWs + qtyInput * cf : currentWs + qtyInput;
        }
        return splitUom
            ? Math.max(0, currentWs - qtyInput * cf)
            : Math.max(0, currentWs - qtyInput);
    })();

    const handleConfirm = async () => {
        if (!product?.id || busy) return;
        if (!Number.isFinite(qtyInput) || qtyInput < 0) return;
        if (adjustmentType !== 'set' && qtyInput <= 0) return;

        const newWs = previewWs != null ? previewWs : currentWs;
        if (Math.abs(newWs - currentWs) < 0.0001) {
            onClose?.();
            return;
        }

        const entryUnit = splitUom ? eff.warehouseUnit : eff.workshopUnit;
        let movementType;
        let postQty;

        if (adjustmentType === 'set') {
            const targetWh = qtyInput;
            const deltaWh = targetWh - currentWh;
            movementType = deltaWh > 0 ? 'IN' : 'OUT';
            postQty = Math.abs(deltaWh);
        } else if (adjustmentType === 'add') {
            movementType = 'IN';
            postQty = qtyInput;
        } else {
            movementType = 'OUT';
            postQty = qtyInput;
        }

        const autoNote =
            adjustmentType === 'set' && newWs === 0 && !adjustNotes.trim()
                ? 'Stock set to zero'
                : adjustmentType === 'set' && !adjustNotes.trim()
                  ? `Stock set to ${fmtQty(splitUom ? newWs / cf : newWs)} ${entryUnit}`
                  : '';

        setBusy(true);
        try {
            await sfApi.postStorageMovement(brandId, {
                storageProductId: String(product.id),
                movementType,
                qty: postQty,
                unit: entryUnit,
                uomProfileId: product.uomProfileId || undefined,
                notes: adjustNotes.trim() || autoNote || undefined,
            });
            onSaved?.({ qtyOnHand: newWs });
            onClose?.();
        } catch (ex) {
            window.alert(ex?.message || 'Adjustment failed');
        } finally {
            setBusy(false);
        }
    };

    const qtyLabel = splitUom ? eff.warehouseUnit : eff.workshopUnit;

    return (
        <Modal
            title={`Stock adjustment — ${product.name}`}
            disableClose={busy}
            onClose={() => !busy && onClose?.()}
            footer={
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        disabled={busy}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-portal"
                        style={{
                            background: 'var(--color-text-dark)',
                            color: '#fff',
                            border: 'none',
                        }}
                        disabled={
                            busy ||
                            adjustQty === '' ||
                            !Number.isFinite(qtyInput) ||
                            qtyInput < 0 ||
                            (adjustmentType !== 'set' && qtyInput <= 0)
                        }
                        onClick={handleConfirm}
                    >
                        {busy ? 'Saving…' : 'Confirm adjustment'}
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
                        Current stock
                    </label>
                    <p
                        style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            margin: 0,
                        }}
                    >
                        {splitUom
                            ? `${fmtQty(currentWh)} ${eff.warehouseUnit}`
                            : `${fmtQty(currentWs)} ${eff.workshopUnit}`}
                    </p>
                    {splitUom ? (
                        <p
                            style={{
                                margin: '6px 0 0',
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                            }}
                        >
                            {fmtQty(currentWs)} {eff.workshopUnit} in stock ·{' '}
                            {formatUomRule(eff.warehouseUnit, eff.workshopUnit, cf)}
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
                        Adjustment type
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                            { id: 'add', label: '+ Add stock' },
                            { id: 'remove', label: '− Remove stock' },
                            { id: 'set', label: 'Set level' },
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setAdjustmentType(opt.id)}
                                style={{
                                    flex: 1,
                                    minWidth: 100,
                                    padding: '10px 14px',
                                    borderRadius: 8,
                                    border:
                                        opt.id === 'remove'
                                            ? 'none'
                                            : '1px solid var(--color-border)',
                                    background:
                                        adjustmentType === opt.id
                                            ? opt.id === 'remove'
                                                ? '#DC2626'
                                                : opt.id === 'set'
                                                  ? '#1D4ED8'
                                                  : 'var(--color-text-dark)'
                                            : opt.id === 'remove'
                                              ? '#FEE2E2'
                                              : opt.id === 'set'
                                                ? '#EFF6FF'
                                                : 'var(--color-bg-muted)',
                                    color:
                                        adjustmentType === opt.id
                                            ? '#fff'
                                            : opt.id === 'remove'
                                              ? '#B91C1C'
                                              : opt.id === 'set'
                                                ? '#1E40AF'
                                                : 'var(--color-text-body)',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="sf-adjust-qty"
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--color-text-muted)',
                            marginBottom: 4,
                        }}
                    >
                        {adjustmentType === 'set'
                            ? `New stock level (${qtyLabel})`
                            : `Quantity (${qtyLabel})`}
                    </label>
                    <input
                        id="sf-adjust-qty"
                        type="number"
                        min="0"
                        step="any"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                        }}
                    />
                    {previewWs != null && Number.isFinite(qtyInput) ? (
                        <p
                            style={{
                                margin: '8px 0 0',
                                fontSize: '0.8125rem',
                                color: '#64748b',
                            }}
                        >
                            Result:{' '}
                            {splitUom
                                ? `${fmtQty(previewWs / cf)} ${eff.warehouseUnit}`
                                : `${fmtQty(previewWs)} ${eff.workshopUnit}`}
                            {splitUom
                                ? ` (${fmtQty(previewWs)} ${eff.workshopUnit})`
                                : ''}
                        </p>
                    ) : null}
                </div>

                <div>
                    <label
                        htmlFor="sf-adjust-notes"
                        style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--color-text-muted)',
                            marginBottom: 4,
                        }}
                    >
                        Notes (optional)
                    </label>
                    <textarea
                        id="sf-adjust-notes"
                        rows={2}
                        value={adjustNotes}
                        onChange={(e) => setAdjustNotes(e.target.value)}
                        placeholder="Reason for adjustment"
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            resize: 'vertical',
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
}
