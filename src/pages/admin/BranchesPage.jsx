import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import {
    AlertTriangle,
    Building2,
    GitBranch,
    Loader,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Plus,
    RotateCcw,
    Search,
    UserCheck,
} from 'lucide-react';
import BranchesPageShell from '../../components/admin/BranchesPageShell';
import MultiSelectSearchCombo from '../../components/MultiSelectSearchCombo';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import '../../styles/admin/BranchesPage.css';
import '../../styles/admin/ApprovalsPage.css';
import '../../styles/ui.css';
import {
    getBranches,
    getBranch,
    createBranch,
    updateBranch,
    getWorkshopOptions,
} from '../../services/superAdminApi';
import { parseBranchesRoute, branchesRoutes, BRANCHES_BASE } from '../../utils/branchesRoutes';
import { brT, BR_STATUS_TAB_KEYS } from '../../utils/branchesI18n';

const EMPTY_BRANCH = {
    name: '',
    branchCode: '',
    address: '',
    gpsLat: '',
    gpsLng: '',
    contactPerson: '',
    phone: '',
    email: '',
    vatId: '',
    crNumber: '',
    egsSerial: '',
    status: 'active',
    mainWorkshopId: '',
    workshopIds: [],
};

function normalizeWorkshop(w) {
    return {
        id: String(w?.id ?? w?.value ?? ''),
        name: w?.name ?? w?.label ?? `Workshop ${w?.id ?? ''}`,
        status: String(w?.status ?? '').toLowerCase(),
    };
}

function normalizeBranch(b) {
    return {
        id: String(b?.id ?? b?._id ?? ''),
        name: b?.name ?? '—',
        branchCode: b?.branchCode ?? b?.code ?? '',
        address: b?.address ?? '',
        gpsLat: b?.gpsLat ?? '',
        gpsLng: b?.gpsLng ?? '',
        contactPerson: b?.contactPerson ?? '',
        phone: b?.phone ?? '',
        email: b?.email ?? '',
        vatId: b?.vatId ?? '',
        crNumber: b?.crNumber ?? b?.crNo ?? '',
        egsSerial: b?.egsSerial ?? b?.egs_serial ?? '',
        isActive: b?.isActive !== false,
        status: b?.status ?? (b?.isActive === false ? 'inactive' : 'active'),
        mainWorkshopId: String(b?.mainWorkshopId ?? b?.workshopId ?? ''),
        mainWorkshopName: b?.mainWorkshopName ?? b?.workshopName ?? b?.workshops?.[0]?.name ?? '',
        workshopIds: Array.isArray(b?.workshopIds)
            ? b.workshopIds.map((x) => String(x))
            : b?.workshopId != null
              ? [String(b.workshopId)]
              : [],
        workshops: Array.isArray(b?.workshops)
            ? b.workshops.map((w) => ({ id: String(w?.id ?? ''), name: w?.name ?? '' }))
            : [],
    };
}

function branchToForm(b) {
    return {
        name: b.name === '—' ? '' : b.name,
        branchCode: b.branchCode || '',
        address: b.address || '',
        gpsLat: b.gpsLat || '',
        gpsLng: b.gpsLng || '',
        contactPerson: b.contactPerson || '',
        phone: b.phone || '',
        email: b.email || '',
        vatId: b.vatId || '',
        crNumber: b.crNumber || '',
        egsSerial: b.egsSerial || '',
        status: b.isActive === false ? 'inactive' : 'active',
        mainWorkshopId: b.mainWorkshopId || '',
        workshopIds: Array.isArray(b.workshopIds) ? [...b.workshopIds] : [],
    };
}

