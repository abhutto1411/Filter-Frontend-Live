import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { unwrapBrandAccounts } from '../../../../services/storageFacilityAccountingApi';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
import { useStorageFacilityApi } from '../StorageFacilityPortalContext';
import { ArrowLeftRight, CreditCard, Plus, Receipt, Trash2 } from 'lucide-react';


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
} from '../../accounting/SupplierAccountingShared';

const PAY_TYPES = [
    { value: 'customer', label: 'Customers' },
    { value: 'supplier', label: 'Suppliers' },
    { value: 'others', label: 'Others' },
];

function emptyLine(headerDate) {
    return {
        lineDate: headerDate || todayISO(),
        payType: 'customer',
        payeeValue: '',
        accountId: '',
        amount: '',
        lineReference: '',
        notes: '',
    };
}

function emptyJournalLine() {
    return { accountId: '', debit: '', credit: '', lineReference: '', notes: '' };
}

function cashLabel(a) {
    return `[${a.code}] ${a.name} — ${money(a.balance ?? 0)}`;
}

function findAccountByCode(accounts, code) {
    return (accounts || []).find((a) => String(a.code || '').trim() === String(code));
}

function partyFromRow(row) {
    if (row.payType === 'customer' && row.payeeValue) {
        return { partyType: 'storage_customer', partyId: row.payeeValue };
    }
    if (row.payType === 'supplier' && row.payeeValue) {
        return { partyType: 'storage_supplier', partyId: row.payeeValue };
    }
    return {};
}

function lineDescription(row) {
    const parts = [];
    if (row.payType === 'others' && String(row.payeeValue || '').trim()) {
        parts.push(`Payee: ${String(row.payeeValue).trim()}`);
    }
    if (String(row.notes || '').trim()) {
        parts.push(String(row.notes).trim());
    }
    return parts.length ? parts.join(' | ') : undefined;
}

