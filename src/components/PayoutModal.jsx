import React from 'react';
import { X, DollarSign, CreditCard } from 'lucide-react';

export default function PayoutModal({ isOpen, onClose, balance }) {
    if (!isOpen) return null;

    return (
        <div className="rf-modal-overlay" onClick={onClose}>
            <div className="rf-modal-content" onClick={e => e.stopPropagation()}>
                <div className="rf-card-header" style={{ marginBottom: '2rem' }}>
                    <h3 className="rf-modal-title">Request Payout</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>
                        <X size={20} />
                    </button>
                </div>

                <div className="rf-form-group">
                    <label className="rf-label">Amount (SAR)</label>
                    <div style={{ position: 'relative' }}>
                        <input className="rf-input" type="number" placeholder="0.00" autoFocus />
                    </div>
                    <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        Available Balance: <span style={{ fontWeight: 600, color: '#16a34a' }}>{balance} SAR</span>
                    </p>
                </div>

                <div className="rf-form-group">
                    <label className="rf-label">Bank Account</label>
                    <div className="rf-input" style={{ background: 'var(--color-bg-muted)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <CreditCard size={18} />
                        <span>SA03 8000 0000 6080 1016 7519</span>
                    </div>
                </div>

                <div className="rf-modal-footer">
                    <button className="rf-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                        Submit Request
                    </button>
                    <button className="rf-btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
