import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Link2, Loader, Plus, RotateCcw, Ruler } from 'lucide-react';
import Modal from '../../../components/Modal';
import RowActionsMenu from '../../../components/RowActionsMenu';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import {
    formatStockOnHandDisplay,
    formatUomRule,
    productEffectiveUom,
    SF_WAREHOUSE_UNIT_PRESETS,
    SF_WORKSHOP_UNIT_PRESETS,
} from './storageFacilityUomUtils';
import '../../../styles/ui.css';

const emptyProfileForm = () => ({
    name: '',
    warehouseUnit: 'Box',
    workshopUnit: 'Liter',
    conversionFactor: '12',
    notes: '',
});

/** A unit list that always contains whatever the row already carries. */
function unitOptions(presets, current) {
    return [...new Set([...presets, current])].filter(Boolean);
}

function ProfileFormFields({ form, setForm, rulePreview }) {
    const t = useSfT();
    return (
        <div className="ui-form-grid">
            <div className="ui-field ui-col-12">
                <label htmlFor="sf-uom-name">{t('uom.label.name')}</label>
                <input
                    id="sf-uom-name"
                    type="text"
                    className="ui-input"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder={t('uom.ph.name')}
                    required
                />
            </div>
            <div className="ui-field ui-col-4">
                <label htmlFor="sf-uom-wh">{t('uom.label.warehouseUnit')}</label>
                <select
                    id="sf-uom-wh"
                    className="ui-select"
                    value={form.warehouseUnit}
                    onChange={(e) => setForm((f) => ({ ...f, warehouseUnit: e.target.value }))}
                >
                    {unitOptions(SF_WAREHOUSE_UNIT_PRESETS, form.warehouseUnit).map((u) => (
                        <option key={u} value={u}>{u}</option>
                    ))}
                </select>
            </div>
            <div className="ui-field ui-col-4">
                <label htmlFor="sf-uom-ws">{t('uom.label.workshopUnit')}</label>
                <select
                    id="sf-uom-ws"
                    className="ui-select"
                    value={form.workshopUnit}
                    onChange={(e) => setForm((f) => ({ ...f, workshopUnit: e.target.value }))}
                >
                    {unitOptions(SF_WORKSHOP_UNIT_PRESETS, form.workshopUnit).map((u) => (
                        <option key={u} value={u}>{u}</option>
                    ))}
                </select>
            </div>
            <div className="ui-field ui-col-4">
                <label htmlFor="sf-uom-cf">{t('uom.label.factor')}</label>
                <input
                    id="sf-uom-cf"
                    type="number"
                    min="0.0001"
                    step="any"
                    className="ui-input ui-input--figure"
                    value={form.conversionFactor}
                    onChange={(e) => setForm((f) => ({ ...f, conversionFactor: e.target.value }))}
                />
            </div>
            <div className="ui-field ui-col-12">
                <p className="ui-help">{t('uom.rule', { rule: rulePreview })}</p>
            </div>
            <div className="ui-field ui-col-12">
                <label htmlFor="sf-uom-notes">
                    {t('uom.label.notes')}{' '}
                    <span className="ui-field-opt">{t('uom.optional')}</span>
                </label>
                <textarea
                    id="sf-uom-notes"
                    rows={2}
                    className="ui-textarea"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder={t('uom.ph.notes')}
                />
            </div>
        </div>
    );
}

