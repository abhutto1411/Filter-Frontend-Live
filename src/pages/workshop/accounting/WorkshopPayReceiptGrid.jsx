import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import VoucherRefField from '../../../components/accounting/VoucherRefField';
import {
    createPayments as createAcctPayments,
    createReceipts as createAcctReceipts,
    listPayments as listAcctPayments,
    listReceipts as listAcctReceipts,
    previewNextVouchers as previewAcctNextVouchers,
} from '../../../services/workshopAccountingApi';
import {
    AcctError,
    Field,
    inputStyle,
    outlineBtnStyle,
    primaryBtnStyle,
} from '../../supplier/accounting/SupplierAccountingShared';
import SupplierAccountingCombobox from '../../supplier/accounting/SupplierAccountingCombobox';
import {
    PAYEE_TYPES,
    assignVouchersFromPool,
    blankPaymentRow,
    blankReceiptRow,
    buildRowsFromVoucherPool,
    todayIsoDate,
} from './workshopAccountingShared';
import { accountComboLabel, cashAccountLabel, moneySar } from './workshopTransactionUi';

function payeesForType(type, payees) {
    if (type === 'Supplier') return payees.supplier || [];
    if (type === 'Employee') return payees.employee || [];
    if (type === 'Customer') return payees.customer || [];
    return [];
}

function suggestAccountPatch(row, payees, nextType, nextPayeeId) {
    const options = payeesForType(nextType, payees);
    const opt = options.find((o) => String(o.id) === String(nextPayeeId));
    const suggested = opt?.defaultAccountId ? String(opt.defaultAccountId) : '';
    const current = String(row.accountId || '');
    const lastAuto = String(row.accountAutoFilled || '');
    const canFill = !current || current === lastAuto;
    if (!canFill || !suggested) return {};
    return { accountId: suggested, accountAutoFilled: suggested };
}

function PayeeCell({ row, payees, onChange, t }) {
    if (row.type === 'Other') {
        return (
            <input
                style={inputStyle}
                value={row.payeeName}
                onChange={(e) => onChange(row.id, { payeeName: e.target.value, payeeId: '' })}
                placeholder={t('tx.payeeNamePh')}
            />
        );
    }
    const options = payeesForType(row.type, payees);
    return (
        <SupplierAccountingCombobox
            value={row.payeeId}
            onChange={(v) => {
                const opt = options.find((o) => String(o.id) === String(v));
                onChange(row.id, {
                    payeeId: v,
                    payeeName: opt?.name ?? '',
                    ...suggestAccountPatch(row, payees, row.type, v),
                });
            }}
            placeholder={t('tx.selectPayee', { type: t(`tx.payee.${row.type}`).toLowerCase() })}
            entityLabel="payee"
            emptyHint={t('tx.selectPayee', { type: t(`tx.payee.${row.type}`).toLowerCase() })}
            options={options.map((o) => ({
                id: String(o.id),
                label: o.sublabel ? `${o.name} — ${o.sublabel}` : o.name,
                searchText: `${o.name || ''} ${o.sublabel || ''}`,
            }))}
        />
    );
}

