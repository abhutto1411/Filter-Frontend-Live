import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader, MapPin, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import Modal from '../../../components/Modal';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import '../../../styles/ui.css';

const EMPTY_FORM = { name: '', code: '', companyName: '' };

export default function StorageFacilityLocationsTab({ brandId }) {
    const t = useSfT();
    const sfApi = useStorageFacilityApi();
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [busy, setBusy] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sfApi.listStorageLocations(brandId);
            setLocations(res?.locations ?? []);
            setLoadError(false);
        } catch {
            setLocations([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, sfApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    // A brand has a handful of depots, and the endpoint returns them whole.
    const paging = usePagedRows(locations, { resetKey: brandId });

    const openAdd = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setModalOpen(true);
    };

    const openEdit = (loc) => {
        setEditing(loc);
        setForm({
            name: loc.name || '',
            code: loc.code || '',
            companyName: loc.companyName || '',
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        if (busy) return;
        setModalOpen(false);
    };

    const save = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        const body = {
            name: form.name.trim(),
            code: form.code.trim() || undefined,
            companyName: form.companyName.trim() || undefined,
        };
        setBusy(true);
        try {
            if (editing) {
                await sfApi.updateStorageLocation(brandId, editing.id, body);
            } else {
                await sfApi.createStorageLocation(brandId, body);
            }
            setModalOpen(false);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('loc.errSave'));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (loc) => {
        if (loc.isSystem) {
            window.alert(t('loc.cantDelete'));
            return;
        }
        if (!window.confirm(t('loc.confirmDelete', { name: loc.name }))) return;
        try {
            await sfApi.deleteStorageLocation(brandId, loc.id);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('loc.errDelete'));
        }
    };

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t('loc.lead')}</p>

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <span>{t('loc.count', { n: locations.length })}</span>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={openAdd}
                        >
                            <Plus size={14} /> {t('loc.add')}
                        </button>
                    </div>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('loc.errLoad')}</div>
                        <div className="ui-empty-sub">{t('loc.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('loc.retry')}
                        </button>
                    </div>
                ) : !loading && locations.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><MapPin size={18} /></div>
                        <div className="ui-empty-title">{t('loc.emptyTitle')}</div>
                        <div className="ui-empty-sub">{t('loc.emptySub')}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('loc.th.name')}</th>
                                <th>{t('loc.th.company')}</th>
                                <th>{t('loc.th.code')}</th>
                                <th>{t('loc.th.type')}</th>
                                <th aria-label={t('loc.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--btn" /></td>
                                    </tr>
                                ))
                            ) : paging.pagedRows.map((loc) => (
                                <tr key={loc.id}>
                                    <td data-label={t('loc.th.name')}>
                                        <div className="ui-row">
                                            <MapPin size={13} className="ui-glyph" />
                                            <span className="ui-strong">{loc.name}</span>
                                            {loc.isSystem ? (
                                                <span className="ui-pill ui-pill--neutral">
                                                    {t('loc.system')}
                                                </span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td data-label={t('loc.th.company')}>{loc.companyName || '—'}</td>
                                    <td data-label={t('loc.th.code')} className="ui-mono">
                                        {loc.code || '—'}
                                    </td>
                                    <td data-label={t('loc.th.type')}>
                                        {t(`loc.kind.${loc.locationKind}`)}
                                    </td>
                                    <td>
                                        {/* Two actions, so they sit in the row rather than
                                            behind a menu — which in the admin portal was
                                            unstyled anyway, its CSS never being imported
                                            outside the supplier layout. */}
                                        <div className="ui-rowacts">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                onClick={() => openEdit(loc)}
                                            >
                                                <Pencil size={13} /> {t('loc.btn.edit')}
                                            </button>
                                            {loc.isSystem ? null : (
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--danger ui-btn--sm"
                                                    onClick={() => remove(loc)}
                                                >
                                                    <Trash2 size={13} /> {t('loc.btn.delete')}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerProps} />
            </div>

            {modalOpen ? (
                <Modal
                    title={editing ? t('loc.modal.edit') : t('loc.modal.add')}
                    width="480px"
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={busy}
                    onClose={closeModal}
                >
                    <form onSubmit={save}>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-loc-name">{t('loc.label.name')}</label>
                                <input
                                    id="sf-loc-name"
                                    type="text"
                                    className="ui-input"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder={t('loc.ph.name')}
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-loc-company">
                                    {t('loc.label.company')}{' '}
                                    <span className="ui-field-opt">{t('loc.optional')}</span>
                                </label>
                                <input
                                    id="sf-loc-company"
                                    type="text"
                                    className="ui-input"
                                    value={form.companyName}
                                    onChange={(e) =>
                                        setForm((f) => ({ ...f, companyName: e.target.value }))
                                    }
                                    placeholder={t('loc.ph.company')}
                                />
                            </div>
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-loc-code">
                                    {t('loc.label.code')}{' '}
                                    <span className="ui-field-opt">{t('loc.optional')}</span>
                                </label>
                                <input
                                    id="sf-loc-code"
                                    type="text"
                                    className="ui-input"
                                    value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                    placeholder={t('loc.ph.code')}
                                />
                            </div>
                        </div>

                        {editing?.isSystem ? (
                            <p className="ui-help">{t('loc.systemHint')}</p>
                        ) : null}

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={busy}
                                onClick={closeModal}
                            >
                                {t('loc.btn.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={busy}>
                                {busy ? (
                                    <><Loader size={14} className="ui-spin" /> {t('loc.btn.saving')}</>
                                ) : t('loc.btn.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
