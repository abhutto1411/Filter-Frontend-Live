/**
 * CSV / Excel import (and Excel paste) for the Payment (PE), Receipt (RV) and
 * Journal (JE) entry grids — the same screens used for one-off entries.
 *
 * One file may hold several transaction types. Rows are grouped into "entries"
 * exactly like a manual entry is built:
 *   - payment / receipt: one entry per (type, pay-from / receive-into register, branch)
 *     → header (date, reference, note, branch, register) + lines (payee, account, amount…)
 *   - journal: one entry per journal_group (lines with Dr / Cr; must balance)
 * Each entry is opened in its grid, reviewed and saved with the grid's own
 * Save / Save as draft — the same validation and posting as a manual entry.
 *
 * Pure module (no React / no imports) so it runs under node --test.
 */

export const TX_IMPORT_TEMPLATE_HEADER = [
    'type',
    'date',
    'reference',
    'payee_type',
    'payee',
    'account',
    'amount',
    'pay_from_receive_into',
    'debit',
    'credit',
    'note',
    'branch',
    'journal_group',
];

export const TX_IMPORT_TEMPLATE_SAMPLE = [
    ['payment', '2026-11-19', 'INV-1001', 'Supplier', 'Example Supplier Co', '7001', '115.00', 'Main Cash', '', '', 'Water bill', '', ''],
    ['payment', '2026-11-19', 'INV-1002', 'Other', 'Fuel station', '6110', '50.00', 'Main Cash', '', '', 'Fuel', '', ''],
    ['receipt', '2026-11-19', 'RC-77', 'Customer', 'Example Customer', '4100', '300.00', 'Main Bank', '', '', 'Service income', '', ''],
    ['journal', '2026-11-19', 'ADJ-1', '', '', '6110', '', '', '25.00', '', 'Reclass', '', '1'],
    ['journal', '2026-11-19', 'ADJ-1', '', '', '7001', '', '', '', '25.00', 'Reclass', '', '1'],
];

/** CSV text of the template (header + sample rows), UTF-8 BOM so Excel shows Arabic correctly. */
export function txImportTemplateCsv() {
    const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const lines = [TX_IMPORT_TEMPLATE_HEADER, ...TX_IMPORT_TEMPLATE_SAMPLE].map((r) => r.map(esc).join(','));
    return `\uFEFF${lines.join('\r\n')}\r\n`;
}

const HEADER_ALIASES = {
    type: 'type',
    transaction_type: 'type',
    date: 'date',
    reference: 'reference',
    ref: 'reference',
    payee_type: 'payeeType',
    payeetype: 'payeeType',
    party_type: 'payeeType',
    payee: 'payee',
    payeename: 'payee',
    payee_name: 'payee',
    party: 'payee',
    account: 'account',
    accountid: 'account',
    account_code: 'account',
    account_id: 'account',
    amount: 'amount',
    pay_from_receive_into: 'register',
    pay_from: 'register',
    receive_into: 'register',
    register: 'register',
    cashbankaccountid: 'register',
    cash_bank: 'register',
    debit: 'debit',
    dr: 'debit',
    credit: 'credit',
    cr: 'credit',
    note: 'note',
    notes: 'note',
    description: 'note',
    memo: 'note',
    branch: 'branch',
    branchid: 'branch',
    journal_group: 'journalGroup',
    journalgroup: 'journalGroup',
};

const TYPE_ALIASES = {
    payment: 'payment', pe: 'payment', p: 'payment', 'دفع': 'payment', 'سند صرف': 'payment',
    receipt: 'receipt', rv: 'receipt', r: 'receipt', 'قبض': 'receipt', 'سند قبض': 'receipt',
    journal: 'journal', je: 'journal', j: 'journal', 'قيد': 'journal',
    transfer: 'transfer', tr: 'transfer', t: 'transfer',
};

const PAYEE_TYPES = ['Supplier', 'Customer', 'Employee', 'Other'];

