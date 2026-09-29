import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, Package, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../services/api';

const LIMIT = 50;

function statusLabel(row) {
    return row.assignmentStatus || row.status || '—';
}

export default function TechnicianActiveOrders({ onListChanged }) {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const qs = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
            const res = await apiFetch(`/technician/assigned-orders?${qs.toString()}`);
            if (!res?.success || !Array.isArray(res.orders)) {
                throw new Error(res?.message || 'Invalid assigned orders response');
            }
            setRows(res.orders);
            setTotal(Number(res.total) || 0);
            onListChanged?.();
        } catch (e) {
            setError(e.message || 'Failed to load assigned orders');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [offset, onListChanged]);

    useEffect(() => {
        load();
    }, [load]);

    const hasPrev = offset > 0;
    const hasNext = offset + rows.length < total;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClipboardList size={18} style={{ color: 'var(--color-text-muted)' }} />
                    Assigned orders
                    {!loading && total > 0 && (
                        <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>({total})</span>
                    )}
                </h3>
                <button type="button" className="btn-portal-outline" style={{ padding: '8px 14px', fontSize: '0.8125rem' }} onClick={load} disabled={loading}>
                    <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            {loading && rows.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>Loading assigned orders…</p>
                </div>
            ) : rows.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <Package size={48} style={{ opacity: 0.2, margin: '0 auto 12px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>No assigned orders</p>
                </div>
            ) : (
                <>
                    <div
                        className="tech-assigned-orders-grid"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                            gap: 14,
                        }}
                    >
                        {rows.map((row) => (
                                <div key={`${row.jobId}-${row.orderId}`} className="tech-assigned-order-card">
                                    <div className="ws-order-header" style={{ alignItems: 'flex-start' }}>
                                        <div style={{ minWidth: 0 }}>
                                            <p className="ws-order-num">{row.orderId}</p>
                                            <p className="ws-order-customer" style={{ marginTop: 4 }}>{row.customerName || '—'}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                                                {row.vehicle || '—'}
                                                {row.plateNo ? ` · ${row.plateNo}` : ''}
                                            </p>
                                            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                                                {row.department || '—'} · {row.source || '—'}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p className="ws-order-total">SAR {Number(row.value || 0).toFixed(2)}</p>
                                            <p className="ws-order-comm">Comm: SAR {Number(row.commission || 0).toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span className="tech-assigned-status">{statusLabel(row)}</span>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Job #{row.jobId}</span>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '10px 0 0' }}>
                                        {row.orderDate || '—'}
                                        {row.orderTime ? ` · ${row.orderTime}` : ''}
                                    </p>
                                </div>
                        ))}
                    </div>

                    {(total > LIMIT || offset > 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, flexWrap: 'wrap', gap: 10 }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                                Showing {offset + 1}–{offset + rows.length} of {total}
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
                </>
            )}

            <style>{`
                .tech-assigned-order-card {
                    background: #fff;
                    border: 1px solid var(--color-border);
                    border-radius: 14px;
                    padding: 18px;
                    display: flex;
                    flex-direction: column;
                    margin-bottom: 0;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
                }
                .tech-assigned-order-card .ws-order-comm {
                    color: var(--color-text-muted);
                }
                .tech-assigned-status {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 10px;
                    border-radius: 999px;
                    font-size: 0.6875rem;
                    font-weight: 700;
                    background: rgba(255, 194, 69, 0.18);
                    color: var(--color-text-dark, #111827);
                    border: 1px solid var(--color-border);
                }
                @media (max-width: 1024px) {
                    .tech-assigned-orders-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    }
                }
                @media (max-width: 640px) {
                    .tech-assigned-orders-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div>
    );
}
