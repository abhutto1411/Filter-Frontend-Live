import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { getSupplierProduct, updateSupplierProduct } from '../../services/supplierApi';

const WAREHOUSE_UNIT_PRESETS = ['Box', 'Carton', 'Dozen', 'Pack', 'Drum', 'Bag', 'liter', 'pcs'];
const WORKSHOP_UNIT_PRESETS = ['pcs', 'Liter', 'liter', 'kg', 'ml', 'Set', 'piece'];

function formatConversionRule(warehouseUnit, workshopUnit, cf) {
    const wu = String(warehouseUnit || '').trim();
    const ws = String(workshopUnit || '').trim();
    const n = Number(cf) || 1;
    if (!wu) return '—';
    if (!ws || wu.toLowerCase() === ws.toLowerCase()) return wu;
    return `1 ${wu} = ${n} ${ws}`;
}

export default function StockProductUomEditModal({ product, onClose, onSaved }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [warehouseUnit, setWarehouseUnit] = useState('Box');
    const [workshopUnit, setWorkshopUnit] = useState('Liter');
    const [conversionFactor, setConversionFactor] = useState('1');

    useEffect(() => {
        if (!product?.id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const res = await getSupplierProduct(product.id);
                const p = res?.product ?? res;
                if (cancelled) return;
                setWarehouseUnit(
                    String(p?.warehouseUnit || product.warehouseUnit || 'Box').trim() || 'Box',
                );
                setWorkshopUnit(
                    String(
                        p?.workshopUnit || p?.unit || product.unit || 'pcs',
                    ).trim() || 'pcs',
                );
                setConversionFactor(
                    String(p?.conversionFactor ?? product.conversionFactor ?? 1),
                );
            } catch (ex) {
                if (!cancelled) {
                    setWarehouseUnit(product.warehouseUnit || 'Box');
                    setWorkshopUnit(product.unit || 'pcs');
                    setConversionFactor(String(product.conversionFactor ?? 1));
                    setError(ex?.message || 'Could not load product details');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [product]);

    const rulePreview = useMemo(
        () => formatConversionRule(warehouseUnit, workshopUnit, conversionFactor),
        [warehouseUnit, workshopUnit, conversionFactor],
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        const cf = Math.max(0.0001, Number(conversionFactor) || 1);
        const wu = warehouseUnit.trim() || 'Box';
        const wsu = workshopUnit.trim() || 'pcs';
        setSaving(true);
        setError('');
        try {
            await updateSupplierProduct(product.id, {
                warehouseUnit: wu,
                workshopUnit: wsu,
                conversionFactor: cf,
                relabelStockUom: true,
            });
            onSaved?.();
            onClose?.();
        } catch (ex) {
            setError(ex?.message || 'Failed to update units');
        } finally {
            setSaving(false);
        }
    };

    if (!product) return null;

    return (
        <Modal
            title="Edit UOM & conversion"
            width="520px"
            onClose={() => !saving && onClose?.()}
            disableClose={saving}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    <strong>{product.name}</strong>
                    {product.sku ? ` · ${product.sku}` : ''}
                </p>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#b45309' }}>
                    Existing stock is recalculated to keep the same physical quantity (e.g. 36
                    Liter → 3 Box when 1 Box = 12 L). Labels and conversion only — use Adjust if
                    you need to change actual quantities.
                </p>

                {loading ? (
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading…</p>
                ) : (
                    <>
                        <div className="pi-field">
                            <label htmlFor="stock-uom-wh">Warehouse UOM</label>
                            <select
                                id="stock-uom-wh"
                                value={warehouseUnit}
                                onChange={(e) => setWarehouseUnit(e.target.value)}
                            >
                                {[
                                    ...new Set([
                                        ...WAREHOUSE_UNIT_PRESETS,
                                        warehouseUnit,
                                    ]),
                                ].map((u) => (
                                    <option key={u} value={u}>
                                        {u}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="pi-field">
                            <label htmlFor="stock-uom-ws">Workshop UOM</label>
                            <select
                                id="stock-uom-ws"
                                value={workshopUnit}
                                onChange={(e) => setWorkshopUnit(e.target.value)}
                            >
                                {[
                                    ...new Set([
                                        ...WORKSHOP_UNIT_PRESETS,
                                        workshopUnit,
                                    ]),
                                ].map((u) => (
                                    <option key={u} value={u}>
                                        {u}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="pi-field">
                            <label htmlFor="stock-uom-cf">
                                Conversion factor (1 warehouse unit = ? workshop units)
                            </label>
                            <input
                                id="stock-uom-cf"
                                type="number"
                                min="0.0001"
                                step="any"
                                value={conversionFactor}
                                onChange={(e) => setConversionFactor(e.target.value)}
                            />
                        </div>
                        <p
                            style={{
                                margin: 0,
                                padding: '10px 12px',
                                background: '#f8fafc',
                                borderRadius: 8,
                                fontSize: '0.8125rem',
                            }}
                        >
                            Rule: <strong>{rulePreview}</strong>
                        </p>
                    </>
                )}

                {error ? (
                    <p style={{ margin: 0, color: '#dc2626', fontSize: '0.8125rem' }}>{error}</p>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
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
                        disabled={saving || loading}
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
