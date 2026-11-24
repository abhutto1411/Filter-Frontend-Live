import React, { useEffect, useMemo, useRef, useState } from 'react';
import SearchableEntityCombobox from '../SearchableEntityCombobox';
import '../SearchableEntityCombobox.css';
import {
    fetchAllExpenseAccounts,
    filterSelectableExpenseAccounts,
    mapExpenseAccountsToOptions,
    readExpenseAccountsResponse,
} from './expenseAccountOptions';

/**
 * Expense account picker for collection expense lines — same behaviour as the
 * Transactions (PE) page account combo: the whole postable CoA is loaded once per
 * session (GET /locker/expense-accounts?all=1), type to filter locally, ↑/↓ to move,
 * Enter to select. Accounts of other branches (vs `branchId`) are listed after this
 * branch's with an "Other branches" subtitle.
 */
export default function ExpenseAccountCombobox({
    value,
    onChange,
    locale = 'en',
    branchId = '',
    disabled = false,
    placeholder,
    id,
    menuMinWidth = 320,
    'aria-label': ariaLabel,
    systemLabel = 'System',
    otherBranchesLabel = 'Other branches',
    clearLabel = 'Clear',
    loadingHint = '…',
    emptyHint,
    onClearingLoaded,
}) {
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(false);
    const [data, setData] = useState({ accounts: [], clearing: null });
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState(false);
    const wrapRef = useRef(null);

    // A global rule forces dropdown portals to `width: auto !important` (content width).
    // Size this menu to the field instead, via a CSS variable read by .exp-acct-menu.
    const syncMenuWidth = () => {
        const w = wrapRef.current?.getBoundingClientRect().width;
        if (w && typeof document !== 'undefined') {
            document.documentElement.style.setProperty('--exp-acct-menu-w', `${Math.round(w)}px`);
        }
    };

    useEffect(() => {
        let alive = true;
        fetchAllExpenseAccounts()
            .then((res) => {
                if (!alive) return;
                const parsed = readExpenseAccountsResponse(res);
                setData(parsed);
                setLoadErr(false);
                onClearingLoaded?.(parsed.clearing);
            })
            .catch(() => {
                if (alive) setLoadErr(true);
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
        // onClearingLoaded is a notification hook; reloading on its identity is not wanted.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const options = useMemo(
        () =>
            mapExpenseAccountsToOptions(filterSelectableExpenseAccounts(data.accounts, data.clearing), {
                locale,
                systemLabel,
                branchId,
                otherBranchesLabel,
            }),
        [data, locale, systemLabel, branchId, otherBranchesLabel],
    );

    const selected = options.find((o) => String(o.id) === String(value || ''));

    return (
        <div ref={wrapRef} onFocusCapture={syncMenuWidth} onMouseDownCapture={syncMenuWidth}>
            <SearchableEntityCombobox
                id={id}
                className="acct-table-combobox exp-acct-combobox"
                options={options}
                value={value || ''}
                displayText={editing ? search : selected?.label || ''}
                onDisplayTextChange={(text) => {
                    setEditing(true);
                    setSearch(text);
                }}
                onSelect={(opt) => {
                    setEditing(false);
                    setSearch('');
                    onChange?.(opt?.id != null ? String(opt.id) : '', opt || null);
                }}
                onClear={() => {
                    setEditing(false);
                    setSearch('');
                    onChange?.('', null);
                }}
                clearLabel={clearLabel}
                placeholder={placeholder}
                entityLabel={ariaLabel || 'account'}
                menuMinWidth={menuMinWidth}
                disabled={disabled}
                loading={loading}
                loadingHint={loadingHint}
                emptyHint={loadErr ? '—' : emptyHint}
                portalClassName="exp-acct-menu"
            />
        </div>
    );
}
