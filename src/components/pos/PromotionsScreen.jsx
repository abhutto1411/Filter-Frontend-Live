import { useState, useEffect } from 'react';
import { ArrowLeft, Tag, Check, Copy, Gift } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function PromotionsScreen({ onBack }) {
    const [promos, setPromos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [entry, setEntry] = useState('');
    const [applying, setApplying] = useState(false);
    const [applyResult, setApplyResult] = useState(null);
    const [copied, setCopied] = useState('');

    useEffect(() => {
        apiFetch('/cashier/promo-codes')
            .then(d => {
                const list = d.promoCodes || d.promos || d.data || d || [];
                setPromos(Array.isArray(list) ? list : []);
            })
            .catch(() => setPromos([]))
            .finally(() => setLoading(false));
    }, []);

    const applyPromo = async () => {
        const code = entry.trim();
        if (!code) return;
        setApplying(true);
        setApplyResult(null);
        try {
            // Reference endpoint: POST /cashier/promo-code/apply with { code, orderAmount }
            // On this screen we're only validating a code (no order context), so orderAmount = 0.
            const res = await apiFetch('/cashier/promo-code/apply', {
                method: 'POST',
                body: JSON.stringify({ code, orderAmount: 0 }),
            });
            const valid = res.valid !== false && (res.promo || res.data || res);
            if (valid) {
                const p = res.promo || res.data || res;
                setApplyResult({ ok: true, msg: `Promo "${p.code || code}" is valid.`, promo: p });
            } else {
                setApplyResult({ ok: false, msg: res.message || 'Promo code is not valid' });
            }
        } catch (e) {
            setApplyResult({ ok: false, msg: e.message || 'Failed to validate promo' });
        } finally {
            setApplying(false);
        }
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(code);
            setTimeout(() => setCopied(''), 1500);
        }).catch(() => {});
    };

    return (
        <div style={{ width: '100%', minHeight: '100%', background: '#F8FAF9', padding: 24, boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                {onBack && <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>}
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#1E2124' }}>Promo Codes</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Apply discounts or browse active promotions for your customers</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 32, alignItems: 'start' }}>
                {/* Left: Application Section */}
                <div style={{ position: 'sticky', top: 24 }}>
                    <div style={{ background: '#23262D', borderRadius: 24, padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.1)', color: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(252,194,71,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Tag size={22} color="#FCC247" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#FCC247' }}>Apply Code</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Validate promo code manually</p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ position: 'relative' }}>
                                <input type="text" value={entry} onChange={e => setEntry(e.target.value.toUpperCase())}
                                    placeholder="ENTER CODE HERE..." autoCapitalize="characters"
                                    style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: '2px solid #3a3f48', background: '#1a1d23', color: '#fff', fontSize: '1rem', fontWeight: 700, letterSpacing: 2, outline: 'none', textAlign: 'center', fontFamily: 'monospace' }} />
                            </div>

                            <button onClick={applyPromo} disabled={applying || !entry.trim()}
                                style={{ width: '100%', height: 56, background: applying || !entry.trim() ? '#3a3f48' : '#FCC247', color: '#23262D', border: 'none', borderRadius: 16, fontWeight: 900, fontSize: '1rem', cursor: applying || !entry.trim() ? 'not-allowed' : 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                                {applying ? 'Validating...' : <><Check size={20} strokeWidth={3} /> Validate Code</>}
                            </button>
                        </div>

                        {applyResult && (
                            <div style={{ marginTop: 24, padding: 16, borderRadius: 16, background: applyResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1.5px solid ${applyResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, color: applyResult.ok ? '#4ade80' : '#f87171', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: applyResult.ok ? '#15803D' : '#B91C1C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {applyResult.ok ? <Check size={14} strokeWidth={4} /> : <span style={{ fontSize: 16 }}>!</span>}
                                </div>
                                {applyResult.msg}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Available Promos */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#1E2124' }}>Active Promo Codes</h3>
                        {!loading && <span style={{ background: '#fff', padding: '4px 12px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', border: '1.5px solid #f1f5f9' }}>{promos.length} APPROVED</span>}
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[1, 2, 3].map(i => <div key={i} style={{ height: 140, borderRadius: 24, background: '#fff', border: '1.5px solid #f1f5f9', animation: 'pulse 1.5s infinite' }} />)}
                        </div>
                    ) : promos.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px 0', background: '#fff', borderRadius: 24, border: '1.5px dashed #e5e7eb' }}>
                            <Tag size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                            <p style={{ margin: 0, fontWeight: 800, color: '#94a3b8' }}>No approved promo codes for this branch yet</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {promos.map((p, i) => {
                                const code = p.code || p.promoCode || p.name || '';
                                const discount = p.discountValue || p.discountAmount || p.discount || 0;
                                const discountType = String(p.discountType || '').toLowerCase();
                                const isPercent = discountType.includes('percent') || discountType === 'percentage';
                                const expiry = p.validTo || p.expiresAt || p.endsAt || p.expiryDate;
                                const usageLimit = p.usageLimit ?? null;
                                const usageCount = p.usageCount ?? 0;
                                const remaining = p.remainingUses ?? (usageLimit != null ? Math.max(0, usageLimit - usageCount) : null);
                                const isAvailable = p.isAvailable !== false && (remaining == null || remaining > 0);
                                
                                return (
                                    <div key={p.id || i} style={{ background: '#fff', borderRadius: 24, padding: 24, border: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ width: 64, height: 64, borderRadius: 20, background: '#FFF9EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Gift size={28} color="#D4A017" />
                                        </div>

                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
                                                <p style={{ margin: 0, fontWeight: 900, fontSize: '1.1rem', color: '#1E2124', fontFamily: 'monospace', letterSpacing: 1 }}>{code}</p>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: isAvailable ? '#15803D' : '#B91C1C', background: isAvailable ? '#DCFCE7' : '#FEE2E2', padding: '3px 8px', borderRadius: 6 }}>
                                                    {isAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
                                                </span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                                                {isPercent ? `${discount}% Discount` : `SAR ${discount} Fixed Discount`}
                                                {p.promotionName ? ` · ${p.promotionName}` : ''}
                                                {expiry && ` · Valid until ${new Date(expiry).toLocaleDateString('en-SA', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                                            </p>
                                            {usageLimit != null && (
                                                <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>
                                                    Uses: {usageCount} / {usageLimit}
                                                    {remaining != null ? ` · ${remaining} remaining` : ''}
                                                </p>
                                            )}
                                        </div>

                                        <button onClick={() => copyCode(code)}
                                            style={{ height: 48, padding: '0 20px', borderRadius: 14, border: `2.5px solid ${copied === code ? '#15803D' : '#f1f5f9'}`, background: copied === code ? '#DCFCE7' : '#fff', color: copied === code ? '#15803D' : '#64748b', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: '0.2s' }}>
                                            {copied === code ? <><Check size={16} strokeWidth={3} /> Copied</> : <><Copy size={16} /> Copy Code</>}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                .monospace { font-family: 'Space Mono', 'Courier New', monospace; }
            `}</style>
        </div>
    );
}

const iconBtn = { width: 44, height: 44, background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' };
