import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Briefcase, Mail, MapPin, Phone, RefreshCw, User, Wrench } from 'lucide-react';
import { apiFetch } from '../../services/api';

function InfoRow({ label, value, icon: Icon }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--color-border, #E5E7EB)' }}>
            {Icon && <Icon size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-dark, #111)' }}>{value ?? '—'}</p>
            </div>
        </div>
    );
}

export default function TechnicianProfile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadProfile = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch('/technician/profile');
            if (!res?.success || !res.profile) {
                throw new Error(res?.message || 'Invalid profile response');
            }
            setProfile(res.profile);
        } catch (e) {
            setError(e.message || 'Failed to load profile');
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const dutyLabel = () => {
        if (!profile) return '—';
        if (profile.workshopDuty) return 'Workshop duty (in-house)';
        if (profile.onCallDuty) return 'On-call';
        return 'Offline';
    };

    return (
        <div>
            <div className="ws-page-header" style={{ marginBottom: 16 }}>
                <div>
                    <h2 className="ws-page-title">My profile</h2>
                    <p className="ws-page-sub">Details from your technician account</p>
                </div>
                <button type="button" className="btn-portal" onClick={loadProfile} disabled={loading}>
                    <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            {loading && !profile ? (
                <div className="ws-section" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Loading profile…
                </div>
            ) : profile ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                    <div className="ws-section" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="ws-kpi-icon ws-kpi-icon--yellow" style={{ width: 44, height: 44, borderRadius: 12 }}>
                                <User size={22} />
                            </div>
                            <div>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>{profile.name}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Technician #{profile.id}</p>
                            </div>
                        </div>
                        <div style={{ padding: '0 18px 8px' }}>
                            <InfoRow label="Email" value={profile.email} icon={Mail} />
                            <InfoRow label="Mobile" value={profile.mobile} icon={Phone} />
                            <InfoRow label="Employee ID" value={profile.employeeId} icon={Briefcase} />
                            <InfoRow label="Technician type" value={profile.technicianType} icon={Wrench} />
                            <InfoRow label="Duty mode" value={profile.dutyMode} icon={MapPin} />
                            <InfoRow label="Commission" value={profile.commissionPercent != null ? `${profile.commissionPercent}%` : '—'} icon={Briefcase} />
                            <div style={{ padding: '12px 0 4px' }}>
                                <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duty status</p>
                                <p style={{ margin: '8px 0 0', fontWeight: 700, fontSize: '0.875rem' }}>{dutyLabel()}</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                                    <span className={`ws-badge ${profile.workshopDuty ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                        Workshop: {profile.workshopDuty ? 'On' : 'Off'}
                                    </span>
                                    <span className={`ws-badge ${profile.onCallDuty ? 'ws-badge--purple' : 'ws-badge--gray'}`}>
                                        On-call: {profile.onCallDuty ? 'On' : 'Off'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ws-section" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--color-border)', fontWeight: 800, fontSize: '0.9rem' }}>
                            Workshop & branch
                        </div>
                        <div style={{ padding: '0 18px 8px' }}>
                            <InfoRow label="Workshop" value={profile.workshop?.name} icon={Building2} />
                            <InfoRow label="Branch" value={profile.branch?.name} icon={MapPin} />
                            <div style={{ padding: '12px 0 4px' }}>
                                <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Departments</p>
                                <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontWeight: 600, fontSize: '0.875rem' }}>
                                    {(profile.departments || []).length === 0 ? (
                                        <li style={{ color: 'var(--color-text-muted)' }}>None listed</li>
                                    ) : (
                                        profile.departments.map((d) => (
                                            <li key={d.id}>{d.name}</li>
                                        ))
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
