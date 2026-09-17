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

export function normalizePayeeType(value) {
    const hit = PAYEE_TYPES.find((p) => p.toLowerCase() === String(value || '').toLowerCase());
    return hit || 'Other';
}

/** Match a stored numeric payeeId to combo ids like corp:12 / affiliated:12. */
export function resolvePayeeComboId(row, payees) {
    const stored = String(row?.payeeId || '').trim();
    const type = normalizePayeeType(row?.payeeType);
    if (!stored) return '';
    const options = payeesForTypeList(type, payees);
    const candidates = [stored, `corp:${stored}`, `affiliated:${stored}`, `local:${stored}`];
    for (const c of candidates) {
        if (options.some((o) => String(o.id) === c)) return c;
    }
    return stored;
}

/** If every payee of this type shares one default GL, fill it when Type changes. */
export function sharedPayeeDefaultAccountId(list) {
    const ids = (list || [])
        .map((p) => String(p?.defaultAccountId || '').trim())
        .filter(Boolean);
    if (!ids.length) return '';
    const first = ids[0];
    return ids.every((id) => id === first) ? first : '';
}

export function suggestPayeeAccountPatch(row, payees, nextType, nextPayeeId) {
    const options = payeesForTypeList(nextType, payees);
    const opt = options.find((o) => String(o.id) === String(nextPayeeId));
    const suggested = opt?.defaultAccountId
        ? String(opt.defaultAccountId)
        : sharedPayeeDefaultAccountId(options);
    const current = String(row?.accountId || '');
    const lastAuto = String(row?.accountAutoFilled || '');
    const canFill = !current || current === lastAuto;
    if (!canFill) return {};
    if (!suggested) return { accountId: '', accountAutoFilled: '' };
    return { accountId: suggested, accountAutoFilled: suggested };
}

export function payeesForTypeList(type, payees) {
    if (type === 'Supplier') return payees?.supplier || [];
    if (type === 'Employee') return payees?.employee || [];
    if (type === 'Customer') return payees?.customer || [];
    return [];
}

/** Keep payee default GLs in the account combo even if listCoa hid the heading. */
export function mergePayeeDefaultAccountOptions(accountOptions, extraPayees) {
    const opts = Array.isArray(accountOptions) ? [...accountOptions] : [];
    const seen = new Set(opts.map((o) => String(o.id)));
    for (const p of extraPayees || []) {
        const id = String(p?.defaultAccountId || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        opts.push({
            id,
            label: p.defaultAccountLabel || id,
            searchText: `${p.defaultAccountLabel || ''} ${id}`,
        });
    }
    return opts;
}

export const blankPaymentRow = (i, voucher) => ({
    id: `p-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    voucher: voucher ?? `PE${String(i + 1).padStart(4, '0')}`,
    date: todayIsoDate(),
    type: 'Supplier',
    payeeId: '',
    payeeName: '',
    accountId: '',
    accountAutoFilled: '',
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
    accountAutoFilled: '',
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
    { id: 'tills', labelKey: 'cb.tab.tills' },
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
