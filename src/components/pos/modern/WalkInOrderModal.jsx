import React, { useState } from 'react';
import { X, Car, Hash, Gauge, Plus, Check, RefreshCw } from 'lucide-react';

export default function WalkInOrderModal({ isOpen, onClose, onSubmit, departments, loading }) {
    const [formData, setFormData] = useState({
        vehicleNumber: '',
        make: '',
        model: '',
        odometerReading: '',
        departmentIds: []
    });

    if (!isOpen) return null;

    const toggleDept = (id) => {
        setFormData(prev => {
            const exists = prev.departmentIds.includes(String(id));
            const next = exists 
                ? prev.departmentIds.filter(d => d !== String(id))
                : [...prev.departmentIds, String(id)];
            return { ...prev, departmentIds: next };
        });
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!formData.vehicleNumber || formData.departmentIds.length === 0) {
            alert('Please enter Plate Number and select at least one Department.');
            return;
        }
        onSubmit({
            ...formData,
            odometerReading: parseInt(formData.odometerReading) || 0,
            clientSubmittedAt: new Date().toISOString(),
            utcOffsetMinutes: -new Date().getTimezoneOffset(),
        });
    };

    return (
        <div className="modal-overlay-modern" onClick={onClose}>
            <div className="modal-container-medium" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <div className="modal-header-premium">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div className="header-icon-box"><Car size={24} /></div>
                        <div>
                            <h2 className="modal-title">New Walk-in Order</h2>
                            <p className="modal-subtitle">Enter vehicle details to start a job</p>
                        </div>
                    </div>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleFormSubmit}>
                    <div className="modal-body-simple">
                        <div className="walkin-form-grid">
                            <div className="form-group">
                                <label><Hash size={14} /> Plate Number</label>
                                <input 
                                    className="modern-input"
                                    type="text" 
                                    placeholder="ABC-123"
                                    value={formData.vehicleNumber}
                                    onChange={e => setFormData({...formData, vehicleNumber: e.target.value.toUpperCase()})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label><Gauge size={14} /> Odometer Reading</label>
                                <input 
                                    className="modern-input"
                                    type="number" 
                                    placeholder="50000"
                                    value={formData.odometerReading}
                                    onChange={e => setFormData({...formData, odometerReading: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Make</label>
                                <input 
                                    className="modern-input"
                                    type="text" 
                                    placeholder="Toyota"
                                    value={formData.make}
                                    onChange={e => setFormData({...formData, make: e.target.value})}
                                />
                            </div>
                            <div className="form-group">
                                <label>Model</label>
                                <input 
                                    className="modern-input"
                                    type="text" 
                                    placeholder="Camry"
                                    value={formData.model}
                                    onChange={e => setFormData({...formData, model: e.target.value})}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: 28 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 4, height: 18, borderRadius: 2, background: '#FCC247' }} />
                                    <label style={{ fontSize: '0.72rem', fontWeight: 900, color: '#64748b', letterSpacing: 1.2, textTransform: 'uppercase' }}>Select Departments</label>
                                </div>
                                {formData.departmentIds.length > 0 && (
                                    <span style={{ 
                                        padding: '3px 10px', borderRadius: 20, 
                                        background: '#23262D', color: '#FCC247', 
                                        fontSize: '0.7rem', fontWeight: 900 
                                    }}>
                                        {formData.departmentIds.length} selected
                                    </span>
                                )}
                            </div>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                                gap: 10 
                            }}>
                                {departments.map(dept => {
                                    const isSelected = formData.departmentIds.includes(String(dept.id));
                                    return (
                                        <button 
                                            key={dept.id}
                                            type="button"
                                            onClick={() => toggleDept(dept.id)}
                                            style={{
                                                position: 'relative',
                                                padding: '14px 12px',
                                                borderRadius: 14,
                                                border: isSelected ? '2px solid #FCC247' : '1.5px solid #e2e8f0',
                                                background: isSelected 
                                                    ? 'linear-gradient(135deg, #23262D 0%, #2d3139 100%)' 
                                                    : '#fff',
                                                color: isSelected ? '#FCC247' : '#475569',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: 8,
                                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                                boxShadow: isSelected 
                                                    ? '0 4px 16px rgba(252,194,71,0.2)' 
                                                    : '0 2px 6px rgba(0,0,0,0.04)',
                                                transform: isSelected ? 'translateY(-2px)' : 'none',
                                                fontFamily: 'inherit',
                                                overflow: 'hidden',
                                                textTransform: 'capitalize',
                                            }}
                                            onMouseEnter={e => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.borderColor = '#FCC247';
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(252,194,71,0.12)';
                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                if (!isSelected) {
                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)';
                                                    e.currentTarget.style.transform = 'none';
                                                }
                                            }}
                                        >
                                            {/* Top accent bar */}
                                            <div style={{
                                                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                                                background: isSelected ? '#FCC247' : 'transparent',
                                                borderRadius: '14px 14px 0 0',
                                                transition: 'background 0.2s',
                                            }} />
                                            {/* Icon circle */}
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10,
                                                background: isSelected ? 'rgba(252,194,71,0.15)' : '#f8fafc',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s',
                                                border: isSelected ? '1.5px solid rgba(252,194,71,0.3)' : '1px solid #f1f5f9',
                                            }}>
                                                {isSelected 
                                                    ? <Check size={18} strokeWidth={3} color="#FCC247" />
                                                    : <Plus size={16} color="#94a3b8" />
                                                }
                                            </div>
                                            <span style={{ 
                                                lineHeight: 1.2, textAlign: 'center', 
                                                fontSize: '0.78rem', wordBreak: 'break-word' 
                                            }}>
                                                {dept.name}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            {departments.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>
                                    No departments available
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="modal-footer-premium">
                        <button type="button" className="btn-modal btn-clear" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button 
                            type="submit" 
                            className="btn-modal btn-confirm" 
                            style={{ flex: 2 }}
                            disabled={loading}
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Submit Walk-in Order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

