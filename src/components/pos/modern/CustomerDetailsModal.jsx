import React, { useState, useEffect } from 'react';
import { User, Phone, Mail, Car, X, Check, Hash, Activity, ShieldCheck } from 'lucide-react';

const buildFormData = (initialData = {}, vehicleInfo = {}) => ({
    name: initialData.name || '',
    phone: initialData.phone || '',
    email: initialData.email || '',
    vatNumber: initialData.vatNumber || '',
    odometerReading: initialData.odometerReading || '',
    vin: initialData.vin || '',
    // These might come from vehicleInfo but API expects them in billing
    vehicleNumber: initialData.vehicleNumber || vehicleInfo.vehicleNumber || '',
    make: initialData.make || vehicleInfo.make || '',
    model: initialData.model || vehicleInfo.model || '',
    year: initialData.year || vehicleInfo.year || '',
    color: initialData.color || vehicleInfo.color || '',
});

export default function CustomerDetailsModal({ isOpen, onClose, onSave, initialData = {}, vehicleInfo = {}, loading = false }) {
    const [formData, setFormData] = useState(() => buildFormData(initialData, vehicleInfo));

    // Reset the form to the latest props whenever the modal transitions open.
    // Without this, useState's initializer only runs on first mount — so when the
    // same modal instance reopens for a different order, the previous order's
    // customer/vehicle data was leaking into the inputs.
    useEffect(() => {
        if (isOpen) {
            setFormData(buildFormData(initialData, vehicleInfo));
        }
        // Intentionally only depend on isOpen: initialData/vehicleInfo are inline
        // objects that change identity every render, so including them would wipe
        // out the user's in-progress edits on every parent re-render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(formData);
    };

    return (
        <div className="modal-overlay-modern">
            <div className="modal-container-compact" style={{ maxWidth: 480 }}>
                <div className="modal-header-slim">
                    <div className="header-info-compact">
                        <div className="modal-icon-bg gold">
                            <User size={20} color="#B48A14" />
                        </div>
                        <div>
                            <h3 className="modal-title-small">Billing Details</h3>
                            <p className="modal-subtitle-small">Customer & Vehicle Data</p>
                        </div>
                    </div>
                    <button className="close-btn-minimal" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body-compact" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <div className="customer-form-minimal">
                        {/* Customer Info */}
                        <div className="section-title-minimal">
                            <User size={14} />
                            <span>Customer Information</span>
                        </div>
                        
                        <div className="input-group-minimal">
                            <label>Full Name</label>
                            <div className="input-wrapper-minimal">
                                <User size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Ahmed Ali"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="form-grid-2col">
                            <div className="input-group-minimal">
                                <label>Mobile Number</label>
                                <div className="input-wrapper-minimal">
                                    <Phone size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="+966..."
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="input-group-minimal">
                                <label>VAT Number (Optional)</label>
                                <div className="input-wrapper-minimal">
                                    <Hash size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="VAT-12345"
                                        value={formData.vatNumber}
                                        onChange={(e) => setFormData({...formData, vatNumber: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Vehicle Info */}
                        <div className="section-title-minimal" style={{ marginTop: 12 }}>
                            <Car size={14} />
                            <span>Vehicle Details</span>
                        </div>

                        <div className="form-grid-2col">
                            <div className="input-group-minimal">
                                <label>Plate Number</label>
                                <div className="input-wrapper-minimal">
                                    <Hash size={16} />
                                    <input 
                                        type="text" 
                                        placeholder="ABC-123"
                                        value={formData.vehicleNumber}
                                        onChange={(e) => setFormData({...formData, vehicleNumber: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="input-group-minimal">
                                <label>Odometer Reading</label>
                                <div className="input-wrapper-minimal">
                                    <Activity size={16} />
                                    <input 
                                        type="number" 
                                        placeholder="50000"
                                        value={formData.odometerReading}
                                        onChange={(e) => setFormData({...formData, odometerReading: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-grid-2col">
                            <div className="input-group-minimal">
                                <label>Make</label>
                                <div className="input-wrapper-minimal">
                                    <input 
                                        type="text" 
                                        placeholder="Toyota"
                                        value={formData.make}
                                        onChange={(e) => setFormData({...formData, make: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="input-group-minimal">
                                <label>Model</label>
                                <div className="input-wrapper-minimal">
                                    <input 
                                        type="text" 
                                        placeholder="Camry"
                                        value={formData.model}
                                        onChange={(e) => setFormData({...formData, model: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="input-group-minimal">
                            <label>VIN (Chassis Number)</label>
                            <div className="input-wrapper-minimal">
                                <ShieldCheck size={16} />
                                <input 
                                    type="text" 
                                    placeholder="1HGBH41..."
                                    value={formData.vin}
                                    onChange={(e) => setFormData({...formData, vin: e.target.value})}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer-compact">
                    <button className="btn-cancel-minimal" onClick={onClose}>Cancel</button>
                    <button className="btn-save-minimal" onClick={handleSave} disabled={loading}>
                        {loading ? '...' : (
                            <>
                                <Check size={18} />
                                Save Billing Info
                            </>
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                .customer-form-minimal {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .form-grid-2col {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .input-group-minimal label {
                    display: block;
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: #64748b;
                    margin-bottom: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .input-wrapper-minimal {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: #f8fafc;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 0 14px;
                    height: 44px;
                    transition: all 0.2s;
                }
                .input-wrapper-minimal:focus-within {
                    border-color: #fcc247;
                    background: #fff;
                    box-shadow: 0 0 0 4px rgba(252, 194, 71, 0.1);
                }
                .input-wrapper-minimal svg {
                    color: #94a3b8;
                    flex-shrink: 0;
                }
                .input-wrapper-minimal input {
                    background: none;
                    border: none;
                    outline: none;
                    width: 100%;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #1e293b;
                }

                .section-title-minimal {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.7rem;
                    font-weight: 900;
                    color: #1e293b;
                    text-transform: uppercase;
                    padding-bottom: 4px;
                    border-bottom: 1px dashed #e2e8f0;
                }
            `}</style>
        </div>
    );
}

