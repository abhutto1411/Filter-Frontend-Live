/**
 * Workshop Chart of Accounts — petty cash fund / expense ledger navigation.
 */

import { isCashOrBankCoaAccount } from '../admin/hqCoaAccountRouting';

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

function inferWorkshopCashBankRegisterType(account) {
    const code = String(account?.code ?? '').trim();
    if (/^101\d/i.test(code)) return 'BANK';
    if (/petty/i.test(String(account?.name ?? ''))) return 'PETTY_CASH';
    return 'CASH';
}

/**
 * Workshop COA row navigation — petty cash ledger, cash/bank register, or generic statement.
 */
export function buildWorkshopCoaNavigationUrl(account, { dateFrom, dateTo, branchId } = {}) {
    if (isWorkshopPettyCashLedgerAccount(account)) {
        return buildWorkshopPettyCashLedgerUrl(account, { dateFrom, dateTo, branchId });
    }
    if (isCashOrBankCoaAccount(account)) {
        const params = new URLSearchParams();
        params.set('registerType', inferWorkshopCashBankRegisterType(account));
        params.set('coaAccountId', String(account.id));
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        if (branchId && branchId !== 'all') params.set('branchId', String(branchId));
        const qs = params.toString();
        return `/workshop/accounting/cash-bank${qs ? `?${qs}` : ''}`;
    }
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

/** True when a COA row should open a ledger / register (leaf or petty-cash control). */
export function isWorkshopCoaLedgerClickable(account) {
    if (!account?.id) return false;
    if (isWorkshopPettyCashCoaControlAccount(account)) return true;
    const hasChildren = Boolean(
        account.hasChildren
        || account.isHeading
        || (Array.isArray(account.children) && account.children.length > 0),
    );
    return !hasChildren;
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
