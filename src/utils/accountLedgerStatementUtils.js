/** Shared helpers for COA ledger statement pages (monitor + supplier). */

function mapLegacyLedgerLines(lines) {
    return lines.map((line) => {
        const dateRaw = line.date;
        const dateStr =
            dateRaw instanceof Date
                ? dateRaw.toISOString().slice(0, 10)
                : String(dateRaw ?? '').slice(0, 10);
        return {
            id: line.id,
            date: dateStr,
            description:
                line.description ||
                line.lineDescription ||
                line.journalDescription ||
                '—',
            debit: Number(line.debit ?? 0),
            credit: Number(line.credit ?? 0),
            runningBalance: Number(line.runningBalance ?? 0),
            walletUserLabel: line.walletUserLabel,
            expenseCategoryLabel: line.expenseCategoryLabel,
            expenseProofUrl: line.expenseProofUrl,
            hasExpenseProof: line.hasExpenseProof,
        };
    });
}

export function unwrapLedgerPayload(res) {
    if (!res || typeof res !== 'object') return {};
    const nested =
        res.data && typeof res.data === 'object' && !Array.isArray(res.data)
            ? res.data
            : null;
    const payload =
        nested && (nested.rows || nested.lines) ? nested : res;
    if (Array.isArray(payload.rows)) return payload;
    if (Array.isArray(payload.lines) && payload.lines.length) {
        return { ...payload, rows: mapLegacyLedgerLines(payload.lines) };
    }
    return payload;
}

export function derivePartyFilterKey(party) {
    if (party?.externalPartyId) {
        return `external:${party.externalPartyId}`;
    }
    if (party?.partyType && party?.partyId) {
        return `${party.partyType}:${party.partyId}`;
    }
    return '';
}

export function partyQueryFromFilterKey(key) {
    if (!key) return {};
    if (key.startsWith('external:')) {
        return { externalPartyId: key.slice(9) };
    }
    const idx = key.indexOf(':');
    if (idx > 0) {
        return {
            partyType: key.slice(0, idx),
            partyId: key.slice(idx + 1),
        };
    }
    return {};
}

/** Cash/bank child accounts may not have isCashEquivalent set on the row itself. */
export function isBankCashLedgerAccount(account, accountsById) {
    if (!account) return false;
    if (account.isCashEquivalent) return true;
    if (account.seedKey === 'CASH' || account.seedKey === 'BANK') return true;
    let pid = account.parentId ? String(account.parentId) : '';
    const seen = new Set();
    while (pid && !seen.has(pid)) {
        seen.add(pid);
        const parent = accountsById?.get(pid);
        if (!parent) break;
        if (parent.isCashEquivalent) return true;
        if (parent.seedKey === 'CASH' || parent.seedKey === 'BANK') return true;
        pid = parent.parentId ? String(parent.parentId) : '';
    }
    return false;
}

export function accountNormalDebit(accountType) {
    return accountType === 'ASSET' || accountType === 'EXPENSE';
}

export function fmtMoneyPlain(v) {
    return Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function fmtMoneySar(v) {
    return `SAR ${fmtMoneyPlain(v)}`;
}

/** Running balance with Dr / Cr suffix (statement style). */
export function fmtBalanceSide(amount, normalDebit = true) {
    const n = Number(amount ?? 0);
    const formatted = fmtMoneySar(Math.abs(n));
    if (Math.abs(n) < 0.005) return formatted;
    const debitSide = normalDebit ? n >= 0 : n < 0;
    return `${formatted} ${debitSide ? 'Dr' : 'Cr'}`;
}

export const LEDGER_ROWS_PER_PAGE = 25;