function BranchFormFields({ values, onChange, workshopOptions, t }) {
    const set = (field) => (e) => onChange(field, e.target.value);
    // The shared combo takes {id, label}; the workshop list is {id, name}.
    const comboOptions = useMemo(
        () => workshopOptions.map((w) => ({ id: w.id, label: w.name })),
        [workshopOptions],
    );

    return (
        <>
            <section className="ui-section">
                <h2>{t('section.details')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="br-name">{t('label.name')}</label>
                        <input
                            id="br-name"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.name')}
                            value={values.name}
                            onChange={set('name')}
                        />
                    </div>
                    <div className="ui-field ui-col-3">
                        <label htmlFor="br-code">
                            {t('label.code')}{' '}
                            <span className="ui-field-opt">{t('optional')}</span>
                        </label>
                        <input
                            id="br-code"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.code')}
                            value={values.branchCode}
                            onChange={set('branchCode')}
                        />
                    </div>
                    <div className="ui-field ui-col-3">
                        <label htmlFor="br-status">{t('label.status')}</label>
                        <select
                            id="br-status"
                            className="ui-select"
                            value={values.status}
                            onChange={set('status')}
                        >
                            <option value="active">{t('status.active')}</option>
                            <option value="inactive">{t('status.inactive')}</option>
                        </select>
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.workshop')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="br-main-workshop">{t('label.mainWorkshop')}</label>
                        <select
                            id="br-main-workshop"
                            className="ui-select"
                            value={values.mainWorkshopId}
                            onChange={set('mainWorkshopId')}
                        >
                            <option value="">{t('opt.selectWorkshop')}</option>
                            {workshopOptions.map((w) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                        <p className="ui-help">{t('hint.mainWorkshop')}</p>
                    </div>
                    <div className="ui-field ui-col-6">
                        <label>{t('label.linked')}</label>
                        <MultiSelectSearchCombo
                            options={comboOptions}
                            value={values.workshopIds}
                            onChange={(next) => onChange('workshopIds', next)}
                            placeholder={t('search.placeholder')}
                            emptyHint={t('empty.title')}
                            clearLabel={t('btn.clear')}
                            menuMinWidth={360}
                        />
                        <p className="ui-help">{t('hint.linked')}</p>
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.location')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-12">
                        <label htmlFor="br-address">{t('label.address')}</label>
                        <input
                            id="br-address"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.address')}
                            value={values.address}
                            onChange={set('address')}
                        />
                        <p className="ui-help">{t('hint.address')}</p>
                    </div>
                    <div className="ui-field ui-col-3">
                        <label htmlFor="br-lat">
                            {t('label.lat')}{' '}
                            <span className="ui-field-opt">{t('optional')}</span>
                        </label>
                        <input
                            id="br-lat"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.lat')}
                            value={values.gpsLat}
                            onChange={set('gpsLat')}
                        />
                    </div>
                    <div className="ui-field ui-col-3">
                        <label htmlFor="br-lng">
                            {t('label.lng')}{' '}
                            <span className="ui-field-opt">{t('optional')}</span>
                        </label>
                        <input
                            id="br-lng"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.lng')}
                            value={values.gpsLng}
                            onChange={set('gpsLng')}
                        />
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.contact')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-4">
                        <label htmlFor="br-contact">{t('label.contact')}</label>
                        <input
                            id="br-contact"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.contact')}
                            value={values.contactPerson}
                            onChange={set('contactPerson')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="br-phone">{t('label.phone')}</label>
                        <input
                            id="br-phone"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.phone')}
                            value={values.phone}
                            onChange={set('phone')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="br-email">{t('label.email')}</label>
                        <input
                            id="br-email"
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
                <h2>{t('section.zatca')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="br-vat">{t('label.vat')}</label>
                        <input
                            id="br-vat"
                            type="text"
                            className="ui-input ui-mono"
                            placeholder={t('ph.vat')}
                            value={values.vatId}
                            onChange={set('vatId')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="br-cr">{t('label.cr')}</label>
                        <input
                            id="br-cr"
                            type="text"
                            className="ui-input ui-mono"
                            placeholder={t('ph.cr')}
                            value={values.crNumber}
                            onChange={set('crNumber')}
                        />
                    </div>
                    <div className="ui-field ui-col-12">
                        <label htmlFor="br-egs">{t('label.egs')}</label>
                        <input
                            id="br-egs"
                            type="text"
                            className="ui-input ui-mono"
                            placeholder={t('ph.egs')}
                            value={values.egsSerial}
                            onChange={set('egsSerial')}
                        />
                        <p className="ui-help">{t('hint.egs')}</p>
                    </div>
                </div>
            </section>
        </>
    );
}

function buildBranchPayload(form) {
    const workshopIds = Array.isArray(form.workshopIds)
        ? form.workshopIds.filter(Boolean).map(String)
        : [];
    const mainWorkshopId = String(form.mainWorkshopId || workshopIds[0] || '');
    const mergedWorkshopIds = Array.from(new Set([mainWorkshopId, ...workshopIds].filter(Boolean)));

    return {
        workshopId: mainWorkshopId,
        workshopIds: mergedWorkshopIds,
        name: String(form.name || '').trim(),
        branchCode: String(form.branchCode || '').trim() || undefined,
        address: String(form.address || '').trim() || undefined,
        gpsLat: form.gpsLat || undefined,
        gpsLng: form.gpsLng || undefined,
        contactPerson: String(form.contactPerson || '').trim() || undefined,
        phone: String(form.phone || '').trim() || undefined,
        email: String(form.email || '').trim() || undefined,
        vatId: String(form.vatId || '').trim() || undefined,
        crNumber: String(form.crNumber || '').trim() || undefined,
        egsSerial: String(form.egsSerial || '').trim() || undefined,
        isActive: form.status === 'active',
    };
}

export default function BranchesPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => brT(locale, key, vars), [locale]);

    const route = parseBranchesRoute(location.pathname);
    const pageMode = Boolean(route);

    const [workshops, setWorkshops] = useState([]);
    const [branches, setBranches] = useState([]);
    const [branchesTotal, setBranchesTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_BRANCH);
    const [editLoading, setEditLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [workshopFilter, setWorkshopFilter] = useState('');
    // Counts for the stat cards, asked for as counts rather than read off a
    // fetched page — which only ever held the first 200 rows.
    const [counts, setCounts] = useState({ all: 0, active: 0 });
    const [reloadKey, setReloadKey] = useState(0);

    const paging = useServerPaging({
        resetKey: `${statusFilter}|${workshopFilter}|${searchDebounced}`,
    });
    const { page, pageSize } = paging;

    const goBack = useCallback(() => navigate(BRANCHES_BASE), [navigate]);

    useEffect(() => {
        const timer = setTimeout(() => setSearchDebounced(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const onFormField = useCallback((field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    }, []);

    const workshopDropdownOptions = useMemo(
        () => workshops.filter((w) => w.status === 'approved' || !w.status),
        [workshops],
    );

    useEffect(() => {
        if (pageMode) return undefined;
        let cancelled = false;
        setLoading(true);
        // Search and the status filter run server-side. They used to filter a
        // 9999-row request in the browser, and the API caps that at 200 — so
        // branch 201 onward could not be found at all.
        getBranches({
            workshopId: workshopFilter || undefined,
            status: statusFilter === 'all' ? undefined : statusFilter,
            search: searchDebounced || undefined,
            limit: pageSize,
            offset: (page - 1) * pageSize,
        })
            .then((res) => {
                if (cancelled) return;
                const data = res?.data || res;
                const rows = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
                setBranches(rows.map(normalizeBranch));
                setBranchesTotal(Number(data?.total ?? rows.length) || 0);
                setLoadError(false);
            })
            .catch(() => {
                if (cancelled) return;
                setBranches([]);
                setBranchesTotal(0);
                setLoadError(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [pageMode, workshopFilter, statusFilter, searchDebounced, page, pageSize, reloadKey]);

    useEffect(() => {
        if (pageMode) return undefined;
        let cancelled = false;
        const scope = { workshopId: workshopFilter || undefined, limit: 1 };
        const totalOf = (res) => Number((res?.data || res)?.total ?? 0);
        Promise.all([getBranches(scope), getBranches({ ...scope, status: 'active' })])
            .then(([allRes, activeRes]) => {
                if (cancelled) return;
                setCounts({ all: totalOf(allRes), active: totalOf(activeRes) });
            })
            .catch(() => {
                if (!cancelled) setCounts({ all: 0, active: 0 });
            });
        return () => { cancelled = true; };
    }, [pageMode, workshopFilter, reloadKey]);

    useEffect(() => {
        getWorkshopOptions()
            .then((workshopData) => {
                const workshopRows = Array.isArray(workshopData)
                    ? workshopData
                    : (workshopData?.options ?? workshopData?.workshops ?? workshopData?.data ?? []);
                setWorkshops(workshopRows.map(normalizeWorkshop).filter((w) => w.id));
            })
            .catch(() => setWorkshops([]));
    }, []);

    useEffect(() => {
        if (route?.screen !== 'create') return;
        setForm(EMPTY_BRANCH);
    }, [route?.screen]);

    useEffect(() => {
        if (route?.screen !== 'edit' || !route.id) return undefined;

        const fromNav = location.state?.branch;
        if (fromNav && String(fromNav.id) === String(route.id)) {
            setForm(branchToForm(normalizeBranch(fromNav)));
            return undefined;
        }

        let cancelled = false;
        setEditLoading(true);
        (async () => {
            try {
                const detail = await getBranch(route.id);
                const row = detail?.data && typeof detail.data === 'object' ? detail.data : detail;
                if (!cancelled) setForm(branchToForm(normalizeBranch(row)));
            } catch {
                if (!cancelled) setForm(EMPTY_BRANCH);
            } finally {
                if (!cancelled) setEditLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [route?.screen, route?.id, location.state]);

    const handleSaveCreate = async () => {
        const name = String(form.name || '').trim();
        if (!name) {
            window.alert(t('err.name'));
            return;
        }
        const mainWorkshopId = String(form.mainWorkshopId || form.workshopIds?.[0] || '');
        if (!mainWorkshopId) {
            window.alert(t('err.mainWorkshop'));
            return;
        }
        setSaving(true);
        try {
            await createBranch(buildBranchPayload(form));
            setReloadKey((k) => k + 1);
            goBack();
        } catch (err) {
            window.alert(err?.message || t('err.create'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!route?.id) return;
        setSaving(true);
        try {
            await updateBranch(route.id, buildBranchPayload(form));
            setReloadKey((k) => k + 1);
            goBack();
        } catch (err) {
            window.alert(err?.message || t('err.update'));
        } finally {
            setSaving(false);
        }
    };

    if (route?.screen === 'create') {
        return (
            <BranchesPageShell
                title={t('create.title')}
                onClose={goBack}
                backDisabled={saving}
                footer={
                    <>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={goBack}
                            disabled={saving}
                        >
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary"
                            onClick={handleSaveCreate}
                            disabled={saving}
                        >
                            {saving ? (
                                <><Loader size={14} className="ui-spin" /> {t('btn.creating')}</>
                            ) : t('btn.create')}
                        </button>
                    </>
                }
            >
                <p className="ui-lead">{t('create.lead')}</p>
                <BranchFormFields
                    values={form}
                    onChange={onFormField}
                    workshopOptions={workshopDropdownOptions}
                    t={t}
                />
            </BranchesPageShell>
        );
    }

    if (route?.screen === 'edit') {
        return (
            <BranchesPageShell
                title={t('edit.title')}
                onClose={goBack}
                backDisabled={saving}
                footer={
                    <>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            onClick={goBack}
                            disabled={saving}
                        >
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary"
                            onClick={handleSaveEdit}
                            disabled={saving || editLoading}
                        >
                            {saving ? (
                                <><Loader size={14} className="ui-spin" /> {t('btn.saving')}</>
                            ) : t('btn.save')}
                        </button>
                    </>
                }
            >
                {editLoading ? (
                    <div className="ui-form-grid" aria-label={t('loading')} aria-busy="true">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <div key={`sk-${i}`} className="ui-field ui-col-4 ui-sk-row">
                                <div className="ui-sk ui-sk--label ui-sk--w40" />
                                <div className="ui-sk ui-sk--input" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <p className="ui-lead">{t('edit.lead')}</p>
                        <BranchFormFields
                            values={form}
                            onChange={onFormField}
                            workshopOptions={workshopDropdownOptions}
                            t={t}
                        />
                    </>
                )}
            </BranchesPageShell>
        );
    }

    const filtering = Boolean(searchDebounced || workshopFilter || statusFilter !== 'all');

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-kpis">
                <div className="ui-metric">
                    <span className="ui-metric-icon"><GitBranch size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.total')}</div>
                    <div className="ui-metric-value">{counts.all}</div>
                </div>
                <div className="ui-metric ui-metric--ok">
                    <span className="ui-metric-icon"><UserCheck size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.active')}</div>
                    <div className="ui-metric-value">{counts.active}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Building2 size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.workshops')}</div>
                    <div className="ui-metric-value">{workshopDropdownOptions.length}</div>
                </div>
            </div>

            <div className="ui-table-wrap">
                <div className="ui-toolbar ui-toolbar--standalone">
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
                    <div className="ui-chips" role="tablist" aria-label={t('filter.statusAria')}>
                        {BR_STATUS_TAB_KEYS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={statusFilter === tab.id}
                                className={`ui-chip${statusFilter === tab.id ? ' ui-chip--on' : ''}`}
                                onClick={() => setStatusFilter(tab.id)}
                            >
                                {t(tab.labelKey)}
                            </button>
                        ))}
                    </div>
                    <div className="ui-toolbar-end">
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => navigate(branchesRoutes.create())}
                        >
                            <Plus size={14} /> {t('btn.add')}
                        </button>
                    </div>
                </div>

                <div className="ui-toolbar">
                    <select
                        className="ui-select"
                        aria-label={t('th.workshop')}
                        value={workshopFilter}
                        onChange={(e) => setWorkshopFilter(e.target.value)}
                    >
                        <option value="">{t('filter.allWorkshops')}</option>
                        {workshopDropdownOptions.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <span className="ui-toolbar-end ui-meta">
                        {searchDebounced
                            ? t('page.matches', { n: branchesTotal })
                            : t('page.count', { n: branchesTotal })}
                    </span>
                </div>

                {!loading && loadError ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon"><AlertTriangle size={18} /></div>
                        <div className="ui-empty-title">{t('err.loadTitle')}</div>
                        <div className="ui-empty-sub">{t('err.loadHint')}</div>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => setReloadKey((k) => k + 1)}
                        >
                            <RotateCcw size={13} /> {t('btn.retry')}
                        </button>
                    </div>
                ) : !loading && branches.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon">
                            {filtering ? <Search size={18} /> : <Building2 size={18} />}
                        </div>
                        <div className="ui-empty-title">
                            {filtering ? t('noMatch.title') : t('empty.title')}
                        </div>
                        <div className="ui-empty-sub">
                            {filtering ? t('noMatch.hint') : t('empty.hint')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table">
                        <thead>
                            <tr>
                                <th>{t('th.branch')}</th>
                                <th>{t('th.address')}</th>
                                <th>{t('th.workshop')}</th>
                                <th>{t('th.contact')}</th>
                                <th>{t('th.vatCr')}</th>
                                <th>{t('th.status')}</th>
                                <th aria-label={t('th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w90" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--btn" /></td>
                                    </tr>
                                ))
                            ) : branches.map((b) => (
                                <tr key={b.id}>
                                    <td data-label={t('th.branch')}>
                                        <div className="ui-strong">{b.name}</div>
                                        {b.branchCode ? (
                                            <div className="ui-meta">
                                                <span className="ui-meta-ref">{b.branchCode}</span>
                                            </div>
                                        ) : null}
                                    </td>
                                    <td data-label={t('th.address')}>
                                        {b.address ? (
                                            <span className="ui-row" title={b.address}>
                                                <MapPin size={13} className="ui-glyph" />
                                                {b.address}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td data-label={t('th.workshop')}>{b.mainWorkshopName || '—'}</td>
                                    <td data-label={t('th.contact')}>
                                        {b.phone ? (
                                            <div className="ui-row">
                                                <Phone size={13} className="ui-glyph" />
                                                <span className="ui-mono ui-nowrap">{b.phone}</span>
                                            </div>
                                        ) : null}
                                        {b.email ? (
                                            <div className="ui-row">
                                                <Mail size={13} className="ui-glyph" />
                                                <span>{b.email}</span>
                                            </div>
                                        ) : null}
                                        {!b.phone && !b.email ? '—' : null}
                                    </td>
                                    <td data-label={t('th.vatCr')}>
                                        {b.vatId ? (
                                            <div className="ui-meta">
                                                {t('vatShort', { id: b.vatId })}
                                            </div>
                                        ) : null}
                                        {b.crNumber ? (
                                            <div className="ui-meta">
                                                {t('crShort', { id: b.crNumber })}
                                            </div>
                                        ) : null}
                                        {!b.vatId && !b.crNumber ? '—' : null}
                                    </td>
                                    <td data-label={t('th.status')}>
                                        <span className={`ui-pill ui-pill--${b.isActive ? 'ok' : 'neutral'}`}>
                                            {b.isActive ? t('status.active') : t('status.inactive')}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="ui-rowacts">
                                            <button
                                                type="button"
                                                className="ui-btn ui-btn--default ui-btn--sm"
                                                onClick={() =>
                                                    navigate(branchesRoutes.edit(b.id), {
                                                        state: { branch: b },
                                                    })
                                                }
                                            >
                                                <Pencil size={13} /> {t('btn.edit')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerFor(branchesTotal)} />
            </div>
        </div>
    );
}
