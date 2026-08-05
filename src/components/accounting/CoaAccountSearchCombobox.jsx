import React, { useEffect, useMemo, useState } from 'react';
import SearchableEntityCombobox from '../SearchableEntityCombobox';

export function mapCoaToComboboxOptions(accounts = []) {
    return accounts.map((a) => ({
        id: String(a.id),
        label: a.label || `${a.code} — ${a.name}`,
        searchText: `${a.code} ${a.name} ${a.type || ''} ${a.subType || ''}`,
        subtitle: a.type ? String(a.type).replace(/_/g, ' ') : undefined,
    }));
}

export function mapCashBankToComboboxOptions(accounts = []) {
    return accounts.map((a) => {
        const bal = Number(a.currentBalance ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return {
            id: String(a.id),
            label: `${a.name} (${a.type}) — SAR ${bal}`,
            searchText: `${a.name} ${a.type}`,
            subtitle: a.type,
        };
    });
}

/**
 * Searchable COA account picker — type to filter, ↑↓ to navigate, Enter to select.
 */
export default function CoaAccountSearchCombobox({
    accounts = [],
    value,
    onChange,
    placeholder = 'Type code or name — ↑↓ Enter',
    className = 'ws-filter-combobox trans-account-combobox',
    disabled = false,
    onTabAdvance,
}) {
    const options = useMemo(() => mapCoaToComboboxOptions(accounts), [accounts]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setSearch('');
    }, [value]);

    const selected = options.find((o) => String(o.id) === String(value));

    return (
        <SearchableEntityCombobox
            className={className}
            options={options}
            value={value}
            displayText={search || selected?.label || ''}
            onDisplayTextChange={(t) => {
                setSearch(t);
                if (!t.trim()) onChange?.('');
            }}
            onSelect={(opt) => {
                onChange?.(opt?.id != null ? String(opt.id) : '');
                setSearch(opt?.label ?? '');
            }}
            onTabAdvance={onTabAdvance}
            placeholder={placeholder}
            entityLabel="account"
            emptyHint="No matching accounts"
            disabled={disabled}
        />
    );
}

/** Cash / Bank / Petty register picker for Paid From / Received Into header fields. */
export function CashBankAccountSearchCombobox({
    accounts = [],
    value,
    onChange,
    placeholder = 'Select Cash / Bank — type to search',
    className = 'ws-filter-combobox trans-account-combobox',
    disabled = false,
}) {
    const options = useMemo(() => mapCashBankToComboboxOptions(accounts), [accounts]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setSearch('');
    }, [value]);

    const selected = options.find((o) => String(o.id) === String(value));

    return (
        <SearchableEntityCombobox
            className={className}
            options={options}
            value={value}
            displayText={search || selected?.label || ''}
            onDisplayTextChange={(t) => {
                setSearch(t);
                if (!t.trim()) onChange?.('');
            }}
            onSelect={(opt) => {
                onChange?.(opt?.id != null ? String(opt.id) : '');
                setSearch(opt?.label ?? '');
            }}
            placeholder={placeholder}
            entityLabel="register"
            emptyHint="No matching cash/bank accounts"
            disabled={disabled}
        />
    );
}
