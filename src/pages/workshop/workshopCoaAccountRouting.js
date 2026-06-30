/**
 * Workshop Chart of Accounts — petty cash fund / expense ledger navigation.
 */

/** Parent control accounts shown on COA; branch / employee GL lives underneath. */
export function isWorkshopPettyCashCoaControlAccount(account) {
    const code = String(account?.code ?? '').trim();
    return code === '1280' || code === '6100';
}

/**
 * Branch [1280-BR-*] and per-employee [1280-BR-*-E*] fund accounts, plus branch [6100-BR-*] expense accounts.
 * Hidden on COA — balances roll into [1280] / [6100]; detail via ledger filters.
 */
export function isWorkshopPettyCashCoaCollapsedChild(account) {
    const code = String(account?.code ?? '').trim();
    return /^1280-BR-/.test(code) || /^6100-BR-/.test(code);
}

export function isWorkshopPettyCashFundLedgerAccount(account) {
    const code = String(account?.code ?? '').trim();
    return code === '1280' || /^1280-BR-/.test(code);
}

export function isWorkshopPettyCashExpenseLedgerAccount(account) {
    const code = String(account?.code ?? '').trim();
    return code === '6100' || /^6100-BR-/.test(code);
}

/** COA row click → full-page petty cash ledger (control accounts only). */
export function isWorkshopPettyCashLedgerAccount(account) {
    return isWorkshopPettyCashCoaControlAccount(account);
}

export function buildWorkshopPettyCashLedgerUrl(account, { dateFrom, dateTo, branchId } = {}) {
    const params = new URLSearchParams();
    if (account?.code) params.set('code', account.code);
    if (account?.name) params.set('name', account.name);
    if (account?.type) params.set('type', account.type);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (branchId && branchId !== 'all') params.set('branchId', String(branchId));
    const qs = params.toString();
    return `/workshop/accounting/ledger/${encodeURIComponent(account.id)}${qs ? `?${qs}` : ''}`;
}

/** Workshop ledger is rendered inside WorkshopLayout (no :accountId route param). */
export function parseWorkshopLedgerAccountIdFromPath(pathname) {
    const parts = String(pathname || '').split('/').filter(Boolean);
    const ledgerIdx = parts.indexOf('ledger');
    if (ledgerIdx < 0) return '';
    const id = parts[ledgerIdx + 1] || '';
    return /^\d+$/.test(id) ? id : '';
}

export const WORKSHOP_COA_CONTROL_BADGES = {
    1280: { label: 'Control', background: '#EDE9FE', color: '#5B21B6' },
    6100: { label: 'Control', background: '#EDE9FE', color: '#5B21B6' },
};

/** Remove collapsed petty-cash children from a flat COA list (franchise workshops). */
export function filterWorkshopPettyCashCoaList(accounts) {
    return (accounts || []).filter((a) => !isWorkshopPettyCashCoaCollapsedChild(a));
}

/** Prune collapsed petty-cash nodes from a COA tree (franchise workshops). */
export function pruneWorkshopPettyCashCoaTree(nodes) {
    const walk = (node) => {
        if (isWorkshopPettyCashCoaCollapsedChild(node)) return null;
        const children = (node.children || []).map(walk).filter(Boolean);
        return { ...node, children };
    };
    return (nodes || []).map(walk).filter(Boolean);
}
