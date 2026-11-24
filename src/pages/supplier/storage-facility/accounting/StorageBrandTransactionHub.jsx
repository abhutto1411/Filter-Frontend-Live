import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeftRight,
    CheckCircle2,
    CreditCard,
    Loader,
    Plus,
    Receipt,
    RotateCcw,
    Trash2,
} from 'lucide-react';
import {
    useStorageFacilityAccountingApi,
    useStorageFacilityApi,
} from '../StorageFacilityPortalContext';
import { todayISO } from '../../accounting/SupplierAccountingShared';
import { useSfT } from '../useSfT';
import { money2, sfMoney, sfDate } from '../sfFormat';
import '../../../../styles/ui.css';

const PAY_TYPES = ['customer', 'supplier', 'others'];

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

/** Accounts grouped by category. The group label falls back to the raw key so
 *  a category the dictionary has not seen still reads as itself. */
function AccountSelect({ accounts, value, onChange, placeholder, label }) {
    const t = useSfT();
    const groups = useMemo(() => groupAccounts(accounts), [accounts]);
    return (
        <select
            className="ui-select ui-input--cell"
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">{placeholder ?? t('tx.selectAccount')}</option>
            {groups.map(([key, rows]) => {
                const name = t(`ldg.cat.${key}`);
                return (
                    <optgroup key={key} label={name === `ldg.cat.${key}` ? key : name}>
                        {rows.map((a) => (
                            <option key={a.id} value={a.id}>
                                [{a.code}] {a.name}
                            </option>
                        ))}
                    </optgroup>
                );
            })}
        </select>
    );
}

