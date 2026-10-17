import { apiFetch } from './api';

export const referrerPortalGetOverview = () => apiFetch('/referrer-portal/overview');

export const referrerPortalListPayouts = () => apiFetch('/referrer-portal/payout-requests');

export const referrerPortalCreatePayout = (body) =>
  apiFetch('/referrer-portal/payout-requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const referrerPortalListReferrals = () => apiFetch('/referrer-portal/referrals');

export const referrerPortalGetReferral = (id) =>
  apiFetch(`/referrer-portal/referrals/${encodeURIComponent(String(id))}`);

export const referrerPortalGetNotifications = () => apiFetch('/referrer-portal/notifications');

export const referrerPortalMarkNotificationsRead = () =>
  apiFetch('/referrer-portal/notifications/read', { method: 'POST', body: JSON.stringify({}) });

export const referrerPortalUpdateProfile = (body) =>
  apiFetch('/referrer-portal/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const referrerPortalChangePassword = (body) =>
  apiFetch('/referrer-portal/change-password', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const referrerPortalGetReports = (params = {}) => {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch(`/referrer-portal/reports${suffix}`);
};
