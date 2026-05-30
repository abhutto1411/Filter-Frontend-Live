import { apiFetch } from './api';

export const listApprovalLimits = () => apiFetch('/approvals/limits');
export const listApprovalRoles = () => apiFetch('/approvals/limits/roles');
export const listApprovalApprovers = () => apiFetch('/approvals/limits/approvers');

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
