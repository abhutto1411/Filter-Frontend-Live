import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, DollarSign, ListOrdered, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';

const LIMIT = 50;

function ymd(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function firstOfMonth(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
}

function statusBadgeClass(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'paid') return 'ws-badge--blue';
    if (s === 'posted' || s === 'pending') return 'ws-badge--yellow';
    return 'ws-badge--gray';
}

export default function TechnicianCommission() {
    const [from, setFrom] = useState(() => firstOfMonth());
    const [to, setTo] = useState(() => ymd());
    const [offset, setOffset] = useState(0);
    const [entries, setEntries] = useState([]);
    const [total, setTotal] = useState(0);
    const [meta, setMeta] = useState({ month: null, year: null, businessTimeZone: null, from: null, to: null });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const qs = new URLSearchParams({
                from,
                to,
                limit: String(LIMIT),
                offset: String(offset),
            });
            const res = await apiFetch(`/technician/commission-history?${qs.toString()}`);
            if (!res?.success || !Array.isArray(res.entries)) {
                throw new Error(res?.message || 'Invalid commission history response');
            }
            setEntries(res.entries);
            setTotal(Number(res.total) || 0);
            setMeta({
                month: res.month,
                year: res.year,
                businessTimeZone: res.businessTimeZone,
                from: res.from,
                to: res.to,
            });
        } catch (e) {
            setError(e.message || 'Failed to load commission history');
            setEntries([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [from, to, offset]);

    useEffect(() => {
        load();
    }, [load]);

    const pageSum = useMemo(
        () => entries.reduce((s, row) => s + (Number(row.commission) || 0), 0),
        [entries],
    );

    const hasPrev = offset > 0;
    const hasNext = offset + entries.length < total;

    return (
        <div>
            <div className="ws-page-header" style={{ marginBottom: 16 }}>
                <div>
                    <h2 className="ws-page-title">Commission</h2>
                    <p className="ws-page-sub">
                        {meta.businessTimeZone ? `Timezone: ${meta.businessTimeZone}` : 'History from your workshop'}
                    </p>
                </div>
                <button type="button" className="btn-portal" onClick={load} disabled={loading}>
                    <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            <div className="ws-section" style={{ marginBottom: 16, padding: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>From</label>
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => {
                                setFrom(e.target.value);
                                setOffset(0);
                            }}
                            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 6 }}>To</label>
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => {
                                setTo(e.target.value);
                                setOffset(0);
                            }}
                            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', fontSize: '0.875rem' }}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
                <div className="ws-section" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', margin: 0 }}>Total records</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#111827', margin: '4px 0 0' }}>{total}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>Matching date range</p>
                        </div>
                        <div style={{ background: '#F3F4F6', padding: '10px 16px', borderRadius: 12 }}>
                            <ListOrdered size={24} style={{ color: '#6B7280' }} />
                        </div>
                    </div>
                </div>
                <div className="ws-section" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
                        <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', margin: 0 }}>Commission (this page)</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16A34A', margin: '4px 0 0' }}>SAR {pageSum.toFixed(2)}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                                {entries.length} row{entries.length !== 1 ? 's' : ''} · limit {LIMIT}
                            </p>
                        </div>
                        <div style={{ background: '#F0FDF4', padding: '10px 16px', borderRadius: 12 }}>
                            <DollarSign size={24} style={{ color: '#16A34A' }} />
                        </div>
                    </div>
                </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 12 }}>Commission history</h3>
            <div className="ws-section" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Order</th>
                                <th>Display date</th>
                                <th>Invoice</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Commission</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && entries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        Loading…
                                    </td>
                                </tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        No commission entries in this range
                                    </td>
                                </tr>
                            ) : (
                                entries.map((row, idx) => (
                                    <tr key={`${row.orderId}-${row.invoiceId}-${idx}`}>
                                        <td><strong>{row.orderId}</strong></td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.displayYmd || row.dateYmd || '—'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.invoiceId ?? '—'}</td>
                                        <td>
                                            <span className={`ws-badge ${statusBadgeClass(row.status)}`}>
                                                {row.status || '—'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800 }}>SAR {Number(row.commission || 0).toFixed(2)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {(total > LIMIT || offset > 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                            Showing {offset + 1}–{offset + entries.length} of {total}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                style={{ padding: '8px 12px', fontSize: '0.8125rem' }}
                                disabled={!hasPrev || loading}
                                onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                            >
                                <ChevronLeft size={16} style={{ verticalAlign: 'middle' }} /> Previous
                            </button>
                            <button
                                type="button"
                                className="btn-portal-outline"
                                style={{ padding: '8px 12px', fontSize: '0.8125rem' }}
                                disabled={!hasNext || loading}
                                onClick={() => setOffset((o) => o + LIMIT)}
                            >
                                Next <ChevronRight size={16} style={{ verticalAlign: 'middle' }} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
