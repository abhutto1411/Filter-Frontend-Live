import React, { useState } from 'react';
import { 
    Copy, Share2, Save, Globe, Landmark, User, CreditCard,
    AlertCircle, CheckCircle2, Info
} from 'lucide-react';
import { MOCK_USER } from '../referral-management/RM_Constants';
import { MOCK_RULES } from '../referral-management/RM_Rules';

export default function ReferrerSettings() {
    const [locale, setLocale] = useState('en');

    return (
        <div className="rf-content">
            <header className="rf-header">
                <div className="rf-welcome">
                    <h1>Settings</h1>
                    <p>Manage your account, preferences, and referral code.</p>
                </div>
            </header>

            <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Referral Code */}
                <div className="rf-card">
                    <h3 className="rf-card-title" style={{ marginBottom: '1.5rem' }}>Your Referral Code</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-bg-muted)', padding: '1rem', borderRadius: '12px' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.25rem', padding: '0.5rem 1rem', background: '#fff', borderRadius: '8px', border: '1px dashed var(--color-primary)', color: 'var(--color-primary)' }}>
                            {MOCK_USER.id}
                        </div>
                        <button className="rf-btn-outline" style={{ padding: '0.5rem 1rem' }}>
                            <Copy size={16} />
                            Copy Code
                        </button>
                        <button className="rf-btn-outline" style={{ padding: '0.5rem 1rem' }}>
                            <Share2 size={16} />
                            Share QR Code
                        </button>
                    </div>
                </div>

                {/* Referral Program Rules (Read-only) */}
                <div className="rf-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <AlertCircle size={20} color="var(--color-primary)" />
                        <h3 className="rf-card-title" style={{ margin: 0 }}>Referral Program Rules</h3>
                    </div>
                    <div style={{ background: 'rgba(255, 214, 0, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 214, 0, 0.2)', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <Info size={18} color="var(--color-primary)" />
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                            These rules are automatically applied based on your **{MOCK_USER.category}** account status.
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {MOCK_RULES.filter(r => r.type.toUpperCase() === MOCK_USER.category).map(rule => (
                            <div key={rule.id} style={{ padding: '1.25rem', border: '1px solid var(--color-border-light)', borderRadius: '16px', background: '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.9rem' }}>{rule.target.toUpperCase()}</span>
                                    <span style={{ padding: '4px 10px', background: '#ecfdf5', color: '#10b981', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800 }}>ACTIVE</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>Total Limit</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: 800, fontSize: '1rem' }}>{rule.limit} uses</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>Per Plate</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: 800, fontSize: '1rem' }}>{rule.plateLimit} uses</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>Discount</p>
                                        <p style={{ margin: '4px 0 0 0', fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-primary)' }}>{rule.discount}%</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Profile Information */}
                <div className="rf-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <User size={20} color="var(--color-primary)" />
                        <h3 className="rf-card-title" style={{ margin: 0 }}>Profile Information</h3>
                    </div>
                    <div className="rf-stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="rf-form-group">
                            <label className="rf-label">Full Name</label>
                            <input className="rf-input" defaultValue={MOCK_USER.name} />
                        </div>
                        <div className="rf-form-group">
                            <label className="rf-label">Mobile Number</label>
                            <input className="rf-input" defaultValue="+966 50 123 4567" />
                        </div>
                        <div className="rf-form-group">
                            <label className="rf-label">Email (Optional)</label>
                            <input className="rf-input" defaultValue={MOCK_USER.email} />
                        </div>
                        <div className="rf-form-group">
                            <label className="rf-label">Referrer Type</label>
                            <input className="rf-input" style={{ background: 'var(--color-bg-muted)', cursor: 'default' }} value={MOCK_USER.category} disabled />
                        </div>
                    </div>
                    <button className="rf-btn-primary">
                        <Save size={18} />
                        Save Changes
                    </button>
                </div>

                {/* Bank Details */}
                <div className="rf-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Landmark size={20} color="var(--color-primary)" />
                        <h3 className="rf-card-title" style={{ margin: 0 }}>Bank Details</h3>
                    </div>
                    <div className="rf-stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="rf-form-group">
                            <label className="rf-label">Bank Name</label>
                            <input className="rf-input" defaultValue="Al Rajhi Bank" />
                        </div>
                        <div className="rf-form-group">
                            <label className="rf-label">Bank IBAN</label>
                            <input className="rf-input" defaultValue="SA03 8000 0000 6080 1016 7519" />
                        </div>
                    </div>
                    <button className="rf-btn-primary">
                        <Save size={18} />
                        Save Changes
                    </button>
                </div>

                {/* Language */}
                <div className="rf-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Globe size={20} color="var(--color-primary)" />
                        <h3 className="rf-card-title" style={{ margin: 0 }}>Language</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                            className={`rf-btn-${locale === 'en' ? 'primary' : 'outline'}`}
                            onClick={() => setLocale('en')}
                            style={{ flex: 1, justifyContent: 'center' }}
                        >
                            <Globe size={18} />
                            English
                        </button>
                        <button 
                            className={`rf-btn-${locale === 'ar' ? 'primary' : 'outline'}`}
                            onClick={() => setLocale('ar')}
                            style={{ flex: 1, justifyContent: 'center' }}
                        >
                            <Globe size={18} />
                            العربية
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
