import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, FileText, Edit } from 'lucide-react';
import Modal from '../../components/Modal';
import {
    listLocalSuppliers,
    createLocalSupplier,
    updateLocalSupplier,
} from '../../services/workshopSuppliersApi';
import { useAuth } from '../../context/AuthContext';

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtMoney = (v) =>
    Number(v ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

function LocalSupplierFormModal({ supplier, branches = [], onClose, onSave, isSaving, selectedBranchId = 'all' }) {
    const isAll = !selectedBranchId || selectedBranchId === 'all';
    const visibleBranches = isAll
        ? branches
        : branches.filter((b) => String(b.id) === String(selectedBranchId));
    const [form, setForm] = useState({
        name: supplier?.name || '',
        // On create with a branch scoped → pre-fill it. On edit, keep existing.
        branchId: supplier?.branchId || (!isAll ? String(selectedBranchId) : ''),
        phone: supplier?.phone || '',
        email: supplier?.email || '',
        address: supplier?.address || '',
        vatId: supplier?.vatId || '',
        crNumber: supplier?.crNumber || '',
        contactPerson: supplier?.contactPerson || '',
        openingBalance: supplier?.openingBalance ?? '',
        openingBalanceDate: supplier?.openingBalanceDate || todayIso(),
    });
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const isEdit = Boolean(supplier?.id);
    return (
        <Modal
            title={isEdit ? 'Edit Non-Affiliated Supplier' : 'Add Non-Affiliated Supplier'}
            onClose={isSaving ? () => {} : onClose}
            width="640px"
            footer={
                <>
                    <button className="btn-portal-outline" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </button>
                    <button
                        className="btn-portal"
                        disabled={isSaving || !form.name.trim()}
                        onClick={() => onSave(form)}
                    >
                        {isSaving ? 'Saving...' : isEdit ? 'Update' : 'Add supplier'}
                    </button>
                </>
            }
        >
            <div style={{ fontSize: '0.875rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Supplier name *</label>
                        <input
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            placeholder="e.g. Local Trading Co."
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Branch (optional)</label>
                        <select
                            value={form.branchId || ''}
                            onChange={(e) => set('branchId', e.target.value)}
                            disabled={!isAll}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', opacity: isAll ? 1 : 0.85 }}
                        >
                            {isAll && <option value="">— None (workshop-wide) —</option>}
                            {visibleBranches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Contact person</label>
                        <input
                            value={form.contactPerson}
                            onChange={(e) => set('contactPerson', e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Phone</label>
                        <input
                            value={form.phone}
                            onChange={(e) => set('phone', e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email</label>
                        <input
                            value={form.email}
                            onChange={(e) => set('email', e.target.value)}
                            type="email"
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>VAT ID</label>
                        <input
                            value={form.vatId}
                            onChange={(e) => set('vatId', e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>CR Number</label>
                        <input
                            value={form.crNumber}
                            onChange={(e) => set('crNumber', e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                        />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Address</label>
                        <textarea
                            rows={2}
                            value={form.address}
                            onChange={(e) => set('address', e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)', resize: 'vertical' }}
                        />
                    </div>
                    {!isEdit && (
                        <>
                            <div>
                                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Opening balance (SAR)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={form.openingBalance}
                                    onChange={(e) => set('openingBalance', e.target.value)}
                                    placeholder="0.00"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>As of date</label>
                                <input
                                    type="date"
                                    value={form.openingBalanceDate}
                                    onChange={(e) => set('openingBalanceDate', e.target.value)}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--color-border)' }}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
}

export default function WorkshopNonAffiliatedSuppliers({
    selectedBranchId = 'all',
    branches = [],
    onTabChange,
}) {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('workshop.non-affiliated-suppliers.create');
    const canEdit   = hasPermission('workshop.non-affiliated-suppliers.edit');
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedBranchId && selectedBranchId !== 'all') {
                params.branchId = selectedBranchId;
            }
            const res = await listLocalSuppliers(params);
            setRows(res?.suppliers ?? []);
            setError('');
        } catch (e) {
            console.error(e);
            setError(e?.message || 'Failed to load suppliers');
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    const onSubmit = async (form) => {
        setSaving(true);
        try {
            const payload = {
                name: form.name?.trim(),
                branchId: form.branchId || undefined,
                phone: form.phone || undefined,
                email: form.email || undefined,
                address: form.address || undefined,
                vatId: form.vatId || undefined,
                crNumber: form.crNumber || undefined,
                contactPerson: form.contactPerson || undefined,
            };
            if (editTarget) {
                await updateLocalSupplier(editTarget.id, payload);
            } else {
                await createLocalSupplier({
                    ...payload,
                    openingBalance: Number(form.openingBalance || 0) || 0,
                    openingBalanceDate: form.openingBalanceDate || todayIso(),
                });
            }
            setShowForm(false);
            setEditTarget(null);
            await loadList();
        } catch (e) {
            alert(e?.message || 'Failed to save supplier');
        } finally {
            setSaving(false);
        }
    };

    const onToggleActive = async (row) => {
        try {
            await updateLocalSupplier(row.id, { isActive: !row.isActive });
            setRows((rs) =>
                rs.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)),
            );
        } catch (e) {
            alert(e?.message || 'Failed to update supplier');
        }
    };

    const totalBalance = useMemo(
        () => rows.reduce((s, r) => s + Number(r.finalBalance || 0), 0),
        [rows],
    );

    return (
        <div className="ws-page" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h2 style={{ margin: 0, flex: 1 }}>Non-Affiliated Suppliers</h2>
                <button className="btn-portal-outline" onClick={loadList} disabled={loading}>
                    <RefreshCw size={14} style={{ marginRight: 6 }} />
                    Refresh
                </button>
                {canCreate && (
                    <button
                        className="btn-portal"
                        onClick={() => {
                            setEditTarget(null);
                            setShowForm(true);
                        }}
                    >
                        <Plus size={14} style={{ marginRight: 6 }} />
                        Add new non-affiliated supplier
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ background: '#F1F5F9', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>
                    Total: <strong>{rows.length}</strong>
                </div>
                <div style={{ background: '#FEF3C7', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>
                    Aggregate payable balance: <strong>{fmtMoney(totalBalance)} SAR</strong>
                </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                            <th style={{ padding: 12, width: 60 }}>S.No.</th>
                            <th style={{ padding: 12 }}>Supplier name</th>
                            <th style={{ padding: 12 }}>Branch</th>
                            <th style={{ padding: 12 }}>Opening</th>
                            <th style={{ padding: 12 }}>Final balance (SAR)</th>
                            <th style={{ padding: 12, width: 110, textAlign: 'center' }}>Active</th>
                            <th style={{ padding: 12, width: 200 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
                                    Loading suppliers...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#64748B' }}>
                                    No non-affiliated suppliers yet. Click "Add new non-affiliated supplier" to create one.
                                </td>
                            </tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                                    <td style={{ padding: 12 }}>{r.serial}</td>
                                    <td
                                        style={{ padding: 12, cursor: 'pointer', color: '#2563EB', fontWeight: 600 }}
                                        onClick={() =>
                                            onTabChange?.('supplier-ledger', {
                                                type: 'local',
                                                id: r.id,
                                                name: r.name,
                                            })
                                        }
                                    >
                                        {r.name}
                                    </td>
                                    <td style={{ padding: 12 }}>{r.branchName || '—'}</td>
                                    <td style={{ padding: 12 }}>{fmtMoney(r.openingBalance)}</td>
                                    <td style={{ padding: 12 }}>{fmtMoney(r.finalBalance)}</td>
                                    <td style={{ padding: 12, textAlign: 'center' }}>
                                        <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, opacity: canEdit ? 1 : 0.55, cursor: canEdit ? 'pointer' : 'not-allowed' }} title={canEdit ? undefined : 'No edit permission'}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(r.isActive)}
                                                onChange={() => { if (canEdit) onToggleActive(r); }}
                                                disabled={!canEdit}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    background: r.isActive ? '#10B981' : '#CBD5E1',
                                                    borderRadius: 22,
                                                    transition: 'background 0.2s',
                                                }}
                                            />
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    top: 3,
                                                    left: r.isActive ? 21 : 3,
                                                    width: 16,
                                                    height: 16,
                                                    background: '#fff',
                                                    borderRadius: '50%',
                                                    transition: 'left 0.2s',
                                                }}
                                            />
                                        </label>
                                    </td>
                                    <td style={{ padding: 12, display: 'flex', gap: 6 }}>
                                        <button
                                            className="btn-portal-outline"
                                            style={{ padding: '6px 10px', fontSize: 12 }}
                                            onClick={() =>
                                                onTabChange?.('supplier-ledger', {
                                                    type: 'local',
                                                    id: r.id,
                                                    name: r.name,
                                                })
                                            }
                                        >
                                            <FileText size={12} style={{ marginRight: 4 }} />
                                            Ledger
                                        </button>
                                        {canEdit && (
                                            <button
                                                className="btn-portal-outline"
                                                style={{ padding: '6px 10px', fontSize: 12 }}
                                                onClick={() => {
                                                    setEditTarget(r);
                                                    setShowForm(true);
                                                }}
                                            >
                                                <Edit size={12} style={{ marginRight: 4 }} />
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {error && (
                <p style={{ marginTop: 12, color: '#B91C1C', fontSize: 13 }}>{error}</p>
            )}

            {showForm && (
                <LocalSupplierFormModal
                    supplier={editTarget}
                    branches={branches}
                    selectedBranchId={selectedBranchId}
                    onClose={() => {
                        setShowForm(false);
                        setEditTarget(null);
                    }}
                    onSave={onSubmit}
                    isSaving={saving}
                />
            )}
        </div>
    );
}
