import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Eye, FileDown, FileSpreadsheet, FileText, Pencil, Printer, RotateCcw, Trash2 } from 'lucide-react';
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
    deletePayment as deleteAcctPayment,
    deleteReceipt as deleteAcctReceipt,
    deleteJournalEntry as deleteAcctJournal,
    reverseJournalEntry,
} from '../../../services/workshopAccountingApi';
import { useAuth } from '../../../context/AuthContext';
import {
    canShowDelete,
    canShowReverse,
    canShowVoid,
    isAccountingAdminActor,
    isForbiddenError,
    isVoidStatus,
    messageFromJournalError,
    resolveJournalIdForReverse,
} from '../../../utils/journalAuditDisplay';
import { toRiyadhDateISO } from '../../../utils/riyadhBusinessRange';
import JournalReversePanel from './JournalReversePanel';
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
    MONEY_LOG_CSS,
    cashAccountLabel,
    fmtDateYmd,
    moneySar,
    sliceLogPage,
    summarizeMoneyKpis,
} from './workshopTransactionUi';
import WsTablePagination from '../../../components/workshop/WsTablePagination';
import { PaginationControls } from '../../../components/PaginationControls';
import { TABLE_PAGE_SIZES } from '../../../hooks/usePagedRows';
import { formatRecentPayeeLabel } from '../../../utils/txEmployeePurpose';
import WsTableScroll from '../../../components/workshop/WsTableScroll';

function statusLabel(status) {
    return String(status || 'posted').replace(/_/g, ' ').toUpperCase();
}

