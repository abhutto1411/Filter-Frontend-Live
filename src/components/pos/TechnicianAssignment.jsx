import { useState, useEffect } from 'react';
import { Wrench, X, Zap, CheckCircle2, AlertTriangle, Radio, Users, Clock } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function TechnicianAssignment({ open, onClose, onAssign, orderInfo, departmentId, standalone }) {
    const [techs, setTechs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        if (!open && !standalone) return;
        setLoading(true);
        setSelected(null);
        const url = departmentId
            ? `/cashier/technicians?departmentId=${departmentId}`
            : '/cashier/technicians';
        apiFetch(url)
            .then(d => setTechs(d.technicians || d.data || d || []))
            .catch((err) => {
                console.warn('TechnicianAssignment fetch failed:', err.message);
                setTechs([]);
            })
            .finally(() => setLoading(false));
    }, [open, departmentId, standalone]);

    const handleConfirm = () => {
        if (!selected) return;
        onAssign(selected);
        onClose();
    };

    if (standalone) {
        return (
            <div style={{ width: '100%', minHeight: '100%', background: '#F8FAF9', padding: 24, boxSizing: 'border-box' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                    <div style={{ width: 4, height: 32, background: '#FCC247', borderRadius: 2 }} />
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#1E2124' }}>Workshop Personnel</h2>
                        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Active team members and availability on-site</p>
                    </div>
                </div>

                {/* Dashboard Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 }}>
                    <div style={{ background: '#23262D', borderRadius: 28, padding: 24, boxShadow: '0 10px 20px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 20, background: '#FFF9EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={32} color="#FCC247" />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#FCC247', fontWeight: 900, letterSpacing: 1.5 }}>TOTAL TEAM</p>
                            <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>{techs.length}</p>
                        </div>
                    </div>
                    <div style={{ background: '#fff', borderRadius: 28, padding: 24, border: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 20, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle2 size={32} color="#15803D" />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: 900, letterSpacing: 1.5 }}>ON DUTY / ACTIVE</p>
                            <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#1E2124' }}>{techs.filter(t => (t.status || '').toLowerCase() !== 'offline').length}</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} style={{ height: 120, borderRadius: 24, background: '#fff', border: '1.5px solid #f1f5f9', animation: 'pulse 1.5s infinite' }} />)}
                    </div>
                ) : techs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '100px 0', opacity: 0.4 }}>
                        <AlertTriangle size={64} style={{ marginBottom: 20 }} />
                        <h3 style={{ fontWeight: 900, margin: 0 }}>No Personnel Found</h3>
                        <p style={{ fontWeight: 600 }}>Technicians assigned to this workshop will appear here.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                        {techs.map(tech => {
                            const empId = tech.employeeId || tech.id;
                            const name = tech.employeeName || tech.name || tech.fullName || 'Technician';
                            const dept = tech.departmentName || tech.department?.name || 'General Workshop';
                            const phone = tech.mobile || tech.phone || '–';
                            const commission = tech.commissionPercentage || tech.commissionPercent || tech.commission || 0;
                            
                            return (
                                <div key={empId} style={{ background: '#fff', borderRadius: 24, padding: 20, border: '1.5px solid #f1f5f9', display: 'flex', gap: 16, transition: '0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }} className="tech-card">
                                    <div style={{ position: 'relative' }}>
                                        <div style={{ width: 64, height: 64, borderRadius: 20, background: '#F8FAF9', border: '2px solid #FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: '1.5rem', color: '#B48A14' }}>
                                            {name.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ 
                                            position: 'absolute', 
                                            bottom: -2, 
                                            right: -2, 
                                            width: 20, 
                                            height: 20, 
                                            borderRadius: '50%', 
                                            background: (tech.status || '').toLowerCase() === 'busy' ? '#FB923C' : (tech.status || '').toLowerCase() === 'offline' ? '#94A3B8' : '#10B981', 
                                            border: '3px solid #fff' 
                                        }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <p style={{ margin: '0 0 2px', fontWeight: 900, fontSize: '1.05rem', color: '#1E2124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#6366f1', background: '#eef2ff', padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Clock size={10} />
                                                {tech.usedSlots || 0}/{tech.totalSlots || 3} Slots
                                            </div>
                                        </div>
                                        <p style={{ margin: '0 0 8px', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>{dept}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '4px 10px', borderRadius: 8, background: '#F1F5F9', color: '#64748b' }}>
                                                {phone}
                                            </span>
                                            {commission > 0 && (
                                                <span style={{ fontSize: '0.7rem', fontWeight: 900, padding: '4px 10px', borderRadius: 8, background: '#FFF9EC', color: '#B48A14' }}>
                                                    {commission}% Comm.
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                <style>{`
                    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
                    .tech-card:hover { border-color: #23262D; transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.05); }
                `}</style>
            </div>
        );
    }

    if (!open) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(35,38,45,0.7)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 32, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
                {/* Header */}
                <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: '#FFF9EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Wrench size={22} color="#FCC247" />
                        </div>
                        <div>
                            <span style={{ display: 'block', fontWeight: 900, fontSize: '1.2rem', color: '#1E2124' }}>Pick Technician</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Assign responsibility for this job</span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: '#F8FAF9', border: 'none', borderRadius: 12, padding: 10, cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 28 }} className="hide-scroll">
                    {/* Job Context */}
                    <div style={{ padding: '16px 20px', background: '#F8FAF9', borderRadius: 20, border: '1.5px solid #f1f5f9', marginBottom: 24 }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 900, color: '#1E2124', fontSize: '0.95rem' }}>{orderInfo?.customer?.name || 'Walk-in Customer'}</p>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>
                            {orderInfo?.vehicle?.plateNumber && `Plate: ${orderInfo.vehicle.plateNumber} · `}
                            Dept: {orderInfo?.department || 'Workshop'}
                        </p>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                            <div style={{ width: 40, height: 40, border: '3px solid #f1f5f9', borderTopColor: '#FCC247', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
                            <p style={{ fontWeight: 800 }}>Fetching Personnel...</p>
                        </div>
                    ) : techs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                            <AlertTriangle size={48} color="#f59e0b" style={{ opacity: 0.3, marginBottom: 16 }} />
                            <p style={{ margin: 0, fontWeight: 900, color: '#1E2124' }}>No Availability</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>All technicians are currently offline or busy.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {techs.map(tech => {
                                const isSelected = selected?.id === (tech.employeeId || tech.id);
                                const empId = tech.employeeId || tech.id;
                                const name = tech.employeeName || tech.name || tech.fullName || 'Technician';
                                const commission = tech.commissionPercentage || tech.commissionPercent || tech.commission || 0;
                                
                                return (
                                    <button key={empId} onClick={() => setSelected({ ...tech, id: empId, name, commission })}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: 20, border: `2.5px solid ${isSelected ? '#FCC247' : '#f1f5f9'}`, background: isSelected ? '#FFF9EC' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ width: 48, height: 48, borderRadius: 16, background: isSelected ? '#FCC247' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: '1.2rem', color: isSelected ? '#23262D' : '#94a3b8', flexShrink: 0 }}>
                                                {name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <p style={{ margin: 0, fontWeight: 900, fontSize: '1rem', color: '#1E2124' }}>{name}</p>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: (tech.status || '').toLowerCase() === 'busy' ? '#FB923C' : (tech.status || '').toLowerCase() === 'offline' ? '#94A3B8' : '#10B981' }} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: isSelected ? '#B48A14' : '#94a3b8' }}>
                                                        {commission > 0 ? `${commission}% Commission` : 'Active'}
                                                    </p>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>•</span>
                                                    <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: '#6366f1' }}>
                                                        {tech.usedSlots || 0}/{tech.totalSlots || 3} Slots
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {isSelected && <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#FCC247', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={14} color="#23262D" fill="#23262D" /></div>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '24px 28px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 12, flexShrink: 0 }}>
                    <button onClick={onClose} style={{ flex: 1, height: 50, background: '#F1F5F9', border: 'none', borderRadius: 16, fontWeight: 900, color: '#64748b', cursor: 'pointer' }}>Dismiss</button>
                    <button onClick={handleConfirm} disabled={!selected}
                        style={{ flex: 1, height: 50, background: selected ? '#23262D' : '#E2E8F0', color: selected ? '#FCC247' : '#94A3B8', border: 'none', borderRadius: 16, fontWeight: 900, fontSize: '0.95rem', cursor: selected ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: selected ? '0 10px 20px rgba(0,0,0,0.1)' : 'none' }}>
                        <CheckCircle2 size={20} /> ASSIGN JOB
                    </button>
                </div>
            </div>
            <style>{`
                .hide-scroll::-webkit-scrollbar { display: none; }
                .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
            `}</style>
        </div>
    );
}

const DEFAULT_CATEGORIES = [
    { value: 'supplies', label: 'Supplies' },
    { value: 'cleaning', label: 'Cleaning' },
    { value: 'food', label: 'Food & Drinks' },
    { value: 'transport', label: 'Transport' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'other', label: 'Other' },
];
