import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import VoucherRefField from '../../../components/accounting/VoucherRefField';
import {
    createPayments as createAcctPayments,
    createReceipts as createAcctReceipts,
    listPayments as listAcctPayments,
    listReceipts as listAcctReceipts,
    previewNextVouchers as previewAcctNextVouchers,
    updatePayment as updateAcctPayment,
    updateReceipt as updateAcctReceipt,
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
    mergePayeeDefaultAccountOptions,
    normalizePayeeType,
    payeesForTypeList,
    resolvePayeeComboId,
    sharedPayeeDefaultAccountId,
    suggestPayeeAccountPatch,
    todayIsoDate,
} from './workshopAccountingShared';
import { ALL_COMBO, accountComboLabel, cashAccountLabel, fmtDateYmd, moneySar } from './workshopTransactionUi';
import {
    accountById,
    controlKind,
    partyOptionsForKind,
    payeeTypeForKind,
} from './workshopControlAccounts';

function payReceiptRowFromEdit(editRow, makeBlank, payees, isPayment) {
    if (!editRow?.id) return null;
    const type = normalizePayeeType(editRow.payeeType) || (isPayment ? 'Supplier' : 'Customer');
    return {
        ...makeBlank(0, editRow.voucherNumber),
        voucher: editRow.voucherNumber || '',
        date: fmtDateYmd(editRow.date) || todayIsoDate(),
        type,
        payeeId: resolvePayeeComboId(editRow, payees),
        payeeName: editRow.payeeName || '',
        accountId: editRow.accountId ? String(editRow.accountId) : '',
        accountAutoFilled: '',
        amount: editRow.amount != null ? String(editRow.amount) : '',
        ref: editRow.reference || '',
        notes: editRow.notes || '',
    };
}

