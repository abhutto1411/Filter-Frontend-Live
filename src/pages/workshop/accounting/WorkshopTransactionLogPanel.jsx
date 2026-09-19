import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, FileDown, FileSpreadsheet, FileText, Pencil, Printer, RotateCcw, Trash2 } from 'lucide-react';
import {
    listPayments as listAcctPayments,
    listReceipts as listAcctReceipts,
    listJournalEntries as listAcctJournalEntries,
    getJournalEntry as getAcctJournalEntry,
    getPayment as getAcctPayment,
    getReceipt as getAcctReceipt,
    voidPayment as voidAcctPayment,
    voidReceipt as voidAcctReceipt,
    voidJournalEntry as voidAcctJournal,
    unvoidPayment as unvoidAcctPayment,
    unvoidReceipt as unvoidAcctReceipt,
    unvoidJournalEntry as unvoidAcctJournal,
} from '../../../services/workshopAccountingApi';
import {
    journalFromPayReceipt,
    printJournalVoucher,
    printPayReceiptVoucher,
} from '../../../utils/printWorkshopVoucher';
import { exportRowsToExcel, exportRowsToPdf } from '../../../utils/tableExport';
import {
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    inputStyle,
} from '../../supplier/accounting/SupplierAccountingShared';
import SupplierAccountingCombobox from '../../supplier/accounting/SupplierAccountingCombobox';
import {
    ALL_COMBO,
    DEFAULT_MONEY_PAGE_SIZE,
    MONEY_LOG_CSS,
    MONEY_PAGE_SIZES,
    cashAccountLabel,
    fmtDateYmd,
    moneySar,
    sliceLogPage,
    summarizeMoneyKpis,
} from './workshopTransactionUi';

function statusLabel(status) {
    return String(status || 'posted').replace(/_/g, ' ').toUpperCase();
}

function isVoidRow(row) {
    return String(row?.status || '').toLowerCase() === 'void';
}

