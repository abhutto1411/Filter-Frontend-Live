import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, Loader2, PackageCheck, Lock } from 'lucide-react';
import {
    getPublicSupplierSalesInvoiceVerify,
    getPublicSupplierSalesInvoiceReceivePreview,
    publicReceiveSupplierSalesInvoiceWithPassword,
} from '../services/publicVerifyApi';
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
 * Public landing when scanning QR on a supplier sales invoice (AR).
 * GET /public/supplier-sales-invoices/:id
 */
export default function PublicSinvVerifyPage() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [receivePassword, setReceivePassword] = useState('');
    const [receiveSubmitting, setReceiveSubmitting] = useState(false);
    const [receiveError, setReceiveError] = useState('');
    const [receiveResult, setReceiveResult] = useState(null);
    /** Loaded as soon as the invoice is verified (before opening receive) so users see missing-branch products upfront. */
    const [inventoryPreview, setInventoryPreview] = useState(null);
    const [inventoryPreviewLoading, setInventoryPreviewLoading] = useState(false);
    const [receiveCriticalByPid, setReceiveCriticalByPid] = useState({});

    const closeReceiveModal = () => {
        if (receiveSubmitting) return;
        setReceiveOpen(false);
        setReceivePassword('');
        setReceiveError('');
    };

    const handleReceiveSubmit = async (e) => {
        e?.preventDefault?.();
        if (receiveSubmitting) return;
        if (!receivePassword.trim()) {
            setReceiveError('Enter the workshop or branch password.');
            return;
        }
        setReceiveSubmitting(true);
        setReceiveError('');
        try {
            const criticalStockByProductId = {};
            const newProds = Array.isArray(inventoryPreview?.newProducts) ? inventoryPreview.newProducts : [];
            const keys =
                newProds.length > 0
                    ? newProds.map((p) => String(p.productId))
                    : Object.keys(receiveCriticalByPid);
            for (const pid of keys) {
                const raw = receiveCriticalByPid[pid] ?? '0';
                const n = parseFloat(String(raw).replace(',', '.'));
                if (Number.isFinite(n) && n >= 0) {
                    criticalStockByProductId[pid] = n;
                }
            }
            const res = await publicReceiveSupplierSalesInvoiceWithPassword(id, receivePassword, {
                criticalStockByProductId:
                    Object.keys(criticalStockByProductId).length > 0
                        ? criticalStockByProductId
                        : undefined,
            });
            setReceiveResult(res);
            setReceiveOpen(false);
            setReceivePassword('');
        } catch (err) {
            setReceiveError(err?.message || 'Could not authenticate. Check the password and try again.');
        } finally {
            setReceiveSubmitting(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            setData(null);
            setInventoryPreview(null);
            setReceiveCriticalByPid({});
            try {
                const res = await getPublicSupplierSalesInvoiceVerify(id);
                if (cancelled) return;
                setData(res);
            } catch (e) {
                if (!cancelled) {
                    setError(e?.message || 'Could not verify this invoice.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    /** Which products are not on this branch yet + unmatched lines — show before user taps “Mark as Received”. */
    useEffect(() => {
        if (!id || loading || error || !data?.verified) {
            return undefined;
        }
        const alreadyReceived =
            Boolean(data?.received) ||
            Boolean(data?.stockApplied) ||
            Boolean(receiveResult);
        if (alreadyReceived) {
            setInventoryPreview(null);
            setInventoryPreviewLoading(false);
            return undefined;
        }
        let cancelled = false;
        setInventoryPreviewLoading(true);
        setInventoryPreview(null);
        getPublicSupplierSalesInvoiceReceivePreview(id)
            .then((res) => {
                if (!cancelled) setInventoryPreview(res);
            })
            .catch(() => {
                if (!cancelled) setInventoryPreview(null);
            })
            .finally(() => {
                if (!cancelled) setInventoryPreviewLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [id, loading, error, data?.verified, data?.received, data?.stockApplied, receiveResult]);

    useEffect(() => {
        const list = inventoryPreview?.newProducts;
        if (!Array.isArray(list) || list.length === 0) return;
        setReceiveCriticalByPid((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const p of list) {
                const k = String(p.productId);
                if (next[k] === undefined) {
                    next[k] = '0';
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [inventoryPreview]);

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
                        Invoice verification
                    </h1>
                    <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                        Supplier sales invoice — accounts receivable
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
                            If this invoice is genuine, ask the supplier to regenerate the QR from the Filter supplier
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
                                INVOICE NUMBER
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
                                    <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>Issue date</span>
                                    <strong>{fmtDate(data.issueDate)}</strong>
                                </div>
                                <div>
                                    <span style={{ color: '#64748b', display: 'block', marginBottom: 4 }}>Due date</span>
                                    <strong>{fmtDate(data.dueDate)}</strong>
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
                                    <strong>Supplier:</strong> {data.supplierName || '—'}
                                </p>
                                <p style={{ margin: '8px 0 0' }}>
                                    <strong>Workshop:</strong> {data.workshopName || '—'}
                                    {data.branchName ? ` · ${data.branchName}` : ''}
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
                                                        <td style={{ padding: 8, textAlign: 'right' }}>{ln.qty}</td>
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

                            {(() => {
                                const alreadyReceived =
                                    Boolean(data?.received) ||
                                    Boolean(data?.stockApplied) ||
                                    Boolean(receiveResult);
                                if (alreadyReceived) return null;
                                if (inventoryPreviewLoading) {
                                    return (
                                        <p style={{ marginTop: 18, fontSize: '0.8125rem', color: '#64748b' }}>
                                            Checking which products are not on this branch yet…
                                        </p>
                                    );
                                }
                                const unresolved = Array.isArray(inventoryPreview?.unresolvedLineNames)
                                    ? inventoryPreview.unresolvedLineNames
                                    : [];
                                const newProds = Array.isArray(inventoryPreview?.newProducts)
                                    ? inventoryPreview.newProducts
                                    : [];
                                const hasGap =
                                    Boolean(inventoryPreview?.hasNewProducts) ||
                                    unresolved.length > 0 ||
                                    newProds.length > 0;
                                if (!hasGap && inventoryPreview) {
                                    return (
                                        <div
                                            style={{
                                                marginTop: 18,
                                                padding: 14,
                                                background: '#f8fafc',
                                                borderRadius: 12,
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.8125rem',
                                                color: '#475569',
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            <strong style={{ color: '#0f172a' }}>Branch inventory</strong>
                                            <p style={{ margin: '8px 0 0' }}>
                                                Every line on this invoice is already linked to products on this branch.
                                                When you mark as received, on-hand quantities will increase by the amounts
                                                on this invoice.
                                            </p>
                                        </div>
                                    );
                                }
                                if (!hasGap) return null;
                                return (
                                    <div
                                        style={{
                                            marginTop: 18,
                                            padding: 16,
                                            background: '#FFFBEB',
                                            borderRadius: 12,
                                            border: '1px solid #FDE68A',
                                            fontSize: '0.8125rem',
                                            color: '#78350F',
                                        }}
                                    >
                                        <p style={{ margin: '0 0 10px', fontWeight: 800, color: '#92400E' }}>
                                            Before you receive this invoice
                                        </p>
                                        <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
                                            Some items are <strong>not on this branch&apos;s inventory</strong> yet. To
                                            accept, Filter will <strong>add those products to this branch</strong>.{' '}
                                            <strong>Opening stock</strong> for each new branch product will be the{' '}
                                            <strong>quantity on this invoice</strong> (summed if the same product
                                            appears on multiple lines). Set each product&apos;s{' '}
                                            <strong>critical stock</strong> (reorder alert level) below, then use{' '}
                                            <em>Mark as Received</em> and enter your workshop password.
                                        </p>
                                        {unresolved.length > 0 ? (
                                            <div
                                                style={{
                                                    marginBottom: 12,
                                                    padding: 10,
                                                    background: '#FEF2F2',
                                                    border: '1px solid #FECACA',
                                                    borderRadius: 10,
                                                    color: '#991B1B',
                                                }}
                                            >
                                                <strong>Unmatched invoice lines</strong> (no master product link):{' '}
                                                {unresolved.join(', ')}. Stock may not update for these until they are
                                                linked in the supplier invoice.
                                            </div>
                                        ) : null}
                                        {newProds.length > 0 ? (
                                            <div style={{ overflowX: 'auto' }}>
                                                <table
                                                    style={{
                                                        width: '100%',
                                                        borderCollapse: 'collapse',
                                                        fontSize: '0.75rem',
                                                        background: '#fff',
                                                        borderRadius: 8,
                                                    }}
                                                >
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid #FDE68A' }}>
                                                            <th style={{ textAlign: 'left', padding: '8px 6px' }}>
                                                                Product (new on branch)
                                                            </th>
                                                            <th style={{ textAlign: 'right', padding: '8px 6px' }}>
                                                                Opening qty
                                                            </th>
                                                            <th style={{ textAlign: 'right', padding: '8px 6px' }}>
                                                                Critical stock
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {newProds.map((p) => (
                                                            <tr
                                                                key={p.productId}
                                                                style={{ borderBottom: '1px solid #fef3c7' }}
                                                            >
                                                                <td style={{ padding: '8px 6px' }}>{p.name}</td>
                                                                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                                    {p.qty} {p.unit || ''}
                                                                </td>
                                                                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                                                                    <input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        value={
                                                                            receiveCriticalByPid[String(p.productId)] ??
                                                                            '0'
                                                                        }
                                                                        onChange={(e) =>
                                                                            setReceiveCriticalByPid((prev) => ({
                                                                                ...prev,
                                                                                [String(p.productId)]: e.target.value,
                                                                            }))
                                                                        }
                                                                        style={{
                                                                            width: 80,
                                                                            padding: '6px 8px',
                                                                            borderRadius: 6,
                                                                            border: '1px solid #d97706',
                                                                            textAlign: 'right',
                                                                        }}
                                                                        aria-label={`Critical stock for ${p.name}`}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })()}

                            {(() => {
                                /**
                                 * "Already received" trumps the button. We trust either
                                 * (a) live server flag from the public GET, or
                                 * (b) the in-session result from a successful POST.
                                 */
                                const alreadyReceived =
                                    Boolean(data?.received) ||
                                    Boolean(data?.stockApplied) ||
                                    Boolean(receiveResult);
                                if (alreadyReceived) {
                                    const justNow = Boolean(receiveResult) &&
                                        !receiveResult?.alreadyReceivedBefore;
                                    return (
                                        <div
                                            style={{
                                                marginTop: 20,
                                                padding: 16,
                                                borderRadius: 12,
                                                background: '#ECFDF5',
                                                border: '1px solid #A7F3D0',
                                                color: '#065F46',
                                                fontSize: '0.875rem',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: 10,
                                            }}
                                        >
                                            <PackageCheck size={22} style={{ flexShrink: 0, color: '#059669' }} />
                                            <div>
                                                <strong style={{ display: 'block', marginBottom: 4 }}>
                                                    {justNow ? 'Inventory updated' : 'Already received'}
                                                </strong>
                                                <span>
                                                    {receiveResult?.message ||
                                                        'Branch inventory has already been updated for this invoice. No further action is needed.'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReceiveOpen(true);
                                            setReceiveError('');
                                        }}
                                        style={{
                                            marginTop: 20,
                                            width: '100%',
                                            padding: '12px 16px',
                                            background: '#059669',
                                            border: 'none',
                                            borderRadius: 12,
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: '0.9375rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 8,
                                            boxShadow: '0 6px 16px rgba(5,150,105,0.25)',
                                        }}
                                    >
                                        <PackageCheck size={18} /> Mark as Received (update inventory)
                                    </button>
                                );
                            })()}
                            <p
                                style={{
                                    margin: '20px 0 0',
                                    fontSize: '0.7rem',
                                    color: '#94a3b8',
                                    lineHeight: 1.5,
                                }}
                            >
                                Public verification uses invoice id <code>{String(id)}</code>. Totals and status are read
                                from the live Filter database at scan time. Receiving requires the workshop password and
                                applies inventory once.
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

            {receiveOpen ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Confirm workshop password"
                    onClick={closeReceiveModal}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15,23,42,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 16,
                        zIndex: 50,
                    }}
                >
                    <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={handleReceiveSubmit}
                        style={{
                            background: '#fff',
                            borderRadius: 14,
                            width: '100%',
                            maxWidth: 460,
                            padding: 22,
                            boxShadow: '0 20px 50px rgba(2,6,23,0.35)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <Lock size={20} style={{ color: '#0f172a' }} />
                            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                                Authenticate workshop
                            </h2>
                        </div>
                        <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.45 }}>
                            Enter the branch login password OR the workshop owner / admin password to mark this invoice
                            as received and update inventory for{' '}
                            <strong>{data?.branchName || data?.workshopName || 'this workshop'}</strong>.
                        </p>
                        {inventoryPreviewLoading ? (
                            <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: 12 }}>
                                Refreshing branch preview…
                            </p>
                        ) : (
                            <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#475569', lineHeight: 1.45 }}>
                                New products and critical stock are set on the page above. Enter your password here to
                                confirm receipt and apply inventory.
                            </p>
                        )}
                        <label
                            htmlFor="public-sinv-receive-password"
                            style={{
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#334155',
                                marginBottom: 6,
                            }}
                        >
                            Workshop / branch password
                        </label>
                        <input
                            id="public-sinv-receive-password"
                            type="password"
                            autoFocus
                            value={receivePassword}
                            onChange={(e) => setReceivePassword(e.target.value)}
                            disabled={receiveSubmitting}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                fontSize: '0.9375rem',
                                outline: 'none',
                                marginBottom: 12,
                            }}
                        />
                        {receiveError ? (
                            <p
                                style={{
                                    margin: '0 0 10px',
                                    fontSize: '0.8125rem',
                                    color: '#B91C1C',
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                }}
                            >
                                {receiveError}
                            </p>
                        ) : null}
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={closeReceiveModal}
                                disabled={receiveSubmitting}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    border: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    fontWeight: 600,
                                    color: '#0f172a',
                                    cursor: receiveSubmitting ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={receiveSubmitting || !receivePassword.trim()}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: 10,
                                    border: 'none',
                                    background: '#059669',
                                    color: '#fff',
                                    fontWeight: 700,
                                    cursor:
                                        receiveSubmitting || !receivePassword.trim()
                                            ? 'not-allowed'
                                            : 'pointer',
                                    opacity: receiveSubmitting || !receivePassword.trim() ? 0.7 : 1,
                                }}
                            >
                                {receiveSubmitting ? 'Authenticating…' : 'Confirm & receive'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
