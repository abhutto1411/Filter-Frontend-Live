import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import {
    AlertTriangle,
    Ban,
    Clock,
    Loader,
    Mail,
    MapPin,
    MessageSquare,
    Pencil,
    Phone,
    Plus,
    RotateCcw,
    Save,
    Search,
    UserCheck,
    Wrench,
} from 'lucide-react';
import WorkshopPageShell from '../../components/admin/WorkshopPageShell';
import UiPager from '../../components/UiPager';
import { useServerPaging } from '../../hooks/usePagedRows';
import '../../styles/admin/WorkshopManagementPage.css';
import '../../styles/ui.css';
import {
    getWorkshops,
    getWorkshop,
    createWorkshop,
    updateWorkshop,
    postSuperAdminWhatsappWorkshopCredentialsWaMeLink,
} from '../../services/superAdminApi';
import {
    STORAGE_KEY_TEMPLATE,
    DEFAULT_TEMPLATE,
    EMPTY_NEW_WORKSHOP,
    sessionKeyWorkshopOwnerPassword,
    sessionKeyWorkshopOwnerEmail,
    extractCreatedWorkshopId,
    formatPhoneForWhatsApp,
    normalizeWorkshopsPayload,
    resolveWorkshopPhone,
    workshopRowId,
    readRememberedWorkshopPassword,
    workshopWhatsAppDisabledReason,
    enrichWorkshopForWaMePlaceholder,
    buildClientSideWaMeUrlForWorkshop,
    isWaMeLinkApiUnavailableError,
    workshopRowToEditForm,
    buildUpdateWorkshopBody,
    workshopStatusMeta,
    unwrapWorkshopDetailResponse,
    resolveWorkshopContactEmail,
} from '../../utils/workshopManagementUtils';
import { parseWorkshopRoute, workshopRoutes, WORKSHOP_BASE } from '../../utils/workshopRoutes';
import { wsT, WS_STATUS_TAB_KEYS, workshopStatusI18nKey } from '../../utils/workshopI18n';

function WhatsAppIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}

function statusDisplayLabel(status, t) {
    const key = workshopStatusI18nKey(status);
    return key ? t(key) : workshopStatusMeta(status).label;
}

/**
 * The date part of an API timestamp. Cut rather than parsed: these arrive in
 * the business timezone already, and `new Date()` would shift them.
 */
function ymd(value) {
    return String(value || '').slice(0, 10) || '';
}

/** The pill tone for a stored workshop status. */
function statusTone(status) {
    const s = String(status ?? '').trim().toLowerCase();
    if (s === 'approved' || s === 'active') return 'ok';
    if (s === 'pending') return 'warn';
    if (s === 'rejected') return 'dang';
    return 'neutral';
}

