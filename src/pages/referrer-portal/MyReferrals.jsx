import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { MOCK_REFERRALS } from './ReferrerConstants';

export default function MyReferrals() {
    const [filter, setFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredReferrals = MOCK_REFERRALS.filter(ref => {
        const matchesSearch = ref.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'All' || ref.status === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="rf-content">
            <header className="rf-header">
                <div className="rf-welcome">
                    <h1>My Referrals</h1>
                    <p>Track and manage all your submitted leads.</p>
                </div>
            </header>

            <div className="rf-actions-bar" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <Search 
                        size={18} 
                        style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }} 
                    />
                    <input 
                        className="rf-input" 
                        placeholder="Search..." 
                        style={{ paddingLeft: '3rem' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="rf-filter-group" style={{ display: 'flex', gap: '0.5rem', background: '#e5e7eb', padding: '4px', borderRadius: '10px' }}>
                    {['All', 'Pending', 'Converted', 'Rejected'].map(f => (
                        <button 
                            key={f}
                            className={`rf-filter-btn`}
                            style={{ 
                                background: filter === f ? '#fff' : 'transparent',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: filter === f ? '#000' : 'var(--color-text-muted)',
                                boxShadow: filter === f ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                             }}
                            onClick={() => setFilter(f)}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="rf-card">
                <div className="rf-table-container">
                    <table className="rf-table">
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
                            {filteredReferrals.map((ref, idx) => (
                                <tr key={idx}>
                                    <td style={{ color: 'var(--color-text-faint)', fontSize: '0.8rem' }}>{ref.id}</td>
                                    <td style={{ fontWeight: 600 }}>{ref.name}</td>
                                    <td>{ref.service}</td>
                                    <td>
                                        <span className={`rf-badge rf-badge-${ref.status.toLowerCase()}`}>
                                            {ref.status}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 700 }}>{ref.commission}</td>
                                    <td>{ref.date}</td>
                                </tr>
                            ))}
                            {filteredReferrals.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', opacity: 0.5, fontStyle: 'italic' }}>
                                        No referrals found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