export default function StorageFacilityUomTab({ brandId, products, onReload }) {
    const t = useSfT();
    const sfApi = useStorageFacilityApi();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [busy, setBusy] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

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
        try {
            const res = await sfApi.listStorageUomProfiles(brandId);
            setProfiles(res?.profiles ?? []);
            setLoadError(false);
        } catch {
            setProfiles([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, sfApi]);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles, reloadKey]);

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

    const profilesPaging = usePagedRows(profiles, { resetKey: brandId });
    const productsPaging = usePagedRows(productRows, { resetKey: brandId });

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
        const body = {
            name: profileForm.name.trim(),
            warehouseUnit: profileForm.warehouseUnit.trim(),
            workshopUnit: profileForm.workshopUnit.trim(),
            conversionFactor: Math.max(0.0001, Number(profileForm.conversionFactor) || 1),
            notes: profileForm.notes.trim() || undefined,
        };
        setBusy(true);
        try {
            if (profileModal?.mode === 'edit') {
                await sfApi.updateStorageUomProfile(brandId, profileModal.id, body);
            } else {
                await sfApi.createStorageUomProfile(brandId, body);
            }
            setProfileModal(null);
            setReloadKey((k) => k + 1);
            onReload?.();
        } catch (ex) {
            window.alert(ex?.message || t('uom.errSave'));
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteProfile = async (p) => {
        if (p.linkedProductCount > 0) {
            window.alert(t('uom.err.linked', { n: p.linkedProductCount }));
            return;
        }
        if (!window.confirm(t('uom.confirmDelete', { name: p.name }))) return;
        setBusy(true);
        try {
            await sfApi.deleteStorageUomProfile(brandId, p.id);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('uom.errDelete'));
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
        if (!customUom && !linkProfileId) {
            window.alert(t('uom.link.err.noProfile'));
            return;
        }
        setBusy(true);
        try {
            await sfApi.applyStorageProductUom(
                brandId,
                linkProduct.id,
                customUom
                    ? {
                          warehouseUnit: customForm.warehouseUnit.trim(),
                          workshopUnit: customForm.workshopUnit.trim(),
                          conversionFactor: Math.max(
                              0.0001,
                              Number(customForm.conversionFactor) || 1,
                          ),
                      }
                    : { uomProfileId: linkProfileId },
            );
            setLinkProduct(null);
            setReloadKey((k) => k + 1);
            onReload?.();
        } catch (ex) {
            window.alert(ex?.message || t('uom.link.errApply'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t('uom.lead')}</p>

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <span className="ui-panel-title">{t('uom.profiles')}</span>
                    <span className="ui-meta">{t('uom.profiles.count', { n: profiles.length })}</span>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={openCreateProfile}
                            disabled={busy}
                        >
                            <Plus size={14} /> {t('uom.new')}
                        </button>
                    </div>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('uom.errLoad')}</div>
                        <div className="ui-empty-sub">{t('uom.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('uom.retry')}
                        </button>
                    </div>
                ) : !loading && profiles.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><Ruler size={18} /></div>
                        <div className="ui-empty-title">{t('uom.profiles.emptyTitle')}</div>
                        <div className="ui-empty-sub">{t('uom.profiles.emptySub')}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('uom.th.name')}</th>
                                <th>{t('uom.th.rule')}</th>
                                <th className="ui-num">{t('uom.th.products')}</th>
                                <th aria-label={t('uom.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                        <td><div className="ui-sk ui-sk--btn ui-sk--w25" /></td>
                                    </tr>
                                ))
                            ) : profilesPaging.pagedRows.map((p) => (
                                <tr key={p.id}>
                                    <td data-label={t('uom.th.name')}>
                                        <span className="ui-strong">{p.name}</span>
                                        {p.isActive === false ? (
                                            <span className="ui-pill ui-pill--warn ui-link--inline">
                                                {t('uom.inactive')}
                                            </span>
                                        ) : null}
                                        {p.notes ? <div className="ui-meta">{p.notes}</div> : null}
                                    </td>
                                    <td data-label={t('uom.th.rule')}>{p.ruleLabel}</td>
                                    <td data-label={t('uom.th.products')} className="ui-num">
                                        {p.linkedProductCount ?? 0}
                                    </td>
                                    <td>
                                        <div className="ui-rowacts">
                                            <RowActionsMenu
                                                ariaLabel={t('uom.act.menu', { name: p.name })}
                                                disabled={busy}
                                                items={[
                                                    {
                                                        label: t('uom.act.edit'),
                                                        onClick: () => openEditProfile(p),
                                                        disabled: busy,
                                                    },
                                                    {
                                                        label: t('uom.act.delete'),
                                                        onClick: () => handleDeleteProfile(p),
                                                        disabled: busy,
                                                        danger: true,
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...profilesPaging.pagerProps} />
            </div>

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <span className="ui-panel-title">{t('uom.link.title')}</span>
                    <span className="ui-meta">
                        {t('uom.link.count', { n: productRows.length })}
                    </span>
                </div>

                {productRows.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><Ruler size={18} /></div>
                        <div className="ui-empty-title">{t('uom.link.emptyTitle')}</div>
                        <div className="ui-empty-sub">{t('uom.link.emptySub')}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('uom.link.th.product')}</th>
                                <th className="ui-num">{t('uom.link.th.onHand')}</th>
                                <th>{t('uom.link.th.rule')}</th>
                                <th>{t('uom.link.th.profile')}</th>
                                <th aria-label={t('uom.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {productsPaging.pagedRows.map((p) => {
                                const onHand = formatStockOnHandDisplay(p.qtyOnHand, p.eff);
                                return (
                                    <tr key={p.id}>
                                        <td data-label={t('uom.link.th.product')}>
                                            <div className="ui-strong">{p.name}</div>
                                            {p.sku ? <div className="ui-meta">{p.sku}</div> : null}
                                            {!p.warehouseProduct ? (
                                                <div className="ui-help ui-help--err">
                                                    {t('uom.link.notLinked')}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td data-label={t('uom.link.th.onHand')} className="ui-num">
                                            <div className="ui-strong">{onHand.primary}</div>
                                            {onHand.secondary ? (
                                                <div className="ui-meta">{onHand.secondary}</div>
                                            ) : null}
                                        </td>
                                        <td data-label={t('uom.link.th.rule')}>{p.ruleLabel}</td>
                                        <td data-label={t('uom.link.th.profile')}>
                                            {p.uomProfile?.name ||
                                                p.eff.profileName ||
                                                (p.eff.source === 'catalog'
                                                    ? t('uom.link.fromCatalog')
                                                    : '—')}
                                        </td>
                                        <td>
                                            <div className="ui-rowacts">
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                    onClick={() => openLinkProduct(p)}
                                                    disabled={busy}
                                                >
                                                    <Link2 size={13} /> {t('uom.link.btn')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                <UiPager {...productsPaging.pagerProps} />
            </div>

            {profileModal ? (
                <Modal
                    title={profileModal.mode === 'edit' ? t('uom.modal.edit') : t('uom.modal.new')}
                    width="560px"
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={busy}
                    onClose={() => setProfileModal(null)}
                >
                    <form onSubmit={saveProfile} className="ui-stack">
                        <ProfileFormFields
                            form={profileForm}
                            setForm={setProfileForm}
                            rulePreview={profileRulePreview}
                        />
                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={busy}
                                onClick={() => setProfileModal(null)}
                            >
                                {t('uom.btn.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
                                {busy ? (
                                    <><Loader size={14} className="ui-spin" /> {t('uom.btn.saving')}</>
                                ) : t('uom.btn.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}

            {linkProduct ? (
                <Modal
                    title={t('uom.link.modal', { name: linkProduct.name })}
                    width="560px"
                    contentClassName="ui-tokens"
                    disableClose={busy}
                    onClose={() => setLinkProduct(null)}
                >
                    <form onSubmit={saveProductLink} className="ui-stack">
                        <div className="ui-stack-sm">
                            <label className="ui-check">
                                <input
                                    type="radio"
                                    name="uom-link-mode"
                                    checked={!customUom}
                                    onChange={() => setCustomUom(false)}
                                />
                                <span className="ui-check-main">{t('uom.link.useProfile')}</span>
                            </label>

                            {!customUom ? (
                                <div className="ui-form-grid">
                                    <div className="ui-field ui-col-12">
                                        <label htmlFor="sf-link-profile">{t('uom.link.profile')}</label>
                                        <select
                                            id="sf-link-profile"
                                            className="ui-select"
                                            value={linkProfileId}
                                            onChange={(e) => setLinkProfileId(e.target.value)}
                                            required={!customUom}
                                        >
                                            <option value="">{t('uom.link.selectProfile')}</option>
                                            {activeProfiles.map((pr) => (
                                                <option key={pr.id} value={pr.id}>
                                                    {pr.name} — {pr.ruleLabel}
                                                </option>
                                            ))}
                                        </select>
                                        {activeProfiles.length === 0 ? (
                                            <p className="ui-help">{t('uom.link.noProfiles')}</p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}

                            <label className="ui-check">
                                <input
                                    type="radio"
                                    name="uom-link-mode"
                                    checked={customUom}
                                    onChange={() => setCustomUom(true)}
                                />
                                <span className="ui-check-main">{t('uom.link.custom')}</span>
                            </label>

                            {customUom ? (
                                <div className="ui-form-grid">
                                    <div className="ui-field ui-col-4">
                                        <label htmlFor="sf-link-wh">
                                            {t('uom.label.warehouseUnit')}
                                        </label>
                                        <select
                                            id="sf-link-wh"
                                            className="ui-select"
                                            value={customForm.warehouseUnit}
                                            onChange={(e) =>
                                                setCustomForm((f) => ({
                                                    ...f,
                                                    warehouseUnit: e.target.value,
                                                }))
                                            }
                                        >
                                            {unitOptions(
                                                SF_WAREHOUSE_UNIT_PRESETS,
                                                customForm.warehouseUnit,
                                            ).map((u) => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ui-field ui-col-4">
                                        <label htmlFor="sf-link-ws">
                                            {t('uom.label.workshopUnit')}
                                        </label>
                                        <select
                                            id="sf-link-ws"
                                            className="ui-select"
                                            value={customForm.workshopUnit}
                                            onChange={(e) =>
                                                setCustomForm((f) => ({
                                                    ...f,
                                                    workshopUnit: e.target.value,
                                                }))
                                            }
                                        >
                                            {unitOptions(
                                                SF_WORKSHOP_UNIT_PRESETS,
                                                customForm.workshopUnit,
                                            ).map((u) => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="ui-field ui-col-4">
                                        <label htmlFor="sf-link-cf">{t('uom.link.factor')}</label>
                                        <input
                                            id="sf-link-cf"
                                            type="number"
                                            min="0.0001"
                                            step="any"
                                            className="ui-input ui-input--figure"
                                            value={customForm.conversionFactor}
                                            onChange={(e) =>
                                                setCustomForm((f) => ({
                                                    ...f,
                                                    conversionFactor: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="ui-field ui-col-12">
                                        <p className="ui-help">
                                            {t('uom.rule', { rule: customRulePreview })}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={busy}
                                onClick={() => setLinkProduct(null)}
                            >
                                {t('uom.btn.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
                                {busy ? (
                                    <>
                                        <Loader size={14} className="ui-spin" />{' '}
                                        {t('uom.link.btn.applying')}
                                    </>
                                ) : t('uom.link.btn.apply')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
