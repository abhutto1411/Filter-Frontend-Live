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

export function normalizeSalaryAckFields(row) {
    if (!row || typeof row !== 'object') return row;
    return {
        ...row,
        technicianAckStatus:
            row.technicianAckStatus ??
            row.technician_ack_status ??
            'pending',
        technicianAckAt:
            row.technicianAckAt ??
            row.technician_ack_at ??
            null,
    };
}

export const getStats = () => apiFetch(withQuery('/advances-global/stats', {}));
export const getAdvances = (params = {}) =>
    apiFetch(withQuery('/advances-global', params)).then(parseArr);
export const createAdvance = (body) =>
    apiFetch('/advances-global', { method: 'POST', body: JSON.stringify(mergeAccountingScopeBody(body)) });
export const bulkCreateAdvances = (body) =>
    apiFetch('/advances-global/bulk', { method: 'POST', body: JSON.stringify(mergeAccountingScopeBody(body)) });
export const getSalaryPayments = (params = {}) =>
    apiFetch(withQuery('/advances-global/salary-payments', params))
        .then(parseArr)
        .then((rows) => rows.map(normalizeSalaryAckFields));
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

/** P-A12G/H1: paginated advances register (404-safe caller). */
export const getWorkshopAdvancesRegister = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/advances/register', params));

export const resyncWorkshopAdvances = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/advances/resync', params), {
        method: 'POST',
        body: JSON.stringify({}),
    });

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

export const getRecentWorkshopSalaryPayroll = async (params = {}) => {
    const res = await apiFetch(withQuery('/workshop-staff/salary-payroll/recent', params));
    const list = Array.isArray(res?.list)
        ? res.list.map(normalizeSalaryAckFields)
        : [];
    return { ...res, list };
};

/** Corrects a posted salary in place — same salary row and journal entry number. */
export const updateWorkshopSalaryPayroll = (id, body) =>
    apiFetch(`/workshop-staff/salary-payroll/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        body: JSON.stringify(mergeAccountingScopeBody(body)),
    });

/** Deletes a posted salary and every journal linked to it. */
export const deleteWorkshopSalaryPayroll = (id) =>
    apiFetch(withQuery(`/workshop-staff/salary-payroll/${encodeURIComponent(String(id))}`, {}), {
        method: 'DELETE',
    });

export const getWorkshopEmployeeLedger = (employeeRecordId, params = {}) =>
    apiFetch(withQuery(`/workshop-staff/employee-ledger/${encodeURIComponent(String(employeeRecordId))}`, params));

// ── P-A12G/H2 payroll runs (404-safe callers) ───────────────────────────────
export const createPayrollRun = (body) =>
    apiFetch('/workshop-staff/payroll-runs', {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body || {})),
    });

export const listPayrollRuns = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/payroll-runs', params));

export const searchPayrollStaff = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/payroll-runs/staff-search', params));

export const getPayrollSalarySheet = (id, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-staff/payroll-runs/${encodeURIComponent(String(id))}/salary-sheet`,
            params,
        ),
    );

export const getAdvancePaymentSheet = (params = {}) =>
    apiFetch(withQuery('/workshop-staff/advances/payment-sheet', params));

export const getPayrollRun = (id, params = {}) =>
    apiFetch(withQuery(`/workshop-staff/payroll-runs/${encodeURIComponent(String(id))}`, params));

export const addPayrollSlip = (runId, body) =>
    apiFetch(
        `/workshop-staff/payroll-runs/${encodeURIComponent(String(runId))}/slips`,
        {
            method: 'POST',
            body: JSON.stringify(mergeAccountingScopeBody(body || {})),
        },
    );

export const deletePayrollSlip = (runId, slipId, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-staff/payroll-runs/${encodeURIComponent(String(runId))}/slips/${encodeURIComponent(String(slipId))}`,
            params,
        ),
        { method: 'DELETE' },
    );

export const patchPayrollSlip = (runId, slipId, body) =>
    apiFetch(
        `/workshop-staff/payroll-runs/${encodeURIComponent(String(runId))}/slips/${encodeURIComponent(String(slipId))}`,
        {
            method: 'PATCH',
            body: JSON.stringify(mergeAccountingScopeBody(body || {})),
        },
    );

export const approvePayrollRun = (id, params = {}) =>
    apiFetch(withQuery(`/workshop-staff/payroll-runs/${encodeURIComponent(String(id))}/approve`, params), {
        method: 'POST',
        body: JSON.stringify({}),
    });

export const payoutPayrollRun = (id, body) =>
    apiFetch(`/workshop-staff/payroll-runs/${encodeURIComponent(String(id))}/payouts`, {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body || {})),
    });

export const reversePayrollRun = (id, body) =>
    apiFetch(`/workshop-staff/payroll-runs/${encodeURIComponent(String(id))}/reverse`, {
        method: 'POST',
        body: JSON.stringify(mergeAccountingScopeBody(body || {})),
    });

export const getPayrollSlip = (id, params = {}) =>
    apiFetch(withQuery(`/workshop-staff/payroll-slips/${encodeURIComponent(String(id))}`, params));

/** P-A12G/H3: employee 1250-E / 2250-E / 2200-E statement (404-safe caller). */
export const getEmployeePayrollStatement = (userId, params = {}) =>
    apiFetch(
        withQuery(
            `/workshop-staff/employees/${encodeURIComponent(String(userId))}/statement`,
            params,
        ),
    );
