import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CreditCard, Plus, Receipt, Trash2 } from 'lucide-react';
import {
    getSupplierAccounts,
    listSupplierPayments,
    listSupplierReceipts,
    postSupplierGeneralJournal,
    postSupplierPayment,
    postSupplierReceipt,
    unwrapSupplierAccountingList,
} from '../../../services/supplierAccountingApi';
import {
    listSupplierAffiliatedWorkshops,
    listSupplierExternalParties,
    listSupplierStaff,
    listSupplierSuperSuppliers,
} from '../../../services/supplierApi';
import {
    formatAffiliatedBranchCustomerLabel,
    formatAffiliatedWorkshopCustomerLabel,
} from '../../../utils/affiliatedCustomerLabels';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    fmtDate,
    inputStyle,
    money,
    outlineBtnStyle,
    primaryBtnStyle,
    todayISO,
} from './SupplierAccountingShared';

const PAY_TYPES = [
    { value: 'super_supplier', label: 'Super Supplier' },
    { value: 'employee', label: 'Employee' },
    { value: 'customer', label: 'Customer' },
    { value: 'others', label: 'Others' },
];

const TRANSACTION_HUB_RECEIPT_PREFILL_KEY = 'transactionHubReceiptPrefill';

function emptyPayReceiptLine(headerDate) {
    return {
        lineDate: headerDate || todayISO(),
        payType: 'super_supplier',
        payeeValue: '',
        accountId: '',
        amount: '',
        lineReference: '',
        notes: '',
    };
}

function emptyJournalLine() {
    return { lineDate: todayISO(), accountId: '', debit: '', credit: '', lineReference: '', notes: '' };
}

function extractArray(res, keys) {
    if (!res || typeof res !== 'object') return [];
    if (Array.isArray(res)) return res;
    for (const k of keys) {
        if (Array.isArray(res[k])) return res[k];
    }
    return [];
}

function partyPayloadFromRow(row) {
    const t = row.payType;
    if (t === 'others' || !t) {
        return { partyType: undefined, partyId: undefined, externalPartyId: undefined };
    }
    if (t === 'super_supplier') {
        return {
            partyType: 'super_supplier',
            partyId: row.payeeValue || undefined,
            externalPartyId: undefined,
        };
    }
    if (t === 'employee') {
        return {
            partyType: 'employee',
            partyId: row.payeeValue || undefined,
            externalPartyId: undefined,
        };
    }
    if (t === 'customer') {
        const raw = String(row.payeeValue || '');
        const [kind, id] = raw.split('|');
        if (!id) return { partyType: undefined, partyId: undefined, externalPartyId: undefined };
        if (kind === 'branch') {
            return { partyType: 'branch', partyId: id, externalPartyId: undefined };
        }
        if (kind === 'workshop') {
            return { partyType: 'workshop', partyId: id, externalPartyId: undefined };
        }
        if (kind === 'external') {
            return { partyType: 'external_party', partyId: undefined, externalPartyId: id };
        }
    }
    return { partyType: undefined, partyId: undefined, externalPartyId: undefined };
}

function cashLabel(a) {
    const rd = Number(a.closingDebit) || 0;
    const rc = Number(a.closingCredit) || 0;
    const bal = a.type === 'ASSET' || a.type === 'EXPENSE' ? rd : rc;
    return `[${a.code}] ${a.name} — ${money(bal)}`;
}

function resolveReceiptCrAccountId(accounts, payeeValue) {
    const leaves = (accounts || []).filter((a) => !a.hasChildren && !a.isCashEquivalent);
    const kind = String(payeeValue || '').split('|')[0];
    const code = kind === 'external' ? '1110' : '1100';
    const byCode = leaves.find((a) => String(a.code || '').trim() === code);
    if (byCode?.id) return String(byCode.id);
    const needle =
        kind === 'external'
            ? /non-affiliated.*receivable/i
            : /affiliated.*receivable/i;
    const byName = leaves.find((a) => needle.test(String(a.name || '')));
    return byName?.id ? String(byName.id) : '';
}

