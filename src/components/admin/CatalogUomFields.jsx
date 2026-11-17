import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
    WS_WAREHOUSE_UNIT_PRESETS,
    WS_WORKSHOP_UNIT_PRESETS,
    formatUomRule,
} from '../../pages/workshop/workshopUomUtils';
import { mcT } from '../../utils/masterCatalogI18n';

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

export default function CatalogUomFields({ value, onChange, idPrefix = 'catalog-uom', t: tProp }) {
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = tProp || ((key, vars) => mcT(locale, key, vars));

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
            <label className="mc-uom-block-label">{t('uom.title')}</label>
            <div className="mc-uom-flow">
                <div className="mc-uom-flow-unit">
                    <label htmlFor={`${idPrefix}-wh`}>{t('uom.warehouse')}</label>
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
                        aria-label={t('uom.factor')}
                    />
                </div>
                <div className="mc-uom-flow-unit">
                    <label htmlFor={`${idPrefix}-ws`}>{t('uom.workshop')}</label>
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
                <span className="mc-uom-preview-label">{t('uom.rule')}</span>
                <span className="mc-uom-preview-rule">{rulePreview}</span>
            </p>
            <p className="mc-uom-hint">
                {t('uom.hint', { unit: wsUnitLabel }).split(wsUnitLabel).map((part, i, arr) =>
                    i < arr.length - 1 ? (
                        <React.Fragment key={i}>
                            {part}
                            <strong>{wsUnitLabel}</strong>
                        </React.Fragment>
                    ) : (
                        <React.Fragment key={i}>{part}</React.Fragment>
                    ),
                )}
            </p>
        </div>
    );
}
