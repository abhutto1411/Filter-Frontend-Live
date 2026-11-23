import { apiFetch } from './api';

function qs(params) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
        if (v != null && v !== '' && String(v) !== 'undefined' && v !== 'all') p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : '';
}

const enc = (v) => encodeURIComponent(String(v));

/** Countable products of a branch with system qty + purchase cost. */
export const getWorkshopStockCountSheet = (branchId, params) =>
    apiFetch(`/workshop-catalog/branches/${enc(branchId)}/stock-count-sheet${qs(params)}`);

/** Preview (dryRun) or post a physical count / make-zero — one JE on the server. */
export const postWorkshopStockCount = (branchId, body, params) =>
    apiFetch(`/workshop-catalog/branches/${enc(branchId)}/stock-counts${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const listWorkshopStockCounts = (params) => apiFetch(`/workshop-catalog/stock-counts${qs(params)}`);

export const getWorkshopStockCount = (id, params) => apiFetch(`/workshop-catalog/stock-counts/${enc(id)}${qs(params)}`);

/** Stock valuation at purchase cost (method=average|latest). */
export const getWorkshopInventoryValuation = (params) => apiFetch(`/workshop-staff/inventory-valuation${qs(params)}`);

/** Unwrap `{ success, data }` or a bare payload. */
export function unwrap(res) {
    if (res && typeof res === 'object' && res.data && typeof res.data === 'object' && !Array.isArray(res.data) && res.success !== undefined) {
        return res.data;
    }
    return res;
}
