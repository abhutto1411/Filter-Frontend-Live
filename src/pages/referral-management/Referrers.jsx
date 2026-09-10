import React, { useState } from 'react';
import { Plus, Copy, Check, Star, Building2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { MOCK_REFERRERS, genCode } from './constants';

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); };
    return (
        <button onClick={copy} style={{ padding: '3px 8px', background: copied ? '#DCFCE7' : '#F3F4F6', color: copied ? '#16A34A' : '#6B7280', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', fontWeight: 700, transition: 'all 0.2s' }}>
            {copied ? <><Check size={11} />Copied!</> : <><Copy size={11} />Copy</>}
        </button>
    );
}

export default function Referrers() {
    const [referrers, setReferrers] = useState(MOCK_REFERRERS);
    const [addOpen, setAddOpen] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [paying, setPaying] = useState(null);
    const [form, setForm] = useState({ category: 'franchise_referrer', full_name: '', mobile: '', email: '', national_id: '', bank_name: '', bank_iban: '', address: '' });
    const [payForm, setPayForm] = useState({ amount: '', method: 'bank_transfer' });
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleAdd = () => {
        if (!form.full_name || !form.mobile) return;
        const prefix = form.category === 'franchise_referrer' ? 'FRN' : 'CORP';
        const code = genCode(prefix);
        setReferrers(prev => [...prev, { id: Date.now(), ...form, referral_code: code, total_referrals: 0, total_commission_earned: 0, total_commission_paid: 0, status: 'active' }]);
        setAddOpen(false);
        setForm({ category: 'franchise_referrer', full_name: '', mobile: '', email: '', national_id: '', bank_name: '', bank_iban: '', address: '' });
    };

    const openPay = (r) => { setPaying(r); setPayForm({ amount: String(r.total_commission_earned - r.total_commission_paid), method: 'bank_transfer' }); setPayOpen(true); };
    const handlePay = () => {
        const amt = parseFloat(payForm.amount) || 0;
        if (amt <= 0) return;
        setReferrers(prev => prev.map(r => r.id === paying.id ? { ...r, total_commission_paid: r.total_commission_paid + amt } : r));
        setPayOpen(false);
    };

    return (
        <div>
            <div className="ws-page-header"><div><h2 className="ws-page-title">Referrers</h2><p className="ws-page-sub">Franchise and corporate referral agents</p></div><button className="btn-portal" onClick={() => setAddOpen(true)}><Plus size={15} /> Add Referrer</button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {referrers.map(r => {
                    const balance = r.total_commission_earned - r.total_commission_paid;
                    return (
                        <div key={r.id} className="ws-section">
                            <div style={{ padding: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                            <strong style={{ fontSize: '1rem' }}>{r.full_name}</strong>
                                            <span className={`ws-badge ${r.category === 'franchise_referrer' ? 'ws-badge--yellow' : 'ws-badge--blue'}`}>{r.category === 'franchise_referrer' ? 'Franchise' : 'Corporate'}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <code style={{ background: '#F3F4F6', padding: '2px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 700 }}>{r.referral_code}</code>
                                            <CopyButton text={r.referral_code} />
                                        </div>
                                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>{r.mobile} · {r.email}</p>
                                        {r.bank_name && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '3px 0 0 0' }}>{r.bank_name} · {r.bank_iban?.substring(0, 10)}…</p>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center', padding: '10px 16px', background: 'var(--color-bg-muted)', borderRadius: 10 }}>
                                            <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 3px 0' }}>Referrals</p>
                                            <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-text-dark)', margin: 0 }}>{r.total_referrals}</p>
                                        </div>
                                        <div style={{ textAlign: 'center', padding: '10px 16px', background: 'var(--color-bg-muted)', borderRadius: 10 }}>
                                            <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 3px 0' }}>Earned</p>
                                            <p style={{ fontSize: '1rem', fontWeight: 900, color: '#16A34A', margin: 0 }}>SAR {r.total_commission_earned.toLocaleString()}</p>
                                        </div>
                                        <div style={{ textAlign: 'center', padding: '10px 16px', background: balance > 0 ? '#FEF2F2' : 'var(--color-bg-muted)', borderRadius: 10 }}>
                                            <p style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: '0 0 3px 0' }}>Balance</p>
                                            <p style={{ fontSize: '1rem', fontWeight: 900, color: balance > 0 ? '#DC2626' : '#16A34A', margin: 0 }}>SAR {balance.toLocaleString()}</p>
                                        </div>
                                        {balance > 0 && <button onClick={() => openPay(r)} style={{ padding: '10px 18px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer', fontSize: '0.875rem' }}>Pay SAR {balance.toLocaleString()}</button>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <AnimatePresence>
                {addOpen && <Modal title="Add New Referrer" onClose={() => setAddOpen(false)} footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn-submit" onClick={handleAdd}>Add Referrer</button></div>}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Category *</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[{ v: 'franchise_referrer', label: 'Franchise Referrer', Icon: Star }, { v: 'corporate_referrer', label: 'Corporate Referrer', Icon: Building2 }].map(c => (
                                <button key={c.v} type="button" onClick={() => set('category', c.v)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, border: `2px solid ${form.category === c.v ? 'var(--color-primary)' : 'var(--color-border)'}`, background: form.category === c.v ? 'rgba(255,214,0,0.08)' : '#fff', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <c.Icon size={18} style={{ color: form.category === c.v ? '#FCC245' : 'var(--color-text-muted)' }} /><span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{c.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="ws-form-grid">
                        <div className="ws-field"><label>Full Name *</label><input value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div>
                        <div className="ws-field"><label>Mobile *</label><input value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+966 5x xxx xxxx" /></div>
                        <div className="ws-field"><label>Email</label><input value={form.email} onChange={e => set('email', e.target.value)} /></div>
                        <div className="ws-field"><label>National ID / Iqama</label><input value={form.national_id} onChange={e => set('national_id', e.target.value)} /></div>
                        <div className="ws-field"><label>Bank Name</label><input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="Al-Rajhi Bank" /></div>
                        <div className="ws-field"><label>Bank IBAN</label><input value={form.bank_iban} onChange={e => set('bank_iban', e.target.value)} placeholder="SA…" /></div>
                    </div>
                    <div className="ws-field" style={{ marginTop: 8 }}><label>Address</label><input value={form.address} onChange={e => set('address', e.target.value)} /></div>
                </Modal>}
                {payOpen && paying && <Modal title={`Pay Commission — ${paying.full_name}`} onClose={() => setPayOpen(false)} footer={<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn-secondary" onClick={() => setPayOpen(false)}>Cancel</button><button className="btn-submit" onClick={handlePay}>Pay & Post Journal Entry</button></div>}>
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                        <p style={{ margin: 0, fontSize: '0.875rem', color: '#15803D', fontWeight: 600 }}>This will post a double-entry journal: <strong>Dr Referral Commission Payable / Cr Bank</strong></p>
                    </div>
                    <div className="ws-form-grid">
                        <div className="ws-field"><label>Amount (SAR) *</label><input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></div>
                        <div className="ws-field"><label>Payment Method</label><select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option><option value="cheque">Cheque</option></select></div>
                    </div>
                </Modal>}
            </AnimatePresence>
        </div>
    );
}
