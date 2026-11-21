import React from 'react';
import {
    INV_COST_BASIS_LATEST,
    INV_COST_BASIS_WEIGHTED,
} from '../../utils/workshopInventoryI18n';

/** Segmented Latest purchase / Moving average — shared with RF-17. */
export default function InventoryCostBasisSwitch({ value, onChange, t }) {
    const options = [
        { id: INV_COST_BASIS_LATEST, labelKey: 'costBasis.latest' },
        { id: INV_COST_BASIS_WEIGHTED, labelKey: 'costBasis.weighted' },
    ];
    return (
        <div className="theme-segmented" role="tablist" aria-label={t('costBasis.aria')}>
            {options.map((opt) => {
                const active = value === opt.id;
                return (
                    <button
                        key={opt.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`theme-segmented__btn${active ? ' theme-segmented__btn--active' : ''}`}
                        onClick={() => {
                            if (opt.id !== value) onChange?.(opt.id);
                        }}
                    >
                        {t(opt.labelKey)}
                    </button>
                );
            })}
        </div>
    );
}
