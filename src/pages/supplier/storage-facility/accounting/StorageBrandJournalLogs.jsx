import React, { useCallback, useEffect, useState } from 'react';
import {
    getBrandJournalById,
    listBrandGeneralJournals,
    listBrandPayments,
    listBrandReceipts,
} from '../../../../services/storageFacilityAccountingApi';
import {
    AcctCard,
    AcctEmpty,
    AcctError,
    AcctLoading,
    fmtDate,
    money,
} from '../../accounting/SupplierAccountingShared';

const FETCHERS = {
    payments: listBrandPayments,
    receipts: listBrandReceipts,
    journals: listBrandGeneralJournals,
};

const TITLES = {
    payments: 'Payments log',
    receipts: 'Receipts log',
    journals: 'Journal log',
};

export default function StorageBrandJournalLogs({ brandId, kind }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [detailId, setDetailId] = useState(null);
    const [detail, setDetail] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await FETCHERS[kind](brandId, { limit: 100 });
            setRows(Array.isArray(res?.journals) ? res.journals : []);
        } catch (e) {
            setErr(e?.message || 'Failed to load log');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [brandId, kind]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!detailId) {
            setDetail(null);
            return;
        }
        (async () => {
            try {
                const res = await getBrandJournalById(brandId, detailId);
                setDetail(res?.journal ?? res);
            } catch {
                setDetail(null);
            }
        })();
    }, [brandId, detailId]);

    return (
        <div>
            <AcctCard title={TITLES[kind]}>
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading />
                ) : rows.length === 0 ? (
                    <AcctEmpty message="No entries yet." />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ws-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th>Voucher</th>
                                    <th>Date</th>
                                    <th>Reference</th>
                                    <th style={{ textAlign: 'right' }}>Amount</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((j) => (
                                    <tr key={j.id}>
                                        <td>{j.entryNumber}</td>
                                        <td>{fmtDate(j.date)}</td>
                                        <td>{j.reference || '—'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {money(j.totalDebit || j.totalCredit)}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="sf-doc-link-btn"
                                                onClick={() => setDetailId(j.id)}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AcctCard>
            {detail ? (
                <AcctCard title={`${detail.entryNumber} — lines`} style={{ marginTop: 16 }}>
                    <p style={{ margin: '0 0 8px', color: '#64748b' }}>
                        {detail.description || 'No description'}
                    </p>
                    <table className="ws-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Account</th>
                                <th style={{ textAlign: 'right' }}>Debit</th>
                                <th style={{ textAlign: 'right' }}>Credit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(detail.lines || []).map((ln) => (
                                <tr key={ln.id}>
                                    <td>
                                        [{ln.accountCode}] {ln.accountName}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{money(ln.debit)}</td>
                                    <td style={{ textAlign: 'right' }}>{money(ln.credit)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button
                        type="button"
                        className="btn-portal-outline"
                        style={{ marginTop: 12 }}
                        onClick={() => setDetailId(null)}
                    >
                        Close
                    </button>
                </AcctCard>
            ) : null}
        </div>
    );
}
