import React, { useCallback, useEffect, useState } from 'react';
import {
    getSupplierJournalById,
    listSupplierGeneralJournals,
    listSupplierJournalsAll,
    listSupplierPayments,
    listSupplierReceipts,
    voidSupplierJournal,
} from '../../../services/supplierAccountingApi';
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

const TAB_LABELS = {
    payments: 'Payments',
    receipts: 'Receipts',
    journals: 'General Journal',
    all: 'All Entries',
};

const PAGE_SIZE = 25;

function DetailDrawer({ id, onClose }) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [voiding, setVoiding] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErr('');
            try {
                const res = await getSupplierJournalById(id);
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) setErr(e?.message || 'Failed to load entry');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    async function handleVoid() {
        if (!confirm('Void this entry? This marks it as void; balances remove the journal lines.')) return;
        setVoiding(true);
        try {
            await voidSupplierJournal(id);
            onClose(true);
        } catch (e) {
            alert(e?.message || 'Void failed');
        } finally {
            setVoiding(false);
        }
    }

    return (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(880px, 95vw)', background: '#F8FAFC', zIndex: 1000, boxShadow: '-12px 0 32px rgba(15, 23, 42, 0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <header style={{ padding: '16px 20px', background: '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ margin: 0, fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
                        Journal Entry
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
                {loading ? <AcctLoading /> : err ? <AcctError message={err} /> : data ? (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                            <div><div style={{ fontSize: 11, color: '#64748B' }}>Date</div><div style={{ fontWeight: 700 }}>{fmtDate(data.date)}</div></div>
                            <div><div style={{ fontSize: 11, color: '#64748B' }}>Source</div><div style={{ fontWeight: 700 }}>{data.source || '—'}</div></div>
                            <div><div style={{ fontSize: 11, color: '#64748B' }}>Reference</div><div style={{ fontWeight: 700 }}>{data.reference || '—'}</div></div>
                        </div>
                        {data.description ? <p style={{ fontSize: 13, color: '#334155', marginBottom: 12 }}>{data.description}</p> : null}
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr><th>Account</th><th>Description</th><th>Party</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th></tr>
                            </thead>
                            <tbody>
                                {data.lines.map((l) => (
                                    <tr key={l.id}>
                                        <td>[{l.accountCode}] {l.accountName}</td>
                                        <td>{l.description || '—'}</td>
                                        <td>
                                            {l.externalPartyName ||
                                                (l.partyType && l.partyId ? `${l.partyType}#${l.partyId}` : l.supplierProductName || '—')}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{Number(l.debit) > 0 ? money(l.debit) : '—'}</td>
                                        <td style={{ textAlign: 'right' }}>{Number(l.credit) > 0 ? money(l.credit) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>Totals</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(data.totalDebit)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{money(data.totalCredit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#64748B' }}>
                                Status: <strong style={{ color: data.status === 'void' ? '#B91C1C' : '#065F46' }}>{data.status}</strong>
                            </span>
                            {data.status !== 'void' && (data.source === 'manual_journal' || data.source === 'payment' || data.source === 'receipt') ? (
                                <button type="button" style={outlineBtnStyle} disabled={voiding} onClick={handleVoid}>
                                    {voiding ? 'Voiding…' : 'Void entry'}
                                </button>
                            ) : null}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

function LogTab({ tab }) {
    const [data, setData] = useState({ journals: [], total: 0 });
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [offset, setOffset] = useState(0);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [search, setSearch] = useState('');
    const [detailId, setDetailId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const fn = FETCHERS[tab] || FETCHERS.all;
            const res = await fn({ limit: PAGE_SIZE, offset, dateFrom, dateTo, search });
            setData(res || { journals: [], total: 0 });
        } catch (e) {
            setErr(e?.message || 'Failed to load entries');
        } finally {
            setLoading(false);
        }
    }, [tab, offset, dateFrom, dateTo, search]);

    useEffect(() => { setOffset(0); }, [tab, dateFrom, dateTo, search]);
    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
                <Field label="From"><input type="date" style={inputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
                <Field label="To"><input type="date" style={inputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
                <Field label="Search"><input type="search" style={inputStyle} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Entry # / ref" /></Field>
                <button type="button" style={outlineBtnStyle} onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); }}>Clear</button>
            </div>

            <AcctError message={err} />
            {loading ? <AcctLoading /> : (
                data.journals.length === 0 ? <AcctEmpty message="No entries match these filters." /> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Entry #</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th>Reference</th>
                                    <th>Source</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.journals.map((j) => (
                                    <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(j.id)}>
                                        <td>{fmtDate(j.date)}</td>
                                        <td style={{ fontWeight: 700, color: '#1D4ED8' }}>{j.entryNumber}</td>
                                        <td>{j.type}</td>
                                        <td style={{ maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.description || '—'}</td>
                                        <td>{j.reference || '—'}</td>
                                        <td>{j.source || '—'}</td>
                                        <td>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                background: j.status === 'void' ? '#FEE2E2' : '#DCFCE7',
                                                color: j.status === 'void' ? '#B91C1C' : '#065F46',
                                            }}>
                                                {j.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(j.totalDebit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}
            <Pager total={data.total} limit={PAGE_SIZE} offset={offset} onChange={setOffset} />

            {detailId ? <DetailDrawer id={detailId} onClose={(refreshed) => { setDetailId(null); if (refreshed) load(); }} /> : null}
        </div>
    );
}

export default function SupplierJournalLogs({ initialTab = 'payments' }) {
    const [tab, setTab] = useState(initialTab);

    return (
        <div style={{ padding: 4 }}>
            <AcctCard
                title="Posted Entries"
                action={(
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {Object.keys(TAB_LABELS).map((t) => (
                            <button key={t} type="button" style={tab === t ? primaryBtnStyle : outlineBtnStyle} onClick={() => setTab(t)}>
                                {TAB_LABELS[t]}
                            </button>
                        ))}
                    </div>
                )}
            >
                <LogTab tab={tab} />
            </AcctCard>
        </div>
    );
}
