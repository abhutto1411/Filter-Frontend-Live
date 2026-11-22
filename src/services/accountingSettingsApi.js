import { apiFetch } from './api';
import { mergeAccountingScopeParams } from '../utils/accountingWorkshopScope';

function withQuery(path, params = {}) {
    const query = new URLSearchParams();
    Object.entries(mergeAccountingScopeParams(params)).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

/** GET /workshop-accounting/settings (P-A10A) */
export const getAccountingSettings = (params = {}) =>
    apiFetch(withQuery('/workshop-accounting/settings', params));

/**
 * PATCH /workshop-accounting/settings
 * Body: { startDate?, lockedUpTo?, cutoverEnabled?, basis?, reason }
 */
export const patchAccountingSettings = (body, params = {}) =>
    apiFetch(withQuery('/workshop-accounting/settings', params), {
        method: 'PATCH',
        body: JSON.stringify(body || {}),
    });
