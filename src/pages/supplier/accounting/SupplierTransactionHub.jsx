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
    coaNetBalance,
} from './SupplierAccountingShared';
import { saccT } from '../../../utils/supplierAccountingI18n';

const PAY_TYPE_KEYS = [
    { value: 'super_supplier', key: 'hub.payType.super_supplier' },
    { value: 'employee', key: 'hub.payType.employee' },
    { value: 'customer', key: 'hub.payType.customer' },
    { value: 'others', key: 'hub.payType.others' },
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

function cashLabel(a, locale = 'en') {
    const rd = Number(a.closingDebit) || 0;
    const rc = Number(a.closingCredit) || 0;
    const bal = coaNetBalance(a.type, rd, rc);
    return `[${a.code}] ${a.name} — ${money(bal, 'SAR', { locale })}`;
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
    t,
}) {
    const payT = row.payType;
    if (payT === 'others') {
        return (
            <span style={{ fontSize: 13, color: '#94A3B8' }}>{t('emdash')}</span>
        );
    }
    if (payT === 'super_supplier') {
        return (
            <select
                style={inputStyle}
                value={row.payeeValue}
                onChange={(e) => onChange(idx, { payeeValue: e.target.value })}
            >
                <option value="">{t('hub.select.super')}</option>
                {superSuppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                        {s.name || s.companyName || s.code || s.id}
                    </option>
                ))}
            </select>
        );
    }
    if (payT === 'employee') {
        return (
            <select
                style={inputStyle}
                value={row.payeeValue}
                onChange={(e) => onChange(idx, { payeeValue: e.target.value })}
            >
                <option value="">{t('hub.select.employee')}</option>
                {staff.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                        {s.name || s.id}
                    </option>
                ))}
            </select>
        );
    }
    if (payT === 'customer') {
        return (
            <select
                style={inputStyle}
                value={row.payeeValue}
                onChange={(e) => onChange(idx, { payeeValue: e.target.value })}
            >
                <option value="">{t('hub.select.customer')}</option>
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
    locale = 'en',
    t,
}) {
    const tr = t || ((key, vars) => saccT(locale, key, vars));
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
            setErr(tr('hub.err.cash'));
            return;
        }
        const clean = lines.filter(
            (l) =>
                l.accountId
                && Number(l.amount) > 0
                && (l.payType === 'others' || (l.payeeValue && String(l.payeeValue).trim() !== '')),
        );
        if (clean.length === 0) {
            setErr(tr('hub.err.rows'));
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
            setErr(ex?.message || tr('hub.err.save'));
        } finally {
            setSaving(false);
        }
    }

    const cashLabelText = tr('hub.field.cashAccount');

    return (
        <form onSubmit={saveAll} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>
                {variant === 'payment' ? tr('hub.hint.payment') : tr('hub.hint.receipt')}
            </p>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                }}
            >
                <Field label={tr('hub.field.date')} required>
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
                <Field label={tr('hub.field.ref')}>
                    <input
                        style={inputStyle}
                        value={headerRef}
                        onChange={(e) => setHeaderRef(e.target.value)}
                        placeholder={tr('hub.field.refPh')}
                    />
                </Field>
                <Field label={tr('hub.field.note')}>
                    <input
                        style={inputStyle}
                        value={generalNote}
                        onChange={(e) => setGeneralNote(e.target.value)}
                        placeholder={tr('hub.field.notePh')}
                    />
                </Field>
                <Field label={cashLabelText} required>
                    <select
                        style={inputStyle}
                        value={cashAccountId}
                        onChange={(e) => setCashAccountId(e.target.value)}
                        required
                    >
                        <option value="">{tr('select.dash')}</option>
                        {cashOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                                {cashLabel(a, locale)}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', minWidth: 920 }}>
                    <thead>
                        <tr>
                            <th style={{ width: 88 }}>{tr('hub.th.voucher')}</th>
                            <th style={{ width: 130 }}>{tr('hub.th.date')}</th>
                            <th style={{ width: 130 }}>{tr('hub.th.type')}</th>
                            <th style={{ minWidth: 200 }}>{tr('hub.th.payee')}</th>
                            <th style={{ minWidth: 220 }}>
                                {variant === 'payment' ? tr('hub.th.accountDr') : tr('hub.th.accountCr')}
                            </th>
                            <th style={{ width: 120, textAlign: 'right' }}>{tr('hub.th.amount')}</th>
                            <th style={{ width: 110 }}>{tr('hub.th.ref')}</th>
                            <th style={{ minWidth: 140 }}>{tr('hub.th.notes')}</th>
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
                                        {PAY_TYPE_KEYS.map((p) => (
                                            <option key={p.value} value={p.value}>
                                                {tr(p.key)}
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
                                        t={tr}
                                    />
                                </td>
                                <td>
                                    <select
                                        style={inputStyle}
                                        value={l.accountId}
                                        onChange={(e) => updateLine(idx, { accountId: e.target.value })}
                                    >
                                        <option value="">{tr('hub.select.account')}</option>
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
                                        placeholder={tr('hub.refPh')}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        placeholder={tr('hub.notesPh')}
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
                                        title={tr('hub.removeRow')}
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
                    {tr(validCount === 1 ? 'hub.validRow' : 'hub.validRows', {
                        count: validCount,
                        amount: money(total, 'SAR', { locale }),
                    })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} onClick={addLine}>
                        <Plus size={14} /> {tr('hub.btn.addRow')}
                    </button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving || validCount === 0}>
                        {saving
                            ? tr('hub.btn.saving')
                            : variant === 'payment'
                              ? tr('hub.btn.savePayments')
                              : tr('hub.btn.saveReceipts')}
                    </button>
                </div>
            </div>

            <AcctError message={err} />
        </form>
    );
}

function GeneralJournalGrid({ accounts, headerDate, headerRef, generalNote, onPosted, locale = 'en', t }) {
    const tr = t || ((key, vars) => saccT(locale, key, vars));
    const m = (v) => money(v, 'SAR', { locale });
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
            setErr(tr('hub.err.balance'));
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
            setErr(tr('hub.err.minLines'));
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
            setErr(ex?.message || tr('hub.err.post'));
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                {tr('hub.journal.lineHint')}
            </p>
            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', minWidth: 800 }}>
                    <thead>
                        <tr>
                            <th style={{ width: 88 }}>{tr('hub.th.voucher')}</th>
                            <th style={{ width: 28 }}> </th>
                            <th style={{ minWidth: 220 }}>{tr('hub.th.account')}</th>
                            <th style={{ width: 120, textAlign: 'right' }}>{tr('hub.th.debit')}</th>
                            <th style={{ width: 120, textAlign: 'right' }}>{tr('hub.th.credit')}</th>
                            <th style={{ width: 110 }}>{tr('hub.th.ref')}</th>
                            <th style={{ minWidth: 140 }}>{tr('hub.th.notes')}</th>
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
                                        <option value="">{tr('select.dash')}</option>
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
                                        title={tr('hub.removeRow')}
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
                                {tr('hub.totals')}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{m(totals.debit)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{m(totals.credit)}</td>
                            <td colSpan={3} />
                        </tr>
                    </tfoot>
                </table>
            </div>
            {!totals.balanced ? (
                <div style={{ fontSize: 12, color: '#B45309', fontWeight: 700 }}>
                    {tr('hub.outOfBalance', { amount: m(Math.abs(totals.debit - totals.credit)) })}
                </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button type="button" style={outlineBtnStyle} onClick={addLine}>
                    <Plus size={14} /> {tr('hub.btn.addRow')}
                </button>
                <button type="submit" style={primaryBtnStyle} disabled={saving || !totals.balanced}>
                    {saving ? tr('hub.btn.posting') : tr('hub.btn.saveJournal')}
                </button>
            </div>
            <AcctError message={err} />
        </form>
    );
}

export default function SupplierTransactionHub({ locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const m = useCallback((v) => money(v, 'SAR', { locale }), [locale]);
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
                label: t('hub.nonAffiliated', { name: p.displayName || p.name || String(id) }),
            });
        }
        return opts;
    }, [affiliatedRows, externalParties, t]);

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
            setErr(e?.message || t('hub.err.load'));
        } finally {
            setLoading(false);
        }
    }, [t]);

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
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{t('hub.title')}</h2>
                <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748B' }}>
                    {t('hub.sub')}
                </p>
            </div>

            <AcctCard title={t('hub.card.entry')}>
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading locale={locale} />
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
                            {tabBtn('payment', t('hub.tab.payments'), CreditCard)}
                            {tabBtn('receipt', t('hub.tab.receipts'), Receipt)}
                            {tabBtn('journal', t('hub.tab.journal'), ArrowLeftRight)}
                        </div>

                        {tab === 'payment' && (
                            <PaymentReceiptGrid
                                variant="payment"
                                accounts={accounts}
                                superSuppliers={superSuppliers}
                                staff={staff}
                                customerOptions={customerOptions}
                                locale={locale}
                                t={t}
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
                                locale={locale}
                                t={t}
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
                                    <Field label={t('hub.field.date')} required>
                                        <input
                                            type="date"
                                            style={inputStyle}
                                            value={gjDate}
                                            onChange={(e) => setGjDate(e.target.value)}
                                            required
                                        />
                                    </Field>
                                    <Field label={t('hub.field.ref')}>
                                        <input style={inputStyle} value={gjRef} onChange={(e) => setGjRef(e.target.value)} />
                                    </Field>
                                    <Field label={t('hub.field.note')}>
                                        <input style={inputStyle} value={gjNote} onChange={(e) => setGjNote(e.target.value)} />
                                    </Field>
                                </div>
                                <GeneralJournalGrid
                                    accounts={accounts}
                                    headerDate={gjDate}
                                    headerRef={gjRef}
                                    generalNote={gjNote}
                                    locale={locale}
                                    t={t}
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
                                {t('hub.lastSaved', {
                                    entry: lastPosted.entryNumber,
                                    amount: m(lastPosted.totalDebit),
                                })}
                                {lastPosted.storageFacilityMirrors?.length ? (
                                    <>
                                        {' '}
                                        ·{' '}
                                        {t('hub.syncedStorage', {
                                            list: lastPosted.storageFacilityMirrors
                                                .map(
                                                    (mir) =>
                                                        `${mir.brandName} (${mir.entryNumber}, ${m(mir.amount)})`,
                                                )
                                                .join('; '),
                                        })}
                                    </>
                                ) : null}
                            </div>
                        ) : null}

                        <div style={{ marginTop: 24 }}>
                            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                                {t('hub.recentPayments')}
                            </h4>
                            {recentPayments.length === 0 ? (
                                <AcctEmpty message={t('hub.emptyPayments')} />
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155' }}>
                                    {recentPayments.map((j) => (
                                        <li key={j.id} style={{ marginBottom: 6 }}>
                                            <strong>{j.entryNumber}</strong>
                                            {' · '}
                                            {fmtDate(j.date)}
                                            {' · '}
                                            {m(j.totalDebit)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div style={{ marginTop: 16 }}>
                            <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: '#0F172A' }}>
                                {t('hub.recentReceipts')}
                            </h4>
                            {recentReceipts.length === 0 ? (
                                <AcctEmpty message={t('hub.emptyReceipts')} />
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#334155' }}>
                                    {recentReceipts.map((j) => (
                                        <li key={j.id} style={{ marginBottom: 6 }}>
                                            <strong>{j.entryNumber}</strong>
                                            {' · '}
                                            {fmtDate(j.date)}
                                            {' · '}
                                            {m(j.totalCredit ?? j.totalDebit)}
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
