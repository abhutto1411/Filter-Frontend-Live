import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Package } from 'lucide-react';
import WorkshopSubScreen from '../../components/workshop/WorkshopSubScreen';
import { patchBranchProduct, postBranchBulkProductUom } from '../../services/workshopCatalogApi';

const WAREHOUSE_UNIT_PRESETS = ['Box', 'Carton', 'Dozen', 'Pack', 'Drum', 'Bag', 'liter', 'pcs'];
const WORKSHOP_UNIT_PRESETS = ['pcs', 'Liter', 'liter', 'kg', 'ml', 'Set', 'piece'];

export function formatWorkshopConversionRule(warehouseUnit, workshopUnit, cf) {
    const wu = String(warehouseUnit || '').trim();
    const ws = String(workshopUnit || '').trim();
    const n = Number(cf) || 1;
    if (!wu) return '—';
    if (!ws || wu.toLowerCase() === ws.toLowerCase()) {
        return n === 1 ? wu : `1 ${wu} = ${n} ${ws || wu}`;
    }
    return `1 ${wu} = ${n} ${ws}`;
}

function UomFormFields({
    warehouseUnit,
    setWarehouseUnit,
    workshopUnit,
    setWorkshopUnit,
    conversionFactor,
    setConversionFactor,
    rulePreview,
}) {
    return (
        <>
            <div className="ws-uom-flow">
                <div className="ws-uom-flow-unit">
                    <label htmlFor="ws-uom-wh">Warehouse UOM</label>
                    <select
                        id="ws-uom-wh"
                        value={warehouseUnit}
                        onChange={(e) => setWarehouseUnit(e.target.value)}
                    >
                        {[...new Set([...WAREHOUSE_UNIT_PRESETS, warehouseUnit])].map((u) => (
                            <option key={u} value={u}>
                                {u}
                            </option>
                        ))}
                    </select>
                    <span className="ws-uom-flow-hint">Purchase / bulk unit</span>
                </div>

                <div className="ws-uom-flow-bridge" aria-hidden>
                    <span>1 =</span>
                    <input
                        id="ws-uom-cf"
                        type="number"
                        min="0.0001"
                        step="any"
                        value={conversionFactor}
                        onChange={(e) => setConversionFactor(e.target.value)}
                        aria-label="Conversion factor"
                    />
                </div>

                <div className="ws-uom-flow-unit">
                    <label htmlFor="ws-uom-ws">Workshop UOM</label>
                    <select
                        id="ws-uom-ws"
                        value={workshopUnit}
                        onChange={(e) => setWorkshopUnit(e.target.value)}
                    >
                        {[...new Set([...WORKSHOP_UNIT_PRESETS, workshopUnit])].map((u) => (
                            <option key={u} value={u}>
                                {u}
                            </option>
                        ))}
                    </select>
                    <span className="ws-uom-flow-hint">Inventory &amp; sales unit</span>
                </div>
            </div>

            <div className="ws-uom-preview">
                <span className="ws-uom-preview-label">Conversion rule</span>
                <div className="ws-uom-preview-rule">{rulePreview}</div>
            </div>
        </>
    );
}

export default function WorkshopProductUomEditModal({
    product,
    branchId,
    workshopId,
    onClose,
    onSaved,
}) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [warehouseUnit, setWarehouseUnit] = useState('Box');
    const [workshopUnit, setWorkshopUnit] = useState('Liter');
    const [conversionFactor, setConversionFactor] = useState('1');

    useEffect(() => {
        if (!product) return;
        setWarehouseUnit(String(product.warehouseUnit || 'Box').trim() || 'Box');
        setWorkshopUnit(String(product.workshopUnit || product.unit || 'pcs').trim() || 'pcs');
        setConversionFactor(String(product.conversionFactor ?? 1));
        setError('');
    }, [product]);

    const rulePreview = useMemo(
        () => formatWorkshopConversionRule(warehouseUnit, workshopUnit, conversionFactor),
        [warehouseUnit, workshopUnit, conversionFactor],
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!product?.id || !branchId) return;
        const cf = Math.max(0.0001, Number(conversionFactor) || 1);
        const wu = warehouseUnit.trim() || 'Box';
        const wsu = workshopUnit.trim() || 'pcs';
        setSaving(true);
        setError('');
        try {
            const res = await patchBranchProduct(
                branchId,
                String(product.id),
                { warehouseUnit: wu, workshopUnit: wsu, conversionFactor: cf },
                { workshopId },
            );
            if (res && typeof res === 'object' && res.success === false) {
                throw new Error(res.message || 'Failed to update units');
            }
            onSaved?.({
                warehouseUnit: wu,
                workshopUnit: wsu,
                conversionFactor: cf,
                conversionRule: formatWorkshopConversionRule(wu, wsu, cf),
            });
            onClose?.();
        } catch (ex) {
            setError(ex?.message || 'Failed to update units');
        } finally {
            setSaving(false);
        }
    };

    if (!product) return null;

    const stockLabel =
        product.isInfiniteQty
            ? 'Unlimited stock'
            : product.qty != null
              ? `${product.qty} ${product.workshopUnit || product.unit || 'units'} on hand`
              : null;

    return (
        <WorkshopSubScreen
            title="Edit UOM & conversion"
            subtitle="Stock quantity is not changed — only unit labels and conversion rules."
            backLabel="Back to Inventory"
            onBack={() => !saving && onClose?.()}
            backDisabled={saving}
            footer={(
                <>
                    <button type="button" className="mc-btn-ghost mc-btn-large" disabled={saving} onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" form="ws-uom-edit-form" className="mc-btn-primary mc-btn-large blue-btn" disabled={saving}>
                        {saving ? 'Saving…' : 'Save rule'}
                    </button>
                </>
            )}
        >
            <div className="ws-section" style={{ padding: 20 }}>
                <form id="ws-uom-edit-form" onSubmit={handleSubmit} className="ws-uom-modal-body">
                    <div className="ws-uom-product-card">
                        <p className="ws-uom-product-name">{product.name}</p>
                        <p className="ws-uom-product-meta">
                            {[product.sku, product.departmentName, stockLabel].filter(Boolean).join(' · ')}
                        </p>
                    </div>

                    <p className="ws-uom-notice">
                        <AlertTriangle size={16} className="ws-uom-notice-icon" aria-hidden />
                        <span>
                            Stock quantity is not changed — only how units are labeled and converted
                            (e.g. Box vs Liter). Use <strong>Manual Adjust</strong> to change quantities.
                        </span>
                    </p>

                    <UomFormFields
                        warehouseUnit={warehouseUnit}
                        setWarehouseUnit={setWarehouseUnit}
                        workshopUnit={workshopUnit}
                        setWorkshopUnit={setWorkshopUnit}
                        conversionFactor={conversionFactor}
                        setConversionFactor={setConversionFactor}
                        rulePreview={rulePreview}
                    />

                    {error ? <p className="ws-uom-error">{error}</p> : null}
                </form>
            </div>
        </WorkshopSubScreen>
    );
}