export default function WorkshopPayReceiptGrid({
    variant,
    cashBankAccounts = [],
    accounts = [],
    payees = { supplier: [], employee: [], customer: [] },
    branches = [],
    isAdminHqBooks = false,
    t,
    onPosted,
}) {
    const isPayment = variant === 'payment';
    const prefix = isPayment ? 'PE' : 'RV';
    const makeBlank = isPayment ? blankPaymentRow : blankReceiptRow;
    const listFn = isPayment ? listAcctPayments : listAcctReceipts;
    const createFn = isPayment ? createAcctPayments : createAcctReceipts;

    const [headerDate, setHeaderDate] = useState(todayIsoDate());
    const [headerRef, setHeaderRef] = useState('');
    const [refAutoGenerate, setRefAutoGenerate] = useState(false);
    const [generalNote, setGeneralNote] = useState('');
    const [headerBranchId, setHeaderBranchId] = useState('');
    const [cashAccountId, setCashAccountId] = useState('');
    const [voucherPool, setVoucherPool] = useState([`${prefix}0001`]);
    const [rows, setRows] = useState(() => buildRowsFromVoucherPool(makeBlank, [`${prefix}0001`], 1));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [okMsg, setOkMsg] = useState('');
    const cashTouchedRef = useRef(false);

    const reloadVouchers = useCallback(async (count = 1) => {
        const need = Math.max(count + 3, 5);
        try {
            const res = await previewAcctNextVouchers(prefix, need);
            const pool = Array.isArray(res?.vouchers) ? res.vouchers : [];
            if (pool.length) {
                setVoucherPool(pool);
                setRows((prev) => assignVouchersFromPool(prev, pool, prefix));
            }
            return pool;
        } catch {
            return voucherPool;
        }
    }, [prefix, voucherPool]);

    useEffect(() => {
        reloadVouchers(1).then((pool) => {
            if (pool?.length) setRows(buildRowsFromVoucherPool(makeBlank, pool, 1));
        });
        // Mount-only: seed the first voucher row.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefix]);

    useEffect(() => {
        if (cashTouchedRef.current) return;
        if (cashAccountId) return;
        if (cashBankAccounts[0]?.id) setCashAccountId(String(cashBankAccounts[0].id));
    }, [cashBankAccounts, cashAccountId]);

    useEffect(() => {
        if (!cashAccountId || isAdminHqBooks) return;
        const acc = cashBankAccounts.find((a) => String(a.id) === String(cashAccountId));
        if (acc?.branchId) setHeaderBranchId(String(acc.branchId));
    }, [cashAccountId, cashBankAccounts, isAdminHqBooks]);

    const fetchNextHeaderRef = useCallback(async () => {
        const res = await previewAcctNextVouchers(prefix, 1);
        return Array.isArray(res?.vouchers) ? (res.vouchers[0] || '') : '';
    }, [prefix]);

    const checkHeaderRefDuplicate = useCallback(async (reference) => {
        const ref = String(reference || '').trim();
        if (!ref) return false;
        const res = await listFn({ q: ref, limit: 20 });
        const list = Array.isArray(res?.rows) ? res.rows : [];
        return list.some(
            (r) =>
                String(r.voucherNumber || '').toLowerCase() === ref.toLowerCase()
                || String(r.reference || '').toLowerCase() === ref.toLowerCase(),
        );
    }, [listFn]);

    const updateRow = (id, patch) => {
        setRows((prev) => prev.map((r) => {
            if (r.id !== id) return r;
            const next = { ...r, ...patch };
            if ('type' in patch) {
                next.payeeId = '';
                next.payeeName = '';
                next.accountId = '';
                next.accountAutoFilled = '';
            }
            return next;
        }));
    };

    const addRow = () => {
        setRows((prev) => {
            const next = [...prev, makeBlank(prev.length, voucherPool[prev.length])];
            const need = next.length;
            if (need > voucherPool.length) {
                previewAcctNextVouchers(prefix, need + 3).then((res) => {
                    const pool = Array.isArray(res?.vouchers) ? res.vouchers : [];
                    if (pool.length) {
                        setVoucherPool(pool);
                        setRows((cur) => assignVouchersFromPool(cur, pool, prefix));
                    }
                });
            }
            queueMicrotask(() => {
                document
                    .querySelector(`[data-ws-tx-row="${variant}-${next.length}"] [data-ws-tx-focus="date"]`)
                    ?.focus?.();
            });
            return next;
        });
    };

    const removeRow = (id) => {
        setRows((prev) => {
            const next = prev.filter((r) => r.id !== id);
            const keep = next.length ? next : [makeBlank(0, voucherPool[0])];
            return assignVouchersFromPool(keep, voucherPool, prefix);
        });
    };

    const handleLastFieldKeyDown = (rowIdx, totalRows) => (e) => {
        if (e.key !== 'Tab' || e.shiftKey) return;
        if (rowIdx !== totalRows - 1) return;
        e.preventDefault();
        addRow();
    };

    const validRows = rows.filter((r) => Number(r.amount) > 0 && r.accountId);
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const effectLines = useMemo(() => {
        const cash = cashBankAccounts.find((a) => String(a.id) === String(cashAccountId));
        const cashLbl = cash ? cashAccountLabel(cash) : '—';
        return validRows.map((r) => {
            const against = accountComboLabel(accounts.find((a) => String(a.id) === String(r.accountId))) || '—';
            const party = r.payeeName ? ` · ${r.payeeName}` : '';
            const amt = moneySar(r.amount);
            return isPayment
                ? t('tx.effect.payment', { cash: cashLbl, against, amount: amt, party })
                : t('tx.effect.receipt', { cash: cashLbl, against, amount: amt, party });
        });
    }, [accounts, cashAccountId, cashBankAccounts, isPayment, t, validRows]);

    const handleSave = async (e) => {
        e.preventDefault();
        setErr('');
        setOkMsg('');
        if (!cashAccountId) {
            setErr(isPayment ? t('tx.err.paidFrom') : t('tx.err.receivedInto'));
            return;
        }
        if (!validRows.length) {
            setErr(t('tx.err.row'));
            return;
        }
        setSaving(true);
        try {
            const res = await createFn({
                date: headerDate,
                ...(isAdminHqBooks ? {} : { branchId: headerBranchId || undefined }),
                generalNote: generalNote || undefined,
                cashBankAccountId: cashAccountId,
                rows: validRows.map((r) => ({
                    voucherHint: r.voucher,
                    date: r.date || headerDate,
                    payeeType: r.type,
                    payeeId: r.payeeId || undefined,
                    payeeName: r.payeeName || undefined,
                    accountId: r.accountId,
                    amount: Number(r.amount),
                    reference: r.ref?.trim() || headerRef.trim() || undefined,
                    notes: r.notes || undefined,
                })),
            });
            setOkMsg(
                isPayment
                    ? t('tx.ok.payments', { n: res?.saved ?? validRows.length, total: Number(res?.total ?? total).toFixed(2) })
                    : t('tx.ok.receipts', { n: res?.saved ?? validRows.length, total: Number(res?.total ?? total).toFixed(2) }),
            );
            setGeneralNote('');
            setHeaderRef('');
            setRefAutoGenerate(false);
            const pool = await reloadVouchers(1);
            setRows(buildRowsFromVoucherPool(makeBlank, pool?.length ? pool : voucherPool, 1));
            onPosted?.(res);
        } catch (ex) {
            setErr(ex?.message || (isPayment ? t('tx.err.savePay') : t('tx.err.saveRcpt')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>
                {isPayment ? t('tx.hint.paymentsPage') : t('tx.hint.receiptsPage')}
            </p>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: 12,
                }}
            >
                <Field label={t('tx.date')} required>
                    <input
                        type="date"
                        style={inputStyle}
                        value={headerDate}
                        onChange={(e) => {
                            const v = e.target.value;
                            setHeaderDate(v);
                            setRows((ls) => ls.map((l, i) => (i === 0 && !l.date ? { ...l, date: v } : l)));
                        }}
                        required
                    />
                </Field>
                <VoucherRefField
                    label={t('tx.field.ref')}
                    placeholder={t('tx.field.refPh')}
                    autoGenerateLabel={t('tx.field.autoRef')}
                    generatingLabel={t('tx.field.generating')}
                    duplicateMessage={t('tx.field.refDup')}
                    value={headerRef}
                    onChange={setHeaderRef}
                    autoGenerate={refAutoGenerate}
                    onAutoGenerateChange={setRefAutoGenerate}
                    fetchNextReference={fetchNextHeaderRef}
                    checkDuplicate={checkHeaderRefDuplicate}
                />
                <Field label={t('tx.note')}>
                    <input
                        style={inputStyle}
                        value={generalNote}
                        onChange={(e) => setGeneralNote(e.target.value)}
                        placeholder={t('tx.notePh')}
                    />
                </Field>
                {!isAdminHqBooks ? (
                    <Field label={t('tx.branch')}>
                        <SupplierAccountingCombobox
                            className="acct-table-combobox acct-filter-combobox"
                            value={headerBranchId}
                            onChange={setHeaderBranchId}
                            placeholder={t('tx.allBranches')}
                            entityLabel="branch"
                            options={[
                                { id: '', label: t('tx.allBranches') },
                                ...branches.map((b) => ({ id: String(b.id), label: b.name, searchText: b.name })),
                            ]}
                        />
                    </Field>
                ) : null}
                <Field label={isPayment ? t('tx.paidFrom') : t('tx.receivedInto')} required>
                    <SupplierAccountingCombobox
                        className="acct-table-combobox acct-filter-combobox"
                        value={cashAccountId}
                        onChange={(v) => {
                            cashTouchedRef.current = true;
                            setCashAccountId(v);
                        }}
                        placeholder={isPayment ? t('tx.selectCb') : t('tx.selectDeposit')}
                        entityLabel="account"
                        required
                        options={cashBankAccounts.map((a) => ({
                            id: String(a.id),
                            label: cashAccountLabel(a),
                            searchText: `${a.name || ''} ${a.type || ''} ${a.kind || ''} locker`,
                        }))}
                    />
                </Field>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', minWidth: 1180, tableLayout: 'auto' }}>
                    <thead>
                        <tr>
                            <th style={{ width: 88 }}>{t('tx.th.voucher')}</th>
                            <th style={{ width: 130 }}>{t('tx.th.date')}</th>
                            <th style={{ minWidth: 160, width: 180 }}>{t('tx.th.type')}</th>
                            <th style={{ minWidth: 220 }}>
                                {isPayment ? t('tx.th.payeeTo') : t('tx.th.receivedFrom')}
                            </th>
                            <th style={{ minWidth: 220 }}>
                                {isPayment ? t('tx.th.accountDr') : t('tx.th.accountCr')}
                            </th>
                            <th style={{ width: 120, textAlign: 'right' }}>{t('tx.th.amount')}</th>
                            <th style={{ width: 110 }}>{t('tx.th.ref')}</th>
                            <th style={{ minWidth: 140 }}>{t('tx.th.notes')}</th>
                            <th style={{ width: 44 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={row.id} data-ws-tx-row={`${variant}-${idx + 1}`}>
                                <td>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            padding: '4px 8px',
                                            borderRadius: 8,
                                            background: isPayment ? '#FEE2E2' : '#E0F2FE',
                                            color: isPayment ? '#B91C1C' : '#0369A1',
                                            fontWeight: 800,
                                            fontSize: 12,
                                        }}
                                    >
                                        {row.voucher || `${prefix}${String(idx + 1).padStart(4, '0')}`}
                                    </span>
                                </td>
                                <td>
                                    <input
                                        data-ws-tx-focus="date"
                                        type="date"
                                        style={inputStyle}
                                        value={row.date || headerDate}
                                        onChange={(e) => updateRow(row.id, { date: e.target.value })}
                                    />
                                </td>
                                <td>
                                    <SupplierAccountingCombobox
                                        className="acct-table-combobox acct-combo-type"
                                        value={row.type}
                                        onChange={(v) => {
                                            if (!PAYEE_TYPES.includes(v)) return;
                                            updateRow(row.id, { type: v });
                                        }}
                                        placeholder={t('tx.type.search')}
                                        entityLabel="type"
                                        menuMinWidth={200}
                                        options={PAYEE_TYPES.map((p) => ({
                                            id: p,
                                            label: t(`tx.payee.${p}`),
                                            searchText: t(`tx.payee.${p}`),
                                        }))}
                                    />
                                </td>
                                <td>
                                    <PayeeCell row={row} payees={payees} onChange={updateRow} t={t} />
                                </td>
                                <td>
                                    <SupplierAccountingCombobox
                                        value={row.accountId}
                                        onChange={(v) => updateRow(row.id, { accountId: v, accountAutoFilled: '' })}
                                        placeholder={t('tx.selectAccount')}
                                        entityLabel="account"
                                        emptyHint={t('tx.selectAccount')}
                                        options={accounts.map((a) => ({
                                            id: String(a.id),
                                            label: accountComboLabel(a),
                                            searchText: `${a.code || ''} ${a.name || ''} ${a.label || ''}`,
                                            subtitle: a.type,
                                        }))}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={row.amount}
                                        onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={row.ref}
                                        onChange={(e) => updateRow(row.id, { ref: e.target.value })}
                                        placeholder={t('tx.refPh')}
                                    />
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={row.notes}
                                        onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                                        placeholder={t('tx.notesPh')}
                                        onKeyDown={handleLastFieldKeyDown(idx, rows.length)}
                                    />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        style={{ ...outlineBtnStyle, color: '#B91C1C', borderColor: '#FECACA' }}
                                        onClick={() => removeRow(row.id)}
                                        disabled={rows.length === 1}
                                        title={t('tx.deleteRow')}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {effectLines.length > 0 ? (
                <div
                    style={{
                        padding: '10px 12px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#0F172A',
                        lineHeight: 1.55,
                    }}
                >
                    {effectLines.map((text, i) => (
                        <div key={i} style={{ fontWeight: 600 }}>{text}</div>
                    ))}
                </div>
            ) : null}

            {(err || okMsg) && (
                <div>
                    <AcctError message={err} />
                    {okMsg ? (
                        <div style={{ padding: 12, background: '#ECFDF5', color: '#047857', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
                            {okMsg}
                        </div>
                    ) : null}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                    {t(validRows.length === 1 ? 'tx.validRow' : 'tx.validRowsN', {
                        count: validRows.length,
                        amount: moneySar(total),
                    })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} onClick={addRow} disabled={saving}>
                        <Plus size={14} /> {t('tx.addRow')}
                    </button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving || validRows.length === 0}>
                        {saving
                            ? t('tx.saving')
                            : isPayment
                              ? t('tx.btn.savePayments')
                              : t('tx.btn.saveReceipts')}
                    </button>
                </div>
            </div>
        </form>
    );
}
