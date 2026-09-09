import React from 'react';
import { BookOpen, DollarSign } from 'lucide-react';
import { MOCK_LEDGER } from './constants';

export default function CommissionLedger() {
    const totalDebit = 1000;
    const totalCredit = 400;
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Commission Ledger</h2><p className="ws-page-sub">Double-entry journal entries for commissions</p></div></div>
            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Total Entries</p><p className="ws-kpi-value">{MOCK_LEDGER.length}</p></div><div className="ws-kpi-icon ws-kpi-icon--blue"><BookOpen size={22} /></div></div>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Total Debit</p><p className="ws-kpi-value">SAR {totalDebit.toLocaleString()}</p></div><div className="ws-kpi-icon ws-kpi-icon--red"><DollarSign size={22} /></div></div>
                <div className="ws-kpi-card"><div><p className="ws-kpi-label">Total Credit</p><p className="ws-kpi-value">SAR {totalCredit.toLocaleString()}</p></div><div className="ws-kpi-icon ws-kpi-icon--green"><DollarSign size={22} /></div></div>
            </div>
            <div className="ws-section">
                <table className="ws-table">
                    <thead><tr><th>Date</th><th>Entry #</th><th>Description</th><th>Account</th><th>Debit</th><th>Credit</th></tr></thead>
                    <tbody>{MOCK_LEDGER.map((e, i) => (
                        <tr key={i}><td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{e.date}</td><td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{e.entry}</td><td>{e.description}</td><td style={{ fontSize: '0.8125rem' }}>{e.account}</td>
                            <td style={{ fontWeight: 700, color: '#DC2626' }}>{e.debit}</td><td style={{ fontWeight: 700, color: '#16A34A' }}>{e.credit}</td></tr>
                    ))}</tbody>
                </table>
            </div>
        </div>
    );
}
