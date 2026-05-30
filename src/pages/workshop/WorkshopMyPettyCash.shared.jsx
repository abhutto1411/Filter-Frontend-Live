import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquare, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
    listExpenseMessages,
    addExpenseMessage,
} from '../../services/employeeExpenseApi';

export const formatSar = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return x.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function StatusBadge({ status }) {
    const map = {
        pending: { bg: '#FEF3C7', fg: '#92400E', icon: Clock, label: 'Pending' },
        approved: { bg: '#D1FAE5', fg: '#065F46', icon: CheckCircle, label: 'Approved' },
        rejected: { bg: '#FEE2E2', fg: '#991B1B', icon: XCircle, label: 'Rejected' },
    };
    const cfg = map[status] || map.pending;
    const Icon = cfg.icon;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: cfg.bg, color: cfg.fg,
            padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
        }}>
            <Icon size={12} /> {cfg.label}
        </span>
    );
}

export function MessageThread({ requestId, onClose }) {
    const [messages, setMessages] = useState([]);
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listExpenseMessages(requestId);
            setMessages(res?.messages ?? []);
        } finally {
            setLoading(false);
        }
    }, [requestId]);

    useEffect(() => { load(); }, [load]);

    const send = async () => {
        if (!body.trim() || sending) return;
        setSending(true);
        try {
            await addExpenseMessage(requestId, { body: body.trim() });
            setBody('');
            await load();
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{
            padding: 20, background: 'white', borderRadius: 12,
            border: '1px solid #E2E8F0', marginBottom: 16,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <MessageSquare size={16} /> Conversation
                </strong>
                <button type="button" className="btn-portal-outline" onClick={onClose}>Close</button>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
                {loading ? <p className="form-help-text">Loading…</p> :
                    messages.length === 0 ? <p className="form-help-text">No messages yet.</p> :
                        messages.map((m) => (
                            <div key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                                    <strong>{m.user?.name || m.user?.email || 'User'}</strong>
                                    <span style={{ color: '#94A3B8' }}>{new Date(m.createdAt).toLocaleString()}</span>
                                </div>
                                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.body}</p>
                            </div>
                        ))
                }
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    type="text"
                    className="form-input-field"
                    placeholder="Write a message…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                />
                <button type="button" className="btn-portal" disabled={sending} onClick={send}>
                    {sending ? 'Sending…' : 'Send'}
                </button>
            </div>
        </div>
    );
}
