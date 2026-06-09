import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/Modal';
import {
    applyStorageProductUom,
    createStorageUomProfile,
    deleteStorageUomProfile,
    listStorageUomProfiles,
    updateStorageUomProfile,
} from '../../../services/storageFacilityApi';
import {
    formatStockOnHandDisplay,
    formatUomRule,
    productEffectiveUom,
    SF_WAREHOUSE_UNIT_PRESETS,
    SF_WORKSHOP_UNIT_PRESETS,
} from './storageFacilityUomUtils';

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
            <div className="sf-form-field">
                <label htmlFor="sf-uom-name">Profile name *</label>
                <input
                    id="sf-uom-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Box → Liter (12)"
                    required
                />
            </div>
            <div className="sf-form-row-2">
                <div className="sf-form-field">
                    <label htmlFor="sf-uom-wh">Warehouse / packing unit</label>
                    <select
                        id="sf-uom-wh"
                        value={form.warehouseUnit}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, warehouseUnit: e.target.value }))
                        }
                    >
                        {[...new Set([...SF_WAREHOUSE_UNIT_PRESETS, form.warehouseUnit])].map(
                            (u) => (
                                <option key={u} value={u}>
                                    {u}
                                </option>
                            ),
                        )}
                    </select>
                </div>
                <div className="sf-form-field">
                    <label htmlFor="sf-uom-ws">Stock / workshop unit</label>
                    <select
                        id="sf-uom-ws"
                        value={form.workshopUnit}
                        onChange={(e) =>
                            setForm((f) => ({ ...f, workshopUnit: e.target.value }))
                        }
                    >
                        {[...new Set([...SF_WORKSHOP_UNIT_PRESETS, form.workshopUnit])].map(
                            (u) => (
                                <option key={u} value={u}>
                                    {u}
                                </option>
                            ),
                        )}
                    </select>
                </div>
            </div>
            <div className="sf-form-field">
                <label htmlFor="sf-uom-cf">
                    Conversion (1 warehouse unit = ? workshop units)
                </label>
                <input
                    id="sf-uom-cf"
                    type="number"
                    min="0.0001"
                    step="any"
                    value={form.conversionFactor}
                    onChange={(e) =>
                        setForm((f) => ({ ...f, conversionFactor: e.target.value }))
                    }
                />
            </div>
            <p className="sf-form-field-hint" style={{ margin: 0 }}>
                Rule: <strong>{rulePreview}</strong>
            </p>
            <div className="sf-form-field">
                <label htmlFor="sf-uom-notes">Notes</label>
                <textarea
                    id="sf-uom-notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional — e.g. Product A & B use this packing"
                />
            </div>
        </>
    );
}

