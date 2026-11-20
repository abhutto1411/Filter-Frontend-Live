import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { MOCK_REFERRALS } from './constants';

export default function AllReferrals() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeStatus, setActiveStatus] = useState('All');

    const statuses = ['All', 'Pending', 'Converted', 'Rejected'];

    const filteredReferrals = MOCK_REFERRALS.filter(r => {
        const matchesSearch = r.customerName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = activeStatus === 'All' || r.status === activeStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="ws-module-container">
            <div className="ws-page-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 className="ws-page-title" style={{ fontSize: '2.5rem' }}>Management Dashboard</h2>
                <p className="ws-page-sub">Track all submitted leads and their current conversion status.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', marginBottom: '40px' }}>
                <div className="ws-search-bar" style={{ width: '400px', position: 'relative' }}>
                    <Search className="ws-search-icon" size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                    <input 
                        type="text" 
                        placeholder="Search referrals..." 
                        className="ws-form-input" 
                        style={{ paddingLeft: '48px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="ws-status-tabs" style={{ background: '#333', padding: '6px', borderRadius: '12px' }}>
                    {statuses.map(s => (
                        <button 
                            key={s} 
                            onClick={() => setActiveStatus(s)}
                            className={`ws-tab-btn ${activeStatus === s ? 'active' : ''}`}
                            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: activeStatus === s ? 'var(--gradient-gold)' : 'transparent', color: activeStatus === s ? '#000' : '#888', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div className="ws-card">
                <table className="ws-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Customer Name</th>
                            <th>Service Type</th>
                            <th>Status</th>
                            <th>Commission</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredReferrals.length > 0 ? (
                            filteredReferrals.map(r => (
                                <tr key={r.id}>
                                    <td><code style={{ fontSize: '0.8rem', opacity: 0.5 }}>{r.id}</code></td>
                                    <td style={{ fontWeight: 600 }}>{r.customerName}</td>
                                    <td>{r.serviceType}</td>
                                    <td>
                                        <span className={`ws-status-badge ws-status-badge--${r.status.toLowerCase() === 'converted' ? 'success' : r.status.toLowerCase() === 'pending' ? 'warning' : 'danger'}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--gold)', fontWeight: 'bold' }}>{r.commission}</td>
                                    <td style={{ fontSize: '0.85rem', opacity: 0.6 }}>{r.date}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '100px', opacity: 0.4 }}>
                                    No referrals found matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
