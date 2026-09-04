import { BASE_URL } from './api';

/** Legal pages are served from Railway until api.filtercarservices.com ships the same routes. */
const LEGAL_PAGES_API_BASE =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LEGAL_PAGES_API_URL?.trim()) ||
    'https://filterbackend-production.up.railway.app';

function legalPagesUrl(path) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${LEGAL_PAGES_API_BASE.replace(/\/$/, '')}${normalized}`;
}

async function publicLegalFetch(path) {
    const response = await fetch(legalPagesUrl(path), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => '');

    if (!response.ok) {
        const message =
            (typeof body?.message === 'string' && body.message.trim()) ||
            (Array.isArray(body?.message) && body.message.join(' ')) ||
            `Request failed: ${response.status}`;
        throw new Error(message);
    }

    return body;
}

export function getPublicLegalPage(slug) {
    return publicLegalFetch(`/public/legal-pages/${encodeURIComponent(slug)}`);
}

export function listPublicLegalPages() {
    return publicLegalFetch('/public/legal-pages');
}

/** @deprecated use LEGAL_PAGES_API_BASE — exposed for debugging */
export const publicLegalApiBase = LEGAL_PAGES_API_BASE || BASE_URL;
