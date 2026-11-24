import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Loader, Truck, AlertTriangle, RotateCcw, Search } from 'lucide-react';
import SuppliersPageShell from '../../components/admin/SuppliersPageShell';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import '../../styles/admin/SuppliersPage.css';
import '../../styles/admin/ApprovalsPage.css';
import '../../styles/ui.css';
import { getSuppliers, getSupplier, createSupplier, updateSupplier } from '../../services/superAdminApi';
import { parseSuppliersRoute, suppliersRoutes, SUPPLIERS_BASE } from '../../utils/suppliersRoutes';
import { supT } from '../../utils/suppliersI18n';

const EMPTY_SUPPLIER_FORM = {
    name: '',
    category: 'supplier',
    vatId: '',
    crNumber: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    bankName: '',
    bankIban: '',
    street: '',
    cityDistrict: '',
    status: 'active',
    password: '',
};

function normalizeCategory(value) {
    const v = String(value ?? '').trim().toLowerCase();
    if (v === 'supplier') return 'supplier';
    if (v === 'warehouse') return 'warehouse';
    if (v === 'other') return 'other';
    if (v === 'parts' || v === 'lubricants' || v === 'tires' || v === 'equipment') return 'supplier';
    return 'supplier';
}

function normalizeSupplier(s) {
    return {
        id: String(s.id ?? s._id ?? ''),
        name: s.name ?? '—',
        category: normalizeCategory(s.registrationType ?? s.category ?? 'supplier'),
        vatId: s.vatId ?? s.taxId ?? '',
        crNumber: s.tradeLicenseNo ?? s.crNumber ?? '',
        contactPerson: s.contactPerson ?? s.ownerName ?? '',
        phone: s.mobile ?? s.phone ?? '',
        email: s.email ?? '',
        address: s.address ?? '',
        bankName: s.bankName ?? '',
        bankIban: s.iban ?? s.bankIban ?? '',
        street: s.street ?? '',
        cityDistrict: s.cityDistrict ?? '',
        status: s.status ?? (s.isActive === false ? 'inactive' : 'active'),
        password: '',
    };
}

function categoryLabel(t, cat) {
    return t(`cat.${normalizeCategory(cat)}`);
}

/** A warehouse is the one category that changes how stock is routed, so it is
 *  the only one the badge singles out. */
function categoryPillTone(cat) {
    return normalizeCategory(cat) === 'warehouse' ? 'info' : 'neutral';
}

