import React, { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { MOCK_LEDGER } from './RM_Constants';

export default function RM_Ledger() {
    const [selectedAccount, setSelectedAccount] = useState('All Accounts');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const accounts = [
        'All Accounts',
        '5100 — Referrer Commission Expense',
        '1010 — Cash',
        '1020 — Bank Account',
        '1030 — POS / Payment Gateway',
        '2110 — Commission Payable - AutoMax Franchise',
        '2111 — Commission Payable - Fleet Corp Ltd',
        '2112 — Commission Payable - James Wilson'
    ];

    return (
        <div className="rm-content">
            <div style={{ paddingBottom: '2rem' }}>
                <h2 className="rm-topbar-title">General Ledger</h2>
                <p className="rm-topbar-sub">Account-wise transaction history with running balances</p>
            </div>

            <div style={{ position: 'relative', marginBottom: '32px' }}>
                <div 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    style={{ 
                        width: '320px', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', 
                        background: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '0.9rem', color: '#374151'
                    }}
                >
                    {selectedAccount}
                    <ChevronDown size={18} style={{ opacity: 0.5 }} />
                </div>
                {isDropdownOpen && (
                    <div style={{ 
                        position: 'absolute', top: '100%', left: 0, width: '320px', background: '#fff', 
                        border: '1px solid #eee', borderRadius: '12px', marginTop: '4px', zIndex: 100,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.05)', overflow: 'hidden'
                    }}>
                        {accounts.map(acc => (
                            <div 
                                key={acc}
                                onClick={() => { setSelectedAccount(acc); setIsDropdownOpen(false); }}
                                style={{ 
                                    padding: '12px 16px', cursor: 'pointer', fontSize: '0.85rem',
                                    background: selectedAccount === acc ? '#f9fafb' : 'transparent',
                                    borderLeft: selectedAccount === acc ? '4px solid var(--rm-accent-gold)' : '4px solid transparent'
                                }}
                            >
                                {acc}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="rm-card" style={{ padding: '0' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em', background: '#f9fafb' }}>
                                <th style={{ padding: '12px 24px' }}>Date</th>
                                <th style={{ padding: '12px 24px' }}>Account</th>
                                <th style={{ padding: '12px 24px' }}>Reference</th>
                                <th style={{ padding: '12px 24px' }}>Narration</th>
                                <th style={{ padding: '12px 24px', textAlign: 'right' }}>Debit ($)</th>
                                <th style={{ padding: '12px 24px', textAlign: 'right' }}>Credit ($)</th>
                                <th style={{ padding: '12px 24px', textAlign: 'right' }}>Balance ($)</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '0.8125rem' }}>
                            {MOCK_LEDGER.map((l, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f8f9fa' }}>
                                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>{l.date}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 600 }}>{l.account}</td>
                                    <td style={{ padding: '16px 24px', color: '#10b981', fontWeight: 600 }}>{l.ref}</td>
                                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>{l.narration}</td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600 }}>{l.dr > 0 ? `$${l.dr.toLocaleString()}` : ''}</td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 600 }}>{l.cr > 0 ? `$${l.cr.toLocaleString()}` : ''}</td>
                                    <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 700 }}>SAR {l.balance.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