function norm(s) {
    return String(s ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function headerKey(h) {
    return HEADER_ALIASES[norm(h).replace(/[\s-]+/g, '_')] || HEADER_ALIASES[norm(h).replace(/[\s_-]+/g, '')] || null;
}

/** Split CSV / TSV text into string[][] (quoted fields, "" escapes, CRLF, BOM). */
export function parseDelimited(text) {
    const raw = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (!raw.trim()) return [];
    const firstLine = raw.split('\n', 1)[0];
    const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
    const rows = [];
    let row = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (inQ) {
            if (ch === '"') {
                if (raw[i + 1] === '"') {
                    cur += '"';
                    i += 1;
                } else inQ = false;
            } else cur += ch;
        } else if (ch === '"') inQ = true;
        else if (ch === delim) {
            row.push(cur);
            cur = '';
        } else if (ch === '\n') {
            row.push(cur);
            rows.push(row);
            row = [];
            cur = '';
        } else cur += ch;
    }
    row.push(cur);
    rows.push(row);
    return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

/** Money text → halalas (accepts 1,234.50 and Arabic-Indic digits); null when not money. */
export function moneyToHalalas(v) {
    const s = String(v ?? '')
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/[٫]/g, '.')
        .replace(/[,\s]/g, '')
        .trim();
    if (!s) return null;
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return Math.round(Number(s) * 100);
}

const money = (h) => `${h < 0 ? '-' : ''}${Math.floor(Math.abs(h) / 100)}.${String(Math.abs(h) % 100).padStart(2, '0')}`;

/** YYYY-MM-DD | YYYY/MM/DD | DD/MM/YYYY | DD-MM-YYYY → YYYY-MM-DD (null when invalid). */
export function normalizeImportDate(v) {
    const s = String(v ?? '').trim();
    let y;
    let m;
    let d;
    let mt = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (mt) [, y, m, d] = mt;
    else {
        mt = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (!mt) return null;
        [, d, m, y] = mt;
    }
    const yy = Number(y);
    const mm = Number(m);
    const dd = Number(d);
    const dt = new Date(Date.UTC(yy, mm - 1, dd));
    if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
    return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

function findAccount(accounts, value) {
    const v = norm(value);
    if (!v) return null;
    const list = Array.isArray(accounts) ? accounts : [];
    const code = v.split(/\s+[—–-]\s+/)[0];
    return (
        list.find((a) => norm(a.code) === v) ||
        list.find((a) => norm(a.code) === code) ||
        list.find((a) => String(a.id) === String(value).trim()) ||
        list.find((a) => norm(a.name) === v || (a.nameAr && norm(a.nameAr) === v)) ||
        list.find((a) => norm(`${a.code} — ${a.name}`) === v || norm(`${a.code} ${a.name}`) === v) ||
        null
    );
}

function findRegister(registers, value) {
    const v = norm(value);
    if (!v) return null;
    const list = Array.isArray(registers) ? registers : [];
    return (
        list.find((r) => String(r.id) === String(value).trim()) ||
        list.find((r) => norm(r.name) === v) ||
        list.find((r) => r.code && norm(r.code) === v) ||
        list.find((r) => r.accountCode && norm(r.accountCode) === v) ||
        list.find((r) => r.coaAccountCode && norm(r.coaAccountCode) === v) ||
        null
    );
}

function findBranch(branches, value) {
    const v = norm(value);
    if (!v) return null;
    return (Array.isArray(branches) ? branches : []).find((b) => String(b.id) === String(value).trim() || norm(b.name) === v) || null;
}

function payeesFor(type, payees) {
    if (type === 'Supplier') return payees?.supplier || [];
    if (type === 'Employee') return payees?.employee || [];
    if (type === 'Customer') return payees?.customer || [];
    return [];
}

function findPayee(list, value) {
    const v = norm(value);
    if (!v) return null;
    return (
        list.find((p) => String(p.id) === String(value).trim()) ||
        list.find((p) => norm(p.name) === v) ||
        list.find((p) => p.nameAr && norm(p.nameAr) === v) ||
        null
    );
}

/**
 * Parse import text into entries for the PE / RV / JE grids.
 * lookups = { accounts, cashBankAccounts, payees: {supplier, customer, employee}, branches }
 * → { entries: [{ key, type, header, rows, issues }], issues: [{ line, key, value }], counts }
 * Issue keys are i18n keys (tx.imp.err.*); `line` is the 1-based file line.
 */
export function buildTxImport(text, lookups = {}, { defaultDate = '' } = {}) {
    const grid = parseDelimited(text);
    const issues = [];
    if (grid.length === 0) {
        return { entries: [], issues: [{ line: 0, key: 'tx.imp.err.empty' }], counts: { rows: 0, loaded: 0, skipped: 0 } };
    }
    const header = grid[0].map(headerKey);
    if (!header.includes('type') || (!header.includes('account') && !header.includes('amount'))) {
        return { entries: [], issues: [{ line: 1, key: 'tx.imp.err.header' }], counts: { rows: 0, loaded: 0, skipped: 0 } };
    }
    const groups = new Map();
    let loaded = 0;
    let skipped = 0;
    const dataRows = grid.slice(1);
    dataRows.forEach((cells, i) => {
        const line = i + 2;
        const rec = {};
        header.forEach((k, ci) => {
            if (k && rec[k] == null) rec[k] = String(cells[ci] ?? '').trim();
        });
        const type = TYPE_ALIASES[norm(rec.type)] || null;
        if (!type) {
            issues.push({ line, key: 'tx.imp.err.type', value: rec.type || '' });
            skipped += 1;
            return;
        }
        if (type === 'transfer') {
            issues.push({ line, key: 'tx.imp.err.transfer' });
            skipped += 1;
            return;
        }
        const date = rec.date ? normalizeImportDate(rec.date) : defaultDate || null;
        if (rec.date && !date) issues.push({ line, key: 'tx.imp.err.date', value: rec.date });
        const branch = rec.branch ? findBranch(lookups.branches, rec.branch) : null;
        if (rec.branch && !branch) issues.push({ line, key: 'tx.imp.err.branch', value: rec.branch });
        const account = rec.account ? findAccount(lookups.accounts, rec.account) : null;
        if (rec.account && !account) issues.push({ line, key: 'tx.imp.err.account', value: rec.account });
        if (!rec.account) issues.push({ line, key: 'tx.imp.err.accountMissing' });

        if (type === 'journal') {
            const drH = rec.debit ? moneyToHalalas(rec.debit) : 0;
            const crH = rec.credit ? moneyToHalalas(rec.credit) : 0;
            if (drH == null || crH == null || drH < 0 || crH < 0 || (drH > 0 && crH > 0) || (!drH && !crH)) {
                issues.push({ line, key: 'tx.imp.err.drcr', value: `${rec.debit || ''}/${rec.credit || ''}` });
            }
            const gkey = `journal|${rec.journalGroup || '1'}|${branch ? branch.id : ''}`;
            if (!groups.has(gkey)) {
                groups.set(gkey, {
                    key: gkey,
                    type: 'journal',
                    header: { date: date || '', ref: rec.reference || '', note: '', branchId: branch ? String(branch.id) : '' },
                    rows: [],
                    lines: [],
                    drH: 0,
                    crH: 0,
                });
            }
            const g = groups.get(gkey);
            g.rows.push({
                accountId: account ? String(account.id) : '',
                payeeId: '',
                description: rec.note || '',
                debit: drH > 0 ? money(drH) : '',
                credit: crH > 0 ? money(crH) : '',
            });
            g.lines.push(line);
            g.drH += drH > 0 ? drH : 0;
            g.crH += crH > 0 ? crH : 0;
            loaded += 1;
            return;
        }

        // payment / receipt
        const amountH = moneyToHalalas(rec.amount);
        if (amountH == null || amountH <= 0) issues.push({ line, key: 'tx.imp.err.amount', value: rec.amount || '' });
        const register = rec.register ? findRegister(lookups.cashBankAccounts, rec.register) : null;
        if (rec.register && !register) issues.push({ line, key: 'tx.imp.err.register', value: rec.register });
        const typeRaw = PAYEE_TYPES.find((p) => norm(p) === norm(rec.payeeType));
        const payeeType = typeRaw || (rec.payeeType ? 'Other' : type === 'payment' ? 'Supplier' : 'Customer');
        let payeeId = '';
        let payeeName = rec.payee || '';
        let finalPayeeType = payeeType;
        if (payeeType !== 'Other' && rec.payee) {
            const p = findPayee(payeesFor(payeeType, lookups.payees), rec.payee);
            if (p) {
                payeeId = String(p.id);
                payeeName = p.name || payeeName;
            } else {
                issues.push({ line, key: 'tx.imp.err.payee', value: `${payeeType}: ${rec.payee}` });
            }
        } else if (!rec.payee && payeeType !== 'Other') {
            finalPayeeType = payeeType;
        }
        const gkey = `${type}|${register ? register.id : rec.register || ''}|${branch ? branch.id : ''}`;
        if (!groups.has(gkey)) {
            groups.set(gkey, {
                key: gkey,
                type,
                header: {
                    date: date || '',
                    ref: '',
                    note: '',
                    branchId: branch ? String(branch.id) : '',
                    cashAccountId: register ? String(register.id) : '',
                    registerName: register ? register.name : rec.register || '',
                },
                rows: [],
                lines: [],
                totalH: 0,
            });
        }
        const g = groups.get(gkey);
        g.rows.push({
            date: date || '',
            type: finalPayeeType,
            payeeId,
            payeeName,
            accountId: account ? String(account.id) : '',
            amount: amountH != null && amountH > 0 ? money(amountH) : '',
            ref: rec.reference || '',
            notes: rec.note || '',
        });
        g.lines.push(line);
        g.totalH += amountH > 0 ? amountH : 0;
        loaded += 1;
    });

    const entries = [];
    for (const g of groups.values()) {
        const entryIssues = issues.filter((it) => g.lines.includes(it.line));
        if (g.type === 'journal' && g.drH !== g.crH) {
            const it = { line: g.lines[0], key: 'tx.imp.err.unbalanced', value: `${money(g.drH)} / ${money(g.crH)}` };
            issues.push(it);
            entryIssues.push(it);
        }
        entries.push({
            key: g.key,
            type: g.type,
            header: g.header,
            rows: g.rows,
            lines: g.lines,
            total: g.type === 'journal' ? money(g.drH) : money(g.totalH),
            issues: entryIssues,
        });
    }
    const order = { payment: 0, receipt: 1, journal: 2 };
    entries.sort((a, b) => order[a.type] - order[b.type] || a.lines[0] - b.lines[0]);
    return { entries, issues, counts: { rows: dataRows.length, loaded, skipped } };
}

/**
 * Excel paste into a PE / RV grid: rows of cells in grid column order
 * [date, payee type, payee, account, amount, reference, note] (missing tail cells allowed).
 * Returns { rows, issues } using the same matching as the file import.
 */
export function pastedCellsToPayRows(cellsRows, lookups = {}, { variant = 'payment' } = {}) {
    const header = ['date', 'payee_type', 'payee', 'account', 'amount', 'reference', 'note'];
    const text = [
        ['type', ...header].join('\t'),
        ...(cellsRows || []).map((cells) => [variant, ...header.map((_, i) => String(cells[i] ?? '').replace(/\t/g, ' '))].join('\t')),
    ].join('\n');
    const res = buildTxImport(text, lookups);
    const rows = res.entries.flatMap((e) => e.rows);
    return { rows, issues: res.issues.map((it) => ({ ...it, line: it.line - 1 })) };
}

/** Excel paste into the JE grid: [account, note, debit, credit]. */
export function pastedCellsToJournalRows(cellsRows, lookups = {}) {
    const text = [
        'type\taccount\tnote\tdebit\tcredit\tjournal_group',
        ...(cellsRows || []).map((c) => ['journal', c[0] ?? '', c[1] ?? '', c[2] ?? '', c[3] ?? '', '1'].join('\t')),
    ].join('\n');
    const res = buildTxImport(text, lookups);
    return {
        rows: res.entries.flatMap((e) => e.rows),
        issues: res.issues.filter((it) => it.key !== 'tx.imp.err.unbalanced').map((it) => ({ ...it, line: it.line - 1 })),
    };
}

/**
 * Unposted rows of a saved batch draft (GET /workshop-accounting/batches/:id) → import text,
 * so a draft opens on the same PE / RV / JE screens. Rows that already have a journal
 * (posted) or a closed state are left out — they must never post twice.
 * Server rows carry ids (accountId, cashBankAccountId, payeeId); the matcher accepts ids.
 */
export function batchDraftRowsToImportText(rows) {
    const esc = (v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [TX_IMPORT_TEMPLATE_HEADER.join(',')];
    let open = 0;
    for (const r of Array.isArray(rows) ? rows : []) {
        if (r?.journalId || r?.transactionId) continue;
        const state = String(r?.state || '').toLowerCase();
        if (state === 'posted' || state === 'closed' || state === 'reversed') continue;
        const p = r?.payload || {};
        const type = String(p.type || r?.type || '');
        open += 1;
        lines.push(
            [
                type,
                p.date || '',
                p.reference || '',
                p.payeeType || '',
                p.payeeId || p.payeeName || '',
                p.accountId || '',
                p.amount ?? '',
                p.cashBankAccountId || '',
                p.debit ?? '',
                p.credit ?? '',
                p.description || '',
                p.branchId || '',
                p.journalGroup ?? '',
            ]
                .map(esc)
                .join(','),
        );
    }
    return { text: lines.join('\n'), openRows: open };
}
