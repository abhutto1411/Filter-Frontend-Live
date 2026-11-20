import { BASE_URL, getAuthToken } from './api';

/**
 * Fetch an attached proof image from a `/…/proof` endpoint and return a URL the
 * page can show: an object URL for the streamed file, or the stored http(s) URL
 * when the endpoint answers `{ url }` (legacy link proofs).
 * Callers revoke object URLs (`blob:`) when done.
 */
export async function fetchProofObjectUrl(path) {
    const token = getAuthToken();
    const res = await fetch(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
        headers: {
            Accept: '*/*',
            ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
        },
    });
    if (!res.ok) throw new Error(`Proof ${res.status}`);
    const type = String(res.headers.get('content-type') || '');
    if (type.includes('application/json')) {
        const body = await res.json();
        if (body?.url) return String(body.url);
        throw new Error('Proof not found');
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
}