function groupAccounts(accounts) {
    const map = new Map();
    for (const a of accounts || []) {
        const key = a.accountCategory || a.type || 'Other';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(a);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function AccountSelect({ accounts, value, onChange, placeholder = 'Select account…' }) {
    const groups = useMemo(() => groupAccounts(accounts), [accounts]);
    return (
        <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">{placeholder}</option>
            {groups.map(([label, rows]) => (
                <optgroup key={label} label={label}>
                    {rows.map((a) => (
                        <option key={a.id} value={a.id}>
                            [{a.code}] {a.name}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
}

function PayeeCell({ row, customers, suppliers, onChange }) {
    if (row.payType === 'customer') {
        return (
            <select
                style={inputStyle}
                value={row.payeeValue}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Select customer…</option>
                {customers.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                        {c.name}
                        {c.code ? ` (${c.code})` : ''}
                    </option>
                ))}
            </select>
        );
    }
    if (row.payType === 'supplier') {
        return (
            <select
                style={inputStyle}
                value={row.payeeValue}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">Select supplier…</option>
                {suppliers.length === 0 ? (
                    <option value="" disabled>
                        No suppliers — add under Suppliers (AP)
                    </option>
                ) : null}
                {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                        {s.name || s.companyName || s.code || s.id}
                    </option>
                ))}
            </select>
        );
    }
    return (
        <input
            style={inputStyle}
            value={row.payeeValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type payee name"
        />
    );
}

function BrandPayReceiptGrid({
    brandId,
    variant,
    accounts,
    customers,
    suppliers,
    onPosted,
}) {
    const accountingApi = useStorageFacilityAccountingApi();
    const leafAccounts = useMemo(
        () => (accounts || []).filter((a) => !a.hasChildren),
        [accounts],
    );
    const cashOptions = leafAccounts.filter((a) => a.isCashEquivalent);

    const [headerDate, setHeaderDate] = useState(todayISO());
    const [headerRef, setHeaderRef] = useState('');
    const [generalNote, setGeneralNote] = useState('');
    const [cashAccountId, setCashAccountId] = useState('');
    const [lines, setLines] = useState(() => [emptyLine(todayISO())]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!cashAccountId && cashOptions[0]?.id) setCashAccountId(String(cashOptions[0].id));
    }, [cashOptions, cashAccountId]);

    const total = useMemo(
        () => lines.reduce((s, l) => s + (Number(l.amount) || 0), 0),
        [lines],
    );

    const isRowValid = useCallback((l) => {
        if (!l.accountId || !(Number(l.amount) > 0)) return false;
        if (l.payType === 'others') return true;
        return Boolean(l.payeeValue && String(l.payeeValue).trim());
    }, []);

    const validCount = useMemo(() => lines.filter(isRowValid).length, [lines, isRowValid]);

    function updateLine(idx, patch) {
        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    }

    function handleTypeChange(idx, payType) {
        updateLine(idx, { payType, payeeValue: '', accountId: '' });
    }

    function handlePayeeChange(idx, payeeValue, row) {
        const patch = { payeeValue };
        if (variant === 'receipt' && row.payType === 'customer' && payeeValue) {
            const ar = findAccountByCode(leafAccounts, '1100');
            if (ar) patch.accountId = String(ar.id);
        }
        if (variant === 'payment' && row.payType === 'supplier' && payeeValue) {
            const ap = findAccountByCode(leafAccounts, '2000');
            if (ap) patch.accountId = String(ap.id);
        }
        updateLine(idx, patch);
    }

    function addLine() {
        setLines((ls) => [...ls, emptyLine(headerDate)]);
    }

    function handleTabFromNotes(e, idx) {
        if (e.key !== 'Tab' || e.shiftKey || idx !== lines.length - 1) return;
        e.preventDefault();
        addLine();
    }

    async function saveAll(e) {
        e.preventDefault();
        setErr('');
        if (!cashAccountId) {
            setErr('Select a cash/bank account.');
            return;
        }
        const clean = lines.filter(isRowValid);
        if (clean.length === 0) {
            setErr('Add at least one row with type, payee (when required), account, and amount.');
            return;
        }
        setSaving(true);
        const posted = [];
        try {
            for (const l of clean) {
                const body = {
                    date: l.lineDate || headerDate,
                    cashAccountId,
                    description: generalNote.trim() || undefined,
                    reference: headerRef.trim() || undefined,
                    lines: [
                        {
                            accountId: l.accountId,
                            amount: Number(l.amount),
                            description: lineDescription(l),
                            lineReference: l.lineReference?.trim() || undefined,
                            ...partyFromRow(l),
                        },
                    ],
                };
                const res =
                    variant === 'payment'
                        ? await accountingApi.postBrandPayment(brandId, body)
                        : await accountingApi.postBrandReceipt(brandId, body);
                posted.push(res);
            }
            onPosted?.(posted);
            setLines([emptyLine(headerDate)]);
            setGeneralNote('');
            setHeaderRef('');
        } catch (ex) {
            setErr(ex?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={saveAll} className="sf-hub-entry-form">
            <p className="sf-acct-report-lead">
                {variant === 'payment'
                    ? 'Record money out — debit the expense or payable account, credit cash/bank.'
                    : 'Record money in — debit cash/bank, credit revenue, AR, or other account.'}
            </p>
            <div className="sf-hub-header-grid">
                <Field label="Date" required>
                    <input
                        type="date"
                        style={inputStyle}
                        value={headerDate}
                        onChange={(e) => setHeaderDate(e.target.value)}
                        required
                    />
                </Field>
                <Field label="Reference number">
                    <input
                        style={inputStyle}
                        value={headerRef}
                        onChange={(e) => setHeaderRef(e.target.value)}
                        placeholder="Optional"
                    />
                </Field>
                <Field label="General note">
                    <input
                        style={inputStyle}
                        value={generalNote}
                        onChange={(e) => setGeneralNote(e.target.value)}
                        placeholder="Optional"
                    />
                </Field>
                <Field label={variant === 'payment' ? 'Paid from (cash/bank) *' : 'Received into (cash/bank) *'} required>
                    <select
                        style={inputStyle}
                        value={cashAccountId}
                        onChange={(e) => setCashAccountId(e.target.value)}
                        required
                    >
                        <option value="">Select register…</option>
                        {cashOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                                {cashLabel(a)}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            <div className="premium-table mgr-si-table-wrap sf-acct-report-table-wrap">
                <table className="mgr-si-table sf-hub-lines-table">
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Voucher</th>
                            <th className="table-th">Date</th>
                            <th className="table-th">Type</th>
                            <th className="table-th">Payee</th>
                            <th className="table-th">
                                {variant === 'payment' ? 'Account Dr' : 'Account Cr'}
                            </th>
                            <th className="table-th" style={{ textAlign: 'right' }}>
                                Amount
                            </th>
                            <th className="table-th">Ref</th>
                            <th className="table-th">Notes</th>
                            <th className="table-th" />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, idx) => (
                            <tr key={idx} className="table-row">
                                <td className="table-cell">
                                    <span className="sf-hub-voucher">
                                        {variant === 'payment' ? 'PE' : 'RC'}
                                        {String(idx + 1).padStart(4, '0')}
                                    </span>
                                </td>
                                <td className="table-cell">
                                    <input
                                        type="date"
                                        style={inputStyle}
                                        value={l.lineDate || headerDate}
                                        onChange={(e) => updateLine(idx, { lineDate: e.target.value })}
                                    />
                                </td>
                                <td className="table-cell">
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
                                <td className="table-cell">
                                    <PayeeCell
                                        row={l}
                                        customers={customers}
                                        suppliers={suppliers}
                                        onChange={(val) => handlePayeeChange(idx, val, l)}
                                    />
                                </td>
                                <td className="table-cell">
                                    <AccountSelect
                                        accounts={leafAccounts}
                                        value={l.accountId}
                                        onChange={(id) => updateLine(idx, { accountId: id })}
                                    />
                                </td>
                                <td className="table-cell">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.amount}
                                        onChange={(e) => updateLine(idx, { amount: e.target.value })}
                                    />
                                </td>
                                <td className="table-cell">
                                    <input
                                        style={inputStyle}
                                        value={l.lineReference}
                                        onChange={(e) =>
                                            updateLine(idx, { lineReference: e.target.value })
                                        }
                                    />
                                </td>
                                <td className="table-cell">
                                    <input
                                        style={inputStyle}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        onKeyDown={(e) => handleTabFromNotes(e, idx)}
                                    />
                                </td>
                                <td className="table-cell">
                                    <button
                                        type="button"
                                        style={{ ...outlineBtnStyle, color: '#B91C1C' }}
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

            <div className="sf-hub-footer">
                <span className="sf-hub-footer-total">
                    {validCount} row{validCount === 1 ? '' : 's'} — {money(total)}
                </span>
                <div className="sf-hub-footer-actions">
                    <button type="button" style={outlineBtnStyle} onClick={addLine}>
                        <Plus size={14} /> Add row
                    </button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving || validCount === 0}>
                        {saving ? 'Saving…' : variant === 'payment' ? 'Save payments' : 'Save receipts'}
                    </button>
                </div>
            </div>
            <AcctError message={err} />
        </form>
    );
}

function BrandJournalGrid({ brandId, accounts, headerDate, headerRef, generalNote, onPosted }) {
    const accountingApi = useStorageFacilityAccountingApi();
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
        setLines((ls) => [...ls, emptyJournalLine()]);
    }

    function onNotesKeyDown(e, idx) {
        if (e.key !== 'Tab' || e.shiftKey || idx !== lines.length - 1) return;
        e.preventDefault();
        addLine();
    }

    async function submit(e) {
        e.preventDefault();
        if (!totals.balanced) {
            setErr('Debits must equal credits.');
            return;
        }
        const cleanLines = lines
            .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
            .map((l) => ({
                accountId: l.accountId,
                debit: Number(l.debit) || 0,
                credit: Number(l.credit) || 0,
                description: [l.lineReference, l.notes].filter(Boolean).join(' | ') || undefined,
            }));
        setSaving(true);
        try {
            const res = await accountingApi.postBrandGeneralJournal(brandId, {
                date: headerDate,
                description: generalNote.trim() || undefined,
                reference: headerRef.trim() || undefined,
                lines: cleanLines,
            });
            onPosted?.([res]);
            setLines([emptyJournalLine(), emptyJournalLine()]);
        } catch (ex) {
            setErr(ex?.message || 'Post failed');
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={submit} className="sf-hub-entry-form">
            <div className="premium-table mgr-si-table-wrap sf-acct-report-table-wrap">
                <table className="mgr-si-table sf-hub-lines-table">
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Account</th>
                            <th className="table-th" style={{ textAlign: 'right' }}>
                                Debit
                            </th>
                            <th className="table-th" style={{ textAlign: 'right' }}>
                                Credit
                            </th>
                            <th className="table-th">Ref</th>
                            <th className="table-th">Notes</th>
                            <th className="table-th" />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, idx) => (
                            <tr key={idx} className="table-row">
                                <td className="table-cell">
                                    <AccountSelect
                                        accounts={leafAccounts}
                                        value={l.accountId}
                                        onChange={(id) => updateLine(idx, { accountId: id })}
                                        placeholder="—"
                                    />
                                </td>
                                <td className="table-cell">
                                    <input
                                        type="number"
                                        step="0.01"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.debit}
                                        onChange={(e) =>
                                            updateLine(idx, { debit: e.target.value, credit: '' })
                                        }
                                    />
                                </td>
                                <td className="table-cell">
                                    <input
                                        type="number"
                                        step="0.01"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={l.credit}
                                        onChange={(e) =>
                                            updateLine(idx, { credit: e.target.value, debit: '' })
                                        }
                                    />
                                </td>
                                <td className="table-cell">
                                    <input
                                        style={inputStyle}
                                        value={l.lineReference}
                                        onChange={(e) =>
                                            updateLine(idx, { lineReference: e.target.value })
                                        }
                                    />
                                </td>
                                <td className="table-cell">
                                    <input
                                        style={inputStyle}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        onKeyDown={(e) => onNotesKeyDown(e, idx)}
                                    />
                                </td>
                                <td className="table-cell">
                                    <button
                                        type="button"
                                        style={outlineBtnStyle}
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
                        <tr className="table-row">
                            <td className="table-cell" style={{ textAlign: 'right', fontWeight: 700 }}>
                                Totals
                            </td>
                            <td className="table-cell" style={{ textAlign: 'right', fontWeight: 800 }}>
                                {money(totals.debit)}
                            </td>
                            <td className="table-cell" style={{ textAlign: 'right', fontWeight: 800 }}>
                                {money(totals.credit)}
                            </td>
                            <td colSpan={3} className="table-cell" />
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div className="sf-hub-footer">
                <span />
                <div className="sf-hub-footer-actions">
                    <button type="button" style={outlineBtnStyle} onClick={addLine}>
                        <Plus size={14} /> Add row
                    </button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving || !totals.balanced}>
                        {saving ? 'Posting…' : 'Save journal'}
                    </button>
                </div>
            </div>
            <AcctError message={err} />
        </form>
    );
}

export default function StorageBrandTransactionHub({ brandId, customers = [] }) {
    const accountingApi = useStorageFacilityAccountingApi();
    const sfApi = useStorageFacilityApi();
    const [tab, setTab] = useState('payment');
    const [accounts, setAccounts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [gjDate, setGjDate] = useState(todayISO());
    const [gjRef, setGjRef] = useState('');
    const [gjNote, setGjNote] = useState('');
    const [lastPosted, setLastPosted] = useState(null);
    const [recentPayments, setRecentPayments] = useState([]);
    const [recentReceipts, setRecentReceipts] = useState([]);

    const activeCustomers = useMemo(
        () => (customers || []).filter((c) => c.isActive !== false),
        [customers],
    );

    const activeSuppliers = useMemo(
        () => (suppliers || []).filter((s) => s.isActive !== false),
        [suppliers],
    );

    const reload = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [accRes, supRes] = await Promise.all([
                accountingApi.getBrandAccounts(brandId, { activeOnly: true }),
                sfApi.listStorageSuppliers(brandId).catch(() => ({ suppliers: [] })),
            ]);
            setAccounts(unwrapBrandAccounts(accRes));
            setSuppliers(Array.isArray(supRes?.suppliers) ? supRes.suppliers : []);
        } catch (e) {
            setErr(e?.message || 'Failed to load accounts');
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    const reloadRecent = useCallback(async () => {
        try {
            const [p, r] = await Promise.all([
                accountingApi.listBrandPayments(brandId, { limit: 8 }),
                accountingApi.listBrandReceipts(brandId, { limit: 8 }),
            ]);
            setRecentPayments(p?.journals ?? []);
            setRecentReceipts(r?.journals ?? []);
        } catch {
            /* ignore */
        }
    }, [brandId]);

    useEffect(() => {
        reload();
    }, [reload]);

    useEffect(() => {
        reloadRecent();
    }, [reloadRecent, lastPosted]);

    const tabBtn = (id, label, Icon) => (
        <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={tab === id ? 'sf-brand-hub-tab sf-brand-hub-tab--active' : 'sf-brand-hub-tab'}
        >
            {Icon ? <Icon size={16} /> : null}
            {label}
        </button>
    );

    return (
        <AcctCard title="Transaction entry">
            <AcctError message={err} />
            {loading ? (
                <AcctLoading />
            ) : (
                <>
                    <div className="sf-brand-hub-tabs">
                        {tabBtn('payment', 'Payments', CreditCard)}
                        {tabBtn('receipt', 'Receipts', Receipt)}
                        {tabBtn('journal', 'Journal entry', ArrowLeftRight)}
                    </div>
                    {tab === 'payment' ? (
                        <BrandPayReceiptGrid
                            brandId={brandId}
                            variant="payment"
                            accounts={accounts}
                            customers={activeCustomers}
                            suppliers={activeSuppliers}
                            onPosted={(j) => {
                                setLastPosted(j?.[j.length - 1]);
                                reloadRecent();
                            }}
                        />
                    ) : null}
                    {tab === 'receipt' ? (
                        <BrandPayReceiptGrid
                            brandId={brandId}
                            variant="receipt"
                            accounts={accounts}
                            customers={activeCustomers}
                            suppliers={activeSuppliers}
                            onPosted={(j) => {
                                setLastPosted(j?.[j.length - 1]);
                                reloadRecent();
                            }}
                        />
                    ) : null}
                    {tab === 'journal' ? (
                        <>
                            <div className="sf-hub-header-grid" style={{ marginBottom: 12 }}>
                                <Field label="Date">
                                    <input
                                        type="date"
                                        style={inputStyle}
                                        value={gjDate}
                                        onChange={(e) => setGjDate(e.target.value)}
                                    />
                                </Field>
                                <Field label="Reference">
                                    <input
                                        style={inputStyle}
                                        value={gjRef}
                                        onChange={(e) => setGjRef(e.target.value)}
                                    />
                                </Field>
                                <Field label="Note">
                                    <input
                                        style={inputStyle}
                                        value={gjNote}
                                        onChange={(e) => setGjNote(e.target.value)}
                                    />
                                </Field>
                            </div>
                            <BrandJournalGrid
                                brandId={brandId}
                                accounts={accounts}
                                headerDate={gjDate}
                                headerRef={gjRef}
                                generalNote={gjNote}
                                onPosted={(j) => {
                                    setLastPosted(j?.[0]);
                                    reloadRecent();
                                }}
                            />
                        </>
                    ) : null}
                    {lastPosted ? (
                        <p className="sf-hub-last-saved">
                            Last saved: {lastPosted.entryNumber} — {money(lastPosted.totalDebit)}
                        </p>
                    ) : null}
                    <div className="sf-hub-recent">
                        <h4>Recent payments</h4>
                        {recentPayments.length === 0 ? (
                            <AcctEmpty message="No recent payments." />
                        ) : (
                            <ul>
                                {recentPayments.map((j) => (
                                    <li key={j.id}>
                                        {j.entryNumber} · {fmtDate(j.date)} · {money(j.totalDebit)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="sf-hub-recent">
                        <h4>Recent receipts</h4>
                        {recentReceipts.length === 0 ? (
                            <AcctEmpty message="No recent receipts." />
                        ) : (
                            <ul>
                                {recentReceipts.map((j) => (
                                    <li key={j.id}>
                                        {j.entryNumber} · {fmtDate(j.date)} · {money(j.totalCredit)}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </AcctCard>
    );
}
