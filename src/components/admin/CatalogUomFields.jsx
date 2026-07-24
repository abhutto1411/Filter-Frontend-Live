import React, { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import {
    WS_WAREHOUSE_UNIT_PRESETS,
    WS_WORKSHOP_UNIT_PRESETS,
    formatUomRule,
} from '../../pages/workshop/workshopUomUtils';

export const emptyCatalogUom = () => ({
    warehouseUnit: 'Box',
    workshopUnit: 'pcs',
    conversionFactor: '1',
});

export function catalogUomFromProduct(product) {
    if (!product) return emptyCatalogUom();
    return {
        warehouseUnit:
            String(product.warehouseUnit || product.warehouse_unit || 'Box').trim() || 'Box',
        workshopUnit:
            String(
                product.workshopUnit ||
                    product.workshop_unit ||
                    product.unit ||
                    'pcs',
            ).trim() || 'pcs',
        conversionFactor: String(product.conversionFactor ?? product.conversion_factor ?? 1),
    };
}

export default function CatalogUomFields({ value, onChange, idPrefix = 'catalog-uom' }) {
    const rulePreview = useMemo(
        () =>
            formatUomRule(
                value.warehouseUnit,
                value.workshopUnit,
                value.conversionFactor,
            ),
        [value.warehouseUnit, value.workshopUnit, value.conversionFactor],
    );

    const wsUnitLabel = String(value.workshopUnit || 'pcs').trim() || 'pcs';

    return (
        <div className="mc-uom-block">
            <label className="mc-uom-block-label">Unit conversion</label>
            <div className="mc-uom-flow">
                <div className="mc-uom-flow-unit">
                    <label htmlFor={`${idPrefix}-wh`}>Warehouse unit</label>
                    <select
                        id={`${idPrefix}-wh`}
                        value={value.warehouseUnit}
                        onChange={(e) =>
                            onChange({ ...value, warehouseUnit: e.target.value })
                        }
                    >
                        {[...new Set([...WS_WAREHOUSE_UNIT_PRESETS, value.warehouseUnit])].map(
                            (u) => (
                                <option key={u} value={u}>
                                    {u}
                                </option>
                            ),
                        )}
                    </select>
                </div>
                <div className="mc-uom-flow-bridge" aria-hidden>
                    <ArrowRight size={16} className="mc-uom-flow-arrow" />
                    <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={value.conversionFactor}
                        onChange={(e) =>
                            onChange({ ...value, conversionFactor: e.target.value })
                        }
                        aria-label="Conversion factor"
                    />
                </div>
                <div className="mc-uom-flow-unit">
                    <label htmlFor={`${idPrefix}-ws`}>Workshop unit</label>
                    <select
                        id={`${idPrefix}-ws`}
                        value={value.workshopUnit}
                        onChange={(e) =>
                            onChange({ ...value, workshopUnit: e.target.value })
                        }
                    >
                        {[...new Set([...WS_WORKSHOP_UNIT_PRESETS, value.workshopUnit])].map(
                            (u) => (
                                <option key={u} value={u}>
                                    {u}
                                </option>
                            ),
                        )}
                    </select>
                </div>
                <div className="mc-uom-flow-result" aria-live="polite">
                    = {Number(value.conversionFactor) || 1}{' '}
                    {wsUnitLabel.toUpperCase()}
                </div>
            </div>
            <p className="mc-uom-preview">
                <span className="mc-uom-preview-label">Rule</span>
                <span className="mc-uom-preview-rule">{rulePreview}</span>
            </p>
            <p className="mc-uom-hint">
                Stock and sales use <strong>{wsUnitLabel}</strong> as the workshop unit. Suppliers
                and workshops inherit this rule from the master catalog.
            </p>
        </div>
    );
}
