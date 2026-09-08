import React, { useState } from 'react';
import { 
    DollarSign, Wallet, Search, Filter, Plus, X 
} from 'lucide-react';
import { MOCK_PAYOUTS } from './RM_Constants';

const PayoutStat = ({ label, value, icon: Icon, color }) => (
    <div className="rm-card" style={{ flex: 1 }}>
        <div className="rm-kpi-header">
            <div className="rm-kpi-icon" style={{ background: `${color}15`, color: color }}>
                <Icon size={20} />
            </div>
        </div>
        <p className="rm-kpi-value" style={{ fontSize: '1.5rem' }}>SAR {value.toLocaleString()}</p>
        <p className="rm-kpi-label">{label}</p>
    </div>
);

const ProcessPayoutModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyCenter: 'center', zIndex: 1000, padding: '24px' }}>
            <div className="rm-card" style={{ width: '100%', maxWidth: '440px', margin: 'auto', position: 'relative', borderRadius: '16px' }}>
                <button onClick={onClose} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4 }}>
                    <X size={20} />
                </button>
                <h3 className="rm-card-title" style={{ marginBottom: '24px', fontSize: '1.25rem' }}>Process Payout</h3>
                <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
                    <div className="ws-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Referrer</label>
                        <select style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                            <option>Select referrer</option>
                            <option>AutoMax Franchise</option>
                            <option>Fleet Corp Ltd</option>
                            <option>James Wilson</option>
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="ws-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Amount ($)</label>
                            <input type="number" placeholder="0" style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem' }} />
                        </div>
                        <div className="ws-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Payment Method</label>
                            <select style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                                <option>Bank Transfer</option>
                                <option>Stripe</option>
                                <option>PayPal</option>
                            </select>
                        </div>
                    </div>
                </div>
                <button 
                    className="ws-btn-primary" 
                    style={{ width: '100%', background: 'var(--rm-accent-gold)', color: '#fff', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 700 }}
                    onClick={onClose}
                >
                    Process Payment
                </button>
            </div>
        </div>
    );
};

export default function RM_Payouts() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="rm-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '2rem' }}>
                <div>
                    <h2 className="rm-topbar-title">Payouts</h2>
                    <p className="rm-topbar-sub">Process commission payouts to referrers</p>
                </div>
                <button 
                    className="ws-btn-primary" 
                    style={{ background: '#10b981', color: '#fff', fontSize: '0.85rem', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px' }}
                    onClick={() => setIsModalOpen(true)}
                >
                    <Wallet size={16} /> Process Payout
                </button>
            </div>

            <div className="rm-kpi-grid" style={{ display: 'flex', gap: '24px' }}>
                <PayoutStat label="Available for Payout" value={2050} icon={Wallet} color="#10b981" />
                <PayoutStat label="Total Paid" value={0} icon={DollarSign} color="#10b981" />
            </div>

            <div className="rm-card" style={{ padding: '0', marginTop: '32px' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6' }}>
                    <h3 className="rm-card-title">Payout History</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '12px 20px' }}>Payout ID</th>
                                <th style={{ padding: '12px 20px' }}>Referrer</th>
                                <th style={{ padding: '12px 20px' }}>Amount</th>
                                <th style={{ padding: '12px 20px' }}>Method</th>
                                <th style={{ padding: '12px 20px' }}>Status</th>
                                <th style={{ padding: '12px 20px' }}>Date</th>
                            </tr>
                        </thead>
                    </table>
                    <div style={{ padding: '100px 0', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                        No payouts processed yet.
                    </div>
                </div>
            </div>

            <ProcessPayoutModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
