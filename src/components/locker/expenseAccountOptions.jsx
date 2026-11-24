import React from 'react';
import { listLockerExpenseAccounts } from '../../services/lockerExpenseAccountsApi';

/**
 * Per-session cache of the whole selectable CoA (GET /locker/expense-accounts?all=1).
 * One request per session, shared by every expense line; a failed request is not
 * cached so the next mount retries.
 */
let allPromise = null;

/** Test hook — clears the per-session cache. */
export function __resetExpenseAccountCache() {
    allPromise = null;
}

export function fetchAllExpenseAccounts() {
    if (!allPromise) {
        allPromise = listLockerExpenseAccounts({ all: 1 }).catch((err) => {
            allPromise = null;
            throw err;
        });
    }
    return allPromise;
}

/** Normalise the API response → `{ accounts, clearing }`. */
export function readExpenseAccountsResponse(res) {
    if (Array.isArray(res)) return { accounts: res, clearing: null };
    return {
        accounts: Array.isArray(res?.accounts) ? res.accounts : [],
        clearing: res?.clearing ?? res?.clearingAccount ?? null,
    };
}

/**
 * Defensive client-side guard (the server already excludes these): never offer
 * the clearing account itself or the 1005 / 1005-O CIT namespace.
 */
export function filterSelectableExpenseAccounts(accounts, clearing) {
    const clearingId = clearing?.accountId ?? clearing?.id ?? null;
    return (accounts || []).filter((a) => {
        if (!a || a.excluded) return false;
        if (clearingId != null && String(a.id) === String(clearingId)) return false;
        if (/^1005/i.test(String(a.code || '').trim())) return false;
        return true;
    });
}

/**
 * Options in the same shape / order as the Transactions page account picker
 * (`postableAccountOptions`): `code — name`, subtitle `TYPE · branch`, accounts of
 * other branches (vs `branchId`) after this branch's, each group in CoA code order.
 */
export function mapExpenseAccountsToOptions(
    accounts,
    { locale = 'en', systemLabel = 'System', branchId = '', otherBranchesLabel = 'Other branches' } = {},
) {
    const hb = branchId != null && String(branchId) !== '' ? String(branchId) : null;
    const rows = (accounts || []).map((a) => {
        const name = locale === 'ar' && a.nameAr ? a.nameAr : a.name || a.code || String(a.id);
        const accBranch = a.branchId != null && a.branchId !== '' ? String(a.branchId) : null;
        const other = hb != null && accBranch != null && accBranch !== hb;
        const branchName = a.branchName || '';
        const isSystem = Boolean(a.isSystem || a.systemRole);
        return {
            id: String(a.id),
            label: `${a.code} — ${name}`,
            searchText: `${a.code || ''} ${a.name || ''} ${a.nameAr || ''} ${a.type || ''} ${branchName}`,
            subtitle: other
                ? [otherBranchesLabel, branchName].filter(Boolean).join(' · ')
                : [a.type, branchName].filter(Boolean).join(' · ') || undefined,
            trailing: isSystem ? (
                <span className="ws-badge ws-badge--muted" data-testid="exp-acct-system-badge">
                    {systemLabel}
                </span>
            ) : undefined,
            isSystem,
            raw: a,
            _o: other ? 1 : 0,
            _c: String(a.code || ''),
        };
    });
    rows.sort((x, y) => x._o - y._o || x._c.localeCompare(y._c, 'en', { numeric: true }));
    return rows.map((o) => {
        const out = { ...o };
        delete out._o;
        delete out._c;
        return out;
    });
}
