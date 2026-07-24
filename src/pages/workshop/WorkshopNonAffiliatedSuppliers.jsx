import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, FileText, Edit } from 'lucide-react';
import Modal from '../../components/Modal';
import WsTableScroll from '../../components/workshop/WsTableScroll';
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
            width="min(640px, 96vw)"
            footer={
                <div className="ws-aff-modal-footer">
                    <button type="button" className="btn-portal-outline" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-portal"
                        disabled={isSaving || !form.name.trim()}
                        onClick={() => onSave(form)}
                    >
                        {isSaving ? 'Saving...' : isEdit ? 'Update' : 'Add supplier'}
                    </button>
                </div>
            }
        >
            <div className="ws-local-sup-modal-form">
                <div className="ws-local-sup-modal-grid">
                    <div className="ws-local-sup-modal-field ws-local-sup-modal-field--full">
                        <label>Supplier name *</label>
                        <input
                            className="ws-local-sup-modal-input"
                            value={form.name}
                            onChange={(e) => set('name', e.target.value)}
                            placeholder="e.g. Local Trading Co."
                        />
                    </div>
                    <div className="ws-local-sup-modal-field">
                        <label>Branch (optional)</label>
                        <select
                            className="ws-local-sup-modal-input"
                            value={form.branchId || ''}
                            onChange={(e) => set('branchId', e.target.value)}
                            disabled={!isAll}
                        >
                            {isAll && <option value="">— None (workshop-wide) —</option>}
                            {visibleBranches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="ws-local-sup-modal-field">
                        <label>Contact person</label>
                        <input
                            className="ws-local-sup-modal-input"
                            value={form.contactPerson}
                            onChange={(e) => set('contactPerson', e.target.value)}
                        />
                    </div>
                    <div className="ws-local-sup-modal-field">
                        <label>Phone</label>
                        <input
                            className="ws-local-sup-modal-input"
                            value={form.phone}
                            onChange={(e) => set('phone', e.target.value)}
                        />
                    </div>
                    <div className="ws-local-sup-modal-field">
                        <label>Email</label>
                        <input
                            className="ws-local-sup-modal-input"
                            value={form.email}
                            onChange={(e) => set('email', e.target.value)}
                            type="email"
                        />
                    </div>
                    <div className="ws-local-sup-modal-field">
                        <label>VAT ID</label>
                        <input
                            className="ws-local-sup-modal-input"
                            value={form.vatId}
                            onChange={(e) => set('vatId', e.target.value)}
                        />
                    </div>
                    <div className="ws-local-sup-modal-field">
                        <label>CR Number</label>
                        <input
                            className="ws-local-sup-modal-input"
                            value={form.crNumber}
                            onChange={(e) => set('crNumber', e.target.value)}
                        />
                    </div>
                    <div className="ws-local-sup-modal-field ws-local-sup-modal-field--full">
                        <label>Address</label>
                        <textarea
                            className="ws-local-sup-modal-input"
                            rows={2}
                            value={form.address}
                            onChange={(e) => set('address', e.target.value)}
                        />
                    </div>
                    {!isEdit && (
                        <>
                            <div className="ws-local-sup-modal-field">
                                <label>Opening balance (SAR)</label>
                                <input
                                    className="ws-local-sup-modal-input"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={form.openingBalance}
                                    onChange={(e) => set('openingBalance', e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="ws-local-sup-modal-field">
                                <label>As of date</label>
                                <input
                                    className="ws-local-sup-modal-input"
                                    type="date"
                                    value={form.openingBalanceDate}
                                    onChange={(e) => set('openingBalanceDate', e.target.value)}
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
                phone: form.phone || undefined,
                email: form.email || undefined,
                address: form.address || undefined,
                vatId: form.vatId || undefined,
                crNumber: form.crNumber || undefined,
                contactPerson: form.contactPerson || undefined,
            };
            if (editTarget) {
                // Send null explicitly so backend clears branch (workshop-wide).
                // Omitting branchId skips the update entirely.
                payload.branchId = form.branchId ? String(form.branchId) : null;
                await updateLocalSupplier(editTarget.id, payload);
            } else {
                await createLocalSupplier({
                    ...payload,
                    branchId: form.branchId ? String(form.branchId) : undefined,
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
        <div className="ws-suppliers-page">
            <div className="ws-suppliers-header">
                <h2 className="ws-suppliers-title">Non-Affiliated Suppliers</h2>
                <div className="ws-suppliers-header-actions">
                    <button type="button" className="btn-portal-outline" onClick={loadList} disabled={loading}>
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                    {canCreate && (
                        <button
                            type="button"
                            className="btn-portal ws-suppliers-add-btn"
                            onClick={() => {
                                setEditTarget(null);
                                setShowForm(true);
                            }}
                        >
                            <Plus size={14} />
                            Add new non-affiliated supplier
                        </button>
                    )}
                </div>
            </div>

            <div className="ws-suppliers-stats">
                <div className="ws-suppliers-stat ws-suppliers-stat--neutral">
                    Total: <strong>{rows.length}</strong>
                </div>
                <div className="ws-suppliers-stat ws-suppliers-stat--balance">
                    Aggregate payable balance: <strong>{fmtMoney(totalBalance)} SAR</strong>
                </div>
            </div>

            <div className="ws-suppliers-table-wrap">
                <WsTableScroll>
                <table className="ws-suppliers-table">
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
                                        <label className="ws-suppliers-toggle" title={canEdit ? undefined : 'No edit permission'} style={{ opacity: canEdit ? 1 : 0.55, cursor: canEdit ? 'pointer' : 'not-allowed' }}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(r.isActive)}
                                                onChange={() => { if (canEdit) onToggleActive(r); }}
                                                disabled={!canEdit}
                                            />
                                            <span className="ws-suppliers-toggle-track" data-on={r.isActive ? '1' : '0'} />
                                            <span className="ws-suppliers-toggle-thumb" data-on={r.isActive ? '1' : '0'} />
                                        </label>
                                    </td>
                                    <td style={{ padding: 12 }}>
                                        <div className="ws-suppliers-row-actions">
                                            <button
                                                type="button"
                                                className="btn-portal-outline ws-suppliers-ledger-btn"
                                                onClick={() =>
                                                    onTabChange?.('supplier-ledger', {
                                                        type: 'local',
                                                        id: r.id,
                                                        name: r.name,
                                                    })
                                                }
                                            >
                                                <FileText size={12} />
                                                Ledger
                                            </button>
                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    className="btn-portal-outline ws-suppliers-ledger-btn"
                                                    onClick={() => {
                                                        setEditTarget(r);
                                                        setShowForm(true);
                                                    }}
                                                >
                                                    <Edit size={12} />
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </WsTableScroll>
            </div>

            {error && (
                <p className="ws-suppliers-error">{error}</p>
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