export default function WorkshopTransactionLogPanel({
    tab,
    locale = 'en',
    t,
    refreshToken = 0,
    cashBankAccounts = [],
    payees = { supplier: [], employee: [], customer: [] },
    onEdit,
    onChanged,
}) {
    const isJournal = tab === 'journals';
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [comboId, setComboId] = useState('');
    const [applied, setApplied] = useState({ dateFrom: '', dateTo: '', search: '', comboId: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_MONEY_PAGE_SIZE);
    const [exporting, setExporting] = useState('');
    const [openId, setOpenId] = useState('');
    const [busyId, setBusyId] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const params = {
                limit: 500,
                ...(applied.dateFrom ? { dateFrom: applied.dateFrom } : {}),
                ...(applied.dateTo ? { dateTo: applied.dateTo } : {}),
                ...(applied.search.trim() ? { q: applied.search.trim() } : {}),
            };
            if (isJournal) {
                const res = await listAcctJournalEntries(params);
                setRows(Array.isArray(res?.entries) ? res.entries : []);
            } else {
                if (applied.comboId && tab === 'payments') {
                    params.cashBankAccountId = applied.comboId;
                }
                const res = tab === 'payments'
                    ? await listAcctPayments(params)
                    : await listAcctReceipts(params);
                let list = Array.isArray(res?.rows) ? res.rows : [];
                if (applied.comboId && tab === 'receipts') {
                    const needle = String(applied.comboId).toLowerCase();
                    list = list.filter((r) => {
                        if (r.payeeId && String(r.payeeId) === applied.comboId) return true;
                        return String(r.payeeName || '').toLowerCase() === needle
                            || String(r.payeeName || '').toLowerCase().includes(needle);
                    });
                }
                setRows(list);
            }
        } catch (e) {
            setErr(e?.message || t('tx.log.err'));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [applied, isJournal, t, tab]);

    useEffect(() => { load(); }, [load, refreshToken]);

    const comboOptions = useMemo(() => {
        const seen = new Map();
        const add = (id, label) => {
            const key = String(id || '').trim();
            if (!key || key === ALL_COMBO) return;
            if (!seen.has(key)) seen.set(key, { id: key, label: label || key, searchText: label || key });
        };
        if (tab === 'payments') {
            for (const a of cashBankAccounts) add(a.id, cashAccountLabel(a));
            for (const r of rows) {
                if (r.cashBankAccountId) add(r.cashBankAccountId, r.cashBankAccountName);
            }
        } else if (tab === 'receipts') {
            for (const list of [payees.customer, payees.supplier, payees.employee]) {
                for (const p of list || []) add(p.id, p.name);
            }
            for (const r of rows) {
                if (r.payeeName) add(r.payeeName, r.payeeName);
            }
        }
        const allLabel = tab === 'payments' ? t('tx.log.allPaidFrom') : t('tx.log.allReceivedFrom');
        return [{ id: ALL_COMBO, label: allLabel }, ...seen.values()];
    }, [cashBankAccounts, payees, rows, t, tab]);

    const kpis = useMemo(() => {
        const live = rows.filter((r) => !isVoidRow(r));
        if (isJournal) {
            const debit = live.reduce((s, r) => s + (Number(r.totalDebit) || 0), 0);
            const credit = live.reduce((s, r) => s + (Number(r.totalCredit) || 0), 0);
            return { count: live.length, debit, credit };
        }
        return summarizeMoneyKpis(live);
    }, [isJournal, rows]);

    const paged = useMemo(() => sliceLogPage(rows, page, pageSize), [rows, page, pageSize]);
    useEffect(() => {
        if (page !== paged.page) setPage(paged.page);
    }, [page, paged.page]);

    const applyFilters = () => {
        setPage(1);
        setApplied({ dateFrom, dateTo, search, comboId });
    };
    const clearFilters = () => {
        setDateFrom('');
        setDateTo('');
        setSearch('');
        setComboId('');
        setPage(1);
        setApplied({ dateFrom: '', dateTo: '', search: '', comboId: '' });
    };

    const headers = isJournal
        ? [t('tx.log.th.actions'), t('tx.log.th.date'), t('tx.log.th.entry'), t('tx.log.th.desc'), t('tx.log.th.status'), t('tx.log.th.debit'), t('tx.log.th.credit')]
        : [
            t('tx.log.th.actions'),
            t('tx.log.th.date'),
            t('tx.log.th.entry'),
            tab === 'payments' ? t('tx.log.th.paidTo') : t('tx.log.th.receivedFrom'),
            tab === 'payments' ? t('tx.log.th.against') : t('tx.log.th.against'),
            tab === 'payments' ? t('tx.log.th.paidFrom') : t('tx.log.th.receivedIn'),
            t('tx.log.th.desc'),
            t('tx.log.th.ref'),
            t('tx.log.th.status'),
            t('tx.log.th.total'),
        ];

    const handleVoid = async (row) => {
        const doc = isJournal ? (row.entryNumber || row.id) : (row.voucherNumber || row.id);
        if (!window.confirm(t('tx.log.voidConfirm', { doc }))) return;
        setBusyId(String(row.id));
        setErr('');
        try {
            if (isJournal) await voidAcctJournal(row.id);
            else if (tab === 'payments') await voidAcctPayment(row.id);
            else await voidAcctReceipt(row.id);
            await load();
            onChanged?.();
        } catch (e) {
            setErr(e?.message || t('tx.log.voidErr'));
        } finally {
            setBusyId('');
        }
    };

    const handleUnvoid = async (row) => {
        const doc = isJournal ? (row.entryNumber || row.id) : (row.voucherNumber || row.id);
        if (!window.confirm(t('tx.log.unvoidConfirm', { doc }))) return;
        setBusyId(String(row.id));
        setErr('');
        try {
            if (isJournal) await unvoidAcctJournal(row.id);
            else if (tab === 'payments') await unvoidAcctPayment(row.id);
            else await unvoidAcctReceipt(row.id);
            await load();
            onChanged?.();
        } catch (e) {
            setErr(e?.message || t('tx.log.unvoidErr'));
        } finally {
            setBusyId('');
        }
    };

    const handleEdit = (row) => {
        if (isVoidRow(row) || busyId) return;
        onEdit?.(row, tab);
    };

    const handleViewPrint = async (row) => {
        try {
            if (isJournal) {
                const full = await getAcctJournalEntry(row.id);
                printJournalVoucher(t, full?.entry || row);
                return;
            }
            const getter = tab === 'payments' ? getAcctPayment : getAcctReceipt;
            const full = await getter(row.id);
            printJournalVoucher(t, full?.journal || journalFromPayReceipt(full?.row || row, tab === 'payments' ? 'payment' : 'receipt'));
        } catch (e) {
            setErr(e?.message || t('tx.log.printErr'));
        }
    };

    const handlePartyVoucher = (row) => {
        if (isJournal) {
            printJournalVoucher(t, row);
            return;
        }
        printPayReceiptVoucher(t, row, tab === 'payments' ? 'payment' : 'receipt');
    };

    const renderActions = (row) => {
        const voided = isVoidRow(row);
        const busy = busyId === String(row.id);
        const src = String(row.source || '').toUpperCase();
        const periodClose = src === 'PERIOD_CLOSE';
        const canEdit = isJournal
            ? Boolean(row.linkedTransaction)
                || src === 'PAYMENT'
                || src === 'RECEIPT'
                || src === 'MANUAL_JE'
                || !src
            : true;
        const partyTitle = isJournal
            ? t('tx.log.act.journalVoucher')
            : tab === 'payments'
              ? t('tx.log.act.paymentVoucher')
              : t('tx.log.act.receiptVoucher');
        return (
            <td className="ws-tx-actions" onClick={(e) => e.stopPropagation()}>
                {voided ? (
                    <button
                        type="button"
                        className="ws-tx-act ws-tx-act--restore"
                        title={t('tx.log.act.unvoid')}
                        disabled={busy || periodClose}
                        onClick={() => handleUnvoid(row)}
                    >
                        <RotateCcw size={14} />
                    </button>
                ) : (
                    <button
                        type="button"
                        className="ws-tx-act ws-tx-act--danger"
                        title={t('tx.log.act.void')}
                        disabled={busy || periodClose}
                        onClick={() => handleVoid(row)}
                    >
                        <Trash2 size={14} />
                    </button>
                )}
                <button
                    type="button"
                    className="ws-tx-act"
                    title={t('tx.log.act.edit')}
                    disabled={voided || busy || !canEdit}
                    onClick={() => handleEdit(row)}
                >
                    <Pencil size={14} />
                </button>
                <button
                    type="button"
                    className="ws-tx-act"
                    title={t('tx.log.act.viewPrint')}
                    disabled={busy}
                    onClick={() => handleViewPrint(row)}
                >
                    <Eye size={14} />
                </button>
                <button
                    type="button"
                    className="ws-tx-act"
                    title={partyTitle}
                    disabled={busy}
                    onClick={() => handlePartyVoucher(row)}
                >
                    {isJournal ? <Printer size={14} /> : <FileText size={14} />}
                </button>
            </td>
        );
    };

    const exportRows = (list) => {
        if (isJournal) {
            return list.map((r) => [
                fmtDateYmd(r.date),
                r.entryNumber || '',
                r.description || '',
                statusLabel(r.status),
                Number(r.totalDebit || 0).toFixed(2),
                Number(r.totalCredit || 0).toFixed(2),
            ]);
        }
        return list.map((r) => [
            fmtDateYmd(r.date),
            r.voucherNumber || '',
            r.payeeName || '',
            [r.accountCode, r.accountName].filter(Boolean).join(' — '),
            r.cashBankAccountName || '',
            r.notes || r.generalNote || '',
            r.reference || '',
            statusLabel(r.status),
            Number(r.amount || 0).toFixed(2),
        ]);
    };

    const download = (kind) => {
        if (!rows.length || exporting) return;
        setExporting(kind);
        try {
            const title = isJournal
                ? t('tx.log.journal')
                : tab === 'payments'
                  ? t('tx.log.payments')
                  : t('tx.log.receipts');
            const payload = {
                title,
                subtitle: `${applied.dateFrom || '—'} → ${applied.dateTo || '—'} · ${rows.length}`,
                headers: headers.slice(1),
                rows: exportRows(rows),
                filenameBase: isJournal ? 'workshop-journals' : tab === 'payments' ? 'workshop-payments' : 'workshop-receipts',
            };
            if (kind === 'pdf') exportRowsToPdf(payload);
            else exportRowsToExcel({ ...payload, sheetName: title });
        } catch (e) {
            setErr(e?.message || t('tx.log.exportErr'));
        } finally {
            setExporting('');
        }
    };

    const em = '—';

    return (
        <div>
            {isJournal ? (
                <div className="ws-tx-kpis">
                    <div className="ws-tx-kpi">
                        <span>{t('tx.kpi.jeCount')}</span>
                        <strong>{kpis.count}</strong>
                    </div>
                    <div className="ws-tx-kpi">
                        <span>{t('tx.kpi.jeDebit')}</span>
                        <strong>{moneySar(kpis.debit)}</strong>
                    </div>
                    <div className="ws-tx-kpi ws-tx-kpi--total">
                        <span>{t('tx.kpi.jeCredit')}</span>
                        <strong>{moneySar(kpis.credit)}</strong>
                    </div>
                </div>
            ) : (
                <div className="ws-tx-kpis">
                    <div className="ws-tx-kpi">
                        <span>{tab === 'payments' ? t('tx.kpi.paidCash') : t('tx.kpi.receivedCash')}</span>
                        <strong>{moneySar(kpis.cash)}</strong>
                    </div>
                    <div className="ws-tx-kpi">
                        <span>{tab === 'payments' ? t('tx.kpi.paidBank') : t('tx.kpi.receivedBank')}</span>
                        <strong>{moneySar(kpis.bank)}</strong>
                    </div>
                    <div className="ws-tx-kpi ws-tx-kpi--total">
                        <span>{tab === 'payments' ? t('tx.kpi.paidTotal') : t('tx.kpi.receivedTotal')}</span>
                        <strong>{moneySar(kpis.total)}</strong>
                    </div>
                </div>
            )}

            <div className="ws-tx-filters">
                <Field label={t('tx.log.from')}>
                    <input type="date" style={inputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </Field>
                <Field label={t('tx.log.to')}>
                    <input type="date" style={inputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </Field>
                {!isJournal ? (
                    <div className="ws-tx-field ws-tx-field--combo">
                        <span>{tab === 'payments' ? t('tx.log.th.paidFrom') : t('tx.log.th.receivedFrom')}</span>
                        <SupplierAccountingCombobox
                            className="acct-table-combobox acct-filter-combobox ws-tx-combo"
                            options={comboOptions}
                            value={comboId || ALL_COMBO}
                            onChange={(id) => setComboId(id === ALL_COMBO ? '' : String(id || ''))}
                            placeholder={tab === 'payments' ? t('tx.log.allPaidFrom') : t('tx.log.allReceivedFrom')}
                            entityLabel={tab === 'payments' ? 'account' : 'party'}
                            emptyHint={t('tx.log.empty')}
                            menuMinWidth={280}
                        />
                    </div>
                ) : null}
                <Field label={t('tx.log.search')}>
                    <input
                        type="search"
                        style={inputStyle}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('tx.log.searchPh')}
                        onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
                    />
                </Field>
                <button type="button" className="btn-portal" onClick={applyFilters}>{t('tx.log.apply')}</button>
                <button type="button" className="btn-portal-outline" onClick={clearFilters}>{t('tx.log.clear')}</button>
                <button type="button" className="btn-portal-outline" onClick={() => download('pdf')} disabled={loading || !rows.length || Boolean(exporting)}>
                    <FileDown size={14} /> {exporting === 'pdf' ? t('tx.log.exporting') : t('tx.log.pdf')}
                </button>
                <button type="button" className="btn-portal-outline" onClick={() => download('xlsx')} disabled={loading || !rows.length || Boolean(exporting)}>
                    <FileSpreadsheet size={14} /> {exporting === 'xlsx' ? t('tx.log.exporting') : t('tx.log.excel')}
                </button>
            </div>

            <AcctError message={err} />
            {loading ? (
                <AcctLoading locale={locale} />
            ) : paged.total === 0 ? (
                <AcctEmpty message={t('tx.log.empty')} />
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table className="ws-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                {headers.map((h) => (
                                    <th key={h} style={h === t('tx.log.th.total') || h === t('tx.log.th.debit') || h === t('tx.log.th.credit') ? { textAlign: 'right' } : undefined}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paged.rows.map((r) => {
                                const id = String(r.id);
                                const open = openId === id;
                                if (isJournal) {
                                    return (
                                        <React.Fragment key={id}>
                                            <tr
                                                className={isVoidRow(r) ? 'ws-tx-row--void' : undefined}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => setOpenId(open ? '' : id)}
                                            >
                                                {renderActions(r)}
                                                <td>{fmtDateYmd(r.date)}</td>
                                                <td style={{ fontWeight: 700 }}>{r.entryNumber || em}</td>
                                                <td style={{ maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {r.description || em}
                                                </td>
                                                <td>{statusLabel(r.status)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{moneySar(r.totalDebit)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700 }}>{moneySar(r.totalCredit)}</td>
                                            </tr>
                                            {open ? (
                                                <tr>
                                                    <td colSpan={7} style={{ background: '#F8FAFC', fontSize: 13 }}>
                                                        {(r.lines || []).length === 0 ? t('tx.log.noLines') : (
                                                            <table className="ws-table" style={{ width: '100%', margin: 0 }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th>{t('tx.th.account')}</th>
                                                                        <th>{t('tx.th.lineDesc')}</th>
                                                                        <th style={{ textAlign: 'right' }}>{t('tx.th.debit')}</th>
                                                                        <th style={{ textAlign: 'right' }}>{t('tx.th.credit')}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {r.lines.map((l) => (
                                                                        <tr key={l.id}>
                                                                            <td>{[l.accountCode, l.accountName].filter(Boolean).join(' — ') || em}</td>
                                                                            <td>{l.description || em}</td>
                                                                            <td style={{ textAlign: 'right' }}>{Number(l.debit) ? moneySar(l.debit) : ''}</td>
                                                                            <td style={{ textAlign: 'right' }}>{Number(l.credit) ? moneySar(l.credit) : ''}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </React.Fragment>
                                    );
                                }
                                const against = [r.accountCode, r.accountName].filter(Boolean).join(' — ') || em;
                                return (
                                    <React.Fragment key={id}>
                                        <tr
                                            className={isVoidRow(r) ? 'ws-tx-row--void' : undefined}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setOpenId(open ? '' : id)}
                                        >
                                            {renderActions(r)}
                                            <td>{fmtDateYmd(r.date)}</td>
                                            <td style={{ fontWeight: 700 }}>{r.voucherNumber || em}</td>
                                            <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.payeeName || ''}>
                                                {r.payeeName || em}
                                            </td>
                                            <td style={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={against}>
                                                {against}
                                            </td>
                                            <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.cashBankAccountName || ''}>
                                                {r.cashBankAccountName || em}
                                            </td>
                                            <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {r.notes || r.generalNote || em}
                                            </td>
                                            <td>{r.reference || em}</td>
                                            <td>{statusLabel(r.status)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{moneySar(r.amount)}</td>
                                        </tr>
                                        {open ? (
                                            <tr>
                                                <td colSpan={10} style={{ background: '#F8FAFC', fontSize: 13, color: '#334155' }}>
                                                    {[
                                                        r.payeeType ? `${t('tx.th.type')}: ${t(`tx.payee.${r.payeeType}`) || r.payeeType}` : null,
                                                        r.branchName ? `${t('tx.branch')}: ${r.branchName}` : null,
                                                        r.generalNote ? `${t('tx.note')}: ${r.generalNote}` : null,
                                                        r.notes ? `${t('tx.th.notes')}: ${r.notes}` : null,
                                                    ].filter(Boolean).join('  ·  ') || em}
                                                </td>
                                            </tr>
                                        ) : null}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {paged.total > 0 ? (
                <div className="ws-tx-pager">
                    <span>{t('tx.log.pager.range', { from: paged.from, to: paged.to, total: paged.total })}</span>
                    <label>
                        {t('tx.log.pager.rows')}
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value) || DEFAULT_MONEY_PAGE_SIZE);
                                setPage(1);
                            }}
                        >
                            {MONEY_PAGE_SIZES.map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </label>
                    <span>{t('tx.log.pager.page', { page: paged.page, pages: paged.pages })}</span>
                    <button type="button" className="btn-portal-outline" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}>
                        {t('tx.log.prev')}
                    </button>
                    <button type="button" className="btn-portal-outline" disabled={paged.page >= paged.pages} onClick={() => setPage(paged.page + 1)}>
                        {t('tx.log.next')}
                    </button>
                </div>
            ) : null}
            <style>{MONEY_LOG_CSS}</style>
        </div>
    );
}
