import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, FileDown, FileSpreadsheet, Pencil, X } from 'lucide-react';
import {
    getSupplierJournalById,
    listSupplierGeneralJournals,
    listSupplierJournalsAll,
    listSupplierPayments,
    listSupplierReceipts,
    voidSupplierJournal,
} from '../../../services/supplierAccountingApi';
import { saccT } from '../../../utils/supplierAccountingI18n';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    Field,
    fmtDate,
    inputStyle,
    JournalStatusBadge,
    money,
    outlineBtnStyle,
    Pager,
    primaryBtnStyle,
} from './SupplierAccountingShared';
import SupplierAccountingCombobox from './SupplierAccountingCombobox';
import {
    ALL_MONEY_LOG_COMBO,
    exportPayReceiptLogExcel,
    exportPayReceiptLogPdf,
    filterMoneyLogJournals,
    summarizePayReceiptLogKpis,
} from './supplierPayReceiptLogExport';

const MONEY_PAGE_SIZES = [25, 50, 100, 200];
const DEFAULT_MONEY_PAGE_SIZE = 25;

function sliceLogPage(rows, page, pageSize) {
    const list = Array.isArray(rows) ? rows : [];
    const size = Math.max(1, Number(pageSize) || DEFAULT_MONEY_PAGE_SIZE);
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / size) || 1);
    const safePage = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (safePage - 1) * size;
    return {
        rows: list.slice(start, start + size),
        page: safePage,
        pages,
        from: total === 0 ? 0 : start + 1,
        to: Math.min(start + size, total),
        total,
    };
}

const FETCHERS = {
    payments: listSupplierPayments,
    receipts: listSupplierReceipts,
    journals: listSupplierGeneralJournals,
    all: listSupplierJournalsAll,
};

const TAB_KEYS = {
    payments: 'logs.tab.payments',
    receipts: 'logs.tab.receipts',
    journals: 'logs.tab.journals',
    all: 'logs.tab.all',
};

const PAGE_SIZE = 25;

function listColumnsForTab(tab, t) {
    if (tab === 'payments') {
        return {
            counterparty: t('logs.col.paidTo'),
            ledger: t('logs.col.expenseAp'),
            cash: t('logs.col.paidFrom'),
        };
    }
    if (tab === 'receipts') {
        return {
            counterparty: t('logs.col.receivedFrom'),
            ledger: t('logs.col.against'),
            cash: t('logs.col.receivedIn'),
        };
    }
    return {
        counterparty: t('logs.col.party'),
        ledger: t('logs.col.ledger'),
        cash: t('logs.col.cash'),
    };
}

function buildMoneyLogComboOptions({ tab, accounts, partyOptions, journals, allLabel }) {
    const seen = new Map();
    const add = (id, label, searchText) => {
        const key = String(id || '').trim();
        if (!key || key === ALL_MONEY_LOG_COMBO || key === '—') return;
        if (!seen.has(key)) {
            seen.set(key, {
                id: key,
                label: label || key,
                searchText: searchText || label || key,
            });
        }
    };
    if (tab === 'payments') {
        for (const a of accounts || []) {
            if (!a?.isCashEquivalent || a.hasChildren) continue;
            if (String(a.status || 'active').toLowerCase() === 'inactive') continue;
            add(a.id, `[${a.code}] ${a.name}`, `${a.code} ${a.name}`);
        }
        for (const j of journals || []) {
            if (j.cashAccountId || j.cashAccountLabel) {
                add(j.cashAccountId || j.cashAccountLabel, j.cashAccountLabel, j.cashAccountLabel);
            }
        }
    } else {
        for (const o of partyOptions || []) {
            add(o.value ?? o.id, o.label, o.searchText || o.label);
        }
        for (const j of journals || []) {
            const keys = Array.isArray(j.counterpartyKeys) ? j.counterpartyKeys : [];
            if (keys.length) {
                keys.forEach((k) => add(k, j.counterpartyLabel, j.counterpartyLabel));
            } else if (j.counterpartyLabel && j.counterpartyLabel !== '—') {
                add(j.counterpartyLabel, j.counterpartyLabel);
            }
        }
    }
    return [{ id: ALL_MONEY_LOG_COMBO, label: allLabel }, ...seen.values()];
}

function showPaymentReceiptColumns(tab, journalType) {
    if (tab === 'payments' || tab === 'receipts') return true;
    if (tab === 'all' && (journalType === 'Payment' || journalType === 'Receipt')) {
        return true;
    }
    return false;
}

