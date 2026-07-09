import { CreditCard, Wallet, TrendingUp } from 'lucide-react';
import { MOCK_TRANSACTIONS, MOCK_PAYOUTS } from './ReferrerConstants';
import PayoutModal from '../../components/PayoutModal';

export default function ReferrerWallet() {
    const [isPayoutModalOpen, setIsPayoutModalOpen] = React.useState(false);

    return (
        <div className="rf-content">
            <PayoutModal 
                isOpen={isPayoutModalOpen} 
                onClose={() => setIsPayoutModalOpen(false)} 
                balance="12,300" 
            />
            <header className="rf-header">
                <div className="rf-welcome">
                    <h1>Wallet & Earnings</h1>
                    <p>Manage your commissions and payout requests.</p>
                </div>
            </header>

            <div className="rf-wallet-grid">
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                            <Wallet size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <div className="rf-stat-info">
                        <p className="rf-stat-value">12,300</p>
                        <p className="rf-stat-label">Available Balance</p>
                    </div>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon" style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04' }}>
                            <TrendingUp size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <div className="rf-stat-info">
                        <p className="rf-stat-value">8,450</p>
                        <p className="rf-stat-label">Pending Earnings</p>
                    </div>
                </div>
                <div className="rf-stat-card">
                    <div className="rf-stat-header">
                        <div className="rf-stat-icon" style={{ background: 'var(--color-accent)', color: 'var(--color-primary)' }}>
                            <TrendingUp size={20} />
                        </div>
                        <span className="rf-stat-unit">SAR</span>
                    </div>
                    <div className="rf-stat-info">
                        <p className="rf-stat-value">45,750</p>
                        <p className="rf-stat-label">Total Earned</p>
                    </div>
                </div>
            </div>

            <div className="rf-actions-bar">
                <button className="rf-btn-primary" onClick={() => setIsPayoutModalOpen(true)}>
                    <CreditCard size={18} />
                    Request Payout
                </button>
            </div>

            <div className="rf-card" style={{ marginBottom: '2rem' }}>
                <div className="rf-card-header">
                    <h3 className="rf-card-title">Transactions</h3>
                </div>
                <div className="rf-table-container">
                    <table className="rf-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_TRANSACTIONS.map((tx, idx) => (
                                <tr key={idx}>
                                    <td style={{ color: 'var(--color-text-faint)' }}>{tx.date}</td>
                                    <td style={{ fontWeight: 600 }}>{tx.description}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{tx.amount}</td>
                                    <td>
                                        <span className={`rf-badge rf-badge-${tx.status.toLowerCase()}`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="rf-card">
                <div className="rf-card-header">
                    <h3 className="rf-card-title">Payout History</h3>
                </div>
                <div className="rf-table-container">
                    <table className="rf-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th style={{ textAlign: 'right' }}>Amount (SAR)</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_PAYOUTS.map((p, idx) => (
                                <tr key={idx}>
                                    <td style={{ color: 'var(--color-text-faint)' }}>{p.date}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.amount}</td>
                                    <td>
                                        <span className={`rf-badge rf-badge-${p.status.toLowerCase()}`}>
                                            {p.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
