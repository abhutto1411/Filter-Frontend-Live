import React from 'react';
import { X, CreditCard } from 'lucide-react';
import { rfT } from '../utils/referrerPortalI18n';

export default function PayoutModal({
    isOpen,
    onClose,
    balance = '0',
    iban = '',
    locale = 'en',
    submitting = false,
    error = '',
    amount,
    onAmountChange,
    onSubmit,
}) {
    if (!isOpen) return null;

    return (
        <div className="rf-modal-overlay" onClick={onClose}>
            <div className="rf-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="rf-modal-header">
                    <h3 className="rf-modal-title">{rfT(locale, 'payout.title')}</h3>
                    <button type="button" className="rf-modal-close" onClick={onClose} aria-label={rfT(locale, 'payout.cancel')}>
                        <X size={20} />
                    </button>
                </div>

                <div className="rf-form-group" style={{ marginBottom: 16 }}>
                    <label className="rf-label">{rfT(locale, 'payout.amount')}</label>
                    <input
                        className="rf-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={rfT(locale, 'payout.amountPh')}
                        autoFocus
                        value={amount}
                        onChange={(e) => onAmountChange?.(e.target.value)}
                        disabled={submitting}
                    />
                    <p className="rf-available-hint">
                        {rfT(locale, 'payout.available', { amount: balance })}
                    </p>
                    {error ? <p className="rf-available-hint" style={{ color: '#b42318' }}>{error}</p> : null}
                </div>

                <div className="rf-form-group" style={{ marginBottom: 20 }}>
                    <label className="rf-label">{rfT(locale, 'payout.bank')}</label>
                    <div className="rf-bank-preview">
                        <CreditCard size={16} />
                        <span>{iban || '—'}</span>
                    </div>
                </div>

                <div className="rf-modal-footer">
                    <button type="button" className="rf-btn-outline" onClick={onClose} disabled={submitting}>
                        {rfT(locale, 'payout.cancel')}
                    </button>
                    <button type="button" className="rf-btn-primary" onClick={onSubmit} disabled={submitting}>
                        {rfT(locale, 'payout.submit')}
                    </button>
                </div>
            </div>
        </div>
    );
}
