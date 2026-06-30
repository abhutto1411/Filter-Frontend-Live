import { useState, useEffect } from 'react';
import { ArrowLeft, User, Building2, Car, Hash, Wrench, Gauge, FileText, MapPin, Lock, ChevronDown, Save } from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function AddNewOrder({ onBack, onProceed, prefilledCustomer }) {
    const isCorp = prefilledCustomer?.customerType === 'corporate' || prefilledCustomer?.customer_type === 'corporate';
    const [tab, setTab] = useState(isCorp ? 'corporate' : 'walkin');

    // Walk-in: vehicle-only (matches Flutter)
    const [walkin, setWalkin] = useState({ plate: '', vin: '', make: '', model: '', odometer: '' });

    // Corporate: account dropdown + vehicle
    const [corpCustomers, setCorpCustomers] = useState([]);
    const [corpCustomerId, setCorpCustomerId] = useState(isCorp ? prefilledCustomer?.id : '');
    const [corpDropdownOpen, setCorpDropdownOpen] = useState(false);
    const [corpVehicle, setCorpVehicle] = useState({ plate: '', vin: '', make: '', model: '', odometer: '' });
    const [loadingCorp, setLoadingCorp] = useState(false);

    useEffect(() => {
        setLoadingCorp(true);
        apiFetch('/cashier/corporate-accounts')
            .then(d => setCorpCustomers(d.accounts || d.data || d || []))
            .catch(() => setCorpCustomers([]))
            .finally(() => setLoadingCorp(false));
    }, []);

    const wSet = (k, v) => setWalkin(f => ({ ...f, [k]: v }));
    const vSet = (k, v) => setCorpVehicle(f => ({ ...f, [k]: v }));

    const selectedCorp = corpCustomers.find(c => c.id === corpCustomerId);

    const sanitizeVin = (val) => val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
    const sanitizeNumeric = (val) => val.replace(/[^0-9]/g, '');

    const walkinValid = walkin.plate.trim().length > 0;
    const corpValid = corpCustomerId && corpVehicle.plate.trim() && corpVehicle.make.trim() && corpVehicle.model.trim() && corpVehicle.odometer.trim();

    const handleWalkinProceed = () => {
        if (!walkinValid) return;
        onProceed({
            type: 'walk_in',
            customer: {
                id: prefilledCustomer?.id || null,
                name: prefilledCustomer?.name || prefilledCustomer?.fullName || '',
                mobile: prefilledCustomer?.mobile || prefilledCustomer?.phone || '',
                vatNumber: prefilledCustomer?.vatNumber || '',
            },
            vehicle: {
                plateNumber: walkin.plate.trim(),
                vin: walkin.vin.trim(),
                make: walkin.make.trim(),
                model: walkin.model.trim(),
                odometer: walkin.odometer.trim(),
            },
        });
    };

    const handleCorpProceed = () => {
        if (!corpValid) return;
        onProceed({
            type: 'corporate',
            customer: {
                id: selectedCorp.id,
                name: selectedCorp.companyName || selectedCorp.name || '',
                companyName: selectedCorp.companyName || selectedCorp.name || '',
                mobile: selectedCorp.mobile || selectedCorp.phone || '',
                vatNumber: selectedCorp.vatNumber || '',
                billingAddress: selectedCorp.billingAddress || selectedCorp.address || '',
            },
            vehicle: {
                plateNumber: corpVehicle.plate.trim(),
                vin: corpVehicle.vin.trim(),
                make: corpVehicle.make.trim(),
                model: corpVehicle.model.trim(),
                odometer: corpVehicle.odometer.trim(),
            },
        });
    };

    return (
        <div style={{ width: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button onClick={onBack} style={iconBtn}><ArrowLeft size={18} /></button>
                <div style={{ width: 4, height: 26, background: '#FCC247', borderRadius: 2 }} />
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#1E2124' }}>Add New Order</h2>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Choose customer type and enter vehicle details</p>
                </div>
            </div>

            {/* Tab Switcher — Flutter golden pill */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#ECEEF1', borderRadius: 14, padding: 5, gap: 4, marginBottom: 18 }}>
                {[{ key: 'walkin', icon: User, label: 'Normal Customer' }, { key: 'corporate', icon: Building2, label: 'Corporate' }].map(t => {
                    const active = tab === t.key;
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 800, transition: 'all 0.15s', background: active ? '#FCC247' : 'transparent', color: active ? '#23262D' : '#64748b', boxShadow: active ? '0 3px 8px rgba(252,194,71,0.35)' : 'none', fontFamily: 'inherit' }}>
                            <t.icon size={15} /> {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Walk-in Tab — Vehicle Information only */}
            {tab === 'walkin' && (
                <div style={card}>
                    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <SectionHeader icon={Car} title="Vehicle Information" subtitle="Enter the vehicle details for this order" />

                        <Field icon={Hash} label="Vehicle Number" required
                            value={walkin.plate} onChange={v => wSet('plate', v)} placeholder="e.g. ABC 1234" />

                        <Field icon={FileText} label="VIN (Optional)"
                            value={walkin.vin} onChange={v => wSet('vin', sanitizeVin(v))}
                            placeholder="17-character VIN" maxLength={17}
                            hint="Uppercase letters and numbers only" />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field icon={Wrench} label="Make" value={walkin.make} onChange={v => wSet('make', v)} placeholder="e.g. Toyota" />
                            <Field icon={Car} label="Model" value={walkin.model} onChange={v => wSet('model', v)} placeholder="e.g. Camry" />
                        </div>

                        <Field icon={Gauge} label="Odometer Reading (km)"
                            value={walkin.odometer} onChange={v => wSet('odometer', sanitizeNumeric(v))}
                            placeholder="e.g. 55000" inputMode="numeric" />

                        <SaveButton disabled={!walkinValid} onClick={handleWalkinProceed} label="Save & Proceed to Department" />
                    </div>
                </div>
            )}

            {/* Corporate Tab */}
            {tab === 'corporate' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Corporate Account */}
                    <div style={card}>
                        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <SectionHeader icon={Building2} title="Corporate Account" subtitle="Select a pre-registered corporate customer" />

                            <div style={{ position: 'relative' }}>
                                <label style={labelStyle}>Corporate Account <span style={{ color: '#ef4444' }}>*</span></label>
                                <button type="button" onClick={() => setCorpDropdownOpen(o => !o)}
                                    style={{ width: '100%', padding: '12px 14px', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', color: selectedCorp ? '#1E2124' : '#9ca3af', fontWeight: 600, justifyContent: 'space-between' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <Building2 size={16} color="#94a3b8" />
                                        {loadingCorp ? 'Loading accounts…' : (selectedCorp ? (selectedCorp.companyName || selectedCorp.name) : 'Select corporate account')}
                                    </span>
                                    <ChevronDown size={16} color="#94a3b8" style={{ transition: 'transform 0.15s', transform: corpDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                                </button>
                                {corpDropdownOpen && corpCustomers.length > 0 && (
                                    <div style={{ position: 'absolute', zIndex: 10, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 10px 30px rgba(0,0,0,0.12)', maxHeight: 260, overflowY: 'auto' }}>
                                        {corpCustomers.map(c => {
                                            const selected = corpCustomerId === c.id;
                                            return (
                                                <div key={c.id} onClick={() => { setCorpCustomerId(c.id); setCorpDropdownOpen(false); }}
                                                    style={{ padding: '12px 14px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, background: selected ? '#FFF9EC' : '#fff' }}
                                                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f8fafc'; }}
                                                    onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#fff'; }}>
                                                    <Building2 size={14} color={selected ? '#D4A017' : '#94a3b8'} />
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ margin: 0, fontWeight: 800, color: '#1E2124' }}>{c.companyName || c.name}</p>
                                                        {c.vatNumber && <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>VAT: {c.vatNumber}</p>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {!loadingCorp && corpCustomers.length === 0 && (
                                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>No corporate accounts found.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Auto-filled Company Details (read-only) */}
                    {selectedCorp && (
                        <div style={card}>
                            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <SectionHeader icon={FileText} title="Company Details" subtitle="Auto-filled from the selected account" />
                                <ReadOnlyField icon={Building2} label="Company Name" value={selectedCorp.companyName || selectedCorp.name || '-'} />
                                <ReadOnlyField icon={FileText} label="VAT Number" value={selectedCorp.vatNumber || '-'} />
                                <ReadOnlyField icon={MapPin} label="Billing Address" value={selectedCorp.billingAddress || selectedCorp.address || '-'} multiline />
                            </div>
                        </div>
                    )}

                    {/* Vehicle Information — all required */}
                    {selectedCorp && (
                        <div style={card}>
                            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <SectionHeader icon={Car} title="Vehicle Information" subtitle="All fields are required for corporate orders" />

                                <Field icon={Hash} label="Vehicle Number" required
                                    value={corpVehicle.plate} onChange={v => vSet('plate', v)} placeholder="e.g. ABC 1234" />

                                <Field icon={FileText} label="VIN (Optional)"
                                    value={corpVehicle.vin} onChange={v => vSet('vin', sanitizeVin(v))}
                                    placeholder="17-character VIN" maxLength={17}
                                    hint="Uppercase letters and numbers only" />

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <Field icon={Wrench} label="Make" required value={corpVehicle.make} onChange={v => vSet('make', v)} placeholder="e.g. Toyota" />
                                    <Field icon={Car} label="Model" required value={corpVehicle.model} onChange={v => vSet('model', v)} placeholder="e.g. Camry" />
                                </div>

                                <Field icon={Gauge} label="Odometer Reading (km)" required
                                    value={corpVehicle.odometer} onChange={v => vSet('odometer', sanitizeNumeric(v))}
                                    placeholder="e.g. 55000" inputMode="numeric" />

                                <SaveButton disabled={!corpValid} onClick={handleCorpProceed} label="Save & Proceed to Department" />

                                <p style={{ textAlign: 'center', fontSize: '0.74rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                                    After invoice is generated, the corporate customer will be notified for approval.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <div style={{ width: 4, height: 22, background: '#FCC247', borderRadius: 2 }} />
            <Icon size={18} color="#23262D" />
            <div>
                <p style={{ margin: 0, fontWeight: 900, fontSize: '0.95rem', color: '#1E2124' }}>{title}</p>
                {subtitle && <p style={{ margin: '1px 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>{subtitle}</p>}
            </div>
        </div>
    );
}

function Field({ icon: Icon, label, required, value, onChange, placeholder, maxLength, inputMode, hint }) {
    return (
        <div>
            <label style={labelStyle}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
            <div style={{ position: 'relative' }}>
                {Icon && <Icon size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />}
                <input type="text" value={value} onChange={e => onChange(e.target.value)}
                    placeholder={placeholder} maxLength={maxLength} inputMode={inputMode}
                    style={{ ...inputStyle, paddingLeft: Icon ? 40 : 14 }}
                    onFocus={e => e.currentTarget.style.borderColor = '#FCC247'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'} />
            </div>
            {hint && <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>{hint}</p>}
        </div>
    );
}

function ReadOnlyField({ icon: Icon, label, value, multiline }) {
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <div style={{ position: 'relative', background: '#F7F8FA', border: '1px solid #e5e7eb', borderRadius: 12, padding: multiline ? '12px 40px 12px 40px' : '12px 40px', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                {Icon && <Icon size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: multiline ? 14 : '50%', transform: multiline ? 'none' : 'translateY(-50%)' }} />}
                <span style={{ fontSize: '0.88rem', color: '#1E2124', fontWeight: 600, wordBreak: 'break-word' }}>{value}</span>
                <Lock size={13} color="#cbd5e1" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }} />
            </div>
        </div>
    );
}

function SaveButton({ disabled, onClick, label }) {
    return (
        <button onClick={onClick} disabled={disabled}
            style={{ width: '100%', height: 52, background: disabled ? '#ECEEF1' : '#FCC247', color: disabled ? '#94a3b8' : '#23262D', border: 'none', borderRadius: 14, fontWeight: 900, fontSize: '0.95rem', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', boxShadow: disabled ? 'none' : '0 6px 16px rgba(252,194,71,0.4)', marginTop: 4 }}>
            <Save size={17} /> {label}
        </button>
    );
}

const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'visible' };
const labelStyle = { display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: 6 };
const inputStyle = { width: '100%', padding: '12px 14px', border: '1.5px solid #e5e7eb', borderRadius: 12, fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s', background: '#fff', color: '#1E2124', fontWeight: 600 };
const iconBtn = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#475569' };