function DetailDrawer({ id, onClose, locale, t, onEdit }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [voiding, setVoiding] = useState(false);
    const em = t('emdash');
    const m = (v) => money(v, 'SAR', { locale });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await getSupplierJournalById(id);
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) setErr(e?.message || t('logs.err.detail'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id, t]);

    async function handleVoid() {
        if (!confirm(t('logs.confirm.void'))) return;
        setVoiding(true);
        try {
            await voidSupplierJournal(id);
            onClose(true);
        } catch (e) {
            alert(e?.message || t('logs.err.void'));
        } finally {
            setVoiding(false);
        }
    }

    return (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(880px, 95vw)', background: '#F8FAFC', zIndex: 1000, boxShadow: '-12px 0 32px rgba(15, 23, 42, 0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <header style={{ padding: '16px 20px', background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
                        {t('logs.detail.journalEntry')}
                    </p>
                    <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                        {data?.entryNumber || `#${id}`} — {data?.type || ''}
                    </h2>
                </div>
                <button type="button" onClick={() => onClose(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <X size={22} />
                </button>
            </header>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
                {loading ? <AcctLoading locale={locale} /> : err ? <AcctError message={err} /> : data ? (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                            <div><div style={{ fontSize: 11, color: '#64748B' }}>{t('logs.detail.date')}</div><div style={{ fontWeight: 700 }}>{fmtDate(data.date)}</div></div>
                            <div><div style={{ fontSize: 11, color: '#64748B' }}>{t('logs.detail.source')}</div><div style={{ fontWeight: 700 }}>{data.source || em}</div></div>
                            <div><div style={{ fontSize: 11, color: '#64748B' }}>{t('logs.detail.ref')}</div><div style={{ fontWeight: 700 }}>{data.reference || em}</div></div>
                        </div>
                        {data.description ? <p style={{ fontSize: 13, color: '#334155', marginBottom: 12 }}>{data.description}</p> : null}
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr><th>{t('logs.th.account')}</th><th>{t('logs.th.description')}</th><th>{t('logs.th.party')}</th><th style={{ textAlign: 'right' }}>{t('logs.th.debit')}</th><th style={{ textAlign: 'right' }}>{t('logs.th.credit')}</th></tr>
                            </thead>
                            <tbody>
                                {data.lines.map((l) => (
                                    <tr key={l.id}>
                                        <td>[{l.accountCode}] {l.accountName}</td>
                                        <td>{l.description || em}</td>
                                        <td>
                                            {l.partyDisplayName ||
                                                l.externalPartyName ||
                                                (l.partyType && l.partyId
                                                    ? `${l.partyType}#${l.partyId}`
                                                    : l.supplierProductName || em)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{Number(l.debit) > 0 ? m(l.debit) : em}</td>
                                        <td style={{ textAlign: 'right' }}>{Number(l.credit) > 0 ? m(l.credit) : em}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>{t('logs.totals')}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{m(data.totalDebit)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{m(data.totalCredit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 12, color: '#64748B' }}>
                                {t('logs.statusPrefix')}{' '}
                                <JournalStatusBadge journal={data} locale={locale} t={t} />
                            </div>
                            {data.status !== 'void' && (data.source === 'manual_journal' || data.source === 'payment' || data.source === 'receipt') ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {onEdit && (data.source === 'payment' || data.source === 'receipt' || data.source === 'manual_journal') ? (
                                        <button
                                            type="button"
                                            style={primaryBtnStyle}
                                            onClick={() => onEdit(data)}
                                        >
                                            Edit transaction
                                        </button>
                                    ) : null}
                                    <button type="button" style={outlineBtnStyle} disabled={voiding} onClick={handleVoid}>
                                        {voiding ? t('logs.voiding') : t('logs.voidEntry')}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

export function LogTab({
    tab,
    locale,
    t,
    refreshToken = 0,
    onEdit,
    accounts = [],
    partyOptions = [],
}) {
    const isMoneyLog = tab === 'payments' || tab === 'receipts';
    const [data, setData] = useState({ journals: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [offset, setOffset] = useState(0);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [comboId, setComboId] = useState('');
    const [applied, setApplied] = useState({ dateFrom: '', dateTo: '', search: '', comboId: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_MONEY_PAGE_SIZE);
    const [exporting, setExporting] = useState('');
    const [detailId, setDetailId] = useState(null);
    const em = t('emdash');
    const m = (v) => money(v, 'SAR', { locale });

    const queryFrom = isMoneyLog ? applied.dateFrom : dateFrom;
    const queryTo = isMoneyLog ? applied.dateTo : dateTo;
    const querySearch = isMoneyLog ? applied.search : search;
    const queryOffset = isMoneyLog ? 0 : offset;
    const queryLimit = isMoneyLog ? 5000 : PAGE_SIZE;

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const fn = FETCHERS[tab] || FETCHERS.all;
            const res = await fn({
                limit: queryLimit,
                offset: queryOffset,
                dateFrom: queryFrom || undefined,
                dateTo: queryTo || undefined,
                search: querySearch || undefined,
            });
            setData(res || { journals: [], total: 0 });
        } catch (e) {
            setErr(e?.message || t('logs.err.load'));
        } finally {
            setLoading(false);
        }
    }, [tab, queryFrom, queryTo, querySearch, queryOffset, queryLimit, t]);

    useEffect(() => { setOffset(0); }, [tab, dateFrom, dateTo, search]);
    useEffect(() => {
        if (isMoneyLog) setPage(1);
    }, [tab, isMoneyLog]);
    useEffect(() => { load(); }, [load, refreshToken]);

    const fetchedJournals = data.journals || [];
    const comboOptions = useMemo(
        () =>
            isMoneyLog
                ? buildMoneyLogComboOptions({
                    tab,
                    accounts,
                    partyOptions,
                    journals: fetchedJournals,
                    allLabel: tab === 'payments' ? t('logs.filter.allPaidFrom') : t('logs.filter.allReceivedFrom'),
                })
                : [],
        [isMoneyLog, tab, accounts, partyOptions, fetchedJournals, t],
    );
    const comboLabel = useMemo(
        () => comboOptions.find((o) => String(o.id) === String(applied.comboId || ALL_MONEY_LOG_COMBO))?.label || '',
        [comboOptions, applied.comboId],
    );
    const journals = useMemo(
        () =>
            isMoneyLog
                ? filterMoneyLogJournals(fetchedJournals, {
                    variant: tab === 'receipts' ? 'receipt' : 'payment',
                    comboId: applied.comboId,
                    comboLabel,
                })
                : fetchedJournals,
        [isMoneyLog, fetchedJournals, tab, applied.comboId, comboLabel],
    );
    const kpis = useMemo(
        () => (isMoneyLog ? summarizePayReceiptLogKpis(journals) : null),
        [isMoneyLog, journals],
    );
    const paged = useMemo(
        () => (isMoneyLog ? sliceLogPage(journals, page, pageSize) : null),
        [isMoneyLog, journals, page, pageSize],
    );
    useEffect(() => {
        if (paged && page !== paged.page) setPage(paged.page);
    }, [page, paged]);
    const visibleRows = isMoneyLog ? paged?.rows || [] : journals;

    const cols = listColumnsForTab(tab, t);
    const showPrCols = tab === 'payments' || tab === 'receipts' || tab === 'all';

    async function handleEditRow(e, id) {
        e.stopPropagation();
        if (!onEdit) return;
        try {
            const full = await getSupplierJournalById(id);
            onEdit(full);
        } catch (ex) {
            alert(ex?.message || t('logs.err.detail'));
        }
    }

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
    const download = (kind) => {
        if (!journals.length || exporting) return;
        setExporting(kind);
        try {
            const payload = {
                variant: tab === 'receipts' ? 'receipt' : 'payment',
                journals,
                filters: { ...applied, comboLabel },
                kpis,
            };
            if (kind === 'pdf') exportPayReceiptLogPdf(payload);
            else exportPayReceiptLogExcel(payload);
        } catch (e) {
            setErr(e?.message || t('logs.err.export'));
        } finally {
            setExporting('');
        }
    };

    return (
        <div className={isMoneyLog ? 'money-log' : undefined}>
            {isMoneyLog && kpis ? (
                <div className="money-log-kpis">
                    <div className="money-log-kpi">
                        <span>{tab === 'payments' ? t('logs.kpi.paidCash') : t('logs.kpi.receivedCash')}</span>
                        <strong>{m(kpis.cash)}</strong>
                    </div>
                    <div className="money-log-kpi">
                        <span>{tab === 'payments' ? t('logs.kpi.paidBank') : t('logs.kpi.receivedBank')}</span>
                        <strong>{m(kpis.bank)}</strong>
                    </div>
                    <div className="money-log-kpi money-log-kpi--total">
                        <span>{tab === 'payments' ? t('logs.kpi.paidTotal') : t('logs.kpi.receivedTotal')}</span>
                        <strong>{m(kpis.total)}</strong>
                    </div>
                </div>
            ) : null}
            <div className={isMoneyLog ? 'money-log-filters' : undefined} style={isMoneyLog ? undefined : { display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                <Field label={t('logs.from')}><input type="date" style={inputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
                <Field label={t('logs.to')}><input type="date" style={inputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
                {isMoneyLog ? (
                    <div className="money-log-field money-log-field--combo">
                        <span>{tab === 'payments' ? t('logs.col.paidFrom') : t('logs.col.receivedFrom')}</span>
                        <SupplierAccountingCombobox
                            className="acct-table-combobox acct-filter-combobox money-log-combo"
                            options={comboOptions}
                            value={comboId || ALL_MONEY_LOG_COMBO}
                            onChange={(id) => setComboId(id === ALL_MONEY_LOG_COMBO ? '' : String(id || ''))}
                            placeholder={tab === 'payments' ? t('logs.filter.allPaidFrom') : t('logs.filter.allReceivedFrom')}
                            entityLabel={tab === 'payments' ? 'account' : 'party'}
                            emptyHint={t('logs.empty')}
                            menuMinWidth={280}
                        />
                    </div>
                ) : null}
                <Field label={t('logs.search')}><input type="search" style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('logs.searchPh')} onKeyDown={(e) => { if (isMoneyLog && e.key === 'Enter') applyFilters(); }} /></Field>
                {isMoneyLog ? (
                    <>
                        <button type="button" className="btn-portal" onClick={applyFilters}>{t('logs.btn.apply')}</button>
                        <button type="button" className="btn-portal-outline" onClick={clearFilters}>{t('btn.clear')}</button>
                        <button type="button" className="btn-portal-outline" onClick={() => download('pdf')} disabled={loading || !journals.length || Boolean(exporting)}>
                            <FileDown size={14} /> {exporting === 'pdf' ? t('logs.exporting') : t('logs.btn.pdf')}
                        </button>
                        <button type="button" className="btn-portal-outline" onClick={() => download('xlsx')} disabled={loading || !journals.length || Boolean(exporting)}>
                            <FileSpreadsheet size={14} /> {exporting === 'xlsx' ? t('logs.exporting') : t('logs.btn.excel')}
                        </button>
                    </>
                ) : (
                    <button type="button" style={outlineBtnStyle} onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); }}>{t('btn.clear')}</button>
                )}
            </div>

            <AcctError message={err} />
            {loading ? <AcctLoading locale={locale} /> : (
                visibleRows.length === 0 ? <AcctEmpty message={t('logs.empty')} /> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>{t('logs.th.date')}</th>
                                    <th>{t('logs.th.entryNo')}</th>
                                    {tab === 'all' ? <th>{t('logs.th.type')}</th> : null}
                                    {showPrCols ? (
                                        <>
                                            <th>{cols.counterparty}</th>
                                            <th>{cols.ledger}</th>
                                            <th>{cols.cash}</th>
                                        </>
                                    ) : null}
                                    <th>{t('logs.th.description')}</th>
                                    <th>{t('logs.detail.ref')}</th>
                                    <th>{t('logs.th.status')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('logs.th.total')}</th>
                                    <th>{t('logs.th.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((j) => {
                                    const prCols = showPaymentReceiptColumns(tab, j.type);
                                    return (
                                    <tr key={j.id}>
                                        <td>{fmtDate(j.date)}</td>
                                        <td style={{ fontWeight: 700 }}>{j.entryNumber}</td>
                                        {tab === 'all' ? <td>{j.type}</td> : null}
                                        {showPrCols ? (
                                            prCols ? (
                                                <>
                                                    <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={j.counterpartyLabel || ''}>
                                                        {j.counterpartyLabel || em}
                                                    </td>
                                                    <td style={{ maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={j.ledgerAccountLabel || ''}>
                                                        {j.ledgerAccountLabel || em}
                                                    </td>
                                                    <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={j.cashAccountLabel || ''}>
                                                        {j.cashAccountLabel || em}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td>{em}</td>
                                                    <td>{em}</td>
                                                    <td>{em}</td>
                                                </>
                                            )
                                        ) : null}
                                        <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.description || em}</td>
                                        <td>{j.reference || em}</td>
                                        <td>
                                            <JournalStatusBadge journal={j} locale={locale} t={t} />
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{m(j.totalDebit)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <button type="button" style={outlineBtnStyle} onClick={() => setDetailId(j.id)}>
                                                    <Eye size={14} /> {t('logs.btn.view')}
                                                </button>
                                                {onEdit && j.status !== 'void' && (j.source === 'receipt' || j.source === 'payment' || j.source === 'manual_journal' || j.type === 'Receipt' || j.type === 'Payment') ? (
                                                    <button type="button" style={outlineBtnStyle} onClick={(e) => handleEditRow(e, j.id)}>
                                                        <Pencil size={14} /> {t('logs.btn.edit')}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            )}
            {isMoneyLog ? (
                paged && paged.total > 0 ? (
                <div className="money-log-pager">
                    <span>
                        {t('logs.pager.range', { from: paged.from, to: paged.to, total: paged.total })}
                    </span>
                    <label>
                        {t('logs.pager.rows')}
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
                    <span>{t('pager.page', { page: paged.page, pages: paged.pages, total: paged.total })}</span>
                    <button type="button" className="btn-portal-outline" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}>
                        {t('btn.prev')}
                    </button>
                    <button type="button" className="btn-portal-outline" disabled={paged.page >= paged.pages} onClick={() => setPage(paged.page + 1)}>
                        {t('btn.next')}
                    </button>
                </div>
                ) : null
            ) : (
                <Pager total={data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} locale={locale} />
            )}
            <style>{`
                .money-log-kpis {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                    margin-bottom: 14px;
                }
                .money-log-kpi {
                    min-height: 78px;
                    padding: 12px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    gap: 6px;
                }
                .money-log-kpi span {
                    font-size: 0.6875rem;
                    font-weight: 800;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    color: #64748b;
                }
                .money-log-kpi strong {
                    font-size: 1.25rem;
                    color: #0f172a;
                }
                .money-log-kpi--total {
                    background: #fff7ed;
                    border-color: #fdba74;
                }
                .money-log-filters {
                    --ml-h: 44px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    align-items: flex-end;
                    margin-bottom: 12px;
                }
                .money-log-filters label,
                .money-log-field {
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    font-size: 12px;
                    font-weight: 700;
                    color: #334155;
                }
                .money-log-field--combo {
                    min-width: 240px;
                    flex: 1 1 240px;
                    max-width: 360px;
                }
                .money-log-filters input,
                .money-log-filters .btn-portal,
                .money-log-filters .btn-portal-outline,
                .money-log-filters .money-log-combo .pi-search-box {
                    height: var(--ml-h);
                    min-height: var(--ml-h);
                    box-sizing: border-box;
                    border-radius: 10px;
                }
                .money-log-filters .btn-portal,
                .money-log-filters .btn-portal-outline {
                    padding: 0 14px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                }
                .money-log-pager {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    justify-content: center;
                    gap: 12px 16px;
                    margin-top: 16px;
                    padding: 10px 12px 28px;
                    font-size: 0.8125rem;
                    color: #64748b;
                    text-align: center;
                }
                .money-log-pager label {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .money-log-pager select {
                    height: 36px;
                    min-width: 72px;
                    padding: 0 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #fff;
                    font-weight: 600;
                }
                .money-log-pager .btn-portal-outline {
                    height: 36px;
                    min-height: 36px;
                    padding: 0 12px;
                }
                @media (max-width: 720px) {
                    .money-log-kpis { grid-template-columns: 1fr; }
                }
            `}</style>

            {detailId ? (
                <DetailDrawer
                    id={detailId}
                    locale={locale}
                    t={t}
                    onEdit={onEdit ? (journal) => {
                        setDetailId(null);
                        onEdit(journal);
                    } : undefined}
                    onClose={(refreshed) => { setDetailId(null); if (refreshed) load(); }}
                />
            ) : null}
        </div>
    );
}

export default function SupplierJournalLogs({ initialTab = 'payments', locale: localeProp }) {
    const locale =
        localeProp ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => saccT(locale, key, vars), [locale]);
    const [tab, setTab] = useState(initialTab);

    return (
        <div style={{ padding: 4 }}>
            <AcctCard
                title={t('logs.title')}
                action={(
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Object.keys(TAB_KEYS).map((k) => (
                            <button key={k} type="button" style={tab === k ? primaryBtnStyle : outlineBtnStyle} onClick={() => setTab(k)}>
                                {t(TAB_KEYS[k])}
                            </button>
                        ))}
                    </div>
                )}
            >
                <LogTab tab={tab} locale={locale} t={t} refreshToken={0} />
            </AcctCard>
        </div>
    );
}
