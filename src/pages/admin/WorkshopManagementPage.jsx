import { useState, useEffect } from 'react';
import { Plus, Wrench, MessageSquare, Phone, Mail, Save, Loader, Pencil } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Modal from '../../components/Modal';
import '../../styles/admin/BranchesPage.css';
import '../../styles/admin/WorkshopManagementPage.css';
import {
    getWorkshops,
    getWorkshop,
    createWorkshop,
    updateWorkshop,
    postSuperAdminWhatsappWorkshopCredentialsWaMeLink,
} from '../../services/superAdminApi';

const STORAGE_KEY_TEMPLATE = 'workshop-welcome-template';
/** Session-only: owner password typed at “Add workshop” time, keyed by workshop id (API never returns plain password). */
const sessionKeyWorkshopOwnerPassword = (workshopId) => `filter_sa_ws_owner_pw_${String(workshopId)}`;
/** Session-only: owner login email from Add workshop form (list payloads often omit it). */
const sessionKeyWorkshopOwnerEmail = (workshopId) => `filter_sa_ws_owner_email_${String(workshopId)}`;

function extractCreatedWorkshopId(res) {
    if (!res || typeof res !== 'object') return null;
    const d = res.data;
    if (d != null && typeof d === 'object') {
        if (d.id != null) return d.id;
        if (d.workshop?.id != null) return d.workshop.id;
        if (d.workshopId != null) return d.workshopId;
    }
    if (res.workshop?.id != null) return res.workshop.id;
    if (res.id != null) return res.id;
    return null;
}
const DEFAULT_TEMPLATE = `Hey {{name}},

Please log in to your Workshop Portal using the credentials we've shared. You can change your password after your first login.

Best regards`;

function formatPhoneForWhatsApp(phone) {
    if (!phone || !String(phone).trim()) return '';
    let p = String(phone).replace(/\D/g, '');
    if (!p) return '';
    if (p.startsWith('0')) p = `966${p.slice(1)}`;
    else if (!p.startsWith('966')) p = `966${p}`;
    return p;
}

/** API may return workshops at root, under `data`, or `data.workshops`. */
function normalizeWorkshopsPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.workshops)) return payload.workshops;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.workshops)) return payload.data.workshops;
    return [];
}

function resolveWorkshopPhone(workshop) {
    if (!workshop || typeof workshop !== 'object') return '';
    const keys = ['mobile', 'phone', 'ownerMobile', 'contactPhone', 'ownerPhone', 'contactMobile'];
    for (const k of keys) {
        const v = workshop[k];
        if (v != null && String(v).trim() !== '' && String(v).trim() !== '—') return String(v).trim();
    }
    return '';
}

/** Stable id from list/detail row (API may use id, _id, or workshopId). */
function workshopRowId(workshop) {
    if (!workshop || typeof workshop !== 'object') return null;
    const v = workshop.id ?? workshop._id ?? workshop.workshopId;
    if (v == null || String(v).trim() === '') return null;
    return String(v).trim();
}

function readRememberedWorkshopPassword(workshop) {
    const wid = workshopRowId(workshop);
    if (!wid) return '';
    try {
        return sessionStorage.getItem(sessionKeyWorkshopOwnerPassword(wid)) || '';
    } catch {
        return '';
    }
}

function readRememberedWorkshopOwnerEmail(workshop) {
    const wid = workshopRowId(workshop);
    if (!wid) return '';
    try {
        return sessionStorage.getItem(sessionKeyWorkshopOwnerEmail(wid)) || '';
    } catch {
        return '';
    }
}

/** Only hard-disable when no id or send in progress; missing password is handled on click with an alert. */
function workshopWhatsAppDisabledReason(workshop) {
    if (!workshopRowId(workshop)) return 'Workshop id missing — cannot send';
    return '';
}

const workshopPortalLoginUrlEnv =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_WORKSHOP_PORTAL_LOGIN_URL
        ? String(import.meta.env.VITE_WORKSHOP_PORTAL_LOGIN_URL).trim()
        : '';

function tryNonEmptyEmail(v) {
    if (v == null) return '';
    const s = String(v).trim();
    if (s === '' || s === '—') return '';
    return s;
}

/**
 * Owner login email for placeholders — list rows are often incomplete; we also use session (Add workshop)
 * and nested / users[] shapes from GET workshop detail.
 */
