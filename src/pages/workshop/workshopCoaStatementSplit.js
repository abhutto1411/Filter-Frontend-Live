/** Manager.io-style Chart of Accounts: Balance Sheet vs Income Statement (P&L). */

export const BALANCE_SHEET_TYPES = ['ASSET', 'LIABILITY', 'EQUITY'];
export const INCOME_STATEMENT_TYPES = ['INCOME', 'EXPENSE'];

export const COA_STATEMENT_PARTS = {
    BOTH: 'both',
    BALANCE_SHEET: 'bs',
    INCOME_STATEMENT: 'pl',
};

export function isBalanceSheetAccountType(type) {
    return BALANCE_SHEET_TYPES.includes(String(type || '').toUpperCase());
}

export function isIncomeStatementAccountType(type) {
    return INCOME_STATEMENT_TYPES.includes(String(type || '').toUpperCase());
}

export function statementPartForAccountType(type) {
    if (isIncomeStatementAccountType(type)) return COA_STATEMENT_PARTS.INCOME_STATEMENT;
    if (isBalanceSheetAccountType(type)) return COA_STATEMENT_PARTS.BALANCE_SHEET;
    return COA_STATEMENT_PARTS.BOTH;
}

export function partitionCoaTypeGroups(groups = []) {
    const balanceSheet = [];
    const incomeStatement = [];
    for (const group of groups) {
        const key = String(group?.key || '').toUpperCase();
        if (INCOME_STATEMENT_TYPES.includes(key)) incomeStatement.push(group);
        else if (BALANCE_SHEET_TYPES.includes(key)) balanceSheet.push(group);
    }
    return { balanceSheet, incomeStatement };
}

export function countGroupedAccounts(grouped, types) {
    return (types || []).reduce(
        (sum, type) => sum + (Array.isArray(grouped?.[type]) ? grouped[type].length : 0),
        0,
    );
}

export function filterTypeGroupsByChip(groups, chipType) {
    const chip = String(chipType || '').trim().toUpperCase();
    if (!chip) return groups;
    return groups.filter((g) => String(g.key).toUpperCase() === chip);
}

export function defaultTypeForStatementPart(part) {
    if (part === COA_STATEMENT_PARTS.INCOME_STATEMENT) return 'INCOME';
    return 'ASSET';
}

/** Types the New Account page may pick, given `?statement=` and/or `?type=`. */
/** Heading / folder rows roll up children — do not include them in KPI sums. */
export function isCoaPostableAccount(account) {
    if (!account) return false;
    if (account.hasChildren === true || account.isHeading === true) return false;
    if (Array.isArray(account.children) && account.children.length > 0) return false;
    return true;
}

/** Signed closing on the account’s normal side (debit for asset/expense). */
export function signedClosingBalance(account) {
    const type = String(account?.type || '').toUpperCase();
    const dr = Number(account?.closingDebit || 0);
    const cr = Number(account?.closingCredit || 0);
    const debitNormal = type === 'ASSET' || type === 'EXPENSE';
    const signed = debitNormal ? dr - cr : cr - dr;
    return Number.isFinite(signed) ? signed : 0;
}

export function sumSignedClosingBalances(accounts, type) {
    return sumTopLevelClosingBalances(accounts, type);
}

/**
 * Sum rolled-up closing for top-level rows of a type (parent missing or other type).
 * Matches collapsed COA folders — avoids double-counting children.
 */
export function sumTopLevelClosingBalances(accounts, type) {
    const want = String(type || '').toUpperCase();
    const list = accounts || [];
    const byId = new Map(list.map((acc) => [String(acc.id), acc]));
    return list.reduce((sum, acc) => {
        if (String(acc?.type || '').toUpperCase() !== want) return sum;
        const parent = acc.parentId ? byId.get(String(acc.parentId)) : null;
        const parentSameType = parent && String(parent.type || '').toUpperCase() === want;
        if (parentSameType) return sum;
        return sum + signedClosingBalance(acc);
    }, 0);
}

/** Revenue (INCOME) − Expenses. Positive = profit, negative = loss. */
export function netProfitFromClosingBalances(accounts) {
    return (
        sumSignedClosingBalances(accounts, 'INCOME')
        - sumSignedClosingBalances(accounts, 'EXPENSE')
    );
}

export function closingColumnsFromSigned(type, signed) {
    const debitNormal = String(type || '').toUpperCase() === 'ASSET'
        || String(type || '').toUpperCase() === 'EXPENSE';
    const abs = Math.abs(Number(signed) || 0);
    if (abs < 0.005) return { closingDebit: 0, closingCredit: 0 };
    if (debitNormal) {
        return signed > 0
            ? { closingDebit: abs, closingCredit: 0 }
            : { closingDebit: 0, closingCredit: abs };
    }
    return signed > 0
        ? { closingDebit: 0, closingCredit: abs }
        : { closingDebit: abs, closingCredit: 0 };
}

export function allowedAccountTypesForStatement(statement, fallbackType) {
    const s = String(statement || '').toLowerCase();
    if (s === COA_STATEMENT_PARTS.INCOME_STATEMENT || s === 'income') {
        return [...INCOME_STATEMENT_TYPES];
    }
    if (s === COA_STATEMENT_PARTS.BALANCE_SHEET || s === 'balance') {
        return [...BALANCE_SHEET_TYPES];
    }
    const type = String(fallbackType || '').toUpperCase();
    if (INCOME_STATEMENT_TYPES.includes(type)) return [...INCOME_STATEMENT_TYPES];
    if (BALANCE_SHEET_TYPES.includes(type)) return [...BALANCE_SHEET_TYPES];
    return [...BALANCE_SHEET_TYPES, ...INCOME_STATEMENT_TYPES];
}
