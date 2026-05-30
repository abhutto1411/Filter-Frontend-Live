import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Plus, Pencil } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { qs, branchScopeParams } from '../../services/workshopStaffApi';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { ShimmerTableBodyRows } from '../../components/supplier/Shimmer';

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const emptyForm = () => ({
    code: '',
    discountType: 'fixed',
    discountValue: '',
    validFrom: '',
    validTo: '',
    usageLimit: '',
    minOrderAmount: '',
    description: '',
    isActive: true,
});

const promoToForm = (promo) => ({
    code: promo.code || '',
    discountType: promo.discountType === 'percent' ? 'percent' : 'fixed',
    discountValue: promo.discountValue != null && promo.discountValue !== '' ? String(promo.discountValue) : '',
    validFrom: promo.validFrom || '',
    validTo: promo.validTo || '',
    usageLimit: promo.usageLimit != null && promo.usageLimit !== '' ? String(promo.usageLimit) : '',
    minOrderAmount: promo.minOrderAmount != null && promo.minOrderAmount !== '' ? String(promo.minOrderAmount) : '',
    description: promo.description || '',
    isActive: promo.isActive !== false,
});

function buildPromoPayload(form, { includeIsActive = false } = {}) {
    const payload = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: toNumber(form.discountValue),
        validFrom: form.validFrom,
        validTo: form.validTo,
        usageLimit: form.usageLimit.trim() === '' ? null : toNumber(form.usageLimit),
        minOrderAmount: form.minOrderAmount.trim() === '' ? null : toNumber(form.minOrderAmount),
        description: form.description.trim() || null,
    };
    if (includeIsActive) {
        payload.isActive = Boolean(form.isActive);
    }
    return payload;
}

function PromoCodeFormFields({ form, setForm, codeReadOnly = false, usageCount }) {
    return (
        <div className="ws-form-grid">
            <div className="ws-field">
                <label>Promo Code *</label>
                <input
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g. SAVE20"
                    readOnly={codeReadOnly}
                    style={codeReadOnly ? { background: '#f8fafc' } : undefined}
                />
            </div>
            <div className="ws-field">
                <label>Discount Type *</label>
                <select
                    value={form.discountType}
                    onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value }))}
                >
                    <option value="fixed">Fixed (SAR)</option>
                    <option value="percent">Percent (%)</option>
                </select>
            </div>
            <div className="ws-field">
                <label>Discount Value *</label>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discountValue}
                    onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                />
            </div>
            <div className="ws-field">
                <label>Usage Limit</label>
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.usageLimit}
                    onChange={(e) => setForm((prev) => ({ ...prev, usageLimit: e.target.value }))}
                    placeholder="Leave empty for unlimited"
                />
                {usageCount != null && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Times used: {toNumber(usageCount)}
                    </p>
                )}
            </div>
            <div className="ws-field">
                <label>Min Order Amount (SAR)</label>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, minOrderAmount: e.target.value }))}
                />
            </div>
            <div className="ws-field">
                <label>Valid From *</label>
                <input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => setForm((prev) => ({ ...prev, validFrom: e.target.value }))}
                />
            </div>
            <div className="ws-field">
                <label>Valid To *</label>
                <input
                    type="date"
                    value={form.validTo}
                    onChange={(e) => setForm((prev) => ({ ...prev, validTo: e.target.value }))}
                />
            </div>
            <div className="ws-field" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional internal note"
                />
            </div>
            <div className="ws-field">
                <label>Status</label>
                <select
                    value={form.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))}
                >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>
        </div>
    );
}

