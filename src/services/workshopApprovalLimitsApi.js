import { apiFetch } from './api';

import { qs } from './workshopStaffApi';

export const listApprovalLimits = (params = {}) =>
    apiFetch(`/approvals/limits${qs(params)}`);
export const listApprovalRoles = () => apiFetch('/approvals/limits/roles');
export const listApprovalApprovers = (params = {}) =>
    apiFetch(`/approvals/limits/approvers${qs(params)}`);

export const upsertApprovalLimit = (body) =>
    apiFetch('/approvals/limits', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const bulkUpsertApprovalLimits = (items) =>
    apiFetch('/approvals/limits/bulk', {
        method: 'POST',
        body: JSON.stringify({ items: items ?? [] }),
    });