export default function StorageFacilityUomTab({ brandId, products, onReload }) {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);

    const [profileModal, setProfileModal] = useState(null);
    const [profileForm, setProfileForm] = useState(emptyProfileForm);

    const [linkProduct, setLinkProduct] = useState(null);
    const [linkProfileId, setLinkProfileId] = useState('');
    const [customUom, setCustomUom] = useState(false);
    const [customForm, setCustomForm] = useState({
        warehouseUnit: 'Box',
        workshopUnit: 'Liter',
        conversionFactor: '12',
    });

    const loadProfiles = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await listStorageUomProfiles(brandId);
            setProfiles(res?.profiles ?? []);
        } catch (e) {
            setErr(e?.message || 'Failed to load UOM profiles');
            setProfiles([]);
        } finally {
            setLoading(false);
        }
    }, [brandId]);

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

    const customRulePreview = useMemo(
        () =>
            formatUomRule(
                customForm.warehouseUnit,
                customForm.workshopUnit,
                customForm.conversionFactor,
            ),
        [customForm],
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
                await updateStorageUomProfile(brandId, profileModal.id, body);
            } else {
                await createStorageUomProfile(brandId, body);
            }
            setProfileModal(null);
            await loadProfiles();
            onReload?.();
        } catch (ex) {
            window.alert(ex?.message || 'Save failed');
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteProfile = async (p) => {
        if (p.linkedProductCount > 0) {
            window.alert(
                `This profile is linked to ${p.linkedProductCount} product(s). Unlink them first.`,
            );
            return;
        }
        if (!window.confirm(`Delete UOM profile "${p.name}"?`)) return;
        setBusy(true);
        try {
            await deleteStorageUomProfile(brandId, p.id);
            await loadProfiles();
        } catch (ex) {
            window.alert(ex?.message || 'Delete failed');
        } finally {
            setBusy(false);
        }
    };

    const openLinkProduct = (product) => {
        const eff = productEffectiveUom(product);
        setLinkProduct(product);
        setLinkProfileId(product.uomProfileId || '');
        setCustomUom(!product.uomProfileId);
        setCustomForm({
            warehouseUnit: eff.warehouseUnit || 'Box',
            workshopUnit: eff.workshopUnit || 'pcs',
            conversionFactor: String(eff.conversionFactor ?? 1),
        });
    };

    const saveProductLink = async (e) => {
        e.preventDefault();
        if (!linkProduct) return;
        setBusy(true);
        try {
            if (customUom) {
                await applyStorageProductUom(brandId, linkProduct.id, {
                    warehouseUnit: customForm.warehouseUnit.trim(),
                    workshopUnit: customForm.workshopUnit.trim(),
                    conversionFactor: Math.max(
                        0.0001,
                        Number(customForm.conversionFactor) || 1,
                    ),
                });
            } else {
                if (!linkProfileId) {
                    window.alert('Select a UOM profile or use custom units.');
                    setBusy(false);
                    return;
                }
                await applyStorageProductUom(brandId, linkProduct.id, {
                    uomProfileId: linkProfileId,
                });
            }
            setLinkProduct(null);
            await loadProfiles();
            onReload?.();
        } catch (ex) {
            window.alert(ex?.message || 'Could not apply UOM');
        } finally {
            setBusy(false);
        }
    };

    const productRows = useMemo(
        () =>
            (products || []).map((p) => {
                const eff = productEffectiveUom(p);
                return {
                    ...p,
                    eff,
                    ruleLabel: formatUomRule(
                        eff.warehouseUnit,
                        eff.workshopUnit,
                        eff.conversionFactor,
                    ),
                };
            }),
        [products],
    );

    return (
        <>
            <p className="sf-doc-hint" style={{ marginBottom: 16 }}>
                Create reusable packing rules (e.g. <strong>1 Box = 12 Liter</strong> and{' '}
                <strong>1 Box = 24 Liter</strong> as two separate profiles). Link a profile to each
                product. <strong>Stock on hand</strong> is stored in workshop units (Liter) in the
                database; the table shows <strong>Box</strong> (warehouse) as the main number and
                Liters as detail. Invoices: choose the exact profile per line so conversion uses 12
                or 24 correctly.
            </p>

            {err ? (
                <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: 12 }}>{err}</p>
            ) : null}

            <section className="ws-section" style={{ padding: 16, marginBottom: 20 }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                        flexWrap: 'wrap',
                        gap: 8,
                    }}
                >
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>UOM profiles</h3>
                    <button
                        type="button"
                        className="mgr-si-btn-new"
                        onClick={openCreateProfile}
                        disabled={busy}
                    >
                        <Plus size={14} /> New UOM profile
                    </button>
                </div>

                {loading && profiles.length === 0 ? (
                    <p style={{ color: '#64748b', margin: 0 }}>Loading…</p>
                ) : (
                    <div className="premium-table mgr-si-table-wrap">
                        <table className="mgr-si-table">
                            <thead>
                                <tr className="table-header-row">
                                    <th className="table-th">Name</th>
                                    <th className="table-th">Conversion rule</th>
                                    <th className="table-th">Products</th>
                                    <th className="table-th">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profiles.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="table-cell"
                                            style={{ color: '#64748b' }}
                                        >
                                            No profiles yet — create one (e.g. Box = 12 Liter).
                                        </td>
                                    </tr>
                                ) : (
                                    profiles.map((p) => (
                                        <tr
                                            key={p.id}
                                            className="table-row"
                                            style={
                                                p.isActive === false
                                                    ? { opacity: 0.55 }
                                                    : undefined
                                            }
                                        >
                                            <td className="table-cell">{p.name}</td>
                                            <td className="table-cell">{p.ruleLabel}</td>
                                            <td className="table-cell">
                                                {p.linkedProductCount ?? 0}
                                            </td>
                                            <td className="table-cell">
                                                <button
                                                    type="button"
                                                    className="mgr-si-record-pay"
                                                    style={{ marginRight: 6 }}
                                                    onClick={() => openEditProfile(p)}
                                                    disabled={busy}
                                                >
                                                    <Pencil size={12} /> Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="mgr-si-record-pay"
                                                    onClick={() => handleDeleteProfile(p)}
                                                    disabled={busy}
                                                >
                                                    <Trash2 size={12} /> Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="ws-section" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>Link UOM to products</h3>
                <div className="premium-table mgr-si-table-wrap">
                    <table className="mgr-si-table">
                        <thead>
                            <tr className="table-header-row">
                                <th className="table-th">Product</th>
                                <th className="table-th">Stock on hand (warehouse)</th>
                                <th className="table-th">Current UOM rule</th>
                                <th className="table-th">Profile</th>
                                <th className="table-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productRows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="table-cell"
                                        style={{ color: '#64748b' }}
                                    >
                                        Add products under the Products tab first.
                                    </td>
                                </tr>
                            ) : (
                                productRows.map((p) => (
                                    <tr key={p.id} className="table-row">
                                        <td className="table-cell">
                                            <strong>{p.name}</strong>
                                            {p.sku ? (
                                                <span style={{ color: '#64748b' }}>
                                                    {' '}
                                                    · {p.sku}
                                                </span>
                                            ) : null}
                                            {!p.warehouseProduct ? (
                                                <div
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        color: '#b45309',
                                                    }}
                                                >
                                                    Not linked to warehouse catalog
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="table-cell">
                                            {(() => {
                                                const d = formatStockOnHandDisplay(
                                                    p.qtyOnHand,
                                                    p.eff,
                                                );
                                                return (
                                                    <>
                                                        <strong>{d.primary}</strong>
                                                        {d.secondary ? (
                                                            <div
                                                                style={{
                                                                    fontSize: '0.75rem',
                                                                    color: '#64748b',
                                                                }}
                                                            >
                                                                {d.secondary}
                                                            </div>
                                                        ) : null}
                                                    </>
                                                );
                                            })()}
                                        </td>
                                        <td className="table-cell">{p.ruleLabel}</td>
                                        <td className="table-cell">
                                            {p.uomProfile?.name ||
                                                p.eff.profileName ||
                                                (p.eff.source === 'catalog'
                                                    ? 'From catalog'
                                                    : '—')}
                                        </td>
                                        <td className="table-cell">
                                            <button
                                                type="button"
                                                className="mgr-si-record-pay"
                                                onClick={() => openLinkProduct(p)}
                                                disabled={busy}
                                            >
                                                <Link2 size={12} /> Link / edit
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {profileModal ? (
                <Modal
                    title={
                        profileModal.mode === 'edit'
                            ? 'Edit UOM profile'
                            : 'New UOM profile'
                    }
                    width="520px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !busy && setProfileModal(null)}
                >
                    <form className="sf-simple-form" onSubmit={saveProfile}>
                        <ProfileFormFields
                            form={profileForm}
                            setForm={setProfileForm}
                            rulePreview={profileRulePreview}
                        />
                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={busy}
                                onClick={() => setProfileModal(null)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={busy}>
                                {busy ? 'Saving…' : 'Save profile'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {linkProduct ? (
                <Modal
                    title={`UOM for ${linkProduct.name}`}
                    width="520px"
                    contentClassName="sf-simple-modal"
                    onClose={() => !busy && setLinkProduct(null)}
                >
                    <form className="sf-simple-form" onSubmit={saveProductLink}>
                        <label
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                            }}
                        >
                            <input
                                type="radio"
                                name="uom-link-mode"
                                checked={!customUom}
                                onChange={() => setCustomUom(false)}
                            />
                            Use saved profile
                        </label>
                        {!customUom ? (
                            <div className="sf-form-field" style={{ marginTop: 8 }}>
                                <label htmlFor="sf-link-profile">Profile</label>
                                <select
                                    id="sf-link-profile"
                                    value={linkProfileId}
                                    onChange={(e) => setLinkProfileId(e.target.value)}
                                    required={!customUom}
                                >
                                    <option value="">Select profile…</option>
                                    {activeProfiles.map((pr) => (
                                        <option key={pr.id} value={pr.id}>
                                            {pr.name} — {pr.ruleLabel}
                                        </option>
                                    ))}
                                </select>
                                {activeProfiles.length === 0 ? (
                                    <p className="sf-form-field-hint">
                                        Create a profile above first.
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        <label
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: '0.875rem',
                                marginTop: 12,
                                cursor: 'pointer',
                            }}
                        >
                            <input
                                type="radio"
                                name="uom-link-mode"
                                checked={customUom}
                                onChange={() => setCustomUom(true)}
                            />
                            Custom for this product only
                        </label>
                        {customUom ? (
                            <div style={{ marginTop: 8 }}>
                                <div className="sf-form-row-2">
                                    <div className="sf-form-field">
                                        <label>Warehouse unit</label>
                                        <select
                                            value={customForm.warehouseUnit}
                                            onChange={(e) =>
                                                setCustomForm((f) => ({
                                                    ...f,
                                                    warehouseUnit: e.target.value,
                                                }))
                                            }
                                        >
                                            {[
                                                ...new Set([
                                                    ...SF_WAREHOUSE_UNIT_PRESETS,
                                                    customForm.warehouseUnit,
                                                ]),
                                            ].map((u) => (
                                                <option key={u} value={u}>
                                                    {u}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="sf-form-field">
                                        <label>Workshop unit</label>
                                        <select
                                            value={customForm.workshopUnit}
                                            onChange={(e) =>
                                                setCustomForm((f) => ({
                                                    ...f,
                                                    workshopUnit: e.target.value,
                                                }))
                                            }
                                        >
                                            {[
                                                ...new Set([
                                                    ...SF_WORKSHOP_UNIT_PRESETS,
                                                    customForm.workshopUnit,
                                                ]),
                                            ].map((u) => (
                                                <option key={u} value={u}>
                                                    {u}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="sf-form-field">
                                    <label>Conversion factor</label>
                                    <input
                                        type="number"
                                        min="0.0001"
                                        step="any"
                                        value={customForm.conversionFactor}
                                        onChange={(e) =>
                                            setCustomForm((f) => ({
                                                ...f,
                                                conversionFactor: e.target.value,
                                            }))
                                        }
                                    />
                                </div>
                                <p className="sf-form-field-hint">
                                    Rule: <strong>{customRulePreview}</strong>
                                </p>
                            </div>
                        ) : null}

                        <div className="sf-form-actions">
                            <button
                                type="button"
                                className="btn-portal-outline"
                                disabled={busy}
                                onClick={() => setLinkProduct(null)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="mgr-si-btn-new" disabled={busy}>
                                {busy ? 'Applying…' : 'Apply to product'}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </>
    );
}