function SupplierFormFields({ values, onFieldChange, isEdit = false, t }) {
    const set = (field) => (e) => onFieldChange(field, e.target.value);

    return (
        <>
            <section className="ui-section">
                <h2>{t('section.company')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="sup-name">{t('label.name')}</label>
                        <input
                            id="sup-name"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.name')}
                            value={values.name}
                            onChange={set('name')}
                        />
                    </div>
                    <div className="ui-field ui-col-3">
                        <label htmlFor="sup-category">{t('label.category')}</label>
                        <select
                            id="sup-category"
                            className="ui-select"
                            value={values.category}
                            onChange={set('category')}
                        >
                            <option value="supplier">{t('cat.supplier')}</option>
                            <option value="warehouse">{t('cat.warehouse')}</option>
                            <option value="other">{t('cat.other')}</option>
                        </select>
                    </div>
                    <div className="ui-field ui-col-3">
                        <label htmlFor="sup-status">{t('label.status')}</label>
                        <select
                            id="sup-status"
                            className="ui-select"
                            value={values.status}
                            onChange={set('status')}
                        >
                            <option value="active">{t('status.active')}</option>
                            <option value="inactive">{t('status.inactive')}</option>
                        </select>
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="sup-vat">{t('label.vat')}</label>
                        <input
                            id="sup-vat"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.vat')}
                            value={values.vatId}
                            onChange={set('vatId')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="sup-cr">{t('label.cr')}</label>
                        <input
                            id="sup-cr"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.cr')}
                            value={values.crNumber}
                            onChange={set('crNumber')}
                        />
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.contact')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-4">
                        <label htmlFor="sup-contact">{t('label.contact')}</label>
                        <input
                            id="sup-contact"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.contact')}
                            value={values.contactPerson}
                            onChange={set('contactPerson')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="sup-phone">{t('label.phone')}</label>
                        <input
                            id="sup-phone"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.phone')}
                            value={values.phone}
                            onChange={set('phone')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="sup-email">{t('label.email')}</label>
                        <input
                            id="sup-email"
                            type="email"
                            className="ui-input"
                            placeholder={t('ph.email')}
                            autoComplete="off"
                            value={values.email}
                            onChange={set('email')}
                        />
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.address')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-4">
                        <label htmlFor="sup-street">{t('label.street')}</label>
                        <input
                            id="sup-street"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.street')}
                            value={values.street || ''}
                            onChange={set('street')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="sup-city">{t('label.city')}</label>
                        <input
                            id="sup-city"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.city')}
                            value={values.cityDistrict || ''}
                            onChange={set('cityDistrict')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="sup-address">{t('label.address')}</label>
                        <input
                            id="sup-address"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.address')}
                            value={values.address}
                            onChange={set('address')}
                        />
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.portal')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="sup-password">
                            {isEdit ? t('label.newPassword') : t('label.password')}
                        </label>
                        <input
                            id="sup-password"
                            type="password"
                            className="ui-input"
                            placeholder={isEdit ? t('ph.passwordKeep') : t('ph.password')}
                            autoComplete="new-password"
                            value={values.password || ''}
                            onChange={set('password')}
                        />
                        <p className="ui-help">{t('help.password')}</p>
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.bank')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="sup-bank">{t('label.bankName')}</label>
                        <input
                            id="sup-bank"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.bank')}
                            value={values.bankName}
                            onChange={set('bankName')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="sup-iban">{t('label.iban')}</label>
                        <input
                            id="sup-iban"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.iban')}
                            value={values.bankIban}
                            onChange={set('bankIban')}
                        />
                    </div>
                </div>
            </section>
        </>
    );
}

export default function SuppliersPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => supT(locale, key, vars), [locale]);

    const route = parseSuppliersRoute(location.pathname);
    const pageMode = Boolean(route);

    const goBack = useCallback(() => {
        navigate(SUPPLIERS_BASE);
    }, [navigate]);

    const [suppliers, setSuppliers] = useState([]);
    const [suppliersTotal, setSuppliersTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [search, setSearch] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const [saving, setSaving] = useState(false);
    const [editFormLoading, setEditFormLoading] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
    // Bumped after a create or an edit, so the list refetches the page the admin
    // is actually looking at instead of being sent back to the first one.
    const [reloadKey, setReloadKey] = useState(0);

    const paging = useServerPaging({ resetKey: searchDebounced });
    const { page, pageSize } = paging;

    useEffect(() => {
        const timer = setTimeout(() => setSearchDebounced(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        // Search runs server-side: the API caps `limit` at 200, so a client-side
        // filter would only ever see the page already on screen.
        getSuppliers({
            limit: pageSize,
            offset: (page - 1) * pageSize,
            search: searchDebounced || undefined,
        })
            .then((res) => {
                if (cancelled) return;
                const data = res?.data || res;
                const rows = Array.isArray(data) ? data : (data?.suppliers ?? []);
                setSuppliers(rows.map(normalizeSupplier));
                setSuppliersTotal(Number(data?.total ?? rows.length) || 0);
                setLoadError(false);
            })
            .catch(() => {
                if (cancelled) return;
                setSuppliers([]);
                setSuppliersTotal(0);
                setLoadError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [page, pageSize, searchDebounced, reloadKey]);

    useEffect(() => {
        if (route?.screen === 'create') {
            setSupplierForm(EMPTY_SUPPLIER_FORM);
        }
    }, [route?.screen]);

    useEffect(() => {
        if (route?.screen !== 'edit' || !route.id) return undefined;
        const id = route.id;

        // Clicking Edit in the list hands the row over, so the fields are filled
        // in while the authoritative record loads behind them.
        const seed = location.state?.supplier;
        if (seed && String(seed.id) === id) setEditingSupplier(normalizeSupplier(seed));

        let cancelled = false;
        setEditFormLoading(true);
        getSupplier(id)
            .then((detail) => {
                if (cancelled) return;
                const payload = detail?.data && typeof detail.data === 'object' ? detail.data : detail;
                setEditingSupplier(normalizeSupplier(payload));
            })
            .catch(() => {
                // Keep the seeded row if there was one; with nothing seeded the
                // screen falls through to its not-found state.
            })
            .finally(() => {
                if (!cancelled) setEditFormLoading(false);
            });

        return () => { cancelled = true; };
    }, [route?.screen, route?.id, location.state]);

    const handleSupplierFormField = (field, value) => {
        setSupplierForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleEditingField = (field, value) => {
        setEditingSupplier((prev) => (prev ? { ...prev, [field]: value } : prev));
    };

    const buildSupplierPayload = (form) => ({
        name: form.name,
        registrationType: normalizeCategory(form.category) || undefined,
        category: normalizeCategory(form.category) || undefined,
        vatId: form.vatId || undefined,
        tradeLicenseNo: form.crNumber || undefined,
        contactPerson: form.contactPerson || undefined,
        mobile: form.phone || undefined,
        email: form.email,
        address: form.address,
        bankName: form.bankName || undefined,
        iban: form.bankIban || undefined,
        street: form.street || undefined,
        cityDistrict: form.cityDistrict || undefined,
        isActive: form.status === 'active',
        password: String(form.password || '').trim() || undefined,
    });

    const handleSaveNew = async () => {
        if (!String(supplierForm.password || '').trim()) {
            alert(t('err.password'));
            return;
        }
        if (!String(supplierForm.name || '').trim()) {
            alert(t('err.name'));
            return;
        }
        setSaving(true);
        try {
            await createSupplier(buildSupplierPayload(supplierForm));
            setReloadKey((k) => k + 1);
            goBack();
            setSupplierForm(EMPTY_SUPPLIER_FORM);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!editingSupplier) return;
        if (!String(editingSupplier.name || '').trim()) {
            alert(t('err.name'));
            return;
        }
        setSaving(true);
        try {
            await updateSupplier(editingSupplier.id, buildSupplierPayload(editingSupplier));
            setReloadKey((k) => k + 1);
            goBack();
            setEditingSupplier(null);
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (s) => {
        navigate(suppliersRoutes.edit(s.id), { state: { supplier: s } });
    };

    const closeEdit = () => {
        goBack();
        setEditingSupplier(null);
        setEditFormLoading(false);
    };

    const formFooter = (onCancel, onSave, saveLabel, disabled) => (
        <>
            <button type="button" className="ui-btn ui-btn--default" onClick={onCancel} disabled={saving}>
                {t('btn.cancel')}
            </button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={onSave} disabled={disabled}>
                {saving ? <><Loader size={14} className="ui-spin" /> {t('btn.saving')}</> : saveLabel}
            </button>
        </>
    );

    if (pageMode) {
        return (
            <>
                {route?.screen === 'create' && (
                    <SuppliersPageShell
                        title={t('create.title')}
                        onClose={goBack}
                        backDisabled={saving}
                        footer={formFooter(goBack, handleSaveNew, t('btn.create'), saving)}
                    >
                        <p className="ui-lead">{t('create.lead')}</p>
                        <SupplierFormFields
                            values={supplierForm}
                            onFieldChange={handleSupplierFormField}
                            t={t}
                        />
                    </SuppliersPageShell>
                )}

                {route?.screen === 'edit' && (
                    <SuppliersPageShell
                        title={t('edit.title')}
                        onClose={closeEdit}
                        backDisabled={saving}
                        footer={formFooter(closeEdit, handleSaveEdit, t('btn.save'), saving || editFormLoading || !editingSupplier)}
                    >
                        {editingSupplier ? (
                            <>
                                <p className="ui-lead">{t('edit.lead')}</p>
                                <SupplierFormFields
                                    values={editingSupplier}
                                    onFieldChange={handleEditingField}
                                    isEdit
                                    t={t}
                                />
                            </>
                        ) : editFormLoading ? (
                            <div className="ui-form-grid" aria-label={t('loading.supplier')} aria-busy="true">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={`sk-${i}`} className="ui-field ui-col-4 ui-sk-row">
                                        <div className="ui-sk ui-sk--label ui-sk--w40" />
                                        <div className="ui-sk ui-sk--input" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="ui-empty">
                                <div className="ui-empty-icon"><Truck size={18} /></div>
                                <div className="ui-empty-title">{t('notFound')}</div>
                            </div>
                        )}
                    </SuppliersPageShell>
                )}
            </>
        );
    }

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-table-wrap">
                <div className="ui-toolbar">
                    <div className="ui-search">
                        <Search size={14} />
                        <input
                            type="text"
                            className="ui-input"
                            placeholder={t('search.placeholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <span>
                        {searchDebounced
                            ? t('page.matches', { n: suppliersTotal })
                            : t('page.count', { n: suppliersTotal })}
                    </span>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => navigate(suppliersRoutes.create())}
                        >
                            <Plus size={14} /> {t('btn.add')}
                        </button>
                    </div>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('error.title')}</div>
                        <div className="ui-empty-sub">{t('error.sub')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('btn.retry')}
                        </button>
                    </div>
                ) : !loading && suppliers.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon">
                            {searchDebounced ? <Search size={18} /> : <Truck size={18} />}
                        </div>
                        <div className="ui-empty-title">
                            {searchDebounced ? t('empty.searchTitle') : t('empty.title')}
                        </div>
                        <div className="ui-empty-sub">
                            {searchDebounced ? t('empty.search') : t('empty.sub')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('th.supplier')}</th>
                                <th>{t('th.category')}</th>
                                <th>{t('th.phone')}</th>
                                <th>{t('th.vat')}</th>
                                <th>{t('th.cr')}</th>
                                <th>{t('th.status')}</th>
                                <th aria-label={t('th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                // One skeleton row per row the page is about to show, so the
                                // table does not collapse to a single line and jump back.
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--btn" /></td>
                                    </tr>
                                ))
                            ) : suppliers.map((s) => (
                                <tr key={s.id}>
                                    <td data-label={t('th.supplier')}>
                                        <div className="ui-strong">{s.name}</div>
                                        {s.contactPerson ? <div className="ui-meta">{s.contactPerson}</div> : null}
                                    </td>
                                    <td data-label={t('th.category')}>
                                        <span className={`ui-pill ui-pill--${categoryPillTone(s.category)}`}>
                                            {categoryLabel(t, s.category)}
                                        </span>
                                    </td>
                                    <td data-label={t('th.phone')} className="ui-mono ui-nowrap">
                                        {s.phone || '—'}
                                    </td>
                                    <td data-label={t('th.vat')} className="ui-mono">{s.vatId || '—'}</td>
                                    <td data-label={t('th.cr')} className="ui-mono">{s.crNumber || '—'}</td>
                                    <td data-label={t('th.status')}>
                                        <span className={`ui-pill ui-pill--${s.status === 'active' ? 'ok' : 'neutral'}`}>
                                            {s.status === 'active' ? t('status.active') : t('status.inactive')}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="ui-btn ui-btn--default ui-btn--sm"
                                            onClick={() => openEdit(s)}
                                        >
                                            <Pencil size={13} /> {t('btn.edit')}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerFor(suppliersTotal)} />
            </div>
        </div>
    );
}
