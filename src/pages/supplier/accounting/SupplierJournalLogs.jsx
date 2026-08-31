import React, { useCallback, useEffect, useState } from 'react';
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
    money,
    outlineBtnStyle,
    Pager,
    primaryBtnStyle,
} from './SupplierAccountingShared';
import { X } from 'lucide-react';

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

function showPaymentReceiptColumns(tab, journalType) {
    if (tab === 'payments' || tab === 'receipts') return true;
    if (tab === 'all' && (journalType === 'Payment' || journalType === 'Receipt')) {
        return true;
    }
    return false;
}

function DetailDrawer({ id, onClose, locale, t }) {
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
                            <span style={{ fontSize: 12, color: '#64748B' }}>
                                {t('logs.statusPrefix')} <strong style={{ color: data.status === 'void' ? '#B91C1C' : '#065F46' }}>{data.status}</strong>
                            </span>
                            {data.status !== 'void' && (data.source === 'manual_journal' || data.source === 'payment' || data.source === 'receipt') ? (
                                <button type="button" style={outlineBtnStyle} disabled={voiding} onClick={handleVoid}>
                                    {voiding ? t('logs.voiding') : t('logs.voidEntry')}
                                </button>
                            ) : null}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

function LogTab({ tab, locale, t }) {
    const [data, setData] = useState({ journals: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [offset, setOffset] = useState(0);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [detailId, setDetailId] = useState(null);
    const em = t('emdash');
    const m = (v) => money(v, 'SAR', { locale });

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const fn = FETCHERS[tab] || FETCHERS.all;
            const res = await fn({ limit: PAGE_SIZE, offset, dateFrom, dateTo, search });
            setData(res || { journals: [], total: 0 });
        } catch (e) {
            setErr(e?.message || t('logs.err.load'));
        } finally {
            setLoading(false);
        }
    }, [tab, offset, dateFrom, dateTo, search, t]);

    useEffect(() => { setOffset(0); }, [tab, dateFrom, dateTo, search]);
    useEffect(() => { load(); }, [load]);

    const cols = listColumnsForTab(tab, t);
    const showPrCols = tab === 'payments' || tab === 'receipts' || tab === 'all';

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                <Field label={t('logs.from')}><input type="date" style={inputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
                <Field label={t('logs.to')}><input type="date" style={inputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
                <Field label={t('logs.search')}><input type="search" style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('logs.searchPh')} /></Field>
                <button type="button" style={outlineBtnStyle} onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); }}>{t('btn.clear')}</button>
            </div>

            <AcctError message={err} />
            {loading ? <AcctLoading locale={locale} /> : (
                data.journals.length === 0 ? <AcctEmpty message={t('logs.empty')} /> : (
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
                                </tr>
                            </thead>
                            <tbody>
                                {data.journals.map((j) => {
                                    const prCols = showPaymentReceiptColumns(tab, j.type);
                                    return (
                                    <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(j.id)}>
                                        <td>{fmtDate(j.date)}</td>
                                        <td style={{ fontWeight: 700, color: '#1D4ED8' }}>{j.entryNumber}</td>
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
                                            <span className={`ws-badge ${j.status === 'void' ? 'ws-badge--red' : 'ws-badge--green'}`}>
                                                {j.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{m(j.totalDebit)}</td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )
            )}
            <Pager total={data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} locale={locale} />

            {detailId ? <DetailDrawer id={detailId} locale={locale} t={t} onClose={(refreshed) => { setDetailId(null); if (refreshed) load(); }} /> : null}
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
                <LogTab tab={tab} locale={locale} t={t} />
            </AcctCard>
        </div>
    );
}
