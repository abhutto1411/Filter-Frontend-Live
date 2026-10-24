import React, { useState } from 'react';
import { 
    Search, Plus, Filter, MoreHorizontal, 
    Mail, Phone, ExternalLink, X 
} from 'lucide-react';
import { MOCK_REFERRERS } from './RM_Constants';

const AddReferrerModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyCenter: 'center', zIndex: 1000 }}>
            <div className="rm-card" style={{ width: '500px', margin: 'auto', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4 }}>
                    <X size={20} />
                </button>
                <h3 className="rm-card-title" style={{ marginBottom: '24px', fontSize: '1.25rem' }}>Add New Referrer</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div className="ws-field">
                        <label>Referrer ID</label>
                        <input type="text" placeholder="FR-001" defaultValue="FR-001" />
                    </div>
                    <div className="ws-field">
                        <label>Name</label>
                        <input type="text" placeholder="Company Name" />
                    </div>
                    <div className="ws-field">
                        <label>Email</label>
                        <input type="email" placeholder="email@example.com" />
                    </div>
                    <div className="ws-field">
                        <label>Phone</label>
                        <input type="text" placeholder="+1234567890" />
                    </div>
                    <div className="ws-field">
                        <label>Type</label>
                        <select><option>Individual</option><option>Franchise</option></select>
                    </div>
                    <div className="ws-field">
                        <label>Commission Type</label>
                        <select><option>Percentage</option><option>Fixed</option></select>
                    </div>
                    <div className="ws-field">
                        <label>Value</label>
                        <input type="number" placeholder="5" />
                    </div>
                </div>
                <button 
                    className="ws-btn-primary" 
                    style={{ width: '100%', background: 'var(--rm-accent-gold)', color: '#fff', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 700 }}
                    onClick={onClose}
                >
                    Create Referrer
                </button>
            </div>
        </div>
    );
};

export default function RM_Referrers() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="rm-content">
            <div style={{ paddingBottom: '2rem' }}>
                <h2 className="rm-topbar-title">Referrers</h2>
                <p className="rm-topbar-sub">Manage referrer partners and commission rules</p>
            </div>

            <div className="rm-card" style={{ padding: '0' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', opacity: 0.3 }} />
                        <input 
                            type="text" 
                            placeholder="Search referrers..." 
                            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem' }} 
                        />
                    </div>
                    <button 
                        className="ws-btn-primary" 
                        style={{ background: 'var(--rm-accent-gold)', color: '#fff', fontSize: '0.85rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => setIsModalOpen(true)}
                    >
                        <Plus size={16} /> Add Referrer
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '12px 20px' }}>ID</th>
                                <th style={{ padding: '12px 20px' }}>Name</th>
                                <th style={{ padding: '12px 20px' }}>Type</th>
                                <th style={{ padding: '12px 20px' }}>Commission</th>
                                <th style={{ padding: '12px 20px' }}>Earned</th>
                                <th style={{ padding: '12px 20px' }}>Paid</th>
                                <th style={{ padding: '12px 20px' }}>Available</th>
                                <th style={{ padding: '12px 20px' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '0.85rem' }}>
                            {MOCK_REFERRERS.map(r => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '16px 20px', color: 'var(--rm-accent-gold)', fontWeight: 600 }}>{r.id}</td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <p style={{ fontWeight: 700 }}>{r.name}</p>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.5 }}>{r.email}</p>
                                    </td>
                                    <td style={{ padding: '16px 20px', color: '#6b7280' }}>{r.type}</td>
                                    <td style={{ padding: '16px 20px', fontWeight: 700 }}>{r.commission}</td>
                                    <td style={{ padding: '16px 20px' }}>${r.earned.toLocaleString()}</td>
                                    <td style={{ padding: '16px 20px' }}>${r.paid.toLocaleString()}</td>
                                    <td style={{ padding: '16px 20px', fontWeight: 700 }}>${r.available.toLocaleString()}</td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#166534', padding: '2px 10px', borderRadius: '4px', fontWeight: 600 }}>
                                            {r.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AddReferrerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
