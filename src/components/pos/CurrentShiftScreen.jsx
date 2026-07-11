import { useState, useEffect } from 'react';
import { RefreshCw, User, Tag, MapPin, Clock, Timer } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function CurrentShiftScreen() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);
    const [elapsed, setElapsed] = useState('—');

    const fetch = () => {
        setLoading(true); setError(null);
        apiFetch('/cashier/session/current')
            .then(d => setSession(d.session || d.data || d))
            .catch(e => setError(e.message || 'Failed to load session'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetch(); }, []);

    const openedAt = session?.openedAt || session?.createdAt || session?.startTime;

    useEffect(() => {
        if (!openedAt) {
            setElapsed('—');
            return;
        }

        const updateElapsed = () => {
            const start = new Date(openedAt).getTime();
            const now = new Date().getTime();
            const diff = Math.max(0, now - start);

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const parts = [];
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
            parts.push(`${seconds}s`);

            setElapsed(parts.join(' '));
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);
        return () => clearInterval(interval);
    }, [openedAt]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#FCC247', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    if (error && !session) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                <p style={{ margin: '0 0 16px', fontWeight: 600 }}>{error}</p>
                <button onClick={fetch} style={{ padding: '10px 24px', background: '#23262D', color: '#FCC247', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
            </div>
        );
    }

    if (!session || (!session.id && !session.sessionId && !session.posSessionId)) {
        return (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                <Clock size={44} style={{ opacity: 0.2, marginBottom: 12 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No active session</p>
            </div>
        );
    }

    let parsedDate = openedAt;
    try {
        if (openedAt) parsedDate = new Date(openedAt).toLocaleString('en-SA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) {}

    return (
        <div style={{ width: '100%', padding: 24, boxSizing: 'border-box' }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* Header card */}
            <div style={{ background: 'linear-gradient(135deg, #23262D, #2C3136)', borderRadius: 20, padding: 28, marginBottom: 20, boxShadow: '0 8px 32px rgba(35,38,45,0.25)', color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div>
                        <p style={{ margin: '0 0 6px', color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: 1.2 }}>SHIFT DETAILS</p>
                        <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontSize: '0.72rem', fontWeight: 900 }}>
                            {(session.status || 'ACTIVE').toUpperCase()}
                        </span>
                    </div>
                    <button onClick={fetch} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, padding: 10, cursor: 'pointer', display: 'flex' }}>
                        <RefreshCw size={16} color="#fff" />
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <InfoTile label="Cashier"    value={session.cashierName || session.userName || 'Cashier'} Icon={User} />
                    <InfoTile label="Session ID" value={`#${session.posSessionId || session.id || '—'}`}      Icon={Tag}  />
                    <InfoTile label="Branch"     value={session.branchName || '—'}                             Icon={MapPin} />
                    <InfoTile label="Elapsed"    value={elapsed}                                               Icon={Timer} />
                </div>
            </div>

            {/* Details */}
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <DetailRow label="Opened At"      value={parsedDate || '—'}                       Icon={Clock} />
                <div style={{ height: 1, background: '#f1f5f9', margin: '16px 0' }} />
                <DetailRow label="Branch Address" value={session.branchAddress || 'N/A'}           Icon={MapPin} />
            </div>
        </div>
    </div>
);
}

function InfoTile({ label, value, Icon }) {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Icon size={13} color="#FCC247" />
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{label}</span>
            </div>
            <p style={{ margin: 0, color: '#fff', fontWeight: 900, fontSize: '0.9rem' }}>{value}</p>
        </div>
    );
}

function DetailRow({ label, value, Icon }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color="#23262D" />
            </div>
            <div>
                <p style={{ margin: '0 0 2px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{label}</p>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#23262D' }}>{value}</p>
            </div>
        </div>
    );
}
