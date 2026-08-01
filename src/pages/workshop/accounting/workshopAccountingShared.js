/** Shared helpers for workshop accounting views. */

export function todayIsoDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function formatSarAmount(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const PAYEE_TYPES = ['Supplier', 'Employee', 'Customer', 'Other'];

export const blankPaymentRow = (i, voucher) => ({
    id: `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    voucher: voucher ?? `PE${String(i + 1).padStart(4, '0')}`,
    date: todayIsoDate(),
    type: 'Supplier',
    payeeId: '',
    payeeName: '',
    accountId: '',
    amount: '',
    ref: '',
    notes: '',
});

export const blankReceiptRow = (i, voucher) => ({
    id: `r-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    voucher: voucher ?? `RV${String(i + 1).padStart(4, '0')}`,
    date: todayIsoDate(),
    type: 'Customer',
    payeeId: '',
    payeeName: '',
    accountId: '',
    amount: '',
    ref: '',
    notes: '',
});

export const blankJournalRow = (i) => ({
    id: `j-${Date.now()}-${i}`,
    accountId: '',
    description: '',
    debit: '',
    credit: '',
});

export function assignVouchersFromPool(rows, pool, prefix) {
    return rows.map((r, idx) => ({
        ...r,
        voucher: pool[idx] ?? `${prefix}${String(idx + 1).padStart(4, '0')}`,
    }));
}

export function buildRowsFromVoucherPool(makeBlank, pool, count = 2) {
    const take = Math.max(count, 1);
    return Array.from({ length: take }, (_, idx) => makeBlank(idx, pool[idx]));
}

export const CASH_BANK_TABS = [
    { id: 'all', labelKey: 'cb.tab.all' },
    { id: 'cash', labelKey: 'cb.tab.cash' },
    { id: 'bank', labelKey: 'cb.tab.bank' },
    { id: 'petty', labelKey: 'cb.tab.petty' },
];

export function uiCashBankTypeToApi(ui) {
    if (ui === 'Bank') return 'BANK';
    if (ui === 'Petty Cash') return 'PETTY_CASH';
    return 'CASH';
}

export function apiCashBankTypeToUi(api) {
    const u = String(api || '').toUpperCase();
    if (u === 'BANK') return 'Bank';
    if (u === 'PETTY_CASH') return 'Petty Cash';
    return 'Cash';
}

export function cashBankTypeLabelKey(typeUi) {
    if (typeUi === 'Bank') return 'cb.tab.bank';
    if (typeUi === 'Petty Cash') return 'cb.tab.petty';
    return 'cb.tab.cash';
}

export function cashBankKindLabelKey(kind) {
    if (kind === 'SYSTEM_CASHIER_TILL') return 'cb.kind.cashierTill';
    if (kind === 'SYSTEM_LOCKER_VAULT') return 'cb.kind.lockerVault';
    if (kind === 'SYSTEM_PETTY_CASH_WALLET') return 'cb.kind.pettyWallet';
    return 'cb.kind.operating';
}

export function normalizeWorkshopCashBankRow(raw) {
    const coa = raw.coaAccount;
    const coaLink = coa ? `${coa.code} · ${coa.name}` : '—';
    const linked = Array.isArray(raw.linkedPosTerminals) ? raw.linkedPosTerminals : [];
    const posTerminalId = linked[0]?.id != null ? String(linked[0].id) : '';
    const posShared = linked.length === 0;
    const posLinkLabel = posShared
        ? ''
        : linked.map((t) => `${t.branchName || '—'}: ${t.label || t.terminalCode || ''}`).join(' · ');
    const kind = String(raw.kind || 'OPERATING');
    const isSystem = kind !== 'OPERATING';
    return {
        id: String(raw.id),
        name: raw.name || '',
        type: apiCashBankTypeToUi(raw.type),
        apiType: String(raw.type || 'CASH').toUpperCase(),
        branch: raw.branch?.name ?? '—',
        branchId: raw.branchId ? String(raw.branchId) : '',
        kind,
        kindKey: cashBankKindLabelKey(kind),
        isSystem,
        coaLink,
        coaAccountId: raw.coaAccountId != null ? String(raw.coaAccountId) : (coa?.id != null ? String(coa.id) : ''),
        posShared,
        posLinkLabel,
        posTerminalId,
        openingBalance: Number(raw.openingBalance ?? 0),
        currentBalance: Number(raw.currentBalance ?? 0),
        status: raw.status || 'active',
        _raw: raw,
    };
}
