import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useStorageFacilityAccountingApi } from '../StorageFacilityPortalContext';
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
    todayISO,
} from '../../accounting/SupplierAccountingShared';

const CATEGORIES = ['', 'Cash', 'Bank', 'AR', 'AP', 'Revenue', 'Expense', 'Equity', 'Other'];

export default function StorageBrandLedgerView({ brandId, account, onBack }) {
    const accountingApi = useStorageFacilityAccountingApi();
    const [from, setFrom] = useState('');
    const [to, setTo] = useState(todayISO());
    const [category, setCategory] = useState(account?.accountCategory || '');
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [data, setData] = useState(null);

    const load = useCallback(async () => {
        if (!account?.id) return;
        setLoading(true);
        setErr('');
        try {
            const res = await accountingApi.getBrandAccountLedger(brandId, account.id, {
                from: from || undefined,
                to: to || undefined,
                accountCategory: category || undefined,
            });
            setData(res);
        } catch (e) {
            setErr(e?.message || 'Failed to load ledger');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [brandId, account?.id, from, to, category, accountingApi]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div>
            <button type="button" className="sf-doc-link-btn" onClick={onBack} style={{ marginBottom: 12 }}>
                <ArrowLeft size={14} style={{ verticalAlign: 'middle' }} /> Back
            </button>
            <AcctCard
                title={`Ledger — [${account?.code}] ${account?.name}`}
                subtitle="Filter by date range. Account category filter applies to related views."
            >
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                        gap: 12,
                        marginBottom: 16,
                    }}
                >
                    <Field label="From date">
                        <input type="date" style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value)} />
                    </Field>
                    <Field label="To date">
                        <input type="date" style={inputStyle} value={to} onChange={(e) => setTo(e.target.value)} />
                    </Field>
                    <Field label="Account category">
                        <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
                            {CATEGORIES.map((c) => (
                                <option key={c || 'all'} value={c}>
                                    {c || 'All categories'}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="button" style={outlineBtnStyle} onClick={load}>
                            Apply filters
                        </button>
                    </div>
                </div>
                <AcctError message={err} />
                {loading ? (
                    <AcctLoading />
                ) : !data?.entries?.length ? (
                    <AcctEmpty message="No ledger entries in this period." />
                ) : (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ws-table" style={{ width: '100%', minWidth: 720 }}>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Voucher</th>
                                        <th>Type</th>
                                        <th>Description</th>
                                        <th style={{ textAlign: 'right' }}>Debit</th>
                                        <th style={{ textAlign: 'right' }}>Credit</th>
                                        <th style={{ textAlign: 'right' }}>Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.entries.map((e) => (
                                        <tr key={e.id}>
                                            <td>{fmtDate(e.date)}</td>
                                            <td>{e.entryNumber}</td>
                                            <td>{e.entryType}</td>
                                            <td>{e.description || '—'}</td>
                                            <td style={{ textAlign: 'right' }}>{money(e.debit)}</td>
                                            <td style={{ textAlign: 'right' }}>{money(e.credit)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                                {money(e.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p style={{ marginTop: 12, fontWeight: 700, textAlign: 'right' }}>
                            Closing balance: {money(data.closingBalance)}
                        </p>
                    </>
                )}
            </AcctCard>
        </div>
    );
}
