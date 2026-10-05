import { useState, useEffect } from 'react';
import { ArrowLeft, UserCheck } from 'lucide-react';
import { apiFetch } from '../../services/api';

const DEPT_ICONS = {
    'oil': '🛢️', 'lube': '🛢️', 'wash': '🚿', 'repair': '🔧', 'tire': '🔄', 'tyre': '🔄',
    'wheel': '🔄', 'battery': '🔋', 'ac': '❄️', 'air': '❄️', 'brake': '🛑', 'engine': '⚙️',
    'inspect': '🔍', 'detail': '✨', 'electr': '⚡', 'diagnos': '💻', 'glass': '🪟',
    'paint': '🎨', 'body': '🚗', 'exhaust': '💨', 'suspension': '🔩', 'mechanic': '🔧',
};

function getDeptIcon(name = '') {
    const lower = name.toLowerCase();
    for (const [key, icon] of Object.entries(DEPT_ICONS)) {
        if (lower.includes(key)) return icon;
    }
    return '🔧';
}

export default function DepartmentSelect({ orderInfo, onBack, onSelectDept }) {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/cashier/takeaway/products-catalog')
            .then(data => {
                const raw = data.departments || data.catalog || data.data || data || [];
                const depts = (Array.isArray(raw) ? raw : []).map(d => ({
                    id: String(d.id || d.departmentId || ''),
                    name: d.name || d.department || d.departmentName || '',
                })).filter(d => d.name);
                setDepartments(depts);
            })
            .catch(() => setDepartments([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div style={{ width: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
                <div style={{ width: 4, height: 28, background: '#FCC247', borderRadius: 2 }} />
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#1E2124' }}>Select Department</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                        {orderInfo?.customer?.name || 'Walk-in'} · Plate: {orderInfo?.vehicle?.plateNumber || '–'}
                    </p>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} style={{ height: 160, borderRadius: 24, background: '#fff', border: '1px solid #f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                    {departments.map(dept => (
                        <button key={dept.id} onClick={() => onSelectDept(dept)}
                            style={{ height: 160, borderRadius: 24, border: '2.5px solid #f1f5f9', background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#FCC247'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(252,194,71,0.18)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                            <div style={{ width: 64, height: 64, borderRadius: 18, background: '#FFF9EC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem' }}>
                                {getDeptIcon(dept.name)}
                            </div>
                            <span style={{ fontWeight: 900, fontSize: '1rem', color: '#1E2124', textAlign: 'center', padding: '0 10px', lineHeight: 1.2 }}>{dept.name}</span>
                        </button>
                    ))}

                    {/* Direct to Technician */}
                    <button onClick={() => onSelectDept({ id: 'direct', name: 'Inspection / Direct to Technician' })}
                        style={{ height: 160, borderRadius: 24, border: '2.5px dashed #cbd5e1', background: '#f8fafc', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#FCC247'; e.currentTarget.style.background = '#FFF9EC'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}>
                        <div style={{ width: 64, height: 64, borderRadius: 18, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserCheck size={32} color="#94a3b8" />
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#64748b', textAlign: 'center', padding: '0 10px', lineHeight: 1.2 }}>Continue to Technician</span>
                    </button>
                </div>
            )}

            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
        </div>
    );
}

const iconBtn = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#475569', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' };