function WorkshopCreateForm({ values, onChange, onDetectGps, isDetectingLocation, t }) {
    const set = (field) => (e) => onChange(field, e.target.value);

    return (
        <>
            <section className="ui-section">
                <h2>{t('section.details')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-name">{t('label.name')}</label>
                        <input
                            id="ws-name"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.name')}
                            value={values.name}
                            onChange={set('name')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-code">
                            {t('label.code')} <span className="ui-field-opt">{t('optional')}</span>
                        </label>
                        <input
                            id="ws-code"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.code')}
                            value={values.workshopCode}
                            onChange={set('workshopCode')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-branch">{t('label.branchName')}</label>
                        <input
                            id="ws-branch"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.branch')}
                            value={values.branchName}
                            onChange={set('branchName')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-industry">{t('label.industry')}</label>
                        <input
                            id="ws-industry"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.industry')}
                            value={values.industryType}
                            onChange={set('industryType')}
                        />
                        <p className="ui-help">{t('hint.industry')}</p>
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <div className="ui-section-head">
                    <h2>{t('section.defaultBranch')}</h2>
                    <button
                        type="button"
                        className="ui-btn ui-btn--default ui-btn--sm"
                        onClick={onDetectGps}
                        disabled={isDetectingLocation}
                    >
                        {isDetectingLocation ? (
                            <><Loader size={13} className="ui-spin" /> {t('btn.detecting')}</>
                        ) : (
                            <><MapPin size={13} /> {t('btn.detectGps')}</>
                        )}
                    </button>
                </div>
                <p className="ui-help">{t('hint.defaultBranch')}</p>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-4">
                        <label htmlFor="ws-vat">{t('label.vat')}</label>
                        <input
                            id="ws-vat"
                            type="text"
                            className="ui-input ui-mono"
                            placeholder={t('ph.vat')}
                            value={values.vatId}
                            onChange={set('vatId')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="ws-cr">{t('label.cr')}</label>
                        <input
                            id="ws-cr"
                            type="text"
                            className="ui-input ui-mono"
                            placeholder={t('ph.cr')}
                            value={values.crNumber}
                            onChange={set('crNumber')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="ws-egs">{t('label.egs')}</label>
                        <input
                            id="ws-egs"
                            type="text"
                            className="ui-input ui-mono"
                            placeholder={t('ph.egs')}
                            value={values.egsSerial}
                            onChange={set('egsSerial')}
                        />
                    </div>
                    <div className="ui-field ui-col-12">
                        <label htmlFor="ws-street">{t('label.street')}</label>
                        <input
                            id="ws-street"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.street')}
                            value={values.street}
                            onChange={set('street')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-city">{t('label.city')}</label>
                        <input
                            id="ws-city"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.city')}
                            value={values.city}
                            onChange={set('city')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-postal">{t('label.postal')}</label>
                        <input
                            id="ws-postal"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.postal')}
                            value={values.postalCode}
                            onChange={set('postalCode')}
                        />
                    </div>
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.owner')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-owner">{t('label.ownerName')}</label>
                        <input
                            id="ws-owner"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.fullName')}
                            value={values.contactName}
                            onChange={set('contactName')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-phone">{t('label.mobile')}</label>
                        <input
                            id="ws-phone"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.mobile')}
                            value={values.phone}
                            onChange={set('phone')}
                        />
                        <p className="ui-help">{t('hint.mobile')}</p>
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-email">{t('label.wsEmail')}</label>
                        <input
                            id="ws-email"
                            type="email"
                            className="ui-input"
                            placeholder={t('ph.wsEmail')}
                            autoComplete="off"
                            value={values.email}
                            onChange={set('email')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-owner-email">{t('label.ownerEmail')}</label>
                        <input
                            id="ws-owner-email"
                            type="email"
                            className="ui-input"
                            placeholder={t('ph.ownerEmail')}
                            autoComplete="off"
                            value={values.ownerUserEmail}
                            onChange={set('ownerUserEmail')}
                        />
                        <p className="ui-help">{t('hint.ownerEmail')}</p>
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-password">{t('label.password')}</label>
                        <input
                            id="ws-password"
                            type="password"
                            className="ui-input"
                            placeholder={t('ph.password')}
                            value={values.password}
                            onChange={set('password')}
                            autoComplete="new-password"
                        />
                        <p className="ui-help">{t('hint.password')}</p>
                    </div>
                </div>
            </section>

            <div className="ui-banner ui-banner--info">
                <AlertTriangle size={14} />
                <span>{t('note.create')}</span>
            </div>
        </>
    );
}

function WorkshopEditForm({ values, onChange, t }) {
    const set = (field) => (e) => onChange(field, e.target.value);

    return (
        <>
            <p className="ui-lead">{t('edit.partial')}</p>
            <section className="ui-section">
                <h2>{t('section.profile')}</h2>
                <div className="ui-form-grid">
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-e-name">{t('label.name')}</label>
                        <input
                            id="ws-e-name"
                            type="text"
                            className="ui-input"
                            value={values.name}
                            onChange={set('name')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-e-code">{t('label.code')}</label>
                        <input
                            id="ws-e-code"
                            type="text"
                            className="ui-input"
                            value={values.workshopCode}
                            onChange={set('workshopCode')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-e-owner">{t('label.ownerNameShort')}</label>
                        <input
                            id="ws-e-owner"
                            type="text"
                            className="ui-input"
                            value={values.ownerName}
                            onChange={set('ownerName')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-e-mobile">{t('label.mobileShort')}</label>
                        <input
                            id="ws-e-mobile"
                            type="text"
                            className="ui-input"
                            value={values.mobile}
                            onChange={set('mobile')}
                        />
                    </div>
                    <div className="ui-field ui-col-12">
                        <label htmlFor="ws-e-email">{t('label.email')}</label>
                        <input
                            id="ws-e-email"
                            type="email"
                            className="ui-input"
                            autoComplete="off"
                            value={values.email}
                            onChange={set('email')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-e-tax">{t('label.taxId')}</label>
                        <input
                            id="ws-e-tax"
                            type="text"
                            className="ui-input ui-mono"
                            value={values.taxId}
                            onChange={set('taxId')}
                        />
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-e-industry">{t('label.industry')}</label>
                        <input
                            id="ws-e-industry"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.industry')}
                            value={values.industryType}
                            onChange={set('industryType')}
                        />
                        <p className="ui-help">{t('hint.industry')}</p>
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="ws-e-lat">{t('label.lat')}</label>
                        <input
                            id="ws-e-lat"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.lat')}
                            value={values.gpsLat}
                            onChange={set('gpsLat')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="ws-e-lng">{t('label.lng')}</label>
                        <input
                            id="ws-e-lng"
                            type="text"
                            className="ui-input"
                            placeholder={t('ph.lng')}
                            value={values.gpsLng}
                            onChange={set('gpsLng')}
                        />
                    </div>
                    <div className="ui-field ui-col-4">
                        <label htmlFor="ws-e-status">{t('label.status')}</label>
                        <select
                            id="ws-e-status"
                            className="ui-select"
                            value={values.status === 'inactive' ? 'inactive' : 'approved'}
                            onChange={set('status')}
                        >
                            <option value="inactive">{t('status.inactive')}</option>
                            <option value="approved">{t('status.approved')}</option>
                        </select>
                    </div>
                    <div className="ui-field ui-col-6">
                        <label htmlFor="ws-e-reset">{t('label.resetPassword')}</label>
                        <input
                            id="ws-e-reset"
                            type="password"
                            className="ui-input"
                            autoComplete="new-password"
                            placeholder={t('ph.resetPassword')}
                            value={values.resetPassword}
                            onChange={set('resetPassword')}
                        />
                        <p className="ui-help">{t('hint.password')}</p>
                    </div>
                </div>
            </section>
        </>
    );
}

function WorkshopDetailPanel({ workshop, t }) {
    if (!workshop) return null;

    const email = resolveWorkshopContactEmail(workshop) || workshop.email || '—';
    const facts = [
        { label: t('detail.ownerName'), value: workshop.ownerName },
        { label: t('detail.mobile'), value: workshop.mobile || resolveWorkshopPhone(workshop) },
        { label: t('detail.email'), value: email },
        { label: t('detail.taxId'), value: workshop.taxId },
        { label: t('detail.industry'), value: workshop.industryType },
        {
            label: t('label.currency'),
            value:
                workshop.currencyCode != null
                    ? t('currency.vat', {
                          code: workshop.currencyCode,
                          vat: workshop.vatPercent ?? 0,
                      })
                    : null,
        },
        {
            label: t('label.registered'),
            value: workshop.createdAt ? ymd(workshop.createdAt) : null,
        },
    ];

    const stats = [
        { label: t('stat.branches'), value: workshop.branchesCount },
        { label: t('stat.employees'), value: workshop.employeesCount },
        { label: t('stat.technicians'), value: workshop.techniciansCount },
        { label: t('stat.cashiers'), value: workshop.cashiersCount },
        { label: t('stat.customers'), value: workshop.customersCount },
        { label: t('stat.products'), value: workshop.productsCount },
        { label: t('stat.services'), value: workshop.servicesCount },
        { label: t('stat.salesOrders'), value: workshop.salesOrdersCount },
    ];

    return (
        <>
            <section className="ui-section">
                <div className="ui-section-head">
                    <h2>{t('section.overview')}</h2>
                    {/* The status row used to read `status.label`, with no such
                        local in scope — it resolved to the browser's legacy
                        `window.status` (an empty string), so the row silently
                        printed a dash on every workshop. */}
                    <span className={`ui-pill ui-pill--${statusTone(workshop.status)}`}>
                        {statusDisplayLabel(workshop.status, t)}
                    </span>
                </div>
                <div className="ui-fields">
                    {facts.map(({ label, value }) => (
                        <div key={label} className="ui-fieldro">
                            <p className="ui-fieldro-label">{label}</p>
                            <p className="ui-fieldro-value">{value || '—'}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="ui-section">
                <h2>{t('section.stats')}</h2>
                <div className="ui-stat-strip">
                    {stats.map(({ label, value }) => (
                        <div key={label} className="ui-stat">
                            <span className="ui-stat-label">{label}</span>
                            <span className="ui-stat-value">{value ?? 0}</span>
                        </div>
                    ))}
                </div>
            </section>

            {workshop.branches?.length > 0 ? (
                <section className="ui-section">
                    <h2>{t('section.branches')}</h2>
                    <div className="ui-rows">
                        <ul className="ui-list">
                            {workshop.branches.map((b) => (
                                <li key={b.id} className="ui-list-row">
                                    <div className="ui-list-main">
                                        <span className="ui-list-title">{b.name}</span>
                                    </div>
                                    <span
                                        className={`ui-pill ui-pill--${b.isActive ? 'ok' : 'neutral'} ui-list-end`}
                                    >
                                        {b.isActive ? t('status.active') : t('status.inactive')}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            ) : null}
        </>
    );
}

export default function WorkshopManagementPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const outletCtx = useOutletContext() || {};
    const locale =
        outletCtx.locale ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('portal-locale') : null) ||
        'en';
    const t = useCallback((key, vars) => wsT(locale, key, vars), [locale]);

    const route = parseWorkshopRoute(location.pathname);
    const pageMode = Boolean(route);

    const [workshops, setWorkshops] = useState([]);
    const [workshopsTotal, setWorkshopsTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [waLinkBusyWorkshopId, setWaLinkBusyWorkshopId] = useState(null);
    const [search, setSearch] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    // The four stat cards read the API's own totals. They used to count the
    // fetched page, which was a flat 100 rows.
    const [counts, setCounts] = useState({ all: 0, approved: 0, pending: 0, inactive: 0 });
    const [reloadKey, setReloadKey] = useState(0);

    const [newWorkshop, setNewWorkshop] = useState({ ...EMPTY_NEW_WORKSHOP });
    const [isDetectingLocation, setIsDetectingLocation] = useState(false);

    const [editForm, setEditForm] = useState(() => workshopRowToEditForm(null));
    const [editLoading, setEditLoading] = useState(false);

    const [viewWorkshop, setViewWorkshop] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);

    const [template, setTemplate] = useState(
        () => localStorage.getItem(STORAGE_KEY_TEMPLATE) || DEFAULT_TEMPLATE,
    );
    const [templateEdit, setTemplateEdit] = useState(template);
    const [templateSaved, setTemplateSaved] = useState(false);

    const goBack = useCallback(() => navigate(WORKSHOP_BASE), [navigate]);

    const paging = useServerPaging({ resetKey: `${statusFilter}|${searchDebounced}` });
    const { page, pageSize } = paging;

    useEffect(() => {
        const timer = setTimeout(() => setSearchDebounced(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    /**
     * One page of rows. Search and the status tabs run on the server now: the
     * endpoint caps `limit` at 100 and the screen asked for exactly that, then
     * filtered in the browser — so workshop 101 onward was unreachable.
     *
     * `statusGroup` rather than `status`, because each tab covers more than one
     * stored value (approved | active, inactive | rejected).
     */
    const refreshWorkshops = useCallback(
        () =>
            getWorkshops({
                statusGroup: statusFilter === 'all' ? undefined : statusFilter,
                search: searchDebounced || undefined,
                limit: pageSize,
                offset: (page - 1) * pageSize,
            }).then((data) => {
                const list = normalizeWorkshopsPayload(data);
                const payload = data?.data || data;
                setWorkshops(list);
                setWorkshopsTotal(Number(payload?.total ?? list.length) || 0);
                return list;
            }),
        [statusFilter, searchDebounced, page, pageSize],
    );

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_TEMPLATE, template);
    }, [template]);

    useEffect(() => {
        if (pageMode) return;
        setLoading(true);
        refreshWorkshops()
            .then(() => setLoadError(false))
            .catch(() => {
                setWorkshops([]);
                setWorkshopsTotal(0);
                setLoadError(true);
            })
            .finally(() => setLoading(false));
    }, [pageMode, refreshWorkshops, reloadKey]);

    // Four counts and no rows, so each asks for a single row.
    useEffect(() => {
        if (pageMode) return undefined;
        let cancelled = false;
        const countOf = (res) => Number((res?.data || res)?.total ?? 0);
        Promise.all([
            getWorkshops({ limit: 1 }),
            getWorkshops({ limit: 1, statusGroup: 'approved' }),
            getWorkshops({ limit: 1, statusGroup: 'pending' }),
            getWorkshops({ limit: 1, statusGroup: 'inactive' }),
        ])
            .then(([all, approved, pending, inactive]) => {
                if (cancelled) return;
                setCounts({
                    all: countOf(all),
                    approved: countOf(approved),
                    pending: countOf(pending),
                    inactive: countOf(inactive),
                });
            })
            .catch(() => {
                if (!cancelled) setCounts({ all: 0, approved: 0, pending: 0, inactive: 0 });
            });
        return () => { cancelled = true; };
    }, [pageMode, reloadKey]);

    useEffect(() => {
        if (route?.screen !== 'create') return;
        setNewWorkshop({ ...EMPTY_NEW_WORKSHOP });
    }, [route?.screen]);

    useEffect(() => {
        if (route?.screen === 'whatsapp-template') {
            setTemplateEdit(template);
        }
    }, [route?.screen, template]);

    useEffect(() => {
        if (route?.screen !== 'edit' || !route.id) return;

        const fromNav = location.state?.workshop;
        if (fromNav && workshopRowId(fromNav) === route.id) {
            setEditForm(workshopRowToEditForm(fromNav));
        }

        let cancelled = false;
        setEditLoading(true);
        (async () => {
            try {
                const res = await getWorkshop(route.id);
                const detail = unwrapWorkshopDetailResponse(res);
                if (!cancelled && detail && typeof detail === 'object') {
                    setEditForm(workshopRowToEditForm({ ...(fromNav || {}), ...detail }));
                }
            } catch {
                if (!cancelled && fromNav) setEditForm(workshopRowToEditForm(fromNav));
            } finally {
                if (!cancelled) setEditLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [route?.screen, route?.id, location.state]);

    useEffect(() => {
        if (route?.screen !== 'view' || !route.id) return;

        const fromNav = location.state?.workshop;
        if (fromNav && workshopRowId(fromNav) === route.id) {
            setViewWorkshop(fromNav);
        }

        let cancelled = false;
        setViewLoading(true);
        (async () => {
            try {
                const res = await getWorkshop(route.id);
                const detail = unwrapWorkshopDetailResponse(res);
                if (!cancelled && detail && typeof detail === 'object') {
                    setViewWorkshop({ ...(fromNav || {}), ...detail });
                }
            } catch {
                if (!cancelled && fromNav) setViewWorkshop(fromNav);
            } finally {
                if (!cancelled) setViewLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [route?.screen, route?.id, location.state]);

    const onCreateField = useCallback((field, value) => {
        setNewWorkshop((prev) => ({ ...prev, [field]: value }));
    }, []);

    const onEditField = useCallback((field, value) => {
        setEditForm((prev) => ({ ...prev, [field]: value }));
    }, []);


    const handleSaveTemplate = () => {
        setTemplate(templateEdit);
        setTemplateSaved(true);
        setTimeout(() => setTemplateSaved(false), 2000);
    };

    const handleDetectGPS = () => {
        if (!navigator.geolocation) {
            window.alert(t('err.geoUnsupported'));
            return;
        }

        setIsDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                    );
                    const data = await response.json();

                    if (data?.address) {
                        setNewWorkshop((prev) => ({
                            ...prev,
                            gpsLat: latitude,
                            gpsLng: longitude,
                            street: data.address.road || data.address.suburb || `${latitude}, ${longitude}`,
                            city: data.address.city || data.address.town || data.address.state || '',
                            postalCode: data.address.postcode || '',
                        }));
                    } else {
                        setNewWorkshop((prev) => ({
                            ...prev,
                            gpsLat: latitude,
                            gpsLng: longitude,
                            street: `${latitude}, ${longitude}`,
                        }));
                    }
                } catch {
                    setNewWorkshop((prev) => ({
                        ...prev,
                        gpsLat: latitude,
                        gpsLng: longitude,
                        street: `${latitude}, ${longitude}`,
                    }));
                } finally {
                    setIsDetectingLocation(false);
                }
            },
            () => {
                window.alert(t('err.geoDenied'));
                setIsDetectingLocation(false);
            },
            { timeout: 10000 },
        );
    };

    const handleAddWorkshop = async () => {
        if (!newWorkshop.name || !newWorkshop.phone) return;
        const ownerPassword = newWorkshop.password;
        setSaving(true);
        try {
            const createRes = await createWorkshop({
                name: newWorkshop.name,
                workshopCode: newWorkshop.workshopCode || undefined,
                ownerName: newWorkshop.contactName,
                mobile: newWorkshop.phone,
                email: newWorkshop.email,
                taxId: newWorkshop.vatId || undefined,
                industryType: newWorkshop.industryType || 'automotive',
                crNumber: newWorkshop.crNumber || undefined,
                egsSerial: newWorkshop.egsSerial || undefined,
                address: [newWorkshop.street, newWorkshop.city, newWorkshop.postalCode].filter(Boolean).join(', '),
                gpsLat: newWorkshop.gpsLat || undefined,
                gpsLng: newWorkshop.gpsLng || undefined,
                ownerUserEmail: newWorkshop.ownerUserEmail || newWorkshop.email,
                ownerUserPassword: ownerPassword,
                createDefaultBranch: true,
                defaultBranchName: newWorkshop.branchName || 'Main Branch',
            });
            const list = await refreshWorkshops();
            let workshopId = extractCreatedWorkshopId(createRes);
            if ((workshopId == null || workshopId === '') && ownerPassword) {
                const phoneDigits =
                    formatPhoneForWhatsApp(newWorkshop.phone) ||
                    String(newWorkshop.phone || '').replace(/\D/g, '');
                const found = list.find((w) => {
                    const wDigits =
                        formatPhoneForWhatsApp(resolveWorkshopPhone(w)) ||
                        String(resolveWorkshopPhone(w) || '').replace(/\D/g, '');
                    return wDigits && phoneDigits && wDigits === phoneDigits;
                });
                workshopId = found?.id ?? found?._id;
            }
            if (workshopId != null && String(workshopId) !== '') {
                const widKey = String(workshopId);
                if (ownerPassword) {
                    try {
                        sessionStorage.setItem(sessionKeyWorkshopOwnerPassword(widKey), ownerPassword);
                    } catch {
                        /* ignore */
                    }
                }
                const ownerEmailToRemember = (newWorkshop.ownerUserEmail || newWorkshop.email || '').trim();
                if (ownerEmailToRemember) {
                    try {
                        sessionStorage.setItem(sessionKeyWorkshopOwnerEmail(widKey), ownerEmailToRemember);
                    } catch {
                        /* ignore */
                    }
                }
            }
            goBack();
        } catch (err) {
            window.alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditWorkshopSave = async () => {
        if (!route?.id) return;
        if (!String(editForm.name || '').trim() || !String(editForm.mobile || '').trim()) {
            window.alert(t('err.nameMobile'));
            return;
        }
        const body = buildUpdateWorkshopBody(editForm);
        if (Object.keys(body).length === 0) {
            window.alert(t('err.nothing'));
            return;
        }
        const newPassword = String(editForm.resetPassword ?? '').trim();
        setSaving(true);
        try {
            await updateWorkshop(route.id, body);
            if (newPassword) {
                try {
                    sessionStorage.setItem(sessionKeyWorkshopOwnerPassword(route.id), newPassword);
                } catch {
                    /* ignore */
                }
            }
            await refreshWorkshops();
            goBack();
        } catch (err) {
            window.alert(err?.message || t('err.update'));
        } finally {
            setSaving(false);
        }
    };

    const openWorkshopCredentialsWaMeLink = async (workshop) => {
        const widStr = workshopRowId(workshop);
        if (!widStr) {
            window.alert(t('err.waId'));
            return;
        }
        const password = readRememberedWorkshopPassword(workshop);
        setWaLinkBusyWorkshopId(widStr);
        try {
            const res = await postSuperAdminWhatsappWorkshopCredentialsWaMeLink({
                workshopId: widStr,
                ...(password ? { password } : {}),
            });
            const payload = res?.data != null && typeof res.data === 'object' ? res.data : res;
            const url = payload?.waMeUrl ?? res?.waMeUrl;
            if (!url || typeof url !== 'string') {
                window.alert(t('err.waUrl'));
                return;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
            if (payload?.passwordUpdated && widStr) {
                try {
                    sessionStorage.removeItem(sessionKeyWorkshopOwnerPassword(widStr));
                } catch {
                    /* ignore */
                }
            }
        } catch (err) {
            if (isWaMeLinkApiUnavailableError(err)) {
                const wForMsg = await enrichWorkshopForWaMePlaceholder(workshop);
                const { url, error } = buildClientSideWaMeUrlForWorkshop(wForMsg, template, password);
                if (url) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                    return;
                }
                window.alert(
                    `${error}\n\nOnce the backend exposes POST /super-admin/whatsapp/workshop-credentials-wa-me-link, WhatsApp will use the server-built message (and optional auto-password).`,
                );
                return;
            }
            window.alert(err?.message || t('err.waLink'));
        } finally {
            setWaLinkBusyWorkshopId(null);
        }
    };

    if (route?.screen === 'whatsapp-template') {
        return (
            <WorkshopPageShell
                title={t('wa.title')}
                onClose={goBack}
                footer={
                    <>
                        <button type="button" className="ui-btn ui-btn--default" onClick={goBack}>
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary"
                            onClick={handleSaveTemplate}
                        >
                            <Save size={14} /> {templateSaved ? t('btn.saved') : t('btn.saveTemplate')}
                        </button>
                    </>
                }
            >
                <p className="ui-lead">{t('wa.lead')}</p>
                <div className="ui-field">
                    <textarea
                        className="ui-textarea ui-textarea--tall"
                        aria-label={t('wa.title')}
                        value={templateEdit}
                        onChange={(e) => setTemplateEdit(e.target.value)}
                        placeholder={t('wa.placeholder')}
                        rows={10}
                    />
                </div>
            </WorkshopPageShell>
        );
    }

    if (route?.screen === 'create') {
        return (
            <WorkshopPageShell
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
                            onClick={() => void handleAddWorkshop()}
                            disabled={!newWorkshop.name || !newWorkshop.phone || saving}
                        >
                            {saving ? (
                                <><Loader size={14} className="ui-spin" /> {t('btn.creating')}</>
                            ) : t('btn.create')}
                        </button>
                    </>
                }
            >
                <WorkshopCreateForm
                    values={newWorkshop}
                    onChange={onCreateField}
                    onDetectGps={handleDetectGPS}
                    isDetectingLocation={isDetectingLocation}
                    t={t}
                />
            </WorkshopPageShell>
        );
    }

    if (route?.screen === 'edit') {
        return (
            <WorkshopPageShell
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
                            onClick={() => void handleEditWorkshopSave()}
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
                    <WorkshopEditForm values={editForm} onChange={onEditField} t={t} />
                )}
            </WorkshopPageShell>
        );
    }

    if (route?.screen === 'view') {
        const viewRow = viewWorkshop || location.state?.workshop;
        const wid = route.id;
        const waBusy = waLinkBusyWorkshopId === wid;

        return (
            <WorkshopPageShell
                title={viewRow?.name || t('view.title')}
                onClose={goBack}
                footer={
                    <>
                        <button
                            type="button"
                            className="ui-btn ui-btn--default"
                            disabled={!!workshopWhatsAppDisabledReason(viewRow) || waBusy}
                            title={workshopWhatsAppDisabledReason(viewRow) || t('title.openWa')}
                            onClick={() => void openWorkshopCredentialsWaMeLink(viewRow)}
                        >
                            {waBusy ? <Loader size={14} className="ui-spin" /> : <WhatsAppIcon />}
                            <span>{waBusy ? t('btn.opening') : t('btn.whatsapp')}</span>
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary"
                            onClick={() =>
                                navigate(workshopRoutes.edit(wid), { state: { workshop: viewRow } })
                            }
                        >
                            <Pencil size={14} /> {t('btn.edit')}
                        </button>
                    </>
                }
            >
                {viewLoading && !viewRow ? (
                    <div className="ui-stack" aria-label={t('loading')} aria-busy="true">
                        <div className="ui-sk ui-sk--title ui-sk--w40" />
                        <div className="ui-fields">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={`sk-${i}`} className="ui-fieldro ui-sk-row">
                                    <div className="ui-sk ui-sk--label ui-sk--w55" />
                                    <div className="ui-sk ui-sk--text ui-sk--w70" />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <WorkshopDetailPanel workshop={viewRow} t={t} />
                )}
            </WorkshopPageShell>
        );
    }

    const filtering = Boolean(searchDebounced || statusFilter !== 'all');

    return (
        <div className="ui-root ui-root--flush ui-stack">
            <div className="ui-kpis">
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Wrench size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.total')}</div>
                    <div className="ui-metric-value">{counts.all}</div>
                </div>
                <div className="ui-metric ui-metric--ok">
                    <span className="ui-metric-icon"><UserCheck size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.approved')}</div>
                    <div className="ui-metric-value">{counts.approved}</div>
                </div>
                <div className="ui-metric ui-metric--warn">
                    <span className="ui-metric-icon"><Clock size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.pending')}</div>
                    <div className="ui-metric-value">{counts.pending}</div>
                </div>
                <div className="ui-metric">
                    <span className="ui-metric-icon"><Ban size={62} strokeWidth={1.1} /></span>
                    <div className="ui-metric-label">{t('stat.inactive')}</div>
                    <div className="ui-metric-value">{counts.inactive}</div>
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
                        {WS_STATUS_TAB_KEYS.map((tab) => (
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
                            className="ui-btn ui-btn--default ui-btn--sm"
                            onClick={() => navigate(workshopRoutes.whatsappTemplate())}
                        >
                            <MessageSquare size={14} /> {t('btn.waTemplate')}
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn--primary ui-btn--sm"
                            onClick={() => navigate(workshopRoutes.create())}
                        >
                            <Plus size={14} /> {t('btn.add')}
                        </button>
                    </div>
                </div>

                <div className="ui-toolbar">
                    <span className="ui-toolbar-end ui-meta">
                        {searchDebounced
                            ? t('page.matches', { n: workshopsTotal })
                            : t('page.count', { n: workshopsTotal })}
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
                ) : !loading && workshops.length === 0 ? (
                    <div className="ui-empty">
                        <div className="ui-empty-icon">
                            {filtering ? <Search size={18} /> : <Wrench size={18} />}
                        </div>
                        <div className="ui-empty-title">
                            {filtering ? t('noMatch.title') : t('empty.title')}
                        </div>
                        <div className="ui-empty-sub">
                            {filtering ? t('noMatch.hint') : t('empty.hint')}
                        </div>
                    </div>
                ) : (
                    <table className="ui-table ui-table--pick">
                        <thead>
                            <tr>
                                <th>{t('th.workshop')}</th>
                                <th>{t('th.contact')}</th>
                                <th>{t('th.phone')}</th>
                                <th>{t('th.email')}</th>
                                <th>{t('th.status')}</th>
                                <th aria-label={t('th.actions')} />
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <tr key={`sk-${i}`} className="ui-sk-row">
                                        <td><div className="ui-sk ui-sk--strong ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w55" /></td>
                                        <td><div className="ui-sk ui-sk--text ui-sk--w70" /></td>
                                        <td><div className="ui-sk ui-sk--pill" /></td>
                                        <td><div className="ui-sk ui-sk--btn ui-sk--w40" /></td>
                                    </tr>
                                ))
                            ) : workshops.map((w, rowIdx) => {
                                const wid = workshopRowId(w);
                                const waBusy = waLinkBusyWorkshopId === wid;
                                const phone = w.mobile || resolveWorkshopPhone(w);
                                const email = resolveWorkshopContactEmail(w) || w.email;
                                const openView = () =>
                                    wid
                                        ? navigate(workshopRoutes.view(wid), { state: { workshop: w } })
                                        : undefined;

                                return (
                                    <tr key={wid ?? `workshop-row-${rowIdx}`} onClick={openView}>
                                        <td data-label={t('th.workshop')}>
                                            {/* The name opens the workshop, so a keyboard
                                                reaches every row the pointer can. */}
                                            <button
                                                type="button"
                                                className="ui-link"
                                                disabled={!wid}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openView();
                                                }}
                                            >
                                                {w.name}
                                            </button>
                                            {w.address ? (
                                                <div className="ui-meta" title={w.address}>
                                                    <MapPin size={11} className="ui-glyph" /> {w.address}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td data-label={t('th.contact')}>{w.ownerName || '—'}</td>
                                        <td data-label={t('th.phone')}>
                                            {phone ? (
                                                <span className="ui-row">
                                                    <Phone size={13} className="ui-glyph" />
                                                    <span className="ui-mono ui-nowrap">{phone}</span>
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td data-label={t('th.email')}>
                                            {email ? (
                                                <span className="ui-row">
                                                    <Mail size={13} className="ui-glyph" />
                                                    {email}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td data-label={t('th.status')}>
                                            <span className={`ui-pill ui-pill--${statusTone(w.status)}`}>
                                                {statusDisplayLabel(w.status, t)}
                                            </span>
                                        </td>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <div className="ui-rowacts">
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm ui-btn--icon"
                                                    disabled={!wid}
                                                    aria-label={wid ? t('title.editWorkshop') : t('title.idMissing')}
                                                    title={wid ? t('title.editWorkshop') : t('title.idMissing')}
                                                    onClick={() =>
                                                        wid
                                                            ? navigate(workshopRoutes.edit(wid), {
                                                                  state: { workshop: w },
                                                              })
                                                            : undefined
                                                    }
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ui-btn ui-btn--default ui-btn--sm"
                                                    disabled={!!workshopWhatsAppDisabledReason(w) || waBusy}
                                                    onClick={() => void openWorkshopCredentialsWaMeLink(w)}
                                                    title={
                                                        workshopWhatsAppDisabledReason(w) || t('title.openWa')
                                                    }
                                                >
                                                    {waBusy ? (
                                                        <Loader size={13} className="ui-spin" />
                                                    ) : (
                                                        <WhatsAppIcon />
                                                    )}
                                                    <span>{t('btn.whatsapp')}</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                <UiPager {...paging.pagerFor(workshopsTotal)} />
            </div>
        </div>
    );
}
