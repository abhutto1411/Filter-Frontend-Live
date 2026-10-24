import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Eye, Loader2, RefreshCw } from 'lucide-react';
import {
    fetchCorporatePendingWalkInOrders,
    approveCorporateWalkInOrder,
    rejectCorporateWalkInOrder,
    getCorporateWalkInSettings,
    updateCorporateWalkInSettings,
} from '../../services/corporateBookingsApi';
import WalkInOrderDetailModal from './WalkInOrderDetailModal';

export default function CorporateBookingApprovals() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [detailId, setDetailId] = useState(null);
    const [actionId, setActionId] = useState(null);
    const [banner, setBanner] = useState('');
    // Auto-approval toggle — when ON, cashier walk-in submissions skip this
    // queue entirely. Loaded from `/corporate/walk-in-orders/settings`.
    const [autoApprove, setAutoApprove] = useState(false);
    const [toggleBusy, setToggleBusy] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setError('');
        // Fetch the pending list AND the auto-approve setting in parallel —
        // both render on the same page header.
        Promise.all([
            fetchCorporatePendingWalkInOrders(),
            getCorporateWalkInSettings().catch(() => ({ autoApproveWalkIns: false })),
        ])
            .then(([list, settings]) => {
                setRows(Array.isArray(list) ? list : []);
                setAutoApprove(Boolean(settings?.autoApproveWalkIns));
            })
            .catch((e) => {
                setRows([]);
                setError(e?.message || 'Could not load pending approvals');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleToggleAutoApprove = async () => {
        const next = !autoApprove;
        setToggleBusy(true);
        setBanner('');
        // Optimistic flip — revert if the server rejects.
        setAutoApprove(next);
        try {
            await updateCorporateWalkInSettings({ autoApproveWalkIns: next });
        } catch (e) {
            setAutoApprove(!next);
            setBanner(e?.message || 'Could not update auto-approval setting');
        } finally {
            setToggleBusy(false);
        }
    };

    useEffect(() => {
        const onSocket = () => load();
        window.addEventListener('corporate-portal-bookings-refresh', onSocket);
        return () => window.removeEventListener('corporate-portal-bookings-refresh', onSocket);
    }, [load]);

    const handleApprove = async (orderId) => {
        setActionId(String(orderId));
        setBanner('');
        try {
            await approveCorporateWalkInOrder(orderId);
            await load();
        } catch (e) {
            setBanner(e?.message || 'Approve failed');
        } finally {
            setActionId(null);
        }
    };

    const handleReject = async (orderId) => {
        const reason = window.prompt('Reason for rejection?');
        if (!reason || !String(reason).trim()) return;
        setActionId(String(orderId));
        setBanner('');
        try {
            await rejectCorporateWalkInOrder(orderId, String(reason).trim());
            await load();
        } catch (e) {
            setBanner(e?.message || 'Reject failed');
        } finally {
            setActionId(null);
        }
    };

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Booking approvals</h2>
                    <p className="ws-page-sub">
                        Cashier walk-in quotes for your corporate account — approve to let the workshop start work, or
                        reject with a reason.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <AutoApproveToggle
                        value={autoApprove}
                        busy={toggleBusy}
                        onChange={handleToggleAutoApprove}
                    />
                    <button
                        type="button"
                        className="btn-portal-outline"
                        onClick={() => load()}
                        disabled={loading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {error ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 10,
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    {error}
                </div>
            ) : null}

            {banner ? (
                <div
                    className="ws-section"
                    style={{
                        marginBottom: 16,
                        padding: 14,
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: 10,
                        color: '#B91C1C',
                        fontSize: '0.875rem',
                    }}
                >
                    {banner}
                </div>
            ) : null}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <Loader2 className="spin" size={36} style={{ color: '#7C3AED' }} />
                </div>
            ) : rows.length === 0 ? (
                <div className="ws-section" style={{ textAlign: 'center', padding: 48 }}>
                    <ClipboardCheck size={48} style={{ opacity: 0.25, margin: '0 auto 16px', display: 'block' }} />
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-muted)' }}>Nothing waiting for approval</p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        When a branch creates a walk-in corporate quote, it will appear here.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {rows.map((o) => {
                        const busy = actionId != null && String(actionId) === String(o.id);
                        const qt = o.quoteTotals && typeof o.quoteTotals === 'object' ? o.quoteTotals : null;
                        const jobs = Array.isArray(o.jobs) ? o.jobs : [];
                        const vatStr =
                            qt != null && qt.vatAmount != null && !Number.isNaN(Number(qt.vatAmount))
                                ? ` · VAT SAR ${Number(qt.vatAmount).toFixed(2)}`
                                : '';
                        return (
                            <div key={o.id} className="ws-section" style={{ marginBottom: 0, padding: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0 }}>Walk-in order #{o.id}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                                            {o.vehiclePlate || '—'} · {o.vehicleSummary || '—'} · {o.branchName || '—'}
                                        </p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
                                            {o.createdAt ? new Date(o.createdAt).toLocaleString('en-SA') : '—'}
                                        </p>
                                        <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '8px 0 0 0' }}>
                                            SAR {Number(o.totalAmount || 0).toFixed(2)}
                                            {vatStr}
                                            {' · '}
                                            {o.lineCount || (o.items || []).length || 0} lines
                                        </p>
                                        {o.orderPromoCodeName ? (
                                            <p
                                                style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--color-text-muted)',
                                                    margin: '4px 0 0 0',
                                                }}
                                            >
                                                Order promo: <strong>{o.orderPromoCodeName}</strong>
                                            </p>
                                        ) : null}
                                        {jobs.length > 0 ? (
                                            <p
                                                style={{
                                                    fontSize: '0.72rem',
                                                    color: 'var(--color-text-muted)',
                                                    margin: '6px 0 0 0',
                                                    lineHeight: 1.45,
                                                }}
                                            >
                                                {jobs
                                                    .map(
                                                        (j) =>
                                                            `${j.departmentName || 'Dept'} SAR ${Number(j.totalAmount || 0).toFixed(2)}${
                                                                j.promoCodeName ? ` (${j.promoCodeName})` : ''
                                                            }`,
                                                    )
                                                    .join(' · ')}
                                            </p>
                                        ) : null}
                                    </div>
                                    <span
                                        style={{
                                            background: '#FEF3C7',
                                            color: '#B45309',
                                            padding: '4px 10px',
                                            borderRadius: 6,
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            flexShrink: 0,
                                        }}
                                    >
                                        Awaiting approval
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        className="btn-portal-outline"
                                        onClick={() => setDetailId(o.id)}
                                        style={{ padding: '8px 12px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}
                                    >
                                        <Eye size={15} /> View details
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-portal"
                                        style={{ padding: '8px 12px', fontSize: '0.8125rem', background: '#16A34A', color: '#fff', border: 'none' }}
                                        onClick={() => handleApprove(o.id)}
                                        disabled={busy}
                                    >
                                        {busy ? 'Processing…' : 'Approve'}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-portal"
                                        style={{ padding: '8px 12px', fontSize: '0.8125rem', background: '#DC2626', color: '#fff', border: 'none' }}
                                        onClick={() => handleReject(o.id)}
                                        disabled={busy}
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {detailId ? <WalkInOrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} /> : null}
        </div>
    );
}

