import { apiFetch } from './api';

const parseArr = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    if (res && Array.isArray(res.list)) return res.list;
    if (res && Array.isArray(res.entries)) return res.entries;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && typeof res === 'object') {
        return Object.values(res).filter(
            (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && v.id,
        );
    }
    return [];
};

function withQuery(path, params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

export const getStats = () => apiFetch('/advances-global/stats');
export const getAdvances = (params = {}) =>
    apiFetch(withQuery('/advances-global', params)).then(parseArr);
export const createAdvance = (body) =>
    apiFetch('/advances-global', { method: 'POST', body: JSON.stringify(body) });
export const bulkCreateAdvances = (body) =>
    apiFetch('/advances-global/bulk', { method: 'POST', body: JSON.stringify(body) });
export const getSalaryPayments = (params = {}) =>
    apiFetch(withQuery('/advances-global/salary-payments', params)).then(parseArr);
export const createSalaryPayment = (body) =>
    apiFetch('/advances-global/salary-payments', { method: 'POST', body: JSON.stringify(body) });
export const bulkCreateSalaryPayments = (body) =>
    apiFetch('/advances-global/salary-payments/bulk', { method: 'POST', body: JSON.stringify(body) });
export const getEmployeeLedger = (employeeId) =>
    apiFetch(`/advances-global/employee-ledger/${encodeURIComponent(employeeId)}`);
