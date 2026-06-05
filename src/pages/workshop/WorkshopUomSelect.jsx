import React, { useMemo } from 'react';
import {
    buildInvoiceLineUomOptions,
    buildProductUomSelectOptions,
    invoiceLineUomSelectValue,
    parseInvoiceLineUomSelectValue,
    parseProductUomSelectValue,
} from './workshopUomUtils';

export default function WorkshopUomSelect({
    id,
    variant = 'product',
    value,
    onChange,
    profiles = [],
    capsRow = null,
    line = null,
    disabled = false,
    className = 'pi-row-input ws-pi-select',
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
            : invoiceLineUomSelectValue(line ?? { uom: value, uomProfileId: null }, options);

    const handleChange = (selectVal) => {
        if (variant === 'product') {
            onChange(parseProductUomSelectValue(selectVal));
            return;
        }
        onChange(parseInvoiceLineUomSelectValue(selectVal, options));
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
