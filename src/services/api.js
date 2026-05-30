// staging url
// export const BASE_URL = 'https://filterbackend-production.up.railway.app';


// production url
export const BASE_URL = 'https://api.filtercarservices.com';

// development url
//export const BASE_URL = 'http://localhost:3000';
const API_LOADING_EVENT = 'filter-api-loading';

/** Device UTC offset in minutes (e.g. 300 Pakistan, 240 UAE) for cashier order timestamps. */
export function clientUtcOffsetMinutes() {
    return -new Date().getTimezoneOffset();
}
let activeApiRequests = 0;

function notifyApiLoading() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent(API_LOADING_EVENT, {
            detail: {
                pending: activeApiRequests,
                loading: activeApiRequests > 0,
            },
        }),
    );
}

/** Super-admin multipart CSV import routes (single `file` field). */
const traceCsvImportLabel = (path) => {
    if (path === '/super-admin/products/import' || path.endsWith('/super-admin/products/import')) {
        return 'products/import';
    }
    if (path === '/super-admin/services/import' || path.endsWith('/super-admin/services/import')) {
        return 'services/import';
    }
    return null;
};

export async function apiFetch(path, options = {}) {
    activeApiRequests += 1;
    notifyApiLoading();
    const token = localStorage.getItem('filter_auth_token');
    const customHeaders = options.headers || {};
    const isFormData =
        typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = {
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...customHeaders,
    };
    const url = `${BASE_URL}${path}`;
    const method = options.method || 'GET';
    const csvImportLabel = traceCsvImportLabel(path);
    const traceImport = !!csvImportLabel;
    const t0 = traceImport ? performance.now() : 0;
    const requestId = traceImport
        ? `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
        : '';

    if (traceImport) {
        const file = isFormData ? options.body.get?.('file') : null;
        console.log(`[apiFetch] ${csvImportLabel} — single POST`, {
            requestId,
            url,
            method,
            hasAuthHeader: !!token,
            body: 'multipart/form-data (field file)',
            fileName: file?.name,
            fileSize: file?.size,
            fileType: file?.type,
        });
    }

    try {
        const res = await fetch(url, {
            ...options,
            headers,
        });

        if (traceImport) {
            console.log(`[apiFetch] ${csvImportLabel} — response headers`, {
                requestId,
                status: res.status,
                statusText: res.statusText,
                msToHeaders: `${(performance.now() - t0).toFixed(0)}ms`,
                contentType: res.headers.get('content-type'),
            });
        }

        if (!res.ok) {
            // Expired/invalid token while using supplier portal → send to supplier login (not on login POST itself).
            if (res.status === 401) {
                const pathname =
                    typeof window !== 'undefined' && window.location ? window.location.pathname : '';
                const hadSession =
                    typeof localStorage !== 'undefined' && localStorage.getItem('filter_auth_token');
                if (
                    hadSession &&
                    pathname.startsWith('/supplier') &&
                    !pathname.startsWith('/supplier/login')
                ) {
                    localStorage.removeItem('filter_auth_token');
                    localStorage.removeItem('filter_auth_user');
                    localStorage.removeItem('filter_auth_workshop');
                    window.location.replace('/supplier/login');
                }
            }

            const err = await res.json().catch(() => ({}));
            const detail = {
                path,
                method: options.method || 'GET',
                status: res.status,
                statusText: res.statusText,
                response: err,
                requestBody:
                    options.body instanceof FormData
                        ? '[FormData]'
                        : options.body
                            ? safeJsonParse(options.body)
                            : undefined,
            };
            if (traceImport) {
                console.error(`[apiFetch] ${csvImportLabel} — error body`, {
                    requestId,
                    ...detail,
                    msTotal: `${(performance.now() - t0).toFixed(0)}ms`,
                });
            }
            // Keep a full object log to make backend debugging easier.
            console.error('[apiFetch] Request failed', detail);
            const msgRaw = err.message;
            const msgStr = Array.isArray(msgRaw)
                ? msgRaw.filter(Boolean).map(String).join(' ')
                : typeof msgRaw === 'string'
                    ? msgRaw.trim()
                    : '';
            throw new Error(
                msgStr ||
                (typeof err.error === 'string' ? err.error : '') ||
                `Request failed: ${res.status} ${res.statusText} (${options.method || 'GET'} ${path})`,
            );
        }

        const json = await res.json().catch((e) => {
            if (traceImport) {
                console.error(`[apiFetch] ${csvImportLabel} — JSON parse failed`, {
                    requestId,
                    err: e,
                    msTotal: `${(performance.now() - t0).toFixed(0)}ms`,
                });
            }
            throw e;
        });

        if (traceImport) {
            console.log(`[apiFetch] ${csvImportLabel} — JSON body (same request)`, {
                requestId,
                body: json,
                msTotal: `${(performance.now() - t0).toFixed(0)}ms`,
            });
        }

        return json;
    } finally {
        activeApiRequests = Math.max(0, activeApiRequests - 1);
        notifyApiLoading();
    }
}

function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}