function resolvePrefillCashAccountId(initialPrefill, cashOptions) {
    if (initialPrefill?.cashAccountId) return String(initialPrefill.cashAccountId);
    if (initialPrefill?.cashBankLabel && cashOptions.length) {
        const labelNeedle = String(initialPrefill.cashBankLabel).trim().toLowerCase();
        const match = cashOptions.find((a) => {
            const lbl = cashLabel(a).toLowerCase();
            const name = String(a.name || '').toLowerCase();
            return lbl.includes(labelNeedle) || name.includes(labelNeedle);
        });
        if (match?.id) return String(match.id);
    }
    return cashOptions[0]?.id ? String(cashOptions[0].id) : '';
}

function buildGridStateFromPrefill(initialPrefill, variant, accounts, cashOptions) {
    if (!initialPrefill) {
        const today = todayISO();
        return {
            headerDate: today,
            headerRef: '',
            generalNote: '',
            cashAccountId: cashOptions[0]?.id ? String(cashOptions[0].id) : '',
            lines: [emptyPayReceiptLine(today)],
        };
    }
    const prefillVariant = initialPrefill.variant || initialPrefill.tab || variant;
    if (prefillVariant !== variant) {
        const today = todayISO();
        return {
            headerDate: today,
            headerRef: '',
            generalNote: '',
            cashAccountId: cashOptions[0]?.id ? String(cashOptions[0].id) : '',
            lines: [emptyPayReceiptLine(today)],
        };
    }
    const hdrDate = initialPrefill.headerDate || todayISO();
    return {
        headerDate: hdrDate,
        headerRef: String(initialPrefill.headerRef ?? ''),
        generalNote: String(initialPrefill.generalNote ?? ''),
        cashAccountId: resolvePrefillCashAccountId(initialPrefill, cashOptions),
        lines: (Array.isArray(initialPrefill.lines) && initialPrefill.lines.length
            ? initialPrefill.lines
            : [emptyPayReceiptLine(hdrDate)]
        ).map((l) => {
            const payeeValue = String(l.payeeValue || '');
            return {
                ...emptyPayReceiptLine(l.lineDate || hdrDate),
                ...l,
                accountId:
                    l.accountId ||
                    resolveReceiptCrAccountId(accounts, payeeValue) ||
                    '',
            };
        }),
    };
}

function PayeeCell({
    row,
    idx,
    superSuppliers,
    staff,
    customerOptions,
    onChange,
}) {
    const t = row.payType;
    if (t === 'others') {
        return (
            <span style={{ fontSize: 13, color: '#94A3B8' }}>—</span>
        );
    }
    if (t === 'super_supplier') {
        return (
            <select
                style={inputStyle}
                value={row.payeeValue}
                onChange={(e) => onChange(idx, { payeeValue: e.target.value })}
            >
                <option value="">Select super supplier</option>
                {superSuppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                        {s.name || s.companyName || s.code || s.id}
                    </option>
                ))}
            </select>
        );
    }
    if (t === 'employee') {
        return (
            <select
                style={inputStyle}
                value={row.payeeValue}
                onChange={(e) => onChange(idx, { payeeValue: e.target.value })}
            >
                <option value="">Select employee</option>
                {staff.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                        {s.name || s.id}
                    </option>
                ))}
            </select>
        );
    }
    if (t === 'customer') {
        return (
            <select
                style={inputStyle}
                value={row.payeeValue}
                onChange={(e) => onChange(idx, { payeeValue: e.target.value })}
            >
                <option value="">Select workshop / customer</option>
                {customerOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        );
    }
    return null;
}