function resolveWorkshopContactEmail(workshop) {
    if (!workshop || typeof workshop !== 'object') return '';
    const remembered = tryNonEmptyEmail(readRememberedWorkshopOwnerEmail(workshop));
    if (remembered) return remembered;

    const flatKeys = [
        'ownerUserEmail',
        'owner_user_email',
        'email',
        'ownerEmail',
        'owner_email',
        'contactEmail',
        'contact_email',
        'userEmail',
        'user_email',
        'loginEmail',
        'login_email',
        'primaryEmail',
        'primary_email',
    ];
    for (const k of flatKeys) {
        const s = tryNonEmptyEmail(workshop[k]);
        if (s) return s;
    }

    const nestedVals = [
        workshop.owner?.email,
        workshop.owner?.userEmail,
        workshop.user?.email,
        workshop.ownerUser?.email,
        workshop.defaultUser?.email,
        workshop.workshopOwner?.email,
        workshop.createdBy?.email,
    ];
    for (const v of nestedVals) {
        const s = tryNonEmptyEmail(v);
        if (s) return s;
    }

    const users = workshop.users;
    if (Array.isArray(users) && users.length) {
        const ownerLike = users.find((u) =>
            /workshop_owner|owner|portal_user|workshop user/i.test(String(u?.userType || u?.type || u?.role || '')),
        );
        const s = tryNonEmptyEmail(ownerLike?.email);
        if (s) return s;
        for (const u of users) {
            const t = tryNonEmptyEmail(u?.email);
            if (t) return t;
        }
    }

    const wrap = workshop.workshopOwner || workshop.Owner;
    if (wrap && typeof wrap === 'object') {
        const s = tryNonEmptyEmail(wrap.email ?? wrap.userEmail);
        if (s) return s;
    }

    return '';
}

/** Unwrap GET /super-admin/workshops/:id JSON (data.workshop, data, or root). */
function unwrapWorkshopDetailResponse(res) {
    if (!res || typeof res !== 'object') return null;
    const d = res.data;
    if (d != null && typeof d === 'object') {
        if (d.workshop != null && typeof d.workshop === 'object') return d.workshop;
        return d;
    }
    if (res.workshop != null && typeof res.workshop === 'object') return res.workshop;
    return res;
}

/** Merge workshop detail when list row has no email (common for summary APIs). */
async function enrichWorkshopForWaMePlaceholder(workshop) {
    if (!workshop || typeof workshop !== 'object') return workshop;
    if (resolveWorkshopContactEmail(workshop)) return workshop;
    const wid = workshopRowId(workshop);
    if (!wid) return workshop;
    try {
        const res = await getWorkshop(wid);
        const detail = unwrapWorkshopDetailResponse(res);
        if (detail && typeof detail === 'object') {
            return { ...workshop, ...detail };
        }
    } catch {
        /* keep list row */
    }
    return workshop;
}

/** Prefer env, then API fields, then this app’s workshop portal route (`/workshop/login`). */
function resolveWorkshopPortalLoginUrlForTemplate(workshop) {
    if (workshopPortalLoginUrlEnv) return workshopPortalLoginUrlEnv;
    if (workshop && typeof workshop === 'object') {
        for (const k of ['loginUrl', 'login_url', 'portalLoginUrl', 'portalUrl', 'workshopPortalUrl']) {
            const v = workshop[k];
            if (v != null && String(v).trim() !== '') return String(v).trim();
        }
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}/workshop/login`;
    }
    return '';
}

function applyWorkshopWelcomePlaceholders(templateText, workshop, passwordPlain) {
    let s = String(templateText ?? '');
    const name = (workshop?.ownerName && String(workshop.ownerName).trim()) || '';
    const email = resolveWorkshopContactEmail(workshop);
    const loginUrl = resolveWorkshopPortalLoginUrlForTemplate(workshop);
    const pwd =
        passwordPlain != null && String(passwordPlain).trim() !== ''
            ? String(passwordPlain)
            : '(not stored in this browser — use portal “Forgot password” or add the workshop here with a password to include it)';
    s = s.split('{{name}}').join(name);
    s = s.split('{{email}}').join(email);
    s = s.split('{{password}}').join(pwd);
    s = s.split('{{login_url}}').join(loginUrl);
    return s;
}

/** If POST …/workshop-credentials-wa-me-link is missing (404), build wa.me from row phone + gold template. */
function buildClientSideWaMeUrlForWorkshop(workshop, savedTemplateText, passwordPlain) {
    const raw = formatPhoneForWhatsApp(resolveWorkshopPhone(workshop));
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return { error: 'This workshop row has no phone number — cannot build a wa.me link locally.' };
    const message = applyWorkshopWelcomePlaceholders(savedTemplateText, workshop, passwordPlain).trim();
    if (!message) return { error: 'WhatsApp template is empty. Open “WhatsApp template” and save text first.' };
    const encoded = encodeURIComponent(message);
    const cap = 4000;
    const textParam = encoded.length > cap ? encoded.slice(0, cap) : encoded;
    return { url: `https://wa.me/${digits}?text=${textParam}` };
}

