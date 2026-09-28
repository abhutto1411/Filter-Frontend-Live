import React, { useState, useEffect } from 'react';
import { CreditCard, Wallet, Banknote, X, Check, ArrowRight, Trash2, Landmark, Smartphone } from 'lucide-react';

const METHODS = [
    { id: 'Cash', icon: Banknote, color: '#10b981', bg: '#ecfdf5' },
    { id: 'Card', icon: CreditCard, color: '#3b82f6', bg: '#eff6ff' },
    { id: 'Bank Transfer', icon: Landmark, color: '#6366f1', bg: '#eef2ff' },
    { id: 'Tabby', icon: Smartphone, color: '#0ea5e9', bg: '#f0f9ff' },
    { id: 'Tamara', icon: ArrowRight, color: '#f59e0b', bg: '#fffbeb' },
];

export default function PaymentSelectionModal({ 
    isOpen, 
    onClose, 
    onSave, 
    totalAmount = 0,
    initialPayments = [],
    loading = false 
}) {
    // payments: [{ method: 'Cash', amount: 100 }, ...]
    const [selectedPayments, setSelectedPayments] = useState(
        initialPayments.length > 0 ? initialPayments : [{ method: 'Cash', amount: totalAmount }]
    );

    useEffect(() => {
        if (isOpen && initialPayments.length === 0 && selectedPayments.length === 1) {
            // Auto-update amount if total changed and only one method exists
            const p = selectedPayments[0];
            if (p.amount !== totalAmount) {
                setSelectedPayments([{ ...p, amount: totalAmount }]);
            }
        }
    }, [isOpen, totalAmount]);

    if (!isOpen) return null;

    const toggleMethod = (methodId) => {
        const exists = selectedPayments.find(p => p.method === methodId);
        if (exists) {
            if (selectedPayments.length === 1) return; // Must have at least one
            setSelectedPayments(selectedPayments.filter(p => p.method !== methodId));
        } else {
            // Add new method with 0 amount initially or remaining
            const currentTotal = selectedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            const remaining = Math.max(0, totalAmount - currentTotal);
            setSelectedPayments([...selectedPayments, { method: methodId, amount: remaining }]);
        }
    };

    const updateAmount = (methodId, val) => {
        const numVal = parseFloat(val) || 0;
        setSelectedPayments(selectedPayments.map(p => 
            p.method === methodId ? { ...p, amount: numVal } : p
        ));
    };

    const totalPaid = selectedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const remaining = totalAmount - totalPaid;
    const isBalanced = Math.abs(remaining) < 0.01;

    const handleConfirm = () => {
        onSave(selectedPayments);
        onClose();
    };

    return (
        <div className="modal-overlay-modern">
            <div className="modal-container-compact" style={{ maxWidth: 500 }}>
                <div className="modal-header-slim">
                    <div className="header-info-compact">
                        <div className="modal-icon-bg gold">
                            <CreditCard size={20} color="#B48A14" />
                        </div>
                        <div>
                            <h3 className="modal-title-small">Payment Method</h3>
                            <p className="modal-subtitle-small">Split payment or single method</p>
                        </div>
                    </div>
                    <button className="close-btn-minimal" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body-compact">
                    {/* Method Selection Grid */}
                    <div className="payment-methods-grid-minimal">
                        {METHODS.map(m => {
                            const isSelected = selectedPayments.some(p => p.method === m.id);
                            return (
                                <button 
                                    key={m.id}
                                    className={`payment-method-card-minimal ${isSelected ? 'active' : ''}`}
                                    onClick={() => toggleMethod(m.id)}
                                >
                                    <div className="method-icon-minimal" style={{ background: m.bg, color: m.color }}>
                                        <m.icon size={22} />
                                    </div>
                                    <span className="method-name-minimal">{m.id}</span>
                                    {isSelected && (
                                        <div className="selected-indicator-minimal">
                                            <Check size={10} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Split Payment Inputs */}
                    <div className="split-payment-section">
                        <div className="section-header-compact">
                            <span>Payment Breakdown</span>
                            <span className={`balance-badge ${remaining > 0 ? 'pending' : (remaining < 0 ? 'over' : 'balanced')}`}>
                                {remaining > 0 ? `Remaining: SAR ${remaining.toFixed(2)}` : 
                                 remaining < 0 ? `Overpaid: SAR ${Math.abs(remaining).toFixed(2)}` : 
                                 'Balanced'}
                            </span>
                        </div>

                        <div className="payment-rows-container">
                            {selectedPayments.map((p, idx) => {
                                const methodInfo = METHODS.find(m => m.id === p.method);
                                return (
                                    <div key={p.method} className="payment-input-row">
                                        <div className="row-method-info">
                                            <div className="row-icon-small" style={{ background: methodInfo?.bg, color: methodInfo?.color }}>
                                                {methodInfo && <methodInfo.icon size={16} />}
                                            </div>
                                            <span className="row-name">{p.method}</span>
                                        </div>
                                        <div className="row-input-group">
                                            <span className="currency-prefix">SAR</span>
                                            <input 
                                                type="number" 
                                                value={p.amount}
                                                onChange={(e) => updateAmount(p.method, e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                            />
                                            {selectedPayments.length > 1 && (
                                                <button className="row-remove-btn" onClick={() => toggleMethod(p.method)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Total Summary */}
                    <div className="payment-total-summary">
                        <div className="total-row">
                            <span>Grand Total</span>
                            <span className="val-total">SAR {totalAmount.toFixed(2)}</span>
                        </div>
                        <div className="total-row">
                            <span>Total Entered</span>
                            <span className={`val-paid ${isBalanced ? 'balanced' : 'pending'}`}>SAR {totalPaid.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="modal-footer-compact">
                    <button className="btn-cancel-minimal" onClick={onClose}>Cancel</button>
                    <button 
                        className="btn-save-minimal" 
                        onClick={handleConfirm}
                        disabled={!isBalanced || totalPaid <= 0 || loading}
                    >
                        <Check size={18} />
                        {loading ? 'Processing...' : 'Confirm Payment'}
                    </button>
                </div>
            </div>

            <style>{`
                .payment-methods-grid-minimal {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 8px;
                    margin-bottom: 24px;
                }
                .payment-method-card-minimal {
                    background: #fff;
                    border: 1.5px solid #f1f5f9;
                    border-radius: 14px;
                    padding: 12px 6px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }
                .payment-method-card-minimal:hover {
                    border-color: #e2e8f0;
                    transform: translateY(-2px);
                }
                .payment-method-card-minimal.active {
                    border-color: #fcc247;
                    background: #fff9ec;
                }
                .method-icon-minimal {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .method-name-minimal {
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: #64748b;
                    text-align: center;
                }
                .active .method-name-minimal {
                    color: #1e293b;
                }
                .selected-indicator-minimal {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 18px;
                    height: 18px;
                    background: #fcc247;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #1e293b;
                    border: 2px solid #fff;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }

                .split-payment-section {
                    background: #f8fafc;
                    border-radius: 16px;
                    padding: 16px;
                    margin-bottom: 20px;
                }
                .section-header-compact {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #1e293b;
                }
                .balance-badge {
                    padding: 4px 8px;
                    border-radius: 8px;
                    font-size: 0.7rem;
                }
                .balance-badge.pending { background: #fef9c3; color: #854d0e; }
                .balance-badge.balanced { background: #dcfce7; color: #166534; }
                .balance-badge.over { background: #fee2e2; color: #991b1b; }

                .payment-rows-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .payment-input-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: #fff;
                    padding: 8px 12px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                }
                .row-method-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .row-icon-small {
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .row-name {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #1e293b;
                }
                .row-input-group {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .currency-prefix {
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: #94a3b8;
                }
                .row-input-group input {
                    width: 100px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 6px 10px;
                    font-size: 0.9rem;
                    font-weight: 800;
                    color: #1e293b;
                    text-align: right;
                }
                .row-input-group input:focus {
                    outline: none;
                    border-color: #fcc247;
                }
                .row-remove-btn {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                }
                .row-remove-btn:hover { color: #ef4444; }

                .payment-total-summary {
                    padding: 0 4px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #64748b;
                }
                .val-total { color: #1e293b; font-weight: 800; }
                .val-paid.pending { color: #f59e0b; }
                .val-paid.balanced { color: #10b981; }
            `}</style>
        </div>
    );
}

