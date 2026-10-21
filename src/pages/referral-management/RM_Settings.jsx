import React from 'react';
import { 
    Shield, Building, User, Info, AlertCircle 
} from 'lucide-react';
import { MOCK_RULES } from './RM_Rules';

export default function RM_Settings() {
    return (
        <div className="rm-content">
            <div style={{ paddingBottom: '2rem' }}>
                <h2 className="rm-topbar-title">System Settings</h2>
                <p className="rm-topbar-sub">View global referral program configurations and rules.</p>
            </div>

            <div style={{ background: 'rgba(255, 214, 0, 0.08)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255, 214, 0, 0.3)', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <AlertCircle size={24} color="var(--rm-accent-gold)" />
                <div>
                    <p style={{ margin: 0, fontWeight: 700, color: '#111827', fontSize: '1rem' }}>Read-Only Configuration</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#4b5563' }}>
                        Referral rules are managed by the Super Admin. Changes here are for viewing purposes only.
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                {['Individual', 'Corporate', 'Franchise'].map(type => (
                    <div key={type} className="rm-card" style={{ height: 'fit-content' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem' }}>
                            {type === 'Individual' && <User size={20} color="var(--rm-accent-gold)" />}
                            {type === 'Corporate' && <Building size={20} color="var(--rm-accent-gold)" />}
                            {type === 'Franchise' && <Shield size={20} color="var(--rm-accent-gold)" />}
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827' }}>{type} Rules</h3>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {MOCK_RULES.filter(r => r.type === type).map(rule => (
                                <div key={rule.id} style={{ padding: '1rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--rm-accent-gold)', background: 'rgba(255,214,0,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                                            {rule.target.toUpperCase()}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>Active</span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <p style={{ margin: 0, fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>Limits</p>
                                            <p style={{ margin: '4px 0 0 0', fontWeight: 700, color: '#111827', fontSize: '0.9rem' }}>
                                                {rule.limit} total • {rule.plateLimit} / plate
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: '0.65rem', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>Reward</p>
                                            <p style={{ margin: '4px 0 0 0', fontWeight: 900, color: 'var(--rm-accent-gold)', fontSize: '1rem' }}>
                                                {rule.discount}% Discount
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {MOCK_RULES.filter(r => r.type === type).length === 0 && (
                                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '2rem 0', margin: 0 }}>
                                    No rules configured for {type.toLowerCase()} referrers.
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
