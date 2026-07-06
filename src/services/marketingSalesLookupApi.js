import { apiFetch } from './api';

function qs(params = {}) {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') p.set(k, String(v));
    });
    const s = p.toString();
    return s ? `?${s}` : '';
}

const BASE = '/super-admin-marketing-protal/sales-lookups';

export function getWorkshopOptions() {
    return apiFetch(`${BASE}/workshops/options`);
}

export function getBranches(params = {}) {
    return apiFetch(`${BASE}/branches${qs(params)}`);
}

export function getTechnicians(params = {}) {
    return apiFetch(`${BASE}/technicians${qs(params)}`);
}

const ORDERS_BASE = '/super-admin-marketing-protal/sales-orders';

export function getSalesOrders(params = {}) {
    return apiFetch(`${ORDERS_BASE}${qs(params)}`);
}

export function getSalesOrder(id) {
    return apiFetch(`${ORDERS_BASE}/${encodeURIComponent(String(id))}`);
}
