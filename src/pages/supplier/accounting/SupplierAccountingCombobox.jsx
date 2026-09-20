import React, { useEffect, useMemo, useState } from 'react';
import SearchableEntityCombobox from '../../../components/SearchableEntityCombobox';
import '../../../components/SearchableEntityCombobox.css';

/**
 * Manager.io-style search combo: type to filter, ↑↓ to move, Enter to select.
 * `options` are `{ id, label, subtitle?, searchText? }`.
 */
export default function SupplierAccountingCombobox({
    options = [],
    value,
    onChange,
    placeholder = 'Type to search…',
    entityLabel = 'item',
    emptyHint = 'No matches',
    className = 'acct-table-combobox',
    required = false,
    disabled = false,
    menuMinWidth = 260,
}) {
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(false);
    const normalized = useMemo(
        () =>
            (options || []).map((o) => ({
                id: String(o.id ?? o.value ?? ''),
                label: o.label,
                subtitle: o.subtitle,
                searchText: o.searchText || `${o.label || ''} ${o.id || o.value || ''}`,
                trailing: o.trailing,
            })),
        [options],
    );

    useEffect(() => {
        setSearch('');
        setEditing(false);
    }, [value]);

    const selected = normalized.find((o) => String(o.id) === String(value));

    return (
        <SearchableEntityCombobox
            className={className}
            options={normalized}
            value={value}
            displayText={editing ? search : (search || selected?.label || '')}
            onDisplayTextChange={(text) => {
                setEditing(true);
                setSearch(text);
                if (!String(text || '').trim()) onChange?.('');
            }}
            onSelect={(opt) => {
                setEditing(false);
                onChange?.(opt?.id != null ? String(opt.id) : '');
                setSearch(opt?.label ?? '');
            }}
            placeholder={placeholder}
            entityLabel={entityLabel}
            emptyHint={emptyHint}
            required={required}
            disabled={disabled}
            menuMinWidth={menuMinWidth}
        />
    );
}

export function toComboOptions(rows, { idKey = 'id', labelFn, searchFn } = {}) {
    return (rows || []).map((row) => {
        const id = String(row[idKey] ?? row.id ?? row.value ?? '');
        const label = labelFn ? labelFn(row) : row.label || row.name || id;
        return {
            id,
            label,
            searchText: searchFn ? searchFn(row) : label,
        };
    });
}