/**
 * Compact pill-style toggle for the auto-approval setting. While the API
 * call is in flight, the whole pill dims + shows a spinner on the thumb
 * and the ON/OFF label says "Saving…". Optimistic flip keeps the UI
 * responsive; parent rolls back on backend error.
 */
function AutoApproveToggle({ value, busy, onChange }) {
    return (
        <label
            style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                borderRadius: 999,
                border: `1px solid ${value ? '#10b981' : '#cbd5e1'}`,
                background: value ? '#ecfdf5' : '#f8fafc',
                cursor: busy ? 'wait' : 'pointer',
                userSelect: 'none',
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: value ? '#065f46' : '#475569',
                transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
                // Dim the whole pill while saving — clear "something's happening" cue.
                opacity: busy ? 0.85 : 1,
                overflow: 'hidden',
            }}
            title={
                busy
                    ? 'Saving…'
                    : value
                        ? 'Auto-approve is ON — cashier walk-in orders skip this queue.'
                        : 'Auto-approve is OFF — cashier walk-ins land here for manual review.'
            }
        >
            <input
                type="checkbox"
                checked={!!value}
                disabled={busy}
                onChange={(e) => { e.stopPropagation(); onChange?.(); }}
                style={{ display: 'none' }}
            />
            {/* Track */}
            <span style={{
                width: 36,
                height: 20,
                borderRadius: 999,
                background: value ? '#10b981' : '#cbd5e1',
                position: 'relative',
                transition: 'background 0.15s',
            }}>
                {/* Thumb — when busy, the thumb hosts a tiny spinner. */}
                <span style={{
                    position: 'absolute',
                    top: 2,
                    left: value ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    transition: 'left 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {busy ? (
                        <Loader2
                            size={11}
                            className="spin"
                            style={{ color: value ? '#10b981' : '#64748b' }}
                        />
                    ) : null}
                </span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Auto-approve walk-ins
                <span style={{
                    marginLeft: 0,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: busy
                        ? '#64748b'
                        : value ? '#10b981' : '#94a3b8',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    minWidth: 36,
                    justifyContent: 'center',
                    transition: 'background 0.15s',
                }}>
                    {busy ? (
                        <>
                            <Loader2 size={10} className="spin" /> Saving
                        </>
                    ) : value ? 'ON' : 'OFF'}
                </span>
            </span>
            {/* Indeterminate progress bar that runs along the bottom edge while busy. */}
            {busy ? (
                <span
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 2,
                        background:
                            'linear-gradient(90deg, transparent 0%, ' +
                            (value ? '#10b981' : '#64748b') +
                            ' 50%, transparent 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'autoApproveToggleBar 1.1s linear infinite',
                    }}
                />
            ) : null}
            {/* Keyframes injected once via <style> — keeps the component self-contained. */}
            <style>{`@keyframes autoApproveToggleBar {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }`}</style>
        </label>
    );
}