function PayeeCell({ row, customers, suppliers, onChange, label }) {
    const t = useSfT();
    if (row.payType === 'customer') {
        return (
            <select
                className="ui-select ui-input--cell"
                aria-label={label}
                value={row.payeeValue}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">{t('tx.selectCustomer')}</option>
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
                className="ui-select ui-input--cell"
                aria-label={label}
                value={row.payeeValue}
                onChange={(e) => onChange(e.target.value)}
            >
                <option value="">{t('tx.selectSupplier')}</option>
                {suppliers.length === 0 ? (
                    <option value="" disabled>{t('tx.noSuppliers')}</option>
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
            type="text"
            className="ui-input ui-input--cell"
            aria-label={label}
            value={row.payeeValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('tx.typePayee')}
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
    const t = useSfT();
    const accountingApi = useStorageFacilityAccountingApi();
    const leafAccounts = useMemo(
        () => (accounts || []).filter((a) => !a.hasChildren),
        [accounts],
    );
    const cashOptions = useMemo(
        () => leafAccounts.filter((a) => a.isCashEquivalent),
        [leafAccounts],
    );

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

    const updateLine = (idx, patch) => {
        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    };

    const handleTypeChange = (idx, payType) => {
        updateLine(idx, { payType, payeeValue: '', accountId: '' });
    };

    const handlePayeeChange = (idx, payeeValue, row) => {
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
    };

    const addLine = () => setLines((ls) => [...ls, emptyLine(headerDate)]);

    const handleTabFromNotes = (e, idx) => {
        if (e.key !== 'Tab' || e.shiftKey || idx !== lines.length - 1) return;
        e.preventDefault();
        addLine();
    };

    const saveAll = async (e) => {
        e.preventDefault();
        setErr('');
        if (!cashAccountId) {
            setErr(t('tx.err.noCash'));
            return;
        }
        const clean = lines.filter(isRowValid);
        if (clean.length === 0) {
            setErr(t('tx.err.noRows'));
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
            // One request per row, in order. A failure part-way through leaves
            // the earlier rows on the ledger, so say so rather than reporting a
            // flat "save failed" over entries that did go through.
            const message = ex?.message || t('tx.err.save');
            setErr(
                posted.length > 0
                    ? t('tx.err.partial', {
                          done: posted.length,
                          total: clean.length,
                          message,
                      })
                    : message,
            );
            if (posted.length > 0) {
                onPosted?.(posted);
                setLines(clean.slice(posted.length));
            }
        } finally {
            setSaving(false);
        }
    };

    const accountHeading = variant === 'payment' ? t('tx.th.accountDr') : t('tx.th.accountCr');

    return (
        <form onSubmit={saveAll} className="ui-stack">
            <p className="ui-lead">
                {variant === 'payment' ? t('tx.lead.payment') : t('tx.lead.receipt')}
            </p>

            <div className="ui-form-grid">
                <div className="ui-field ui-col-3">
                    <label htmlFor={`tx-${variant}-date`}>{t('tx.label.date')}</label>
                    <input
                        id={`tx-${variant}-date`}
                        type="date"
                        className="ui-input"
                        value={headerDate}
                        onChange={(e) => setHeaderDate(e.target.value)}
                        required
                    />
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor={`tx-${variant}-ref`}>
                        {t('tx.label.reference')}{' '}
                        <span className="ui-field-opt">{t('tx.optional')}</span>
                    </label>
                    <input
                        id={`tx-${variant}-ref`}
                        type="text"
                        className="ui-input"
                        value={headerRef}
                        onChange={(e) => setHeaderRef(e.target.value)}
                    />
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor={`tx-${variant}-note`}>
                        {t('tx.label.note')}{' '}
                        <span className="ui-field-opt">{t('tx.optional')}</span>
                    </label>
                    <input
                        id={`tx-${variant}-note`}
                        type="text"
                        className="ui-input"
                        value={generalNote}
                        onChange={(e) => setGeneralNote(e.target.value)}
                    />
                </div>
                <div className="ui-field ui-col-3">
                    <label htmlFor={`tx-${variant}-cash`}>
                        {variant === 'payment' ? t('tx.label.paidFrom') : t('tx.label.receivedInto')}
                    </label>
                    <select
                        id={`tx-${variant}-cash`}
                        className="ui-select"
                        value={cashAccountId}
                        onChange={(e) => setCashAccountId(e.target.value)}
                        required
                    >
                        <option value="">{t('tx.selectRegister')}</option>
                        {cashOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                                [{a.code}] {a.name} — {sfMoney(t, a.balance ?? 0)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('tx.th.voucher')}</th>
                            <th>{t('tx.th.date')}</th>
                            <th>{t('tx.th.type')}</th>
                            <th>{t('tx.th.payee')}</th>
                            <th>{accountHeading}</th>
                            <th className="ui-num">{t('tx.th.amount')}</th>
                            <th>{t('tx.th.ref')}</th>
                            <th>{t('tx.th.notes')}</th>
                            <th aria-label={t('tx.th.actions')} />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, idx) => (
                            <tr key={idx}>
                                <td data-label={t('tx.th.voucher')} className="ui-mono ui-nowrap">
                                    {variant === 'payment' ? 'PE' : 'RC'}
                                    {String(idx + 1).padStart(4, '0')}
                                </td>
                                <td data-label={t('tx.th.date')}>
                                    <input
                                        type="date"
                                        className="ui-input ui-input--cell"
                                        aria-label={t('tx.th.date')}
                                        value={l.lineDate || headerDate}
                                        onChange={(e) => updateLine(idx, { lineDate: e.target.value })}
                                    />
                                </td>
                                <td data-label={t('tx.th.type')}>
                                    <select
                                        className="ui-select ui-input--cell"
                                        aria-label={t('tx.th.type')}
                                        value={l.payType}
                                        onChange={(e) => handleTypeChange(idx, e.target.value)}
                                    >
                                        {PAY_TYPES.map((p) => (
                                            <option key={p} value={p}>{t(`tx.payType.${p}`)}</option>
                                        ))}
                                    </select>
                                </td>
                                <td data-label={t('tx.th.payee')}>
                                    <PayeeCell
                                        row={l}
                                        customers={customers}
                                        suppliers={suppliers}
                                        label={t('tx.th.payee')}
                                        onChange={(val) => handlePayeeChange(idx, val, l)}
                                    />
                                </td>
                                <td data-label={accountHeading}>
                                    <AccountSelect
                                        accounts={leafAccounts}
                                        value={l.accountId}
                                        label={accountHeading}
                                        onChange={(id) => updateLine(idx, { accountId: id })}
                                    />
                                </td>
                                <td data-label={t('tx.th.amount')}>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="ui-input ui-input--cell ui-input--figure"
                                        aria-label={t('tx.th.amount')}
                                        value={l.amount}
                                        onChange={(e) => updateLine(idx, { amount: e.target.value })}
                                    />
                                </td>
                                <td data-label={t('tx.th.ref')}>
                                    <input
                                        type="text"
                                        className="ui-input ui-input--cell"
                                        aria-label={t('tx.th.ref')}
                                        value={l.lineReference}
                                        onChange={(e) =>
                                            updateLine(idx, { lineReference: e.target.value })
                                        }
                                    />
                                </td>
                                <td data-label={t('tx.th.notes')}>
                                    <input
                                        type="text"
                                        className="ui-input ui-input--cell"
                                        aria-label={t('tx.th.notes')}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        onKeyDown={(e) => handleTabFromNotes(e, idx)}
                                    />
                                </td>
                                <td>
                                    <div className="ui-rowacts">
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                                            onClick={() =>
                                                setLines((ls) => ls.filter((_, i) => i !== idx))
                                            }
                                            disabled={lines.length === 1}
                                            aria-label={t('tx.removeRow')}
                                            title={t('tx.removeRow')}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {err ? (
                <div className="ui-banner ui-banner--dang">
                    <AlertTriangle size={14} />
                    <span>{err}</span>
                </div>
            ) : null}

            <div className="ui-form-foot ui-form-foot--split">
                <span className="ui-meta">
                    {t('tx.rows', { n: validCount, amount: sfMoney(t, total) })}
                </span>
                <div className="ui-row">
                    <button type="button" className="ui-btn ui-btn--default" onClick={addLine}>
                        <Plus size={14} /> {t('tx.addRow')}
                    </button>
                    <button
                        type="submit"
                        className="ui-btn ui-btn--primary"
                        disabled={saving || validCount === 0}
                    >
                        {saving ? (
                            <><Loader size={14} className="ui-spin" /> {t('tx.saving')}</>
                        ) : variant === 'payment' ? t('tx.save.payments') : t('tx.save.receipts')}
                    </button>
                </div>
            </div>
        </form>
    );
}

function BrandJournalGrid({ brandId, accounts, headerDate, headerRef, generalNote, onPosted }) {
    const t = useSfT();
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
        return {
            debit,
            credit,
            diff: debit - credit,
            balanced: Math.abs(debit - credit) < 0.01 && debit > 0,
        };
    }, [lines]);

    const updateLine = (idx, patch) => {
        setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    };

    const addLine = () => setLines((ls) => [...ls, emptyJournalLine()]);

    const onNotesKeyDown = (e, idx) => {
        if (e.key !== 'Tab' || e.shiftKey || idx !== lines.length - 1) return;
        e.preventDefault();
        addLine();
    };

    const submit = async (e) => {
        e.preventDefault();
        setErr('');
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
            setErr(ex?.message || t('tx.je.errSave'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="ui-stack">
            <div className="ui-table-wrap ui-table-wrap--scroll">
                <table className="ui-table">
                    <thead>
                        <tr>
                            <th>{t('tx.je.th.account')}</th>
                            <th className="ui-num">{t('tx.je.th.debit')}</th>
                            <th className="ui-num">{t('tx.je.th.credit')}</th>
                            <th>{t('tx.th.ref')}</th>
                            <th>{t('tx.th.notes')}</th>
                            <th aria-label={t('tx.th.actions')} />
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, idx) => (
                            <tr key={idx}>
                                <td data-label={t('tx.je.th.account')}>
                                    <AccountSelect
                                        accounts={leafAccounts}
                                        value={l.accountId}
                                        label={t('tx.je.th.account')}
                                        onChange={(id) => updateLine(idx, { accountId: id })}
                                    />
                                </td>
                                <td data-label={t('tx.je.th.debit')}>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="ui-input ui-input--cell ui-input--figure"
                                        aria-label={t('tx.je.th.debit')}
                                        value={l.debit}
                                        onChange={(e) =>
                                            updateLine(idx, { debit: e.target.value, credit: '' })
                                        }
                                    />
                                </td>
                                <td data-label={t('tx.je.th.credit')}>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="ui-input ui-input--cell ui-input--figure"
                                        aria-label={t('tx.je.th.credit')}
                                        value={l.credit}
                                        onChange={(e) =>
                                            updateLine(idx, { credit: e.target.value, debit: '' })
                                        }
                                    />
                                </td>
                                <td data-label={t('tx.th.ref')}>
                                    <input
                                        type="text"
                                        className="ui-input ui-input--cell"
                                        aria-label={t('tx.th.ref')}
                                        value={l.lineReference}
                                        onChange={(e) =>
                                            updateLine(idx, { lineReference: e.target.value })
                                        }
                                    />
                                </td>
                                <td data-label={t('tx.th.notes')}>
                                    <input
                                        type="text"
                                        className="ui-input ui-input--cell"
                                        aria-label={t('tx.th.notes')}
                                        value={l.notes}
                                        onChange={(e) => updateLine(idx, { notes: e.target.value })}
                                        onKeyDown={(e) => onNotesKeyDown(e, idx)}
                                    />
                                </td>
                                <td>
                                    <div className="ui-rowacts">
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--danger ui-btn--sm ui-btn--icon"
                                            onClick={() =>
                                                setLines((ls) => ls.filter((_, i) => i !== idx))
                                            }
                                            disabled={lines.length <= 2}
                                            aria-label={t('tx.removeRow')}
                                            title={t('tx.removeRow')}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="ui-row-sum ui-row-sum--close">
                            <td className="ui-num">{t('tx.je.totals')}</td>
                            <td className="ui-num">{sfMoney(t, totals.debit)}</td>
                            <td className="ui-num">{sfMoney(t, totals.credit)}</td>
                            <td colSpan={3} />
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Whether it ties out was only ever visible as a disabled button. */}
            <div className={`ui-banner ui-banner--${totals.balanced ? 'ok' : 'warn'}`}>
                {totals.balanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                <span>
                    {totals.balanced
                        ? t('tx.je.balanced')
                        : t('tx.je.unbalanced', {
                              amount: sfMoney(t, Math.abs(totals.diff)),
                          })}
                </span>
            </div>

            {err ? (
                <div className="ui-banner ui-banner--dang">
                    <AlertTriangle size={14} />
                    <span>{err}</span>
                </div>
            ) : null}

            <div className="ui-form-foot">
                <button type="button" className="ui-btn ui-btn--default" onClick={addLine}>
                    <Plus size={14} /> {t('tx.addRow')}
                </button>
                <button
                    type="submit"
                    className="ui-btn ui-btn--primary"
                    disabled={saving || !totals.balanced}
                >
                    {saving ? (
                        <><Loader size={14} className="ui-spin" /> {t('tx.je.saving')}</>
                    ) : t('tx.je.save')}
                </button>
            </div>
        </form>
    );
}

/** One of the two "recent" strips under the entry grid. */
function RecentStrip({ title, rows, emptyLabel, amountOf }) {
    const t = useSfT();
    return (
        <section className="ui-panel">
            <div className="ui-panel-head">
                <span className="ui-panel-title">{title}</span>
            </div>
            {rows.length === 0 ? (
                <div className="ui-empty">
                    <div className="ui-empty-sub">{emptyLabel}</div>
                </div>
            ) : (
                <div className="ui-panel-body">
                    <ul className="ui-list">
                        {rows.map((j) => (
                            <li key={j.id} className="ui-list-row">
                                <div className="ui-list-main">
                                    <span className="ui-list-title">{j.entryNumber}</span>
                                    <span className="ui-list-meta">{sfDate(j.date)}</span>
                                </div>
                                <span className="ui-list-amount">{sfMoney(t, amountOf(j))}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

export default function StorageBrandTransactionHub({ brandId, customers = [] }) {
    const t = useSfT();
    const accountingApi = useStorageFacilityAccountingApi();
    const sfApi = useStorageFacilityApi();
    const [tab, setTab] = useState('payment');
    const [accounts, setAccounts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [gjDate, setGjDate] = useState(todayISO());
    const [gjRef, setGjRef] = useState('');
    const [gjNote, setGjNote] = useState('');
    const [lastPosted, setLastPosted] = useState(null);
    const [recentPayments, setRecentPayments] = useState([]);
    const [recentReceipts, setRecentReceipts] = useState([]);
    const [reloadKey, setReloadKey] = useState(0);

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
        try {
            const [accRes, supRes] = await Promise.all([
                accountingApi.getBrandAccounts(brandId, { activeOnly: true }),
                sfApi.listStorageSuppliers(brandId).catch(() => ({ suppliers: [] })),
            ]);
            setAccounts(accountingApi.unwrapBrandAccounts(accRes));
            setSuppliers(Array.isArray(supRes?.suppliers) ? supRes.suppliers : []);
            setLoadError(false);
        } catch {
            setAccounts([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, accountingApi, sfApi]);

    const reloadRecent = useCallback(async () => {
        try {
            const [p, r] = await Promise.all([
                accountingApi.listBrandPayments(brandId, { limit: 8 }),
                accountingApi.listBrandReceipts(brandId, { limit: 8 }),
            ]);
            setRecentPayments(p?.journals ?? []);
            setRecentReceipts(r?.journals ?? []);
        } catch {
            // The strips are context, not the point of the screen; a failure
            // here leaves them as they were rather than blocking entry.
        }
    }, [brandId, accountingApi]);

    useEffect(() => {
        reload();
    }, [reload, reloadKey]);

    useEffect(() => {
        reloadRecent();
    }, [reloadRecent, lastPosted]);

    const TABS = [
        { id: 'payment', labelKey: 'tx.tab.payments', Icon: CreditCard },
        { id: 'receipt', labelKey: 'tx.tab.receipts', Icon: Receipt },
        { id: 'journal', labelKey: 'tx.tab.journal', Icon: ArrowLeftRight },
    ];

    if (loading) {
        return (
            <div className="ui-root ui-root--flush ui-stack" aria-busy="true">
                <div className="ui-sk ui-sk--title ui-sk--w40" />
                <div className="ui-form-grid">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`sk-${i}`} className="ui-field ui-col-3 ui-sk-row">
                            <div className="ui-sk ui-sk--label ui-sk--w55" />
                            <div className="ui-sk ui-sk--input" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="ui-root ui-root--flush">
                <div className="ui-empty">
                    <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                    <div className="ui-empty-title">{t('tx.errLoad')}</div>
                    <div className="ui-empty-sub">{t('tx.errSub')}</div>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={() => setReloadKey((k) => k + 1)}
                    >
                        <RotateCcw size={13} /> {t('tx.retry')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-tabs" role="tablist">
                {/* The glyph stays on the tab object: this config has no React
                    plugin, so a destructured `Icon` reads as an unused arg. */}
                {TABS.map((tb) => (
                    <button
                        key={tb.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === tb.id}
                        className="ui-tab"
                        onClick={() => setTab(tb.id)}
                    >
                        <tb.Icon size={14} /> {t(tb.labelKey)}
                    </button>
                ))}
            </div>

            {tab === 'payment' || tab === 'receipt' ? (
                <BrandPayReceiptGrid
                    key={tab}
                    brandId={brandId}
                    variant={tab}
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
                    <div className="ui-form-grid">
                        <div className="ui-field ui-col-4">
                            <label htmlFor="tx-je-date">{t('tx.label.date')}</label>
                            <input
                                id="tx-je-date"
                                type="date"
                                className="ui-input"
                                value={gjDate}
                                onChange={(e) => setGjDate(e.target.value)}
                            />
                        </div>
                        <div className="ui-field ui-col-4">
                            <label htmlFor="tx-je-ref">
                                {t('tx.label.reference')}{' '}
                                <span className="ui-field-opt">{t('tx.optional')}</span>
                            </label>
                            <input
                                id="tx-je-ref"
                                type="text"
                                className="ui-input"
                                value={gjRef}
                                onChange={(e) => setGjRef(e.target.value)}
                            />
                        </div>
                        <div className="ui-field ui-col-4">
                            <label htmlFor="tx-je-note">
                                {t('tx.label.note')}{' '}
                                <span className="ui-field-opt">{t('tx.optional')}</span>
                            </label>
                            <input
                                id="tx-je-note"
                                type="text"
                                className="ui-input"
                                value={gjNote}
                                onChange={(e) => setGjNote(e.target.value)}
                            />
                        </div>
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
                <div className="ui-banner ui-banner--ok">
                    <CheckCircle2 size={14} />
                    <span>
                        {t('tx.lastSaved', {
                            no: lastPosted.entryNumber,
                            amount: money2(lastPosted.totalDebit),
                        })}
                    </span>
                </div>
            ) : null}

            <div className="ui-panels">
                <RecentStrip
                    title={t('tx.recent.payments')}
                    rows={recentPayments}
                    emptyLabel={t('tx.recent.nonePayments')}
                    amountOf={(j) => j.totalDebit}
                />
                <RecentStrip
                    title={t('tx.recent.receipts')}
                    rows={recentReceipts}
                    emptyLabel={t('tx.recent.noneReceipts')}
                    amountOf={(j) => j.totalCredit}
                />
            </div>
        </div>
    );
}