function isVoidRow(row) {
    return isVoidStatus(row?.status);
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
    /** Mockup 25 Recent panel: Ref | Payee | Amount | Status only. */
    compact = false,
}) {
    const { user, hasPermission } = useAuth();
    const canAdmin = isAccountingAdminActor(user)
        || hasPermission('workshop.accounting.journal-entries.approve');
    const isJournal = tab === 'journals';
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [reverseId, setReverseId] = useState('');
    const [confirmAct, setConfirmAct] = useState(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [comboId, setComboId] = useState('');
    const [applied, setApplied] = useState({ dateFrom: '', dateTo: '', search: '', comboId: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(compact ? 25 : TABLE_PAGE_SIZES[0]);
    const [exporting, setExporting] = useState('');
    const [openId, setOpenId] = useState('');
    const [busyId, setBusyId] = useState('');

    useEffect(() => {
        if (compact) setPageSize(25);
    }, [compact]);

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

    const runVoid = async (row) => {
        setBusyId(String(row.id));
        setErr('');
        try {
            if (isJournal) await voidAcctJournal(row.id);
            else if (tab === 'payments') await voidAcctPayment(row.id);
            else await voidAcctReceipt(row.id);
            setConfirmAct(null);
            await load();
            onChanged?.();
        } catch (e) {
            setErr(isForbiddenError(e) ? t('gj.noPermission') : (e?.message || t('tx.log.voidErr')));
        } finally {
            setBusyId('');
        }
    };

    const runDelete = async (row) => {
        setBusyId(String(row.id));
        setErr('');
        try {
            if (isJournal) await deleteAcctJournal(row.id);
            else if (tab === 'payments') await deleteAcctPayment(row.id);
            else await deleteAcctReceipt(row.id);
            setConfirmAct(null);
            await load();
            onChanged?.();
        } catch (e) {
            const mapped = messageFromJournalError(e, 'tx.log.deleteErr');
            setErr(isForbiddenError(e) ? t('gj.noPermission') : (e?.message || t(mapped.key, mapped.vars)));
        } finally {
            setBusyId('');
        }
    };

    const runReverse = async (row, { date, reason }) => {
        const journalId = resolveJournalIdForReverse(row, isJournal);
        if (!journalId) return;
        setBusyId(String(row.id));
        setErr('');
        try {
            const res = await reverseJournalEntry(journalId, { reason, ...(date ? { date } : {}) });
            setReverseId('');
            setErr('');
            await load();
            onChanged?.(res);
        } catch (e) {
            const mapped = messageFromJournalError(e, 'gj.reverse.failed');
            setErr(isForbiddenError(e) ? t('gj.noPermission') : (e?.message || t(mapped.key, mapped.vars)));
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
        const journalId = resolveJournalIdForReverse(row, isJournal);
        const reverseRow = { ...row, id: isJournal ? row.id : journalId, source: row.source };
        const showReverse = canAdmin && journalId && canShowReverse(reverseRow);
        const showVoid = canAdmin && canShowVoid(row) && !periodClose;
        const showDelete = canShowDelete(row) && !periodClose;
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
                {showReverse ? (
                    <button
                        type="button"
                        className="ws-tx-act"
                        title={t('gj.reverse')}
                        disabled={busy}
                        onClick={() => {
                            setConfirmAct(null);
                            setReverseId(String(row.id) === reverseId ? '' : String(row.id));
                        }}
                    >
                        <RotateCcw size={14} />
                    </button>
                ) : null}
                {showVoid ? (
                    <button
                        type="button"
                        className="ws-tx-act ws-tx-act--danger"
                        title={t('tx.log.act.void')}
                        disabled={busy}
                        onClick={() => {
                            setReverseId('');
                            setConfirmAct({ type: 'void', row });
                        }}
                    >
                        <Ban size={14} />
                    </button>
                ) : null}
                {showDelete ? (
                    <button
                        type="button"
                        className="ws-tx-act ws-tx-act--danger"
                        title={t('tx.log.act.delete')}
                        disabled={busy}
                        onClick={() => {
                            setReverseId('');
                            setConfirmAct({ type: 'delete', row });
                        }}
                    >
                        <Trash2 size={14} />
                    </button>
                ) : null}
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

    if (compact) {
        const offset = (Math.max(1, paged.page) - 1) * pageSize;
        return (
            <div>
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading locale={locale} />
                ) : paged.total === 0 ? (
                    <AcctEmpty message={t('tx.recentEmpty', { tab: t('tx.recent.title') })} />
                ) : (
                    <WsTableScroll>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th className="table-th">{t('tx.recent.th.ref')}</th>
                                    <th className="table-th">{t('tx.recent.th.payee')}</th>
                                    <th className="table-th" style={{ textAlign: 'end' }}>{t('tx.recent.th.amount')}</th>
                                    <th className="table-th">{t('tx.recent.th.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.rows.map((r) => {
                                    const ref = isJournal
                                        ? (r.entryNumber || r.id)
                                        : (r.voucherNumber || r.reference || r.id);
                                    const payee = isJournal
                                        ? (r.description || em)
                                        : formatRecentPayeeLabel(r);
                                    const amount = isJournal
                                        ? moneySar(r.totalDebit || r.totalCredit || 0)
                                        : moneySar(r.amount);
                                    return (
                                        <tr
                                            key={String(r.id)}
                                            className={isVoidRow(r) ? 'ws-tx-row--void' : undefined}
                                            style={{ cursor: onEdit ? 'pointer' : 'default' }}
                                            onClick={() => handleEdit(r)}
                                        >
                                            <td className="table-cell" style={{ fontWeight: 700 }}>{ref}</td>
                                            <td className="table-cell">{payee}</td>
                                            <td className="table-cell" style={{ textAlign: 'end' }}>{amount}</td>
                                            <td className="table-cell">
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: 999,
                                                        fontSize: 12,
                                                        fontWeight: 700,
                                                        background: isVoidRow(r) ? '#FEE2E2' : '#DCFCE7',
                                                        color: isVoidRow(r) ? '#B91C1C' : '#166534',
                                                    }}
                                                >
                                                    {statusLabel(r.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </WsTableScroll>
                )}
                {!loading && paged.total > 0 ? (
                    <PaginationControls
                        total={paged.total}
                        limit={pageSize}
                        offset={offset}
                        loading={loading}
                        onPageChange={(nextOffset) => setPage(Math.floor(nextOffset / pageSize) + 1)}
                    />
                ) : null}
                <style>{MONEY_LOG_CSS}</style>
            </div>
        );
    }

    return (
        <div>
            {isJournal ? (
                <div className="ws-tx-kpis acct-kpi-grid">
                    <div className="ws-tx-kpi acct-kpi-card">
                        <span>{t('tx.kpi.jeCount')}</span>
                        <strong>{kpis.count}</strong>
                    </div>
                    <div className="ws-tx-kpi acct-kpi-card">
                        <span>{t('tx.kpi.jeDebit')}</span>
                        <strong>{moneySar(kpis.debit)}</strong>
                    </div>
                    <div className="ws-tx-kpi ws-tx-kpi--total acct-kpi-card">
                        <span>{t('tx.kpi.jeCredit')}</span>
                        <strong>{moneySar(kpis.credit)}</strong>
                    </div>
                </div>
            ) : (
                <div className="ws-tx-kpis acct-kpi-grid">
                    <div className="ws-tx-kpi acct-kpi-card">
                        <span>{tab === 'payments' ? t('tx.kpi.paidCash') : t('tx.kpi.receivedCash')}</span>
                        <strong>{moneySar(kpis.cash)}</strong>
                    </div>
                    <div className="ws-tx-kpi acct-kpi-card">
                        <span>{tab === 'payments' ? t('tx.kpi.paidBank') : t('tx.kpi.receivedBank')}</span>
                        <strong>{moneySar(kpis.bank)}</strong>
                    </div>
                    <div className="ws-tx-kpi ws-tx-kpi--total acct-kpi-card">
                        <span>{tab === 'payments' ? t('tx.kpi.paidTotal') : t('tx.kpi.receivedTotal')}</span>
                        <strong>{moneySar(kpis.total)}</strong>
                    </div>
                </div>
            )}

            <div className="ws-tx-filters acct-filter-bar">
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
                                            {open || reverseId === id || String(confirmAct?.row?.id) === id ? (
                                                <tr>
                                                    <td colSpan={7} style={{ background: '#F8FAFC', fontSize: 13 }}>
                                                        {(r.lines || []).length === 0 ? t('tx.log.noLines') : (
                                                            <table className="ws-table" style={{ width: '100%', margin: 0 }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th>{t('tx.th.account')}</th>
                                                                        <th>{t('tx.th.lineDesc')}</th>
                                                                        <th style={{ textAlign: 'end' }}>{t('tx.th.debit')}</th>
                                                                        <th style={{ textAlign: 'end' }}>{t('tx.th.credit')}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {r.lines.map((l) => (
                                                                        <tr key={l.id}>
                                                                            <td>{[l.accountCode, l.accountName].filter(Boolean).join(' — ') || em}</td>
                                                                            <td>{l.description || em}</td>
                                                                            <td style={{ textAlign: 'end' }}>{Number(l.debit) ? moneySar(l.debit) : ''}</td>
                                                                            <td style={{ textAlign: 'end' }}>{Number(l.credit) ? moneySar(l.credit) : ''}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                        {reverseId === id ? (
                                                            <JournalReversePanel
                                                                t={t}
                                                                defaultDate={toRiyadhDateISO(new Date())}
                                                                busy={busyId === id}
                                                                onConfirm={(body) => runReverse(r, body)}
                                                                onCancel={() => setReverseId('')}
                                                            />
                                                        ) : null}
                                                        {String(confirmAct?.row?.id) === id ? (
                                                            <div className="gj-reverse-panel">
                                                                <p className="gj-reverse-panel__lead">
                                                                    {confirmAct.type === 'void'
                                                                        ? t('tx.log.voidConfirm', { doc: r.entryNumber || r.id })
                                                                        : t('tx.log.deleteConfirm', { doc: r.entryNumber || r.id })}
                                                                </p>
                                                                <div className="gj-reverse-panel__actions">
                                                                    <button
                                                                        type="button"
                                                                        className="btn-submit btn-dark"
                                                                        disabled={busyId === id}
                                                                        onClick={() => (confirmAct.type === 'void' ? runVoid(r) : runDelete(r))}
                                                                    >
                                                                        {t('gj.reverse.confirm')}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-portal-outline"
                                                                        disabled={busyId === id}
                                                                        onClick={() => setConfirmAct(null)}
                                                                    >
                                                                        {t('gj.reverse.cancel')}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : null}
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
                                        {open || reverseId === id || String(confirmAct?.row?.id) === id ? (
                                            <tr>
                                                <td colSpan={10} style={{ background: '#F8FAFC', fontSize: 13, color: '#334155' }}>
                                                    {[
                                                        r.payeeType ? `${t('tx.th.type')}: ${t(`tx.payee.${r.payeeType}`) || r.payeeType}` : null,
                                                        r.branchName ? `${t('tx.branch')}: ${r.branchName}` : null,
                                                        r.generalNote ? `${t('tx.note')}: ${r.generalNote}` : null,
                                                        r.notes ? `${t('tx.th.notes')}: ${r.notes}` : null,
                                                    ].filter(Boolean).join('  ·  ') || em}
                                                    {reverseId === id ? (
                                                        <JournalReversePanel
                                                            t={t}
                                                            defaultDate={toRiyadhDateISO(new Date())}
                                                            busy={busyId === id}
                                                            onConfirm={(body) => runReverse(r, body)}
                                                            onCancel={() => setReverseId('')}
                                                        />
                                                    ) : null}
                                                    {String(confirmAct?.row?.id) === id ? (
                                                        <div className="gj-reverse-panel">
                                                            <p className="gj-reverse-panel__lead">
                                                                {confirmAct.type === 'void'
                                                                    ? t('tx.log.voidConfirm', { doc: r.voucherNumber || r.id })
                                                                    : t('tx.log.deleteConfirm', { doc: r.voucherNumber || r.id })}
                                                            </p>
                                                            <div className="gj-reverse-panel__actions">
                                                                <button
                                                                    type="button"
                                                                    className="btn-submit btn-dark"
                                                                    disabled={busyId === id}
                                                                    onClick={() => (confirmAct.type === 'void' ? runVoid(r) : runDelete(r))}
                                                                >
                                                                    {t('gj.reverse.confirm')}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn-portal-outline"
                                                                    disabled={busyId === id}
                                                                    onClick={() => setConfirmAct(null)}
                                                                >
                                                                    {t('gj.reverse.cancel')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : null}
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

            {!loading ? (
                <WsTablePagination
                    page={paged.page}
                    pageCount={paged.pages}
                    pageSize={pageSize}
                    total={paged.total}
                    onPageChange={setPage}
                    onPageSizeChange={(n) => {
                        setPageSize(n);
                        setPage(1);
                    }}
                />
            ) : null}
            <style>{MONEY_LOG_CSS}</style>
        </div>
    );
}
