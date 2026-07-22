import { getWorkshop } from '../services/superAdminApi';

export const STORAGE_KEY_TEMPLATE = 'workshop-welcome-template';

export const DEFAULT_TEMPLATE = `Hey {{name}},

Please log in to your Workshop Portal using the credentials we've shared. You can change your password after your first login.

Best regards`;

export const EMPTY_NEW_WORKSHOP = {
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
};

export const sessionKeyWorkshopOwnerPassword = (workshopId) =>
    `filter_sa_ws_owner_pw_${String(workshopId)}`;

export const sessionKeyWorkshopOwnerEmail = (workshopId) =>
    `filter_sa_ws_owner_email_${String(workshopId)}`;

export function extractCreatedWorkshopId(res) {
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

export function formatPhoneForWhatsApp(phone) {
    if (!phone || !String(phone).trim()) return '';
    let p = String(phone).replace(/\D/g, '');
    if (!p) return '';
    if (p.startsWith('0')) p = `966${p.slice(1)}`;
    else if (!p.startsWith('966')) p = `966${p}`;
    return p;
}

export function normalizeWorkshopsPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.workshops)) return payload.workshops;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.data?.workshops)) return payload.data.workshops;
    return [];
}

export function resolveWorkshopPhone(workshop) {
    if (!workshop || typeof workshop !== 'object') return '';
    const keys = ['mobile', 'phone', 'ownerMobile', 'contactPhone', 'ownerPhone', 'contactMobile'];
    for (const k of keys) {
        const v = workshop[k];
        if (v != null && String(v).trim() !== '' && String(v).trim() !== '—') return String(v).trim();
    }
    return '';
}

export function workshopRowId(workshop) {
    if (!workshop || typeof workshop !== 'object') return null;
    const v = workshop.id ?? workshop._id ?? workshop.workshopId;
    if (v == null || String(v).trim() === '') return null;
    return String(v).trim();
}

export function readRememberedWorkshopPassword(workshop) {
    const wid = workshopRowId(workshop);
    if (!wid) return '';
    try {
        return sessionStorage.getItem(sessionKeyWorkshopOwnerPassword(wid)) || '';
    } catch {
        return '';
    }
}

export function readRememberedWorkshopOwnerEmail(workshop) {
    const wid = workshopRowId(workshop);
    if (!wid) return '';
    try {
        return sessionStorage.getItem(sessionKeyWorkshopOwnerEmail(wid)) || '';
    } catch {
        return '';
    }
}

export function workshopWhatsAppDisabledReason(workshop) {
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

export function resolveWorkshopContactEmail(workshop) {
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
            /workshop_owner|owner|portal_user|workshop user/i.test(
                String(u?.userType || u?.type || u?.role || ''),
            ),
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

export function unwrapWorkshopDetailResponse(res) {
    if (!res || typeof res !== 'object') return null;
    const d = res.data;
    if (d != null && typeof d === 'object') {
        if (d.workshop != null && typeof d.workshop === 'object') return d.workshop;
        return d;
    }
    if (res.workshop != null && typeof res.workshop === 'object') return res.workshop;
    return res;
}

export async function enrichWorkshopForWaMePlaceholder(workshop) {
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

export function buildClientSideWaMeUrlForWorkshop(workshop, savedTemplateText, passwordPlain) {
    const raw = formatPhoneForWhatsApp(resolveWorkshopPhone(workshop));
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) {
        return { error: 'This workshop row has no phone number — cannot build a wa.me link locally.' };
    }
    const message = applyWorkshopWelcomePlaceholders(savedTemplateText, workshop, passwordPlain).trim();
    if (!message) {
        return {
            error: 'WhatsApp template is empty. Open “WhatsApp template” and save text first.',
        };
    }
    const encoded = encodeURIComponent(message);
    const cap = 4000;
    const textParam = encoded.length > cap ? encoded.slice(0, cap) : encoded;
    return { url: `https://wa.me/${digits}?text=${textParam}` };
}

export function isWaMeLinkApiUnavailableError(err) {
    const msg = String(err?.message || '');
    return /\b404\b/i.test(msg) || /Cannot POST/i.test(msg) || /\bNot Found\b/i.test(msg);
}

export function normalizeWorkshopEditStatus(workshop) {
    if (!workshop || typeof workshop !== 'object') return 'approved';
    const s = String(workshop.status ?? '').trim().toLowerCase();
    if (s === 'inactive') return 'inactive';
    return 'approved';
}

export function workshopRowToEditForm(w) {
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
            resetPassword: '',
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
        resetPassword: '',
    };
}

export function buildUpdateWorkshopBody(form) {
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
    if (form.resetPassword != null) {
        const pwd = String(form.resetPassword).trim();
        if (pwd !== '') out.ownerUserPassword = pwd;
    }
    return out;
}

export function workshopStatusMeta(status) {
    const s = String(status ?? '').trim().toLowerCase();
    if (s === 'approved' || s === 'active') {
        return { label: 'Approved', className: 'workshop-status--approved' };
    }
    if (s === 'inactive') {
        return { label: 'Inactive', className: 'workshop-status--inactive' };
    }
    if (s === 'pending') {
        return { label: 'Pending', className: 'workshop-status--pending' };
    }
    if (s === 'rejected') {
        return { label: 'Rejected', className: 'workshop-status--rejected' };
    }
    return { label: status || '—', className: 'workshop-status--pending' };
}

export function matchesWorkshopStatusFilter(workshop, filter) {
    if (filter === 'all') return true;
    const s = String(workshop?.status ?? '').trim().toLowerCase();
    if (filter === 'approved') return s === 'approved' || s === 'active';
    if (filter === 'pending') return s === 'pending';
    if (filter === 'inactive') return s === 'inactive' || s === 'rejected';
    return true;
}
