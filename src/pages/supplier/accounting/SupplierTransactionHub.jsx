import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CreditCard, Plus, Receipt, Trash2 } from 'lucide-react';
import {
    getSupplierAccounts,
    listSupplierPayments,
    listSupplierReceipts,
    postSupplierGeneralJournal,
    unwrapSupplierAccountingList,
} from '../../../services/supplierAccountingApi';
import {
    listSupplierAffiliatedWorkshops,
    listSupplierExternalParties,
    listSupplierStaff,
    listSupplierSuperSuppliers,
} from '../../../services/supplierApi';
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
import { saccT } from '../../../utils/supplierAccountingI18n';
import { PaymentReceiptGrid, buildCustomerOptions } from './SupplierPayReceiptBulkGrid';

const TRANSACTION_HUB_RECEIPT_PREFILL_KEY = 'transactionHubReceiptPrefill';

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


function GeneralJournalGrid({ accounts, headerDate, headerRef, generalNote, onPosted, locale = 'en', t }) {
    const tr = t || ((key, vars) => saccT(locale, key, vars));
    const m = (v) => money(v, 'SAR', { locale });
    const leafAccounts = useMemo(
        () =>
            (accounts || []).filter(
                (a) =>
                    !a.hasChildren &&
                    String(a.status || 'active').toLowerCase() !== 'inactive',
            ),
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

    const customerOptions = useMemo(
        () => buildCustomerOptions(affiliatedRows, externalParties, t),
        [affiliatedRows, externalParties, t],
    );

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
