import React from 'react';
import { Wallet as WalletIcon, Download, Plus } from 'lucide-react';
import { MOCK_STATS } from './constants';

export default function Wallet() {
    return (
        <div className="ws-module-container">
            <div className="ws-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h2 className="ws-page-title" style={{ fontSize: '2.5rem' }}>Commission Ledger</h2>
                    <p className="ws-page-sub">Manage balances and track payout history.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="ws-btn-secondary"><Download size={18} /> Statement</button>
                    <button className="ws-btn-primary"><Plus size={18} /> Request Payout</button>
                </div>
            </div>
            
            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: '800px' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Available Balance</p>
                        <p className="ws-kpi-value">SAR {MOCK_STATS.availableBalance.toLocaleString()}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green"><WalletIcon size={24} /></div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Total Payouts</p>
                        <p className="ws-kpi-value">SAR {MOCK_STATS.paidCommission.toLocaleString()}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--blue"><WalletIcon size={24} /></div>
                </div>
            </div>
            
            <div className="ws-card">
                <div className="ws-card-header">
                    <h3 className="ws-card-title">Payout Log</h3>
                </div>
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Reference</th>
                            <th>Amount</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>2026-03-01</td>
                            <td style={{ opacity: 0.5 }}>PAY-92813</td>
                            <td style={{ fontWeight: 600 }}>SAR 10,000</td>
                            <td><span className="ws-status-badge ws-status-badge--success">Completed</span></td>
                        </tr>
                        <tr>
                            <td>2026-02-15</td>
                            <td style={{ opacity: 0.5 }}>PAY-91102</td>
                            <td style={{ fontWeight: 600 }}>SAR 15,000</td>
                            <td><span className="ws-status-badge ws-status-badge--success">Completed</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