function PayeeCell({ row, payees, options: optionsOverride, onChange, t }) {
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
    const options = optionsOverride || payeesForTypeList(row.type, payees);
    return (
        <SupplierAccountingCombobox
            value={row.payeeId}
            onChange={(v) => {
                const opt = options.find((o) => String(o.id) === String(v));
                onChange(row.id, {
                    payeeId: v,
                    payeeName: opt?.name ?? '',
                    ...suggestPayeeAccountPatch(row, payees, row.type, v),
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
    defaultBranchId = '',
    isAdminHqBooks = false,
    t,
    onPosted,
    editRow = null,
    onCancelEdit,
}) {
    const isPayment = variant === 'payment';
    const prefix = isPayment ? 'PE' : 'RV';
    const makeBlank = isPayment ? blankPaymentRow : blankReceiptRow;
    const listFn = isPayment ? listAcctPayments : listAcctReceipts;
    const createFn = isPayment ? createAcctPayments : createAcctReceipts;

    const [headerDate, setHeaderDate] = useState(() => (editRow?.date ? fmtDateYmd(editRow.date) : todayIsoDate()));
    const [headerRef, setHeaderRef] = useState(() => editRow?.reference || '');
    const [refAutoGenerate, setRefAutoGenerate] = useState(false);
    const [generalNote, setGeneralNote] = useState(() => editRow?.generalNote || '');
    const [headerBranchId, setHeaderBranchId] = useState(() => (
        editRow?.branchId
            ? String(editRow.branchId)
            : defaultBranchId && defaultBranchId !== 'all'
              ? String(defaultBranchId)
              : ''
    ));
    const [cashAccountId, setCashAccountId] = useState(() => (editRow?.cashBankAccountId ? String(editRow.cashBankAccountId) : ''));
    const [voucherPool, setVoucherPool] = useState([`${prefix}0001`]);
    const [rows, setRows] = useState(() => {
        const fromEdit = payReceiptRowFromEdit(editRow, makeBlank, payees, isPayment);
        return fromEdit ? [fromEdit] : buildRowsFromVoucherPool(makeBlank, [`${prefix}0001`], 1);
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [okMsg, setOkMsg] = useState('');
    const cashTouchedRef = useRef(Boolean(editRow?.id));
    const editingIdRef = useRef(editRow?.id || null);
    editingIdRef.current = editRow?.id || null;

    const reloadVouchers = useCallback(async (count = 1) => {
        const need = Math.max(count + 3, 5);
        try {
            const res = await previewAcctNextVouchers(prefix, need);
            const pool = Array.isArray(res?.vouchers) ? res.vouchers : [];
            if (pool.length) {
                setVoucherPool(pool);
                if (!editingIdRef.current) {
                    setRows((prev) => assignVouchersFromPool(prev, pool, prefix));
                }
            }
            return pool;
        } catch {
            return voucherPool;
        }
    }, [prefix, voucherPool]);

    useEffect(() => {
        if (editingIdRef.current) return;
        reloadVouchers(1).then((pool) => {
            if (editingIdRef.current) return;
            if (pool?.length) setRows(buildRowsFromVoucherPool(makeBlank, pool, 1));
        });
        // Mount-only: seed the first voucher row.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefix]);

    useEffect(() => {
        if (!editRow?.id) return;
        cashTouchedRef.current = true;
        setHeaderDate(fmtDateYmd(editRow.date) || todayIsoDate());
        setHeaderRef(editRow.reference || '');
        setRefAutoGenerate(false);
        setGeneralNote(editRow.generalNote || '');
        setHeaderBranchId(editRow.branchId ? String(editRow.branchId) : '');
        if (editRow.cashBankAccountId) setCashAccountId(String(editRow.cashBankAccountId));
        const type = normalizePayeeType(editRow.payeeType) || (isPayment ? 'Supplier' : 'Customer');
        setRows([{
            ...makeBlank(0, editRow.voucherNumber),
            voucher: editRow.voucherNumber || '',
            date: fmtDateYmd(editRow.date) || todayIsoDate(),
            type,
            payeeId: resolvePayeeComboId(editRow, payees),
            payeeName: editRow.payeeName || '',
            accountId: editRow.accountId ? String(editRow.accountId) : '',
            accountAutoFilled: '',
            amount: editRow.amount != null ? String(editRow.amount) : '',
            ref: editRow.reference || '',
            notes: editRow.notes || '',
        }]);
        setErr('');
        setOkMsg('');
    }, [editRow?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            let next = { ...r, ...patch };
            if ('accountId' in patch && !('type' in patch)) {
                const kind = controlKind(accountById(accounts, next.accountId));
                const lockedType = payeeTypeForKind(kind);
                if (lockedType) {
                    next.type = lockedType;
                    const allowed = partyOptionsForKind(kind, payees);
                    if (!allowed.some((o) => String(o.id) === String(next.payeeId))) {
                        next.payeeId = '';
                        next.payeeName = '';
                    }
                }
            }
            if ('type' in patch) {
                const kind = controlKind(accountById(accounts, next.accountId));
                if (kind) {
                    next.type = payeeTypeForKind(kind) || next.type;
                } else {
                    next.payeeId = '';
                    next.payeeName = '';
                    const suggested = sharedPayeeDefaultAccountId(
                        payeesForTypeList(next.type, payees),
                    );
                    next.accountId = suggested;
                    next.accountAutoFilled = suggested;
                }
            }
            return next;
        }));
    };

    useEffect(() => {
        if (editingIdRef.current) return;
        setRows((prev) => prev.map((r) => {
            if (r.accountId && r.accountId !== r.accountAutoFilled) return r;
            const suggested = r.payeeId
                ? (suggestPayeeAccountPatch(
                    { ...r, accountId: r.accountAutoFilled || '' },
                    payees,
                    r.type,
                    r.payeeId,
                ).accountId || '')
                : sharedPayeeDefaultAccountId(payeesForTypeList(r.type, payees));
            if (!suggested || String(r.accountId || '') === suggested) return r;
            return { ...r, accountId: suggested, accountAutoFilled: suggested };
        }));
    }, [payees]);

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
        if (validRows.some((r) => {
            const kind = controlKind(accountById(accounts, r.accountId));
            return kind && !String(r.payeeId || '').trim();
        })) {
            setErr(t('tx.je.needParty'));
            return;
        }
        setSaving(true);
        try {
            const rowPayload = validRows.map((r) => ({
                voucherHint: r.voucher,
                date: r.date || headerDate,
                payeeType: r.type,
                payeeId: r.payeeId || undefined,
                payeeName: r.payeeName || undefined,
                accountId: r.accountId,
                amount: Number(r.amount),
                reference: r.ref?.trim() || headerRef.trim() || undefined,
                notes: r.notes || undefined,
            }));
            const header = {
                date: headerDate,
                ...(isAdminHqBooks ? {} : { branchId: headerBranchId || undefined }),
                generalNote: generalNote || undefined,
                cashBankAccountId: cashAccountId,
            };
            let res;
            if (editRow?.id) {
                const first = rowPayload[0];
                const updateFn = isPayment ? updateAcctPayment : updateAcctReceipt;
                res = await updateFn(editRow.id, {
                    ...header,
                    payeeType: first.payeeType,
                    payeeId: first.payeeId,
                    payeeName: first.payeeName,
                    accountId: first.accountId,
                    amount: first.amount,
                    reference: first.reference,
                    notes: first.notes,
                });
                setOkMsg(
                    isPayment
                        ? t('tx.ok.updatedPayment', { doc: editRow.voucherNumber || editRow.id })
                        : t('tx.ok.updatedReceipt', { doc: editRow.voucherNumber || editRow.id }),
                );
                setGeneralNote('');
                setHeaderRef('');
                setRefAutoGenerate(false);
                const pool = await reloadVouchers(1);
                setRows(buildRowsFromVoucherPool(makeBlank, pool?.length ? pool : voucherPool, 1));
                onPosted?.(res);
                onCancelEdit?.();
                return;
            }
            res = await createFn({
                ...header,
                rows: rowPayload,
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
            {editRow?.id ? (
                <div className="ws-tx-editing">
                    <span>{t('tx.editing', { doc: editRow.voucherNumber || editRow.id })}</span>
                    <button
                        type="button"
                        style={outlineBtnStyle}
                        onClick={() => {
                            onCancelEdit?.();
                            reloadVouchers(1).then((pool) => {
                                if (pool?.length) setRows(buildRowsFromVoucherPool(makeBlank, pool, 1));
                            });
                            setOkMsg('');
                            setErr('');
                        }}
                    >
                        {t('tx.cancelEdit')}
                    </button>
                </div>
            ) : null}
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
                            value={headerBranchId || ALL_COMBO}
                            onChange={(id) => setHeaderBranchId(id === ALL_COMBO ? '' : String(id || ''))}
                            placeholder={t('tx.allBranches')}
                            entityLabel="branch"
                            options={[
                                { id: ALL_COMBO, label: t('tx.allBranches'), searchText: t('tx.allBranches') },
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
                                            if (controlKind(accountById(accounts, row.accountId))) return;
                                            updateRow(row.id, { type: v });
                                        }}
                                        placeholder={t('tx.type.search')}
                                        entityLabel="type"
                                        menuMinWidth={200}
                                        options={(controlKind(accountById(accounts, row.accountId))
                                            ? [row.type]
                                            : PAYEE_TYPES
                                        ).map((p) => ({
                                            id: p,
                                            label: t(`tx.payee.${p}`),
                                            searchText: t(`tx.payee.${p}`),
                                        }))}
                                    />
                                </td>
                                <td>
                                    <PayeeCell
                                        row={row}
                                        payees={payees}
                                        options={
                                            controlKind(accountById(accounts, row.accountId))
                                                ? partyOptionsForKind(
                                                    controlKind(accountById(accounts, row.accountId)),
                                                    payees,
                                                )
                                                : undefined
                                        }
                                        onChange={updateRow}
                                        t={t}
                                    />
                                </td>
                                <td>
                                    <SupplierAccountingCombobox
                                        value={row.accountId}
                                        onChange={(v) => updateRow(row.id, { accountId: v, accountAutoFilled: '' })}
                                        placeholder={t('tx.selectAccount')}
                                        entityLabel="account"
                                        emptyHint={t('tx.selectAccount')}
                                        options={mergePayeeDefaultAccountOptions(
                                            accounts.map((a) => ({
                                                id: String(a.id),
                                                label: accountComboLabel(a),
                                                searchText: `${a.code || ''} ${a.name || ''} ${a.label || ''}`,
                                                subtitle: a.type,
                                            })),
                                            payeesForTypeList(row.type, payees),
                                        )}
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
                    <button type="button" style={outlineBtnStyle} onClick={addRow} disabled={saving || Boolean(editRow?.id)}>
                        <Plus size={14} /> {t('tx.addRow')}
                    </button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving || validRows.length === 0}>
                        {saving
                            ? t('tx.saving')
                            : editRow?.id
                              ? (isPayment ? t('tx.btn.updatePayment') : t('tx.btn.updateReceipt'))
                              : isPayment
                                ? t('tx.btn.savePayments')
                                : t('tx.btn.saveReceipts')}
                    </button>
                </div>
            </div>
        </form>
    );
}
