import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building2, Wallet, Edit, Phone, Mail, MapPin, Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';
import { filterPortalVisibleBranches } from '../../services/workshopStaffApi';

export function EditProfileModal({ profile, onClose, onSave, saving }) {
    const [formData, setFormData] = useState({
        name: profile?.name || '',
        email: profile?.email || '',
        companyName: profile?.corporateAccount?.companyName || '',
        vatNumber: profile?.corporateAccount?.vatNumber || '',
        billingAddress: profile?.corporateAccount?.billingAddress || '',
        phoneNumber: profile?.corporateAccount?.phoneNumber || '',
        selectedStoreIds: (profile?.corporateAccount?.selectedStoreIds || []).map(String),
        newPassword: '',
    });
    const [showNew, setShowNew] = useState(false);
    const [formError, setFormError] = useState('');
    const availableWorkshops = Array.isArray(profile?.availableWorkshops)
        ? profile.availableWorkshops
        : [];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (formError) setFormError('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (formData.newPassword && formData.newPassword.length < 6) {
            setFormError('New password must be at least 6 characters.');
            return;
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            setFormError('Please enter a valid email address.');
            return;
        }

        // Send only what's relevant: omit newPassword entirely if blank.
        const payload = {
            name: formData.name,
            email: formData.email,
            companyName: formData.companyName,
            vatNumber: formData.vatNumber,
            billingAddress: formData.billingAddress,
            phoneNumber: formData.phoneNumber,
            selectedStoreIds: formData.selectedStoreIds,
        };
        if (formData.newPassword) {
            payload.newPassword = formData.newPassword;
        }
        onSave(payload);
    };

    const toggleBranch = (branchId) => {
        const id = String(branchId);
        setFormData((prev) => {
            const selected = prev.selectedStoreIds || [];
            const exists = selected.includes(id);
            return {
                ...prev,
                selectedStoreIds: exists
                    ? selected.filter((x) => x !== id)
                    : [...selected, id],
            };
        });
    };

    return (
        <Modal 
            title="Edit Corporate Profile" 
            onClose={onClose} 
            footer={
                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                    <button className="btn-portal-outline" onClick={onClose} disabled={saving}>Cancel</button>
                    <button className="btn-portal" onClick={handleSubmit} disabled={saving}>
                        {saving ? <Loader2 size={16} className="spin" /> : 'Save Changes'}
                    </button>
                </div>
            } 
            width="720px"
        >
            <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
                {formError && (
                    <div style={{padding:'10px 12px', borderRadius:10, background:'#FEF2F2', color:'#B91C1C', fontSize:'0.8125rem', border:'1px solid #FECACA'}}>
                        {formError}
                    </div>
                )}

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                    <div className="ws-form-group">
                        <label style={{display:'block', fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6}}>User Name</label>
                        <input
                            type="text"
                            name="name"
                            style={{width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--color-border)', fontSize:'0.875rem'}}
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g. John Doe"
                            required
                        />
                    </div>
                    <div className="ws-form-group">
                        <label style={{display:'block', fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6}}>Email</label>
                        <input
                            type="email"
                            name="email"
                            style={{width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--color-border)', fontSize:'0.875rem'}}
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="name@company.com"
                            autoComplete="email"
                        />
                    </div>
                </div>

                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                    <div className="ws-form-group">
                        <label style={{display:'block', fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6}}>Company Name</label>
                        <input
                            type="text"
                            name="companyName"
                            style={{width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--color-border)', fontSize:'0.875rem'}}
                            value={formData.companyName}
                            onChange={handleChange}
                            placeholder="e.g. Acme Logistics LLC"
                        />
                    </div>
                    <div className="ws-form-group">
                        <label style={{display:'block', fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6}}>VAT Number</label>
                        <input
                            type="text"
                            name="vatNumber"
                            style={{width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--color-border)', fontSize:'0.875rem'}}
                            value={formData.vatNumber}
                            onChange={handleChange}
                            placeholder="e.g. 310123456700003"
                        />
                    </div>
                </div>

                <div className="ws-form-group">
                    <label style={{display:'block', fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6}}>Phone Number</label>
                    <input
                        type="text"
                        name="phoneNumber"
                        style={{width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--color-border)', fontSize:'0.875rem'}}
                        value={formData.phoneNumber}
                        onChange={handleChange}
                        placeholder="+966..."
                    />
                </div>

                <div className="ws-form-group">
                    <label style={{display:'block', fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6}}>Billing Address</label>
                    <textarea
                        name="billingAddress"
                        style={{width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--color-border)', fontSize:'0.875rem', minHeight:80, resize:'vertical'}}
                        value={formData.billingAddress}
                        onChange={handleChange}
                        placeholder="Enter full billing address"
                    />
                </div>

                <div className="ws-form-group">
                    <label style={{display:'flex', alignItems:'center', gap:6, fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6}}>
                        <Lock size={12}/> New Password
                        <span style={{fontSize:'0.6875rem', fontWeight:500, textTransform:'none', color:'var(--color-text-muted)'}}>(leave blank to keep current)</span>
                    </label>
                    <div style={{position:'relative'}}>
                        <input
                            type={showNew ? 'text' : 'password'}
                            name="newPassword"
                            style={{width:'100%', padding:'10px 36px 10px 12px', borderRadius:10, border:'1px solid var(--color-border)', fontSize:'0.875rem'}}
                            value={formData.newPassword}
                            onChange={handleChange}
                            placeholder="At least 6 characters"
                            autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowNew(s => !s)} style={{position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--color-text-muted)', padding:4}} tabIndex={-1}>
                            {showNew ? <EyeOff size={16}/> : <Eye size={16}/>}
                        </button>
                    </div>
                </div>
                <div className="ws-form-group">
                    <label style={{display:'block', fontSize:'0.75rem', fontWeight:700, color:'var(--color-text-muted)', textTransform:'uppercase', marginBottom:6}}>
                        Workshops & Branches
                    </label>
                    <div style={{maxHeight:260, overflowY:'auto', border:'1px solid var(--color-border)', borderRadius:10, padding:10}}>
                        {availableWorkshops.length === 0 ? (
                            <p style={{margin:0, fontSize:'0.8125rem', color:'var(--color-text-muted)'}}>No workshop branches available.</p>
                        ) : availableWorkshops.map((ws) => (
                            <div key={ws.id} style={{marginBottom:12}}>
                                <div style={{fontWeight:800, fontSize:'0.8125rem', marginBottom:6}}>{ws.name}</div>
                                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:8}}>
                                    {(ws.branches || []).map((b) => {
                                        const checked = formData.selectedStoreIds.includes(String(b.id));
                                        return (
                                            <label key={b.id} style={{display:'flex', alignItems:'center', gap:8, fontSize:'0.8125rem', padding:8, border:'1px solid var(--color-border-light)', borderRadius:8, cursor:'pointer'}}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleBranch(b.id)}
                                                />
                                                <span>{b.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </form>
        </Modal>
    );
}


export default function CorporateProfile({ onTabChange }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [manageBranches, setManageBranches] = useState(null);

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiFetch('/corporate/profile');
            if (data.success || data.id) { // Some APIs return success: true, others just data
                setProfile(data);
            }
        } catch (err) {
            console.error('Failed to fetch profile:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const workshopsForDisplay = useMemo(() => {
        const w = profile?.workshops;
        if (!Array.isArray(w)) return [];
        return w
            .map((ws) => ({
                ...ws,
                branches: filterPortalVisibleBranches(ws.branches || []),
            }))
            .filter((ws) => ws.branches.length > 0);
    }, [profile?.workshops]);

    const handleUpdateProfile = async (formData) => {
        try {
            setSaving(true);
            const data = await apiFetch('/corporate/profile', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });
            if (data.success || data.id) {
                // Refresh profile data
                await fetchProfile();
                setEditModalOpen(false);
            }
        } catch (err) {
            console.error('Update failed:', err);
            alert(`Failed to update profile: ${err.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Profile</h2><p className="ws-page-sub">Corporate profile</p></div></div>
            <div className="ws-section" style={{display:'flex', justifyContent:'center', alignItems:'center', padding:100}}>
                <Loader2 className="spin" size={40} style={{color:'var(--color-primary)'}} />
            </div>
        </div>
    );

    if (error) return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Profile</h2><p className="ws-page-sub">Corporate profile</p></div></div>
            <div className="ws-section" style={{textAlign:'center',padding:48,color:'var(--color-text-muted)'}}>
                <p style={{color:'#DC2626'}}>Error: {error}</p>
                <button className="btn-portal" style={{marginTop: 12}} onClick={fetchProfile}>Retry Loading</button>
            </div>
        </div>
    );

    const ca = profile?.corporateAccount;

    const handleSaveBranches = (corpId, ids) => {
        // Implementation for saving branches if PUT API supported it, 
        // currently we focus on the requested /corporate/profile items.
        console.log('Save branches:', corpId, ids);
    };
    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Profile</h2><p className="ws-page-sub">Corporate profile</p></div></div>
            <div className="ws-section" style={{marginBottom:0}}>
                <div style={{padding:20}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                        <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                            <div style={{width:52,height:52,borderRadius:14,background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Building2 size={26} style={{color:'#2563EB'}}/></div>
                            <div>
                                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                                    <strong style={{fontSize:'1.0625rem'}}>{ca?.companyName || 'Corporate Client'}</strong>
                                    <span className="ws-badge ws-badge--blue">Corporate</span>
                                </div>
                                <div style={{display:'flex', flexDirection:'column', gap:4}}>
                                    <p style={{fontSize:'0.8125rem',color:'var(--color-text-muted)',margin:0, display:'flex', alignItems:'center', gap:6}}><Edit size={12}/> Contact: {profile?.name}</p>
                                    <p style={{fontSize:'0.8125rem',color:'var(--color-text-muted)',margin:0, display:'flex', alignItems:'center', gap:6}}><Mail size={12}/> {profile?.email}</p>
                                    <p style={{fontSize:'0.8125rem',color:'var(--color-text-muted)',margin:0, display:'flex', alignItems:'center', gap:6}}><Phone size={12}/> {ca?.phoneNumber || 'No phone'}</p>
                                    <p style={{fontSize:'0.8125rem',color:'var(--color-text-muted)',margin:0, display:'flex', alignItems:'center', gap:6}}><MapPin size={12}/> {ca?.billingAddress || 'No billing address'}</p>
                                </div>
                                <p style={{fontSize:'0.8125rem',color:'var(--color-text-muted)',marginTop:6, fontWeight:600}}>VAT: {ca?.vatNumber || 'N/A'}</p>
                            </div>
                        </div>
                        <div style={{display:'flex',gap:12,alignItems:'center'}}>
                            <button className="btn-portal-outline" style={{padding:'8px 12px', fontSize:'0.75rem'}} onClick={() => setEditModalOpen(true)}><Edit size={14}/> Edit Profile</button>
                        </div>
                    </div>
                    <div style={{padding:14,background:'#FAF5FF',borderRadius:12,marginTop:14,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div><p style={{fontSize:'0.75rem',color:'#7C3AED',margin:0}}>Wallet Balance</p><p style={{fontWeight:700,color:'#6D28D9',margin:'2px 0 0 0'}}>SAR {(ca?.walletBalance || 0).toLocaleString()}</p></div>
                        <button className="btn-portal" style={{padding:'6px 12px',fontSize:'0.75rem',background:'#7C3AED',color:'#fff',border:'none'}} onClick={()=>onTabChange?.('wallet')}><Wallet size={14}/> Top-up</button>
                    </div>
                    <div style={{marginTop:14,paddingTop:14,borderTop:'1px solid var(--color-border-light)'}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                            <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:0}}>Active Workshops & Branches</p>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:10}}>
                            {workshopsForDisplay.map(ws => (
                                <div key={ws.id} style={{padding:12, background:'var(--color-bg-muted)', borderRadius:12}}>
                                    <p style={{fontWeight:700, fontSize:'0.875rem', marginBottom:6, color:'var(--color-primary)'}}>{ws.name}</p>
                                    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                                        {ws.branches.map(b => (
                                            <span key={b.id} className="ws-badge ws-badge--blue" style={{fontSize:'0.6875rem'}} title={b.address}>{b.name}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {workshopsForDisplay.length === 0 && <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)'}}>No active workshops assigned.</p>}
                        </div>
                    </div>
                </div>
            </div>
            {editModalOpen && <EditProfileModal profile={profile} saving={saving} onClose={()=>setEditModalOpen(false)} onSave={handleUpdateProfile}/>}
        </div>
    );
}
