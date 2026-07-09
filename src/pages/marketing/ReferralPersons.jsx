import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Pencil, Trash2, Users, DollarSign, Award, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import { StatCardMini } from './MarketingUtils';

export const ReferralPersons = ({
    showAdd: propsShowAdd,
    setShowAdd: propsSetShowAdd,
    onCancel,
    referrers: propsReferrers,
    setReferrers: propsSetReferrers
}) => {
    const ctx = useOutletContext() || {};
    const referrers = propsReferrers || ctx.referrers || [];
    const setReferrers = propsSetReferrers || ctx.setReferrers;
    const showAdd = propsShowAdd !== undefined ? propsShowAdd : ctx.showAddModal;
    const setShowAdd = propsSetShowAdd || ctx.setShowAddModal;

    const [editingReferrer, setEditingReferrer] = useState(null);
    const isModalOpen = showAdd || !!editingReferrer;

    const closeModal = () => {
        if (onCancel) onCancel();
        else if (setShowAdd) setShowAdd(false);
        setEditingReferrer(null);
    };

    const handleEdit = (referrer) => {
        setEditingReferrer(referrer);
        if (setShowAdd) setShowAdd(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to remove this referrer?')) {
            setReferrers(referrers.filter(r => r.id !== id));
        }
    };

    const handlePay = (id) => {
        setReferrers(referrers.map(r => {
            if (r.id === id) {
                return { ...r, paid: (r.paid || 0) + (r.bal || 0), bal: 0 };
            }
            return r;
        }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        if (editingReferrer) {
            setReferrers(referrers.map(r => r.id === editingReferrer.id ? {
                ...r,
                ...data,
                earned: Number(data.earned || r.earned || 0),
                paid: Number(data.paid || r.paid || 0),
                bal: Number(data.earned || r.earned || 0) - Number(data.paid || r.paid || 0)
            } : r));
        } else {
            const newRef = {
                id: Date.now(),
                ...data,
                earned: 0,
                paid: 0,
                bal: 0,
                status: data.status || 'Active'
            };
            setReferrers([newRef, ...referrers]);
        }
        closeModal();
    };

    return (
        <div className="referral-persons-view marketing-portal-view">
            <div className="dashboard-stats-row" style={{ marginBottom: '32px' }}>
                <StatCardMini title="Total Referrers" value={referrers.length} icon={Users} />
                <StatCardMini title="Total Earned" value={`SAR ${referrers.reduce((acc, r) => acc + Number(r.earned || 0), 0).toLocaleString()}`} icon={DollarSign} />
                <StatCardMini title="Total Paid" value={`SAR ${referrers.reduce((acc, r) => acc + Number(r.paid || 0), 0).toLocaleString()}`} icon={Award} />
                <StatCardMini title="Unpaid Balance" value={`SAR ${referrers.reduce((acc, r) => acc + Number(r.bal || 0), 0).toLocaleString()}`} icon={Clock} />
            </div>
            <section className="premium-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Referrer Name</th>
                            <th className="table-th">Category</th>
                            <th className="table-th">Commission Rate</th>
                            <th className="table-th">Earned</th>
                            <th className="table-th">Paid</th>
                            <th className="table-th">Balance</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {referrers.map((r) => (
                            <tr key={r.id} className="table-row">
                                <td className="table-cell">
                                    <div className="cell-main-text">{r.name}</div>
                                </td>
                                <td className="table-cell">{r.cat}</td>
                                <td className="table-cell">{r.rate}</td>
                                <td className="table-cell font-bold">SAR {(r.earned || 0).toLocaleString()}</td>
                                <td className="table-cell">SAR {(r.paid || 0).toLocaleString()}</td>
                                <td className="table-cell font-bold" style={{ color: r.bal !== 0 ? 'var(--color-primary)' : '' }}>SAR {(r.bal || 0).toLocaleString()}</td>
                                <td className="table-cell">
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        {r.bal > 0 && <button className="btn-view-inv" style={{ minWidth: '60px' }} onClick={() => handlePay(r.id)}>PAY</button>}
                                        <button className="icon-btn-mini" title="Edit Referrer" onClick={() => handleEdit(r)}><Pencil size={14} /></button>
                                        <button className="icon-btn-mini text-danger" title="Delete Referrer" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <AnimatePresence>
                {isModalOpen && (
                    <Modal
                        title={editingReferrer ? "Edit Referrer" : "Add New Referrer"}
                        onClose={closeModal}
                        footer={
                            <>
                                <button className="btn-secondary" onClick={closeModal}>Cancel</button>
                                <button className="btn-submit" onClick={() => document.getElementById('referrer-form').requestSubmit()}>
                                    {editingReferrer ? "Save Changes" : "Create Referrer"}
                                </button>
                            </>
                        }
                    >
                        <form id="referrer-form" onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Category *</label>
                                <select className="form-input-field" name="cat" defaultValue={editingReferrer?.cat || ""} required>
                                    <option value="">Select category</option>
                                    <option>Franchise Referrer</option>
                                    <option>Corporate Customer Referred</option>
                                    <option>Individual Customer Referrer</option>
                                    <option>Influencer</option>
                                </select>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Full Name *</label>
                                    <input type="text" className="form-input-field" name="name" placeholder="Enter full name" defaultValue={editingReferrer?.name || ""} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mobile</label>
                                    <input type="text" className="form-input-field" name="mobile" placeholder="+966" defaultValue={editingReferrer?.mobile || ""} />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input type="email" className="form-input-field" name="email" placeholder="email@example.com" defaultValue={editingReferrer?.email || ""} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Login Email (Portal)</label>
                                    <input type="email" className="form-input-field" name="loginEmail" placeholder="Used to access portal" defaultValue={editingReferrer?.loginEmail || ""} />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">National ID / Iqama</label>
                                    <input type="text" className="form-input-field" name="iqama" placeholder="National ID or Iqama number" defaultValue={editingReferrer?.iqama || ""} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input-field" name="status" defaultValue={editingReferrer?.status || "Active"}>
                                        <option>Active</option>
                                        <option>Inactive</option>
                                        <option>Suspended</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Bank Name</label>
                                    <input type="text" className="form-input-field" name="bankName" placeholder="Enter bank name" defaultValue={editingReferrer?.bankName || ""} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Bank IBAN</label>
                                    <input type="text" className="form-input-field" name="bankIban" placeholder="Enter IBAN" defaultValue={editingReferrer?.bankIban || ""} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input type="text" className="form-input-field" name="address" placeholder="Enter address" defaultValue={editingReferrer?.address || ""} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Notes</label>
                                <textarea
                                    className="form-input-field"
                                    name="notes"
                                    placeholder="Optional notes..."
                                    defaultValue={editingReferrer?.notes || ""}
                                    style={{ minHeight: '100px', resize: 'vertical' }}
                                />
                            </div>
                        </form>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
};