function isWaMeLinkApiUnavailableError(err) {
    const msg = String(err?.message || '');
    return /\b404\b/i.test(msg) || /Cannot POST/i.test(msg) || /\bNot Found\b/i.test(msg);
}

/** Edit modal: only `inactive` | `approved` (anything else from API maps to approved). */
function normalizeWorkshopEditStatus(workshop) {
    if (!workshop || typeof workshop !== 'object') return 'approved';
    const s = String(workshop.status ?? '').trim().toLowerCase();
    if (s === 'inactive') return 'inactive';
    return 'approved';
}

function workshopRowToEditForm(w) {
    if (!w || typeof w !== 'object') {
        return {
            name: '',
            ownerName: '',
            mobile: '',
            email: '',
            address: '',
            taxId: '',
            crNumber: '',
            workshopCode: '',
            gpsLat: '',
            gpsLng: '',
            status: 'approved',
        };
    }
    return {
        name: String(w.name ?? '').trim(),
        ownerName: String(w.ownerName ?? '').trim(),
        mobile: String(w.mobile ?? resolveWorkshopPhone(w) ?? '').trim(),
        email: tryNonEmptyEmail(w.email) || resolveWorkshopContactEmail(w) || '',
        address: String(w.address ?? '').trim(),
        taxId: String(w.taxId ?? w.vatId ?? '').trim(),
        crNumber: String(w.crNumber ?? '').trim(),
        workshopCode: String(w.workshopCode ?? '').trim(),
        gpsLat: w.gpsLat != null && w.gpsLat !== '' ? String(w.gpsLat) : '',
        gpsLng: w.gpsLng != null && w.gpsLng !== '' ? String(w.gpsLng) : '',
        status: normalizeWorkshopEditStatus(w),
    };
}

/** PATCH /super-admin/workshops/:id — only non-empty fields (partial update). */
function buildUpdateWorkshopBody(form) {
    const out = {};
    const t = (key, val) => {
        if (val === undefined || val === null) return;
        const s = typeof val === 'string' ? val.trim() : val;
        if (typeof s === 'string' && s === '') return;
        out[key] = s;
    };
    t('name', form.name);
    t('ownerName', form.ownerName);
    t('mobile', form.mobile);
    t('email', form.email);
    if (form.address != null) {
        const a = String(form.address).trim();
        if (a !== '') out.address = a;
    }
    t('taxId', form.taxId);
    t('crNumber', form.crNumber);
    t('workshopCode', form.workshopCode);
    if (form.status) t('status', form.status);
    const lat = form.gpsLat === '' || form.gpsLat == null ? NaN : Number(form.gpsLat);
    const lng = form.gpsLng === '' || form.gpsLng == null ? NaN : Number(form.gpsLng);
    if (!Number.isNaN(lat)) out.gpsLat = lat;
    if (!Number.isNaN(lng)) out.gpsLng = lng;
    return out;
}

