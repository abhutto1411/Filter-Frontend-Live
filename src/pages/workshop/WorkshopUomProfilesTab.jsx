import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/Modal';
import {
    createWorkshopUomProfile,
    deleteWorkshopUomProfile,
    listWorkshopUomProfiles,
    patchBranchProduct,
    updateWorkshopUomProfile,
} from '../../services/workshopCatalogApi';
import {
    formatUomRule,
    WS_WAREHOUSE_UNIT_PRESETS,
    WS_WORKSHOP_UNIT_PRESETS,
} from './workshopUomUtils';

const emptyProfileForm = () => ({
    name: '',
    warehouseUnit: 'Box',
    workshopUnit: 'Liter',
    conversionFactor: '12',
    notes: '',
});

function ProfileFormFields({ form, setForm, rulePreview }) {
    return (
        <>
            <div className="ws-uom-form-field">
                <label htmlFor="ws-prof-name">Profile name *</label>
                <input
                    id="ws-prof-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Box → Liter (12)"
                    required
                />
            </div>
            <div className="ws-uom-flow">
                <div className="ws-uom-flow-unit">
                    <label htmlFor="ws-prof-wh">Warehouse / packing unit</label>
                    <select
                        id="ws-prof-wh"
                        value={form.warehouseUnit}
                        onChange={(e) => setForm((f) => ({ ...f, warehouseUnit: e.target.value }))}
                    >
                        {[...new Set([...WS_WAREHOUSE_UNIT_PRESETS, form.warehouseUnit])].map((u) => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>
                </div>
                <div className="ws-uom-flow-bridge" aria-hidden>
                    <span>1 =</span>
                    <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={form.conversionFactor}
                        onChange={(e) => setForm((f) => ({ ...f, conversionFactor: e.target.value }))}
                        aria-label="Conversion factor"
                    />
                </div>
                <div className="ws-uom-flow-unit">
                    <label htmlFor="ws-prof-ws">Stock / workshop unit</label>
                    <select
                        id="ws-prof-ws"
                        value={form.workshopUnit}
                        onChange={(e) => setForm((f) => ({ ...f, workshopUnit: e.target.value }))}
                    >
                        {[...new Set([...WS_WORKSHOP_UNIT_PRESETS, form.workshopUnit])].map((u) => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>
                </div>
            </div>
            <p className="ws-uom-preview">
                <span className="ws-uom-preview-label">Rule</span>
                <span className="ws-uom-preview-rule">{rulePreview}</span>
            </p>
            <div className="ws-uom-form-field">
                <label htmlFor="ws-prof-notes">Notes</label>
                <textarea
                    id="ws-prof-notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional — e.g. Product A & B use this packing"
                />
            </div>
        </>
    );
}

export default function WorkshopUomProfilesTab({
    workshopId,
    branchId,
    products = [],
    onReloadProducts,
    isAllBranches,
}) {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [profileModal, setProfileModal] = useState(null);
    const [profileForm, setProfileForm] = useState(emptyProfileForm);
    const [linkProduct, setLinkProduct] = useState(null);
    const [linkProfileId, setLinkProfileId] = useState('');

    const loadProfiles = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listWorkshopUomProfiles({ workshopId });
            setProfiles(res?.profiles ?? []);
        } catch (e) {
            setErr(e?.message || 'Failed to load UOM profiles');
            setProfiles([]);
        } finally {
            setLoading(false);
        }
    }, [workshopId]);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);

    const activeProfiles = useMemo(
        () => profiles.filter((p) => p.isActive !== false),
        [profiles],
    );

    const profileRulePreview = useMemo(
        () =>
            formatUomRule(
                profileForm.warehouseUnit,
                profileForm.workshopUnit,
                profileForm.conversionFactor,
            ),
        [profileForm],
    );

    const openCreateProfile = () => {
        setProfileForm(emptyProfileForm());
        setProfileModal({ mode: 'create' });
    };

    const openEditProfile = (p) => {
        setProfileForm({
            name: p.name,
            warehouseUnit: p.warehouseUnit,
            workshopUnit: p.workshopUnit,
            conversionFactor: String(p.conversionFactor),
            notes: p.notes || '',
        });
        setProfileModal({ mode: 'edit', id: p.id });
    };

    const saveProfile = async (e) => {
        e.preventDefault();
        const cf = Math.max(0.0001, Number(profileForm.conversionFactor) || 1);
        const body = {
            name: profileForm.name.trim(),
            warehouseUnit: profileForm.warehouseUnit.trim(),
            workshopUnit: profileForm.workshopUnit.trim(),
            conversionFactor: cf,
            notes: profileForm.notes.trim() || undefined,
        };
        setBusy(true);
        try {
            if (profileModal?.mode === 'edit') {
                await updateWorkshopUomProfile(profileModal.id, body, { workshopId });
            } else {
                await createWorkshopUomProfile(body, { workshopId });
            }
            setProfileModal(null);
            await loadProfiles();
            onReloadProducts?.();
        } catch (ex) {
            setErr(ex?.message || 'Failed to save profile');
        } finally {
            setBusy(false);
        }
    };

    const removeProfile = async (p) => {
        if (!window.confirm(`Delete profile "${p.name}"? Linked products will be unlinked.`)) return;
        setBusy(true);
        try {
            await deleteWorkshopUomProfile(p.id, { workshopId });
            await loadProfiles();
            onReloadProducts?.();
        } catch (ex) {
            setErr(ex?.message || 'Failed to delete profile');
        } finally {
            setBusy(false);
        }
    };

    const openLink = (product) => {
        setLinkProduct(product);
        setLinkProfileId(product.uomProfileId || '');
    };

    const saveLink = async (e) => {
        e.preventDefault();
        if (!linkProduct?.id || !branchId || isAllBranches) return;
        setBusy(true);
        try {
            await patchBranchProduct(
                branchId,
                String(linkProduct.id),
                { uomProfileId: linkProfileId || null },
                { workshopId },
            );
            setLinkProduct(null);
            onReloadProducts?.();
        } catch (ex) {
            setErr(ex?.message || 'Failed to link profile');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="ws-uom-profiles-tab">
            <p className="ws-uom-profiles-intro">
                Create reusable packing rules (e.g. <strong>1 Box = 12 Liter</strong> and{' '}
                <strong>1 Box = 24 Liter</strong> as two separate profiles). Link a profile to each
                product. Stock on hand is stored in workshop units (Liter) in the database; the
                inventory table shows Box as the main number and Liters as detail. On purchase
                invoices, choose the exact profile per line so conversion uses 12 or 24 correctly.
            </p>

            <div className="ws-uom-profiles-header">
                <h3>UOM profiles</h3>
                <button type="button" className="mc-btn-primary blue-btn" onClick={openCreateProfile}>
                    <Plus size={16} aria-hidden /> New UOM profile
                </button>
            </div>

            {err ? <p className="ws-uom-error">{err}</p> : null}

            <div className="ws-uom-profiles-table-wrap">
                <table className="ws-uom-profiles-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Conversion rule</th>
                            <th>Products</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="ws-uom-profiles-empty">Loading…</td>
                            </tr>
                        ) : profiles.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="ws-uom-profiles-empty">
                                    No profiles yet — create one (e.g. Box = 12 Liter).
                                </td>
                            </tr>
                        ) : (
                            profiles.map((p) => (
                                <tr key={p.id}>
                                    <td><strong>{p.name}</strong></td>
                                    <td>{p.ruleLabel}</td>
                                    <td>{p.linkedProductCount ?? 0}</td>
                                    <td className="ws-uom-profiles-actions">
                                        <button type="button" className="mc-btn-ghost" onClick={() => openEditProfile(p)}>
                                            <Pencil size={14} aria-hidden /> Edit
                                        </button>
                                        <button type="button" className="mc-btn-ghost" onClick={() => removeProfile(p)}>
                                            <Trash2 size={14} aria-hidden /> Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!isAllBranches && products.length > 0 ? (
                <div className="ws-uom-link-section">
                    <h4>Link profile to product</h4>
                    <p className="ws-uom-link-hint">Pick a product from this branch to assign its default packing profile.</p>
                    <div className="ws-uom-link-list">
                        {products.slice(0, 20).map((p) => (
                            <div key={p.id} className="ws-uom-link-row">
                                <div>
                                    <strong>{p.name}</strong>
                                    <span className="ws-uom-link-meta">
                                        {p.uomProfileName
                                            ? `Profile: ${p.uomProfileName}`
                                            : p.conversionRule || p.workshopUnit || p.unit || 'No profile'}
                                    </span>
                                </div>
                                <button type="button" className="mc-btn-ghost" onClick={() => openLink(p)}>
                                    <Link2 size={14} aria-hidden /> Link
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {profileModal ? (
                <Modal
                    title={profileModal.mode === 'edit' ? 'Edit UOM profile' : 'New UOM profile'}
                    width="560px"
                    onClose={() => !busy && setProfileModal(null)}
                    disableClose={busy}
                >
                    <form onSubmit={saveProfile} className="ws-uom-modal-body">
                        <ProfileFormFields
                            form={profileForm}
                            setForm={setProfileForm}
                            rulePreview={profileRulePreview}
                        />
                        <div className="ws-uom-modal-footer">
                            <button type="button" className="mc-btn-ghost mc-btn-large" disabled={busy} onClick={() => setProfileModal(null)}>
                                Cancel
                            </button>
                            <button type="submit" className="mc-btn-primary mc-btn-large blue-btn" disabled={busy}>
                                {busy ? 'Saving…' : 'Save profile'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {linkProduct ? (
                <Modal title="Link UOM profile" width="480px" onClose={() => !busy && setLinkProduct(null)} disableClose={busy}>
                    <form onSubmit={saveLink} className="ws-uom-modal-body">
                        <div className="ws-uom-product-card">
                            <p className="ws-uom-product-name">{linkProduct.name}</p>
                            <p className="ws-uom-product-meta">{linkProduct.sku || '—'}</p>
                        </div>
                        <div className="ws-uom-form-field">
                            <label htmlFor="ws-link-profile">UOM profile</label>
                            <select
                                id="ws-link-profile"
                                value={linkProfileId}
                                onChange={(e) => setLinkProfileId(e.target.value)}
                            >
                                <option value="">— No profile (use product unit) —</option>
                                {activeProfiles.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} — {p.ruleLabel}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="ws-uom-modal-footer">
                            <button type="button" className="mc-btn-ghost mc-btn-large" disabled={busy} onClick={() => setLinkProduct(null)}>
                                Cancel
                            </button>
                            <button type="submit" className="mc-btn-primary mc-btn-large blue-btn" disabled={busy}>
                                {busy ? 'Saving…' : 'Save link'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
