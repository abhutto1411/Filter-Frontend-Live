import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../../components/Modal';
import { fetchCorporateWalkInOrderById } from '../../services/corporateBookingsApi';

export default function WalkInOrderDetailModal({ orderId, onClose }) {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const ac = new AbortController();
        setLoading(true);
        setError('');
        (async () => {
            try {
                const d = await fetchCorporateWalkInOrderById(orderId, { signal: ac.signal });
                if (!ac.signal.aborted) setDetail(d);
            } catch (err) {
                if (!ac.signal.aborted) setError(err.message || 'Failed to load');
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        })();
        return () => ac.abort();
    }, [orderId]);

    const timeline = Array.isArray(detail?.timeline) ? detail.timeline : [];
    const jobs = Array.isArray(detail?.jobs) ? detail.jobs : [];
    const lineItems = Array.isArray(detail?.lineItems) ? detail.lineItems : [];
    const qt = detail?.quoteTotals && typeof detail.quoteTotals === 'object' ? detail.quoteTotals : null;
    const posPayments = Array.isArray(detail?.posPayments) ? detail.posPayments : [];

    function fmtMoney(n) {
        const v = Number(n);
        if (!Number.isFinite(v)) return '—';
        return `SAR ${v.toFixed(2)}`;
    }

    function fmtDiscount(discountType, discountValue) {
        const t = String(discountType || '').toLowerCase();
        const v = Number(discountValue);
        if (t === 'percentage' || t === 'percent') return `${Number.isFinite(v) ? v : 0}%`;
        return fmtMoney(v);
    }

    return (
        <Modal
            title={`Walk-in Order #${orderId}`}
            onClose={onClose}
            width="760px"
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-portal-outline" onClick={onClose}>
                        Close
                    </button>
                </div>
            }
        >
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
                    <Loader2 className="spin" size={28} />
                </div>
            )}
            {error && <p style={{ color: '#DC2626', margin: 0 }}>{error}</p>}
            {detail && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                            gap: 8,
                            background: 'var(--color-bg-muted)',
                            borderRadius: 10,
                            padding: 10,
                        }}
                    >
                        <div>
                            <strong>Order ID:</strong> {detail.id || orderId}
                        </div>
                        <div>
                            <strong>Status:</strong>{' '}
                            {detail.approvalStatusLabel ||
                                String(detail.status || '—').replace(/_/g, ' ')}
                        </div>
                        <div>
                            <strong>Branch:</strong> {detail.branchName || '—'}
                        </div>
                        <div>
                            <strong>Vehicle:</strong> {detail.vehicle?.plateNo || '—'} · {detail.vehicle?.make || ''}{' '}
                            {detail.vehicle?.model || ''}
                        </div>
                        {detail.orderPromoCodeName ? (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <strong>Order promo:</strong> {detail.orderPromoCodeName}
                            </div>
                        ) : null}
                    </div>

                    {(detail.posCustomerKind || posPayments.length > 0) && (
                        <div
                            style={{
                                border: '1px solid var(--color-border-light)',
                                borderRadius: 10,
                                padding: 10,
                                background: '#FAF5FF',
                            }}
                        >
                            <p style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: '0.78rem' }}>POS payment draft</p>
                            <p style={{ margin: 0, fontSize: '0.8rem' }}>
                                <strong>Customer kind:</strong> {detail.posCustomerKind || '—'}
                            </p>
                            {posPayments.length > 0 && (
                                <ul style={{ margin: '8px 0 0 0', paddingLeft: 18, fontSize: '0.8rem' }}>
                                    {posPayments.map((p, i) => (
                                        <li key={`${p.method}-${i}`}>
                                            {p.method}: {fmtMoney(p.amount)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.78rem', background: '#EEF2FF' }}>
                            Line Items
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                <thead>
                                    <tr style={{ background: '#F8FAFC' }}>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Item</th>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
                                        <th style={{ textAlign: 'left', padding: 8 }}>Department</th>
                                        <th style={{ textAlign: 'right', padding: 8 }}>Qty</th>
                                        <th style={{ textAlign: 'right', padding: 8 }}>Unit</th>
                                        <th style={{ textAlign: 'right', padding: 8 }}>Discount</th>
                                        <th style={{ textAlign: 'right', padding: 8 }}>VAT%</th>
                                        <th style={{ textAlign: 'right', padding: 8 }}>Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((it) => (
                                        <tr key={it.id} style={{ borderTop: '1px solid var(--color-border-light)' }}>
                                            <td style={{ padding: 8 }}>{it.productName || it.name || '—'}</td>
                                            <td style={{ padding: 8, textTransform: 'capitalize' }}>{it.itemType || '—'}</td>
                                            <td style={{ padding: 8 }}>{it.departmentName || '—'}</td>
                                            <td style={{ padding: 8, textAlign: 'right' }}>{it.qty ?? 1}</td>
                                            <td style={{ padding: 8, textAlign: 'right' }}>
                                                SAR {Number(it.unitPrice || 0).toFixed(2)}
                                            </td>
                                            <td style={{ padding: 8, textAlign: 'right' }}>
                                                {fmtDiscount(it.discountType, it.discountValue)}
                                            </td>
                                            <td style={{ padding: 8, textAlign: 'right' }}>{it.vatPercent ?? 0}</td>
                                            <td style={{ padding: 8, textAlign: 'right', fontWeight: 700 }}>
                                                SAR {Number(it.lineTotal || 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.78rem', background: '#F0FDF4' }}>
                            Jobs
                        </div>
                        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {jobs.length === 0 ? (
                                <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>No job records.</p>
                            ) : (
                                jobs.map((j) => (
                                    <div key={j.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: 8, padding: 8 }}>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem' }}>
                                            Job #{j.id} · {j.departmentName || j.departmentId || '—'} · {j.status || '—'} ·{' '}
                                            {fmtMoney(j.totalAmount)}
                                            {j.promoCodeName ? ` · Promo: ${j.promoCodeName}` : ''}
                                        </p>
                                        {j.finance && (
                                            <p style={{ margin: '6px 0 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                                Net before VAT {fmtMoney(j.finance.netBeforeVat)} · VAT{' '}
                                                {fmtMoney(j.finance.vatAmount)} · Incl. VAT{' '}
                                                {fmtMoney(j.finance.totalInclVat)}
                                                {Number(j.finance.promoDiscountAmount) > 0
                                                    ? ` · Promo disc ${fmtMoney(j.finance.promoDiscountAmount)}`
                                                    : ''}
                                            </p>
                                        )}
                                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                            Technicians:{' '}
                                            {Array.isArray(j.technicians) && j.technicians.length
                                                ? j.technicians.map((t) => t.name).join(', ')
                                                : 'Not assigned'}
                                        </p>
                                        {!!j.items?.length && (
                                            <ul style={{ margin: '6px 0 0 0', paddingLeft: 18, fontSize: '0.76rem' }}>
                                                {j.items.map((it) => (
                                                    <li key={it.id}>
                                                        {it.productName || '—'} ×{it.qty ?? 1} — SAR {Number(it.lineTotal || 0).toFixed(2)}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.78rem', background: '#FFF7ED' }}>
                            Timeline
                        </div>
                        <div style={{ padding: 10 }}>
                            {timeline.length === 0 ? (
                                <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>No timeline entries.</p>
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem' }}>
                                    {timeline.map((t, idx) => (
                                        <li key={`${t.label}-${idx}`} style={{ marginBottom: 6 }}>
                                            <strong>{t.label || t.status || 'Update'}</strong>
                                            {t.detail ? ` — ${t.detail}` : ''}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                        <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 8, padding: 8 }}>
                            <p style={{ margin: '0 0 4px 0', fontWeight: 700, fontSize: '0.76rem' }}>Invoice</p>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                {detail.invoice ? 'Available' : 'Not generated yet'}
                            </p>
                        </div>
                        <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 8, padding: 8 }}>
                            <p style={{ margin: '0 0 4px 0', fontWeight: 700, fontSize: '0.76rem' }}>Quote totals</p>
                            {qt ? (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem' }}>
                                    <li>Total incl. VAT: {fmtMoney(qt.totalAmount)}</li>
                                    <li>VAT: {fmtMoney(qt.vatAmount)}</li>
                                    <li>Departments: {qt.pendingDepartmentCount ?? '—'}</li>
                                </ul>
                            ) : (
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Not available</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}
