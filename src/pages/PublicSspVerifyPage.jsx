import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { getPublicSuperSupplierPurchaseVerify } from '../services/publicVerifyApi';
import './PublicWpiVerifyPage.css';

function fmtMoney(n, cur = 'SAR') {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    return `${cur} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
    if (!d) return '—';
    try {
        const x = new Date(d);
        if (Number.isNaN(x.getTime())) return String(d).slice(0, 10);
        return x.toISOString().slice(0, 10);
    } catch {
        return '—';
    }
}

/**
 * Public landing when scanning QR on a super supplier purchase invoice.
 * GET /public/super-supplier-purchases/:id
 */
export default function PublicSspVerifyPage() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            setData(null);
            try {
                const res = await getPublicSuperSupplierPurchaseVerify(id);
                if (cancelled) return;
                setData(res);
            } catch (e) {
                if (!cancelled) {
                    setError(e?.message || 'Could not verify this document.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    return (
        <div
            style={{
                minHeight: '100vh',
                background: 'linear-gradient(165deg, #f8fafc 0%, #e2e8f0 45%, #f1f5f9 100%)',
                padding: '24px 16px 48px',
                fontFamily: 'system-ui, sans-serif',
                color: '#0f172a',
            }}
        >
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <p
                        style={{
                            margin: 0,
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            color: '#64748b',
                        }}
                    >
                        Filter
                    </p>
                    <h1 style={{ margin: '10px 0 0', fontSize: '1.35rem', fontWeight: 800 }}>
                        Purchase verification
                    </h1>
                    <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                        Super supplier purchase (upstream vendor bill)
                    </p>
                </div>

                {loading ? (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 12,
                            padding: 48,
                            background: '#fff',
                            borderRadius: 16,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
                        }}
                    >
                        <Loader2 size={36} className="wpi-verify-spin" style={{ color: '#D4A017' }} />
                        <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Checking database…</span>
                    </div>
                ) : error ? (
                    <div
                        style={{
                            padding: 24,
                            background: '#FEF2F2',
                            borderRadius: 16,
                            border: '1px solid #FECACA',
                            color: '#B91C1C',
                            fontSize: '0.875rem',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <AlertTriangle size={22} />
                            <strong>Verification failed</strong>
                        </div>
                        <p style={{ margin: 0 }}>{error}</p>
                        <p style={{ margin: '12px 0 0', fontSize: '0.8125rem', opacity: 0.9 }}>
                            If this bill is genuine, ask the supplier to regenerate the QR from the Filter supplier
                            portal.
                        </p>
                    </div>
                ) : data?.verified ? (
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: 16,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                padding: '20px 20px 16px',
                                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                                borderBottom: '1px solid #a7f3d0',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 14,
                            }}
                        >
                            <ShieldCheck size={40} style={{ color: '#059669', flexShrink: 0 }} />
                            <div>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: '#065f46' }}>
                                    Verified on Filter
                                </p>
                                <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: '#047857' }}>
                                    This document matches our records. Source:{' '}
                                    <strong>{data.source || 'Filter'}</strong>
                                </p>
                            </div>
                        </div>

                        <div style={{ padding: 20 }}>
                            <p style={{ margin: '0 0 4px', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>
                                DOCUMENT REFERENCE
                            </p>
                            <p style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 800 }}>
                                {data.invoiceNumber}
                            </p>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 12,
                                    fontSize: '0.8125rem',
                                    marginBottom: 16,
                                }}
                            >
                                <div>
                                    <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>Status</span>
                                    <strong style={{ textTransform: 'capitalize' }}>
                                        {String(data.status || '').replace(/_/g, ' ')}
                                    </strong>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>Grand total</span>
                                    <strong>{fmtMoney(data.grandTotal, data.currencyCode)}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>Purchase date</span>
                                    <strong>{fmtDate(data.issueDate)}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>Vendor ref</span>
                                    <strong>{data.vendorRef || data.referenceNo || '—'}</strong>
                                </div>
                            </div>

                            <div
                                style={{
                                    fontSize: '0.8125rem',
                                    padding: 12,
                                    background: '#f8fafc',
                                    borderRadius: 10,
                                    marginBottom: 16,
                                }}
                            >
                                <p style={{ margin: '0 0 6px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800 }}>
                                    PARTIES
                                </p>
                                <p style={{ margin: 0 }}>
                                    <strong>Your supplier (buyer on record):</strong> {data.buyerSupplierName || '—'}
                                </p>
                                <p style={{ margin: '8px 0 0' }}>
                                    <strong>Upstream vendor:</strong> {data.superSupplierName || '—'}
                                </p>
                            </div>

                            {Array.isArray(data.lines) && data.lines.length > 0 ? (
                                <>
                                    <p
                                        style={{
                                            margin: '0 0 8px',
                                            fontSize: '0.65rem',
                                            fontWeight: 800,
                                            color: '#94a3b8',
                                        }}
                                    >
                                        LINE ITEMS (SUMMARY)
                                    </p>
                                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                            <thead>
                                                <tr style={{ background: '#f1f5f9' }}>
                                                    <th style={{ textAlign: 'left', padding: 8 }}>Item</th>
                                                    <th style={{ textAlign: 'right', padding: 8 }}>Qty</th>
                                                    <th style={{ textAlign: 'right', padding: 8 }}>Line total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.lines.map((ln, i) => (
                                                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: 8 }}>{ln.itemName}</td>
                                                        <td style={{ padding: 8, textAlign: 'right' }}>
                                                            {ln.qty} {ln.uom || ''}
                                                        </td>
                                                        <td style={{ padding: 8, textAlign: 'right' }}>
                                                            {fmtMoney(ln.lineTotal, data.currencyCode)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : null}

                            <p
                                style={{
                                    margin: '20px 0 0',
                                    fontSize: '0.7rem',
                                    color: '#94a3b8',
                                    lineHeight: 1.5,
                                }}
                            >
                                Public verification uses purchase id <code>{String(id)}</code>. Totals are read from the
                                live Filter database at scan time.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: 24, background: '#fff', borderRadius: 16, color: '#64748b' }}>
                        Unexpected response.
                    </div>
                )}

                <p style={{ textAlign: 'center', marginTop: 28, fontSize: '0.8125rem' }}>
                    <Link to="/" style={{ color: '#2563eb', fontWeight: 600 }}>
                        Filter portals home
                    </Link>
                </p>
            </div>
        </div>
    );
}
