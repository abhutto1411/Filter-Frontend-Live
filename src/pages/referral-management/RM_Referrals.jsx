import React, { useState } from 'react';
import { 
    Search, Plus, Bell, MoreHorizontal, 
    Check, X, Eye, Phone, User, Users, DollarSign
} from 'lucide-react';
import { MOCK_REFERRALS } from './RM_Constants';

const CreateReferralModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyCenter: 'center', zIndex: 1000, padding: '24px' }}>
            <div className="rm-card" style={{ width: '100%', maxWidth: '520px', margin: 'auto', position: 'relative', borderRadius: '16px' }}>
                <button onClick={onClose} style={{ position: 'absolute', right: '16px', top: '16px', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.4 }}>
                    <X size={20} />
                </button>
                <h3 className="rm-card-title" style={{ marginBottom: '24px', fontSize: '1.25rem' }}>Create Referral</h3>
                
                <div style={{ display: 'grid', gap: '20px', marginBottom: '24px' }}>
                    <div className="ws-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Referrer</label>
                        <select style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem' }}>
                            <option>Select referrer</option>
                            <option>AutoMax Franchise</option>
                            <option>Fleet Corp Ltd</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="ws-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Customer Name</label>
                            <input type="text" placeholder="" style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem' }} />
                        </div>
                        <div className="ws-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Phone</label>
                            <input type="text" placeholder="" style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
                        <div className="ws-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Service Type</label>
                            <input type="text" placeholder="Oil Change, Full Service..." style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem' }} />
                        </div>
                        <div className="ws-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Service Amount ($)</label>
                            <input type="number" placeholder="0" style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem' }} />
                        </div>
                    </div>

                    <div className="ws-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Notes</label>
                        <textarea rows={3} style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'none' }} />
                    </div>
                </div>

                <button 
                    className="ws-btn-primary" 
                    style={{ width: '100%', background: 'var(--rm-accent-gold)', color: '#fff', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 700 }}
                    onClick={onClose}
                >
                    Submit Referral
                </button>
            </div>
        </div>
    );
};

export default function RM_Referrals() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    return (
        <div className="rm-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                <div>
                    <h2 className="rm-topbar-title">Referrals</h2>
                    <p className="rm-topbar-sub">Track and manage referral lifecycle</p>
                </div>
                <button 
                    className="ws-btn-primary" 
                    style={{ background: 'var(--rm-accent-gold)', color: '#fff', fontSize: '0.85rem', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px' }}
                    onClick={() => setIsModalOpen(true)}
                >
                    <Plus size={18} /> New Referral
                </button>
            </div>

            <div className="rm-card" style={{ padding: '0', border: '1px solid #eee' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '350px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', opacity: 0.3 }} />
                        <input 
                            type="text" 
                            placeholder="Search referrals..." 
                            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', background: '#f9fafb' }} 
                        />
                    </div>
                    <select style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem', background: '#f9fafb', color: '#6b7280' }}>
                        <option>All Status</option>
                        <option>Approved</option>
                        <option>Under Review</option>
                        <option>Submitted</option>
                    </select>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#fff', fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '16px 24px' }}>ID</th>
                                <th style={{ padding: '16px 24px' }}>Customer</th>
                                <th style={{ padding: '16px 24px' }}>Referrer</th>
                                <th style={{ padding: '16px 24px' }}>Service</th>
                                <th style={{ padding: '16px 24px' }}>Amount</th>
                                <th style={{ padding: '16px 24px' }}>Status</th>
                                <th style={{ padding: '16px 24px' }}>Commission</th>
                                <th style={{ padding: '16px 24px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '0.8rem' }}>
                            {MOCK_REFERRALS.map(r => (
                                <tr key={r.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                                    <td style={{ padding: '16px 24px', color: 'var(--rm-accent-gold)', fontWeight: 600 }}>{r.id}</td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 700, color: '#111827' }}>{r.customerName}</span>
                                            <span style={{ fontSize: '0.7rem', opacity: 0.5, color: 'var(--rm-accent-gold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Phone size={10} /> {r.phone}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', color: '#4b5563' }}>{r.referrer}</td>
                                    <td style={{ padding: '16px 24px', color: '#6b7280' }}>{r.serviceType}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 700, color: '#111827' }}>${r.amount.toLocaleString()}</td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span className={`rm-badge rm-badge--${r.status.toLowerCase().replace(' ', '_')}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        {r.commission ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 700, color: '#111827' }}>${r.commission}</span>
                                                <span 
                                                    style={{ 
                                                        background: r.commStatus === 'paid' ? '#eff6ff' : '#dcfce7', 
                                                        color: r.commStatus === 'paid' ? '#1d4ed8' : '#15803d',
                                                        fontSize: '0.6rem', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', fontHeight: 800
                                                    }}
                                                >
                                                    {r.commStatus}
                                                </span>
                                            </div>
                                        ) : (
                                            <span style={{ opacity: 0.3 }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', gap: '12px', opacity: 0.6 }}>
                                            {r.status === 'Under Review' ? (
                                                <>
                                                    <Check size={16} style={{ color: 'var(--rm-accent-gold)', cursor: 'pointer' }} />
                                                    <X size={16} style={{ color: '#ef4444', cursor: 'pointer' }} />
                                                </>
                                            ) : (
                                                <>
                                                    <Eye size={16} style={{ cursor: 'pointer' }} />
                                                    <Check size={16} style={{ color: 'var(--rm-accent-gold)', cursor: 'pointer', opacity: r.status === 'Approved' ? 1 : 0.3 }} />
                                                    <X size={16} style={{ color: '#ef4444', cursor: 'pointer', opacity: 0.3 }} />
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <CreateReferralModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        </div>
    );
}
