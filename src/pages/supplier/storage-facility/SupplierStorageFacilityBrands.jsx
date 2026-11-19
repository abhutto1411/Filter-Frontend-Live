import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Boxes, ChevronRight, Loader, Plus, RotateCcw, Search } from 'lucide-react';
import Modal from '../../../components/Modal';
import UiPager from '../../../components/UiPager';
import { usePagedRows } from '../../../hooks/usePagedRows';
import {
    useStorageFacilityApi,
    useStorageFacilityPortal,
} from './StorageFacilityPortalContext';
import { sfT } from '../../../utils/storageFacilityI18n';
import SupplierRiyalAmount from '../SupplierRiyalAmount';
import '../../../styles/ui.css';

const EMPTY_BRAND_FORM = {
    name: '',
    code: '',
    contactPerson: '',
    email: '',
    mobile: '',
};

export default function SupplierStorageFacilityBrands({ locale: localeProp } = {}) {
    const navigate = useNavigate();
    const outletCtx = useOutletContext() || {};
    const locale =
        localeProp ||
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => sfT(locale, key, vars), [locale]);

    const { routeBase, parentRoute, isOwner } = useStorageFacilityPortal();
    const sfApi = useStorageFacilityApi();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [q, setQ] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_BRAND_FORM);
    const [saving, setSaving] = useState(false);
    // Bumped by Retry and after a create, so the list reloads without the
    // fetch having to depend on `t` — which changed on every language switch.
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await sfApi.listStorageBrands();
                if (cancelled) return;
                setRows(Array.isArray(res?.brands) ? res.brands : []);
                setLoadError(false);
            } catch {
                if (cancelled) return;
                setRows([]);
                setLoadError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [sfApi, reloadKey]);

    useEffect(() => {
        if (!isOwner && rows.length === 1) {
            navigate(`${routeBase}?brand=${rows[0].id}`, { replace: true });
        }
    }, [isOwner, rows, navigate, routeBase]);

    const needle = q.trim().toLowerCase();
    const filtered = needle
        ? rows.filter((b) => String(b.name || '').toLowerCase().includes(needle))
        : rows;
    // Every brand is already in memory — the endpoint returns the supplier's
    // full set, one row per lessee — so the pager slices rather than refetches.
    const paging = usePagedRows(filtered, { resetKey: needle });

    const openBrand = (id) => {
        navigate(`${routeBase}?brand=${encodeURIComponent(id)}`);
    };

    const closeModal = () => {
        if (saving) return;
        setModalOpen(false);
        setForm(EMPTY_BRAND_FORM);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            await sfApi.createStorageBrand(form);
            setModalOpen(false);
            setForm(EMPTY_BRAND_FORM);
            setReloadKey((k) => k + 1);
        } catch (ex) {
            window.alert(ex?.message || t('brands.errCreate'));
        } finally {
            setSaving(false);
        }
    };

    const setField = (field) => (e) => {
        const { value } = e.target;
        setForm((f) => ({ ...f, [field]: value }));
    };

    return (
        <div className="ui-root ui-root--flush ui-stack">
            {parentRoute ? (
                <div>
                    <button
                        type="button"
                        className="ui-btn ui-btn--subtle ui-btn--sm"
                        onClick={() => navigate(parentRoute)}
                    >
                        <ArrowLeft size={14} /> {t('brands.backSuppliers')}
                    </button>
                </div>
            ) : null}

            <p className="ui-lead">{t('brands.subtitle')}</p>
            <p className="ui-banner" data-storage-not-warehouse="1">
                {t('brands.notWarehouse')}
            </p>

            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <div className="ui-search">
                        <Search size={14} />
                        <input
                            type="text"
                            className="ui-input"
                            placeholder={t('brands.search')}
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                    <span>
                        {needle
                            ? t('brands.matches', { n: filtered.length })
                            : t('brands.count', { n: rows.length })}
                    </span>
                    {isOwner ? (
                        <div className="ui-toolbar-end">
                            <button
                                type="button"
                                className="ui-btn ui-btn--primary ui-btn--sm"
                                onClick={() => setModalOpen(true)}
                            >
                                <Plus size={14} /> {t('brands.add')}
                            </button>
                        </div>
                    ) : null}
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('brands.errLoad')}</div>
                        <div className="ui-empty-sub">{t('brands.errSub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('brands.retry')}
                        </button>
                    </div>
                ) : !loading && filtered.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon">
                            {needle ? <Search size={18} /> : <Boxes size={18} />}
                        </div>
                        <div className="ui-empty-title">
                            {needle ? t('brands.noMatchTitle') : t('brands.emptyTitle')}
                        </div>
                        <div className="ui-empty-sub">
                            {needle ? t('brands.noMatchSub') : t('brands.emptySub')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table ui-table--pick">
                        <thead>
                            <tr>
                                <th>{t('brands.th.brand')}</th>
                                <th className="ui-num">{t('brands.th.products')}</th>
                                <th className="ui-num">{t('brands.th.qty')}</th>
                                <th className="ui-num">{t('brands.th.ar')}</th>
                                <th className="ui-num">{t('brands.th.users')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w25" /></td>
                                    </tr>
                                ))
                            ) : paging.pagedRows.map((b) => (
                                <tr key={b.id} onClick={() => openBrand(b.id)}>
                                    <td data-label={t('brands.th.brand')}>
                                        {/* The name carries the action, so a keyboard
                                            reaches every row the pointer can. */}
                                        <button
                                            type="button"
                                            className="ui-link"
                                            onClick={(e) => { e.stopPropagation(); openBrand(b.id); }}
                                        >
                                            {b.name}
                                            <ChevronRight size={14} className="ui-chev" aria-hidden="true" />
                                        </button>
                                        {b.code ? <div className="ui-meta">{b.code}</div> : null}
                                    </td>
                                    <td data-label={t('brands.th.products')} className="ui-num">
                                        {b.productCount}
                                    </td>
                                    <td data-label={t('brands.th.qty')} className="ui-num">
                                        {b.totalQty}
                                    </td>
                                    <td data-label={t('brands.th.ar')} className="ui-num">
                                        <SupplierRiyalAmount amount={b.arBalance} size={14} />
                                    </td>
                                    <td data-label={t('brands.th.users')} className="ui-num">
                                        {b.userCount}
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
                    title={t('brands.modal.title')}
                    onClose={closeModal}
                    disableClose={saving}
                    // The modal is portalled to <body>, outside this page's
                    // `.ui-root`, so it has to carry the tokens itself.
                    contentClassName="ui-tokens"
                >
                    {/* `.ui-form-foot` carries its own top spacing, so the form
                        needs no gap of its own between grid and actions. */}
                    <form onSubmit={handleCreate}>
                        <div className="ui-form-grid">
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sfb-name">{t('brands.label.name')}</label>
                                <input
                                    id="sfb-name"
                                    type="text"
                                    className="ui-input"
                                    value={form.name}
                                    onChange={setField('name')}
                                    placeholder={t('brands.ph.name')}
                                    required
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sfb-code">{t('brands.label.code')}</label>
                                <input
                                    id="sfb-code"
                                    type="text"
                                    className="ui-input"
                                    value={form.code}
                                    onChange={setField('code')}
                                />
                            </div>
                            <div className="ui-field ui-col-12">
                                <label htmlFor="sfb-contact">{t('brands.label.contact')}</label>
                                <input
                                    id="sfb-contact"
                                    type="text"
                                    className="ui-input"
                                    value={form.contactPerson}
                                    onChange={setField('contactPerson')}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sfb-email">{t('brands.label.email')}</label>
                                <input
                                    id="sfb-email"
                                    type="email"
                                    className="ui-input"
                                    autoComplete="off"
                                    value={form.email}
                                    onChange={setField('email')}
                                />
                            </div>
                            <div className="ui-field ui-col-6">
                                <label htmlFor="sfb-mobile">{t('brands.label.mobile')}</label>
                                <input
                                    id="sfb-mobile"
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
                                onClick={closeModal}
                                disabled={saving}
                            >
                                {t('brands.btn.cancel')}
                            </button>
                            <button type="submit" className="ui-btn ui-btn--primary" disabled={saving}>
                                {saving ? (
                                    <><Loader size={14} className="ui-spin" /> {t('brands.btn.saving')}</>
                                ) : t('brands.btn.create')}
                            </button>
                        </div>
                    </form>
                </Modal>
            ) : null}
        </div>
    );
}
