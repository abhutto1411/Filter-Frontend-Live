import { apiFetch } from './api';
import {
    mergeAccountingScopeBody,
    mergeAccountingScopeParams,
} from '../utils/accountingWorkshopScope';

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
    Object.entries(mergeAccountingScopeParams(params)).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

export const getStats = () => apiFetch(withQuery('/advances-global/stats', {}));
export const getAdvances = (params = {}) =>
    apiFetch(withQuery('/advances-global', params)).then(parseArr);
export const createAdvance = (body) =>
    apiFetch('/advances-global', { method: 'POST', body: JSON.stringify(mergeAccountingScopeBody(body)) });
export const bulkCreateAdvances = (body) =>
    apiFetch('/advances-global/bulk', { method: 'POST', body: JSON.stringify(mergeAccountingScopeBody(body)) });
export const getSalaryPayments = (params = {}) =>
    apiFetch(withQuery('/advances-global/salary-payments', params)).then(parseArr);
export const createSalaryPayment = (body) =>
    apiFetch('/advances-global/salary-payments', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });
export const bulkCreateSalaryPayments = (body) =>
    apiFetch('/advances-global/salary-payments/bulk', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });
export const getEmployeeLedger = (employeeId) =>
    apiFetch(`/advances-global/employee-ledger/${encodeURIComponent(employeeId)}`);

// Workshop-scoped advances (branch filter + Salary Advances control account)
export const getWorkshopAdvancesStats = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/advances/stats', params));

export const getWorkshopAdvancesOverview = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/advances/overview', params));

export const getWorkshopAdvancesList = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/advances', params)).then((res) =>
        parseArr(res?.list ?? res),
    );

export const createWorkshopAdvance = (body) =>
    apiFetch('/workshop-staff/advances', { method: 'POST', body: JSON.stringify(body) });

export const bulkCreateWorkshopAdvances = (body) =>
    apiFetch('/workshop-staff/advances/bulk', { method: 'POST', body: JSON.stringify(body) });

export const getSalaryPayrollPreview = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/salary-payroll/preview', params));

export const postWorkshopSalaryPayroll = (body) =>
    apiFetch('/workshop-staff/salary-payroll', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

export const getRecentWorkshopSalaryPayroll = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/salary-payroll/recent', params));

export const getWorkshopEmployeeLedger = (employeeRecordId, params = {}) =>
    apiFetch(withQuery(`/workshop-staff/employee-ledger/${encodeURIComponent(String(employeeRecordId))}`, params));
