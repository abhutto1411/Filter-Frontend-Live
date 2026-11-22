import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader, Plus, RotateCcw, Truck } from 'lucide-react';
import Modal from '../../../components/Modal';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import { useStorageFacilityApi } from './StorageFacilityPortalContext';
import { useSfT } from './useSfT';
import '../../../styles/ui.css';

const EMPTY_FORM = { name: '', code: '', contactPerson: '', email: '', mobile: '' };

export default function StorageFacilitySuppliersTab({ brandId }) {
    const t = useSfT();
    const sfApi = useStorageFacilityApi();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [reloadKey, setReloadKey] = useState(0);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await sfApi.listStorageSuppliers(brandId);
            setRows(Array.isArray(res?.suppliers) ? res.suppliers : []);
            setLoadError(false);
        } catch {
            setRows([]);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [brandId, sfApi]);

    useEffect(() => {
        load();
    }, [load, reloadKey]);

    // The endpoint returns the brand's whole vendor list, so the pager slices.
    const paging = usePagedRows(rows, { resetKey: brandId });

    const closeModal = () => {
        if (saving) return;
        setAddOpen(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            await sfApi.createStorageSupplier(brandId, form);
            setAddOpen(false);
            setForm(EMPTY_FORM);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('ap.errCreate'));
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (row) => {
        try {
            await sfApi.updateStorageSupplier(brandId, row.id, {
                isActive: row.isActive === false,
            });
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('ap.errUpdate'));
        }
    };

    const setField = (field) => (e) => {
        const { value } = e.target;
        setForm((f) => ({ ...f, [field]: value }));
    };

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <p className="ui-lead">{t('ap.lead')}</p>

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <span>{t('ap.count', { n: rows.length })}</span>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => setAddOpen(true)}
                        >
                            <Plus size={14} /> {t('ap.add')}
                        </button>
                    </div>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('ap.errLoad')}</div>
                        <div className="ui-empty-sub">{t('ap.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('ap.retry')}
                        </button>
                    </div>
                ) : !loading && rows.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><Truck size={18} /></div>
                        <div className="ui-empty-title">{t('ap.emptyTitle')}</div>
                        <div className="ui-empty-sub">{t('ap.emptySub')}</div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('ap.th.name')}</th>
                                <th>{t('ap.th.code')}</th>
                                <th>{t('ap.th.contact')}</th>
                                <th>{t('ap.th.mobile')}</th>
                                <th>{t('ap.th.status')}</th>
                                <th aria-label={t('ap.th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--btn" /></td>
                                    </tr>
                                ))
                            ) : paging.pagedRows.map((r) => {
                                const active = r.isActive !== false;
                                return (
                                    <tr key={r.id}>
                                        <td data-label={t('ap.th.name')}>
                                            <div className="ui-strong">{r.name}</div>
                                        </td>
                                        <td data-label={t('ap.th.code')} className="ui-mono">
                                            {r.code || '—'}
                                        </td>
                                        <td data-label={t('ap.th.contact')}>{r.contactPerson || '—'}</td>
                                        <td data-label={t('ap.th.mobile')} className="ui-mono ui-nowrap">
                                            {r.mobile || '—'}
                                        </td>
                                        <td data-label={t('ap.th.status')}>
                                            <span className={`ui-pill ui-pill--${active ? 'ok' : 'neutral'}`}>
                                                {active ? t('ap.status.active') : t('ap.status.inactive')}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="ui-rowacts">
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                    onClick={() => toggleActive(r)}
                                                >
                                                    {active ? t('ap.btn.deactivate') : t('ap.btn.activate')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerProps} />
            </div>

            {addOpen ? (
                <Modal
                    title={t('ap.modal.title')}
                    width="520px"
                    // Portalled to <body>, outside this page's `.ui-root`, so
                    // the modal has to carry the design tokens itself.
                    contentClassName="ui-tokens"
                    disableClose={saving}
                    onClose={closeModal}
                >
                    <form onSubmit={handleCreate}>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sf-ap-name">{t('ap.label.name')}</label>
                                <input
                                    id="sf-ap-name"
                                    type="text"
                                    className="ui-input"
                                    value={form.name}
                                    onChange={setField('name')}
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-ap-code">
                                    {t('ap.label.code')}{' '}
                                    <span className="ui-field-opt">{t('ap.optional')}</span>
                                </label>
                                <input
                                    id="sf-ap-code"
                                    type="text"
                                    className="ui-input"
                                    value={form.code}
                                    onChange={setField('code')}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-ap-contact">
                                    {t('ap.label.contact')}{' '}
                                    <span className="ui-field-opt">{t('ap.optional')}</span>
                                </label>
                                <input
                                    id="sf-ap-contact"
                                    type="text"
                                    className="ui-input"
                                    value={form.contactPerson}
                                    onChange={setField('contactPerson')}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-ap-email">
                                    {t('ap.label.email')}{' '}
                                    <span className="ui-field-opt">{t('ap.optional')}</span>
                                </label>
                                <input
                                    id="sf-ap-email"
                                    type="email"
                                    className="ui-input"
                                    autoComplete="off"
                                    value={form.email}
                                    onChange={setField('email')}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sf-ap-mobile">
                                    {t('ap.label.mobile')}{' '}
                                    <span className="ui-field-opt">{t('ap.optional')}</span>
                                </label>
                                <input
                                    id="sf-ap-mobile"
                                    type="text"
                                    className="ui-input"
                                    value={form.mobile}
                                    onChange={setField('mobile')}
                                />
                            </div>
                        </div>

                        <div className="ui-form-foot">
                            <button
                                type="button"
                                className="ui-btn ui-btn--default"
                                disabled={saving}
                                onClick={closeModal}
                            >
                                {t('ap.btn.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
                                {saving ? (
                                    <><Loader size={14} className="ui-spin" /> {t('ap.btn.saving')}</>
                                ) : t('ap.btn.save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
