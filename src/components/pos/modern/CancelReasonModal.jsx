import React, { useState } from 'react';
import { X, AlertCircle, Trash2 } from 'lucide-react';

export default function CancelReasonModal({
    isOpen,
    onClose,
    onConfirm,
    loading,
    title = 'Cancel Order',
    subtitle = 'This action cannot be undone.',
    warningMessage = 'This will void all jobs in the order.',
    placeholder = 'Why are you cancelling this order? (e.g., Customer changed mind, incorrect department...)',
    confirmLabel = 'Void Order',
    loadingLabel = 'Processing...',
}) {
    const [reason, setReason] = useState('');

    // Reset reason whenever the modal re-opens so the previous text doesn't leak
    // between different cancel targets (order vs job).
    React.useEffect(() => {
        if (isOpen) setReason('');
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!reason.trim()) {
            alert("Please provide a reason for cancellation.");
            return;
        }
        onConfirm(reason.trim());
    };

    return (
        <div className="modal-overlay-modern" onClick={onClose}>
            <div className="modal-container-medium" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header-premium" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ 
                            width: 48, height: 48, borderRadius: 14, 
                            background: '#fee2e2', display: 'flex', 
                            alignItems: 'center', justifyContent: 'center', color: '#ef4444' 
                        }}>
                            <Trash2 size={24} />
                        </div>
                        <div>
                            <h2 className="modal-title" style={{ margin: 0 }}>{title}</h2>
                            <p className="modal-subtitle" style={{ margin: 0 }}>{subtitle}</p>
                        </div>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="modal-body-simple" style={{ padding: '24px 32px' }}>
                    <div className="reason-input-group">
                        <label style={{ 
                            display: 'block', 
                            fontSize: '0.75rem', 
                            fontWeight: 800, 
                            color: '#94a3b8', 
                            letterSpacing: 1,
                            marginBottom: 10,
                            textTransform: 'uppercase'
                        }}>Reason for Cancellation</label>
                        <textarea
                            className="modern-textarea"
                            placeholder={placeholder}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            rows={4}
                            autoFocus
                        />
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 8, 
                            marginTop: 12, 
                            color: '#64748b', 
                            fontSize: '0.8rem',
                            fontWeight: 500
                        }}>
                            <AlertCircle size={14} />
                            <span>{warningMessage}</span>
                        </div>
                    </div>
                </div>

                <div className="modal-footer-premium" style={{ borderTop: 'none', paddingTop: 0 }}>
                    <button className="btn-modal btn-outline" onClick={onClose} disabled={loading}>Close</button>
                    <button
                        className="btn-modal btn-confirm"
                        style={{ background: '#ef4444', color: '#fff' }}
                        onClick={handleConfirm}
                        disabled={loading || !reason.trim()}
                    >
                        {loading ? loadingLabel : confirmLabel}
                    </button>
                </div>
            </div>

            <style>{`
                .modern-textarea {
                    width: 100%;
                    padding: 16px;
                    border-radius: 16px;
                    border: 2px solid var(--pos-border);
                    background: var(--pos-bg);
                    color: var(--pos-text-main);
                    font-family: inherit;
                    font-size: 0.9rem;
                    font-weight: 500;
                    resize: none;
                    transition: all 0.2s ease;
                    outline: none;
                }
                .modern-textarea:focus {
                    border-color: #ef4444;
                    background: #fff;
                    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.05);
                }
            `}</style>
        </div>
    );
}
