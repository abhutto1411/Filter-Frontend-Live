import React, { useMemo } from 'react';
import {
    buildInvoiceLineUomOptions,
    buildProductUomSelectOptions,
    invoiceLineUomSelectValue,
    parseInvoiceLineUomSelectValue,
} from './storageFacilityUomUtils';

/**
 * @param {'product'|'invoice-line'} variant
 * @param {object} [capsRow] — invoice line inventory caps (invoice-line only)
 */
export default function StorageUomSelect({
    id,
    variant = 'product',
    value,
    onChange,
    profiles = [],
    capsRow = null,
    line = null,
    disabled = false,
    className = 'pi-row-input',
    inputRef,
    onKeyDown,
}) {
    const options = useMemo(() => {
        if (variant === 'invoice-line') {
            return buildInvoiceLineUomOptions(capsRow, profiles);
        }
        return buildProductUomSelectOptions(profiles);
    }, [variant, capsRow, profiles]);

    const selectValue =
        variant === 'product'
            ? value
            : invoiceLineUomSelectValue(
                  line ?? { uom: value, uomProfileId: null },
                  options,
              );

    const handleChange = (selectVal) => {
        if (variant === 'product') {
            onChange(selectVal);
            return;
        }
        const parsed = parseInvoiceLineUomSelectValue(selectVal, options);
        onChange(parsed);
    };

    return (
        <select
            id={id}
            ref={inputRef}
            className={className}
            value={selectValue}
            disabled={disabled}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={onKeyDown}
        >
            {variant === 'product' && options.length === 0 ? (
                <option value="unit:pcs">pcs (each)</option>
            ) : null}
            {options.map((opt) => (
                <option key={`${variant}-${opt.value}`} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}