export function WorkshopBulkUomModal({ products, branchId, workshopId, onClose, onSaved }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [warehouseUnit, setWarehouseUnit] = useState('Box');
    const [workshopUnit, setWorkshopUnit] = useState('Liter');
    const [conversionFactor, setConversionFactor] = useState('1');

    const rulePreview = useMemo(
        () => formatWorkshopConversionRule(warehouseUnit, workshopUnit, conversionFactor),
        [warehouseUnit, workshopUnit, conversionFactor],
    );

    const previewNames = useMemo(() => {
        const names = (products || []).slice(0, 4).map((p) => p.name).filter(Boolean);
        const rest = (products?.length || 0) - names.length;
        if (rest > 0) names.push(`+${rest} more`);
        return names.join(', ');
    }, [products]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!products?.length || !branchId) return;
        const cf = Math.max(0.0001, Number(conversionFactor) || 1);
        const wu = warehouseUnit.trim() || 'Box';
        const wsu = workshopUnit.trim() || 'pcs';
        setSaving(true);
        setError('');
        try {
            const res = await postBranchBulkProductUom(
                branchId,
                {
                    productIds: products.map((p) => String(p.id)),
                    warehouseUnit: wu,
                    workshopUnit: wsu,
                    conversionFactor: cf,
                },
                { workshopId },
            );
            if (res && typeof res === 'object' && res.success === false && res.updated === 0) {
                throw new Error(res.failures?.[0]?.message || res.message || 'Bulk UOM update failed');
            }
            onSaved?.({
                warehouseUnit: wu,
                workshopUnit: wsu,
                conversionFactor: cf,
                conversionRule: formatWorkshopConversionRule(wu, wsu, cf),
                updated: res?.updated ?? products.length,
                failures: res?.failures ?? [],
            });
            onClose?.();
        } catch (ex) {
            setError(ex?.message || 'Failed to update units');
        } finally {
            setSaving(false);
        }
    };

    if (!products?.length) return null;

    return (
        <WorkshopSubScreen
            title={`Set UOM for ${products.length} product${products.length !== 1 ? 's' : ''}`}
            subtitle="Same rule applied to every selected product. Quantities stay unchanged."
            backLabel="Back to Inventory"
            onBack={() => !saving && onClose?.()}
            backDisabled={saving}
            size="wide"
            footer={(
                <>
                    <button type="button" className="mc-btn-ghost mc-btn-large" disabled={saving} onClick={onClose}>
                        Cancel
                    </button>
                    <button type="submit" form="ws-bulk-uom-form" className="mc-btn-primary mc-btn-large blue-btn" disabled={saving}>
                        {saving ? 'Applying…' : `Apply to ${products.length}`}
                    </button>
                </>
            )}
        >
            <div className="ws-section" style={{ padding: 20 }}>
                <form id="ws-bulk-uom-form" onSubmit={handleSubmit} className="ws-uom-modal-body">
                    <p className="ws-uom-bulk-summary">
                        <Package size={15} style={{ verticalAlign: -2, marginRight: 6 }} aria-hidden />
                        {previewNames}
                    </p>

                    <p className="ws-uom-notice">
                        <ArrowRightLeft size={16} className="ws-uom-notice-icon" aria-hidden />
                        <span>Same rule applied to every selected product. Quantities stay unchanged.</span>
                    </p>

                    <UomFormFields
                        warehouseUnit={warehouseUnit}
                        setWarehouseUnit={setWarehouseUnit}
                        workshopUnit={workshopUnit}
                        setWorkshopUnit={setWorkshopUnit}
                        conversionFactor={conversionFactor}
                        setConversionFactor={setConversionFactor}
                        rulePreview={rulePreview}
                    />

                    {error ? <p className="ws-uom-error">{error}</p> : null}
                </form>
            </div>
        </WorkshopSubScreen>
    );
}
