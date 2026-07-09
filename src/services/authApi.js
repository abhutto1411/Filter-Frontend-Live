import { BASE_URL } from './api';

async function authRequest(path, options = {}) {
    let res;
    try {
        res = await fetch(`${BASE_URL}${path}`, options);
    } catch {
        throw new Error(
            `Cannot reach API at ${BASE_URL}. Start the backend: cd filter_backend → npm run start:dev`,
        );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data.message || data.error || `Request failed: ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : `Request failed: ${res.status}`);
    }
    return data;
}

export async function adminLogin(email, password) {
    return authRequest('/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ email, password }),
    });
}

export async function corporateLogin(email, password) {
    return authRequest('/auth/corporate/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ email, password }),
    });
}

/**
 * Workshop portal — same JWT family for workshop_owner, workshop_user (incl. portal staff), and the
 * public-signup user after approval. The API rejects login when the user’s approvalStatus is set and
 * not approved (including workshop_owner, aligned with workshop_user). Branches are not separate logins;
 * approved branches are used inside this session (e.g. POS branch, staff assignment).
 */
export async function workshopLogin(email, password) {
    return authRequest('/auth/workshop/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ email, password }),
    });
}

/**
 * POST /auth/workshop/logout — workshop JWT; backend uses JwtAuthGuard (workshop_user | workshop_owner).
 * Tokens remain stateless (no server revoke list); callers must still clear localStorage / auth context after success.
 */
export async function workshopLogout(token) {
    const res = await fetch(`${BASE_URL}/auth/workshop/logout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            accept: '*/*',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
    });
    if (!res.ok && res.status !== 401) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Workshop logout failed: ${res.status}`);
    }
}

/**
 * POST /auth/locker/logout — workshop JWT for locker supervisor / collector (or workshop owner).
 * Tokens remain stateless; callers must clear localStorage / auth context after success.
 */
export async function lockerLogout(token) {
    const res = await fetch(`${BASE_URL}/auth/locker/logout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            accept: '*/*',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
    });
    if (!res.ok && res.status !== 401) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Locker logout failed: ${res.status}`);
    }
}

export async function cashierLogin(email, password) {
    return authRequest('/auth/cashier/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ email, password }),
    });
}

export async function marketingLogin(email, password) {
    const data = await authRequest('/auth/marketing/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ email, password }),
    });
    if (data.success === false) {
        throw new Error(data.message || 'Marketing login failed');
    }
    return data;
}

export async function technicianLogin(email, password) {
    return authRequest('/auth/technician/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ email, password }),
    });
}

export async function supplierLogin(mobileOrEmail, password) {
    return authRequest('/auth/supplier/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify({ mobileOrEmail, password }),
    });
}

export async function corporateRegister(body) {
    const res = await fetch(`${BASE_URL}/auth/corporate/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Corporate registration failed: ${res.status}`);
    }
    return data;
}

export async function workshopRegister(body) {
    const res = await fetch(`${BASE_URL}/auth/workshop/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const m = data.message;
        const msg =
            Array.isArray(m)
                ? m.map((x) => (typeof x === 'string' ? x : x?.message || JSON.stringify(x))).join(' ')
                : typeof m === 'string'
                  ? m
                  : typeof data.error === 'string'
                    ? data.error
                    : '';
        throw new Error(msg || `Workshop registration failed: ${res.status}`);
    }
    return data;
}

export async function supplierRegister(body) {
    const res = await fetch(`${BASE_URL}/auth/supplier/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: '*/*' },
        body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Supplier registration failed: ${res.status}`);
    }
    return data;
}

/** Public signup: workshop-wise branches for corporate registration. */
export async function getCorporateRegisterBranchOptions(selectedStoreIds = []) {
    const qs = new URLSearchParams();
    (Array.isArray(selectedStoreIds) ? selectedStoreIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
        .forEach((id) => qs.append('selectedStoreIds', id));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await fetch(`${BASE_URL}/auth/corporate/register/branch-options${suffix}`, {
        method: 'GET',
        headers: { accept: '*/*' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || `Corporate branch options failed: ${res.status}`);
    }
    return data;
}
