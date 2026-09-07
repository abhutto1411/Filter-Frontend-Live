import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useOutletContext } from 'react-router-dom';
import {
    Plus,
    Wrench,
    MessageSquare,
    Phone,
    Mail,
    Save,
    Loader,
    Pencil,
    Search,
    UserCheck,
    Clock,
    Ban,
    ChevronDown,
    MapPin,
} from 'lucide-react';
import WorkshopPageShell from '../../components/admin/WorkshopPageShell';
import { ShimmerTable } from '../../components/supplier/Shimmer';
import '../../styles/admin/BranchesPage.css';
import '../../styles/admin/WorkshopManagementPage.css';
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
    matchesWorkshopStatusFilter,
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

function SelectField({ value, onChange, disabled, children, className = '' }) {
    return (
        <div className={`select-wrapper ${className}`.trim()}>
            <select className="form-input-field" value={value} onChange={onChange} disabled={disabled}>
                {children}
            </select>
            <ChevronDown size={16} className="select-icon" />
        </div>
    );
}

function statusDisplayLabel(status, t) {
    const key = workshopStatusI18nKey(status);
    return key ? t(key) : workshopStatusMeta(status).label;
}

function WorkshopCreateForm({ values, onChange, onDetectGps, isDetectingLocation, t }) {
    const set = (field) => (e) => onChange(field, e.target.value);

    return (
        <div className="workshop-form-layout">
            <section className="workshop-form-section">
                <h2 className="workshop-form-section-title">{t('section.details')}</h2>
                <div className="workshop-form-grid workshop-form-grid--2">
                    <div className="form-group">
                        <label className="form-label">{t('label.name')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.name')}
                            value={values.name}
                            onChange={set('name')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.code')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.code')}
                            value={values.workshopCode}
                            onChange={set('workshopCode')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.branchName')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.branch')}
                            value={values.branchName}
                            onChange={set('branchName')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Industry type *</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="automotive"
                            value={values.industryType}
                            onChange={set('industryType')}
                        />
                        <p className="workshop-form-hint">ZATCA CSR business category (default: automotive)</p>
                    </div>
                </div>
            </section>

            <section className="workshop-form-section">
                <div className="workshop-form-section-head">
                    <h2 className="workshop-form-section-title">Default branch (ZATCA)</h2>
                    <button
                        type="button"
                        className="workshop-gps-btn"
                        onClick={onDetectGps}
                        disabled={isDetectingLocation}
                    >
                        {isDetectingLocation ? t('btn.detecting') : t('btn.detectGps')}
                    </button>
                </div>
                <p className="workshop-form-hint" style={{ marginTop: 0 }}>
                    CR, address, and EGS are stored on the default branch — not the workshop.
                </p>
                <div className="workshop-form-grid workshop-form-grid--3">
                    <div className="form-group">
                        <label className="form-label">VAT ID</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="VAT ID"
                            value={values.vatId}
                            onChange={set('vatId')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">CR number</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="CR number"
                            value={values.crNumber}
                            onChange={set('crNumber')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">EGS serial</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="1-Filter|2-EGS|3-id"
                            value={values.egsSerial}
                            onChange={set('egsSerial')}
                        />
                    </div>
                    <div className="form-group span-3">
                        <label className="form-label">{t('label.street')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.street')}
                            value={values.street}
                            onChange={set('street')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.city')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.city')}
                            value={values.city}
                            onChange={set('city')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.postal')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.postal')}
                            value={values.postalCode}
                            onChange={set('postalCode')}
                        />
                    </div>
                </div>
            </section>

            <section className="workshop-form-section">
                <h2 className="workshop-form-section-title">{t('section.owner')}</h2>
                <div className="workshop-form-grid workshop-form-grid--2">
                    <div className="form-group">
                        <label className="form-label">{t('label.ownerName')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.fullName')}
                            value={values.contactName}
                            onChange={set('contactName')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.mobile')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.mobile')}
                            value={values.phone}
                            onChange={set('phone')}
                        />
                        <p className="workshop-form-hint">{t('hint.mobile')}</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.wsEmail')}</label>
                        <input
                            type="email"
                            className="form-input-field"
                            placeholder={t('ph.wsEmail')}
                            value={values.email}
                            onChange={set('email')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.ownerEmail')}</label>
                        <input
                            type="email"
                            className="form-input-field"
                            placeholder={t('ph.ownerEmail')}
                            value={values.ownerUserEmail}
                            onChange={set('ownerUserEmail')}
                        />
                        <p className="workshop-form-hint">{t('hint.ownerEmail')}</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.password')}</label>
                        <input
                            type="password"
                            className="form-input-field"
                            placeholder={t('ph.password')}
                            value={values.password}
                            onChange={set('password')}
                            autoComplete="new-password"
                        />
                        <p className="workshop-form-hint">{t('hint.password')}</p>
                    </div>
                </div>
            </section>

            <div className="workshop-create-note">{t('note.create')}</div>
        </div>
    );
}

function WorkshopEditForm({ values, onChange, t }) {
    const set = (field) => (e) => onChange(field, e.target.value);

    return (
        <div className="workshop-form-layout">
            <p className="workshop-form-lead">
                Only non-empty fields are sent to the server (partial update). Name and mobile are required before
                save.
            </p>
            <section className="workshop-form-section">
                <h2 className="workshop-form-section-title">{t('section.profile')}</h2>
                <div className="workshop-form-grid workshop-form-grid--2">
                    <div className="form-group">
                        <label className="form-label">{t('label.name')}</label>
                        <input type="text" className="form-input-field" value={values.name} onChange={set('name')} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.code')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            value={values.workshopCode}
                            onChange={set('workshopCode')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.ownerNameShort')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            value={values.ownerName}
                            onChange={set('ownerName')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.mobileShort')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            value={values.mobile}
                            onChange={set('mobile')}
                        />
                    </div>
                    <div className="form-group span-2">
                        <label className="form-label">{t('label.email')}</label>
                        <input type="email" className="form-input-field" value={values.email} onChange={set('email')} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.taxId')}</label>
                        <input type="text" className="form-input-field" value={values.taxId} onChange={set('taxId')} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Industry type *</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder="automotive"
                            value={values.industryType}
                            onChange={set('industryType')}
                        />
                        <p className="workshop-form-hint">ZATCA CSR business category</p>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.lat')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.lat')}
                            value={values.gpsLat}
                            onChange={set('gpsLat')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.lng')}</label>
                        <input
                            type="text"
                            className="form-input-field"
                            placeholder={t('ph.lng')}
                            value={values.gpsLng}
                            onChange={set('gpsLng')}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.status')}</label>
                        <SelectField value={values.status === 'inactive' ? 'inactive' : 'approved'} onChange={set('status')}>
                            <option value="inactive">{t('status.inactive')}</option>
                            <option value="approved">{t('status.approved')}</option>
                        </SelectField>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('label.resetPassword')}</label>
                        <input
                            type="password"
                            className="form-input-field"
                            autoComplete="new-password"
                            placeholder={t('ph.resetPassword')}
                            value={values.resetPassword}
                            onChange={set('resetPassword')}
                        />
                        <p className="workshop-form-hint">{t('hint.password')}</p>
                    </div>
                </div>
            </section>
        </div>
    );
}

function WorkshopDetailPanel({ workshop, t }) {
    if (!workshop) return null;

    const statusLabel = statusDisplayLabel(workshop.status, t);
    const email = resolveWorkshopContactEmail(workshop) || workshop.email || '—';

    return (
        <div className="workshop-detail-layout">
            <section className="workshop-form-section">
                <h2 className="workshop-form-section-title">{t('section.overview')}</h2>
                <div className="workshop-detail-grid">
                    {[
                        { label: 'Owner name', value: workshop.ownerName },
                        { label: 'Mobile', value: workshop.mobile || resolveWorkshopPhone(workshop) },
                        { label: 'Email', value: email },
                        { label: 'Tax ID', value: workshop.taxId },
                        { label: 'Industry type', value: workshop.industryType },
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
                        { label: 'Status', value: status.label },
                        {
                            label: t('label.registered'),
                            value: workshop.createdAt
                                ? new Date(workshop.createdAt).toLocaleDateString()
                                : null,
                        },
                    ].map(({ label, value }) => (
                        <div key={label} className="workshop-detail-field">
                            <p className="workshop-detail-label">{label}</p>
                            <p className="workshop-detail-value">{value || '—'}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="workshop-form-section">
                <h2 className="workshop-form-section-title">{t('section.stats')}</h2>
                <div className="workshop-stats-mini-grid">
                    {[
                        { label: t('stat.branches'), value: workshop.branchesCount },
                        { label: t('stat.employees'), value: workshop.employeesCount },
                        { label: t('stat.technicians'), value: workshop.techniciansCount },
                        { label: t('stat.cashiers'), value: workshop.cashiersCount },
                        { label: t('stat.customers'), value: workshop.customersCount },
                        { label: t('stat.products'), value: workshop.productsCount },
                        { label: t('stat.services'), value: workshop.servicesCount },
                        { label: t('stat.salesOrders'), value: workshop.salesOrdersCount },
                    ].map(({ label, value }) => (
                        <div key={label} className="workshop-stats-mini-card">
                            <p className="workshop-stats-mini-value">{value ?? 0}</p>
                            <p className="workshop-stats-mini-label">{label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {workshop.branches?.length > 0 ? (
                <section className="workshop-form-section">
                    <h2 className="workshop-form-section-title">{t('section.branches')}</h2>
                    <div className="workshop-branches-list">
                        {workshop.branches.map((b) => (
                            <div key={b.id} className="workshop-branch-row">
                                <span>{b.name}</span>
                                <span
                                    className={`status-badge ${b.isActive ? 'status-completed' : 'status-cancelled'}`}
                                >
                                    {b.isActive ? t('status.active') : t('status.inactive')}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [waLinkBusyWorkshopId, setWaLinkBusyWorkshopId] = useState(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

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

    const refreshWorkshops = useCallback(
        () =>
            getWorkshops({ limit: '100', offset: '0' }).then((data) => {
                const list = normalizeWorkshopsPayload(data);
                setWorkshops(list);
                return list;
            }),
        [],
    );

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_TEMPLATE, template);
    }, [template]);

    useEffect(() => {
        if (pageMode) return;
        setLoading(true);
        refreshWorkshops()
            .catch(() => setWorkshops([]))
            .finally(() => setLoading(false));
    }, [pageMode, refreshWorkshops]);

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

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return workshops.filter((w) => {
            if (!matchesWorkshopStatusFilter(w, statusFilter)) return false;
            if (!needle) return true;
            return [
                w.name,
                w.ownerName,
                w.mobile,
                w.email,
                w.workshopCode,
                w.taxId,
            ]
                .join(' ')
                .toLowerCase()
                .includes(needle);
        });
    }, [workshops, search, statusFilter]);

    const total = workshops.length;
    const approvedCount = workshops.filter((w) => matchesWorkshopStatusFilter(w, 'approved')).length;
    const pendingCount = workshops.filter((w) => matchesWorkshopStatusFilter(w, 'pending')).length;
    const inactiveCount = workshops.filter((w) => matchesWorkshopStatusFilter(w, 'inactive')).length;

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
                        <button type="button" className="btn-secondary" onClick={goBack}>
                            {t('btn.cancel')}
                        </button>
                        <button type="button" className="btn-save-template" onClick={handleSaveTemplate}>
                            <Save size={16} /> {templateSaved ? t('btn.saved') : t('btn.saveTemplate')}
                        </button>
                    </>
                }
            >
                <p className="workshop-form-lead">{t('wa.lead')}</p>
                <textarea
                    className="workshop-mgmt-template-textarea"
                    value={templateEdit}
                    onChange={(e) => setTemplateEdit(e.target.value)}
                    placeholder={t('wa.placeholder')}
                    rows={10}
                />
            </WorkshopPageShell>
        );
    }

    if (route?.screen === 'create') {
        return (
            <WorkshopPageShell
                title={t('create.title')}
                onClose={goBack}
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={goBack}>
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="btn-submit"
                            onClick={() => void handleAddWorkshop()}
                            disabled={!newWorkshop.name || !newWorkshop.phone || saving}
                        >
                            {saving ? (
                                <>
                                    <Loader size={14} className="spin" /> {t('btn.creating')}
                                </>
                            ) : (
                                t('btn.create')
                            )}
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
                        <button type="button" className="btn-secondary" onClick={goBack} disabled={saving}>
                            {t('btn.cancel')}
                        </button>
                        <button
                            type="button"
                            className="btn-submit"
                            onClick={() => void handleEditWorkshopSave()}
                            disabled={saving || editLoading}
                        >
                            {saving ? (
                                <>
                                    <Loader size={14} className="spin" /> {t('btn.saving')}
                                </>
                            ) : (
                                t('btn.save')
                            )}
                        </button>
                    </>
                }
            >
                {editLoading ? (
                    <div className="table-empty">
                        <Loader size={18} className="spin" /> {t('loading')}
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
                            className="btn-whatsapp"
                            disabled={!!workshopWhatsAppDisabledReason(viewRow) || waBusy}
                            onClick={() => void openWorkshopCredentialsWaMeLink(viewRow)}
                        >
                            {waBusy ? <Loader size={16} className="spin" /> : <WhatsAppIcon />}
                            <span>{waBusy ? t('btn.opening') : t('btn.whatsapp')}</span>
                        </button>
                        <button
                            type="button"
                            className="btn-secondary"
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
                    <div className="table-empty">
                        <Loader size={18} className="spin" /> {t('loading')}
                    </div>
                ) : (
                    <WorkshopDetailPanel workshop={viewRow} t={t} />
                )}
            </WorkshopPageShell>
        );
    }

    return (
        <div className="workshop-mgmt-page module-container">
            <header className="branches-page-header">
                <div className="branches-page-header-text">
                    <h1 className="branches-title">{t('page.title')}</h1>
                    <p className="branches-subtitle">{t('page.subtitle')}</p>
                </div>
                <div className="workshop-header-actions">
                    <button
                        type="button"
                        className="btn-portal workshop-header-secondary"
                        onClick={() => navigate(workshopRoutes.whatsappTemplate())}
                    >
                        <MessageSquare size={16} /> {t('btn.waTemplate')}
                    </button>
                    <button
                        type="button"
                        className="btn-portal branches-header-add"
                        onClick={() => navigate(workshopRoutes.create())}
                    >
                        <Plus size={16} /> {t('btn.add')}
                    </button>
                </div>
            </header>

            <div className="workshop-stats-grid">
                <div className="workshop-stat-card">
                    <span className="workshop-stat-icon workshop-stat-icon--total">
                        <Wrench size={18} />
                    </span>
                    <div>
                        <p className="workshop-stat-label">{t('stat.total')}</p>
                        <p className="workshop-stat-value">{total}</p>
                    </div>
                </div>
                <div className="workshop-stat-card">
                    <span className="workshop-stat-icon workshop-stat-icon--approved">
                        <UserCheck size={18} />
                    </span>
                    <div>
                        <p className="workshop-stat-label">{t('stat.approved')}</p>
                        <p className="workshop-stat-value">{approvedCount}</p>
                    </div>
                </div>
                <div className="workshop-stat-card">
                    <span className="workshop-stat-icon workshop-stat-icon--pending">
                        <Clock size={18} />
                    </span>
                    <div>
                        <p className="workshop-stat-label">{t('stat.pending')}</p>
                        <p className="workshop-stat-value">{pendingCount}</p>
                    </div>
                </div>
                <div className="workshop-stat-card">
                    <span className="workshop-stat-icon workshop-stat-icon--inactive">
                        <Ban size={18} />
                    </span>
                    <div>
                        <p className="workshop-stat-label">{t('stat.inactive')}</p>
                        <p className="workshop-stat-value">{inactiveCount}</p>
                    </div>
                </div>
            </div>

            <div className="branches-filter-bar">
                <div className="search-bar-mini branches-search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder={t('search.placeholder')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="branches-segment" role="tablist" aria-label={t('filter.statusAria')}>
                    {WS_STATUS_TAB_KEYS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={statusFilter === tab.id}
                            className={`branches-segment-btn ${statusFilter === tab.id ? 'active' : ''}`}
                            onClick={() => setStatusFilter(tab.id)}
                        >
                            {t(tab.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            <section className="premium-table branches-table workshop-mgmt-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">{t('th.workshop')}</th>
                            <th className="table-th">{t('th.contact')}</th>
                            <th className="table-th">{t('th.phone')}</th>
                            <th className="table-th">{t('th.email')}</th>
                            <th className="table-th">{t('th.status')}</th>
                            <th className="table-th" />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 0, border: 'none' }}>
                                    <ShimmerTable rows={8} columns={6} />
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="table-cell table-empty branches-empty">
                                    <Wrench size={40} strokeWidth={1.25} />
                                    <p>{t('empty.title')}</p>
                                    <span>{t('empty.hint')}</span>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((w, rowIdx) => {
                                const wid = workshopRowId(w);
                                const statusMeta = workshopStatusMeta(w.status);
                                const statusLabel = statusDisplayLabel(w.status, t);
                                const waBusy = waLinkBusyWorkshopId === wid;

                                return (
                                    <tr
                                        key={wid ?? `workshop-row-${rowIdx}`}
                                        className="table-row workshop-table-row"
                                        onClick={() =>
                                            wid
                                                ? navigate(workshopRoutes.view(wid), { state: { workshop: w } })
                                                : undefined
                                        }
                                    >
                                        <td className="table-cell">
                                            <div className="branch-info-cell">
                                                <div className="branch-icon-box workshop-icon-box">
                                                    <Wrench size={18} />
                                                </div>
                                                <div>
                                                    <p className="branch-name">{w.name}</p>
                                                    {w.address ? (
                                                        <p className="workshop-address-sub" title={w.address}>
                                                            <MapPin size={12} />
                                                            {w.address}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="table-cell">{w.ownerName || '—'}</td>
                                        <td className="table-cell">
                                            <div className="contact-info-cell">
                                                {w.mobile || resolveWorkshopPhone(w) ? (
                                                    <div className="contact-item">
                                                        <Phone size={14} className="info-icon" />
                                                        <span>{w.mobile || resolveWorkshopPhone(w)}</span>
                                                    </div>
                                                ) : (
                                                    '—'
                                                )}
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <div className="contact-info-cell">
                                                {resolveWorkshopContactEmail(w) || w.email ? (
                                                    <div className="contact-item">
                                                        <Mail size={14} className="info-icon" />
                                                        <span>{resolveWorkshopContactEmail(w) || w.email}</span>
                                                    </div>
                                                ) : (
                                                    '—'
                                                )}
                                            </div>
                                        </td>
                                        <td className="table-cell">
                                            <span className={`workshop-status-badge ${statusMeta.className}`}>
                                                {statusLabel}
                                            </span>
                                        </td>
                                        <td className="table-cell workshop-actions-cell">
                                            <div className="workshop-mgmt-actions" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    className="btn-workshop-edit"
                                                    disabled={!wid}
                                                    title={wid ? t('title.editWorkshop') : t('title.idMissing')}
                                                    onClick={() =>
                                                        wid
                                                            ? navigate(workshopRoutes.edit(wid), {
                                                                  state: { workshop: w },
                                                              })
                                                            : undefined
                                                    }
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-whatsapp"
                                                    disabled={!!workshopWhatsAppDisabledReason(w) || waBusy}
                                                    onClick={() => void openWorkshopCredentialsWaMeLink(w)}
                                                    title={t('title.openWa')}
                                                >
                                                    {waBusy ? (
                                                        <Loader size={16} className="spin" />
                                                    ) : (
                                                        <WhatsAppIcon />
                                                    )}
                                                    <span>{waBusy ? '…' : t('btn.whatsapp')}</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