function PaymentReceiptGrid({
    variant,
    accounts,
    superSuppliers,
    staff,
    customerOptions,
    onPosted,
    initialPrefill,
}) {
    const leafAccounts = useMemo(
        () => (accounts || []).filter((a) => !a.hasChildren),
        [accounts],
    );
    const cashOptions = leafAccounts.filter((a) => a.isCashEquivalent);
    const drPaymentAccounts = leafAccounts.filter(
        (a) => a.type === 'LIABILITY' || a.type === 'EXPENSE',
    );
    const receiptLineAccounts = leafAccounts.filter((a) => !a.isCashEquivalent);

    const prefillSeed = useMemo(
        () => buildGridStateFromPrefill(initialPrefill, variant, accounts, cashOptions),
        [initialPrefill, variant, accounts, cashOptions],
    );

    const [headerDate, setHeaderDate] = useState(() => prefillSeed.headerDate);
    const [headerRef, setHeaderRef] = useState(() => prefillSeed.headerRef);
    const [generalNote, setGeneralNote] = useState(() => prefillSeed.generalNote);
    const [cashAccountId, setCashAccountId] = useState(() => prefillSeed.cashAccountId);
    const [lines, setLines] = useState(() => prefillSeed.lines);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const prefillAppliedRef = useRef(null);

    useEffect(() => {
        if (!cashAccountId && cashOptions[0]?.id) setCashAccountId(String(cashOptions[0].id));
    }, [cashOptions, cashAccountId]);

    useEffect(() => {
        if (!initialPrefill) return;
        const prefillKey =
            initialPrefill.salesInvoiceId ||
            initialPrefill.headerRef ||
            JSON.stringify(initialPrefill.lines?.[0]?.payeeValue || '');
        if (prefillAppliedRef.current === prefillKey) return;

        const next = buildGridStateFromPrefill(initialPrefill, variant, accounts, cashOptions);
        setHeaderDate(next.headerDate);
        setHeaderRef(next.headerRef);
        setGeneralNote(next.generalNote);
        if (next.cashAccountId) setCashAccountId(next.cashAccountId);
        setLines(next.lines);
        prefillAppliedRef.current = prefillKey;
    }, [initialPrefill, variant, accounts, cashOptions]);

    const accountColOptions = variant === 'payment' ? drPaymentAccounts : receiptLineAccounts;

    const total = useMemo(
        () => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        [lines],
    );

    const validCount = useMemo(
        () =>
            lines.filter(
                (l) =>
                    l.accountId
                    && Number(l.amount) > 0
                    && (l.payType === 'others' || (l.payeeValue && String(l.payeeValue).trim() !== '')),
            ).length,
        [lines],
    );

    function updateLine(idx, patch) {
        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    function addLine() {
        setLines((ls) => {
            const next = [...ls, emptyPayReceiptLine(headerDate)];
            const targetRow = next.length;
            queueMicrotask(() => {
                document
                    .querySelector(`[data-hub-row="${variant}-${targetRow}"] [data-hub-focus="date"]`)
                    ?.focus?.();
            });
            return next;
        });
    }

    function handleTypeChange(idx, payType) {
        updateLine(idx, { payType, payeeValue: '' });
    }

    function handleTabFromNotes(e, idx) {
        if (e.key !== 'Tab' || e.shiftKey) return;
        if (idx !== lines.length - 1) return;
        e.preventDefault();
        addLine();
    }

    async function saveAll(e) {
        e.preventDefault();
        setErr('');
        if (!cashAccountId) {
            setErr('Select a paid from / receipt from account.');
            return;
        }
        const clean = lines.filter(
            (l) =>
                l.accountId
                && Number(l.amount) > 0
                && (l.payType === 'others' || (l.payeeValue && String(l.payeeValue).trim() !== '')),
        );
        if (clean.length === 0) {
            setErr('Add at least one valid row (type + payee when required, account, amount > 0).');
            return;
        }
        setSaving(true);
        const posted = [];
        try {
            for (let i = 0; i < clean.length; i++) {
                const l = clean[i];
                const party = partyPayloadFromRow(l);
                const rowDate = l.lineDate || headerDate;
                const lineBody = {
                    accountId: l.accountId,
                    amount: Number(l.amount),
                    description: l.notes?.trim() || undefined,
                    lineReference: l.lineReference?.trim() || undefined,
                    ...party,
                };
                const body = {
                    date: rowDate,
                    cashAccountId,
                    description: generalNote.trim() || undefined,
                    reference: headerRef.trim() || undefined,
                    lines: [lineBody],
                };
                const res =
                    variant === 'payment'
                        ? await postSupplierPayment(body)
                        : await postSupplierReceipt(body);
                posted.push(res);
            }
            onPosted?.(posted);
            setLines([emptyPayReceiptLine(headerDate)]);
            setGeneralNote('');
            setHeaderRef('');
        } catch (ex) {
            setErr(ex?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    }

    const cashLabelText = variant === 'payment' ? 'Paid from / Receipt from account' : 'Paid from / Receipt from account';

    return (
        <form onSubmit={saveAll} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>
                {variant === 'payment'
                    ? 'Payments — Dr: Payable / Expense | Cr: selected cash/bank. Tab moves across columns; Tab from Notes on the last row adds a new line.'
                    : 'Receipts — Dr: cash/bank | Cr: revenue / liability / AR. Same keyboard behaviour as payments.'}
            </p>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                }}
            >
                <Field label="Date" required>
                    <input
                        type="date"
                        style={inputStyle}
                        value={headerDate}
                        onChange={(e) => {
                            const v = e.target.value;
                            setHeaderDate(v);
                            setLines((ls) => ls.map((l, i) => (i === 0 && !l.lineDate ? { ...l, lineDate: v } : l)));
                        }}
                        required
                    />
                </Field>
                <Field label="Reference number">
                    <input
                        style={inputStyle}
                        value={headerRef}
                        onChange={(e) => setHeaderRef(e.target.value)}
                        placeholder="Document / batch reference"
                    />
                </Field>
                <Field label="General note">
                    <input
                        style={inputStyle}
                        value={generalNote}
                        onChange={(e) => setGeneralNote(e.target.value)}
                        placeholder="Optional note for all entries"
                    />
                </Field>
                <Field label={cashLabelText} required>
                    <select
                        style={inputStyle}
                        value={cashAccountId}
                        onChange={(e) => setCashAccountId(e.target.value)}
                        required
                    >
                        <option value="">— Select —</option>
                        {cashOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                                {cashLabel(a)}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', minWidth: 920 }}>
                    <thead>
                        <tr>
                            <th style={{ width: 88 }}>Voucher #</th>
                            <th style={{ width: 130 }}>Date</th>
                            <th style={{ width: 130 }}>Type</th>
                            <th style={{ minWidth: 200 }}>Payee (To)</th>
                            <th style={{ minWidth: 220 }}>
                                {variant === 'payment' ? 'Account Dr — Payable / Expense' : 'Account Cr'}
                            </th>
                            <th style={{ width: 120, textAlign: 'right' }}>Amount (SAR)</th>
                            <th style={{ width: 110 }}>Reference</th>
                            <th style={{ minWidth: 140 }}>Notes</th>
                            <th style={{ width: 44 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, idx) => (
                            <tr key={idx} data-hub-row={`${variant}-${idx + 1}`}>
                                <td>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            borderRadius: 8,
                                            background: '#E0F2FE',
                                            color: '#0369A1',
                                            fontWeight: 800,
                                            fontSize: 12,
                                        }}
                                    >
                                        {variant === 'payment' ? 'PE' : 'RC'}
                                        {String(idx + 1).padStart(4, '0')}
                                    </span>
                                </td>
                                <td>
                                    <input
                                        data-hub-focus="date"
                                        type="date"
                                        style={inputStyle}
                                        value={l.lineDate || headerDate}
                                        onChange={(e) => updateLine(idx, { lineDate: e.target.value })}
                                    />
                                </td>
                                <td>
                                    <select
                                        style={inputStyle}
                                        value={l.payType}
                                        onChange={(e) => handleTypeChange(idx, e.target.value)}
                                    >
                                        {PAY_TYPES.map((p) => (
                                            <option key={p.value} value={p.value}>
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <PayeeCell
                                        row={l}
                                        idx={idx}
                                        superSuppliers={superSuppliers}
                                        staff={staff}
                                        customerOptions={customerOptions}
                                        onChange={updateLine}
                                    />
                                </td>
                                <td>
                                    <select
                                        style={inputStyle}
                                        value={l.accountId}
                                        onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                                    >
                                        <option value="">Select account…</option>
                                        {accountColOptions.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                [{a.code}] {a.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.amount}
                                        onChange={(e) => updateLine(idx, { amount: e.target.value })}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.lineReference}
                                        onChange={(e) => updateLine(idx, { lineReference: e.target.value })}
                                        placeholder="Ref #"
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        placeholder="Notes"
                                        onKeyDown={(e) => handleTabFromNotes(e, idx)}
                                    />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        style={{ ...outlineBtnStyle, color: '#B91C1C', borderColor: '#FECACA' }}
                                        onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                                        disabled={lines.length === 1}
                                        title="Remove row"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                    {validCount} valid row{validCount === 1 ? '' : 's'} — Total: {money(total)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} onClick={addLine}>
                        <Plus size={14} /> Add row
                    </button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving || validCount === 0}>
                        {saving ? 'Saving…' : variant === 'payment' ? 'Save all payments' : 'Save all receipts'}
                    </button>
                </div>
            </div>

            <AcctError message={err} />
        </form>
    );
}

function GeneralJournalGrid({ accounts, headerDate, headerRef, generalNote, onPosted }) {
    const leafAccounts = useMemo(
        () => (accounts || []).filter((a) => !a.hasChildren),
        [accounts],
    );
    const [lines, setLines] = useState(() => [emptyJournalLine(), emptyJournalLine()]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const totals = useMemo(() => {
        const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
        const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
        return { debit, credit, balanced: Math.abs(debit - credit) < 0.01 && debit > 0 };
    }, [lines]);

    function updateLine(idx, patch) {
        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    function addLine() {
        setLines((ls) => {
            const next = [...ls, emptyJournalLine()];
            const targetRow = next.length;
            queueMicrotask(() => {
                document.querySelector(`[data-gj-row="${targetRow}"] [data-gj-focus="acct"]`)?.focus?.();
            });
            return next;
        });
    }

    function onNotesKeyDown(e, idx) {
        if (e.key !== 'Tab' || e.shiftKey) return;
        if (idx !== lines.length - 1) return;
        e.preventDefault();
        addLine();
    }

    async function submit(e) {
        e.preventDefault();
        setErr('');
        if (!totals.balanced) {
            setErr('Debit total must equal credit total (and be greater than 0).');
            return;
        }
        const cleanLines = lines
            .filter((l) => l.accountId && ((Number(l.debit) || 0) + (Number(l.credit) || 0)) > 0)
            .map((l) => ({
                accountId: l.accountId,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
                description: [l.lineReference?.trim(), l.notes?.trim()].filter(Boolean).join(' | ') || undefined,
            }));
        if (cleanLines.length < 2) {
            setErr('At least 2 balanced lines are required.');
            return;
        }
        setSaving(true);
        try {
            const res = await postSupplierGeneralJournal({
                date: headerDate,
                description: generalNote.trim() || undefined,
                reference: headerRef.trim() || undefined,
                lines: cleanLines,
            });
            onPosted?.([res]);
            setLines([emptyJournalLine(), emptyJournalLine()]);
        } catch (ex) {
            setErr(ex?.message || 'Failed to post journal');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                Journal entry — lines must balance. Tab from Notes on the last row adds a line.
            </p>
            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', minWidth: 800 }}>
                    <thead>
                        <tr>
                            <th style={{ width: 88 }}>Voucher #</th>
                            <th style={{ width: 28 }}> </th>
                            <th style={{ minWidth: 220 }}>Account</th>
                            <th style={{ width: 120, textAlign: 'right' }}>Debit</th>
                            <th style={{ width: 120, textAlign: 'right' }}>Credit</th>
                            <th style={{ width: 110 }}>Reference</th>
                            <th style={{ minWidth: 140 }}>Notes</th>
                            <th style={{ width: 44 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, idx) => (
                            <tr key={idx} data-gj-row={String(idx + 1)}>
                                <td>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            borderRadius: 8,
                                            background: '#F1F5F9',
                                            fontWeight: 800,
                                            fontSize: 12,
                                            color: '#334155',
                                        }}
                                    >
                                        JE
                                        {String(idx + 1).padStart(4, '0')}
                                    </span>
                                </td>
                                <td />
                                <td>
                                    <select
                                        data-gj-focus="acct"
                                        style={inputStyle}
                                        value={l.accountId}
                                        onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                                    >
                                        <option value="">— Select —</option>
                                        {leafAccounts.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                [{a.code}] {a.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.debit}
                                        onChange={(e) => updateLine(idx, { debit: e.target.value, credit: '' })}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.credit}
                                        onChange={(e) => updateLine(idx, { credit: e.target.value, debit: '' })}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.lineReference}
                                        onChange={(e) => updateLine(idx, { lineReference: e.target.value })}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        onKeyDown={(e) => onNotesKeyDown(e, idx)}
                                    />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        style={{ ...outlineBtnStyle, color: '#B91C1C', borderColor: '#FECACA' }}
                                        onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                                        disabled={lines.length <= 2}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>
                                Totals
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(totals.debit)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(totals.credit)}</td>
                            <td colSpan={3} />
                        </tr>
                    </tfoot>
                </table>
            </div>
            {!totals.balanced ? (
                <div style={{ fontSize: 12, color: '#B45309', fontWeight: 700 }}>
                    Out of balance by {money(Math.abs(totals.debit - totals.credit))}
                </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" style={outlineBtnStyle} onClick={addLine}>
                    <Plus size={14} /> Add row
                </button>
                <button type="submit" style={primaryBtnStyle} disabled={saving || !totals.balanced}>
                    {saving ? 'Posting…' : 'Save journal entry'}
                </button>
            </div>
            <AcctError message={err} />
        </form>
    );
}

export default function SupplierTransactionHub() {
    const location = useLocation();
    const navigate = useNavigate();
    const [tab, setTab] = useState('payment');
    const [entryPrefill, setEntryPrefill] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [superSuppliers, setSuperSuppliers] = useState([]);
    const [staff, setStaff] = useState([]);
    const [affiliatedRows, setAffiliatedRows] = useState([]);
    const [externalParties, setExternalParties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [lastPosted, setLastPosted] = useState(null);
    const [recentPayments, setRecentPayments] = useState([]);
    const [recentReceipts, setRecentReceipts] = useState([]);

    const [gjDate, setGjDate] = useState(todayISO());
    const [gjRef, setGjRef] = useState('');
    const [gjNote, setGjNote] = useState('');

    const customerOptions = useMemo(() => {
        const workshopsWithBranchPins = new Set(
            affiliatedRows
                .filter((r) => r.scope === 'branch' && r.branchId)
                .map((r) => String(r.workshopId)),
        );
        const opts = [];
        for (const r of affiliatedRows) {
            if (r.scope === 'branch' && r.branchId) {
                opts.push({
                    value: `branch|${r.branchId}`,
                    label: formatAffiliatedBranchCustomerLabel(
                        r.workshopName,
                        r.branchName,
                    ),
                });
            } else if (
                r.scope === 'workshop' &&
                r.workshopId &&
                !workshopsWithBranchPins.has(String(r.workshopId))
            ) {
                opts.push({
                    value: `workshop|${r.workshopId}`,
                    label: formatAffiliatedWorkshopCustomerLabel(r.workshopName),
                });
            }
        }
        for (const p of externalParties) {
            const id = p.id ?? p.externalPartyId;
            if (!id) continue;
            opts.push({
                value: `external|${String(id)}`,
                label: `Non-affiliated · ${p.displayName || p.name || String(id)}`,
            });
        }
        return opts;
    }, [affiliatedRows, externalParties]);

    const reload = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [list, ss, st, aff, ext] = await Promise.all([
                getSupplierAccounts({ status: 'active' }),
                listSupplierSuperSuppliers().catch(() => ({})),
                listSupplierStaff({ status: 'active' }).catch(() => ({})),
                listSupplierAffiliatedWorkshops().catch(() => ({})),
                listSupplierExternalParties().catch(() => ({})),
            ]);
            setAccounts(unwrapSupplierAccountingList(list));
            setSuperSuppliers(extractArray(ss, ['superSuppliers', 'data']));
            setStaff(extractArray(st, ['staff', 'data']));
            setAffiliatedRows(extractArray(aff, ['rows', 'data']));
            setExternalParties(extractArray(ext, ['parties', 'rows', 'data']));
        } catch (e) {
            setErr(e?.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    const reloadRecent = useCallback(async () => {
        try {
            const [p, r] = await Promise.all([
                listSupplierPayments({ limit: '8', offset: '0' }),
                listSupplierReceipts({ limit: '8', offset: '0' }),
            ]);
            const pj = p?.journals ?? p?.data?.journals ?? p?.data;
            const rj = r?.journals ?? r?.data?.journals ?? r?.data;
            setRecentPayments(Array.isArray(pj) ? pj : []);
            setRecentReceipts(Array.isArray(rj) ? rj : []);
        } catch {
            setRecentPayments([]);
            setRecentReceipts([]);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    useEffect(() => {
        reloadRecent();
    }, [reloadRecent, lastPosted]);

    useEffect(() => {
        let raw = location.state?.[TRANSACTION_HUB_RECEIPT_PREFILL_KEY];
        if (!raw) {
            try {
                const stored = sessionStorage.getItem(TRANSACTION_HUB_RECEIPT_PREFILL_KEY);
                if (stored) {
                    raw = JSON.parse(stored);
                    sessionStorage.removeItem(TRANSACTION_HUB_RECEIPT_PREFILL_KEY);
                }
            } catch {
                raw = null;
            }
        }
        if (!raw || typeof raw !== 'object') return;
        setTab(raw.tab === 'payment' ? 'payment' : 'receipt');
        setEntryPrefill(raw);
        if (location.state?.[TRANSACTION_HUB_RECEIPT_PREFILL_KEY]) {
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.pathname, location.state, navigate]);

    const activeGridPrefill =
        !loading && entryPrefill && (entryPrefill.tab === tab || entryPrefill.variant === tab)
            ? entryPrefill
            : null;

    const tabBtn = (id, label, Icon) => (
        <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                border: tab === id ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
                background: tab === id ? '#fff' : 'transparent',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                color: tab === id ? '#0F172A' : '#64748B',
            }}
        >
            {Icon ? <Icon size={16} /> : null}
            {label}
        </button>
    );

    return (
        <div style={{ padding: 4 }}>
            <div style={{ marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>Transaction entry</h2>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748B' }}>
                    Record payments, receipts, and journal entries.
                </p>
            </div>

            <AcctCard title="Entry">
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading />
                ) : (
                    <>
                        <div
                            style={{
                                display: 'flex',
                                gap: 4,
                                padding: 4,
                                background: '#F1F5F9',
                                borderRadius: 12,
                                marginBottom: 16,
                                flexWrap: 'wrap',
                            }}
                        >
                            {tabBtn('payment', 'Payments', CreditCard)}
                            {tabBtn('receipt', 'Receipts', Receipt)}
                            {tabBtn('journal', 'Journal entry', ArrowLeftRight)}
                        </div>

                        {tab === 'payment' && (
                            <PaymentReceiptGrid
                                variant="payment"
                                accounts={accounts}
                                superSuppliers={superSuppliers}
                                staff={staff}
                                customerOptions={customerOptions}
                                initialPrefill={
                                    activeGridPrefill?.tab === 'payment' ||
                                    activeGridPrefill?.variant === 'payment'
                                        ? activeGridPrefill
                                        : null
                                }
                                onPosted={(journals) => {
                                    const last = journals?.[journals.length - 1] ?? null;
                                    const mirrors = (journals || []).flatMap(
                                        (j) => j?.storageFacilityMirrors || [],
                                    );
                                    setLastPosted(
                                        last
                                            ? {
                                                  ...last,
                                                  storageFacilityMirrors: mirrors,
                                              }
                                            : null,
                                    );
                                }}
                            />
                        )}
                        {tab === 'receipt' && (
                            <PaymentReceiptGrid
                                variant="receipt"
                                accounts={accounts}
                                superSuppliers={superSuppliers}
                                staff={staff}
                                customerOptions={customerOptions}
                                initialPrefill={
                                    activeGridPrefill?.tab === 'receipt' ||
                                    activeGridPrefill?.variant === 'receipt'
                                        ? activeGridPrefill
                                        : null
                                }
                                onPosted={(journals) => {
                                    setLastPosted(journals?.[journals.length - 1] ?? null);
                                    setEntryPrefill(null);
                                }}
                            />
                        )}
                        {tab === 'journal' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                        gap: 12,
                                    }}
                                >
                                    <Field label="Date" required>
                                        <input
                                            type="date"
                                            style={inputStyle}
                                            value={gjDate}
                                            onChange={(e) => setGjDate(e.target.value)}
                                            required
                                        />
                                    </Field>
                                    <Field label="Reference number">
                                        <input style={inputStyle} value={gjRef} onChange={(e) => setGjRef(e.target.value)} />
                                    </Field>
                                    <Field label="General note">
                                        <input style={inputStyle} value={gjNote} onChange={(e) => setGjNote(e.target.value)} />
                                    </Field>
                                </div>
                                <GeneralJournalGrid
                                    accounts={accounts}
                                    headerDate={gjDate}
                                    headerRef={gjRef}
                                    generalNote={gjNote}
                                    onPosted={(journals) => setLastPosted(journals?.[0] ?? null)}
                                />
                            </div>
                        )}

                        {lastPosted ? (
                            <div
                                style={{
                                    marginTop: 14,
                                    padding: 12,
                                    background: '#ECFDF5',
                                    borderRadius: 10,
                                    color: '#065F46',
                                    fontWeight: 700,
                                    fontSize: 13,
                                }}
                            >
                                Last saved: <strong>{lastPosted.entryNumber}</strong> — total {money(lastPosted.totalDebit)}.
                                {lastPosted.storageFacilityMirrors?.length ? (
                                    <>
                                        {' '}
                                        · Synced to storage facility:{' '}
                                        {lastPosted.storageFacilityMirrors
                                            .map(
                                                (m) =>
                                                    `${m.brandName} (${m.entryNumber}, ${money(m.amount)})`,
                                            )
                                            .join('; ')}
                                    </>
                                ) : null}
                            </div>
                        ) : null}

                        <div style={{ marginTop: 24 }}>
                            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Recent payments</h4>
                            {recentPayments.length === 0 ? (
                                <AcctEmpty message="No recent payments yet." />
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155' }}>
                                    {recentPayments.map((j) => (
                                        <li key={j.id} style={{ marginBottom: 6 }}>
                                            <strong>{j.entryNumber}</strong>
                                            {' · '}
                                            {fmtDate(j.date)}
                                            {' · '}
                                            {money(j.totalDebit)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Recent receipts</h4>
                            {recentReceipts.length === 0 ? (
                                <AcctEmpty message="No recent receipts yet." />
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155' }}>
                                    {recentReceipts.map((j) => (
                                        <li key={j.id} style={{ marginBottom: 6 }}>
                                            <strong>{j.entryNumber}</strong>
                                            {' · '}
                                            {fmtDate(j.date)}
                                            {' · '}
                                            {money(j.totalCredit ?? j.totalDebit)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                )}
            </AcctCard>
        </div>
    );
}