export default function WorkshopPromoCodes({ selectedBranchId = 'all', branches = [] }) {
    const { hasPermission } = useAuth();
    const canCreatePromo = hasPermission('workshop.promo-codes.create');
    const canEditPromo   = hasPermission('workshop.promo-codes.edit');
    const branchLabel = useMemo(() => {
        if (!selectedBranchId || selectedBranchId === 'all') return 'All branches';
        return branches.find((b) => String(b.id) === String(selectedBranchId))?.name || 'Branch';
    }, [branches, selectedBranchId]);

    const [promoCodes, setPromoCodes] = useState([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingPromo, setEditingPromo] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState(emptyForm);

    const loadPromoCodes = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiFetch(
                `/workshop-staff/promo-codes${qs({
                    limit: 100,
                    offset: 0,
                    ...branchScopeParams(selectedBranchId),
                })}`,
            );
            if (!(response?.success && Array.isArray(response.promoCodes))) {
                throw new Error('Invalid promo codes response.');
            }
            let rows = response.promoCodes;
            if (selectedBranchId && selectedBranchId !== 'all') {
                const bid = String(selectedBranchId);
                rows = rows.filter((pc) => {
                    const ids = pc.branchIds ?? pc.branch_ids ?? pc.applicableBranchIds;
                    if (!Array.isArray(ids) || ids.length === 0) return true;
                    return ids.some((id) => String(id) === bid);
                });
            }
            setPromoCodes(rows);
            setTotal(response.total ?? rows.length);
        } catch (err) {
            setError(err.message || 'Failed to load promo codes.');
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        loadPromoCodes();
    }, [loadPromoCodes]);

    const openCreate = () => {
        setEditingPromo(null);
        setForm(emptyForm());
        setShowCreateModal(true);
    };

    const openEdit = (promo) => {
        setEditingPromo(promo);
        setForm(promoToForm(promo));
        setShowCreateModal(true);
    };

    const closeModal = () => {
        setShowCreateModal(false);
        setEditingPromo(null);
        setForm(emptyForm());
    };

    const savePromoCode = async () => {
        if (!form.code.trim() || !form.validFrom || !form.validTo) return;

        setIsSaving(true);
        setError('');
        try {
            if (editingPromo) {
                await apiFetch(`/workshop-staff/promo-code/${encodeURIComponent(String(editingPromo.id))}`, {
                    method: 'PATCH',
                    body: JSON.stringify(buildPromoPayload(form, { includeIsActive: true })),
                });
            } else {
                const payload = buildPromoPayload(form, { includeIsActive: true });
                await apiFetch('/workshop-staff/promo-code/create', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...payload,
                        usageLimit: payload.usageLimit ?? undefined,
                        minOrderAmount: payload.minOrderAmount ?? undefined,
                        isActive: true,
                    }),
                });
            }
            closeModal();
            await loadPromoCodes();
        } catch (err) {
            setError(err.message || (editingPromo ? 'Failed to update promo code.' : 'Failed to create promo code.'));
        } finally {
            setIsSaving(false);
        }
    };

    const activeCount = promoCodes.filter((p) => p.isActive).length;

    return (
        <div>
            <div className="ws-page-header">
                <div>
                    <h2 className="ws-page-title">Promo Codes</h2>
                    <p className="ws-page-sub">
                        Create and manage promotional codes · <strong>{branchLabel}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn-portal" onClick={loadPromoCodes} disabled={isLoading}>
                        <RefreshCw size={14} /> {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                    {canCreatePromo && (
                        <button type="button" className="btn-portal" onClick={openCreate}>
                            <Plus size={14} /> Create Promo
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="ws-section" style={{ marginBottom: 16, color: '#B91C1C', borderColor: '#FECACA' }}>
                    {error}
                </div>
            )}

            <div className="ws-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Total Promo Codes</p>
                        <p className="ws-kpi-value">{total}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--purple">PC</div>
                </div>
                <div className="ws-kpi-card">
                    <div>
                        <p className="ws-kpi-label">Active</p>
                        <p className="ws-kpi-value">{activeCount}</p>
                    </div>
                    <div className="ws-kpi-icon ws-kpi-icon--green">ON</div>
                </div>
            </div>

            <div className="ws-section" style={{ marginTop: 16 }}>
                <div style={{ overflowX: 'auto', padding: 16 }}>
                    <table className="ws-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Discount</th>
                                <th>Validity</th>
                                <th>Usage</th>
                                <th>Min Order</th>
                                <th>Status</th>
                                <th style={{ width: 100 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && promoCodes.length === 0 ? (
                                <ShimmerTableBodyRows rows={6} columns={7} />
                            ) : promoCodes.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                                        No promo codes found
                                    </td>
                                </tr>
                            ) : (
                                promoCodes.map((promo) => (
                                    <tr key={promo.id}>
                                        <td><strong>{promo.code}</strong></td>
                                        <td>
                                            {promo.discountType === 'percent'
                                                ? `${toNumber(promo.discountValue)}%`
                                                : `SAR ${toNumber(promo.discountValue).toLocaleString()}`}
                                        </td>
                                        <td>
                                            {promo.validFrom || '—'} to {promo.validTo || '—'}
                                        </td>
                                        <td>
                                            {promo.usageLimit != null && promo.usageLimit !== ''
                                                ? `${toNumber(promo.usageCount)} / ${toNumber(promo.usageLimit)}`
                                                : `${toNumber(promo.usageCount)} / ∞`}
                                        </td>
                                        <td>SAR {toNumber(promo.minOrderAmount).toLocaleString()}</td>
                                        <td>
                                            <span className={`ws-badge ${promo.isActive ? 'ws-badge--green' : 'ws-badge--gray'}`}>
                                                {promo.isActive ? 'active' : 'inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            {canEditPromo && (
                                                <button
                                                    type="button"
                                                    className="btn-portal"
                                                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                                    onClick={() => openEdit(promo)}
                                                >
                                                    <Pencil size={12} /> Edit
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreateModal && (
                <Modal
                    title={editingPromo ? `Edit Promo — ${editingPromo.code}` : 'Create Promo Code'}
                    onClose={closeModal}
                    footer={(
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-secondary" onClick={closeModal} disabled={isSaving}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-submit"
                                onClick={savePromoCode}
                                disabled={isSaving || !form.code.trim() || !form.validFrom || !form.validTo}
                            >
                                {isSaving ? 'Saving...' : editingPromo ? 'Update' : 'Save'}
                            </button>
                        </div>
                    )}
                >
                    <PromoCodeFormFields
                        form={form}
                        setForm={setForm}
                        usageCount={editingPromo ? toNumber(editingPromo.usageCount) : undefined}
                    />
                </Modal>
            )}
        </div>
    );
}
