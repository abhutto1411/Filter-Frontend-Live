import React, { useEffect, useMemo, useState } from 'react';
import SearchableEntityCombobox from '../SearchableEntityCombobox';

/**
 * Map COA rows to combobox options.
 * When `headerBranchId` is set, options are ordered: this branch / workshop-wide
 * first, then "Other branches" with the branch name in the subtitle.
 */
export function mapCoaToComboboxOptions(accounts = [], { headerBranchId } = {}) {
    const hb =
        headerBranchId != null && String(headerBranchId) !== ''
            ? String(headerBranchId)
            : null;
    const mapped = accounts.map((a) => {
        const branchId = a.branchId != null ? String(a.branchId) : null;
        const other =
            hb != null && branchId != null && branchId !== hb;
        const typePart = a.type ? String(a.type).replace(/_/g, ' ') : '';
        const branchPart =
            a.branchName || a.branch?.name
                ? String(a.branchName || a.branch?.name)
                : '';
        return {
            id: String(a.id),
            label: a.label || `${a.code} — ${a.name}`,
            searchText: `${a.code} ${a.name} ${typePart} ${a.subType || ''} ${branchPart}`,
            subtitle: other
                ? [typePart, branchPart].filter(Boolean).join(' · ') || 'Other branch'
                : typePart || undefined,
            group: other ? 'Other branches' : 'This branch / workshop-wide',
            _sort: other ? 1 : 0,
            _code: String(a.code || ''),
        };
    });
    mapped.sort((a, b) => a._sort - b._sort || a._code.localeCompare(b._code));
    return mapped.map((opt) => {
        const out = { ...opt };
        delete out._sort;
        delete out._code;
        return out;
    });
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
    menuMinWidth,
    headerBranchId,
}) {
    const options = useMemo(
        () => mapCoaToComboboxOptions(accounts, { headerBranchId }),
        [accounts, headerBranchId],
    );
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
            {...(menuMinWidth ? { menuMinWidth } : {})}
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
    menuMinWidth,
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
            {...(menuMinWidth ? { menuMinWidth } : {})}
        />
    );
}
