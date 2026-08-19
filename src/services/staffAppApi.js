import { apiFetch } from './api';
import * as employeeExpenseApi from './employeeExpenseApi';

const qs = (params = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length === 0) return '';
    const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    return `?${search}`;
};

export { employeeExpenseApi };

export const getStaffAppOverview = (params = {}) =>
    apiFetch(`/staff-app/overview${qs(params)}`);

export const listStaffDemands = (params = {}) =>
    apiFetch(`/staff-app/demands${qs(params)}`);

export const getStaffDemand = (id) =>
    apiFetch(`/staff-app/demands/${encodeURIComponent(String(id))}`);

export const createStaffDemand = (body, params = {}) =>
    apiFetch(`/staff-app/demands${qs(params)}`, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const updateStaffDemand = (id, body, params = {}) =>
    apiFetch(`/staff-app/demands/${encodeURIComponent(String(id))}${qs(params)}`, {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
    });

export const submitStaffDemand = (id, params = {}) =>
    apiFetch(`/staff-app/demands/${encodeURIComponent(String(id))}/submit${qs(params)}`, { method: 'POST' });

export const listStaffTasks = (params = {}) =>
    apiFetch(`/staff-app/tasks${qs(params)}`);

export const createStaffTask = (body, params = {}) =>
    apiFetch(`/staff-app/tasks${qs(params)}`, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const updateStaffTask = (id, body, params = {}) =>
    apiFetch(`/staff-app/tasks/${encodeURIComponent(String(id))}${qs(params)}`, {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
    });

export const listLeaveRequests = (params = {}) =>
    apiFetch(`/staff-app/leave-requests${qs(params)}`);

export const createLeaveRequest = (body, params = {}) =>
    apiFetch(`/staff-app/leave-requests${qs(params)}`, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const updateLeaveRequest = (id, body, params = {}) =>
    apiFetch(`/staff-app/leave-requests/${encodeURIComponent(String(id))}${qs(params)}`, {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
    });

export const listSalaryAdvances = (params = {}) =>
    apiFetch(`/staff-app/salary-advances${qs(params)}`);

export const createSalaryAdvance = (body, params = {}) =>
    apiFetch(`/staff-app/salary-advances${qs(params)}`, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const updateSalaryAdvance = (id, body, params = {}) =>
    apiFetch(`/staff-app/salary-advances/${encodeURIComponent(String(id))}${qs(params)}`, {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
    });

export const listStaffChatMemberCandidates = (params = {}) =>
    apiFetch(`/staff-app/chat/member-candidates${qs(params)}`);

export const listStaffChatChannels = (params = {}) =>
    apiFetch(`/staff-app/chat/channels${qs(params)}`);

export const createStaffChatChannel = (body, params = {}) =>
    apiFetch(`/staff-app/chat/channels${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const getStaffChatChannel = (channelId, params = {}) =>
    apiFetch(`/staff-app/chat/channels/${encodeURIComponent(String(channelId))}${qs(params)}`);

export const updateStaffChatChannel = (channelId, body, params = {}) =>
    apiFetch(`/staff-app/chat/channels/${encodeURIComponent(String(channelId))}${qs(params)}`, {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
    });

export const manageStaffChatChannelMembers = (channelId, body, params = {}) =>
    apiFetch(`/staff-app/chat/channels/${encodeURIComponent(String(channelId))}/members${qs(params)}`, {
        method: 'PATCH',
        body: JSON.stringify(body ?? {}),
    });

export const listStaffChatLinkableRequests = (channelId, params = {}) =>
    apiFetch(`/staff-app/chat/channels/${encodeURIComponent(String(channelId))}/linkable-requests${qs(params)}`);

export const listStaffChatChannelMembers = (channelId, params = {}) =>
    apiFetch(`/staff-app/chat/channels/${encodeURIComponent(String(channelId))}/members${qs(params)}`);

export const listStaffChatMessages = (channelId, params = {}) =>
    apiFetch(`/staff-app/chat/channels/${encodeURIComponent(String(channelId))}/messages${qs(params)}`);

export const sendStaffChatMessage = (channelId, body, params = {}) =>
    apiFetch(`/staff-app/chat/channels/${encodeURIComponent(String(channelId))}/messages${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const listStaffAppNotifications = (params = {}) =>
    apiFetch(`/staff-app/notifications${qs(params)}`);

export const getStaffAppSettings = (params = {}) =>
    apiFetch(`/staff-app/settings${qs(params)}`);

export const updateStaffAppSettings = (body, params = {}) =>
    apiFetch(`/staff-app/settings${qs(params)}`, { method: 'PATCH', body: JSON.stringify(body ?? {}) });

export const listWorkshopPurchaseOrders = (params = {}) =>
    apiFetch(`/workshop-staff/purchase-orders${qs(params)}`);

export const createWorkshopPurchaseOrder = (body, params = {}) =>
    apiFetch(`/workshop-staff/purchase-orders${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
    });

export const submitWorkshopPurchaseOrder = (id, params = {}) =>
    apiFetch(`/workshop-staff/purchase-orders/${encodeURIComponent(String(id))}/submit${qs(params)}`, {
        method: 'PATCH',
    });
