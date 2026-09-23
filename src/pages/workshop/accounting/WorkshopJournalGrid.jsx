import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createJournalEntry as createAcctJournalEntry, updateJournalEntry as updateAcctJournalEntry } from '../../../services/workshopAccountingApi';
import {
    AcctError,
    Field,
    inputStyle,
    outlineBtnStyle,
    primaryBtnStyle,
} from '../../supplier/accounting/SupplierAccountingShared';
import SupplierAccountingCombobox from '../../supplier/accounting/SupplierAccountingCombobox';
import { blankJournalRow, todayIsoDate } from './workshopAccountingShared';
import { ALL_COMBO, accountComboLabel, fmtDateYmd, moneySar } from './workshopTransactionUi';
import { ledgerRowDescriptionAndReference } from '../../../utils/accountLedgerStatementUtils';
import {
    accountById,
    controlKind,
    partyOptionsForKind,
    partyPayloadFromKind,
    payeeIdFromJournalLine,
    payeeTypeForKind,
} from './workshopControlAccounts';

export default function WorkshopJournalGrid({
    accounts = [],
    payees = { supplier: [], employee: [], customer: [] },
    branches = [],
    defaultBranchId = '',
    isAdminHqBooks = false,
    t,
    onPosted,
    editEntry = null,
    onCancelEdit,
}) {
    const [headerDate, setHeaderDate] = useState(todayIsoDate());
    const [headerRef, setHeaderRef] = useState('');
    const [headerBranchId, setHeaderBranchId] = useState(
        defaultBranchId && defaultBranchId !== 'all' ? String(defaultBranchId) : '',
    );
    const [journalMemo, setJournalMemo] = useState('');
    const [rows, setRows] = useState(() => [blankJournalRow(0), blankJournalRow(1)]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [okMsg, setOkMsg] = useState('');

    useEffect(() => {
        if (!editEntry?.id) return;
        setHeaderDate(fmtDateYmd(editEntry.date) || todayIsoDate());
        const parsed = ledgerRowDescriptionAndReference({ description: editEntry.description });
        setHeaderRef(parsed.reference || '');
        setHeaderBranchId(editEntry.branchId ? String(editEntry.branchId) : '');
        setJournalMemo(parsed.description && parsed.description !== '—' ? parsed.description : '');
        const lines = Array.isArray(editEntry.lines) && editEntry.lines.length
            ? editEntry.lines.map((l, i) => ({
                id: `j-edit-${l.id || i}`,
                accountId: l.accountId ? String(l.accountId) : '',
                payeeId: payeeIdFromJournalLine(l),
                description: l.description || '',
                debit: Number(l.debit) ? String(l.debit) : '',
                credit: Number(l.credit) ? String(l.credit) : '',
            }))
            : [blankJournalRow(0), blankJournalRow(1)];
        while (lines.length < 2) lines.push(blankJournalRow(lines.length));
        setRows(lines);
        setErr('');
        setOkMsg('');
    }, [editEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateRow = (id, patch) => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    const addRow = () => {
        setRows((prev) => {
            const next = [...prev, blankJournalRow(prev.length)];
            queueMicrotask(() => {
                document
                    .querySelector(`[data-ws-je-row="${next.length}"] [data-ws-je-focus="account"] input`)
                    ?.focus?.();
            });
            return next;
        });
    };

    const removeRow = (id) => {
        setRows((prev) => {
            const next = prev.filter((r) => r.id !== id);
            return next.length >= 2 ? next : [blankJournalRow(0), blankJournalRow(1)];
        });
    };

    const handleLastFieldKeyDown = (rowIdx, totalRows) => (e) => {
        if (e.key !== 'Tab' || e.shiftKey) return;
        if (rowIdx !== totalRows - 1) return;
        e.preventDefault();
        addRow();
    };

    const totals = useMemo(() => {
        const debit = rows.reduce((sum, row) => sum + (parseFloat(row.debit) || 0), 0);
        const credit = rows.reduce((sum, row) => sum + (parseFloat(row.credit) || 0), 0);
        const isBalanced = Math.abs(debit - credit) < 0.005;
        return {
            debit,
            credit,
            isBalanced,
            canPost: isBalanced && debit > 0,
        };
    }, [rows]);

    const handlePost = async (e) => {
        e.preventDefault();
        setErr('');
        setOkMsg('');
        const lines = rows.filter((r) => r.accountId && (Number(r.debit) > 0 || Number(r.credit) > 0));
        if (lines.length < 2) {
            setErr(t('tx.err.jeLines'));
            return;
        }
        const missingParty = lines.find((l) => {
            const kind = controlKind(accountById(accounts, l.accountId));
            return kind && !String(l.payeeId || '').trim();
        });
        if (missingParty) {
            setErr(t('tx.je.needParty'));
            return;
        }
        if (!totals.canPost) {
            setErr(t('tx.err.jeBalance', {
                debit: totals.debit.toFixed(2),
                credit: totals.credit.toFixed(2),
            }));
            return;
        }
        setSaving(true);
        try {
            const payload = {
                date: headerDate,
                ...(isAdminHqBooks ? {} : { branchId: headerBranchId || undefined }),
                description: journalMemo.trim() || undefined,
                ...(headerRef.trim() ? { reference: headerRef.trim() } : {}),
                lines: lines.map((l) => ({
                    accountId: l.accountId,
                    description: l.description || undefined,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                    ...partyPayloadFromKind(
                        controlKind(accountById(accounts, l.accountId)),
                        l.payeeId,
                    ),
                })),
            };
            const res = editEntry?.id
                ? await updateAcctJournalEntry(editEntry.id, payload)
                : await createAcctJournalEntry(payload);
            if (editEntry?.id) {
                setOkMsg(t('tx.ok.updatedJournal', { doc: editEntry.entryNumber || editEntry.id }));
                setRows([blankJournalRow(0), blankJournalRow(1)]);
                setJournalMemo('');
                setHeaderRef('');
                onPosted?.(res);
                onCancelEdit?.();
                return;
            }
            setRows([blankJournalRow(0), blankJournalRow(1)]);
            setJournalMemo('');
            setHeaderRef('');
            setOkMsg(t('tx.ok.journal', {
                code: res?.entry?.entryNumber || t('tx.tab.journal'),
                dr: res?.entry?.totalDebit?.toFixed?.(2) ?? totals.debit.toFixed(2),
                cr: res?.entry?.totalCredit?.toFixed?.(2) ?? totals.credit.toFixed(2),
            }));
            onPosted?.(res);
        } catch (ex) {
            setErr(ex?.message || t('tx.err.postJe'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {editEntry?.id ? (
                <div className="ws-tx-editing">
                    <span>{t('tx.editing', { doc: editEntry.entryNumber || editEntry.id })}</span>
                    <button
                        type="button"
                        style={outlineBtnStyle}
                        onClick={() => {
                            onCancelEdit?.();
                            setRows([blankJournalRow(0), blankJournalRow(1)]);
                            setJournalMemo('');
                            setHeaderRef('');
                            setOkMsg('');
                            setErr('');
                        }}
                    >
                        {t('tx.cancelEdit')}
                    </button>
                </div>
            ) : null}
            <p style={{ margin: 0, fontSize: 12, color: '#64748B', lineHeight: 1.45 }}>
                {t('tx.hint.journalPage')}
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
                        onChange={(e) => setHeaderDate(e.target.value)}
                        required
                    />
                </Field>
                <Field label={t('tx.field.ref')}>
                    <input
                        style={inputStyle}
                        value={headerRef}
                        onChange={(e) => setHeaderRef(e.target.value)}
                        placeholder={t('tx.field.refPh')}
                    />
                </Field>
                <Field label={t('tx.je.memo')}>
                    <input
                        style={inputStyle}
                        value={journalMemo}
                        onChange={(e) => setJournalMemo(e.target.value)}
                        placeholder={t('tx.je.memoPh')}
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
            </div>

            <div style={{ fontSize: 12, color: '#64748B' }}>
                {totals.isBalanced
                    ? t('tx.je.balanced')
                    : t('tx.je.diff', { n: (totals.debit - totals.credit).toFixed(2) })}
                {' · '}
                {t('tx.je.tabHelp')}
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table className="ws-table" style={{ width: '100%', minWidth: 1080 }}>
                    <thead>
                        <tr>
                            <th style={{ minWidth: 260 }}>{t('tx.th.account')}</th>
                            <th style={{ minWidth: 220 }}>{t('tx.th.party')}</th>
                            <th>{t('tx.th.lineDesc')}</th>
                            <th style={{ width: 140, textAlign: 'right' }}>{t('tx.th.debit')}</th>
                            <th style={{ width: 140, textAlign: 'right' }}>{t('tx.th.credit')}</th>
                            <th style={{ width: 44 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => {
                            const kind = controlKind(accountById(accounts, row.accountId));
                            const partyOpts = partyOptionsForKind(kind, payees);
                            const partyType = payeeTypeForKind(kind);
                            return (
                            <tr key={row.id} data-ws-je-row={idx + 1}>
                                <td data-ws-je-focus="account">
                                    <SupplierAccountingCombobox
                                        value={row.accountId}
                                        onChange={(v) => updateRow(row.id, { accountId: v, payeeId: '' })}
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
                                    {kind ? (
                                        <SupplierAccountingCombobox
                                            value={row.payeeId}
                                            onChange={(v) => updateRow(row.id, { payeeId: v })}
                                            placeholder={partyType === 'Supplier' ? t('tx.selectSupplier') : t('tx.selectCustomer')}
                                            entityLabel={partyType === 'Supplier' ? 'supplier' : 'customer'}
                                            emptyHint={partyType === 'Supplier' ? t('tx.selectSupplier') : t('tx.selectCustomer')}
                                            options={partyOpts.map((o) => ({
                                                id: String(o.id),
                                                label: o.sublabel ? `${o.name} — ${o.sublabel}` : o.name,
                                                searchText: `${o.name || ''} ${o.sublabel || ''}`,
                                            }))}
                                        />
                                    ) : (
                                        <span style={{ color: '#94A3B8' }}>{t('emdash') || '—'}</span>
                                    )}
                                </td>
                                <td>
                                    <input
                                        style={inputStyle}
                                        value={row.description}
                                        onChange={(e) => updateRow(row.id, { description: e.target.value })}
                                        placeholder={t('tx.lineDescPh')}
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={row.debit}
                                        onChange={(e) => updateRow(row.id, {
                                            debit: e.target.value,
                                            credit: e.target.value ? '' : row.credit,
                                        })}
                                        placeholder="0.00"
                                    />
                                </td>
                                <td>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                        value={row.credit}
                                        onChange={(e) => updateRow(row.id, {
                                            credit: e.target.value,
                                            debit: e.target.value ? '' : row.debit,
                                        })}
                                        placeholder="0.00"
                                        onKeyDown={handleLastFieldKeyDown(idx, rows.length)}
                                    />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        style={{ ...outlineBtnStyle, color: '#B91C1C', borderColor: '#FECACA' }}
                                        onClick={() => removeRow(row.id)}
                                        disabled={rows.length <= 2}
                                        title={t('tx.deleteRow')}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                            );
                        })}
                        <tr>
                            <td colSpan={3} style={{ fontWeight: 800 }}>{t('tx.totals')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{moneySar(totals.debit)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 800 }}>{moneySar(totals.credit)}</td>
                            <td />
                        </tr>
                    </tbody>
                </table>
            </div>

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
                    {totals.isBalanced
                        ? t('tx.balancedAmt', { n: totals.debit.toFixed(2) })
                        : t('tx.unbalanced', { dr: totals.debit.toFixed(2), cr: totals.credit.toFixed(2) })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={outlineBtnStyle} onClick={addRow} disabled={saving}>
                        <Plus size={14} /> {t('tx.addRow')}
                    </button>
                    <button type="submit" style={primaryBtnStyle} disabled={saving || !totals.canPost}>
                        {saving ? t('tx.saving') : editEntry?.id ? t('tx.btn.updateJournal') : t('tx.postJe')}
                    </button>
                </div>
            </div>
        </form>
    );
}