export default function WorkshopManagementPage() {
    const [workshops, setWorkshops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [whatsappTemplateOpen, setWhatsappTemplateOpen] = useState(false);
    /** Workshop row id while WhatsApp (wa.me) request is in flight — disables that row’s button. */
    const [waLinkBusyWorkshopId, setWaLinkBusyWorkshopId] = useState(null);
    const [detailWorkshop, setDetailWorkshop] = useState(null);
    const [editWorkshop, setEditWorkshop] = useState(null);
    const [editForm, setEditForm] = useState(() => workshopRowToEditForm(null));
    const [editSaving, setEditSaving] = useState(false);

    useEffect(() => {
        getWorkshops({ limit: '100', offset: '0' })
            .then((data) => setWorkshops(normalizeWorkshopsPayload(data)))
            .catch(() => setWorkshops([]))
            .finally(() => setLoading(false));
    }, []);
    const [template, setTemplate] = useState(() => localStorage.getItem(STORAGE_KEY_TEMPLATE) || DEFAULT_TEMPLATE);
    const [templateEdit, setTemplateEdit] = useState(template);
    const [templateSaved, setTemplateSaved] = useState(false);
    const [newWorkshop, setNewWorkshop] = useState({
        name: '',
        workshopCode: '',
        branchName: '',
        vatId: '',
        crNumber: '',
        street: '',
        city: '',
        postalCode: '',
        gpsLat: null,
        gpsLng: null,
        contactName: '',
        phone: '',
        email: '',
        ownerUserEmail: '',
        password: '',
        referralPerson: '',
        investmentAmount: '',
        status: 'active',
    });

    const [isDetectingLocation, setIsDetectingLocation] = useState(false);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_TEMPLATE, template);
    }, [template]);

    const handleSaveTemplate = () => {
        setTemplate(templateEdit);
        setTemplateSaved(true);
        setTimeout(() => setTemplateSaved(false), 2000);
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
                crNumber: newWorkshop.crNumber || undefined,
                address: [newWorkshop.street, newWorkshop.city, newWorkshop.postalCode].filter(Boolean).join(', '),
                gpsLat: newWorkshop.gpsLat || undefined,
                gpsLng: newWorkshop.gpsLng || undefined,
                ownerUserEmail: newWorkshop.ownerUserEmail || newWorkshop.email,
                ownerUserPassword: ownerPassword,
                createDefaultBranch: !!newWorkshop.branchName,
                defaultBranchName: newWorkshop.branchName || undefined,
            });
            const fresh = await getWorkshops({ limit: '100', offset: '0' });
            const list = normalizeWorkshopsPayload(fresh);
            let workshopId = extractCreatedWorkshopId(createRes);
            if ((workshopId == null || workshopId === '') && ownerPassword) {
                const phoneDigits =
                    formatPhoneForWhatsApp(newWorkshop.phone) || String(newWorkshop.phone || '').replace(/\D/g, '');
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
                        /* ignore quota / private mode */
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
            setWorkshops(list);
            setAddOpen(false);
            setNewWorkshop({ name: '', workshopCode: '', branchName: '', vatId: '', crNumber: '', street: '', city: '', postalCode: '', gpsLat: null, gpsLng: null, contactName: '', phone: '', email: '', ownerUserEmail: '', password: '', referralPerson: '', investmentAmount: '', status: 'active' });
        } catch (err) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDetectGPS = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setIsDetectingLocation(true);
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                
                if (data && data.address) {
                    setNewWorkshop(prev => ({
                        ...prev,
                        gpsLat: latitude,
                        gpsLng: longitude,
                        street: data.address.road || data.address.suburb || `${latitude}, ${longitude}`,
                        city: data.address.city || data.address.town || data.address.state || '',
                        postalCode: data.address.postcode || ''
                    }));
                } else {
                    setNewWorkshop(prev => ({ ...prev, gpsLat: latitude, gpsLng: longitude, street: `${latitude}, ${longitude}` }));
                }
            } catch (error) {
                console.error('Error fetching location:', error);
                setNewWorkshop(prev => ({ ...prev, street: `${latitude}, ${longitude}` }));
            } finally {
                setIsDetectingLocation(false);
            }
        }, (error) => {
            alert('Unable to retrieve your location. Please verify your browser permissions.');
            setIsDetectingLocation(false);
        }, { timeout: 10000 });
    };

    const openWorkshopCredentialsWaMeLink = async (workshop) => {
        const widStr = workshopRowId(workshop);
        if (!widStr) {
            alert('Workshop id is missing on this row — cannot request WhatsApp link.');
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
                alert('Server did not return a WhatsApp link (waMeUrl).');
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
                    console.warn(
                        '[Workshop] API route POST /super-admin/whatsapp/workshop-credentials-wa-me-link is missing — opened wa.me using this browser’s saved template and the row phone.',
                    );
                    window.open(url, '_blank', 'noopener,noreferrer');
                    return;
                }
                alert(
                    `${error}\n\nOnce the backend exposes POST /super-admin/whatsapp/workshop-credentials-wa-me-link, WhatsApp will use the server-built message (and optional auto-password).`,
                );
                return;
            }
            alert(err?.message || 'Could not get WhatsApp link.');
        } finally {
            setWaLinkBusyWorkshopId(null);
        }
    };

    const openEditWorkshopModal = async (workshop) => {
        const wid = workshopRowId(workshop);
        if (!wid) {
            alert('Workshop id is missing — cannot edit.');
            return;
        }
        setEditWorkshop(workshop);
        setEditForm(workshopRowToEditForm(workshop));
        try {
            const res = await getWorkshop(wid);
            const detail = unwrapWorkshopDetailResponse(res);
            if (detail && typeof detail === 'object') {
                setEditForm(workshopRowToEditForm({ ...workshop, ...detail }));
            }
        } catch {
            /* keep list-row values */
        }
    };

    const handleEditWorkshopSave = async () => {
        if (!editWorkshop) return;
        const id = workshopRowId(editWorkshop);
        if (!id) return;
        if (!String(editForm.name || '').trim() || !String(editForm.mobile || '').trim()) {
            alert('Workshop name and mobile are required.');
            return;
        }
        const body = buildUpdateWorkshopBody(editForm);
        if (Object.keys(body).length === 0) {
            alert('Nothing to update.');
            return;
        }
        setEditSaving(true);
        try {
            await updateWorkshop(id, body);
            const fresh = await getWorkshops({ limit: '100', offset: '0' });
            setWorkshops(normalizeWorkshopsPayload(fresh));
            setEditWorkshop(null);
            setDetailWorkshop((prev) => (prev && workshopRowId(prev) === id ? null : prev));
        } catch (err) {
            alert(err?.message || 'Could not update workshop.');
        } finally {
            setEditSaving(false);
        }
    };

    return (
        <div className="workshop-mgmt-page module-container">
            <header className="branches-page-header">
                <div>
                    <h1 className="branches-title">Workshop</h1>
                    <p className="branches-count">Add workshops and send login details via WhatsApp</p>
                </div>
                <div className="branches-header-actions">
                    <button
                        type="button"
                        className="btn-portal"
                        onClick={() => {
                            setTemplateEdit(template);
                            setWhatsappTemplateOpen(true);
                        }}
                    >
                        <MessageSquare size={16} /> WhatsApp template
                    </button>
                    <button type="button" className="btn-portal" onClick={() => setAddOpen(true)}>
                        <Plus size={16} /> Add Workshop
                    </button>
                </div>
            </header>

            {whatsappTemplateOpen ? (
                <Modal
                    title="WhatsApp template"
                    onClose={() => setWhatsappTemplateOpen(false)}
                    width="min(560px, 94vw)"
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                            <button type="button" className="btn-secondary" onClick={() => setWhatsappTemplateOpen(false)}>
                                Close
                            </button>
                            <button type="button" className="btn-save-template" onClick={handleSaveTemplate}>
                                <Save size={16} /> {templateSaved ? 'Saved!' : 'Save template'}
                            </button>
                        </div>
                    }
                >
                    <div className="workshop-mgmt-template-modal-body">
                        <p className="workshop-mgmt-template-desc" style={{ marginBottom: 12 }}>
                            Draft only (saved in this browser). Row <strong>WhatsApp</strong> opens a prefilled chat (server wa.me link when the API
                            exists; otherwise this template + row phone). Placeholders: <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>,{' '}
                            <code>{'{{password}}'}</code>, <code>{'{{login_url}}'}</code> (defaults to this site’s <code>/workshop/login</code>, or set{' '}
                            <code>VITE_WORKSHOP_PORTAL_LOGIN_URL</code> for production).
                        </p>
                        <textarea
                            className="workshop-mgmt-template-textarea"
                            value={templateEdit}
                            onChange={(e) => setTemplateEdit(e.target.value)}
                            placeholder="Hey {{name}}, ..."
                            rows={8}
                        />
                    </div>
                </Modal>
            ) : null}

            <section className="premium-table branches-table workshop-mgmt-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr className="table-header-row">
                            <th className="table-th">Workshop</th>
                            <th className="table-th">Contact</th>
                            <th className="table-th">Phone</th>
                            <th className="table-th">Email</th>
                            <th className="table-th">Status</th>
                            <th className="table-th">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="table-cell table-empty"><Loader size={18} className="spin" /> Loading…</td></tr>
                        ) : workshops.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="table-cell table-empty">No workshops yet. Add your first workshop.</td>
                            </tr>
                        ) : (
                            workshops.map((w, rowIdx) => (
                                <tr
                                    key={workshopRowId(w) ?? `workshop-row-${rowIdx}`}
                                    className="table-row"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setDetailWorkshop(w)}
                                >
                                    <td className="table-cell">
                                        <div className="branch-info-cell">
                                            <div className="branch-icon-box workshop-icon-box">
                                                <Wrench size={18} />
                                            </div>
                                            <div>
                                                <p className="branch-name">{w.name}</p>
                                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{w.address || '—'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">{w.ownerName || '—'}</td>
                                    <td className="table-cell">
                                        <div className="contact-info-cell">
                                            <div className="contact-item">
                                                <Phone size={14} className="info-icon" />
                                                <span>{w.mobile || '—'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <div className="contact-info-cell">
                                            <div className="contact-item">
                                                <Mail size={14} className="info-icon" />
                                                <span>{w.email || '—'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="table-cell">
                                        <span className={`status-badge ${w.status === 'active' ? 'status-completed' : 'status-warning'}`}>{w.status}</span>
                                    </td>
                                    <td className="table-cell">
                                        <div className="workshop-mgmt-actions" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                className="btn-workshop-edit"
                                                disabled={!workshopRowId(w)}
                                                title={workshopRowId(w) ? 'Edit workshop' : 'Workshop id missing'}
                                                onClick={() => void openEditWorkshopModal(w)}
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-whatsapp"
                                                disabled={!!workshopWhatsAppDisabledReason(w) || waLinkBusyWorkshopId === workshopRowId(w)}
                                                onClick={() => void openWorkshopCredentialsWaMeLink(w)}
                                                title="Open WhatsApp with a prefilled message (wa.me). Uses server link when available; otherwise this browser’s saved template and row phone."
                                            >
                                                {waLinkBusyWorkshopId === workshopRowId(w) ? (
                                                    <Loader size={16} className="spin" />
                                                ) : (
                                                    <WhatsAppIcon />
                                                )}
                                                <span>{waLinkBusyWorkshopId === workshopRowId(w) ? 'Opening…' : 'WhatsApp'}</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>

            {/* Workshop Detail Modal */}
            <AnimatePresence>
                {detailWorkshop && (
                    <Modal
                        title={detailWorkshop.name}
                        onClose={() => setDetailWorkshop(null)}
                        footer={
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                                <div onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        className="btn-whatsapp"
                                        disabled={
                                            !!workshopWhatsAppDisabledReason(detailWorkshop) ||
                                            waLinkBusyWorkshopId === workshopRowId(detailWorkshop)
                                        }
                                        onClick={() => void openWorkshopCredentialsWaMeLink(detailWorkshop)}
                                        title="Open WhatsApp with a prefilled message (wa.me)."
                                    >
                                        {waLinkBusyWorkshopId === workshopRowId(detailWorkshop) ? (
                                            <Loader size={16} className="spin" />
                                        ) : (
                                            <WhatsAppIcon />
                                        )}{' '}
                                        <span>
                                            {waLinkBusyWorkshopId === workshopRowId(detailWorkshop) ? 'Opening…' : 'WhatsApp'}
                                        </span>
                                    </button>
                                </div>
                                <button type="button" className="btn-secondary" onClick={() => setDetailWorkshop(null)}>Close</button>
                            </div>
                        }
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Basic Info */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[
                                    { label: 'Owner Name', value: detailWorkshop.ownerName },
                                    { label: 'Mobile', value: detailWorkshop.mobile },
                                    { label: 'Email', value: detailWorkshop.email },
                                    { label: 'Tax ID', value: detailWorkshop.taxId },
                                    { label: 'Currency', value: `${detailWorkshop.currencyCode} (VAT ${detailWorkshop.vatPercent}%)` },
                                    { label: 'Status', value: detailWorkshop.status },
                                    { label: 'Address', value: detailWorkshop.address },
                                    { label: 'Registered', value: detailWorkshop.createdAt ? new Date(detailWorkshop.createdAt).toLocaleDateString() : '—' },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 14px' }}>
                                        <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                                        <p style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{value || '—'}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Stats */}
                            <div>
                                <p style={{ fontWeight: 700, marginBottom: '10px', color: '#0f172a' }}>Platform Stats</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                    {[
                                        { label: 'Branches', value: detailWorkshop.branchesCount },
                                        { label: 'Employees', value: detailWorkshop.employeesCount },
                                        { label: 'Technicians', value: detailWorkshop.techniciansCount },
                                        { label: 'Cashiers', value: detailWorkshop.cashiersCount },
                                        { label: 'Customers', value: detailWorkshop.customersCount },
                                        { label: 'Products', value: detailWorkshop.productsCount },
                                        { label: 'Services', value: detailWorkshop.servicesCount },
                                        { label: 'Sales Orders', value: detailWorkshop.salesOrdersCount },
                                    ].map(({ label, value }) => (
                                        <div key={label} style={{ textAlign: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '10px 6px' }}>
                                            <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{value ?? 0}</p>
                                            <p style={{ fontSize: '0.7rem', color: '#64748b' }}>{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Branches */}
                            {detailWorkshop.branches?.length > 0 && (
                                <div>
                                    <p style={{ fontWeight: 700, marginBottom: '10px', color: '#0f172a' }}>Branches</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {detailWorkshop.branches.map((b) => (
                                            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '8px', padding: '8px 14px' }}>
                                                <span style={{ fontWeight: 500 }}>{b.name}</span>
                                                <span className={`status-badge ${b.isActive ? 'status-completed' : 'status-cancelled'}`}>{b.isActive ? 'Active' : 'Inactive'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}
            </AnimatePresence>

            {editWorkshop ? (
                <Modal
                    title="Edit workshop"
                    onClose={() => {
                        if (!editSaving) setEditWorkshop(null);
                    }}
                    width="min(560px, 94vw)"
                    className="edit-workshop-modal"
                    footer={
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                            <button type="button" className="btn-secondary" disabled={editSaving} onClick={() => setEditWorkshop(null)}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-submit-branch"
                                disabled={editSaving}
                                onClick={() => void handleEditWorkshopSave()}
                            >
                                {editSaving ? (
                                    <>
                                        <Loader size={14} className="spin" /> Saving…
                                    </>
                                ) : (
                                    'Save changes'
                                )}
                            </button>
                        </div>
                    }
                >
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 14 }}>
                        Only non-empty fields are sent to the server (partial update). Name and mobile are required before save.
                    </p>
                    <div className="workshop-form-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 10 }}>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Workshop name*</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Workshop code</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editForm.workshopCode}
                                    onChange={(e) => setEditForm({ ...editForm, workshopCode: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-grid" style={{ marginTop: 15 }}>
                            <div className="form-group">
                                <label className="form-label">Owner name</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editForm.ownerName}
                                    onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mobile*</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editForm.mobile}
                                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: 15 }}>
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input-field"
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            />
                        </div>
                        <div className="form-group" style={{ marginTop: 15 }}>
                            <label className="form-label">Address</label>
                            <textarea
                                className="form-input-field"
                                rows={3}
                                value={editForm.address}
                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            />
                        </div>
                        <div className="form-grid" style={{ marginTop: 15 }}>
                            <div className="form-group">
                                <label className="form-label">Tax ID</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editForm.taxId}
                                    onChange={(e) => setEditForm({ ...editForm, taxId: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CR number</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    value={editForm.crNumber}
                                    onChange={(e) => setEditForm({ ...editForm, crNumber: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-grid" style={{ marginTop: 15 }}>
                            <div className="form-group">
                                <label className="form-label">GPS latitude</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g. 24.7136"
                                    value={editForm.gpsLat}
                                    onChange={(e) => setEditForm({ ...editForm, gpsLat: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">GPS longitude</label>
                                <input
                                    type="text"
                                    className="form-input-field"
                                    placeholder="e.g. 46.6753"
                                    value={editForm.gpsLng}
                                    onChange={(e) => setEditForm({ ...editForm, gpsLng: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: 15 }}>
                            <label className="form-label">Status</label>
                            <select
                                className="form-input-field"
                                value={editForm.status === 'inactive' ? 'inactive' : 'approved'}
                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            >
                                <option value="inactive">inactive</option>
                                <option value="approved">approved</option>
                            </select>
                        </div>
                    </div>
                </Modal>
            ) : null}

            <AnimatePresence>
                {addOpen && (
                    <Modal
                        title="Add Workshop"
                        onClose={() => setAddOpen(false)}
                        className="add-workshop-modal"
                        footer={
                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '15px' }}>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', textAlign: 'center', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
                                    <strong>Note:</strong> After submitting, your request will be reviewed by the Super Admin. Once approved, sign in using your mobile number and the password you set above.
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                                    <button type="button" className="btn-submit-branch" onClick={handleAddWorkshop} disabled={!newWorkshop.name || !newWorkshop.phone || saving}>
                                    {saving ? <><Loader size={14} className="spin" /> Saving…</> : 'Submit Registration'}
                                </button>
                                </div>
                            </div>
                        }
                    >
                        <div className="workshop-form-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: '10px' }}>
                            {/* Workshop Details */}
                            <div className="form-section-header" style={{ marginBottom: '15px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                                Workshop Details
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Workshop Name*</label>
                                    <input type="text" className="form-input-field" placeholder="Workshop Name"
                                        value={newWorkshop.name} onChange={(e) => setNewWorkshop({ ...newWorkshop, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Workshop Code</label>
                                    <input type="text" className="form-input-field" placeholder="e.g. PETROM3567"
                                        value={newWorkshop.workshopCode} onChange={(e) => setNewWorkshop({ ...newWorkshop, workshopCode: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">Default Branch Name</label>
                                    <input type="text" className="form-input-field" placeholder="Main Branch"
                                        value={newWorkshop.branchName} onChange={(e) => setNewWorkshop({ ...newWorkshop, branchName: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">VAT ID</label>
                                    <input type="text" className="form-input-field" placeholder="VAT ID"
                                        value={newWorkshop.vatId} onChange={(e) => setNewWorkshop({ ...newWorkshop, vatId: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">CR Number</label>
                                    <input type="text" className="form-input-field" placeholder="CR Number"
                                        value={newWorkshop.crNumber} onChange={(e) => setNewWorkshop({ ...newWorkshop, crNumber: e.target.value })} />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="form-section-header" style={{ marginTop: '25px', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>Address (GPS + Manual)</span>
                                <button type="button" onClick={handleDetectGPS} disabled={isDetectingLocation} style={{ 
                                    flex: 1, 
                                    padding: '8px', 
                                    borderRadius: '8px', 
                                    border: '1px solid #cbd5e1', 
                                    backgroundColor: 'transparent', 
                                    color: isDetectingLocation ? '#94a3b8' : '#0284c7', 
                                    fontSize: '0.9rem', 
                                    fontWeight: 500,
                                    cursor: isDetectingLocation ? 'not-allowed' : 'pointer'
                                }}>{isDetectingLocation ? 'Detecting Location...' : 'Detect GPS Location'}</button>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Street</label>
                                <input type="text" className="form-input-field" placeholder="Street"
                                    value={newWorkshop.street} onChange={(e) => setNewWorkshop({ ...newWorkshop, street: e.target.value })} />
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">City / District</label>
                                    <input type="text" className="form-input-field" placeholder="City / District"
                                        value={newWorkshop.city} onChange={(e) => setNewWorkshop({ ...newWorkshop, city: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Postal Code</label>
                                    <input type="text" className="form-input-field" placeholder="Postal Code"
                                        value={newWorkshop.postalCode} onChange={(e) => setNewWorkshop({ ...newWorkshop, postalCode: e.target.value })} />
                                </div>
                            </div>

                            {/* Uploads */}
                            <div className="form-section-header" style={{ marginTop: '25px', marginBottom: '15px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                                Uploads <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#64748b' }}>(Optional — can be added after login)</span>
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Workshop Logo</label>
                                    <input type="file" className="form-input-field" style={{ padding: '8px' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Front Photo of Workshop</label>
                                    <input type="file" className="form-input-field" style={{ padding: '8px' }} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: '15px' }}>
                                <label className="form-label">CR Document (PDF / Image)</label>
                                <input type="file" className="form-input-field" style={{ padding: '8px' }} />
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>Max 5 MB each · JPG, PNG, or PDF</p>

                            {/* Owner / Contact Person Details */}
                            <div className="form-section-header" style={{ marginTop: '25px', marginBottom: '15px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                                Owner / Contact Person Details
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Owner / Contact Person Name*</label>
                                    <input type="text" className="form-input-field" placeholder="Full Name"
                                        value={newWorkshop.contactName} onChange={(e) => setNewWorkshop({ ...newWorkshop, contactName: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mobile Number (your username)*</label>
                                    <input type="text" className="form-input-field" placeholder="05XXXXXXXX"
                                        value={newWorkshop.phone} onChange={(e) => setNewWorkshop({ ...newWorkshop, phone: e.target.value })} />
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Saudi format e.g. 05XXXXXXXX</p>
                                </div>
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">Workshop Email</label>
                                    <input type="email" className="form-input-field" placeholder="workshop@example.com"
                                        value={newWorkshop.email} onChange={(e) => setNewWorkshop({ ...newWorkshop, email: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Owner Login Email*</label>
                                    <input type="email" className="form-input-field" placeholder="owner@example.com"
                                        value={newWorkshop.ownerUserEmail} onChange={(e) => setNewWorkshop({ ...newWorkshop, ownerUserEmail: e.target.value })} />
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Used to login to workshop portal</p>
                                </div>
                            </div>
                            <div className="form-grid" style={{ marginTop: '15px' }}>
                                <div className="form-group">
                                    <label className="form-label">Set Password*</label>
                                    <input type="password" className="form-input-field" placeholder="Set a password"
                                        value={newWorkshop.password} onChange={(e) => setNewWorkshop({ ...newWorkshop, password: e.target.value })} />
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Owner will use this to sign in</p>
                                </div>
                            </div>

                            {/* Referral & Investment */}
                            <div className="form-section-header" style={{ marginTop: '25px', marginBottom: '15px', paddingBottom: '5px', borderBottom: '1px solid #e2e8f0', fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                                Referral & Investment
                            </div>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label className="form-label">Referral Person (optional)</label>
                                    <select className="form-input-field" value={newWorkshop.referralPerson} onChange={(e) => setNewWorkshop({ ...newWorkshop, referralPerson: e.target.value })}>
                                        <option value="">None — Select referral person</option>
                                        <option value="Agent A">Agent A</option>
                                        <option value="Agent B">Agent B</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Investment Amount (SAR)*</label>
                                    <input type="number" className="form-input-field" placeholder="e.g. 75000"
                                        value={newWorkshop.investmentAmount} onChange={(e) => setNewWorkshop({ ...newWorkshop, investmentAmount: e.target.value })} />
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Minimum: SAR 50,000</p>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </AnimatePresence>
        </div>
    );
}

function WhatsAppIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
    );
}
