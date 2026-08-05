import { useState } from 'react';
import { Car, Plus, Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { apiFetch } from '../../services/api';
import { formatPlateLettersFirst } from '../../utils/formatPlate';

const EMPTY_FORM = { plateNo: '', make: '', model: '', year: '', color: '', odometer: '' };

function displayPlate(v) {
    const raw = v?.plateDisplay || v?.plateNumber || v?.plateNo || '';
    return formatPlateLettersFirst(raw) || raw;
}

function mapVehicleRow(v) {
    const plate = displayPlate(v);
    return {
        id: v.id,
        plateNo: plate,
        plateDisplay: plate,
        make: v.make || '',
        model: v.model || '',
        year: v.year,
        color: v.color || '',
        odometer: v.odometer ?? 0,
    };
}

export default function CorporateVehicles({ vehicles, setVehicles }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editVehicle, setEditVehicle] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const openAdd = () => { setEditVehicle(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true); };
    const openEdit = (v) => {
        setEditVehicle(v);
        setForm({
            plateNo: displayPlate(v),
            make: v.make || '',
            model: v.model || '',
            year: v.year || '',
            color: v.color || '',
            odometer: v.odometer || '',
        });
        setFormError('');
        setModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.plateNo) return;
        setSaving(true);
        setFormError('');
        try {
            const payload = {
                plateNo: form.plateNo,
                make: form.make,
                model: form.model,
                year: Number(form.year) || undefined,
                color: form.color,
                odometer: Number(form.odometer) || undefined,
            };
            if (editVehicle) {
                const data = await apiFetch(`/corporate/vehicles/${editVehicle.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                const row = mapVehicleRow(data);
                setVehicles(prev => prev.map(v => (String(v.id) === String(editVehicle.id) ? row : v)));
            } else {
                const data = await apiFetch('/corporate/vehicles', { method: 'POST', body: JSON.stringify(payload) });
                setVehicles(prev => [...prev, mapVehicleRow(data)]);
            }
            setModalOpen(false); setEditVehicle(null); setForm(EMPTY_FORM);
        } catch (err) {
            setFormError(err?.message || 'Could not save vehicle');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this vehicle?')) return;
        try {
            await apiFetch(`/corporate/vehicles/${id}`, { method: 'DELETE' });
            setVehicles(prev => prev.filter(v => String(v.id) !== String(id)));
        } catch (err) {
            alert(err?.message || 'Could not delete vehicle');
        }
    };

    const list = vehicles || [];
    return (
        <div>
            <div className="ws-page-header">
                <div><h2 className="ws-page-title">My Vehicles ({list.length})</h2><p className="ws-page-sub">Corporate fleet vehicle registry</p></div>
                <button className="btn-portal" style={{background:'#2563EB',color:'#fff',border:'none'}} onClick={openAdd}><Plus size={15}/> Add Vehicle</button>
            </div>
            {list.length === 0 ? (
                <div className="ws-section" style={{textAlign:'center',padding:48}}>
                    <Car size={48} style={{opacity:0.3,margin:'0 auto 16px',display:'block'}}/>
                    <p style={{margin:0,fontWeight:600,color:'var(--color-text-muted)'}}>No vehicles registered yet</p>
                    <button className="btn-portal" style={{marginTop:16,background:'#2563EB',color:'#fff',border:'none'}} onClick={openAdd}><Plus size={15}/> Add First Vehicle</button>
                </div>
            ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))',gap:16}}>
                    {list.map(v => (
                        <div key={v.id} className="ws-section" style={{marginBottom:0,padding:20}}>
                            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                                <div style={{width:40,height:40,borderRadius:12,background:'var(--color-bg-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}><Car size={20} style={{color:'var(--color-text-muted)'}}/></div>
                                <div style={{flex:1}}>
                                    <p style={{fontWeight:700,fontSize:'0.9375rem',color:'var(--color-text-dark)',margin:0}}>{displayPlate(v)}</p>
                                    <p style={{fontSize:'0.75rem',color:'var(--color-text-muted)',margin:'2px 0 0 0'}}>{v.make} {v.model} · {v.year}</p>
                                </div>
                            </div>
                            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:'0.75rem',marginBottom:12}}>
                                <div><span style={{color:'var(--color-text-muted)'}}>Color:</span> {v.color || '–'}</div>
                                <div><span style={{color:'var(--color-text-muted)'}}>Odo:</span> {v.odometer ? `${v.odometer.toLocaleString()} km` : '–'}</div>
                            </div>
                            <div style={{display:'flex',gap:8}}>
                                <button type="button" style={{flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--color-border)',background:'#fff',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}} onClick={() => openEdit(v)}><Pencil size={14}/> Edit</button>
                                <button type="button" style={{padding:'8px 12px',borderRadius:8,border:'1px solid #FECACA',background:'#FEF2F2',color:'#DC2626',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:6}} onClick={() => handleDelete(v.id)}><Trash2 size={14}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <AnimatePresence>{modalOpen && (
                <Modal title={editVehicle ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => { setModalOpen(false); setEditVehicle(null); }} footer={
                    <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                        <button className="btn-portal-outline" onClick={() => setModalOpen(false)}>Cancel</button>
                        <button className="btn-portal" disabled={!form.plateNo || saving} onClick={handleSave}>{saving ? 'Saving…' : editVehicle ? 'Update Vehicle' : 'Add Vehicle'}</button>
                    </div>
                } width="420px">
                    {formError ? (
                        <div style={{padding:'10px 12px', borderRadius:10, background:'#FEF2F2', color:'#B91C1C', fontSize:'0.8125rem', border:'1px solid #FECACA', marginBottom:12}}>
                            {formError}
                        </div>
                    ) : null}
                    <div className="ws-form-grid">
                        <div className="ws-field"><label>Plate Number *</label><input value={form.plateNo} onChange={e=>set('plateNo',e.target.value)} placeholder="ABC 1234"/></div>
                        <div className="ws-field"><label>Make</label><input value={form.make} onChange={e=>set('make',e.target.value)} placeholder="Toyota"/></div>
                        <div className="ws-field"><label>Model</label><input value={form.model} onChange={e=>set('model',e.target.value)} placeholder="Land Cruiser"/></div>
                        <div className="ws-field"><label>Year</label><input type="number" value={form.year} onChange={e=>set('year',e.target.value)} placeholder="2022"/></div>
                        <div className="ws-field"><label>Color</label><input value={form.color} onChange={e=>set('color',e.target.value)} placeholder="White"/></div>
                        <div className="ws-field"><label>Odometer (km)</label><input type="number" value={form.odometer} onChange={e=>set('odometer',e.target.value)} placeholder="45000"/></div>
                    </div>
                </Modal>
            )}</AnimatePresence>
        </div>
    );
}
